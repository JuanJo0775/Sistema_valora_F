# UX y flujos principales

## Principios

1. Primero el consumidor: consulta pública de precios sin cuenta.
2. Registro rápido: el reportante debe completar el flujo con pocos pasos; EC-01 usa 15 segundos y al menos 80 % de intentos como referencia.
3. Confianza visible: cada precio muestra fecha, fuente, unidad base y estado de confianza.
4. Neutralidad: el orden explica el criterio aplicado; promociones se distinguen del resultado.
5. Privacidad por diseño: no mostrar identidad ni ubicación personal del reportante.
6. Inclusividad: flujos críticos conformes a WCAG 2.2 AA.

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
