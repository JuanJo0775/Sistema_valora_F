# Valora — Frontend

Aplicación web de **Valora**, plataforma colaborativa para comparar precios entre tiendas de barrio, minimercados y supermercados de Armenia y el Quindío.

> Este repositorio contiene el frontend. El backend y la fuente de verdad del contrato API viven en [Sistema_valora_B](https://github.com/JuanJo0775/Sistema_valora_B).

## Estado

<badge>Base documental inicial</badge>

- Cliente aprobado: aplicación web responsiva con enfoque PWA.
- Registro de precios offline-first: cola local persistente y sincronización al recuperar conexión.
- Consulta de precios: requiere conexión.
- API: REST + JSON + OpenAPI 3.x bajo `/v1`.
- Autenticación aprobada: sesión de servidor mediante cookie segura, CSRF y Argon2id en backend.
- Lenguaje principal aprobado para el proyecto: TypeScript.
- Stack aceptado el 8 de noviembre de 2026 (ADR-017): React + TypeScript + Vite, vite-plugin-pwa (Workbox) para el manifest y el service worker, y React Router para las áreas `/`, `/comercios` y `/moderacion`. La cola local usa IndexedDB; Dexie es una biblioteca candidata. Pruebas con Vitest y Playwright.

Este repositorio empieza como base de organización y documentación. No afirma que la interfaz esté implementada ni que la PWA esté probada.

## Responsabilidades

- Experiencia del consumidor: buscar, consultar y comparar precios.
- Experiencia del reportante: registrar y confirmar precios con pocos pasos.
- Cola local persistente para reportes sin conexión.
- Estado visible de sincronización y reintentos.
- Portal de comercios del Corte 3.
- Consola/experiencia de moderación según separación de roles y alcance de UI.
- Accesibilidad WCAG 2.2 AA en flujos críticos.

## Estructura prevista

```text
docs/
  UX.md
  OFFLINE_FIRST.md
  API_INTEGRATION.md
  EPICS.md
src/
  app/
  features/
    catalog/
    establishments/
    comparison/
    reports/
    auth/
    commerce/          # Corte 3
    moderation/
  shared/
  pwa/
tests/
  unit/
  integration/
  e2e/
```

La estructura de código se materializará con el esqueleto de extremo a extremo (H2-01), sobre React + Vite (ADR-017). Los nombres de carpetas son la organización propuesta para ese proyecto.

## Repositorios

- Frontend: [Sistema_valora_F](https://github.com/JuanJo0775/Sistema_valora_F)
- Backend: [Sistema_valora_B](https://github.com/JuanJo0775/Sistema_valora_B)

## Documentación

- [UX y flujos](docs/UX.md)
- [Offline-first](docs/OFFLINE_FIRST.md)
- [Integración API](docs/API_INTEGRATION.md)
- [Épicas](docs/EPICS.md)
- [Contribución](CONTRIBUTING.md)

## Fuera del MVP

Aplicación nativa Android/iOS, consulta de precios sin conexión, venta, carrito, pagos, pedidos, domicilios y alertas de bajada de precio. Las alertas permanecen opcionales y futuras.
