# Contribuir al frontend

## Flujo de trabajo

1. Revisa la épica, flujo y requisito asociado.
2. Crea una rama corta desde `main`: `feat/<tema>`, `fix/<tema>`, `test/<tema>` o `docs/<tema>`.
3. Implementa una unidad pequeña y accesible.
4. Añade pruebas de interacción y flujos cuando corresponda.
5. Abre un Pull Request y solicita revisión de otro integrante.
6. Fusiona a `main` solo cuando las comprobaciones estén satisfechas.

## Commits

Usar Conventional Commits con descripción concreta:

- `feat(comparison): add neutral price ordering view`
- `feat(reports): persist offline report queue`
- `test(reports): cover reconnect synchronization`
- `fix(a11y): label price input errors`

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
