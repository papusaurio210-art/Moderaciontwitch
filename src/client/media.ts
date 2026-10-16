const extensions: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', mp4: 'video/mp4', webm: 'video/webm' };
export async function inspectFile(file: File) {
  const mime = Object.values(extensions).includes(file.type) ? file.type : extensions[file.name.split('.').at(-1)?.toLowerCase() ?? ''];
  if (!Object.values(extensions).includes(mime)) throw new Error('Usa PNG, JPG, WebP, GIF, MP4 o WebM.');
  const video = mime.startsWith('video/'), maxMB = video ? 50 : 25;
  if (file.size > maxMB * 1024 * 1024) throw new Error(`El archivo supera el límite de ${maxMB} MB.`);
  const url = URL.createObjectURL(file);
  try {
    let width: number, height: number, duration: number | undefined;
    if (video) {
      const element = document.createElement('video'); element.muted = true; element.preload = 'auto';
      try {
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('No se pudo leer el vídeo. Usa MP4 H.264 o WebM VP8/VP9.')), 15000);
          element.onloadeddata = () => { clearTimeout(timer); resolve(); };
          element.onerror = () => { clearTimeout(timer); reject(new Error('Vídeo no compatible. Usa MP4 H.264 o WebM VP8/VP9.')); };
          element.src = url;
        });
        width = element.videoWidth; height = element.videoHeight; duration = element.duration;
        if (!Number.isFinite(duration) || duration <= 0 || duration > 86400) throw new Error('El vídeo debe durar entre 0 y 24 horas.');
      } finally { element.onloadeddata = null; element.onerror = null; element.removeAttribute('src'); element.load(); }
    } else {
      const image = new Image(); image.src = url;
      try { await image.decode(); } catch { throw new Error('No se pudo leer la imagen o GIF. Comprueba el archivo.'); }
      width = image.naturalWidth; height = image.naturalHeight;
    }
    if (!width || !height || width > 16384 || height > 16384) throw new Error('El archivo debe medir como máximo 16384 píxeles por lado.');
    return { width, height, duration, mime };
  } finally { URL.revokeObjectURL(url); }
}
