# Instalación pública de Overlay Studio

Publicada el 18 de octubre de 2026:

**https://stream-overlay-studio.willicer1313.workers.dev**

La aplicación desplegada corresponde al código de `8da0d71`. Se utilizó Wrangler 4.151.0, integrado en el proyecto. No se utilizó la instalación de `cf` del equipo Windows del usuario.

## Recursos

- Worker: `stream-overlay-studio`.
- Durable Object: clase `Room`, binding `ROOM`, migración SQLite `v1`.
- R2: bucket `overlay-media`, binding `MEDIA`, almacenamiento Standard.
- Interfaz: assets de `dist/client`, binding `ASSETS`.
- Secreto de aplicación: `ADMIN_SECRET`, configurado en Cloudflare para producción.

Se crearon recursos específicos del proyecto. No se modificaron los otros Workers ni el bucket que ya existían en la cuenta. El uso está sujeto a las cuotas y tarifas vigentes de Cloudflare; no se contrató un cambio de plan durante el despliegue.

## Crear un canal y conectarlo a OBS

1. Abre la dirección pública, introduce un nombre y la clave de administración de **producción**, y pulsa «Crear estudio».
2. Guarda el enlace de edición que abre el navegador. Contiene un acceso privado al estudio. «Mis canales» lo guarda únicamente en ese navegador y origen.
3. Pulsa «Copiar enlace OBS». Envía ese enlace de visualización al streamer.
4. En OBS, añade una fuente Navegador, pega el enlace y ajusta ancho y alto al escenario del estudio; el valor predeterminado es 1920 × 1080. Guarda la escena.
5. Abre el editor desde tu equipo y comprueba los cambios en el OBS del streamer. La cámara sigue configurada directamente en OBS.

No hay que crear un estudio por cada directo. El mismo enlace sirve después de cerrar OBS o apagar el equipo, mientras se conserven el estudio y la dirección del servicio. El servidor funciona en Cloudflare y no depende de que el moderador mantenga su computadora encendida.

Los estudios y archivos locales no se migran automáticamente a producción. La lista «Mis canales» de `localhost` tampoco aparece en la dirección pública: crea allí los estudios que vayas a usar o guarda enlaces de esa misma instalación.

## Claves y acceso técnico

`ADMIN_SECRET` permite crear estudios; no es el token de Cloudflare ni una clave que deba recibir el streamer. Se generó una clave independiente para producción. La copia para el propietario se conserva en `.wrangler/production-admin-secret.txt` del entorno que hizo el despliegue, con permisos 0600 y excluida de Git. Guárdala en un gestor de contraseñas; no dependas de la conservación de ese archivo en futuros entornos.

Para futuros despliegues se necesitan `CLOUDFLARE_API_TOKEN` y el identificador real de cuenta en `CLOUDFLARE_ACCOUNT_ID`, suministrados desde la configuración segura del entorno. El identificador tiene 32 caracteres hexadecimales. En este despliegue el valor recibido no tenía ese formato: se consultó `/accounts`, se encontró una única cuenta autorizada y se utilizó su identificador para los comandos. No se debe elegir automáticamente una cuenta si aparecen varias.

Cambiar `ADMIN_SECRET` cambia la clave de creación, pero no revoca los enlaces de estudios existentes. No se ha implementado todavía la revocación de esos enlaces.

## Comprobaciones en el servicio publicado

La compilación y comprobación de tipos finalizaron correctamente. Una prueba de Chromium sobre la URL pública verificó:

- Carga de la página inicial sin errores JavaScript.
- Rechazo con HTTP 401 de la creación sin clave.
- Creación de un estudio con la clave de producción y conexión WebSocket del editor.
- Subida de una imagen a R2 y decodificación de sus bytes en el visor.
- Movimiento sincronizado, ocultar y mostrar el elemento.
- Recuperación de cambios realizados durante la desconexión simulada del visor.
- Conservación del estado y los mismos enlaces al recargar editor y visor.

La prueba dejó un estudio independiente llamado «Verificación de producción», con una imagen sintética. Sus credenciales y los resultados se guardaron en archivos ignorados dentro de `.wrangler/`; no se publican en Git. No se ejecutó una prueba de carga contra producción.

El navegador de pruebas necesitó acceso a su almacén de certificados para confiar en el proxy del entorno. La prueba final mantuvo la verificación HTTPS habilitada. Editor y visor se ejecutaron en el mismo equipo de pruebas, comunicándose con Cloudflare por internet; esto no sustituye una prueba con el streamer en otro equipo ni una sesión en OBS.

## Actualizar y comprobar

Con las credenciales correctas disponibles, ejecuta `npm run deploy` desde la raíz; en PowerShell, `npm.cmd run deploy`. Conserva el bucket, la clase del Durable Object y el historial de migraciones para mantener los datos.

Después comprueba `/api/health`, abre un estudio existente, verifica sus archivos y prueba una edición con el visor abierto. Los despliegues de código no son copias de seguridad de las salas y de R2.

Quedan pendientes la prueba real en OBS con audio, la colaboración entre equipos y redes distintos, una sesión de varias horas y un procedimiento de respaldo y recuperación de producción verificado.
