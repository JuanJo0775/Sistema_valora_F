import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type FakeReply, sessionAs, stubApi } from '../../test/fakeApi';
import { ChangeProductPhoto } from './ChangeProductPhoto';

const RICE_ID = '3f1c2a64-5c1e-4b8a-9d61-0a7b1f2e3c4d';
const PHOTO_PATH = `PUT /v1/moderation/products/${RICE_ID}/image`;
const MB = 1024 * 1024;

const photo = (name: string, type: string, size = 1000) =>
  new File([new Uint8Array(size)], name, { type });

const IMAGE = {
  url: 'http://localhost:3000/media/products/arroz.webp',
  source: 'equipo',
  attribution: 'Equipo Valora',
};

const renderPhoto = (reply: FakeReply) => {
  const api = stubApi({ 'GET /v1/auth/session': sessionAs('moderador'), [PHOTO_PATH]: reply });
  const onChanged = vi.fn();
  render(<ChangeProductPhoto productId={RICE_ID} onChanged={onChanged} />);
  return { api, onChanged };
};

const choose = (file: File) => {
  fireEvent.change(screen.getByLabelText('Cambiar foto'), { target: { files: [file] } });
};

describe('cambiar la foto de un producto', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sube la foto elegida y muestra la nueva', async () => {
    const { api, onChanged } = renderPhoto({ status: 200, body: IMAGE });

    choose(photo('arroz.jpg', 'image/jpeg'));

    expect(await screen.findByRole('status')).toHaveTextContent('Foto actualizada.');
    expect(onChanged).toHaveBeenCalledWith(IMAGE);
    const sent = api.calls.find(({ method }) => method === 'PUT');
    expect(sent?.headers.get('Content-Type')).toMatch(/^multipart\/form-data/);
    expect(sent?.body).toContain('filename="arroz.jpg"');
  });

  it('una foto de más de 2 MB se avisa sin subirla', () => {
    const { api } = renderPhoto({ status: 200, body: IMAGE });

    choose(photo('grande.jpg', 'image/jpeg', 2 * MB + 1));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'La foto pesa más de 2 MB. Elige una más liviana.',
    );
    expect(api.calls.some(({ method }) => method === 'PUT')).toBe(false);
  });

  it('un archivo que no es JPEG, PNG ni WebP se avisa sin subirlo', () => {
    const { api } = renderPhoto({ status: 200, body: IMAGE });

    choose(photo('arroz.gif', 'image/gif'));

    expect(screen.getByRole('alert')).toHaveTextContent('Usa una foto JPEG, PNG o WebP.');
    expect(api.calls.some(({ method }) => method === 'PUT')).toBe(false);
  });

  it('si el servidor dice que pesa demasiado, lo explica', async () => {
    renderPhoto({ status: 413, body: { code: 'PAYLOAD_TOO_LARGE', message: 'Muy grande.' } });

    choose(photo('arroz.png', 'image/png'));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'La foto pesa más de 2 MB. Elige una más liviana.',
    );
  });

  it('otro error muestra el mensaje del servidor', async () => {
    renderPhoto({ status: 404, body: { code: 'NOT_FOUND', message: 'El producto no existe.' } });

    choose(photo('arroz.webp', 'image/webp'));

    expect(await screen.findByText('El producto no existe.')).toBeInTheDocument();
  });
});
