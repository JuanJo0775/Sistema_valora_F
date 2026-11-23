import { describe, expect, it } from 'vitest';
import { titleFor } from './routeTitle';

describe('título del documento por ruta', () => {
  it.each([
    ['/', 'Inicio · Valora'],
    ['/mapa', 'Mapa · Valora'],
    ['/canasta', 'Canasta · Valora'],
    ['/canasta/donde-comprar', 'Dónde comprar · Valora'],
    ['/registrar', 'Registrar precio · Valora'],
    ['/yo', 'Tu cuenta · Valora'],
    ['/yo/ajustes', 'Ajustes · Valora'],
    ['/pendientes', 'Pendientes · Valora'],
    ['/privacidad', 'Privacidad · Valora'],
    ['/crear-cuenta', 'Crear cuenta · Valora'],
    ['/olvide-contrasena', 'Olvidé mi contraseña · Valora'],
    ['/restablecer-contrasena', 'Restablecer contraseña · Valora'],
    ['/bienvenida', 'Bienvenida · Valora'],
  ])('%s se llama «%s»', (path, title) => {
    expect(titleFor(path, '')).toBe(title);
  });

  it('el detalle de un producto y de una tienda usan el nombre de su encabezado', () => {
    expect(titleFor('/productos/abc', 'Arroz blanco')).toBe('Arroz blanco · Valora');
    expect(titleFor('/tiendas/xyz', 'Tienda Don Pepe')).toBe('Tienda Don Pepe · Valora');
    expect(titleFor('/productos/abc/historial', 'Arroz blanco')).toBe(
      'Historial de Arroz blanco · Valora',
    );
  });

  it('mientras el nombre no ha cargado o en una ruta desconocida, solo «Valora»', () => {
    expect(titleFor('/productos/abc', '')).toBe('Valora');
    expect(titleFor('/nada', '')).toBe('Valora');
  });
});
