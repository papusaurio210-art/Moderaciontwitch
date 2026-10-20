# Overlay Studio

Overlay Studio permite crear y controlar los elementos visuales de tus transmisiones en OBS desde el navegador. Añade imágenes, videos, textos, figuras y temporizadores, acomódalos en pantalla y comparte la edición con tu equipo. Los cambios aparecen en OBS en tiempo real.

[**Abrir Overlay Studio**](https://stream-overlay-studio.willicer1313.workers.dev)

## Qué puedes hacer

- Subir imágenes, GIF y videos, y reutilizarlos desde una biblioteca.
- Añadir textos, figuras, cuentas regresivas y cronómetros.
- Mover, cambiar el tamaño, rotar, ocultar y ordenar los elementos por capas.
- Controlar la reproducción y el volumen de los videos.
- Copiar, duplicar y alinear elementos, además de deshacer y rehacer cambios.
- Elegir un formato horizontal, vertical, cuadrado o un tamaño personalizado.
- Editar con otras personas en tiempo real y guardar accesos a varios estudios en **Mis canales**.

## Cómo empezar

1. Abre la aplicación y crea un estudio con la clave de administración de esa instalación, o entra con un enlace de edición que te hayan compartido.
2. Añade tu contenido y acomódalo dentro del escenario. Los archivos nuevos se colocan fuera del área que se transmite para que puedas prepararlos antes de mostrarlos.
3. Pulsa **Copiar enlace OBS** en el panel.
4. En OBS, añade una **Fuente de navegador**, pega el enlace y configura su ancho y alto con el mismo tamaño del escenario.
5. Edita desde el navegador: los cambios se mostrarán en OBS.

La cámara, el micrófono y las escenas se siguen controlando desde OBS.

## Tus estudios y enlaces

Cada estudio tiene un enlace para editar y otro para mostrar el contenido en OBS. Guarda el enlace de edición y compártelo solo con quienes vayan a ayudarte: cualquier persona que lo tenga podrá modificar el estudio.

**Mis canales** permite guardar y organizar tus accesos. Esta lista se conserva únicamente en el navegador donde la creaste; no se sincroniza entre equipos. Si cambias de navegador o borras los datos del sitio, necesitarás volver a añadir los enlaces. Quitar un acceso de la lista no elimina el estudio ni sus archivos.

El proyecto todavía no incluye cuentas personales, chat de Twitch ni una opción para revocar enlaces compartidos.

## Instalación local

Necesitas Node.js (se recomienda la versión 24) y npm. No hace falta una cuenta de Cloudflare para usarlo localmente.

Desde la carpeta del repositorio, ejecuta:

```sh
npm ci
npm run setup:local
npm run dev
```

Abre **http://localhost:8787**. El paso `setup:local` crea el archivo `.dev.vars` con la clave `ADMIN_SECRET`: usa ese valor para crear tu primer estudio. Si el archivo ya existe, conserva su configuración.

En Windows, si PowerShell bloquea `npm`, utiliza `npm.cmd` en los mismos comandos.

Conserva `.dev.vars`, la carpeta `.wrangler/state` y tus enlaces para mantener el acceso y los datos de la instalación local. Para que otra persona pueda entrar desde otro equipo, la aplicación debe estar disponible en una dirección accesible para ambos.

## Más información

- [Guía de instalación en Cloudflare y funcionamiento de la versión publicada](docs/cloudflare-deployment.md).
- [Informe de pruebas y comprobaciones pendientes en OBS y producción](docs/v1-validation.md).
