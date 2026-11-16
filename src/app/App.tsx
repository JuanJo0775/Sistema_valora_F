import { BrowserRouter, Route, Routes } from 'react-router';
import { ApiStatus } from '../features/health/ApiStatus';

function Home() {
  return (
    <main>
      <h1>Valora</h1>
      <ApiStatus />
    </main>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
      </Routes>
    </BrowserRouter>
  );
}
