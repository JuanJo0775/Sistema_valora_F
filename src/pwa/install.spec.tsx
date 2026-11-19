import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InstallRow } from './InstallRow';
import { MemoryRouter } from 'react-router';
import { dismissCookieNotice } from '../features/legal/cookieNoticeState';
import { InstallAndUninstall } from './InstallAndUninstall';
import { InstallPrompt, INSTALL_PROMPT_DELAY_MS } from './InstallPrompt';
import { deviceOf, UninstallGuide } from './UninstallGuide';
import {
  detectPlatform,
  HIDDEN_DAYS,
  HIDDEN_KEY,
  isHiddenForNow,
  hideForNow,
  resetInstallState,
  startInstallListener,
} from './install';
import { useInstall } from './useInstall';

const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
const IPHONE_CHROME =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/124.0.0.0 Mobile/15E148 Safari/604.1';
const IPHONE_WHATSAPP_VIEW =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 320.0';
const ANDROID_CHROME =
  'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';
const DESKTOP_CHROME =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const IPAD_AS_MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15';

function setBrowser(userAgent: string, extra: { platform?: string; touch?: number } = {}) {
  const values = {
    userAgent,
    platform: extra.platform ?? 'Linux',
    maxTouchPoints: extra.touch ?? 0,
  };
  for (const [name, value] of Object.entries(values)) {
    Object.defineProperty(navigator, name, { value, configurable: true });
  }
}

