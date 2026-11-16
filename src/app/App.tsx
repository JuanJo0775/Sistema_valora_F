import { BrowserRouter, Route, Routes } from 'react-router';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<h1>Valora</h1>} />
      </Routes>
    </BrowserRouter>
  );
}
