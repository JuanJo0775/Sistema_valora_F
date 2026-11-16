# Contribuir al frontend

## Flujo de trabajo

1. Revisa la épica, flujo y requisito asociado.
2. Crea una rama corta desde `dev` actualizado: `feat/<tema>`, `fix/<tema>`, `test/<tema>`, `docs/<tema>`, `chore/<tema>` o `refactor/<tema>`.
3. Implementa una unidad pequeña y accesible, con la prueba primero cuando haya una regla o un comportamiento (commits separados: `test(…)` en rojo, `feat(…)` en verde).
4. Añade pruebas de interacción y flujos cuando corresponda.
5. Abre un pull request **hacia `dev`** (nunca hacia `main`) con `Closes #N`.
6. Quien abre el pull request puede mezclarlo solo con la CI en verde, con «Create a merge commit» (nunca «Squash and merge»). `main` solo recibe `dev` al cerrar una entrega.

## Commits

Usar Conventional Commits con descripción concreta:

- `feat(comparison): mostrar el orden con su criterio declarado`
- `feat(reports): guardar la cola de reportes en IndexedDB`
- `test(reports): al reconectar se envían los reportes sin duplicar`
- `fix(a11y): etiquetar los errores del campo de precio`

La descripción va en español. Ningún commit lleva líneas `Co-Authored-By` ni marcas de herramientas.

Cada integrante debe usar su propia cuenta GitHub para que el historial refleje su contribución individual.

## Reglas de producto

- Priorizar registro de precios rápido, con objetivo de 15 segundos y conectividad limitada.
- La cola offline cubre el registro, no la consulta de precios.
- Conservar la hora real de observación separada de la hora de sincronización.
- Reintentar sin duplicar mediante la clave de idempotencia acordada con backend.
- Un reporte tardío no debe reemplazar uno más reciente según hora de observación.
- Mostrar claramente estado pendiente, sincronizado o fallido.
- No exponer ubicación personal ni identidad del reportante en vistas públicas.
- Ordenar comparaciones solo por criterios declarados (precio por unidad o distancia); nunca por perfil comercial o promoción.
- Las promociones, si se implementan en el Corte 3, se muestran separadas del resultado de comparación.
- Cumplir WCAG 2.2 AA en flujos críticos.

## Definition of Done

- [ ] Requisito y criterio de aceptación enlazados.
- [ ] Diseño adaptable y estados de carga/error/vacío contemplados.
- [ ] Accesibilidad revisada.
- [ ] Pruebas ejecutadas y resultados registrados.
- [ ] Integración contra contrato OpenAPI vigente.
- [ ] Revisión de otro integrante.
- [ ] No se afirma funcionamiento offline ni prueba de usabilidad sin evidencia.
