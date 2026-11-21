# Instalar la app y compartir enlaces

Resumen de cómo se instala Valora en el celular, cómo se ve su enlace al compartirlo y cómo cambiar la
dirección del sitio cuando llegue el dominio propio.

## Instalar en Android

- **Chrome, Edge o Samsung Internet:** en el Inicio aparece una franja con **Instalar Valora**. También
  está la fila **Yo > Instalar la app**. Al tocarla, el navegador muestra su cuadro de instalación.
- Si el navegador aún no ofreció la instalación, la franja muestra **Cómo instalar**: menú del navegador
  (tres puntos) > **Instalar aplicación** o **Añadir a la pantalla de inicio**.
- Chrome decide cuándo ofrece la instalación (necesita que la persona haya usado el sitio un momento).
  Por eso el botón propio puede tardar en salir y la guía del menú siempre está.

## Instalar en iPhone y iPad

- iOS no avisa. Solo se instala desde **Safari**: **Compartir** (cuadrado con flecha) > **Añadir a
  pantalla de inicio** > **Añadir**.
- Si se abrió desde otra app (WhatsApp, Instagram, Facebook) o desde Chrome/Firefox para iOS, la guía pide
  copiar el enlace y abrirlo en Safari. Las ventanas internas de otras apps no pueden instalar.
- iPadOS se detecta aunque se presente como Mac (Mac con pantalla táctil).

## Cuándo se muestra el aviso de instalar

Es una sola tarjeta (`src/pwa/InstallPrompt.tsx`), montada en el `Layout`, así que sale en la primera
pantalla que abra la persona y no solo en el Inicio. La antigua franja del Inicio ya no existe.

- Sale unos 6 segundos después de abrir la app, y solo si hay forma de instalar: el navegador dio el
  evento `beforeinstallprompt` (Chrome, Edge, Samsung Internet, también en el computador) o es iOS (con
  la guía de Safari). En Android sin evento no sale; la guía sigue en **Yo > Instalar la app**.
- Se esconde si la app ya está instalada (`display-mode: standalone` o `navigator.standalone`).
- **Ahora no** (o la tecla Escape) la esconde 14 días (`localStorage`, clave `valora:instalar-oculto`).
  **Instalar Valora** abre el cuadro del navegador; si se rechaza, cuenta como «ahora no».
- Prioridad con lo fijo de abajo: primero el aviso de cookies; el de instalar espera a que se cierre y
  nunca se apilan. No sale en `/registrar`. En el celular se coloca sobre la barra de navegación y sobre la
  barra de compra del detalle (`--tabbar-h`, `--action-bar-h`); en escritorio, en la esquina inferior
  derecha. Mientras está, la página suma `--install-h` de relleno para que no tape el final del contenido.
- Accesibilidad: es una región con nombre (`Instalar la app`) dentro de una región `aria-live="polite"`
  que existe siempre; no roba el foco. Usa solo los tokens de color (claro y oscuro).
- La fila de **Yo** nunca se esconde.

## Desinstalar la app

Los navegadores no dejan desinstalar una app por código, así que la app solo guía. La pantalla
**Yo > Instalar y desinstalar la app** (`/yo/app`) está enlazada desde la fila **Desinstalar la app** de Yo
y desde **Ajustes > La app**. Si se abre instalada, muestra «Estás usando la app instalada» y pone primero,
abiertos, los pasos del dispositivo detectado (computador, Android o iPhone/iPad); los demás quedan plegados.

- **Computador, Chrome o Edge, con la app en su ventana:** menú de tres puntos de la ventana (arriba a la
  derecha) > **Desinstalar Valora…** (Chrome) o **Desinstalar** (Edge). Hay una casilla opcional para borrar
  también los datos del sitio.
- **Windows:** Configuración > Aplicaciones > Aplicaciones instaladas > buscar **Valora** > Desinstalar (las
  apps de Chrome y de Edge aparecen ahí).
- **Mac y Linux:** en Chrome, `chrome://apps` > clic derecho en Valora > **Quitar de Chrome**, o el menú de
  la ventana de la app. Los nombres pueden variar según la versión.
- **Android:** mantener pulsado el ícono > **Desinstalar** (o Información de la app > Desinstalar).
- **iPhone y iPad:** mantener pulsado el ícono > **Eliminar app** > **Eliminar de la pantalla de inicio**.
- Desinstalar no borra la cuenta ni los aportes. La canasta y las preferencias guardadas en el dispositivo
  se borran desde el navegador (borrar los datos del sitio).

## Registrar un precio con la tienda elegida

`/registrar` acepta `?tienda=<id>` junto a `?producto=<id>` para dejar el establecimiento preseleccionado
(por ejemplo, desde la página de una tienda). Si no es un UUID, o la tienda no existe
(`GET /establishments/{id}/prices` responde 404), se ignora y queda la última tienda recordada. Sin
`?producto=`, la tienda se conserva en los enlaces de los productos recientes y del buscador.

