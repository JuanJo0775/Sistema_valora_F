# Integración con backend

## Fuente de verdad

El backend mantiene el contrato OpenAPI 3.x en su repositorio: [Sistema_valora_B](https://github.com/JuanJo0775/Sistema_valora_B).

El frontend debe consumir el contrato vigente, no mantener una segunda especificación independiente.

## Convenciones aprobadas

- REST sobre HTTPS, JSON.
- Versionado `/v1`.
- Dos superficies lógicas: consumidor/reportante y portal de comercios.
- Sesión de servidor con cookie segura y protección CSRF según ADR-014.
- Los cambios de API se coordinan mediante PRs en backend y frontend.
- No asumir JWT bearer en frontend: la decisión aprobada es sesión administrada por servidor.

## Integración de reportes

- Cada reporte incluye una clave de idempotencia estable en todos los reintentos.
- El cliente conserva `observedAt` al crear el reporte offline.
- El backend devuelve un estado explícito de aceptación/sincronización.
- La UI no marca como sincronizado hasta recibir confirmación del servidor.

## Privacidad

- Ningún componente público recibe identidad o ubicación personal del reportante.
- La API puede devolver ubicación del establecimiento, que es distinta de la ubicación del reportante.
- Los aportes privados se consultan con sesión y autorización.

## Estado

Este documento define reglas de integración. No representa endpoints implementados ni contrato OpenAPI ya disponible en el backend.
