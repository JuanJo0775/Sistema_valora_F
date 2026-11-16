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
| Inicio | «¿Qué vas a comprar hoy?», buscador, **«Canasta básica de hoy»** (unos 5 productos con «Desde $X» y «Ver más») y la tarjeta «Tu canasta». Categorías en un solo renglón deslizable | No 9 productos de entrada. «Canasta básica de hoy» necesita una ruta nueva en el backend |
| Producto | Orden (precio por unidad, más reciente, distancia), lista de tiendas con precio por unidad y la nota «Ningún comercio paga por aparecer primero» (EC-06), gráfica pequeña de 30 días (#17), «Registrar un precio» y «Agregar a la canasta». En escritorio, el panel derecho lleva los más baratos y las acciones | Sin tarjeta «Más barato» separada (es el primer renglón). Promociones ocultas mientras lleguen vacías (Corte 3) |
| Registrar | Una sola hoja (ya construida, #25): producto, tienda, precio y «Enviar» | Cronómetro solo en el modo de prueba de usabilidad (#28) |
| Canasta | **Lista de compras**: productos con presentación y cantidad (− / +), **«Comprado»** para tachar en la tienda, y la tarjeta **«Dónde te sale más barata»** con «Todo en una tienda» (#31) | «En dos tiendas» queda para después: elegir la mejor pareja es un cálculo que se decidirá si va en el backend |
| Mapa | Radio, tarjetas de tienda con «Cómo llegar», «Ver precios» y «Sugerir una tienda» (#18, #12) | — |
| Yo | Cuenta, «Mis aportes» (#13), reportes guardados en el teléfono y cerrar sesión | Sin métricas de ejemplo («Ahorraste este mes») ni selector de paleta (solo del prototipo) |

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
