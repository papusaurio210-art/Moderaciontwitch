# Validación local de estabilidad para la v1

Resultado: **181 pruebas unitarias y dos escenarios de carga aprobados**, con compilación y comprobación de tipos. Esta entrega incorpora una suite reproducible; la aplicación evaluada parte del commit `f0d44f0`.

## Entorno y alcance

- Linux, Node.js v24.19.0, Chromium 154.0.8037.57 sin interfaz y Wrangler local.
- Tres paneles de edición en contextos de navegador independientes y un visor. Todos ejecutados en una misma máquina, sin tráfico por internet.
- Escenario de 100 elementos: 40 figuras, 30 textos, 20 imágenes, seis vídeos y cuatro cronómetros activos.
- Los seis vídeos reutilizan un archivo sintético H.264 de 1280 × 720, 30 fps, cuatro segundos, en bucle y sin audio. Los tres paneles también reproducen sus vistas previas silenciadas: son 24 elementos de vídeo entre los cuatro clientes.
- Un minuto de observación, 60 cambios repartidos entre los tres editores y un cambio adicional mientras un editor está desconectado.

## Resultados observados

| Medición | Resultado |
|---|---:|
| Preparar las cuatro páginas y comenzar los seis vídeos del visor | 6.45 s |
| Confirmación de cambios: mediana / percentil 95 / máximo (61 muestras) | 164.7 / 454.4 / 563.0 ms |
| Ronda de tres ediciones hasta comprobar el visor: percentil 95 (20 rondas) | 2.89 s |
| Reconectar un editor y recuperar el estado confirmado | 0.81 s |
| Intervalo de animación del visor: mediana / percentil 95 | 16.7 / 50.0 ms |
| Fotogramas descartados, según el vídeo | 3.4–6.4 % |
| Mover 500 figuras desde el panel y comprobarlas en el visor | 1.14 s |

Las confirmaciones se miden desde el envío WebSocket del panel hasta recibir su operación confirmada. Las rondas y la operación de 500 elementos incluyen automatización de teclado, trabajo del navegador y espera de comprobación; no representan latencia de red unidireccional. El percentil 95 utiliza el rango más próximo superior. Los valores corresponden a esta ejecución y varían con el equipo y la carga.

Los cuatro clientes terminaron con el mismo estado y revisiones consecutivas. El editor desconectado recuperó los cambios realizados durante su ausencia. Recargar el visor conservó los 100 elementos. Los seis vídeos avanzaron durante la observación y terminaron sin error de reproducción.

En el escenario de 500 figuras se rechazó el elemento 501 sin modificar la sala. Mover, deshacer, rehacer, eliminar el grupo completo y recuperarlo funcionó. Una conexión que envió una ráfaga de 240 mensajes repetidos se cerró con código 1008; los clientes legítimos siguieron editando y conservando su historial.

## Interpretación y pendientes

La sincronización superó el umbral de esta prueba: percentil 95 de confirmaciones inferior a 2500 ms, estados coincidentes y reproducción activa. Hubo fotogramas descartados: **esta prueba no certifica reproducción fluida a 30 o 60 fps en OBS**. No se ha atribuido esa pérdida a un fallo concreto de la aplicación; el ensayo concentra todos los clientes y decodificadores en un único entorno sin interfaz.

Antes de cerrar la v1, falta:

1. Validar en OBS real imágenes, GIF, vídeos con audio, volumen, ocultar/mostrar y temporizadores. Probar el número de vídeos y resoluciones que se utilizarán realmente, observando audio y estadísticas de renderizado de OBS.
2. Repetir la colaboración con streamer y editores en equipos y redes distintos. El despliegue y la prueba básica en navegador de la instalación pública ya se completaron; véase [la validación de producción](cloudflare-deployment.md).
3. Ejecutar una sesión prolongada con desconexiones y cambios continuos; un minuto no representa varias horas de directo.
4. Completar y verificar el procedimiento de respaldo y recuperación del almacenamiento de producción.

El límite de 500 elementos es una restricción del modelo, no una recomendación de 500 vídeos simultáneos. Las pruebas de carga no incluyen audio audible, tráfico de numerosos canales a la vez ni la latencia o cuotas de Cloudflare en producción.

## Repetir la prueba

Desde la raíz, con las dependencias instaladas, `npm run setup:local` ya ejecutado y Chromium disponible:

```sh
npm run test:load
```

En PowerShell puedes usar `npm.cmd run test:load`. Si falta Chromium, instala el navegador de pruebas con `npx.cmd playwright install chromium` o indica su ruta mediante `CHROMIUM_PATH`.

El puerto 8790 debe estar libre. La prueba utiliza `.wrangler/load-state`, separado de las salas de desarrollo. Cada ejecución genera salas de prueba nuevas. Las mediciones y la captura del visor quedan en `test-results/load/`; esa carpeta se reemplaza en la siguiente ejecución. No se escriben enlaces privados ni claves en los informes de métricas.
