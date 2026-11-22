import { useEffect, useRef, useState, type RefObject } from 'react';
import { useLocation } from 'react-router';

const SUFFIX = ' · Valora';

const FIXED: Record<string, string> = {
  '/': 'Inicio',
  '/mapa': 'Mapa',
  '/registrar': 'Registrar precio',
  '/comercios/registro': 'Registrar mi tienda',
  '/canasta': 'Canasta',
  '/yo': 'Tu cuenta',
  '/yo/ajustes': 'Ajustes',
  '/yo/app': 'Instalar y desinstalar la app',
  '/yo/eliminar-cuenta': 'Eliminar mi cuenta',
  '/entrar': 'Entrar',
  '/crear-cuenta': 'Crear cuenta',
  '/olvide-contrasena': 'Olvidé mi contraseña',
  '/restablecer-contrasena': 'Restablecer contraseña',
  '/privacidad': 'Privacidad',
  '/verificar-correo': 'Verificar correo',
  // F#154: quien entró con Google y aún no tiene cuenta.
  '/bienvenida': 'Bienvenida',
  '/pendientes': 'Pendientes',
  '/mis-aportes': 'Mis aportes',
  '/moderacion': 'Moderación',
  '/proponer/producto': 'Proponer producto',
  '/proponer/tienda': 'Proponer tienda',
};

// Título del documento (WCAG 2.4.2). Las pantallas de un producto o una tienda toman el nombre de
// su encabezado h1, que llega cuando carga el dato.
export function titleFor(pathname: string, heading: string): string {
  const fixed = FIXED[pathname];
  if (fixed) return fixed + SUFFIX;
  if (!heading) return 'Valora';
  if (/^\/productos\/[^/]+\/historial$/.test(pathname)) return `Historial de ${heading}${SUFFIX}`;
  if (/^\/(productos|tiendas)\/[^/]+$/.test(pathname)) return heading + SUFFIX;
  return 'Valora';
}

// Pone el título de la ruta y, al cambiar de pantalla (no en la carga inicial ni al cambiar solo la
// búsqueda), lleva el foco al contenido sin mover el scroll y devuelve el título para anunciarlo.
export function useRouteTitle(main: RefObject<HTMLElement | null>): string {
  const { pathname } = useLocation();
  const [title, setTitle] = useState('');
  const first = useRef(true);

  useEffect(() => {
    const element = main.current;
    const update = () => {
      const next = titleFor(pathname, element?.querySelector('h1')?.textContent.trim() ?? '');
      document.title = next;
      setTitle(next);
    };
    update();
    if (first.current) first.current = false;
    else element?.focus({ preventScroll: true });
    if (!element || typeof MutationObserver === 'undefined') return;
    // El nombre del producto o de la tienda llega después de la carga.
    const observer = new MutationObserver(update);
    observer.observe(element, { childList: true, subtree: true, characterData: true });
    return () => {
      observer.disconnect();
    };
  }, [pathname, main]);

  return title;
}
