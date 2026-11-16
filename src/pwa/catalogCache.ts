// #26: para registrar sin señal, un producto que ya se abrió carga desde la caché (catálogo:
// nombre y presentaciones). Los precios, el historial, la búsqueda y la ubicación siempre van a la
// red (ADR-010: la consulta requiere conexión). Es una expresión regular porque Workbox la copia
// tal cual dentro del service worker.
export const CATALOG_PRODUCT = /\/v1\/products\/[0-9a-f-]{36}$/i;
