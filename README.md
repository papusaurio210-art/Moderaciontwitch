# Overlay Studio

Editor colaborativo de overlays para OBS. El streamer añade una **Fuente de navegador** y los editores organizan imágenes, GIF, vídeos y textos desde un panel web. La cámara sigue siendo una fuente normal del OBS del streamer.

## Funciones disponibles

- Crear salas protegidas con una clave de administración.
- Guardar accesos en **Mis canales**, con nombres locales, favoritos, búsqueda y apertura de varios editores en pestañas independientes.
- Compartir enlaces distintos para editar y visualizar. El visor no puede modificar la sala.
- Subir PNG, JPG, WebP, GIF animados, MP4 y WebM, reutilizarlos desde la biblioteca y organizarlos por capas.
- Buscar y filtrar la biblioteca por tipo y uso, renombrar archivos y eliminar los que no estén en el escenario con confirmación.
- Crear rectángulos, círculos/elipses, líneas y flechas sin subir archivos; ajustar relleno, color y grosor del borde o trazo.
- Añadir cuenta regresiva y cronómetro sincronizados con el servidor; iniciar, pausar, reiniciar y configurar la duración.
- Añadir texto editable con fuente, tamaño, color, negrita, cursiva, alineación, contorno, sombra y fondo.
- Reproducir, pausar y reiniciar vídeos, activar bucle y controlar el sonido del overlay con una barra de volumen de 0 a 100 % por vídeo. El nivel se guarda y se sincroniza entre editores y OBS sin reiniciar la reproducción. Silenciar conserva el nivel elegido; los vídeos anteriores conservan el 100 % hasta ajustarlos. El panel permanece silenciado.
- Mover, redimensionar, rotar, ocultar, bloquear y ajustar la opacidad de los elementos.
- Seleccionar varios elementos, moverlos en grupo, alinearlos y duplicarlos; deshacer y rehacer hasta 30 cambios por sesión con protección ante conflictos entre editores.
- Los elementos ocultos permanecen editables en el panel con una vista al 25 %, borde discontinuo y etiqueta «Oculto», incluso si su opacidad guardada es cero. En OBS no se muestran ni emiten audio. Mostrar restaura la opacidad configurada. Los vídeos ocultos se pausan en el panel; su línea de tiempo compartida continúa y se sincroniza al mostrarlos de nuevo.
- Colaborar en tiempo real y recuperar el estado al reconectar.
- Mostrar un overlay transparente recortado al escenario; elegir formatos horizontales, verticales, cuadrados o dimensiones personalizadas.
- Conservar las operaciones confirmadas en SQLite de Durable Objects y los archivos en R2.

La aplicación funciona localmente sin una cuenta de Cloudflare. El usuario ha confirmado el funcionamiento del overlay de imágenes en OBS; los GIF, vídeos, textos, figuras y temporizadores se validan automáticamente en Chromium y requieren también comprobación en su instalación de OBS. El despliegue público queda pendiente. Todavía no incluye chat de Twitch, gestión de usuarios ni revocación de enlaces.

## Mis canales: perfiles locales

La página de inicio permite guardar hasta **100 canales por navegador e instalación**, buscar por nombre, marcar favoritos y renombrar sus accesos. Los favoritos aparecen primero y después se priorizan las aperturas recientes desde la lista. Cada tarjeta ofrece **Abrir editor** y **Abrir en otra pestaña** para controlar varias salas al mismo tiempo. Cada sala mantiene sus propios elementos y archivos; cada streamer utiliza su propio enlace de overlay en OBS.

Para agregar una sala existente, pulsa **Agregar canal existente**, elige un nombre para tu lista y pega su enlace privado de edición. La aplicación comprueba el acceso con el servidor antes de guardarlo; no acepta enlaces de OBS, Twitch ni otra instalación. También puedes abrir directamente un panel y pulsar **Guardar en Mis canales**, en la parte inferior de la barra izquierda. Abrir un enlace por sí solo no lo guarda. Las salas creadas desde el inicio se agregan automáticamente; si el navegador impide guardarlas, se muestra el error y un enlace para abrir la sala ya creada, sin crear otra.

