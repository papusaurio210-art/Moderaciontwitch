import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { cloudflare } from '@cloudflare/vite-plugin';

export default defineConfig({
  plugins: [react(), cloudflare({ persistState: { path: process.env.OVERLAY_STATE_PATH ?? '.wrangler/state' } })],
  server: { allowedHosts: ['localhost', '127.0.0.1'] },
});
