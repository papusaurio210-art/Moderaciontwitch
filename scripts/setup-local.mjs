import { randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';

try {
  await writeFile(new URL('../.dev.vars', import.meta.url), `ADMIN_SECRET=${randomBytes(32).toString('hex')}\n`, { flag: 'wx', mode: 0o600 });
  console.log('Configuración local creada en .dev.vars. La clave de administración se conserva en ese archivo; no se publica en Git.');
} catch (error) {
  if (error.code !== 'EEXIST') throw error;
  console.log('Se conserva la configuración local existente en .dev.vars.');
}
