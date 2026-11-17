import { BrowserRouter, Navigate, Route, Routes, useParams, useSearchParams } from 'react-router';
import { Profile } from '../features/auth/Profile';
import { Settings } from '../features/auth/Settings';
import { RequireRole } from '../features/auth/RequireRole';
import { SessionProvider } from '../features/auth/SessionProvider';
import { SignIn } from '../features/auth/SignIn';
import { SignUp } from '../features/auth/SignUp';
import { VerifyEmail } from '../features/auth/VerifyEmail';
import { PendingReports } from '../pwa/PendingReports';
import { ReportQueueProvider } from '../pwa/ReportQueueProvider';
import { BasketPage } from '../features/basket/BasketPage';
import { BasketProvider } from '../features/basket/BasketProvider';
import { BasketSummary } from '../features/basket/BasketSummary';
import { ProductDetail } from '../features/catalog/ProductDetail';
import { TodayBasket } from '../features/comparison/TodayBasket';
import { MyReports } from '../features/contributions/MyReports';
import { ModerationPanel } from '../features/moderation/ModerationPanel';
import { PriceHistory } from '../features/history/PriceHistory';
import { ProposeProduct } from '../features/proposals/ProposeProduct';
import { ProposeStore } from '../features/proposals/ProposeStore';
import { MapPage } from '../features/stores/MapPage';
import { StorePage } from '../features/stores/StorePage';
import { ProductSearch } from '../features/catalog/ProductSearch';
import { ReportInvite } from '../features/reports/ReportInvite';
import { ReportPrice } from '../features/reports/ReportPrice';
import { PrivacyPolicy } from '../features/legal/PrivacyPolicy';
import { Layout } from './Layout';

// Inicio del prototipo (#66): buscar lo que se va a comprar y, mientras no se busca, la canasta
// básica de hoy con el panel de «Tu canasta» y la invitación a registrar. Con una búsqueda, solo
// sus resultados: una idea por pantalla.
function Home() {
  const [params] = useSearchParams();
  const search = (
    <>
      <h1>¿Qué vas a comprar hoy?</h1>
      <ProductSearch formClassName="search home-search" />
    </>
  );
  if (params.get('q')) return search;
  return (
    <div className="with-side home">
      <div className="home-main">
        {search}
        <TodayBasket />
      </div>
      <aside className="side" aria-label="Tu canasta y registrar">
        <BasketSummary />
        <ReportInvite />
      </aside>
    </div>
  );
}

function ToDetail() {
  const { productId = '' } = useParams();
  return <Navigate to={`/productos/${productId}`} replace />;
}

export function App() {
  return (
    <SessionProvider>
      <BasketProvider>
        <ReportQueueProvider>
          <BrowserRouter>
            <Routes>
              <Route element={<Layout />}>
                <Route path="/" element={<Home />} />
                <Route path="/productos/:productId" element={<ProductDetail />} />
                {/* #65: la comparación vive en el detalle; la dirección vieja sigue sirviendo. */}
                <Route path="/productos/:productId/comparar" element={<ToDetail />} />
                <Route path="/productos/:productId/historial" element={<PriceHistory />} />
                <Route path="/mapa" element={<MapPage />} />
                <Route
                  path="/proponer/producto"
                  element={
                    <RequireRole role="reportante">
                      <ProposeProduct />
                    </RequireRole>
                  }
                />
                <Route
                  path="/proponer/tienda"
                  element={
                    <RequireRole role="reportante">
                      <ProposeStore />
                    </RequireRole>
                  }
                />
                <Route path="/tiendas/:establishmentId" element={<StorePage />} />
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
                      <MyReports />
                    </RequireRole>
                  }
                />
                <Route
                  path="/moderacion"
                  element={
                    <RequireRole role="moderador">
                      <ModerationPanel />
                    </RequireRole>
                  }
                />
                <Route path="/pendientes" element={<PendingReports />} />
                <Route path="/canasta" element={<BasketPage />} />
                <Route path="/yo" element={<Profile />} />
                <Route path="/yo/ajustes" element={<Settings />} />
                <Route path="/entrar" element={<SignIn />} />
                <Route path="/crear-cuenta" element={<SignUp />} />
                <Route path="/privacidad" element={<PrivacyPolicy />} />
                <Route path="/verificar-correo" element={<VerifyEmail />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </ReportQueueProvider>
      </BasketProvider>
    </SessionProvider>
  );
}
