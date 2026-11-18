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

## Cuándo se muestra la franja

- Se esconde si la app ya está instalada (`display-mode: standalone` o `navigator.standalone`).
- **Ahora no** la esconde 14 días (`localStorage`, clave `valora:instalar-oculto`). La fila de **Yo** no
  se esconde nunca.
- En el computador solo aparece si el navegador ofrece la instalación; no se muestra la guía general.
- Es una franja dentro de la página (no fija): no tapa el botón de acción, la barra ni el aviso de cookies.

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

1. Cuando llegue el dominio, cambiar `DEFAULT_SITE_URL` en `src/site.ts`, **o** definir la variable de
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
