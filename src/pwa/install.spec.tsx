import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InstallRow } from './InstallRow';
import { InstallStrip } from './InstallStrip';
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

describe('franja del Inicio', () => {
  it('con el evento ofrece «Instalar Valora» y abre el cuadro del navegador', async () => {
    startInstallListener();
    render(<InstallStrip />);
    const { event, prompt } = fakeInstallEvent();
    act(() => {
      window.dispatchEvent(event);
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Instalar Valora' }));

    expect(prompt).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('complementary', { name: 'Instalar la app' })).toBeInTheDocument();
  });

  it('en iPhone con Safari explica Compartir > Añadir a pantalla de inicio', () => {
    setBrowser(IPHONE_SAFARI, { platform: 'iPhone', touch: 5 });
    render(<InstallStrip />);

    const how = screen.getByRole('button', { name: 'Cómo instalar' });
    expect(how).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(how);

    expect(how).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('list')).toHaveTextContent('Compartir');
    expect(screen.getByRole('list')).toHaveTextContent('Añadir a pantalla de inicio');
  });

  it('en iPad (que se presenta como Mac) también muestra la guía de Safari', () => {
    setBrowser(IPAD_AS_MAC, { platform: 'MacIntel', touch: 5 });
    render(<InstallStrip />);
    fireEvent.click(screen.getByRole('button', { name: 'Cómo instalar' }));
    expect(screen.getByRole('list')).toHaveTextContent('Añadir a pantalla de inicio');
  });

  it('en iOS con otro navegador pide abrirla en Safari', () => {
    setBrowser(IPHONE_CHROME, { platform: 'iPhone', touch: 5 });
    render(<InstallStrip />);
    fireEvent.click(screen.getByRole('button', { name: 'Cómo instalar' }));
    expect(screen.getByRole('list')).toHaveTextContent('Ábrela en Safari');
  });

  it('en un celular Android sin evento indica el menú del navegador', () => {
    render(<InstallStrip />);
    fireEvent.click(screen.getByRole('button', { name: 'Cómo instalar' }));
    expect(screen.getByRole('list')).toHaveTextContent('menú del navegador');
  });

  it('en el computador sin evento no aparece', () => {
    setBrowser(DESKTOP_CHROME);
    const { container } = render(<InstallStrip />);
    expect(container).toBeEmptyDOMElement();
  });

  it('ya instalada, no aparece', () => {
    setStandalone(true);
    const { container } = render(<InstallStrip />);
    expect(container).toBeEmptyDOMElement();
  });

  it('«Ahora no» la esconde, lo recuerda y sigue escondida al volver', () => {
    const first = render(<InstallStrip />);
    fireEvent.click(screen.getByRole('button', { name: 'Ahora no' }));
    expect(first.container).toBeEmptyDOMElement();
    expect(localStorage.getItem(HIDDEN_KEY)).not.toBeNull();

    first.unmount();
    const again = render(<InstallStrip />);
    expect(again.container).toBeEmptyDOMElement();
  });

  it('pasados 14 días vuelve a aparecer', () => {
    localStorage.setItem(HIDDEN_KEY, String(Date.now() - (HIDDEN_DAYS + 1) * 86_400_000));
    render(<InstallStrip />);
    expect(screen.getByRole('complementary', { name: 'Instalar la app' })).toBeInTheDocument();
  });

  it('es accesible: todo se alcanza con botones con nombre y la guía está enlazada', () => {
    render(<InstallStrip />);
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
      <ul>
        <InstallRow />
      </ul>,
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
});
