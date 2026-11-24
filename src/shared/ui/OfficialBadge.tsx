// Un precio que publicó el comercio de la tienda (source «oficial»). Va con una insignia de escudo con
// marca de verificación y con texto: el sentido no depende solo del color.
export function OfficialBadge() {
  return (
    <span className="pill official">
      <svg
        viewBox="0 0 24 24"
        width="14"
        height="14"
        aria-hidden="true"
        focusable="false"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6z" />
        <path d="M8.5 12l2.5 2.5 4.5-5" />
      </svg>
      Precio oficial
    </span>
  );
}