El botón **Mis canales** del panel abre la lista en otra pestaña para conservar el editor actual. Renombrar un acceso solo modifica tu lista, no el nombre de la sala. **Quitar acceso** requiere confirmación y elimina únicamente esa entrada local: la sala, sus archivos y el overlay siguen funcionando. Quitar un acceso no revoca el enlace de edición.

La lista se almacena en `localStorage`, incluye los enlaces privados de edición y se actualiza entre pestañas del mismo navegador. Quien use ese perfil del navegador puede abrir los canales guardados. No se guarda la clave de administración ni se copian los archivos o el estado de las salas al perfil local. Las salas y sus medios continúan en el almacenamiento del servidor.

Conserva tus enlaces: borrar los datos del sitio, usar otro navegador/equipo o cambiar de dirección web (incluido pasar de localhost al dominio público) no traslada esta lista. Puedes volver a agregar los enlaces en la instalación correspondiente. No incluye cuentas personales, sincronización entre dispositivos, exportación/importación de perfiles ni integración con permisos de Twitch. Si la lista local está dañada o su formato no se reconoce, se muestra un aviso y se conserva su contenido sin sobrescribirlo; los enlaces directos siguen disponibles.

## Biblioteca de archivos

Combina la búsqueda por nombre con los filtros **Tipo** (imágenes, GIF o vídeos) y **Uso** (en uso o sin uso). Los filtros se conservan al alternar entre Biblioteca y Capas durante la sesión. **Limpiar filtros** permite recuperar la lista completa si no hay resultados. Cada archivo muestra cuántos elementos lo utilizan, incluidos los ocultos.

El lápiz permite **renombrar el archivo** en la biblioteca; los nombres de las capas existentes se conservan. La papelera muestra una confirmación con el nombre y tamaño. Solo puedes **eliminar definitivamente** archivos que no utilice ningún elemento del escenario: primero elimina sus capas, incluidas las ocultas. Quitar una capa por sí solo conserva su archivo para reutilizarlo.

Los cambios se sincronizan entre editores. El servidor vuelve a comprobar el uso al eliminar, por si alguien añadió el archivo mientras estaba abierta la confirmación. Eliminar libera espacio de la biblioteca y no se puede deshacer. El portapapeles y el historial rechazan restauraciones que necesiten un archivo eliminado; el historial afectado se reinicia con un aviso. Renombrar y eliminar archivos no crean pasos del historial del escenario.

## Figuras

En la barra izquierda puedes añadir **Rectángulo**, **Círculo**, **Línea** y **Flecha**. Al crearlas se seleccionan en el centro del escenario. Usa **Apariencia** para cambiar relleno, color y grosor (0–64 px), y **Transformación** para posición, tamaño y rotación. Con relleno desactivado y borde mayor que cero puedes crear marcos. El círculo se convierte en elipse si cambias su ancho y alto por separado. Líneas y flechas apuntan inicialmente a la derecha; gíralas para orientarlas y modifica su ancho para ajustar la longitud. En figuras pequeñas el grosor se limita al espacio disponible.

Las figuras comparten las capas, opacidad, bloqueo y vista atenuada de los elementos ocultos. No consumen almacenamiento de archivos en la biblioteca. Para colocar un texto sobre un fondo, crea un rectángulo y usa **Atrás** hasta situarlo debajo del texto. No requieren volver a configurar el enlace de OBS. La carga de archivos SVG externos sigue sin estar permitida.

## Temporizadores

