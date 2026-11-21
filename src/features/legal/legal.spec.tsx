import { fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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

  it('explica cómo eliminar la cuenta, los 10 días de gracia y qué se conserva', () => {
    render(
      <MemoryRouter>
        <PrivacyPolicy />
      </MemoryRouter>,
    );
    expect(screen.getByText(/Eliminar tu cuenta desde la aplicación/)).toBeInTheDocument();
    expect(screen.getByText(/10 días corridos/)).toBeInTheDocument();
    expect(screen.getByText(/Restaurar mi cuenta/)).toBeInTheDocument();
    expect(screen.getByText(/se conservan sin tu nombre ni tu correo/)).toBeInTheDocument();
    expect(screen.getByText(/copias de respaldo de la base de datos/)).toBeInTheDocument();
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

  // H-11: franja de una línea, con «Entendido» como botón secundario y el texto breve.
  it('es una franja breve: texto corto, enlace a la política y «Entendido» secundario', () => {
    render(
      <MemoryRouter>
        <CookieNotice />
      </MemoryRouter>,
    );
    const notice = screen.getByRole('complementary', { name: 'Aviso de cookies' });
    expect(notice).toHaveTextContent('Solo usamos cookies necesarias');
    expect(notice.textContent.length).toBeLessThan(90);
    expect(screen.getByRole('button', { name: 'Entendido' })).toHaveClass('ghost');
  });
});

describe('aviso de cookies: estilos', () => {
  const legalCss = readFileSync(join(process.cwd(), 'src/features/legal/legal.css'), 'utf-8');
  const layoutCss = readFileSync(join(process.cwd(), 'src/app/layout.css'), 'utf-8');

  it('es una fila compacta, sin tarjeta de varias líneas', () => {
    const block = /\.cookie-notice\s*\{[^}]*\}/.exec(legalCss)?.[0] ?? '';
    expect(block).toMatch(/display:\s*flex/);
    expect(block).toMatch(/align-items:\s*center/);
    expect(block).not.toMatch(/display:\s*grid/);
  });

  it('la altura del aviso solo cuenta mientras existe y la página la suma a su relleno', () => {
    expect(layoutCss).toMatch(/:root\s*\{[^}]*--cookie-h:\s*0px/);
    expect(layoutCss).toMatch(/:root:has\(\.cookie-notice\)\s*\{\s*--cookie-h:\s*\d+px/);
    expect(layoutCss).toMatch(/\.page\s*\{[^}]*padding:[^;]*var\(--cookie-h\)/);
    expect(layoutCss).toMatch(/html\s*\{[^}]*scroll-padding-bottom:[^;]*var\(--cookie-h\)/);
  });
});
