# UX y flujos principales

## Principios

1. Primero el consumidor: consulta pública de precios sin cuenta.
2. Registro rápido: el reportante debe completar el flujo con pocos pasos; EC-01 usa 15 segundos y al menos 80 % de intentos como referencia.
3. Confianza visible: cada precio muestra fecha, fuente, unidad base y estado de confianza.
4. Neutralidad: el orden explica el criterio aplicado; promociones se distinguen del resultado.
5. Privacidad por diseño: no mostrar identidad ni ubicación personal del reportante.
6. Inclusividad: flujos críticos conformes a WCAG 2.2 AA.

## Prototipo de referencia (decidido el 16-nov-2026)

La base es **«Valora Prototipo Claro»** (MC-E4, 10-nov-2026), **simplificada** con la sencillez del primer prototipo («Prototipo Valora», 5-nov-2026). Se eligió el Claro porque cubre mapa, canasta, aportes, historial, comercio y moderación, y porque registra en una sola hoja (unos 6 toques, EC-01); el primero usaba tres pasos (9 a 10 toques) y no tenía mapa en el celular. Del primero se toma la idea de pantallas cortas y una lista de compras simple.

Regla general: **una idea principal por pantalla**, el naranja solo para la acción principal y nada que el backend no entregue de verdad (sin métricas de ejemplo).

