import { BrowserRouter, Route, Routes } from 'react-router';
import { Profile } from '../features/auth/Profile';
import { RequireRole } from '../features/auth/RequireRole';
import { SessionProvider } from '../features/auth/SessionProvider';
import { SignIn } from '../features/auth/SignIn';
import { SignUp } from '../features/auth/SignUp';
import { PendingReports } from '../pwa/PendingReports';
import { ReportQueueProvider } from '../pwa/ReportQueueProvider';
import { ProductDetail } from '../features/catalog/ProductDetail';
import { ComparePrices } from '../features/comparison/ComparePrices';
import { ProductSearch } from '../features/catalog/ProductSearch';
import { ReportPrice } from '../features/reports/ReportPrice';
import { EmptyState } from '../shared/ui/EmptyState';
import { Layout } from './Layout';

// Inicio del prototipo de MC-E4: una sola idea, buscar lo que se va a comprar.
function Home() {
  return (
    <>
      <h1>¿Qué vas a comprar hoy?</h1>
      <p className="muted">
        Precios de tiendas de barrio, minimercados y supermercados cerca de ti.
      </p>
      <ProductSearch />
    </>
  );
}

// Secciones que todavía no tienen pantalla: cada una dice con qué issue llega.
function Soon({ title, issue }: { title: string; issue: number }) {
  return (
    <EmptyState
      title={title}
      text={`Esta sección está en construcción (issue #${String(issue)}).`}
    />
  );
}

export function App() {
  return (
    <SessionProvider>
      <ReportQueueProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<Home />} />
              <Route path="/productos/:productId" element={<ProductDetail />} />
              <Route path="/productos/:productId/comparar" element={<ComparePrices />} />
              <Route
                path="/productos/:productId/historial"
                element={<Soon title="Historial de precios" issue={17} />}
              />
              <Route path="/mapa" element={<Soon title="Mapa" issue={18} />} />
              <Route
                path="/registrar"
                element={
                  <RequireRole role="reportante" allowOffline>
                    <ReportPrice />
                  </RequireRole>
                }
              />
              <Route
                path="/mis-aportes"
                element={
                  <RequireRole role="reportante" allowSuspended>
                    <Soon title="Mis aportes" issue={13} />
                  </RequireRole>
                }
              />
              <Route
                path="/moderacion"
                element={
                  <RequireRole role="moderador">
                    <Soon title="Moderación" issue={14} />
                  </RequireRole>
                }
              />
              <Route path="/pendientes" element={<PendingReports />} />
              <Route path="/yo" element={<Profile />} />
              <Route path="/entrar" element={<SignIn />} />
              <Route path="/crear-cuenta" element={<SignUp />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ReportQueueProvider>
    </SessionProvider>
  );
}
