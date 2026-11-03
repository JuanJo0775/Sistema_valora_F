# Registro offline-first

## Alcance aprobado

La PWA mantiene una cola local persistente para **registrar precios** sin conexión. La consulta y comparación de precios requieren conectividad. No se promete una aplicación completamente offline.

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

## Criterio medible del proyecto

La prueba definida para RNF-013/EC-07 contempla 50 registros de prueba:
- 100 % sincronizados tras recuperar conexión.
- 0 duplicados.
- p95 de confirmación de 60 segundos o menos tras reconexión.

Esto es un criterio de aceptación futuro, no un resultado obtenido.

## Límites del navegador

La sincronización en segundo plano puede estar limitada por navegador o sistema operativo. La interfaz debe informar si se requiere abrir la aplicación para reanudar el envío. No asumir que el navegador mantendrá procesos en segundo plano de forma permanente.

## Seguridad

- No almacenar contraseñas ni tokens secretos en la cola.
- Minimizar datos personales almacenados localmente.
- Proteger el acceso a aportes del usuario autenticado.
- Evitar coordenadas personales persistidas en el reporte; la ubicación del establecimiento sí es un dato del dominio.
