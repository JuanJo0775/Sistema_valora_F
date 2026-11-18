import { Suspense, useRef } from 'react';
import { NavLink, Outlet } from 'react-router';
import logoDark from '../assets/logo-horizontal-oscuro.png';
import logoLight from '../assets/logo-horizontal-claro.png';
import { useBasket } from '../features/basket/basketContext';
import { VerifyEmailBanner } from '../features/auth/VerifyEmailBanner';
import { BasketToast } from '../features/basket/BasketToast';
import { PendingBanner } from '../pwa/PendingBanner';
import { UpdateBanner } from '../pwa/UpdateBanner';
import { OfflineBanner } from '../shared/ui/OfflineBanner';
import { SkeletonList } from '../shared/ui/Skeleton';
import { CookieNotice } from '../features/legal/CookieNotice';
import { useRouteTitle } from './routeTitle';
import { HeaderSearch } from './HeaderSearch';
import { Icon, type IconName } from './Icon';
import './layout.css';

// Barra principal del prototipo de referencia (docs/UX.md). Mis aportes y Moderación se abren
// desde «Yo».
const SECTIONS: { to: string; label: string; icon: IconName; primary?: boolean }[] = [
  { to: '/', label: 'Inicio', icon: 'home' },
  { to: '/mapa', label: 'Mapa', icon: 'map' },
  { to: '/registrar', label: 'Registrar precio', icon: 'plus', primary: true },
  { to: '/canasta', label: 'Canasta', icon: 'basket' },
  { to: '/yo', label: 'Yo', icon: 'user' },
];

export function Layout() {
  const { items } = useBasket();
  const mainRef = useRef<HTMLElement>(null);
  const title = useRouteTitle(mainRef);
  const toBuy = items.filter(({ bought }) => !bought).length;
  return (
    <div className="shell">
      {/* Con teclado, el primer Tab ofrece saltarse la barra superior. Se enfoca el contenido sin
          tocar la direcci�n. */}
      <a
        className="skip-link"
        href="#contenido"
        onClick={(event) => {
          event.preventDefault();
          mainRef.current?.focus();
        }}
      >
        Saltar al contenido
      </a>
      {/* Celular: el logo arriba y la navegación fija abajo. Escritorio (#48): una sola barra arriba
          con logo, buscador, secciones y «Registrar precio». */}
      <header className="top">
        <NavLink to="/" className="logo-link" aria-label="Valora, inicio">
          {/* Dos imágenes y CSS según el tema real (layout.css): <picture> con prefers-color-scheme
              ignoraría la elección manual. El nombre va en el enlace (aria-label): con el tema oscuro la imagen clara se oculta. */}
          <img
            className="logo-img logo-light"
            src={logoLight}
            alt=""
            aria-hidden="true"
            width="144"
            height="48"
          />
          <img
            className="logo-img logo-dark"
            src={logoDark}
            alt=""
            aria-hidden="true"
            width="154"
            height="48"
          />
        </NavLink>
        <HeaderSearch />
        <nav className="tabbar" aria-label="Principal">
          {SECTIONS.map(({ to, label, icon, primary }) => (
            <NavLink key={to} to={to} end className={primary ? 'tab primary' : 'tab'}>
              <Icon name={icon} />
              <span className="tab-label">{label}</span>
              {/* #31: cuántos productos faltan por comprar. */}
              {to === '/canasta' && toBuy > 0 && (
                <>
                  <span className="badge" aria-hidden="true">
                    {toBuy}
                  </span>
                  <span className="sr-only">{`, ${String(toBuy)} por comprar`}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </header>
      <OfflineBanner />
      <PendingBanner />
      <UpdateBanner />
      <VerifyEmailBanner />
      <main className="page" id="contenido" tabIndex={-1} ref={mainRef}>
        {/* H-26: las pantallas menos usadas se descargan al abrirlas (App.tsx); mientras, el esqueleto. */}
        <Suspense fallback={<SkeletonList kind="row" count={4} />}>
          <Outlet />
        </Suspense>
      </main>
      {/* Al cambiar de pantalla se anuncia su título a los lectores de pantalla. Es una región viva sin
          role="status": las pantallas ya usan ese rol para sus propios avisos y las pruebas buscan «el»
          estado de la pantalla (un segundo role="status" las vuelve ambiguas). */}
      <p className="sr-only" aria-live="polite" aria-atomic="true" data-testid="route-announcer">
        {title}
      </p>
      <BasketToast />
      <CookieNotice />
    </div>
  );
}
