# Valora — Frontend

Aplicación web de **Valora**, plataforma colaborativa para comparar precios entre tiendas de barrio, minimercados y supermercados de Armenia y el Quindío.

> Este repositorio contiene el frontend. El backend y la fuente de verdad del contrato API viven en [Sistema_valora_B](https://github.com/JuanJo0775/Sistema_valora_B).

## Estado

Esqueleto en marcha (#20): React + Vite + TypeScript, Vitest, ESLint, Prettier y CI con SonarQube. La página de inicio dice si el backend responde. Las pantallas llegan en las issues #21 a #28 y #9 a #19.

- Cliente aprobado: aplicación web responsiva con enfoque PWA.
- Registro de precios offline-first: cola local persistente y sincronización al recuperar conexión.
- Consulta de precios: requiere conexión.
- API: REST + JSON + OpenAPI 3.x bajo `/v1`.
- Autenticación aprobada: sesión de servidor mediante cookie segura, CSRF y Argon2id en backend.
- Lenguaje principal aprobado para el proyecto: TypeScript.
- Stack aceptado el 8 de noviembre de 2026 (ADR-017): React + TypeScript + Vite, vite-plugin-pwa (Workbox) para el manifest y el service worker, y React Router para las áreas `/`, `/comercios` y `/moderacion`. La cola local usa IndexedDB; Dexie es una biblioteca candidata. Pruebas con Vitest y Playwright.

La PWA (vite-plugin-pwa y la cola sin conexión) llega con la #26 y Playwright con la #27: todavía no están instalados.

## Primeros pasos

Necesitas Node 22 (`.nvmrc`) y pnpm (`corepack enable`). Para ver datos reales, el backend ([Sistema_valora_B](https://github.com/JuanJo0775/Sistema_valora_B)) debe estar corriendo en `http://localhost:3000` (ver su README).

```bash
git clone https://github.com/JuanJo0775/Sistema_valora_F.git
cd Sistema_valora_F
corepack pnpm install
cp .env.example .env      # opcional: solo si el backend no está en localhost:3000
corepack pnpm dev         # abre http://localhost:5173
```

La página de inicio dice «API conectada» si el backend responde y «Sin conexión con la API» si no.

**Cómo llega el frontend al backend:** el servidor de desarrollo de Vite reenvía todo lo que empieza por `/v1` al backend (`API_PROXY_TARGET`). Para el navegador todo está en un solo sitio, y así la cookie de sesión (`SameSite=Lax`) funciona. En producción se hará lo mismo con una regla de reenvío de Vercel (ADR-012). El código siempre llama a rutas relativas (`/v1/...`), nunca a `http://localhost:3000`.

## Comandos

| Comando                             | Qué hace                                         |
| ----------------------------------- | ------------------------------------------------ |
| `pnpm dev`                          | Servidor de desarrollo con recarga               |
| `pnpm build`                        | Verifica tipos y compila a `dist/`               |
| `pnpm test` / `pnpm test:watch`     | Pruebas con Vitest                               |
| `pnpm test:cov`                     | Pruebas con cobertura (umbral de 80 % de líneas) |
| `pnpm typecheck`                    | TypeScript estricto                              |
| `pnpm lint`                         | ESLint (prohíbe pruebas enfocadas o saltadas)    |
| `pnpm format` / `pnpm format:check` | Prettier                                         |

La CI corre en cada pull request hacia `dev` o `main` con los jobs **Calidad** (tipos, lint, formato y compilación), **Pruebas** (Vitest con cobertura) y **SonarQube** (proyecto `JuanJo0775_Sistema_valora_F`, secreto `SONAR_TOKEN`). Si uno falla, no se mezcla.

## Responsabilidades

- Experiencia del consumidor: buscar, consultar y comparar precios.
- Experiencia del reportante: registrar y confirmar precios con pocos pasos.
- Cola local persistente para reportes sin conexión.
- Estado visible de sincronización y reintentos.
- Portal de comercios del Corte 3.
- Consola/experiencia de moderación según separación de roles y alcance de UI.
- Accesibilidad WCAG 2.2 AA en flujos críticos.

## Estructura

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

Cada carpeta aparece cuando tiene su primer archivo (YAGNI). Hoy existen `src/app` (rutas), `src/features/health` (estado de la API) y `src/test` (configuración de Vitest). Las pruebas van junto al archivo: `*.spec.tsx`.

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
