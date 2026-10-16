import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Keep local runtime state within the checkout, including in restricted cloud
// environments. This uses supported XDG/Cloudflare settings, without changing HOME.
const root = new URL('../', import.meta.url);
const child = spawn(process.execPath, [fileURLToPath(new URL('node_modules/vite/bin/vite.js', root)), ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: { ...process.env,
    XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME || fileURLToPath(new URL('.wrangler/config', root)),
    WRANGLER_SEND_METRICS: 'false', CF_SEND_TELEMETRY: 'false', CLOUDFLARE_CF_FETCH_ENABLED: 'false',
  },
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', code => process.exit(code ?? 1));
