# Archivos sintéticos de prueba

Generados con FFmpeg a partir de `testsrc2`; no contienen material externo ni audio. Se guardan para ejecutar las pruebas sin instalar FFmpeg. El MP4 usa H.264 y el WebM VP9. El GIF tiene varios fotogramas y bucle infinito.

Para regenerarlos desde la raíz del proyecto:

```sh
ffmpeg -f lavfi -i testsrc2=size=160x90:rate=12 -t 6 -an -c:v libx264 -pix_fmt yuv420p -movflags +faststart -y tests/fixtures/motion.mp4
ffmpeg -f lavfi -i testsrc2=size=160x90:rate=12 -t 6 -an -c:v libvpx-vp9 -cpu-used 8 -b:v 90k -y tests/fixtures/motion.webm
ffmpeg -f lavfi -i testsrc2=size=96x54:rate=4 -t 2 -loop 0 -y tests/fixtures/motion.gif
```
