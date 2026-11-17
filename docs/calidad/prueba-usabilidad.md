# Prueba de usabilidad del registro de un precio — EC-01 (#28, MC-E4)

Guía práctica para aplicar el **protocolo de MC-E4 en Notion** con la app real. Si este archivo y Notion no coinciden, manda Notion. Mide si una persona registra un precio en **15 segundos o menos**.

## Metas (issue #28 y protocolo de MC-E4 en Notion)

| Métrica | Meta |
|---|---|
| Participantes | al menos 8 (meta 10) |
| Intentos por participante | 3 |
| Tiempo | 15 s o menos en al menos el **80 %** de los intentos |
| Efectividad | al menos el **90 %** de los intentos terminan con «Recibido» o «Guardado en tu teléfono» |
| Satisfacción | SUS promedio de **68 o más** |

## Antes de empezar

1. Usa un celular con la app instalada (PWA) o abierta en el navegador, con una cuenta reportante de prueba creada para la sesión. Nunca uses la cuenta personal del participante.
2. En **Yo → Ajustes**, enciende **«Modo prueba de usabilidad»**. Al registrar aparece un cronómetro arriba a la derecha y, al terminar, «Registrado en N s.».
3. Revisa que el arroz de 500 g, el aceite de 1 litro y los huevos por docena estén en el catálogo, y que haya una tienda cercana.
4. Lee al participante: *«Vamos a probar la app, no a ti. No hay respuestas malas. Piensa en voz alta si quieres. No te voy a ayudar mientras lo haces.»*
5. **Consentimiento verbal:** es voluntario, se evalúa la app y no a la persona, y puede parar cuando quiera. Se anota solo un código (P01, P02…), el rango de edad y la experiencia con el celular; nunca el nombre, el teléfono ni la ubicación (EC-08).
6. **Muestra:** personas que hacen mercado en el Quindío y no conocen Valora. No sirven los integrantes del equipo. Al menos 2 personas de 45 años o más.

## Tareas

Son las del protocolo de MC-E4 en Notion, que manda. Cada tarea se lee en voz alta, sin decir dónde tocar. El tiempo va desde que la persona toca «+ Registrar precio» hasta que ve la confirmación: lo marca el cronómetro.

1. **Registro 1:** «Estás en la tienda más cercana. El arroz de 500 g cuesta $3.200. Registra ese precio.»
2. **Registro 2:** «El aceite de 1 litro cuesta $9.800 en la misma tienda. Regístralo.»
3. **Registro 3:** «Una docena de huevos cuesta $7.500. Regístrala.»
4. **Sin señal** (no cuenta para el tiempo): con el celular en **modo avión**, registrar un precio y decir qué cree que pasó con él. La app lo guarda en el teléfono y lo envía al volver la señal (EC-07).
5. **Consulta** (no cuenta para el tiempo): «¿Dónde está más barato el aceite?»

Las tareas 1 a 3 son los 3 intentos que se miden. Por cada uno anota:
- el tiempo que dice «Registrado en N s.»;
- si terminó sin ayuda (sí o no);
- los errores: toques equivocados, campos corregidos o retrocesos.

Si la persona se bloquea 60 s o pide ayuda, el intento cuenta como **no completado**. Las tareas 4 y 5 se anotan como observaciones.

## Cuestionario SUS (al final, una vez)

Responde de 1 («totalmente en desacuerdo») a 5 («totalmente de acuerdo»):

1. Creo que me gustaría usar esta app con frecuencia.
2. Encontré la app innecesariamente compleja.
3. Pensé que la app era fácil de usar.
4. Creo que necesitaría ayuda de una persona con conocimientos técnicos para usarla.
5. Encontré que las funciones de la app estaban bien integradas.
6. Pensé que había demasiadas inconsistencias en la app.
7. Imagino que la mayoría de las personas aprenderían a usarla muy rápido.
8. Encontré la app muy difícil de usar.
9. Me sentí muy seguro usando la app.
10. Necesité aprender muchas cosas antes de poder usar la app.

## Anotar y calcular

1. Llena `docs/calidad/usabilidad-resultados.csv`, una fila por intento, con las columnas `participante,intento,segundos,terminado,sus1,…,sus10,notas`. Las respuestas del SUS van solo en la fila del intento 1 de cada participante.
2. Corre `node scripts/resumen-usabilidad.mjs docs/calidad/usabilidad-resultados.csv`. Da:
   - el % de intentos en 15 s o menos;
   - la efectividad;
   - el tiempo mediano;
   - el SUS de cada persona y el promedio;
   - si cada meta se cumple.
3. Pasa el resultado, los hallazgos y las correcciones al informe de MC-E4 en Notion.

## Al terminar la #28

Quitar el **modo prueba de usabilidad** de la app (decisión de la usuaria del 16-nov-2026): el interruptor en Yo, el cronómetro y `src/shared/usabilityMode.ts`.
