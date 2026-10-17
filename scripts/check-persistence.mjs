import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from '@playwright/test';

// A separate process and storage directory prove that persistence does not
// depend on React state, a live Worker, or the other test server.
const origin = 'http://127.0.0.1:8791';
const admin = readFileSync('.dev.vars', 'utf8').match(/^ADMIN_SECRET=(.+)$/m)?.[1].trim();
assert.ok(admin, 'Ejecuta npm run setup:local primero.');
await mkdir('.wrangler', { recursive: true });
const statePath = await mkdtemp('.wrangler/persistence-');
let server, browser;
async function start() {
  let occupied = false;
  try { await fetch(origin, { signal: AbortSignal.timeout(500) }); occupied = true; } catch { /* Free port. */ }
  assert.equal(occupied, false, 'El puerto 8791 debe estar libre para esta prueba.');
  server = spawn(process.execPath, ['scripts/wrangler.mjs', 'dev', '--ip', '127.0.0.1', '--port', '8791', '--local', '--persist-to', statePath], {
    env: process.env, stdio: ['ignore', 'ignore', 'pipe'],
  });
  let errors = '';
  server.stderr.on('data', data => { errors = (errors + data.toString()).slice(-4000); });
  for (let attempt = 0; attempt < 120; attempt++) {
    assert.equal(server.exitCode, null, `El servidor no inició: ${errors}`);
    try {
      const response = await fetch(`${origin}/api/health`, { signal: AbortSignal.timeout(500) });
      if ((await response.json()).ok) return;
    } catch { /* Wait for readiness. */ }
    await delay(250);
  }
  throw new Error('El servidor no quedó listo en 30 segundos.');
}
async function stop() {
  if (!server || server.exitCode !== null) return;
  const closed = once(server, 'exit');
  server.kill('SIGTERM'); await closed; server = undefined;
}
async function socket(page, room, command) {
  return page.evaluate(({ room, command }) => new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://${location.host}/ws/${room.roomId}`);
    const timer = setTimeout(() => { ws.close(); reject(new Error('WebSocket sin respuesta')); }, 8000);
    ws.onopen = () => ws.send(JSON.stringify({ t: 'hello', key: room.editorKey }));
    ws.onmessage = event => {
      const message = JSON.parse(event.data);
      if (message.t === 'welcome' && command) ws.send(JSON.stringify(command));
      else if (message.t === 'welcome' || message.t === 'op') {
        clearTimeout(timer); ws.close(); resolve(message.state ?? message);
      } else if (message.t === 'error') { clearTimeout(timer); ws.close(); reject(new Error(message.message)); }
    };
  }), { room, command });
}
try {
  await start();
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined), args: ['--no-sandbox'] });
  const page = await browser.newPage(); await page.goto(origin);
  const response = await fetch(`${origin}/api/rooms`, {
    method: 'POST', headers: { Authorization: `Bearer ${admin}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Persistencia' }),
  });
  assert.equal(response.status, 201); const room = await response.json();
  const image = Buffer.from(await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 32; canvas.height = 32;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#8a5cf6'; ctx.fillRect(0, 0, 32, 32);
    return canvas.toDataURL().split(',')[1];
  }), 'base64');
  const uploaded = await fetch(`${origin}/api/rooms/${room.roomId}/media`, {
    method: 'POST', headers: { Authorization: `Bearer ${room.editorKey}`, 'X-Image-Width': '32', 'X-Image-Height': '32' }, body: image,
  });
  assert.equal(uploaded.status, 201); const media = await uploaded.json();
  await socket(page, room, { t: 'item.add', mediaId: media.id, x: 321, y: 123 });
  const text = await socket(page, room, { t: 'text.add', x: 80, y: 90 });
  await socket(page, room, { t: 'item.patch', id: text.op.item.id, patch: { text: 'Texto persistente', color: '#12efab', italic: true } });
  const additionalFiles = [];
  for (const [extension, mime] of [['gif', 'image/gif'], ['mp4', 'video/mp4']]) {
    const bytes = readFileSync(`tests/fixtures/motion.${extension}`);
    const response = await fetch(`${origin}/api/rooms/${room.roomId}/media`, { method: 'POST', headers: {
      Authorization: `Bearer ${room.editorKey}`, 'Content-Type': mime, 'X-Image-Width': extension === 'gif' ? '96' : '160',
      'X-Image-Height': extension === 'gif' ? '54' : '90', 'X-Media-Duration': '6',
    }, body: bytes });
    assert.equal(response.status, 201); const file = await response.json(); additionalFiles.push({ id: file.id, bytes });
    const added = await socket(page, room, { t: 'item.add', mediaId: file.id, x: 400, y: 300 });
    if (extension === 'mp4') {
      await socket(page, room, { t: 'video.control', id: added.op.item.id, action: 'pause' });
      await socket(page, room, { t: 'item.patch', id: added.op.item.id, patch: { volume: .35 } });
    }
  }
  for (const shape of ['rect', 'ellipse', 'line', 'arrow']) {
    const added = await socket(page, room, { t: 'shape.add', shape, x: 400, y: 500 });
    await socket(page, room, { t: 'item.patch', id: added.op.item.id, patch: {
      borderColor: '#12efab', borderWidth: 12, opacity: .6, rot: 25, visible: false,
      ...(shape === 'rect' || shape === 'ellipse' ? { fill: null } : {}),
    } });
  }
  const before = await socket(page, room); assert.equal(before.rev, 18);
  assert.equal(before.items.filter(item => item.type === 'shape').length, 4);
  assert.equal(before.items.find(item => item.type === 'video').playing, false);
  assert.equal(before.items.find(item => item.type === 'video').volume, .35);
  await page.close(); await stop(); await start();
  const restoredPage = await browser.newPage(); await restoredPage.goto(origin);
  assert.deepEqual(await socket(restoredPage, room), before, 'La sala debe conservarse tras reiniciar el proceso.');
  const restoredImage = await fetch(`${origin}/media/${room.roomId}/${media.id}`);
  assert.equal(restoredImage.status, 200);
  assert.deepEqual(Buffer.from(await restoredImage.arrayBuffer()), image, 'R2 debe conservar los bytes originales.');
  for (const file of additionalFiles) {
    const response = await fetch(`${origin}/media/${room.roomId}/${file.id}`);
    assert.equal(response.status, 200); assert.deepEqual(Buffer.from(await response.arrayBuffer()), file.bytes);
  }
  const html = await fetch(origin);
  assert.match(html.headers.get('content-security-policy') ?? '', /default-src 'self'/);
  assert.equal(html.headers.get('referrer-policy'), 'no-referrer');
  for (const path of ['/.dev.vars', '/src/worker/index.ts']) {
    const body = await (await fetch(origin + path)).text();
    assert.ok(!body.includes(admin) && !body.includes('export interface Env'), 'Los archivos privados no deben servirse.');
  }
  console.log('OK: sala, imágenes, GIF, vídeo con volumen, texto y cuatro figuras con estilos recuperados tras un reinicio real; cabeceras y archivos privados verificados.');
} finally {
  await browser?.close(); await stop(); await rm(statePath, { recursive: true, force: true });
}
