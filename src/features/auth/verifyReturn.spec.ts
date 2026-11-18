import { beforeEach, describe, expect, it } from 'vitest';
import { forgetVerifyReturn, readVerifyReturn, rememberVerifyReturn } from './verifyReturn';

describe('a dónde volver tras verificar el correo', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('recuerda registrar el precio de un producto, con su nombre en lenguaje claro', () => {
    rememberVerifyReturn('/registrar?producto=abc');

    expect(readVerifyReturn()).toEqual({
      path: '/registrar?producto=abc',
      label: 'registrar un precio',
    });
  });

  it.each([
    ['/proponer/producto', 'proponer un producto'],
    ['/proponer/tienda', 'proponer una tienda'],
    ['/canasta', 'lo que estabas haciendo'],
  ])('%s se llama «%s»', (path, label) => {
    rememberVerifyReturn(path);

    expect(readVerifyReturn()).toEqual({ path, label });
  });

  it.each(['/', '/yo', '/entrar?volver=%2Fregistrar', '/crear-cuenta', '/verificar-correo'])(
    'no recuerda %s: no es algo que seguir',
    (path) => {
      rememberVerifyReturn(path);

      expect(readVerifyReturn()).toBeNull();
    },
  );

  it.each(['//otro.sitio', String.raw`/\otro.sitio`, 'https://otro.sitio/registrar', null, undefined])(
    'una dirección que sale de la app (%s) no se guarda (safeReturn)',
    (path) => {
      rememberVerifyReturn(path);

      expect(readVerifyReturn()).toBeNull();
    },
  );

  it('una pantalla de la cuenta no borra lo que ya se había recordado', () => {
    rememberVerifyReturn('/registrar?producto=abc');
    rememberVerifyReturn('/yo');

    expect(readVerifyReturn()?.path).toBe('/registrar?producto=abc');
  });

  it('se olvida al usarlo', () => {
    rememberVerifyReturn('/registrar');
    forgetVerifyReturn();

    expect(readVerifyReturn()).toBeNull();
  });
});
