import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { BasketPage } from '../features/basket/BasketPage';
import { BasketProvider } from '../features/basket/BasketProvider';
import { CanastaScope } from '../features/basket/CanastaScope';
import { WherePage } from '../features/basket/WherePage';

// «Mi canasta» y «Dónde comprar» dentro de su contenedor, como en la app: comparten dónde se busca,
// los supuestos y las ofertas, y se puede ir de una a la otra.
export const renderCanasta = (path: string | { pathname: string; state?: unknown } = '/canasta') =>
  render(
    <BasketProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route element={<CanastaScope />}>
            <Route path="/canasta" element={<BasketPage />} />
            <Route path="/canasta/donde-comprar" element={<WherePage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </BasketProvider>,
  );
