# Valora — Frontend

Aplicación web de **Valora**, plataforma colaborativa para comparar precios entre tiendas de barrio, minimercados y supermercados de Armenia y el Quindío.

> Este repositorio contiene el frontend. El backend y la fuente de verdad del contrato API viven en [Sistema_valora_B](https://github.com/JuanJo0775/Sistema_valora_B).

## Estado

Esqueleto en marcha (#20): React + Vite + TypeScript, PWA instalable, Vitest, ESLint, Prettier y CI con SonarQube. La página de inicio dice si el backend responde. Las pantallas llegan en las issues #21 a #28 y #9 a #19.

- Cliente aprobado: aplicación web responsiva que se instala como PWA (ADR-017).
- Registro de precios offline-first: cola local persistente y sincronización al recuperar conexión (#26).
- Consulta de precios: requiere conexión.
- API: REST + JSON + OpenAPI 3.1 bajo `/v1`.
- Sesión de servidor con cookie segura y CSRF (ADR-014).
- Diseño de referencia: el prototipo de MC-E4 (paleta «Actual», naranja `#F06A1A`, fuentes Outfit y Figtree).

## Primeros pasos (desde cero)

Sigue los pasos en orden. Al final, `pnpm test` debe pasar y en la app, al buscar **«banano»**, debe aparecer el producto de la semilla.

### 1. Instala las herramientas

| Herramienta   | Versión                              | Dónde conseguirla                                                           |
| ------------- | ------------------------------------ | --------------------------------------------------------------------------- |
| Git           | cualquiera reciente                  | <https://git-scm.com/downloads>                                             |
| Node.js       | 22 LTS, **22.12 o más** (`.nvmrc`)   | <https://nodejs.org/en/download>                                            |
| pnpm          | 10.18.3 (fijada en `packageManager`) | Viene con Node por `corepack`; **no** la instales aparte                    |
| Chrome o Edge | reciente                             | Para probar la instalación de la PWA y el service worker                    |
| Backend       | rama `dev` de Sistema_valora_B       | Paso 2. Necesita PostgreSQL 17 + PostGIS (lo explica el README del backend) |

Comprueba:

```bash
git --version
node -v          # debe empezar por v22 y ser 22.12 o más
corepack --version
```

Con Node 22.11 o menos fallan las pruebas: `jsdom` necesita 22.12 o más.

### 2. Deja el backend listo

El frontend no tiene datos propios: todo sale de la API. Sigue **completo** el README del backend, [«Primeros pasos (desde cero)»](https://github.com/JuanJo0775/Sistema_valora_B#primeros-pasos-desde-cero). En resumen:

```bash
git clone https://github.com/JuanJo0775/Sistema_valora_B.git
cd Sistema_valora_B
git switch dev
corepack pnpm install
cp .env.example .env                       # y cambia SESSION_SECRET y REPORTER_KEY_SECRET
# crea el usuario valora y las bases valora_dev y valora_test con PostGIS (paso 5 del README del backend)
corepack pnpm db:migrate                   # crea las tablas y las categorías
corepack pnpm db:seed                      # carga tiendas, productos y referencias SIPSA
corepack pnpm comparison:rebuild-history   # llena el historial de precios (se puede repetir)
corepack pnpm dev                          # API en http://localhost:3000
```

Qué cargan las semillas (`seed/` del backend):

| Archivo         | Qué trae                                                                          |
| --------------- | --------------------------------------------------------------------------------- |
| `tiendas.csv`   | Tiendas de barrio, minimercados y supermercados de Armenia con su ubicación       |
| `productos.csv` | Productos y presentaciones verificados por el equipo (solo las filas verificadas) |
| `sipsa.csv`     | Referencias mayoristas del boletín SIPSA del DANE                                 |

`db:seed` no duplica ni borra: se puede correr las veces que haga falta. Las referencias SIPSA solo se muestran si su periodo terminó hace 30 días o menos; para la demostración, carga un boletín reciente (ver `seed/README.md` del backend).

**Cuentas para probar** (en tu base local, nunca con datos reales):

- **Reportante:** se registra desde la app (cuando exista la pantalla, #22) o con `POST /v1/auth/register`. Toda cuenta nueva es reportante.
- **Moderador:** registra la cuenta y luego, en la carpeta del backend:

  ```bash
  corepack pnpm identity:set-role tu-correo@ejemplo.com moderador "Moderador de pruebas"
  ```

Comprueba que todo el backend funciona con la prueba de humo (crea datos de prueba en `valora_dev`):

```bash
corepack pnpm smoke
```

### 3. Clona el frontend

Se trabaja siempre a partir de la rama `dev`:

```bash
git clone https://github.com/JuanJo0775/Sistema_valora_F.git
cd Sistema_valora_F
git switch dev
```

### 4. Instala las dependencias

```bash
corepack enable
pnpm install
```

En Windows, si `corepack enable` falla con `EPERM`, usa esto (no necesita administrador) y antepón `corepack` a cada comando (`corepack pnpm dev`, `corepack pnpm test`…):

```bash
corepack prepare pnpm@10.18.3 --activate
corepack pnpm install
```

### 5. Configura `.env` (opcional)

Solo hace falta si el backend **no** está en `http://localhost:3000`:

```bash
cp .env.example .env
```

En PowerShell: `Copy-Item .env.example .env`. Cambia `API_PROXY_TARGET`. `.env` nunca se sube al repositorio.

### 6. Arranca y comprueba

Con el backend encendido (paso 2), en otra terminal:

```bash
pnpm dev         # abre http://localhost:5173
pnpm test        # todas las pruebas deben pasar
```

- En <http://localhost:5173> busca **«banano»**: debe aparecer el producto de la semilla y, al tocarlo, su detalle. Si dice «No hay conexión con Valora», el backend está apagado o en otro puerto (paso 5).
- <http://localhost:5173/v1/health> debe responder `{"status":"ok"}`: es el backend visto a través del frontend.

**Cómo llega el frontend al backend:** el servidor de desarrollo de Vite reenvía todo lo que empieza por `/v1` al backend (`API_PROXY_TARGET`). Para el navegador todo está en un solo sitio, y así la cookie de sesión (`SameSite=Lax`) funciona. En producción se hará lo mismo con una regla de reenvío de Vercel (ADR-012). El código siempre llama a rutas relativas (`/v1/...`), nunca a `http://localhost:3000`.

### 7. Prueba la PWA

En `pnpm dev` el service worker está apagado para no confundir la recarga. Para ver la app como PWA:

```bash
pnpm build
pnpm preview     # http://localhost:4173
```

Abre <http://localhost:4173> en Chrome o Edge: aparece el ícono de **Instalar** en la barra de direcciones. En DevTools → **Application** se ven el manifiesto, los íconos y el service worker. Para instalarla en un celular hace falta HTTPS: se prueba con el despliegue (ADR-012).

Qué hace hoy la PWA: se instala con el ícono de Valora y guarda en caché los archivos de la app. Las consultas a `/v1` siempre van a la red. La cola de reportes sin conexión llega con la #26.

## Día a día

1. `git switch dev && git pull`
2. `git switch -c feat/<tema>` (o `fix/`, `test/`, `docs/`, `chore/`, `refactor/`)
3. Prueba primero cuando haya un comportamiento: commit `test(…)` en rojo y `feat(…)` en verde.
4. Antes de subir: `pnpm typecheck`, `pnpm lint`, `pnpm format:check` y `pnpm test:cov`.
5. Pull request **hacia `dev`** con `Closes #N`. Se mezcla con la CI en verde y con «Create a merge commit». Detalle en [CONTRIBUTING.md](CONTRIBUTING.md).

## Comandos

| Comando                             | Qué hace                                                                                                 |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `pnpm dev`                          | Servidor de desarrollo con recarga                                                                       |
| `pnpm build`                        | Verifica tipos y compila a `dist/` (con la PWA)                                                          |
| `pnpm preview`                      | Sirve `dist/` para probar la PWA                                                                         |
| `pnpm test` / `pnpm test:watch`     | Pruebas con Vitest                                                                                       |
| `pnpm test:cov`                     | Pruebas con cobertura (umbral de 80 % de líneas)                                                         |
| `pnpm test:e2e`                     | Pruebas de extremo a extremo con Playwright contra el backend (ver abajo)                                |
| `pnpm typecheck`                    | TypeScript estricto                                                                                      |
| `pnpm lint`                         | ESLint (prohíbe pruebas enfocadas o saltadas)                                                            |
| `pnpm format` / `pnpm format:check` | Prettier                                                                                                 |
| `pnpm api:types`                    | Regenera los tipos de la API desde `../Sistema_valora_B/docs/openapi.yaml` (ver docs/API_INTEGRATION.md) |

La CI corre en cada pull request hacia `dev` o `main` con los jobs **Calidad** (tipos, lint, formato y compilación), **Pruebas** (Vitest con cobertura y, después, las pruebas de extremo a extremo) y **SonarQube** (proyecto `JuanJo0775_Sistema_valora_F`, secreto `SONAR_TOKEN`). Si uno falla, no se mezcla.

### Pruebas de extremo a extremo (#27)

Están en `e2e/` (`*.e2e.ts`) y usan Playwright con el backend de verdad:

- **Camino principal** (B#17): crear cuenta, registrar un precio y verlo en la comparación del producto.
- **EC-07 / PR-08**: sin señal, tres personas guardan 50 reportes (17, 17 y 16, porque el backend acepta 20 por hora por cuenta); al volver la señal se envían todos, sin duplicados y con p95 de confirmación de 60 s o menos. El resultado queda en `e2e-results/ec-07.json`.
- **Moderación**: una persona marca un precio, un moderador lo descarta y deja de verse.

En la CI, el job **Pruebas** baja el backend de la rama `dev`, levanta PostGIS, migra, carga la semilla, crea la cuenta moderadora y corre `pnpm test:e2e`. La evidencia y el informe quedan como artefacto `extremo-a-extremo`.

En local (consume bastante memoria):

1. El backend en `http://localhost:3000` con su semilla (`pnpm db:migrate`, `pnpm db:seed`, `pnpm dev` en `Sistema_valora_B`).
2. Una cuenta moderadora: crear la cuenta en la app y, en `Sistema_valora_B`, `pnpm identity:set-role <correo> moderador "Pruebas de extremo a extremo"`.
3. Una vez: `pnpm exec playwright install chromium`.
4. `E2E_MODERATOR_EMAIL=<correo> E2E_MODERATOR_PASSWORD=<clave> pnpm test:e2e` (compila la app y la sirve en el puerto 4173).

## Variables de entorno

| Variable           | Para qué                                               | Por defecto             |
| ------------------ | ------------------------------------------------------ | ----------------------- |
| `API_PROXY_TARGET` | Backend al que el servidor de desarrollo reenvía `/v1` | `http://localhost:3000` |

### Secretos en GitHub

| Nombre        | Tipo    | Para qué                                                                                                   |
| ------------- | ------- | ---------------------------------------------------------------------------------------------------------- |
| `SONAR_TOKEN` | Secreto | Token de SonarQube Cloud para el job SonarQube. Se pega **solo** el valor, sin espacios ni saltos de línea |

## Problemas frecuentes

| Síntoma                                               | Causa y solución                                                                                                      |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| La búsqueda dice «No hay conexión con Valora»         | El backend no está encendido o está en otro puerto. Enciéndelo (`pnpm dev` en el backend) o cambia `API_PROXY_TARGET` |
| `corepack enable` falla con `EPERM` en Windows        | Usa `corepack prepare pnpm@10.18.3 --activate` y antepón `corepack` a cada comando                                    |
| Las pruebas fallan con un error de `undici` o `jsdom` | Node es anterior a 22.12. Actualiza Node 22                                                                           |
| El puerto 5173 está ocupado                           | Otro `pnpm dev` sigue abierto. Ciérralo o usa `pnpm dev --port 5174`                                                  |
| No aparece «Instalar» en el navegador                 | En `pnpm dev` no hay service worker. Usa `pnpm build` y `pnpm preview`                                                |
| La app instalada muestra una versión vieja            | Cierra y vuelve a abrir la app: el service worker se actualiza solo                                                   |
| El job SonarQube falla con `invalid header value`     | El secreto `SONAR_TOKEN` tiene espacios o saltos de línea. Vuelve a crearlo pegando solo el valor                     |

## Estructura

```text
public/                 # íconos de la PWA (logo naranja de «Identidad de marca»)
src/
  app/                  # rutas y página de inicio
  features/auth/        # sesión: crear cuenta, entrar, salir y secciones por rol
  features/basket/      # canasta: lista de compras y dónde sale más barata
  features/catalog/     # buscar productos y ver su detalle
  features/comparison/  # comparar precios entre tiendas con el criterio declarado
  features/contributions/ # mis aportes, apelar un descarte y marcar un precio dudoso
  features/history/     # historial y gráfica de los últimos 30 días
  features/moderation/  # panel del moderador: precios en revisión (tiendas, productos y roles en camino)
  features/proposals/   # proponer un producto o sugerir una tienda que no existe
  features/reports/     # registrar un precio: producto, tienda cercana, precio y hora
  features/stores/      # mapa de tiendas (Leaflet + OpenStreetMap) y página de cada tienda
  pwa/                  # cola sin conexión (IndexedDB), reportes pendientes y aviso de versión nueva
  shared/api/           # cliente de la API con los tipos del contrato
  shared/ui/            # colores, fuentes, etiquetas y estados comunes (prototipo de MC-E4)
  test/                 # configuración de Vitest
```

Cada carpeta aparece cuando tiene su primer archivo (YAGNI). La organización prevista es por funcionalidad: `src/features/<tema>` (catalog, comparison, reports, basket, map, auth, moderation, commerce en el Corte 3), `src/shared` (componentes y cliente de la API generado) y `src/pwa` (cola sin conexión). Las pruebas van junto al archivo: `*.spec.tsx`; las de extremo a extremo, en `e2e/` (#27).

## Responsabilidades

- Experiencia del consumidor: buscar, consultar y comparar precios.
- Experiencia del reportante: registrar y confirmar precios con pocos pasos.
- Cola local persistente para reportes sin conexión y estado visible de sincronización.
- Experiencia de moderación según el rol.
- Portal de comercios en el Corte 3.
- Accesibilidad WCAG 2.2 AA en los flujos críticos.

## Documentación

- [UX y flujos](docs/UX.md)
- [Offline-first](docs/OFFLINE_FIRST.md)
- [Integración API](docs/API_INTEGRATION.md)
- [Instalar la app y compartir enlaces](docs/INSTALAR_Y_COMPARTIR.md)
- [Épicas](docs/EPICS.md)
- [Contribución](CONTRIBUTING.md)
- Backend: [README](https://github.com/JuanJo0775/Sistema_valora_B#readme), [contrato `openapi.yaml`](https://github.com/JuanJo0775/Sistema_valora_B/blob/dev/docs/openapi.yaml) y [decisiones](https://github.com/JuanJo0775/Sistema_valora_B/blob/dev/docs/DECISIONS.md)

## Fuera del MVP

Aplicación nativa Android/iOS, consulta de precios sin conexión, venta, carrito, pagos, pedidos, domicilios y alertas de bajada de precio. Las alertas permanecen opcionales y futuras.

## Licencia

Uso académico y no comercial; no se permite reproducirlo ni redistribuirlo sin autorización de los titulares (el equipo del proyecto y JuanJo0775). El texto completo está en [LICENSE](LICENSE). No es una licencia de código abierto.
