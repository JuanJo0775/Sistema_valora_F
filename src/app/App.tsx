import { BrowserRouter, Route, Routes } from 'react-router';
import { ApiStatus } from '../features/health/ApiStatus';
import { EmptyState } from '../shared/ui/EmptyState';
import { Layout } from './Layout';

function Home() {
  return (
    <>
      <h1>Valora</h1>
      <ApiStatus />
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
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/mapa" element={<Soon title="Mapa" issue={18} />} />
          <Route path="/registrar" element={<Soon title="Registrar precio" issue={25} />} />
          <Route path="/canasta" element={<Soon title="Canasta" issue={31} />} />
          <Route path="/yo" element={<Soon title="Yo" issue={22} />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
