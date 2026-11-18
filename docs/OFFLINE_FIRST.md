# Registro offline-first

## Alcance aprobado

La PWA mantiene una cola local persistente para **registrar precios** sin conexión. La consulta y comparación de precios requieren conectividad. No se promete una aplicación completamente offline.

Un plan de compra guardado (propuesta ADR-032) está pensado para leerse sin conexión: es un documento fechado que la persona guardó en su teléfono, no una consulta. **Pendiente de comprobar** con una prueba de red cortada en el navegador (hoy solo hay pruebas unitarias; depende del respaldo de rutas del service worker). Armar el plan de nuevo con precios de hoy sí requiere conexión.

## Tecnología (ADR-017)

- **vite-plugin-pwa (Workbox):** genera el manifest, registra y actualiza el service worker y guarda en caché los archivos de la aplicación.
- **IndexedDB con `idb`** (decidido el 16-nov-2026, #26): guarda los reportes pendientes de envío (ADR-010). Se eligió `idb` (unos 1,2 KB, tipado, solo convierte IndexedDB a promesas) porque la cola solo guarda, lista y borra; Dexie ofrece consultas y esquemas que no hacen falta, y sin biblioteca habría que escribir a mano la conversión a promesas. Las pruebas usan `fake-indexeddb`.
- **Lógica de la aplicación:** la cola, los reintentos y la idempotencia son código propio del frontend junto con la API; el plugin PWA no los resuelve.

## Comportamiento esperado

1. Al iniciar un registro, crear un identificador único y una clave de idempotencia.
2. Guardar el registro en almacenamiento local persistente antes de intentar enviarlo.
3. Conservar por separado:
   - `observedAt`: hora real de observación del precio.
   - `syncedAt`: hora en que el servidor recibe/procesa el registro.
4. Si hay conexión, enviar a la API.
5. Si no hay conexión o falla el envío, mantener el elemento en cola y mostrar estado pendiente.
6. Al recuperar conectividad, reintentar con la misma clave de idempotencia.
7. Si el servidor confirma el registro, marcarlo sincronizado y no volver a crearlo.
8. Un reporte tardío no debe reemplazar un reporte más reciente según `observedAt`.

## Qué hace la cola con cada respuesta (#9)

Cada reporte se envía a `POST /v1/reports` uno por petición (no hay ruta de lotes), del más antiguo al más nuevo, siempre con su `Idempotency-Key` y su mismo cuerpo.

| Respuesta | Qué hace la cola | Estado que ve la persona |
| --- | --- | --- |
| 201 o 200 | Confirmado: no se vuelve a enviar. Guarda `syncedAt`. | Enviado |
| 400, 409, 422 o 429 | Final: no se reenvía (su hora de observación no cambia, así que no pasará) y avisa por qué con los mensajes de la #11. Se puede descartar. | Requiere atención |
| 401 o 403 | Espera la sesión. Al iniciarla, reintenta con la misma clave. | Por enviar, con «Inicia sesión para enviarlos» |
| Sin red o 5xx | Reintenta después con la misma clave. Se detiene en ese reporte: si el servidor no contesta a uno, tampoco a los siguientes. | Por enviar |

Desde el registro, con red: si el servidor lo rechaza, el motivo se muestra en el formulario y el reporte sale de la cola; una cuenta suspendida no espera, porque no alcanzaría a enviarlo en 24 horas.

## Cuándo se sincroniza

- Al abrir la app.
- Al volver la red (evento `online`).
- Cada 30 segundos mientras la app está abierta (5xx con la red arriba).
- Al iniciar sesión, si esperaba la sesión.

Una sola sincronización a la vez: las que coinciden esperan la que está en curso. El estado «sincronizando» no se guarda: si la app se cierra a mitad de un envío, el reporte sigue «por enviar» y se reenvía con la misma clave.

## Registrar sin señal

- **Catálogo en caché:** el detalle de un producto ya abierto (`GET /v1/products/{id}`) se guarda con «red primero» (Workbox). Precios, historial, búsqueda y tiendas cercanas siempre van a la red: ADR-010 se mantiene para los precios.
- **Tienda:** la última usada (en `localStorage`, solo la tienda y sin distancia).
- **Sesión:** sin red no se sabe si la sesión sigue. Si la última vez entró como reportante (se guarda solo el rol, que no es secreto), «Registrar precio» se abre con el aviso «Sin conexión: tu reporte se guardará en el teléfono y se enviará solo». El rol se olvida al cerrar sesión o con un 401. El servidor verifica la sesión al sincronizar.

## Versión nueva

La app no se actualiza a escondidas (`registerType: 'prompt'`): avisa «Hay una versión nueva de Valora» y se actualiza al tocar «Actualizar».

## Criterio medible del proyecto

La prueba definida para RNF-013/EC-07 contempla 50 registros de prueba:
- 100 % sincronizados tras recuperar conexión.
- 0 duplicados.
- p95 de confirmación de 60 segundos o menos tras reconexión.

La lógica de la cola tiene una prueba con 50 reportes y un corte de red a mitad del envío (`src/pwa/reportQueue.spec.ts`): 100 % confirmados y 0 duplicados. La medición formal con el navegador y el backend local (incluido el p95) va en la #27.

## Límites del navegador

La sincronización en segundo plano puede estar limitada por navegador o sistema operativo. La interfaz debe informar si se requiere abrir la aplicación para reanudar el envío. No asumir que el navegador mantendrá procesos en segundo plano de forma permanente.

## Seguridad

- No almacenar contraseñas ni tokens secretos en la cola.
- Minimizar datos personales almacenados localmente.
- Proteger el acceso a aportes del usuario autenticado.
- Evitar coordenadas personales persistidas en el reporte; la ubicación del establecimiento sí es un dato del dominio.
