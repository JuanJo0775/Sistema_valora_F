# Integración con backend

## Fuente de verdad

El backend mantiene el contrato OpenAPI 3.x en su repositorio: [Sistema_valora_B](https://github.com/JuanJo0775/Sistema_valora_B).

El frontend debe consumir el contrato vigente, no mantener una segunda especificación independiente.

## Convenciones aprobadas

- REST sobre HTTPS, JSON.
- Versionado `/v1`.
- Dos superficies lógicas: consumidor/reportante y portal de comercios.
- Sesión de servidor con cookie segura y protección CSRF según ADR-014.
- Los cambios de API se coordinan mediante PRs en backend y frontend.
- No asumir JWT bearer en frontend: la decisión aprobada es sesión administrada por servidor.

## Integración de reportes

- Cada reporte incluye una clave de idempotencia estable en todos los reintentos.
- El cliente conserva `observedAt` al crear el reporte offline.
- El backend devuelve un estado explícito de aceptación/sincronización.
- La UI no marca como sincronizado hasta recibir confirmación del servidor.

## Privacidad

- Ningún componente público recibe identidad o ubicación personal del reportante.
- La API puede devolver ubicación del establecimiento, que es distinta de la ubicación del reportante.
- Los aportes privados se consultan con sesión y autorización.

## Cliente de la API (#10)

Todo lo que llama al backend pasa por `src/shared/api` (`import { api, call, ApiError } from '../../shared/api'`).

- **Tipos generados:** `pnpm api:types` lee `../Sistema_valora_B/docs/openapi.yaml` (el backend clonado al lado, en la rama `dev`) y escribe `src/shared/api/schema.d.ts`. Ese archivo se guarda en el repositorio porque la CI no tiene el backend. **Cuando cambie el contrato en el backend, se vuelve a generar en el mismo pull request que usa la ruta nueva.** Nunca se edita a mano.
- **Llamadas:** `openapi-fetch` con los tipos del contrato. Ejemplo: `const { items } = await call(api.GET('/products', { params: { query: { q } } }))`.
- **Mismo sitio:** el cliente llama a `/v1` en el mismo origen de la app (proxy de Vite en desarrollo, regla de Vercel en producción) para que viaje la cookie de sesión.
- **CSRF (ADR-014):** las operaciones que modifican datos llevan `X-CSRF-Token`. El token se pide una vez a `GET /v1/auth/session`, se guarda solo en memoria y se olvida al iniciar o cerrar sesión o si el servidor responde 403 `CSRF_TOKEN_INVALID`. Iniciar sesión y registrarse no lo necesitan.
- **Errores:** `call` lanza `ApiError` con `status`, `code` y `message` del servidor (formato único `{ code, message }`). En 429 trae `retryAfterSeconds` (cabecera `Retry-After`). Sin red: `status` 0 y `code` `NETWORK_ERROR`. Si la respuesta no es JSON (por ejemplo, un 502 del proxy): `REQUEST_ERROR`.
- **204:** las respuestas sin cuerpo (iniciar o cerrar sesión, decisiones de moderación) terminan sin error y devuelven `undefined`.

| `code` | Cuándo | Qué hace la pantalla |
| --- | --- | --- |
| `VALIDATION_ERROR` (400) | Datos inválidos | Muestra el mensaje junto al campo |
| `UNAUTHORIZED` (401) | Sin sesión o sesión vencida | Lleva a iniciar sesión (#22) |
| `FORBIDDEN`, `ACCOUNT_SUSPENDED` (403) | Sin permiso o cuenta suspendida | Explica por qué (#13) |
| `CSRF_TOKEN_INVALID` (403) | Token vencido | Reintentar: el cliente ya pidió uno nuevo |
| `NOT_FOUND` (404) | No existe | Estado vacío |
| `DUPLICATE_REPORT` y otros (409) | Conflicto | Mensaje del servidor (#11) |
| Código de la regla (422) | Regla de negocio | Mensaje del servidor |
| `TOO_MANY_REQUESTS` (429) | Límite | «Inténtalo en N segundos» con `retryAfterSeconds` |
| `NETWORK_ERROR` (0) | Sin red | «Sin conexión»; el registro va a la cola (#26) |
