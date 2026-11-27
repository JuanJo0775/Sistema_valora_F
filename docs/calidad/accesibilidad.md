# Accesibilidad — WCAG 2.2 AA (#28)

Revisión del 17-nov-2026 sobre los flujos críticos: buscar, comparar (detalle), registrar un precio, crear cuenta e iniciar sesión, canasta, mapa, «Yo» y el panel del moderador. Meta de la issue #28: **0 fallas graves**.

## 1. Revisión automática (axe)

- **Herramienta:** `axe-core` 4.10 dentro de las pruebas de Vitest (`src/app/accessibility.spec.tsx`), con la app completa y el backend simulado.
- **Cómo correrla:** `pnpm test` (corre en la CI, en el job «Pruebas»).
- **Por qué Vitest y no Playwright:** Playwright es la #27 y todavía no está montado. El resultado que pide la issue (0 fallas graves) se puede revisar igual.
- **Qué revisa:** todas las reglas de axe (WCAG 2.0, 2.1 y 2.2, niveles A y AA), menos el contraste. El contraste no se puede medir en jsdom, porque jsdom no pinta (ver la sección 2).
- **Que la revisión sí detecta fallas:** `src/test/axe.spec.tsx` comprueba que encuentra un botón sin nombre y un campo sin etiqueta.

| Pantalla | Graves o críticas | Moderadas | Estado |
|---|---|---|---|
| Inicio | 0 | 1 → 0 | `heading-order`: las tarjetas usaban h3 sin h2. **Corregido**: ahora son h2, y una prueba lo vigila |
| Detalle del producto | 0 | 0 | OK |
| Registrar un precio | 0 | 0 | OK |
| Iniciar sesión | 0 | 0 | OK |
| Crear cuenta | 0 | 0 | OK |
| Canasta | 0 | 0 | OK |
| Mapa | 0 | 0 | OK |
| Yo | 0 | 0 | OK |
| Panel del moderador | 0 | 0 | OK |

## 2. Contraste (1.4.3 texto y 1.4.11 controles)

`src/shared/ui/tokens.spec.ts` calcula la relación de contraste con la fórmula de WCAG sobre los colores de `tokens.css`, en tema claro y oscuro. Pide **4,5:1 para el texto** y **3:1 para los bordes de los controles**. Corre en la CI.

| Hallazgo | Antes | Después |
|---|---|---|
| Rótulos en versalitas («TODAS LAS TIENDAS», «ÚLTIMOS 30 DÍAS»), tema claro | 3,65:1 y 3,35:1 ✗ | 5,17:1 y 4,75:1 ✓ (`--ink-3` = `#736c64`) |
| Bordes de campos, contador y botones con borde, tema claro | 1,45:1 ✗ | 3,65:1 ✓ (`--field-line` nuevo) |
| Lo mismo, tema oscuro | 1,61:1 ✗ | 3,64:1 ✓ |
| Texto principal, secundario, botón naranja, tarjeta naranja y píldoras de estado (13 pares × 2 temas) | — | todos ≥ 4,5:1 ✓ |

## 3. Teclado y foco visible (2.1.1, 2.4.3, 2.4.7)

Se recorrió el Inicio y el detalle solo con Tab y Mayús+Tab, en el navegador de escritorio:

- **Foco visible:** todos los controles muestran el contorno naranja (`:focus-visible` en `base.css`; los chips, el control segmentado, el contador, la papelera, los interruptores y la barra del radio tienen su propio contorno). Ningún estilo quita el contorno (`outline: none`).
- **Orden lógico:** buscador → navegación → chip de ubicación → categorías (un solo paso de Tab; se cambia con las flechas) → tarjeta → «Agregar a la canasta» → panel lateral.
- **Sin trampas de teclado:** el mapa de Leaflet se atraviesa con Tab, y su equivalente accesible es la lista de tiendas.
- **Controles personalizados:** el buscador del registro, los chips (radios), el control segmentado (radios), los interruptores (`role="switch"`), el aviso de la canasta (`role="status"`) y el cronómetro (`role="timer"`) se anuncian con su rol.

## 4. Tamaño de toque (2.5.8 y la meta propia de 44 px)

Se midió, a 375 px de ancho, el tamaño de cada botón, enlace y campo visible en el Inicio, el detalle, el mapa y crear cuenta.