Añade **Cuenta regresiva** o **Cronómetro** desde los iconos de reloj de la barra izquierda. La cuenta regresiva comienza pausada en 5 minutos y el cronómetro en cero. Para cambiar una duración, introduce horas, minutos y segundos y pulsa **Aplicar duración** (entre 1 segundo y 24 horas). Aplicar restablece la cuenta y la deja pausada.

**Iniciar** comienza o reanuda; **Pausar** conserva el tiempo exacto; **Reiniciar** vuelve al valor inicial y lo deja pausado. Una cuenta finalizada permanece en cero; Iniciar vuelve a comenzar su duración completa. El cronómetro puede superar las 24 horas. Se muestran minutos y segundos, y horas cuando corresponde; las cuentas configuradas para una hora o más conservan ese formato hasta terminar.

Ambos admiten fuente, tamaño, color, negrita, cursiva, alineación, contorno, sombra y fondo, además de transformaciones, opacidad, capas y bloqueo de posición. Ocultar o sacar un temporizador del escenario **no lo pausa**. Un temporizador activo sigue contando aunque cierres el panel o reinicies el servidor; el tiempo se calcula desde la marca de inicio guardada, sin escribir cada segundo en la base de datos. Al reconectar se recuperan el estado y la referencia del reloj del servidor. No se reproducen alarmas ni se disparan acciones automáticas al finalizar.

## Selección múltiple e historial

Usa **Shift + clic** en el lienzo o en Capas para agregar o quitar elementos de la selección. También puedes arrastrar un recuadro desde una zona vacía o usar **Ctrl/⌘ + A**. Los elementos ocultos siguen siendo seleccionables. Arrastra uno de los seleccionados para mover todo el grupo; las flechas mueven 1 px y Shift + flechas, 10 px. Si hay un elemento bloqueado, primero debes desbloquearlo para mover o alinear la selección. El bloqueo protege la posición, no impide duplicar o eliminar.

En Propiedades encontrarás seis opciones de **alineación**. Un elemento se alinea al escenario; para varios, puedes elegir los límites de la selección o el escenario. Se tiene en cuenta la rotación de cada elemento. El tamaño y la rotación se ajustan individualmente.

**Duplicar selección** o **Ctrl/⌘ + D** crea copias desplazadas 24 px, conservando el orden relativo, los estilos, la visibilidad y los archivos originales sin consumir almacenamiento adicional de medios. Los vídeos y temporizadores se copian **pausados en su posición actual**. Supr elimina la selección del escenario, conservando los archivos de la biblioteca.

Los botones **Deshacer / Rehacer**, **Ctrl/⌘ + Z**, **Ctrl/⌘ + Shift + Z** o **Ctrl + Y** recorren hasta 30 cambios recientes de tu sesión (con un límite de tamaño). Mover, alinear, duplicar o eliminar un grupo cuenta como un solo cambio. Una nueva edición descarta la rama de rehacer. Los campos de texto mantienen sus atajos nativos mientras escribes.

El historial se conserva durante la hibernación del servidor y se reinicia al recargar o reconectar el panel; los elementos guardados permanecen. No deshace cargas, cambios de nombre ni eliminaciones de archivos de la biblioteca. Los controles de reproducción y temporizadores también se guardan: al restaurarlos se recuperan sus marcas de tiempo originales, por lo que un reloj activo refleja el tiempo transcurrido. Si otro editor cambió los elementos afectados o el orden necesario para restaurarlos, se rechaza la operación y se reinicia el historial con un aviso; los cambios en elementos ajenos se conservan.

## Ajuste magnético, copiar/pegar y formatos

El **imán** de la barra superior activa el ajuste a bordes y centros del escenario y de otros elementos visibles. Las guías verdes aparecen al acercarte a una alineación (6 píxeles de pantalla, independientemente del zoom). Funciona al mover un elemento o un grupo, teniendo en cuenta sus límites rotados. Mantén **Alt** durante el arrastre para ignorarlo temporalmente. Los elementos ocultos no atraen el ajuste; las flechas, las dimensiones numéricas y las manijas siguen permitiendo ajustes libres. La cuadrícula es una ayuda visual independiente.

