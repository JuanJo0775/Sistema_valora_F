import { ShieldCheckIcon } from './ShieldCheckIcon';

// Un precio que publicó el comercio de la tienda (source «oficial»). Va con una insignia de escudo con
// marca de verificación y con texto: el sentido no depende solo del color.
export function OfficialBadge() {
  return (
    <span className="pill official">
      <ShieldCheckIcon />
      Precio oficial
    </span>
  );
}
