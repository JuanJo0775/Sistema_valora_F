import { type SyntheticEvent, useState } from 'react';
import { useNavigate } from 'react-router';

// #48: en escritorio el buscador está siempre a la mano, en la barra superior. Lleva a los
// resultados del Inicio (/?q=…), que son los mismos del buscador de esa pantalla.
export function HeaderSearch() {
  const navigate = useNavigate();
  const [text, setText] = useState('');

  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    const wanted = text.trim();
    if (wanted) void navigate(`/?${new URLSearchParams({ q: wanted }).toString()}`);
  };

  return (
    <form role="search" aria-label="Buscar en Valora" className="header-search" onSubmit={submit}>
      <input
        type="search"
        aria-label="Buscar en Valora"
        placeholder="Busca arroz, leche, huevos…"
        value={text}
        onChange={(event) => {
          setText(event.target.value);
        }}
      />
    </form>
  );
}