| Pantalla | Qué tiene | Qué se quita o simplifica |
| --- | --- | --- |
| Navegación en el celular | Barra inferior: Inicio, Mapa, **+** (Registrar precio, naranja), Canasta, Yo | — |
| Navegación en escritorio | Barra superior: logo, buscador, Inicio, Mapa, Canasta, Yo y «Registrar precio» (naranja). Contenido en **dos columnas**: la principal y un **panel fijo** a la derecha | Sin barra lateral de filtros (tres columnas del primer prototipo) |
| Inicio | «¿Qué vas a comprar hoy?», buscador, **«Canasta básica de hoy»** (unos 5 productos con «Desde $X» y «Ver más») y la tarjeta «Tu canasta» (con listas guardadas suma el enlace «Mis listas guardadas (N)» a `/canasta?tab=guardadas`; con la canasta vacía y listas guardadas, la tarjeta invita a «Abre una lista guardada»). Categorías que pasan a varias líneas (todas a la vista, sin renglón deslizable ni flechas) | No 9 productos de entrada. «Canasta básica de hoy» necesita una ruta nueva en el backend |
| Producto | Orden (precio por unidad, más reciente, distancia), lista de tiendas con precio por unidad y la nota «Ningún comercio paga por aparecer primero» (EC-06), gráfica pequeña de 30 días (#17), «Registrar un precio» y «Agregar a la canasta». En escritorio, el panel derecho lleva los más baratos y las acciones | Sin tarjeta «Más barato» separada (es el primer renglón). Promociones ocultas mientras lleguen vacías (Corte 3) |
| Registrar | Una sola hoja (ya construida, #25): producto, tienda, precio y «Enviar» | Cronómetro solo en el modo de prueba de usabilidad (#28) |
| Canasta | **Lista de compras** en una sola pantalla (`/canasta`) con dos pestañas, **«Mi lista | Guardadas»** (la pestaña va en la dirección: `?tab=guardadas`). «Mi lista»: productos con presentación y cantidad (− / +), **«Comprado»** para tachar en la tienda y, al lado (o debajo en celular), un **resumen corto «Dónde comprar»** (la mejor recomendación, su total, cuántas tiendas, el ahorro si lo hay y el botón **«Ver dónde comprar»**; sin guardar ni detalle, y sin scroll interno). El detalle vive en su propia pantalla, **`/canasta/donde-comprar`** (h1 «Dónde comprar», «Volver» a la canasta): selector de zona, las recomendaciones como un grupo de opciones donde se ve **una a la vez** en detalle (la más barata, todo en una tienda, la más cercana, hasta 3 tiendas dentro del radio; si no caben en una fila se envuelven, nunca se deslizan de lado; flechas del teclado), tiendas con «Cómo llegar» y «Me lo llevan a casa», «Neto estimado», y plegados «Traslado y domicilio (estimado)» y «¿Cuánto te cuesta ir?» (solo estimados). **«Guardar lista»** con un nombre editable vive ahí: en computador es una tarjeta corta fija a la derecha (total, ahorro y guardar, siempre dentro de la altura de la pantalla) y en celular una barra fija abajo, sobre la navegación y la zona segura, con relleno para no tapar contenido. Con la canasta vacía (o todo comprado) la pantalla invita a volver a `/canasta`. Las dos pantallas comparten el área, los supuestos y las ofertas (un contenedor común), así que ir de una a otra no hace solicitudes nuevas (propuesta ADR-034, Corte 3; la reapertura de la decisión del 16-nov-2026 sobre «En dos tiendas» está pendiente de registrarse en EPIC-F02 y la issue #76). «Guardadas»: una tarjeta por lista con «Usar esta lista» (reemplazar o agregar a «Mi lista»), Abrir, Renombrar, Duplicar y Borrar. La lista abierta (`/canasta/plan/:id`) se lee sin conexión, se comparte o imprime y se puede actualizar con precios de hoy. La dirección vieja `/canasta/plan` ya no es una pantalla: redirige a `/canasta` (y `#mis-planes` a `?tab=guardadas`) | El cálculo es del frontend. Sin pedidos ni pagos; el domicilio es la tarifa que escribe la persona |
| Mapa | Radio, tarjetas de tienda con «Cómo llegar», «Ver precios» y «Sugerir una tienda» (#18, #12) | — |
| Yo | Cuenta, «Mis aportes» (#13), reportes guardados en el teléfono, el atajo «Mis listas guardadas (N)» (con o sin sesión, solo si hay listas) y cerrar sesión | Sin métricas de ejemplo («Ahorraste este mes») ni selector de paleta (solo del prototipo) |

## Flujos del núcleo

### Consumidor

- Buscar producto.
- Ver presentaciones.
- Comparar establecimientos por precio por unidad base o distancia.
- Consultar historial/antigüedad y estado de confianza cuando corresponda.
- No se exige iniciar sesión para comparar.

### Reportante

- Identificarse/iniciar sesión según la decisión de autenticación vigente.
- Seleccionar o buscar producto y presentación.
- Seleccionar establecimiento.
- Registrar precio y hora real de observación.
- Guardar localmente si no hay conexión.
- Ver estado de sincronización.
- Consultar sus propios aportes y estados según permisos.

### Moderador

- Acceder a cola de casos.
- Revisar contexto suficiente para resolver sin exponer datos personales innecesarios.
- Confirmar o invalidar observaciones, o suspender cuentas según reglas aprobadas.
- Consultar bitácora de decisiones.

## Corte 3 — Comercio

- Reclamar/solicitar perfil de establecimiento.
- Esperar verificación antes de publicar precios oficiales.
- Publicar y actualizar precios oficiales.
- Publicar promociones con vigencia y condiciones.
- Solicitar corrección de información errónea.
- Sin privilegio de orden ni posición en comparación.

## Estados de interfaz necesarios

- Cargando, vacío, error de red, error de validación.
- Reporte guardado localmente / pendiente de envío / sincronizando / sincronizado / requiere reintento.
- Precio confiable / por verificar / no confiable / desactualizado.
- Establecimiento pendiente de revisión.
- Promoción activa / vencida, separada del listado de comparación.

## Tamaños de prueba de la canasta

Además de 360, 390, 768, 820, 1280 y 1440 px, se prueban los portátiles de 14" y 16" (la mayoría del mercado): **1280×720, 1366×768, 1536×864 y 1728×1117**. En `/canasta` y `/canasta/donde-comprar`, con 3 productos y con la lista larga, y en cada tamaño: sin desborde horizontal de la página, **sin ningún contenedor con scroll propio que de verdad desplace** (ni vertical ni horizontal; prueba permanente `e2e/canasta-sin-scroll-anidado.e2e.ts`), objetivos de 24 px o más (44 px en celular), un solo h1 y un solo complementary, axe sin fallas graves ni críticas y foco en orden visual. En computador, «Ver dónde comprar» y «Guardar lista» quedan a la vista sin desplazar. **Ningún panel `.side` tiene altura máxima ni scroll propio**: el componente `SidePanel` mide su alto y solo le pone `fit` (fijo con `position: sticky` desde 960 px) si cabe entero en la ventana; si no cabe (la lista de tiendas del mapa, el detalle en ventanas bajas), fluye con la página como una columna más. La misma regresión (`e2e/sin-scroll-anidado.e2e.ts`, con la escena falsa de `e2e/support/richFake.ts`) cubre Inicio, mapa, detalle de producto (con promoción y sin precios) y ficha de tienda en 360, 390, 768, 1280×720, 1366×768, 1536×864 y 1728×1117: sin scroll anidado ni horizontal escondido, objetivos de 24 px o más, axe y orden de foco (en celular, el panel va entre el encabezado y el listado, también en el DOM; en computador cada columna va de arriba abajo y el foco nunca queda bajo la barra fija). En el mapa de tiendas los pines no son paradas de Tab: la lista de tiendas es el camino del teclado (los pines siguen siendo imágenes con nombre y se abren con el ratón o el dedo).