**Copiar selección / Pegar elementos**, o **Ctrl/⌘ + C / V**, usan un portapapeles propio del panel. Se guarda el contenido confirmado al copiar: puedes editar o eliminar el original y pegar la copia más tarde. Se conservan orden, aspecto, bloqueo y referencias a los archivos. Vídeos y temporizadores se copian pausados en el instante de copiar. Cada pegado desplaza la selección 24 px adicionales y cuenta como un solo paso del historial; copiar no modifica la sala ni consume un paso. El portapapeles se vacía al recargar o reconectar y no se comparte entre pestañas, salas o aplicaciones. Dentro de los campos de texto, C/V mantienen su función habitual.

Pulsa el tamaño de la cabecera o **Configurar escenario** para elegir 720p, 1080p, 1440p, 4K, vertical 1080 × 1920, cuadrado 1080 × 1080 o un tamaño personalizado de **64 a 3840 píxeles por lado**. Aplicar cambia únicamente el área visible: los elementos mantienen su posición y tamaño, incluidos los que queden fuera. El cambio se sincroniza, persiste tras reiniciar y se puede deshacer/rehacer. Los nuevos elementos y la alineación usan las dimensiones actuales.

En OBS, configura el **ancho y alto de la fuente de navegador** con las dimensiones elegidas. El enlace del overlay permanece igual; la ventana de enlaces muestra el tamaño actual. Si el tamaño de la fuente difiere, el overlay se adapta conservando su proporción y puede dejar espacio transparente.

## Desarrollo local

Requisitos: Node.js 24 recomendado (`.nvmrc`), npm y Chromium para las pruebas de navegador.

```sh
npm ci
npm run setup:local
npm run dev
```

El servidor utiliza el puerto **8787**. Vite ejecuta tanto React como el Worker; Durable Objects y R2 se emulan con el runtime local de Cloudflare. No se necesita iniciar sesión en Cloudflare.

En PowerShell, si Windows bloquea `npm.ps1`, utiliza `npm.cmd` en lugar de `npm`; por ejemplo, `npm.cmd ci` y `npm.cmd run dev`.

`setup:local` crea `.dev.vars` con una clave aleatoria `ADMIN_SECRET` si todavía no existe. Usa su valor en el formulario «Crear estudio». Es una clave de esta aplicación, independiente de las credenciales de Cloudflare. El archivo está excluido de Git y el script conserva una configuración existente.

Guarda el enlace de edición de la sala. La clave va en el fragmento del enlace del editor y se envía al servidor en el mensaje inicial del WebSocket. El enlace del visor utiliza una clave distinta y solo permite leer; se puede recuperar desde el panel de edición.

Los datos locales se guardan en `.wrangler/state`. Conservar esa carpeta permite recuperar salas e imágenes tras reiniciar. Los procesos deben volver a iniciarse en cada sesión. No borres la carpeta para resolver errores de instalación: contiene los datos locales.

Para actualizar una instalación existente, detén el servidor con Ctrl+C y ejecuta desde la carpeta del repositorio:

```powershell
git pull --ff-only
npm.cmd ci
npm.cmd run dev
```

Después recarga el panel y actualiza la fuente de navegador en OBS. Conserva `.dev.vars`, `.wrangler/state` y los enlaces de tu sala. Las imágenes y salas de la primera entrega siguen siendo compatibles; no se necesita volver a crearlas. Actualiza panel y visor juntos, porque el visor anterior solo conoce imágenes.

## Texto, GIF y vídeo

Pulsa **Añadir texto** (icono T de la barra izquierda). Selecciona el texto y edita su contenido y apariencia desde Propiedades. Se permiten varias líneas y hasta 4000 caracteres; el texto se recorta a su caja, por lo que debes aumentar su alto si necesitas más líneas. Inter y JetBrains Mono se sirven desde la aplicación; Arial y Georgia dependen de las fuentes del equipo. El contenido se representa como texto, sin interpretar HTML.

