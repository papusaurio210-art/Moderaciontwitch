# Overlay Studio

Editor colaborativo de overlays para OBS. El streamer añade una **Fuente de navegador** y los editores organizan las imágenes desde un panel web. La cámara sigue siendo una fuente normal del OBS del streamer.

## Primera entrega

- Crear salas protegidas con una clave de administración.
- Compartir enlaces distintos para editar y visualizar. El visor no puede modificar la sala.
- Subir PNG, JPG y WebP, reutilizarlos desde la biblioteca y organizarlos por capas.
- Mover, redimensionar, rotar, ocultar, bloquear y ajustar la opacidad de las imágenes.
- Colaborar en tiempo real y recuperar el estado al reconectar.
- Mostrar un overlay transparente de 1920 × 1080, recortado al escenario.
- Conservar las operaciones confirmadas en SQLite de Durable Objects y los archivos en R2.

Esta entrega está desarrollada para ejecutarse localmente sin una cuenta de Cloudflare. El despliegue público y la comprobación dentro de OBS requieren una etapa posterior. Todavía no incluye vídeo, GIF, texto editable, temporizadores, chat de Twitch, historial de deshacer, gestión de usuarios ni revocación de enlaces.

## Desarrollo local

Requisitos: Node.js 24 recomendado (`.nvmrc`), npm y Chromium para las pruebas de navegador.

```sh
npm ci
npm run setup:local
npm run dev
```

El servidor utiliza el puerto **8787**. Vite ejecuta tanto React como el Worker; Durable Objects y R2 se emulan con el runtime local de Cloudflare. No se necesita iniciar sesión en Cloudflare.

`setup:local` crea `.dev.vars` con una clave aleatoria `ADMIN_SECRET` si todavía no existe. Usa su valor en el formulario «Crear estudio». Es una clave de esta aplicación, independiente de las credenciales de Cloudflare. El archivo está excluido de Git y el script conserva una configuración existente.

Guarda el enlace de edición de la sala. La clave va en el fragmento del enlace del editor y se envía al servidor en el mensaje inicial del WebSocket. El enlace del visor utiliza una clave distinta y solo permite leer; se puede recuperar desde el panel de edición.

Los datos locales se guardan en `.wrangler/state`. Conservar esa carpeta permite recuperar salas e imágenes tras reiniciar. Los procesos deben volver a iniciarse en cada sesión. No borres la carpeta para resolver errores de instalación: contiene los datos locales.

## Uso en OBS

Cuando la aplicación tenga una dirección accesible desde el equipo del streamer:

1. Abre la sala y pulsa **Copiar enlace OBS**.
2. En OBS, añade una **Fuente de navegador** y pega el enlace.
3. Configura el tamaño en **1920 × 1080** y colócala en el orden apropiado de la escena.
4. Edita desde el panel. Las imágenes se actualizan en el visor; lo que quede fuera del escenario se recorta.

La cámara, el audio y las escenas se administran en OBS. La aplicación no solicita acceso a la cámara ni utiliza OBS WebSocket. El contador «visores» indica conexiones abiertas al overlay; no confirma que OBS esté emitiendo.

## Comprobaciones

```sh
npm run typecheck
npm test
npm run test:e2e
npm run test:persistence
```

Si no tienes Chromium del sistema, ejecuta `npx playwright install chromium`. También puedes indicar su ruta con `CHROMIUM_PATH`. Las pruebas de navegador compilan y arrancan su propio servicio con Wrangler en el puerto 8790 y utilizan almacenamiento separado del desarrollo. Las capturas quedan en `test-results/`.

La prueba de persistencia compila el proyecto, arranca un servidor aislado en el puerto 8791, crea una sala e imagen, detiene el proceso y lo reinicia. Comprueba que la revisión, los elementos y los bytes de R2 sobrevivan; verifica también las cabeceras de los recursos y que los archivos privados no se publiquen. Elimina únicamente el almacenamiento temporal que ella misma creó.

Para compilar y ejecutar la versión de producción local, detén el servidor de desarrollo y ejecuta:

```sh
npm run build
npm run preview
```

`preview` usa Wrangler con los recursos compilados. Las pruebas usan este mismo recorrido: en la versión instalada del intermediario WebSocket de Vite, el cierre visible en el navegador de una conexión que nunca envía `hello` se retrasa; Wrangler sí completa el cierre dentro del plazo de la prueba. El servidor rechaza la autenticación tardía en ambos casos.

## Arquitectura y límites

`src/client/` contiene el panel, el lienzo, el visor y la conexión WebSocket. `src/shared/` define los mensajes y el modelo compartido. `src/worker/` valida accesos, sube imágenes a R2 y mantiene una instancia de `Room` por sala.

Cada operación confirmada obtiene una revisión consecutiva y se guarda antes de notificarse. El movimiento durante un arrastre se transmite como previsualización temporal; al soltar se guarda el resultado. Si el editor abandona el arrastre, la previsualización caduca y el visor recupera la última posición confirmada. Ante un salto de revisión o una reconexión se solicita el estado completo. Si dos editores modifican el mismo campo, prevalece la última operación recibida por la sala.

Se permiten hasta 500 elementos, 500 archivos, 500 MiB de biblioteca por sala, 25 MiB por imagen y 16384 píxeles por lado. Las subidas comprueban firmas PNG/JPEG/WebP; el navegador comprueba que pueda decodificar el archivo. El servidor no vuelve a decodificar ni reescalar imágenes y las dimensiones declaradas se validan por rango. Los archivos se sirven mediante rutas aleatorias con caché pública: están destinados a gráficos del directo. Quitar un elemento del escenario conserva su archivo en la biblioteca; la eliminación de archivos queda pendiente.

Los enlaces conceden acceso a quien los tenga. Guarda el enlace de edición y comparte el del visor solo donde sea necesario. El servidor almacena hashes de las claves; no hay todavía cuentas, recuperación administrativa ni rotación de claves. No se registran claves deliberadamente ni se habilita observabilidad del Worker en producción. El cliente usa fuentes locales y una política de referencia `no-referrer`.

## Despliegue posterior en Cloudflare

El proyecto incluye `wrangler.jsonc`, la migración SQLite del Durable Object `Room` y el enlace R2 `MEDIA`. Cuando se disponga de acceso a la cuenta:

```sh
npx wrangler login
npx wrangler r2 bucket create overlay-media
npx wrangler secret put ADMIN_SECRET
npm run deploy
```

Usa una clave de administración de producción y verifica los recursos y costes de la cuenta antes del despliegue. `.dev.vars` solo configura el entorno local. La salida de compilación del Worker puede contener una copia local de ese archivo para `preview`; `dist/` está excluido de Git y los archivos públicos están limitados a `dist/client/`.

Tras desplegar falta verificar creación de salas, subida real a R2, reconexión y renderizado en la Fuente de navegador de OBS. Estas instrucciones preparan esa fase; no implican que el servicio ya esté publicado.
