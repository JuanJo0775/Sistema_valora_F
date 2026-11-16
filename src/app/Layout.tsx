import { NavLink, Outlet } from 'react-router';
import logoDark from '../assets/logo-oscuro.png';
import logoLight from '../assets/logo-claro.png';
import { PendingBanner } from '../pwa/PendingBanner';
import { UpdateBanner } from '../pwa/UpdateBanner';
import { OfflineBanner } from '../shared/ui/OfflineBanner';
import { HeaderSearch } from './HeaderSearch';
import { Icon, type IconName } from './Icon';
import './layout.css';

// Barra principal del prototipo de MC-E4. Mis aportes y Moderación se abren desde «Yo».
const SECTIONS: { to: string; label: string; icon: IconName; primary?: boolean }[] = [
  { to: '/', label: 'Inicio', icon: 'home' },
  { to: '/mapa', label: 'Mapa', icon: 'map' },
  { to: '/registrar', label: 'Registrar precio', icon: 'plus', primary: true },
  { to: '/yo', label: 'Yo', icon: 'user' },
];

export function Layout() {
  return (
    <div className="shell">
      {/* Celular: el logo arriba y la navegación fija abajo. Escritorio (#48): una sola barra arriba
          con logo, buscador, secciones y «Registrar precio». */}
      <header className="top">
        <NavLink to="/" className="logo-link">
          <picture>
            <source srcSet={logoDark} media="(prefers-color-scheme: dark)" />
            <img src={logoLight} alt="Valora, inicio" width="96" height="26" />
          </picture>
        </NavLink>
        <HeaderSearch />
        <nav className="tabbar" aria-label="Principal">
          {SECTIONS.map(({ to, label, icon, primary }) => (
            <NavLink key={to} to={to} end className={primary ? 'tab primary' : 'tab'}>
              <Icon name={icon} />
              <span className="tab-label">{label}</span>
            </NavLink>
          ))}
        </nav>
      </header>
      <OfflineBanner />
      <PendingBanner />
      <UpdateBanner />
      <main className="page">
        <Outlet />
      </main>
    </div>
  );
}
