import { SearchSuggest } from '../features/catalog/SearchSuggest';

// #48: en escritorio el buscador está siempre a la mano, en la barra superior. Lleva a los
// resultados del Inicio (/?q=…), que son los mismos del buscador de esa pantalla. #83: mientras se
// escribe, sugiere productos.
export function HeaderSearch() {
  return <SearchSuggest label="Buscar en Valora" formClassName="header-search" />;
}