## Auditoría de instalabilidad móvil (18-nov-2026)

Con el build de producción y Chromium emulando un Pixel 7 (agente de usuario y pantalla móviles):

| Revisión | Resultado |
| --- | --- |
| `Page.getInstallabilityErrors` | Vacío |
| Manifest | Sin errores; `start_url` dentro de `scope`; responde 200 también con el service worker activo |
| Service worker | Activo; controla la página tras recargar |
| Íconos | 192, 512 y maskable 512 reales, opacos y con el logo dentro de la zona segura |
| `apple-touch-icon` | 180 x 180, todos los píxeles opacos |
| Cabeceras de `vercel.json` | No hay `headers`; el rewrite a `index.html` no pisa archivos estáticos |
| Manifest en producción | `Content-Type: application/manifest+json`, 200 |

Lo que faltaba y se corrigió:

- **Metas de iOS ausentes** (`apple-mobile-web-app-capable`, `-title`, `-status-bar-style`,
  `mobile-web-app-capable`): añadidas.
- **Manifest incompleto:** se añadieron `scope`, `dir`, `display_override`
  (`standalone`, `minimal-ui`), `prefer_related_applications: false` y `purpose: "any"` explícito en los
  íconos 192 y 512, separados del `maskable`.
- **`orientation` no se fija** a propósito: bloquear vertical molesta en tableta y no influye en la
  instalabilidad.
- **Sin ayuda dentro de la app:** esa fue la causa más probable de «nadie la instala». El manifest y el
  service worker ya cumplían lo que pide Chrome; en Android Chrome la instalación se ofrece según su
  criterio y en el menú, y en iOS nunca se ofrece sola. Ahora hay botón y guía.
- **`robots.txt` y `sitemap.xml` devolvían el HTML de la app** (el rewrite lo atrapaba): ahora existen.

## Vista previa al compartir (Open Graph)

`index.html` trae título, descripción, `canonical`, `og:*` (con imagen 1200 x 630, tipo, ancho, alto y
texto alternativo), `twitter:*` y `theme-color`. `public/og-image.png` pesa unos 86 KB (límite 300 KB),
mide 1200 x 630 (1,91:1) y el texto se lee bien a tamaño de miniatura.

### Productos (`/productos/:id`)

Los rastreadores (WhatsApp, Facebook, X, Telegram, LinkedIn) no ejecutan JavaScript, así que una SPA
sola mostraría siempre la vista previa general. Solución sin servidor propio:

- `vercel.json` manda `/productos/:id` a `api/og-producto.ts` **solo** si el `User-Agent` es de un
  rastreador conocido. Las personas reciben la app de siempre.
- La función consulta `GET /v1/products/:id` (API pública, mismo origen), y devuelve una página mínima con
  el nombre, la marca y las presentaciones. Si la API tarda más de 3,5 s o falla, o el id no es válido,
  devuelve la vista previa general: compartir nunca queda sin vista previa. La respuesta se guarda 1 hora en
  el borde de Vercel.
- No muestra precios (cambian y no son datos de la página). Usa la imagen general de Valora.
- Límites: solo `/productos/:id`; las demás rutas comparten la vista previa general. La API en Render puede
  tardar en despertar: la primera vista previa tras un rato sin uso puede salir general. La lista de
  rastreadores está en `vercel.json` y hay que ampliarla si aparece otro.
- No se pudo probar desplegada desde el entorno de desarrollo (solo las pruebas unitarias y el
  emulador). Tras el primer despliegue, comprobar con el depurador de Facebook, el de LinkedIn o
  `curl -A WhatsApp https://<sitio>/productos/<id>`.

## Cambiar la dirección del sitio (dominio propio)

La dirección vive en **un solo lugar**: `DEFAULT_SITE_URL` en `src/site.ts`. El build la pone en
`index.html` (`canonical`, `og:url`, `og:image`, `twitter:image`), en `robots.txt` y en `sitemap.xml`.

1. Cambiar `DEFAULT_SITE_URL` en `src/site.ts` (desde el 20-nov-2026 es `https://www.valoora.app`), **o** definir la variable de
   entorno `SITE_URL` en Vercel (Settings > Environment Variables), sin tocar código. Debe ser
   `https://dominio` sin ruta ni barra final.
2. Volver a desplegar.
3. Los rastreadores guardan la vista previa: pedir que la actualicen con el depurador de Facebook
   (Sharing Debugger) o el inspector de LinkedIn.

`api/og-producto.ts` toma el dominio de la petición, así que no necesita cambio.

## Pendiente de verificar en dispositivo real

- Que Android Chrome real dispare `beforeinstallprompt` (en emulación se simula el evento).
- Los pasos en Safari de iPhone y iPad, y el aspecto del ícono en la pantalla de inicio.
- La vista previa real en WhatsApp, Telegram, Facebook, X y LinkedIn, y la función de Vercel desplegada.
