# Prueba de usabilidad del registro de un precio — EC-01 (#28, MC-E4)

Protocolo para el equipo. Mide si una persona registra un precio en **15 segundos o menos**.

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
3. Ten listo un producto y una tienda de la semilla, por ejemplo «Arroz blanco · 500 g» en una tienda de Armenia. El precio lo dicta el moderador de la prueba.
4. Lee al participante: *«Vamos a probar la app, no a ti. No hay respuestas malas. Piensa en voz alta si quieres. No te voy a ayudar mientras lo haces.»*
5. **Consentimiento:** el participante acepta participar. No se guarda su nombre en los resultados, solo un código (P01, P02…).

## Tareas (3 intentos)

Cada intento empieza en el **Inicio**, con el cronómetro en 0:00. El cronómetro arranca al abrir «Registrar precio».

1. *«Viste el arroz Diana de 500 g a $2.500 en la tienda que te indico. Regístralo.»*
2. *«Ahora registra la leche de 1 l a $4.200 en la misma tienda.»* (Puede usar «Registrar otro en esta tienda».)
3. *«Registra los huevos ×30 a $16.200, que viste hace un rato.»* (Puede usar «Lo vi antes».)

Por cada intento anota:
- el tiempo que dice «Registrado en N s.»;
- si terminó (sí o no);
- los errores o dudas que viste (por ejemplo, «buscó la tienda dos veces»).

Si pasan 60 s sin terminar, el intento cuenta como **no terminado**.

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
