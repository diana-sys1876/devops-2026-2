# Taller de Trazabilidad - Diana Ayala

## Objetivo
Medir el rendimiento del servicio ProductStore y del endpoint HTTP de Express, registrar los resultados y documentar los tiempos de las pruebas.

## Rama
trazabilidad-DianaAyala

## Rendimiento de los servicios

| Servicio | Operaciones | Promedio (ms) | P95 (ms) | Operaciones/s |
|---|---:|---:|---:|---:|
| ProductStore crear | 1000 | 0.027 | 0.0701 | 36214 |
| ProductStore buscar ID | 1000 | 0.0022 | 0.0032 | 386190 |
| ProductStore buscar SKU | 1000 | 0.0149 | 0.0307 | 65589 |
| ProductStore listar | 100 | 23.1169 | 32.283 | 43 |
| ProductStore actualizar | 1000 | 0.0023 | 0.0021 | 404416 |
| ProductStore stock | 1000 | 0.0014 | 0.0015 | 650576 |
| ProductStore eliminar | 1000 | 0.0002 | 0.0003 | 3461405 |
| Express HTTP health | 100 | 1.6498 | 3.4595 | 605 |

## Pruebas generales
- Total: 8
- Aprobadas: 8
- Fallidas: 0
- Duracion total: 2416.68 ms

## Pruebas ProductStore
- Total: 32
- Aprobadas: 32
- Fallidas: 0
- Duracion total: 1252.51 ms

## Comandos utilizados
- npm run typecheck
- npm run build
- npm run benchmark:service
- npm run test:timing
- npm run test:timing:productos
- npm run ci:timing

## Evidencias
Los resultados JSON y CSV se encuentran en docs/timing/evidencias.

## Alcance y limitaciones
Se evaluaron las operaciones del almacén ProductStore en memoria y el endpoint /health de Express. No se realizaron mediciones directas de PostgreSQL ni MongoDB.

La consulta de GitHub Actions no encontró ejecuciones accesibles en la rama de trazabilidad.

## Conclusiones
Las 40 pruebas ejecutadas fueron aprobadas. Se registraron tiempos de respuesta, percentil 95, throughput, CPU y memoria. Las mediciones permiten comparar el comportamiento de las operaciones del servicio bajo las condiciones de la prueba local.
