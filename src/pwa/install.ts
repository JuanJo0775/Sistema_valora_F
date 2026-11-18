import { readStored, writeStored } from '../shared/storage';

// Instalar la app. Chrome, Edge y Samsung Internet (Android) avisan con `beforeinstallprompt` y
// dejan mostrar el cuadro de instalación cuando la persona lo pide. Safari en iPhone y iPad no tiene
// ese evento: solo se instala desde Compartir > Añadir a pantalla de inicio, así que se explica.

export const HIDDEN_KEY = 'valora:instalar-oculto';
export const HIDDEN_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type Platform = 'ios-safari' | 'ios-other' | 'android' | 'other';

interface InstallState {
  deferred: BeforeInstallPromptEvent | null;
  installed: boolean;
}

let state: InstallState = { deferred: null, installed: false };
const listeners = new Set<() => void>();
let started: Window | null = null;

function update(next: Partial<InstallState>) {
  state = { ...state, ...next };
  listeners.forEach((listener) => {
    listener();
  });
}

export const subscribeInstall = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export const getInstallState = () => state;

// Se llama una sola vez al arrancar (main.tsx): el evento puede llegar antes de que la pantalla que
// lo usa exista, así que se guarda aquí.
export function startInstallListener(win: Window = window) {
  if (started === win) return;
  started = win;
  win.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    update({ deferred: event as BeforeInstallPromptEvent });
  });
  win.addEventListener('appinstalled', () => {
    update({ deferred: null, installed: true });
  });
}

// Solo para las pruebas: vuelve al estado inicial.
export function resetInstallState() {
  state = { deferred: null, installed: false };
  started = null;
}

export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  const event = state.deferred;
  if (!event) return 'unavailable';
  // El navegador solo deja usar el evento una vez.
  update({ deferred: null });
  await event.prompt();
  const { outcome } = await event.userChoice;
  return outcome;
}

type Nav = Pick<Navigator, 'userAgent' | 'maxTouchPoints'> & { platform?: string };

// Marcas de otro navegador o de la ventana interna de otra app (WhatsApp, Instagram, Facebook...).
const NOT_SAFARI =
  /CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|GSA\/|FBAN|FBAV|Instagram|Line\/|MicroMessenger|Snapchat/;

export function detectPlatform(nav: Nav = navigator): Platform {
  const ua = nav.userAgent;
  // iPadOS 13+ se presenta como un Mac, pero con pantalla táctil.
  const ipadAsMac = nav.platform === 'MacIntel' && nav.maxTouchPoints > 1;
  if (/iPhone|iPad|iPod/.test(ua) || ipadAsMac) {
    return NOT_SAFARI.test(ua) ? 'ios-other' : 'ios-safari';
  }
  if (/Android/.test(ua)) return 'android';
  return 'other';
}

export const isMobileDevice = (nav: Nav = navigator) =>
  detectPlatform(nav) !== 'other' || /Mobi/.test(nav.userAgent);

export function isInstalled(win: Window = window): boolean {
  const standalone = (win.navigator as Navigator & { standalone?: boolean }).standalone === true;
  const displayMode =
    typeof win.matchMedia === 'function' && win.matchMedia('(display-mode: standalone)').matches;
  return standalone || displayMode;
}

// «Ahora no»: se recuerda 14 días y la franja vuelve a aparecer.
export function isHiddenForNow(now = Date.now()): boolean {
  const saved = Number(readStored(HIDDEN_KEY));
  if (!Number.isFinite(saved) || saved <= 0) return false;
  return now - saved < HIDDEN_DAYS * DAY_MS;
}

export function hideForNow(now = Date.now()) {
  writeStored(HIDDEN_KEY, String(now));
}
