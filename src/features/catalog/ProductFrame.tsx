import { useEffect, useRef, useState } from 'react';
import type { components } from '../../shared/api/schema';
import { CategoryArt } from './CategoryArt';

type Image = components['schemas']['ProductImage'];

export type FrameSize = 'card' | 'row' | 'detail';

const PX: Record<FrameSize, number> = { card: 64, row: 44, detail: 144 };

// Bajo este lado mayor (px) una foto no se estira a 44-144 px sin verse pixelada: se trata como una
// foto que falla y se dibuja la ilustración de la categoría, que siempre se ve nítida.
export const MIN_PHOTO_SIDE = 80;

type Status = { url: string; state: 'ok' | 'bad' };

// Marco único de toda imagen de producto (miniaturas, tarjetas, detalle): cuadrado 1:1, mismas
// esquinas y fondo que la ilustración por categoría, y la foto contenida con relleno (nunca recortada
// ni estirada). Reserva el espacio, aparece con un desvanecimiento y cae a la ilustración si falla.
export function ProductFrame({
  image,
  category,
  size,
  alt = '',
  zoomable = false,
  title,
  onPhotoShown,
}: {
  image?: Image;
  category?: string;
  size: FrameSize;
  // Con alt vacío la foto es decorativa (el nombre ya está en texto al lado).
  alt?: string;
  // Solo el detalle: tocar la foto la amplía en un diálogo.
  zoomable?: boolean;
  title?: string;
  // Avisa si se está mostrando la foto (false: sin foto, rota o diminuta); sirve para la atribución.
  onPhotoShown?: (shown: boolean) => void;
}) {
  const [status, setStatus] = useState<Status | null>(null);
  const [open, setOpen] = useState(false);
  const px = PX[size];
  const photo = image && !(status?.url === image.url && status.state === 'bad') ? image : null;
  const ready = photo !== null && status?.url === photo.url && status.state === 'ok';
  const shown = photo !== null;
  useEffect(() => {
    onPhotoShown?.(shown);
  }, [shown, onPhotoShown]);
  const img = photo && (
    <img
      src={photo.url}
      alt={alt}
      width={px}
      height={px}
      loading="lazy"
      decoding="async"
      onLoad={(event) => {
        const { naturalWidth, naturalHeight } = event.currentTarget;
        const tiny = Math.max(naturalWidth, naturalHeight) < MIN_PHOTO_SIDE;
        setStatus({ url: photo.url, state: tiny ? 'bad' : 'ok' });
      }}
      onError={() => {
        setStatus({ url: photo.url, state: 'bad' });
      }}
    />
  );
  return (
    <span
      className={`product-frame ${size}`}
      data-state={photo ? (ready ? 'ready' : 'loading') : 'art'}
      title={title}
    >
      {photo ? (
        zoomable && ready ? (
          <>
            <button
              type="button"
              className="frame-zoom"
              aria-label={`Ampliar la foto de ${alt}`}
              onClick={() => {
                setOpen(true);
              }}
            >
              {img}
            </button>
            {open && (
              <Lightbox
                url={photo.url}
                alt={alt}
                onClose={() => {
                  setOpen(false);
                }}
              />
            )}
          </>
        ) : (
          img
        )
      ) : (
        <CategoryArt category={category} size={px} />
      )}
    </span>
  );
}

// Diálogo nativo: el navegador da Escape, el foco atrapado y su devolución al botón. Tocar fuera
// (el fondo del diálogo) lo cierra.
function Lightbox({ url, alt, onClose }: { url: string; alt: string; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    // jsdom (pruebas) no trae showModal: sin él basta con abrirlo.
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  }, []);
  // jsdom (pruebas) tampoco trae close: se cierra a mano.
  const close = () => {
    const dialog = ref.current;
    if (typeof dialog?.close === 'function') dialog.close();
    else onClose();
  };
  return (
    <dialog
      ref={ref}
      className="photo-lightbox"
      aria-label={alt}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <img src={url} alt={alt} />
      <button
        type="button"
        className="photo-lightbox-close"
        onClick={() => {
          close();
        }}
      >
        Cerrar
      </button>
    </dialog>
  );
}
