# Plan de pruebas manuales de Valora

Para recorrer a mano los tres perfiles (reportante, comerciante y moderador) y los flujos que los cruzan.
Cada fila se marca con ✅ (cumple), ❌ (falla) o ➖ (no se pudo probar), y lo que falle se anota en el
[registro de hallazgos](#9-registro-de-hallazgos) del final.

Se basa en el informe QA del módulo de comerciante (23 y 24 de noviembre de 2026) y en lo que se mezcló
en `dev` después: H5, H6, H14, H16, H17, H18, H36 y la política de privacidad. Los textos entre «comillas»
son los que debe mostrar la pantalla; si cambia una palabra pero el sentido es el mismo, se marca ✅.

## 0. Antes de empezar

### 0.1 Entorno

| # | Verificar | Cómo | ✅/❌ |
|---|-----------|------|-------|
| E1 | Las migraciones están aplicadas en la base que se va a probar, **incluida la `0053`** (comercios verificados en la ficha) | `pnpm db:migrate` en `Sistema_valora_B` o revisar `drizzle.__drizzle_migrations` | |
| E2 | El frontend y el backend son de `dev` actualizado (no de `main` anterior) | `git log -1` en los dos repositorios y confirmar que el despliegue que se prueba es de ese commit | |
| E3 | Hay datos: productos con precios en al menos 3 tiendas del mismo municipio y una tienda de cadena (D1, Ara o Éxito) | Mapa y comparación de «Arroz» | |
| E4 | Se puede iniciar sesión con las cuentas de la tabla 0.2 | Entrar con cada una | |
| E5 | El correo de verificación llega (o la verificación está desactivada en pruebas) | Crear una cuenta nueva | |

### 0.2 Cuentas de prueba

Crea estas cuentas y no reutilices las de producción. El moderador se crea con `pnpm db:seed-moderador`
(variables `SEED_MODERATOR_EMAIL` y `SEED_MODERATOR_PASSWORD`); nunca se deja en producción real.

| Alias | Rol inicial | Para qué sirve |
|-------|-------------|----------------|
| **Ana** | Reportante | Recorrer todo el panel de reportante y reclamar una tienda para volverse comerciante |
| **Beto** | Reportante | Segunda cuenta: confirmar precios, denunciar y disputar la tienda de Ana |
| **Carla** | Reportante | Tercera cuenta: la discrepancia de precio pide dos reportes independientes |
| **Mod** | Moderador | Todo el panel de moderación |

### 0.3 Dispositivos y modos

Repite las filas marcadas con 📱 en un teléfono real. El reclamo a 50 m y «Estoy en la tienda» solo se
prueban bien con GPS real y en la tienda.

| Modo | Cuándo |
|------|--------|
| Escritorio, Chrome | Todo el plan |
| Teléfono real (Android y/o iPhone), con GPS | Filas 📱 |
| Ventana de 390 px de ancho | Accesibilidad y diseño, sección 6 |
| Tema claro y tema oscuro | Contraste, sección 6 |
| Sin conexión (DevTools › Network › Offline) | Sección 1.5 |

---

## 1. Panel de reportante (consumidor)

### 1.1 Cuenta y sesión

| # | Qué hacer | Resultado esperado | ✅/❌ | Notas |
|---|-----------|--------------------|-------|-------|
| R1 | Crear cuenta en `/crear-cuenta` sin aceptar la política | No deja crear: pide aceptar la política | | |
| R2 | Crear cuenta aceptando la política | La cuenta queda creada; pide verificar el correo | | |
| R3 | Verificar el correo con el enlace | Entra y ofrece seguir con lo que se estaba haciendo | | |
| R4 | Cerrar sesión y entrar con correo y contraseña | Entra; «Yo» muestra el rol «Reportante» | | |
| R5 | Entrar con una contraseña incorrecta | Mensaje claro, sin decir si el correo existe | | |
| R6 | «Olvidé mi contraseña» con un correo cualquiera | Responde igual exista o no la cuenta | | |
| R7 | Cambiar el nombre y la contraseña en «Yo › Ajustes» | Se guardan; el nombre se ve solo en la propia sesión | | |
| R8 | Programar la eliminación de la cuenta (`/yo/eliminar-cuenta`) | Dice que se elimina a los 10 días y que se puede restaurar; cierra la sesión | | |
| R9 | Entrar de nuevo durante esos 10 días | Aparece «Restaurar mi cuenta» y vuelve con todo intacto | | |

### 1.2 Comparar, mapa y ficha de tienda

| # | Qué hacer | Resultado esperado | ✅/❌ | Notas |
|---|-----------|--------------------|-------|-------|
| C1 | Sin cuenta, buscar «Arroz» en «Inicio» | Lista productos; no pide entrar | | |
| C2 | Abrir el producto y comparar | Ordena por precio por unidad; cada precio dice su vigencia y confiabilidad | | |
| C3 | Cambiar el orden a distancia y a reciente | El orden cambia y el criterio queda declarado en pantalla | | |
| C4 | Pulsar «Usar mi ubicación» y negar el permiso | No se rompe; deja elegir el municipio | 📱 | |
| C5 | Pulsar «Usar mi ubicación» y aceptar | Muestra tiendas cercanas; no guarda la ubicación | 📱 | |
| C6 | Abrir `/mapa` | El mapa **se ve** (no mide 0 px) y muestra las tiendas | | H8 |
| C7 | Abrir la ficha de una tienda | Nombre, tipo, dirección, municipio, precios con su vigencia | | |
| C8 | Ficha de una tienda **con comercio verificado** | Aparece la insignia «Comercio verificado» junto al tipo | | H6 |
| C9 | Ficha de una tienda con precio oficial | La fila del precio dice «Precio oficial» | | H6 |
| C10 | Ficha de una tienda con promoción activa | Sección «Promociones»: producto, oferta, «Antes $X», precio con promoción, «Hasta el…» y condiciones | | H6 |
| C11 | Ficha de una tienda de la comunidad (sin dueño) | No dice «Comercio verificado» ni muestra «Promociones» | | H6 |
| C12 | Ficha: filtro «Solo precios vigentes» | Quita los desactualizados y los que están en revisión | | |
| C13 | Ficha: «Cómo llegar» | Abre Google Maps en otra pestaña con la tienda como destino | | ADR-019 |
| C14 | Comparar con una promoción activa | Las promociones salen **aparte**, no alteran el orden | | ADR-009 |
| C15 | Historial de precios de un producto | Muestra la evolución sin identificar a quién reportó | | |

### 1.3 Registrar un precio

| # | Qué hacer | Resultado esperado | ✅/❌ | Notas |
|---|-----------|--------------------|-------|-------|
| P1 | Sin sesión, abrir `/registrar` | Pide entrar y conserva a dónde volver | | |
| P2 | Con Ana: elegir producto, tienda y un precio razonable | Confirma «Recibido» y el foco pasa al título | | |
| P3 | Ver ese precio en la ficha de la tienda | Aparece con vigencia «vigente» | | |
| P4 | Registrar un precio **absurdamente bajo** ($150 por 1 kg de arroz) | Aviso «Revisa el precio…» con la referencia; hay que confirmar | | ADR-030 |
| P5 | Confirmar ese precio sospechoso | Queda «en revisión»; **no** es el «Más barato» | | |
| P6 | Leer el mensaje tras confirmarlo | Dice que un moderador lo revisará antes de mostrarlo; no dice «ya cuenta en la comparación» | | H23 |
| P7 | Desde la ficha de una tienda, «Registrar un precio aquí» | La tienda queda elegida en el formulario | | H24 |
| P8 | Reportar el mismo precio dos veces seguidas (doble clic) | No se duplica (clave de idempotencia) | | EC-07 |
| P9 | Con una cuenta sin correo verificado | Pide verificar el correo antes de registrar | | ADR-029 |

### 1.4 Mis aportes, avisos y suspensión

| # | Qué hacer | Resultado esperado | ✅/❌ | Notas |
|---|-----------|--------------------|-------|-------|
| A1 | Abrir `/mis-aportes` | Lista los aportes con su estado | | |
| A2 | Aporte que el moderador ya decidió | Ya **no** dice «En revisión» | | H34 |
| A3 | Cuenta suspendida: abrir `/registrar` | Aviso con la fecha, el motivo y un enlace a «Mis aportes» | | H33 |
| A4 | Cuenta suspendida: ver `/mis-aportes` | Se puede entrar y ver el estado de los aportes | | H33 |

### 1.5 Sin conexión y canasta

| # | Qué hacer | Resultado esperado | ✅/❌ | Notas |
|---|-----------|--------------------|-------|-------|
| O1 | Sin red, registrar un precio | Queda en la cola de «Pendientes» con su hora de observación | | ADR-010 |
| O2 | Volver la red | Se envía solo; no se duplica | | |
| O3 | Sin red, comparar un producto que no se había abierto | Dice que la consulta necesita conexión; no inventa datos | | |
| O4 | Agregar productos a la canasta | Se guardan en el dispositivo | | |
| O5 | «Dónde comprar» con la canasta | Propone dónde comprar con el total | | |
| O6 | Guardar un plan y volver a abrirlo | El plan guardado abre igual | | |

### 1.6 Proponer tiendas y productos

| # | Qué hacer | Resultado esperado | ✅/❌ | Notas |
|---|-----------|--------------------|-------|-------|
| T1 | `/proponer/tienda`: el mapa **se ve** | Se puede tocar el mapa para marcar el punto | | H8 |
| T2 | Proponer una tienda con «Estoy en la tienda» | Confirma que el punto quedó marcado | 📱 | |
| T3 | Proponer una tienda a menos de 50 m de otra con nombre parecido | La propuesta llega a moderación marcada con el posible duplicado | | |
| T4 | `/proponer/producto` con nombre y presentación | Confirma «Recibido» | | |

### 1.7 Quiero registrar mi tienda (de reportante a comerciante)

| # | Qué hacer | Resultado esperado | ✅/❌ | Notas |
|---|-----------|--------------------|-------|-------|
| M1 | `/yo` de un reportante | Ofrece «Registrar mi tienda» | | |
| M2 | Enviar el formulario vacío | Avisos que dicen qué campo falta; el foco va al primero | | |
| M3 | Teléfono inválido | Mensaje con el formato; el campo queda marcado y recibe el foco | | H29 |
| M4 | Corregir el teléfono | El aviso desaparece apenas se corrige | | H2 |
| M5 | Sin aceptar las condiciones | «Lee y acepta las condiciones…»; la casilla recibe el foco | | |
| M6 | Buscar «D1» en el selector | Cada opción se distingue (municipio, dirección o distancia), no decenas de «D1» iguales | | H10 |
| M7 | Elegir una tienda de **cadena** (D1, Ara, Éxito) y registrar | Explica que no se reclama; ofrece «Registrar una tienda nueva» | | H11 |
| M8 | Mientras el navegador obtiene la ubicación | El botón dice «Obteniendo tu ubicación…» | | H12 |
| M9 | Reclamar una tienda **lejos** de ella | «Tienes que estar en la tienda, a 50 m o menos…»; el formulario conserva los datos | 📱 | |
| M10 | Reclamar una tienda sin dueño **estando en ella** | «Tu tienda quedó verificada»; el rol pasa a «Comercio» | 📱 | |
| M11 | Registrar una **tienda nueva** que no está en el mapa | «Tu tienda quedó preaprobada» con la lista de lo que se desbloquea; el rol sigue siendo Reportante | | |
| M12 | Reclamar una tienda con dueño, **estando en ella** | Queda una disputa; **no** sale como error | 📱 | H17 |
| M13 | Volver a `/comercios/registro` tras disputar | Aviso «Tienes una disputa abierta» con la tienda, la fecha y que moderación la revisa | | H17 |
| M14 | Denunciar un comercio con un motivo de menos de 10 letras | Dice que faltan letras (no queda mudo) | | H13 |
| M15 | Denunciar con motivo válido | «Denuncia recibida. Un moderador revisará el caso.» | | |
| M16 | Volver a denunciar el mismo comercio | Dice que ya lo denunciaste; la ficha ya no ofrece el formulario | | H31 |
| M17 | Ficha de **tu propia** tienda (ya comerciante) | No ofrece denunciar ni «¿Eres el dueño?» | | H7 |
| M18 | Abrir `/comercios` siendo reportante | Pantalla con salida: «Registrar mi tienda» o «Volver a Yo» | | H1 |
| M19 | Abrir `/moderacion` siendo reportante | Bloqueado, con salida | | H1 |

---

## 2. Panel de comerciante

Para esta sección usa la cuenta de Ana ya verificada como comercio.

### 2.1 Portal: precios

| # | Qué hacer | Resultado esperado | ✅/❌ | Notas |
|---|-----------|--------------------|-------|-------|
| K1 | Abrir `/comercios` | Nombre de la tienda, insignia «Verificado», contadores y cuatro pestañas (Precios, Carga masiva, Promociones, Mi tienda) | | |
| K2 | Botón «Precios oficiales» de la barra | Abre el portal; en «Yo» el botón principal cambió | | |
| K3 | Buscar un producto y elegirlo | Aparece el campo «Precio oficial en pesos» con el foco | | |
| K4 | Publicar vacío y con `0` | «Escribe un precio entero entre $100 y $5.000.000, sin puntos» | | |
| K5 | Publicar un precio razonable ($5.200 por 1 kg de arroz) | «Precio oficial publicado.» y queda «Vigente» | | |
| K6 | La fila publicada | Dice el **nombre** del producto, no un código interno | | H3 |
| K7 | Publicar **$300** por 1 kg de arroz | Se **rechaza** con el mensaje del servidor junto al campo | | H19, ADR-037 |
| K8 | Publicar un precio diez veces mayor ($52.000) | No queda como oficial sin más: se rechaza o queda en revisión, nunca «Más barato» | | H19 |
| K9 | Publicar un precio sin referencia | «Tu precio quedó en revisión…»; mientras tanto sigue vigente el anterior | | ADR-037 |
| K10 | «Todos mis precios siguen igual» | Pide confirmación y dice cuántos precios afecta | | H22 |
| K11 | Editar un precio publicado y cancelar | El foco vuelve a la fila o al buscador, no a la página | | H26 |
| K12 | Cambiar de pestaña tras publicar | El aviso «Precio oficial publicado.» ya no está en la otra pestaña | | H4 |
| K13 | Aviso de discrepancia «Corregir» | Aparece solo con 2 reportes independientes, recientes y de confiabilidad media o alta que difieran más de 5 % | | ADR-008. Necesita Beto y Carla |

### 2.2 Portal: carga masiva

| # | Qué hacer | Resultado esperado | ✅/❌ | Notas |
|---|-----------|--------------------|-------|-------|
| U1 | Subir un CSV con el encabezado equivocado | «La primera fila debe ser codigo_barras;precio…» | | |
| U2 | CSV con una fila de código desconocido y otra de precio inválido | «Filas con errores» con el motivo de cada una y botón «Descargar filas con errores» | | |
| U3 | CSV válido con 2 códigos de barras | «Filas publicadas: 2» y el contador sube | | |
| U4 | CSV con un precio absurdo | Esa fila se rechaza o queda en revisión como en K7 | | H19 |

### 2.3 Portal: promociones

| # | Qué hacer | Resultado esperado | ✅/❌ | Notas |
|---|-----------|--------------------|-------|-------|
| N1 | Publicar vacía y con 150 % | Avisos que dicen el límite | | |
| N2 | Publicar 10 % del hoy al hoy+7 | «Antes $5.200 · Con promoción $4.680», estado «Activa» | | |
| N3 | Ver la promoción en la ficha pública | Sale en «Promociones» con el mismo «antes» y precio | | H6 |
| N4 | Publicar «Lleve 2, pague 3» con valores inválidos | El aviso sale **junto al botón** y recibe el foco | | H21 |
| N5 | Publicar una segunda promoción del **mismo producto** con fechas solapadas | Se rechaza; el aviso dice que ya hay otra vigente | | H20 |
| N6 | «Retirar promoción» con Enter | Pasa a «Confirmar retiro / Cancelar» y el foco cae en «Confirmar retiro» | | H26 |
| N7 | Confirmar el retiro | «Promoción retirada.» y desaparece de la ficha pública | | |

### 2.4 Portal: Mi tienda

| # | Qué hacer | Resultado esperado | ✅/❌ | Notas |
|---|-----------|--------------------|-------|-------|
| S1 | Cambiar el teléfono a uno inválido y luego válido | Mensaje con el formato; luego «Cambios aplicados: teléfono» | | |
| S2 | Ver ese teléfono en la ficha pública | Aparece como enlace «Teléfono: …» | | |
| S3 | «Editar horario»: cambiar el lunes y guardar | «Cambios aplicados: horario»; se ve en la ficha | | |
| S4 | «Copiar el horario del lunes a los demás días» | Copia a los demás días y avisa que se revise | | H9 |
| S5 | El editor de horario | Tiene el mismo aspecto que el resto del portal (no los bordes por defecto del navegador) | | H9 |
| S6 | «Cambiar ubicación» | El mapa **se ve**; se puede marcar el punto | | H8 |
| S7 | Guardar una ubicación nueva | «En revisión: ubicación» (va a moderación) | | |
| S8 | Cambiar el nombre | Se aplica, o queda «En revisión» si es parecido al de otra tienda a menos de 50 m | | |

### 2.5 Dejar o eliminar la tienda

| # | Qué hacer | Resultado esperado | ✅/❌ | Notas |
|---|-----------|--------------------|-------|-------|
| L1 | En «Mi tienda», pulsar «Dejar de administrar esta tienda» | Confirmación que dice: se retiran precios oficiales y promociones, la tienda sigue en el mapa sin dueño, la cuenta vuelve a reportante | | H36 |
| L2 | Cancelar | Cierra la confirmación y el foco vuelve al botón | | |
| L3 | Confirmar | «Dejaste de administrar…» y «Ir a Yo»; la cuenta vuelve a «Reportante» | | |
| L4 | Ver la ficha pública de esa tienda | Sigue en el mapa, **sin** «Comercio verificado» ni precios oficiales | | |
| L5 | Volver a reclamar la misma tienda | Se puede (las reglas de siempre) | | |
| L6 | Con un comercio que **creó su tienda nueva**: «Eliminar mi tienda» | Aparece solo para quien la creó; avisa que sale del mapa y las búsquedas | | H36 |
| L7 | Confirmar la eliminación | La tienda desaparece del mapa, de las búsquedas y de la ficha pública | | |
| L8 | Una tienda reclamada (no creada por la cuenta) | **No** ofrece «Eliminar mi tienda», solo dejarla | | |
| L9 | Eliminar la **cuenta** de un comercio | La pantalla dice qué pasa con la tienda y sus precios oficiales | | H35 |
| L10 | Programar la eliminación y luego restaurarla | Vuelve como comercio con la tienda y el precio intactos | | |

### 2.6 Casos de otras cuentas

| # | Qué hacer | Resultado esperado | ✅/❌ | Notas |
|---|-----------|--------------------|-------|-------|
| X1 | Cuenta revocada abre `/comercios/registro` | Mensaje estándar «Moderación revocó el registro de esta cuenta para esa tienda.»; **no** el texto interno del moderador | | H15 |
| X2 | Cuenta revocada intenta reclamar la misma tienda | «El equipo de moderación revocó el registro…» | | |
| X3 | Cuenta rechazada (tienda propuesta no aprobada) | Ve el motivo del moderador y puede registrar otra tienda | | |
| X4 | Moderador abre `/comercios` y `/comercios/registro` | Bloqueado, con salida | | H1 |

---

## 3. Panel de moderador

Entra con Mod. Las cinco pestañas son Precios, Tiendas, Productos, Comercios y Roles.

### 3.1 Generales

| # | Qué hacer | Resultado esperado | ✅/❌ | Notas |
|---|-----------|--------------------|-------|-------|
| G1 | Abrir `/moderacion` | Abre en «Precios»; las pestañas muestran cuántos casos esperan | | |
| G2 | Recargar con `?vista=comercios` | Se queda en esa pestaña | | |
| G3 | Con el teclado: flechas, Inicio y Fin sobre las pestañas | Mueven el foco y cambian de pestaña; solo una pestaña está en el orden de Tab | | H32 |
| G4 | Registrar una decisión sin elegir | «Elige la decisión.» con el foco en la primera opción | | |
| G5 | Registrar sin motivo (o con menos de 10 letras) | «Escribe el motivo: al menos 10 letras.»; el campo queda marcado y recibe el foco | | H29 |
| G6 | Tras cualquier decisión | «Decisión registrada: …» recibe el foco y la tarjeta sale de la lista | | H26 |

### 3.2 Precios

| # | Qué hacer | Resultado esperado | ✅/❌ | Notas |
|---|-----------|--------------------|-------|-------|
| V1 | Ver el precio de $150 sobre una mediana de $3.950 (de P5) | «Reportado $150 · mediana $3.950 (**−96 %**)»: signo **menos** | | H25 |
| V2 | Una tarjeta de precio mayor a la mediana | Signo **más** | | H25 |
| V3 | Aprobar o descartar con motivo | «Decisión registrada»; el aporte del reportante cambia de estado | | H34 |
| V4 | Elegir «Observar cuentas» | La opción dice que **suspende 7 días** y pide confirmar antes de enviar | | H33 |
| V5 | Confirmar «Observar cuentas» | La cuenta queda suspendida y ve el motivo | | |
| V6 | Apelación de un aporte descartado | Aparece con el motivo del autor, sin decir quién descartó | | |
| V7 | Decidir un reporte **propio** | Dice que lo decide otro moderador | | |

### 3.3 Tiendas

| # | Qué hacer | Resultado esperado | ✅/❌ | Notas |
|---|-----------|--------------------|-------|-------|
| W1 | Tienda propuesta por la comunidad | Muestra tipo, dirección, mapa y posibles duplicados con su distancia | | |
| W2 | Propuesta fuera del Quindío | Marcada «Fuera del Quindío» | | |
| W3 | Tienda nueva registrada por un comercio (de M11) | Muestra «Quien la pide» (responsable, teléfono, NIT o «Sin NIT») | | H5 |
| W4 | La misma tarjeta | Avisa: «Aprobarla verifica a esta cuenta como comercio y le da el rol de comercio.» | | H5 |
| W5 | Tienda registrada como Armenia con ubicación de La Tebaida | «La ubicación parece de La Tebaida, pero se registró como Armenia.» | | H16 |
| W6 | Tienda en la frontera entre dos municipios | **No** avisa (margen de 3 km) | | H16 |
| W7 | Aprobar como tienda nueva | La cuenta pasa a comercio y el botón «Precios oficiales» aparece | | |
| W8 | Fusionar con un posible duplicado | Solo se ofrece si hay uno cercano | | |
| W9 | Rechazar con motivo | La cuenta ve el motivo y puede registrar otra | | |
| W10 | Corrección de nombre o ubicación pedida por un comercio | Muestra el valor actual y el propuesto | | |

### 3.4 Productos y Roles

| # | Qué hacer | Resultado esperado | ✅/❌ | Notas |
|---|-----------|--------------------|-------|-------|
| D1 | Aprobar un producto propuesto | Queda en el catálogo | | |
| D2 | Cambiar la foto de un producto | Se actualiza | | |
| D3 | «Roles» con el correo vacío | «Escribe el correo de la cuenta.» | | |
| D4 | Cambiar **tu propio** rol | «No puedes cambiar tu propio rol: lo cambia otro moderador.» | | |
| D5 | Cambiar el rol de otra cuenta con motivo | Se aplica y queda en la bitácora | | |

### 3.5 Comercios: casos

| # | Qué hacer | Resultado esperado | ✅/❌ | Notas |
|---|-----------|--------------------|-------|-------|
| Q1 | Denuncia (de M15) | Muestra al comercio, su responsable, NIT, teléfono y estado | | |
| Q2 | La misma denuncia | Dice «N denuncias abiertas de M cuentas distintas» y desde cuándo; **no** quién denunció | | H18 |
| Q3 | Disputa (de M12) | Dos grupos: «Dueño actual» y «Quien disputa» (responsable, teléfono, NIT, desde cuándo) | | H18 |
| Q4 | Disputa abierta antes de que se guardaran esos datos | Dice que no hay datos de quien disputa | | H18 |
| Q5 | «Revocar» sin motivo | «Escribe el motivo: al menos 10 letras» | | |
| Q6 | Revocar con motivo | «Decisión registrada»; precios oficiales y promociones desaparecen; la cuenta vuelve a reportante | | |
| Q7 | «Descartar caso» con motivo | La cola queda vacía y no cambia nada para el comercio | | |
| Q8 | Reclamo de un supermercado que no es de cadena | Opciones «Aprobar reclamo» y «Rechazar reclamo» (no revocar ni descartar) | | H11 |

### 3.6 Comercios: lista de comercios verificados

| # | Qué hacer | Resultado esperado | ✅/❌ | Notas |
|---|-----------|--------------------|-------|-------|
| Z1 | Bajar hasta «Comercios verificados» | Cada comercio: tienda (con enlace a su ficha), responsable, NIT o «Sin NIT», teléfono y «Verificado el…» | | H14 |
| Z2 | Con más de 100 comercios | Dice «Se muestran los 100 más recientes de N» | | H14 |
| Z3 | Sin comercios verificados | «No hay comercios verificados» | | |
| Z4 | Revocar uno **sin que exista una denuncia** | Pide motivo y una confirmación que dice qué se retira | | H14 |
| Z5 | Confirmar | «Decisión registrada: …»; el comercio sale de la lista; el foco va al aviso | | |
| Z6 | Después, con la cuenta del comercio | Vuelve a reportante, el portal queda bloqueado y su precio oficial ya no está en la ficha | | |
| Z7 | Revocar a alguien ya revocado desde otra sesión | «Este comercio ya no está verificado. Actualiza la lista.» | | |
| Z8 | Apagar la red y recargar la pestaña | «No pudimos cargar los comercios verificados» con «Reintentar»; la cola de casos sigue | | |
| Z9 | Cuentas de la lista | En ninguna parte aparece el correo ni la cuenta del comercio | | EC-08 |

---

## 4. Flujos entre los tres perfiles

Cada flujo se hace de punta a punta con varias cuentas. Marca ✅ solo si **todos** los pasos salen bien.

### 4.1 De reportante a comerciante, con moderación

| Paso | Quién | Qué hace | Resultado esperado | ✅/❌ |
|------|-------|----------|--------------------|-------|
| F1.1 | Ana | Registra una tienda nueva (M11) | «Tu tienda quedó preaprobada»; sigue siendo Reportante | |
| F1.2 | Mod | Abre «Tiendas» | Ve la propuesta con «Quien la pide» y el aviso de que aprobar verifica a la cuenta (W3, W4) | |
| F1.3 | Mod | Aprueba como tienda nueva | «Decisión registrada» | |
| F1.4 | Ana | Recarga `/comercios/registro` | «Tu tienda quedó verificada»; el rol pasa a «Comercio» | |
| F1.5 | Ana | Publica un precio oficial y una promoción | Quedan vigentes y activas | |
| F1.6 | Beto | Abre la ficha de esa tienda | Ve «Comercio verificado», «Precio oficial» y la promoción con su «antes» | |
| F1.7 | Beto | Compara ese producto | El precio oficial entra a la comparación y la promoción sale aparte | |
| F1.8 | Mod | Abre «Comercios › Comercios verificados» | Ve la tienda de Ana con sus datos | |

### 4.2 Un precio falso no llega a ser «Más barato»

| Paso | Quién | Qué hace | Resultado esperado | ✅/❌ |
|------|-------|----------|--------------------|-------|
| F2.1 | Ana (comercio) | Publica $300 por 1 kg de arroz | Se rechaza (K7) | |
| F2.2 | Beto | Reporta $150 por 1 kg de arroz y confirma el aviso | Queda «en revisión» (P5) | |
| F2.3 | Carla | Compara el arroz | El de $150 **no** es el «Más barato» | |
| F2.4 | Mod | «Precios» | Ve $150 con el signo **menos** (V1) y decide | |
| F2.5 | Beto | `/mis-aportes` | El estado refleja la decisión, ya no «En revisión» | |
| F2.6 | Carla | Ficha de la tienda | No muestra el precio decidido como vigente | |

### 4.3 Disputa de propiedad

| Paso | Quién | Qué hace | Resultado esperado | ✅/❌ |
|------|-------|----------|--------------------|-------|
| F3.1 | Beto | Reclama la tienda de Ana estando en ella | Queda disputa abierta; no sale como error (M12) | 📱 |
| F3.2 | Beto | Vuelve a `/comercios/registro` | «Tienes una disputa abierta» (M13) | |
| F3.3 | Mod | «Comercios» | «Disputa de propiedad» con «Dueño actual» y «Quien disputa» (Q3) | |
| F3.4 | Mod | Descarta el caso con motivo | «Decisión registrada»; no cambia nada para Ana | |
| F3.5 | Beto | `/comercios/registro` | Ya no ve la disputa (los datos de quien disputó se borran al decidir) | |
| F3.6 | Ana | Su portal | Sigue funcionando con todo intacto | |

### 4.4 Denuncia y revocación

| Paso | Quién | Qué hace | Resultado esperado | ✅/❌ |
|------|-------|----------|--------------------|-------|
| F4.1 | Beto | Denuncia la tienda de Ana con motivo válido (M15) | «Denuncia recibida» | |
| F4.2 | Carla | Denuncia la misma tienda | «Denuncia recibida» | |
| F4.3 | Mod | «Comercios» | «2 denuncias abiertas de 2 cuentas distintas» (Q2) | |
| F4.4 | Mod | Revoca con motivo | «Decisión registrada» | |
| F4.5 | Ana | Recarga | Vuelve a Reportante; el portal está bloqueado; ve el mensaje estándar, **no** la nota del moderador (X1) | |
| F4.6 | Carla | Ficha de la tienda | Sin «Comercio verificado», sin precio oficial ni promoción | |
| F4.7 | Ana | Intenta reclamar la misma tienda | Se lo impide el servidor (X2) | |

### 4.5 Revocación por iniciativa de moderación

| Paso | Quién | Qué hace | Resultado esperado | ✅/❌ |
|------|-------|----------|--------------------|-------|
| F5.1 | Mod | «Comercios › Comercios verificados»: revoca a Ana sin denuncia previa (Z4, Z5) | La lista la quita | |
| F5.2 | Ana | Recarga | Igual que F4.5 | |
| F5.3 | Mod | Repite la revocación desde otra pestaña | «Este comercio ya no está verificado» (Z7) | |

### 4.6 Dejar la tienda y que otro la tome

| Paso | Quién | Qué hace | Resultado esperado | ✅/❌ |
|------|-------|----------|--------------------|-------|
| F6.1 | Ana | «Dejar de administrar esta tienda» (L1 a L3) | La cuenta vuelve a Reportante | |
| F6.2 | Beto | Ficha de la tienda | Sin «Comercio verificado»; la tienda sigue en el mapa | |
| F6.3 | Beto | La reclama estando en ella | Queda verificada al instante (si no es de cadena) | 📱 |
| F6.4 | Mod | «Comercios verificados» | Aparece Beto, no Ana | |

### 4.7 Tienda con municipio que no cuadra

| Paso | Quién | Qué hace | Resultado esperado | ✅/❌ |
|------|-------|----------|--------------------|-------|
| F7.1 | Ana | Registra una tienda nueva con el municipio por defecto (Armenia) estando en La Tebaida | La registra | 📱 |
| F7.2 | Mod | «Tiendas» | Ve «La ubicación parece de La Tebaida, pero se registró como Armenia.» (W5) | |
| F7.3 | Mod | Rechaza o aprueba | La decisión es de la persona, no automática | |

### 4.8 Eliminar la cuenta de un comercio

| Paso | Quién | Qué hace | Resultado esperado | ✅/❌ |
|------|-------|----------|--------------------|-------|
| F8.1 | Ana (comercio) | Programa la eliminación de su cuenta | La pantalla dice qué pasa con su tienda (L9) | |
| F8.2 | Carla | Ficha de la tienda durante los 10 días | Anota qué ve: ¿sigue «Comercio verificado» y el precio oficial? | |
| F8.3 | Ana | Restaura la cuenta | Vuelve como comercio con todo intacto (L10) | |
| F8.4 | (con la base) | Adelantar la purga a los 10 días | Anota qué pasa con la tienda y su precio oficial: **este caso no está verificado** | ➖ |

---

## 5. Privacidad (EC-08)

Estas filas se revisan en las respuestas de red (DevTools › Network) y en pantalla.

| # | Qué verificar | Resultado esperado | ✅/❌ |
|---|---------------|--------------------|-------|
| PR1 | Ninguna respuesta pública (ficha, comparación, mapa, historial) trae correo, identificador ni ubicación de quien reportó | Ausentes | |
| PR2 | La ubicación al reportar un precio o al reclamar una tienda | No se guarda; solo se usa en el momento | |
| PR3 | La lista «Comercios verificados» y las tarjetas de moderación | No muestran correo ni cuenta; solo los datos del comercio que la persona escribió | |
| PR4 | La denuncia en moderación | Dice cuántas denuncias y de cuántas cuentas, pero no cuáles | |
| PR5 | `/privacidad` | Menciona los datos de comercio y que los de quien disputa solo los ve moderación y se borran al decidir | |
| PR6 | La cuenta revocada | No ve la nota interna del moderador | |
| PR7 | Eliminar la cuenta | Tras 10 días no quedan correo, nombre ni contraseña; los aportes quedan sin nombre | |

---

## 6. Accesibilidad (WCAG 2.2 AA)

Hazlo por cada panel: reportante, comerciante y moderador. Una columna por panel permite ver dónde falla.

| # | Qué verificar | Cómo | Reportante | Comerciante | Moderador |
|---|---------------|------|------------|-------------|-----------|
| AC1 | Primer Tab: «Saltar al contenido» y lleva el foco al contenido | Tab y Enter | | | |
| AC2 | Todo se puede hacer **solo con teclado** | Tab, Shift+Tab, Enter, espacio, flechas | | | |
| AC3 | El foco siempre es visible | Contorno de 2 px o más | | | |
| AC4 | Tras cada acción el foco queda en un lugar lógico, nunca en `<body>` | Buscar, publicar, retirar, decidir, enviar | | | |
| AC5 | Los errores se ligan al campo que falla (`aria-invalid` y descripción) y el foco va al primero | Enviar formularios con errores | | | |
| AC6 | Un aviso de resultado a la vez, junto a la acción | Publicar y retirar | | | |
| AC7 | Los resultados de una búsqueda se anuncian («20 resultados») | Con lector de pantalla | | | |
| AC8 | Contraste de texto de 4,5:1 (3:1 en texto grande) | Tema claro **y** oscuro | | | |
| AC9 | Objetivos táctiles de 44 px o más | Ventana de 390 px | | | |
| AC10 | Sin desbordamiento horizontal a 390 px y con zoom al 200 % | Redimensionar | | | |
| AC11 | Un solo `h1` por pantalla y `lang="es-CO"` | Inspeccionar | | | |
| AC12 | No depende solo del color (insignias con icono y texto) | Escala de grises | | | |
| AC13 | Lector de pantalla real (NVDA, VoiceOver o TalkBack) en el recorrido principal | Una persona con el lector | | | |
| AC14 | Las pestañas se anuncian como pestañas («2 de 4») y cambiar de pestaña se anuncia | Lector de pantalla | | | |
| AC15 | Los diálogos de confirmación («Revisa el precio», confirmar revocación) mueven el foco a ellos | Teclado | | | |

---

## 7. Instalación, rendimiento y navegadores

| # | Qué verificar | Resultado esperado | ✅/❌ |
|---|---------------|--------------------|-------|
| I1 | Instalar la PWA en el teléfono (`/yo/app`) | Se instala y abre sin la barra del navegador | |
| I2 | Abrir la app instalada sin conexión | Abre y dice qué necesita conexión | |
| I3 | Aviso de versión nueva tras un despliegue | Ofrece actualizar, no actualiza a escondidas | |
| I4 | Primera carga tras un rato sin usar el servicio | Puede tardar unos segundos (arranque en frío del servidor), pero muestra «Cargando…» | |
| I5 | Chrome, Firefox y Safari (o Edge) | El recorrido principal funciona en cada uno | |

---

## 8. Cómo probar con Claude en Chrome

Claude puede recorrer las pantallas en Chrome, leer su estructura (roles, etiquetas, orden del foco),
medir contraste, revisar el tamaño de los objetivos, redimensionar a 390 px, leer la consola y la red
y tomar capturas. **No** reemplaza lo que dice «una persona con el lector de pantalla» ni el GPS real.

Condiciones:

- La app debe estar corriendo con los cambios de `dev`: o bien `valoora.app` ya desplegado desde `main`
  con la migración `0053` aplicada, o bien en local (`pnpm dev` en los dos repositorios, base `valora_dev`).
- **Las sesiones las inicias tú.** Claude no escribe contraseñas: inicia sesión con cada cuenta en una
  pestaña de Chrome y avísale cuál es cuál.
- Pasa a Claude esta tabla ya con tus ✅/❌ si quieres que se enfoque en lo que falló o quedó en ➖.

| Qué puede revisar Claude en Chrome | Filas |
|------------------------------------|-------|
| Estructura, foco y teclado de las tres secciones | 6 (AC1 a AC6, AC11, AC14, AC15) |
| Contraste en tema claro y oscuro | AC8 |
| Tamaño de objetivos y diseño a 390 px | AC9, AC10 |
| Recorridos de punta a punta con las cuentas ya abiertas | 1, 2, 3 y 4 |
| Consola sin errores y respuestas de red sin datos personales | PR1, PR3, PR4 |

---

## 9. Registro de hallazgos

| # | Fila del plan | Qué pasó | Qué se esperaba | Severidad (alta, media, baja) | Captura o enlace | Estado |
|---|---------------|----------|-----------------|-------------------------------|------------------|--------|
| 1 | | | | | | |
| 2 | | | | | | |
| 3 | | | | | | |

## 10. Lo que este plan **no** cubre (a propósito)

- **Usabilidad con personas reales**: al menos cinco comerciantes y tres moderadores con tareas
  cronometradas (registrar la tienda, publicar un precio, atender una disputa). Ver
  [`prueba-usabilidad.md`](prueba-usabilidad.md).
- **Auditoría de UI/UX independiente** de los módulos de comerciante y de moderación.
- **Carga y seguridad**: se prueban aparte.
- **El resultado de una disputa para quien disputó**: tras decidirla, sus datos se borran por
  privacidad y la pantalla no dice si se descartó o prosperó.
