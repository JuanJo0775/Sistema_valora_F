import { type ComponentType, lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useParams, useSearchParams } from 'react-router';
import { RequireRole } from '../features/auth/RequireRole';
import { SessionProvider } from '../features/auth/SessionProvider';
import { ReportQueueProvider } from '../pwa/ReportQueueProvider';
import { BasketProvider } from '../features/basket/BasketProvider';
import { BasketSummary } from '../features/basket/BasketSummary';
import { ProductDetail } from '../features/catalog/ProductDetail';
import { TodayBasket } from '../features/comparison/TodayBasket';
import { ProductSearch } from '../features/catalog/ProductSearch';
import { ReportInvite } from '../features/reports/ReportInvite';
import { Layout } from './Layout';
import { LegacyPlanRedirect } from './LegacyPlanRedirect';

// H-26: el Inicio, la búsqueda, el detalle, la canasta y registrar quedan en el bloque inicial; el
// resto (mapa con Leaflet, moderación, proponer, entrar, política…) se descarga al abrir la pantalla.
// El service worker los precachea todos: sin conexión siguen abriendo.
function screen<Name extends string>(load: () => Promise<Record<Name, ComponentType>>, name: Name) {
  return lazy(() => load().then((module) => ({ default: module[name] })));
}

const MerchantPrices = screen(
  () => import('../features/commerce/MerchantPrices'),
  'MerchantPrices',
);
const MerchantRegistration = screen(
  () => import('../features/commerce/MerchantRegistration'),
  'MerchantRegistration',
);
const Profile = screen(() => import('../features/auth/Profile'), 'Profile');
const PendingReports = screen(() => import('../pwa/PendingReports'), 'PendingReports');
const BasketPage = screen(() => import('../features/basket/BasketPage'), 'BasketPage');
const CanastaScope = screen(() => import('../features/basket/CanastaScope'), 'CanastaScope');
const WherePage = screen(() => import('../features/basket/WherePage'), 'WherePage');
const SavedPlanPage = screen(() => import('../features/plan/SavedPlanPage'), 'SavedPlanPage');
const ReportPrice = screen(() => import('../features/reports/ReportPrice'), 'ReportPrice');
const InstallAndUninstall = screen(
  () => import('../pwa/InstallAndUninstall'),
  'InstallAndUninstall',
);
const Settings = screen(() => import('../features/auth/Settings'), 'Settings');
const DeleteAccount = screen(() => import('../features/auth/DeleteAccount'), 'DeleteAccount');
const SignIn = screen(() => import('../features/auth/SignIn'), 'SignIn');
const SignUp = screen(() => import('../features/auth/SignUp'), 'SignUp');
const VerifyEmail = screen(() => import('../features/auth/VerifyEmail'), 'VerifyEmail');
const ForgotPassword = screen(() => import('../features/auth/ForgotPassword'), 'ForgotPassword');
const ResetPassword = screen(() => import('../features/auth/ResetPassword'), 'ResetPassword');
const Welcome = screen(() => import('../features/auth/Welcome'), 'Welcome');
const MyReports = screen(() => import('../features/contributions/MyReports'), 'MyReports');
const ModerationPanel = screen(
  () => import('../features/moderation/ModerationPanel'),
  'ModerationPanel',
);
const PriceHistory = screen(() => import('../features/history/PriceHistory'), 'PriceHistory');
const ProposeProduct = screen(
  () => import('../features/proposals/ProposeProduct'),
  'ProposeProduct',
);
const ProposeStore = screen(() => import('../features/proposals/ProposeStore'), 'ProposeStore');
const MapPage = screen(() => import('../features/stores/MapPage'), 'MapPage');
const StorePage = screen(() => import('../features/stores/StorePage'), 'StorePage');
const PrivacyPolicy = screen(() => import('../features/legal/PrivacyPolicy'), 'PrivacyPolicy');

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
                <Route element={<CanastaScope />}>
                  <Route path="/canasta" element={<BasketPage />} />
                  <Route path="/canasta/donde-comprar" element={<WherePage />} />
                </Route>
                <Route path="/canasta/plan" element={<LegacyPlanRedirect />} />
                <Route path="/canasta/plan/:id" element={<SavedPlanPage />} />
                <Route path="/yo" element={<Profile />} />
                <Route path="/comercios/registro" element={<MerchantRegistration />} />
                <Route path="/comercios" element={<MerchantPrices />} />
                <Route path="/yo/ajustes" element={<Settings />} />
                <Route path="/yo/eliminar-cuenta" element={<DeleteAccount />} />
                <Route path="/yo/app" element={<InstallAndUninstall />} />
                <Route path="/entrar" element={<SignIn />} />
                <Route path="/olvide-contrasena" element={<ForgotPassword />} />
                <Route path="/restablecer-contrasena" element={<ResetPassword />} />
                <Route path="/crear-cuenta" element={<SignUp />} />
                <Route path="/privacidad" element={<PrivacyPolicy />} />
                <Route path="/verificar-correo" element={<VerifyEmail />} />
                <Route path="/bienvenida" element={<Welcome />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </ReportQueueProvider>
      </BasketProvider>
    </SessionProvider>
  );
}
