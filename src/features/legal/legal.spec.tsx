import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { CookieNotice } from './CookieNotice';
import { PrivacyPolicy } from './PrivacyPolicy';
import { POLICY_VERSION } from './policy';

describe('política de tratamiento de datos', () => {
  it('trae lo que exige el Decreto 1377 de 2013 y dice su versión', () => {
    render(
      <MemoryRouter>
        <PrivacyPolicy />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('datos y cookies');
    expect(screen.getByText(new RegExp(`Versión ${POLICY_VERSION}`))).toBeInTheDocument();
    for (const section of [
      /Responsable del tratamiento/,
      /Qué datos tratamos y para qué/,
      /Tu ubicación/,
      /Cookies y almacenamiento/,
      /Tus derechos como titular/,
      /Cómo ejercer tus derechos/,
      /Vigencia y cambios/,
    ]) {
      expect(screen.getByRole('heading', { name: section })).toBeInTheDocument();
    }
    expect(screen.getByText(/Ley 1581 de 2012/)).toBeInTheDocument();
    expect(screen.getByText(/10 días hábiles/)).toBeInTheDocument();
    expect(screen.getByText(/15\s+días hábiles/)).toBeInTheDocument();
    expect(screen.getByText(/Superintendencia de Industria y Comercio/)).toBeInTheDocument();
  });

  it('dice que no guarda la ubicación y que no usa cookies de seguimiento', () => {
    render(
      <MemoryRouter>
        <PrivacyPolicy />
      </MemoryRouter>,
    );
    expect(screen.getByText('No guardamos tu ubicación')).toBeInTheDocument();
    expect(screen.getByText(/No usamos cookies de analítica/)).toBeInTheDocument();
  });
});

describe('aviso de cookies', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('se muestra una vez y se recuerda al cerrarlo', () => {
    const { unmount } = render(
      <MemoryRouter>
        <CookieNotice />
      </MemoryRouter>,
    );
    expect(screen.getByRole('complementary', { name: 'Aviso de cookies' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Más información' })).toHaveAttribute(
      'href',
      '/privacidad#cookies',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Entendido' }));
    expect(
      screen.queryByRole('complementary', { name: 'Aviso de cookies' }),
    ).not.toBeInTheDocument();
    unmount();

    render(
      <MemoryRouter>
        <CookieNotice />
      </MemoryRouter>,
    );
    expect(
      screen.queryByRole('complementary', { name: 'Aviso de cookies' }),
    ).not.toBeInTheDocument();
  });
});