Pulsa **Subir archivos** o arrastra un GIF o vídeo al lienzo. Los GIF se animan en el escenario y el overlay; su miniatura de biblioteca es estática. Cada visor inicia el GIF al cargarlo, sin sincronización exacta de fotogramas.

Para vídeos usa **MP4 con H.264** o **WebM con VP8/VP9**. La extensión MP4 no garantiza que el códec sea compatible: la aplicación comprueba la decodificación en el navegador antes de subir, pero no convierte archivos. MOV, AVI y otros formatos necesitan conversión previa. La duración máxima es de 24 horas.

Al seleccionar un vídeo aparecen **Pausar/Reproducir**, **Reiniciar**, **Repetir vídeo**, **Sonido en el overlay**, la barra **Volumen** (0–100 %) y el ajuste **Contener/Cubrir/Estirar**. Los vídeos empiezan con bucle, volumen al 100 % y en silencio: activa **Sonido en el overlay** para escucharlos. Puedes preparar el volumen mientras están silenciados; silenciar y volver a activar el sonido conserva ese nivel. La barra responde al ratón y a las flechas del teclado. El panel permanece siempre silenciado para evitar audio duplicado. Para mezclar el sonido del overlay, activa **Controlar audio vía OBS** en la fuente de navegador; otros navegadores pueden bloquear reproducción con sonido hasta recibir una interacción. Se controla el audio incluido en MP4/WebM; la subida de archivos de audio independientes (MP3/WAV) todavía no está disponible.

La posición de reproducción se calcula a partir del reloj del servidor. Un visor que se reconecta recupera el instante correspondiente; los visores corrigen desviaciones superiores a unos 450 ms, sin prometer sincronización exacta de fotogramas. Los vídeos fuera del escenario se pausan en el panel y se desmontan en el overlay. Al volver a mostrarlos recuperan la línea temporal compartida. Pausa el vídeo si quieres congelar también esa línea temporal.

## Uso en OBS

Cuando la aplicación tenga una dirección accesible desde el equipo del streamer:

1. Abre la sala y pulsa **Copiar enlace OBS**.
2. En OBS, añade una **Fuente de navegador** y pega el enlace.
3. Configura el tamaño en **1920 × 1080** y colócala en el orden apropiado de la escena.
4. Edita desde el panel. Los elementos se actualizan en el visor; lo que quede fuera del escenario se recorta.

La cámara, el audio y las escenas se administran en OBS. La aplicación no solicita acceso a la cámara ni utiliza OBS WebSocket. El contador «visores» indica conexiones abiertas al overlay; no confirma que OBS esté emitiendo.

## Comprobaciones

```sh
npm run typecheck
npm test
npm run test:e2e
npm run test:persistence
```

Si no tienes Chromium del sistema, ejecuta `npx playwright install chromium`. También puedes indicar su ruta con `CHROMIUM_PATH`. Las pruebas de navegador compilan y arrancan su propio servicio con Wrangler en el puerto 8790 y utilizan almacenamiento separado del desarrollo. Las capturas quedan en `test-results/`.

La prueba de persistencia compila el proyecto, arranca un servidor aislado en el puerto 8791, crea una sala con imagen renombrada, GIF, vídeo pausado, texto, figuras y temporizadores, elimina un archivo sin uso, detiene el proceso y lo reinicia. Comprueba que la revisión, el escenario, los elementos y los bytes de R2 sobrevivan, y que el archivo eliminado no reaparezca; verifica también las cabeceras de los recursos y que los archivos privados no se publiquen. Elimina únicamente el almacenamiento temporal que ella misma creó.

Para compilar y ejecutar la versión de producción local, detén el servidor de desarrollo y ejecuta:

```sh
npm run build
npm run preview
```