function setStandalone(on: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: on && query === '(display-mode: standalone)',
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

function fakeInstallEvent(outcome: 'accepted' | 'dismissed' = 'accepted') {
  const event = new Event('beforeinstallprompt', { cancelable: true });
  const prompt = vi.fn(() => Promise.resolve());
  Object.assign(event, { prompt, userChoice: Promise.resolve({ outcome }) });
  return { event, prompt };
}

beforeEach(() => {
  resetInstallState();
  setStandalone(false);
  setBrowser(ANDROID_CHROME);
});
afterEach(() => {
  vi.restoreAllMocks();
  for (const name of ['userAgent', 'platform', 'maxTouchPoints', 'standalone']) {
    Reflect.deleteProperty(navigator, name);
  }
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('detección del dispositivo', () => {
  it('reconoce iPhone con Safari, otros navegadores de iOS y las ventanas internas de otras apps', () => {
    expect(detectPlatform({ userAgent: IPHONE_SAFARI, maxTouchPoints: 5 })).toBe('ios-safari');
    expect(detectPlatform({ userAgent: IPHONE_CHROME, maxTouchPoints: 5 })).toBe('ios-other');
    expect(detectPlatform({ userAgent: IPHONE_WHATSAPP_VIEW, maxTouchPoints: 5 })).toBe(
      'ios-other',
    );
  });

  it('reconoce el iPad que se presenta como Mac, pero no un Mac de verdad', () => {
    expect(
      detectPlatform({ userAgent: IPAD_AS_MAC, platform: 'MacIntel', maxTouchPoints: 5 }),
    ).toBe('ios-safari');
    expect(
      detectPlatform({ userAgent: IPAD_AS_MAC, platform: 'MacIntel', maxTouchPoints: 0 }),
    ).toBe('other');
  });

  it('reconoce Android y el computador', () => {
    expect(detectPlatform({ userAgent: ANDROID_CHROME, maxTouchPoints: 5 })).toBe('android');
    expect(detectPlatform({ userAgent: DESKTOP_CHROME, maxTouchPoints: 0 })).toBe('other');
  });
});

describe('«ahora no» se recuerda 14 días', () => {
  it('oculta durante 14 días y después vuelve', () => {
    const now = Date.UTC(2026, 10, 18);
    expect(isHiddenForNow(now)).toBe(false);
    hideForNow(now);
    expect(localStorage.getItem(HIDDEN_KEY)).toBe(String(now));
    expect(isHiddenForNow(now + (HIDDEN_DAYS - 1) * 86_400_000)).toBe(true);
    expect(isHiddenForNow(now + HIDDEN_DAYS * 86_400_000 + 1)).toBe(false);
  });

  it('un valor dañado en el almacenamiento no la esconde', () => {
    localStorage.setItem(HIDDEN_KEY, 'no-es-un-numero');
    expect(isHiddenForNow()).toBe(false);
  });
});

describe('useInstall con eventos simulados', () => {
  it('guarda beforeinstallprompt, evita la mini barra del navegador y prompt() lo usa una vez', async () => {
    startInstallListener();
    const { result } = renderHook(() => useInstall());
    expect(result.current.canPrompt).toBe(false);

    const { event, prompt } = fakeInstallEvent();
    act(() => {
      window.dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(true);
    expect(result.current.canPrompt).toBe(true);

    await act(async () => {
      await result.current.install();
    });
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(result.current.canPrompt).toBe(false);
    expect(result.current.hidden).toBe(false);
  });

  it('si la persona rechaza el cuadro del navegador, se recuerda como «ahora no»', async () => {
    startInstallListener();
    const { result } = renderHook(() => useInstall());
    act(() => {
      window.dispatchEvent(fakeInstallEvent('dismissed').event);
    });

    await act(async () => {
      await result.current.install();
    });

    expect(result.current.hidden).toBe(true);
    expect(localStorage.getItem(HIDDEN_KEY)).not.toBeNull();
  });

  it('appinstalled marca la app como instalada', () => {
    startInstallListener();
    const { result } = renderHook(() => useInstall());
    act(() => {
      window.dispatchEvent(fakeInstallEvent().event);
      window.dispatchEvent(new Event('appinstalled'));
    });
    expect(result.current.installed).toBe(true);
    expect(result.current.canPrompt).toBe(false);
  });

  it('abierta desde el ícono (display-mode standalone o navigator.standalone) cuenta como instalada', () => {
    setStandalone(true);
    expect(renderHook(() => useInstall()).result.current.installed).toBe(true);

    setStandalone(false);
    Object.defineProperty(navigator, 'standalone', { value: true, configurable: true });
    expect(renderHook(() => useInstall()).result.current.installed).toBe(true);
  });

  it('escuchar dos veces no duplica el evento', () => {
    const add = vi.spyOn(window, 'addEventListener');
    startInstallListener();
    startInstallListener();
    expect(add.mock.calls.filter(([type]) => type === 'beforeinstallprompt')).toHaveLength(1);
  });
});

// Con las cookies ya aceptadas y pasados unos segundos de uso, que es cuando el aviso puede salir.
function renderPrompt(path = '/') {
  vi.useFakeTimers();
  localStorage.setItem('valora:aviso-cookies', '1');
  const view = render(
    <MemoryRouter initialEntries={[path]}>
      <InstallPrompt />
    </MemoryRouter>,
  );
  const wait = () => {
    act(() => {
      vi.advanceTimersByTime(INSTALL_PROMPT_DELAY_MS);
    });
  };
  return { ...view, wait };
}

const promptRegion = () => screen.queryByRole('region', { name: 'Instalar la app' });
const onIphone = () => {
  setBrowser(IPHONE_SAFARI, { platform: 'iPhone', touch: 5 });
};

describe('aviso de instalar en cualquier pantalla', () => {
  it('con el evento ofrece «Instalar Valora» tras unos segundos y abre el cuadro del navegador', async () => {
    startInstallListener();
    const view = renderPrompt('/mapa');
    const { event, prompt } = fakeInstallEvent();
    act(() => {
      window.dispatchEvent(event);
    });
    expect(promptRegion()).toBeNull();
    view.wait();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Instalar Valora' }));
      await Promise.resolve();
    });

    expect(prompt).toHaveBeenCalledTimes(1);
  });

  it.each(['/', '/productos/abc', '/mapa', '/canasta'])('sale también en %s', (path) => {
    startInstallListener();
    const view = renderPrompt(path);
    act(() => {
      window.dispatchEvent(fakeInstallEvent().event);
    });
    view.wait();
    expect(promptRegion()).not.toBeNull();
  });

  it('no sale antes de los segundos de espera', () => {
    onIphone();
    renderPrompt();
    act(() => {
      vi.advanceTimersByTime(INSTALL_PROMPT_DELAY_MS - 1000);
    });
    expect(promptRegion()).toBeNull();
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(promptRegion()).not.toBeNull();
  });

  it('en iPhone con Safari explica Compartir > Añadir a pantalla de inicio', () => {
    onIphone();
    renderPrompt().wait();

    const how = screen.getByRole('button', { name: 'Cómo instalar' });
    expect(how).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(how);

    expect(how).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('list')).toHaveTextContent('Compartir');
    expect(screen.getByRole('list')).toHaveTextContent('Añadir a pantalla de inicio');
  });

  it('en iPad (que se presenta como Mac) también muestra la guía de Safari', () => {
    setBrowser(IPAD_AS_MAC, { platform: 'MacIntel', touch: 5 });
    renderPrompt().wait();
    fireEvent.click(screen.getByRole('button', { name: 'Cómo instalar' }));
    expect(screen.getByRole('list')).toHaveTextContent('Añadir a pantalla de inicio');
  });

  it('en iOS con otro navegador pide abrirla en Safari', () => {
    setBrowser(IPHONE_CHROME, { platform: 'iPhone', touch: 5 });
    renderPrompt().wait();
    fireEvent.click(screen.getByRole('button', { name: 'Cómo instalar' }));
    expect(screen.getByRole('list')).toHaveTextContent('Ábrela en Safari');
  });

  it('en Android sin evento no sale: Chrome decide cuándo ofrecer, y en Yo está la guía', () => {
    renderPrompt().wait();
    expect(promptRegion()).toBeNull();
  });

  it('en el computador sin evento no aparece', () => {
    setBrowser(DESKTOP_CHROME);
    renderPrompt().wait();
    expect(promptRegion()).toBeNull();
  });

  it('en el computador con evento habla de la ventana propia', () => {
    setBrowser(DESKTOP_CHROME);
    startInstallListener();
    const view = renderPrompt();
    act(() => {
      window.dispatchEvent(fakeInstallEvent().event);
    });
    view.wait();
    expect(promptRegion()).toHaveTextContent('en su propia ventana');
  });

  it('ya instalada, no aparece', () => {
    setStandalone(true);
    onIphone();
    renderPrompt().wait();
    expect(promptRegion()).toBeNull();
  });

  it('no sale al registrar un precio', () => {
    onIphone();
    renderPrompt('/registrar?producto=abc').wait();
    expect(promptRegion()).toBeNull();
  });

  it('espera al aviso de cookies: primero cookies, luego instalar, nunca los dos', () => {
    onIphone();
    const view = renderPrompt();
    localStorage.removeItem('valora:aviso-cookies');
    view.rerender(
      <MemoryRouter>
        <InstallPrompt />
      </MemoryRouter>,
    );
    view.wait();
    expect(promptRegion()).toBeNull();

    act(() => {
      dismissCookieNotice();
    });

    expect(promptRegion()).not.toBeNull();
  });

  it('«Ahora no» la esconde, lo recuerda 14 días y sigue escondida al volver', () => {
    onIphone();
    const first = renderPrompt();
    first.wait();
    fireEvent.click(screen.getByRole('button', { name: 'Ahora no' }));
    expect(promptRegion()).toBeNull();
    expect(localStorage.getItem(HIDDEN_KEY)).not.toBeNull();

    first.unmount();
    renderPrompt().wait();
    expect(promptRegion()).toBeNull();
  });

  it('Escape también la cierra', () => {
    onIphone();
    renderPrompt().wait();
    fireEvent.keyDown(screen.getByRole('button', { name: 'Cómo instalar' }), { key: 'Escape' });
    expect(promptRegion()).toBeNull();
  });

  it('pasados 14 días vuelve a aparecer', () => {
    onIphone();
    localStorage.setItem(HIDDEN_KEY, String(Date.now() - (HIDDEN_DAYS + 1) * 86_400_000));
    renderPrompt().wait();
    expect(promptRegion()).not.toBeNull();
  });

  it('es accesible: región viva siempre presente, botones con nombre y guía enlazada', () => {
    onIphone();
    const { container, wait } = renderPrompt();
    const live = container.querySelector('[aria-live="polite"]');
    expect(live).not.toBeNull();
    wait();
    expect(live).toContainElement(promptRegion());
    const how = screen.getByRole('button', { name: 'Cómo instalar' });
    fireEvent.click(how);
    const guide = document.getElementById(how.getAttribute('aria-controls') ?? '');
    expect(guide?.tagName).toBe('OL');
    expect(screen.getAllByRole('button').every((b) => b.textContent)).toBe(true);
    // Sin emojis ni imágenes.
    expect(document.querySelector('img')).toBeNull();
    expect(document.body.textContent).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});

describe('fila «Instalar la app» de Yo', () => {
  const inList = () =>
    render(
      <MemoryRouter>
        <ul>
          <InstallRow />
        </ul>
      </MemoryRouter>,
    );

  it('con el evento abre el cuadro de instalación', () => {
    startInstallListener();
    inList();
    const { event, prompt } = fakeInstallEvent();
    act(() => {
      window.dispatchEvent(event);
    });
    fireEvent.click(screen.getByRole('button', { name: /Instalar la app/ }));
    expect(prompt).toHaveBeenCalledTimes(1);
  });

  it('sin evento despliega la guía, aunque se haya dicho «ahora no»', () => {
    hideForNow();
    inList();
    const row = screen.getByRole('button', { name: /Instalar la app/ });
    expect(row).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(row);
    expect(row).toHaveAttribute('aria-expanded', 'true');
    expect(document.querySelector('ol.install-steps')).not.toBeNull();
  });

  it('ya instalada dice que lo está y no ofrece botón', () => {
    setStandalone(true);
    inList();
    expect(screen.getByText('Valora ya está instalada en este dispositivo.')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('no anuncia «Desinstalar» en Yo: la guía se llama desde la fila de instalar', () => {
    inList();
    expect(screen.queryByText(/Desinstalar la app/)).toBeNull();
    expect(screen.getByRole('link', { name: 'Ver la guía completa' })).toHaveAttribute(
      'href',
      '/yo/app',
    );
  });
});

describe('desinstalar la app', () => {
  const page = () =>
    render(
      <MemoryRouter>
        <InstallAndUninstall />
      </MemoryRouter>,
    );
  const openTitles = () =>
    [...document.querySelectorAll('details')]
      .filter((d) => d.open)
      .map((d) => d.querySelector('summary')?.textContent ?? '');
  const allTitles = () =>
    [...document.querySelectorAll('details > summary')].map((n) => n.textContent);

  it('elige el dispositivo según la plataforma detectada', () => {
    expect(deviceOf(detectPlatform({ userAgent: DESKTOP_CHROME, maxTouchPoints: 0 }))).toBe('pc');
    expect(deviceOf(detectPlatform({ userAgent: ANDROID_CHROME, maxTouchPoints: 5 }))).toBe(
      'android',
    );
    expect(deviceOf(detectPlatform({ userAgent: IPHONE_SAFARI, maxTouchPoints: 5 }))).toBe('ios');
    expect(deviceOf(detectPlatform({ userAgent: IPHONE_CHROME, maxTouchPoints: 5 }))).toBe('ios');
  });

  it('instalada en un computador: avisa, trae los pasos de PC primero y los demás plegados', () => {
    setStandalone(true);
    setBrowser(DESKTOP_CHROME, { platform: 'Win32' });
    page();

    expect(screen.getByRole('status')).toHaveTextContent('Estás usando la app instalada');
    expect(allTitles()[0]).toContain('Computador');
    expect(openTitles()).toHaveLength(1);
    expect(openTitles()[0]).toContain('Computador');
    const text = document.body.textContent;
    expect(text).toContain('Desinstalar Valora…');
    expect(text).toContain('Aplicaciones instaladas');
    expect(text).toContain('borrar también los datos');
  });

  it('en Android pone Android primero', () => {
    setStandalone(true);
    page();
    expect(allTitles()[0]).toBe('Android (este dispositivo)');
    expect(openTitles()).toEqual(['Android (este dispositivo)']);
    expect(document.body.textContent).toContain('Mantén pulsado el ícono');
  });

  it('en iPhone pone iPhone y iPad primero, con «Eliminar app»', () => {
    setStandalone(true);
    onIphone();
    page();
    expect(allTitles()[0]).toContain('iPhone y iPad');
    expect(document.body.textContent).toContain('Eliminar de la pantalla de inicio');
  });

  it('sin instalar no muestra el aviso de «app instalada», pero sí los pasos y la nota de datos', () => {
    page();
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Desinstalar' })).toBeInTheDocument();
    expect(document.body.textContent).toContain('no borra tu cuenta ni tus aportes');
  });

  it('sin emojis ni imágenes', () => {
    render(<UninstallGuide device="pc" />);
    expect(document.querySelector('img')).toBeNull();
    expect(document.body.textContent).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});

describe('aviso de instalar: estilos', () => {
  const read = (path: string) =>
    readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');

  it('se coloca sobre la barra, la barra de compra y cede ante las cookies', () => {
    const css = read('./install.css');
    const block = /\.install-prompt\s*\{[^}]*\}/.exec(css)?.[0] ?? '';
    expect(block).toMatch(/position:\s*fixed/);
    expect(block).toMatch(/var\(--tabbar-h\)/);
    expect(block).toMatch(/var\(--action-bar-h\)/);
    expect(css).toMatch(/:root:has\(\.cookie-notice\)\s*\.install-prompt\s*\{\s*display:\s*none/);
  });

  it('la página reserva sitio mientras el aviso está', () => {
    const layout = read('../app/layout.css');
    expect(layout).toMatch(/:root:has\(\.install-prompt\)\s*\{\s*--install-h:\s*\d+px/);
    expect(layout).toMatch(/\.page\s*\{[^}]*var\(--install-h\)/);
  });
});
