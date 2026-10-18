# Archivos sintéticos de prueba

Generados con FFmpeg a partir de `testsrc2`; no contienen material externo. Los archivos `motion.*` no tienen audio; `tone.webm` incluye un tono sintético de 440 Hz en Opus para comprobar los controles de volumen. Se guardan para ejecutar las pruebas sin instalar FFmpeg. El MP4 usa H.264 y el WebM VP9. El GIF tiene varios fotogramas y bucle infinito. `motion-720p.mp4` es el patrón H.264 de 1280 × 720 a 30 fps, sin audio y de 4 segundos, usado por las pruebas de carga; se reutiliza en seis elementos del escenario.

Para regenerarlos desde la raíz del proyecto:

```sh
ffmpeg -f lavfi -i testsrc2=size=160x90:rate=12 -t 6 -an -c:v libx264 -pix_fmt yuv420p -movflags +faststart -y tests/fixtures/motion.mp4
ffmpeg -f lavfi -i testsrc2=size=160x90:rate=12 -t 6 -an -c:v libvpx-vp9 -cpu-used 8 -b:v 90k -y tests/fixtures/motion.webm
ffmpeg -f lavfi -i testsrc2=size=96x54:rate=4 -t 2 -loop 0 -y tests/fixtures/motion.gif
ffmpeg -f lavfi -i testsrc2=size=160x90:rate=12 -f lavfi -i sine=frequency=440:sample_rate=48000 -t 6 -c:v libvpx-vp9 -cpu-used 8 -b:v 90k -c:a libopus -b:a 32k -y tests/fixtures/tone.webm
ffmpeg -f lavfi -i testsrc2=size=1280x720:rate=30 -t 4 -an -c:v libx264 -preset veryfast -crf 34 -pix_fmt yuv420p -movflags +faststart -y tests/fixtures/motion-720p.mp4
```