`preview` usa Wrangler con los recursos compilados. Las pruebas usan este mismo recorrido: en la versión instalada del intermediario WebSocket de Vite, el cierre visible en el navegador de una conexión que nunca envía `hello` se retrasa; Wrangler sí completa el cierre dentro del plazo de la prueba. El servidor rechaza la autenticación tardía en ambos casos.

## Pruebas de carga y estabilidad

Ejecuta `npm run test:load` para compilar y lanzar las pruebas de carga por separado de las pruebas funcionales habituales. Requieren Node.js 24 recomendado y Chromium, igual que las pruebas de navegador; el vídeo sintético está incluido y no requiere instalar FFmpeg. Usan el puerto 8790 y el almacenamiento aislado `.wrangler/load-state`.

La suite comprueba un escenario de 100 elementos (40 figuras, 30 textos, 20 imágenes, seis vídeos H.264 de 720p/30 fps y cuatro cronómetros), tres editores y un visor. Observa un minuto de reproducción y envía 60 cambios concurrentes desde los paneles reales. Compara el estado recibido con lo renderizado, desconecta un editor y recarga el visor. Además comprueba 500 figuras: rechazo del elemento 501, mover/eliminar/deshacer/rehacer grupos y aislamiento de una conexión que excede el límite de mensajes.

Las mediciones se imprimen al terminar cada escenario y quedan en archivos `metrics.json` dentro de `test-results/load/`. Incluyen confirmación de operaciones, tiempo de una ronda de edición, recuperación, intervalos de animación y fotogramas de vídeo. El percentil 95 de confirmación debe quedar por debajo de 2500 ms en esta prueba; también deben coincidir los estados y continuar la reproducción de todos los vídeos.

Estas mediciones corresponden a Chromium y Wrangler locales, con los clientes ejecutándose en la misma máquina. Los intervalos de animación y fotogramas descartados se registran como diagnóstico, no como garantía de FPS. El límite de 500 elementos no implica capacidad para 500 vídeos. Quedan por comprobar el rendimiento en OBS, la red entre equipos, los recursos reales de Cloudflare y sesiones prolongadas.

El [informe de validación local](docs/v1-validation.md) recoge las mediciones observadas, sus límites y las comprobaciones pendientes en OBS y producción.

## Arquitectura y límites

`src/client/` contiene el panel, el lienzo, el visor y la conexión WebSocket. `src/shared/` define los mensajes, el modelo compartido y la línea temporal de vídeo. `src/worker/` valida accesos, sube archivos a R2 y mantiene una instancia de `Room` por sala.

Cada operación confirmada obtiene una revisión consecutiva y se guarda antes de notificarse. El movimiento durante un arrastre se transmite como previsualización temporal; al soltar se guarda el resultado. Si el editor abandona el arrastre, la previsualización caduca y el visor recupera la última posición confirmada. Ante un salto de revisión o una reconexión se solicita el estado completo. Si dos editores modifican el mismo campo, prevalece la última operación recibida por la sala.

Se permiten hasta 500 elementos, 500 archivos, 500 MiB de biblioteca por sala, 25 MiB por imagen/GIF, 50 MiB por vídeo y 16384 píxeles por lado. Las subidas comprueban firmas PNG/JPEG/WebP/GIF/MP4/WebM; el navegador comprueba que pueda decodificar el archivo. El servidor no vuelve a decodificar ni convertir medios: dimensiones y duración declaradas se validan por rango. Los archivos se transmiten a R2 por streaming y se sirven mediante rutas aleatorias con caché pública y soporte HTTP Range: están destinados a gráficos del directo. Quitar un elemento del escenario conserva su archivo en la biblioteca. Eliminar un archivo sin uso actualiza el catálogo y registra su borrado en una misma transacción SQLite; la limpieza de R2 se ejecuta en segundo plano, con reintentos persistentes mediante alarmas si falla.

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