- **Inicio, mapa y crear cuenta:** sin controles menores de 44 px, salvo enlaces dentro de una frase («¿Ya tienes cuenta? Inicia sesión»), que WCAG 2.5.8 exceptúa. La casilla de la política se toca con toda su frase.
- **Detalle:** el nombre de la tienda en la lista y «Ver el historial» medían 20 px y 22 px de alto. **Corregido**: ahora miden 44 px de alto. «Ver el boletín» queda dentro de una frase (excepción).

## 5. Pendiente

- **Prueba de usabilidad EC-01** con 8 a 10 personas: ver `docs/calidad/prueba-usabilidad.md`. La hace el equipo.
- **Lector de pantalla real** (NVDA en Windows o TalkBack en Android) en el registro de un precio: recomendable para el informe del entregable. axe no reemplaza a una persona.
- ~~**Playwright con axe** en un navegador de verdad, que sí mide el contraste pintado~~: hecho para sesión, comercio y moderación (sección 6). Los flujos de búsqueda, detalle y registro de un precio ya los revisaban `pulido-pantallas` y `sin-scroll-anidado`.

## 6. Revisión en un navegador de verdad (26 y 27-nov-2026)

`e2e/accesibilidad-sesion-y-moderacion.e2e.ts` corre en Chrome, con `/v1` simulado (sin backend), dos revisiones sobre **16 pantallas**: iniciar sesión, crear cuenta, «Yo» (reportante y comercio), Ajustes (moderador y comercio), registrar mi tienda, el portal del comercio (Precios, Carga masiva, Promociones y Mi tienda) y las cinco pestañas del panel de moderación (Precios, Tiendas, Productos, Comercios y Roles), con casos pendientes para que se vean los números.

**A. axe con contraste** (`expectNoSeriousAxe`, todas las reglas): 16 pantallas × tema claro y oscuro × celular (390 px) y computador (1280 px) = **64 comprobaciones**. Resultado: 64 de 64 sin fallas graves ni críticas.

**B. Estructura y teclado** (en celular, 16 comprobaciones): `lang="es-CO"`, un solo `h1`, que «Saltar al contenido» sea el primer control en el orden del documento y que Enter lleve el foco a `#contenido` sin cambiar la dirección, y que las primeras 8 paradas de Tab tengan contorno de foco visible (2 px o más, o sombra, en el elemento o en su ficha). Resultado: 16 de 16.

- **Que la revisión sí detecta fallas:** con texto gris claro (#d0d0d0) sobre blanco en etiquetas, párrafos y enlaces, la comprobación A falla, como debe. Se probó una vez a mano, sin subir esa prueba.
- **Hallazgo que resultó ser falso:** el deslizador del radio de búsqueda parecía no mostrar foco, porque su contorno se pinta en el pulgar (`::-webkit-slider-thumb`), que `getComputedStyle` no expone. La prueba lo verifica comparando capturas del control con y sin foco, y sí cambia: el foco es visible.
- **Observación abierta, sin explicar (27-nov-2026):** en la CI, con el Chromium de Playwright, tras cargar cada pantalla el **primer Tab real cayó en el primer control del contenido** («Volver», «Mis aportes»…) y no en «Saltar al contenido». En Chrome local sí cae en el enlace, y tampoco se reprodujo en local compilando con `NODE_ENV=development`, como hace la CI. Por eso la prueba verifica el orden del documento y no el primer Tab real. Hay que averiguar si es un efecto del navegador de la CI o si la app mueve el foco al contenido al cargar; `useRouteTitle` dice que no lo hace en la carga inicial. Si fuera la app, el enlace de salto no serviría en esa primera pulsación.
- **Límite que hay que conocer:** cuando axe no puede determinar el color de fondo de un elemento (por ejemplo, porque otro lo tapa en parte), lo deja como «incompleto», no como falla, y la comprobación A no lo cuenta. Esos elementos quedan sin verificar por esta vía: los cubren `tokens.spec.ts` (sección 2) y la revisión manual.
- **Qué no cubre:** pantallas con datos reales (las colas van vacías y el portal tiene un solo precio y una promoción), los avisos del comercio y la activación de avisos (el servidor simulado dice que no hay clave), el contenido tras abrir diálogos, y el contorno de foco de todos los controles (solo las primeras 8 paradas de cada pantalla). Tampoco sustituye la prueba con un lector de pantalla real ni la de usabilidad con personas (sección 5).
