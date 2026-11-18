// #26: para registrar sin señal, un producto que ya se abrió carga desde la caché (catálogo:
// nombre y presentaciones). Los precios, el historial, la búsqueda y la ubicación siempre van a la
// red (ADR-010: la consulta requiere conexión). Es una expresión regular porque Workbox la copia
// tal cual dentro del service worker.
export const CATALOG_PRODUCT = /\/v1\/products\/[0-9a-f-]{36}$/i;

// H-08: la canasta básica de hoy por municipio (/featured-products) es una lectura pública sin ubicación (el
// backend la sirve con caché pública de 60 s). Se guarda con «stale-while-revalidate»: se ve al instante lo
// último y se actualiza por detrás. Con la ubicación (lat, lng) la respuesta es no-store por
// privacidad (EC-08) y nunca se guarda: la expresión la deja fuera. La comparación de un producto
// tampoco: es no-store siempre; su última versión sin ubicación la guarda la app (lastComparison).
export const FEATURED_WITHOUT_LOCATION = /\/v1\/featured-products(?!.*[?&](?:lat|lng)=)/i;
