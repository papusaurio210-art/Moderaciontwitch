import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { moveSelectedToStage, createRoom, socketRequest, panelUrl, overlayUrl } from './helpers';
import { videoPosition, type RoomState, type VideoItem } from '../../src/shared/model';

async function number(page: Page, name: string, value: string) {
  const field = page.getByRole('spinbutton', { name, exact: true }); await field.fill(value); await field.press('Enter');
}

test('texto editable, formato, seguridad y persistencia entre panel y overlay', async ({ page, context, request }) => {
  const room = await createRoom(request); await page.goto(panelUrl(room));
  await expect(page.getByText('Conectado', { exact: true })).toBeVisible();
  const viewer = await context.newPage(); await viewer.goto(overlayUrl(room));
  await page.getByRole('button', { name: 'Añadir texto', exact: true }).click();
  await expect(viewer.locator('.item-text')).toHaveText('Tu texto aquí');
  const text = '¡Bienvenidos!\n<img src=x onerror="window.injected=1">';
  await page.getByLabel('Contenido del texto', { exact: true }).fill(text);
  await expect(viewer.locator('.item-text')).toHaveText(text);
  await expect(viewer.locator('.item-text img')).toHaveCount(0);
  expect(await viewer.evaluate(() => (window as any).injected)).toBeUndefined();
  await number(page, 'Tamaño de fuente', '40');
  await page.getByLabel('Fuente del texto', { exact: true }).selectOption('JetBrains Mono');
  await page.getByLabel('Color del texto', { exact: true }).fill('#12efab');
  await page.getByLabel('Alineación del texto').selectOption('center');
  await page.getByRole('button', { name: 'Cursiva', exact: true }).click();
  // These controls reflect the server acknowledgement, which arrives after
  // the click. Wait for the confirmed state rather than an optimistic toggle.
  await page.getByLabel('Fondo del texto', { exact: true }).click();
  await expect(page.getByLabel('Fondo del texto', { exact: true })).toBeChecked();
  await number(page, 'Contorno', '2');
  await expect(viewer.locator('.item-text')).toHaveCSS('font-size', '40px');
  await expect(viewer.locator('.item-text')).toHaveCSS('font-style', 'italic');
  await expect(viewer.locator('.item-text')).toHaveCSS('color', 'rgb(18, 239, 171)');
  await expect(viewer.locator('.item-text')).toHaveCSS('text-align', 'center');
  await expect(viewer.locator('.item-text')).toHaveCSS('background-color', 'rgb(17, 19, 24)');
  await expect(viewer.locator('.item-text')).toHaveCSS('-webkit-text-stroke-width', '2px');
  await page.getByRole('button', { name: 'Ocultar elemento', exact: true }).click();
  await expect(viewer.locator('.item-text')).toHaveCount(0);
  await expect(page.locator('.canvas-item .item-text')).toHaveText(text);
  await expect(page.locator('.hidden-item-label')).toHaveText('Oculto');
  await page.getByRole('button', { name: 'Mostrar elemento', exact: true }).click();
  await expect(viewer.locator('.item-text')).toHaveText(text);
  await number(page, 'X', '320');
  await expect(viewer.locator('.overlay-item')).toHaveCSS('left', '320px');
  await viewer.reload(); await page.reload();
  await expect(viewer.locator('.item-text')).toHaveText(text);
  await page.locator('.canvas-item').click();
  await expect(page.getByLabel('Contenido del texto', { exact: true })).toHaveValue(text);
  await expect(page.getByLabel('Fuente del texto', { exact: true })).toHaveValue('JetBrains Mono');
  const state = await socketRequest(page, room) as RoomState;
  expect(state.items[0]).toMatchObject({ type: 'text', text, x: 320, italic: true, fontSize: 40 });
  const invalid = await socketRequest(page, room, { t: 'item.patch', id: state.items[0].id, patch: { loop: false } });
  expect(invalid.code).toBe('400');
  expect((await socketRequest(page, room, { t: 'text.add', x: 0, y: 0 }, room.viewerKey)).code).toBe('403');
  // A remote edit must not disrupt the focused draft or be overwritten merely
  // by leaving the field; after blur, the latest confirmed text wins.
  const field = page.getByLabel('Contenido del texto', { exact: true });
  await field.focus();
  await socketRequest(page, room, { t: 'item.patch', id: state.items[0].id, patch: { text: '¡Bienvenidos!\nEstamos en directo.' } });
  await expect(viewer.locator('.item-text')).toHaveText('¡Bienvenidos!\nEstamos en directo.');
  await expect(field).toHaveValue(text);
  await page.getByLabel('Nombre del elemento', { exact: true }).click();
  await expect(field).toHaveValue('¡Bienvenidos!\nEstamos en directo.');
  await page.screenshot({ path: 'test-results/text-editor.png', fullPage: true });
  await viewer.close();
});

test('GIF animado en el overlay y miniatura estática en la biblioteca', async ({ page, context, request }) => {
  const room = await createRoom(request); await page.goto(panelUrl(room));
  await expect(page.getByText('Conectado', { exact: true })).toBeVisible();
  const viewer = await context.newPage(); await viewer.goto(overlayUrl(room));
  await page.locator('input[type=file]').setInputFiles('tests/fixtures/motion.gif');
  await moveSelectedToStage(page);
  await expect(viewer.locator('.overlay-item img')).toBeVisible();
  await expect(page.locator('.media-thumb canvas')).toBeVisible();
  const frame = await viewer.locator('.overlay-item img').screenshot();
  await expect.poll(async () => (await viewer.locator('.overlay-item img').screenshot()).equals(frame), { timeout: 4000 }).toBe(false);
  const state = await socketRequest(page, room) as RoomState;
  expect(state.items[0].type).toBe('gif'); expect(state.media[0].mime).toBe('image/gif');
  const file = await request.get(`/media/${room.roomId}/${state.media[0].id}`);
  expect(await file.body()).toEqual(readFileSync('tests/fixtures/motion.gif'));
  await page.getByLabel('Ajuste del archivo').selectOption('cover');
  await expect(viewer.locator('.overlay-item img')).toHaveCSS('object-fit', 'cover');
  await page.getByRole('button', { name: 'Ocultar elemento', exact: true }).click();
  await expect(viewer.locator('.overlay-item')).toHaveCount(0);
  await expect(page.locator('.canvas-item img')).toBeVisible();
  await expect(page.locator('.hidden-item-label')).toHaveText('Oculto');
  await page.getByRole('button', { name: 'Mostrar elemento', exact: true }).click();
  await viewer.reload(); await expect(viewer.locator('.overlay-item img')).toBeVisible();
  await viewer.close();
});

for (const extension of ['mp4', 'webm']) test(`vídeo ${extension}: reproducción, pausa, reinicio, sonido y reconexión`, async ({ page, context, request }) => {
  const room = await createRoom(request); await page.goto(panelUrl(room));
  await expect(page.getByText('Conectado', { exact: true })).toBeVisible();
  const viewer = await context.newPage(); await viewer.goto(overlayUrl(room));
  await page.locator('input[type=file]').setInputFiles(`tests/fixtures/motion.${extension}`);
  await moveSelectedToStage(page);
  const video = viewer.locator('.overlay-item video');
  await expect(video).toBeVisible(); await expect(video).toHaveJSProperty('muted', true);
  await expect.poll(() => video.evaluate((el: HTMLVideoElement) => el.currentTime)).toBeGreaterThan(.5);
  await page.getByRole('button', { name: 'Pausar vídeo', exact: true }).click();
  await expect(video).toHaveJSProperty('paused', true);
  const snapshot = await socketRequest(page, room) as RoomState;
  const item = snapshot.items[0] as VideoItem;
  expect(item).toMatchObject({ type: 'video', playing: false, startedAt: null, muted: true });
  expect(item.position).toBeGreaterThan(0);
  await expect.poll(async () => Math.abs(await video.evaluate((el: HTMLVideoElement) => el.currentTime) - item.position)).toBeLessThan(.1);
  await viewer.reload();
  await expect(video).toHaveJSProperty('paused', true);
  await expect.poll(async () => Math.abs(await video.evaluate((el: HTMLVideoElement) => el.currentTime) - item.position)).toBeLessThan(.1);
  await page.getByLabel('Sonido en el overlay', { exact: true }).click();
  await expect(video).toHaveJSProperty('muted', false);
  await expect(page.locator('.canvas-item video')).toHaveJSProperty('muted', true);
  await page.getByLabel('Sonido en el overlay', { exact: true }).click();
  await expect(video).toHaveJSProperty('muted', true);
  await page.getByRole('button', { name: 'Reiniciar vídeo', exact: true }).click();
  await expect(video).toHaveJSProperty('paused', false);
  await expect.poll(() => video.evaluate((el: HTMLVideoElement) => el.currentTime)).toBeLessThan(1.5);
  await page.getByLabel('Sonido en el overlay', { exact: true }).click();
  await expect(video).toHaveJSProperty('muted', false);
  // Keep a reference to the removed video to verify it stops playing, not just
  // that it disappears visually while audio could continue in the background.
  const removedVideo = await video.elementHandle();
  await page.getByRole('button', { name: 'Ocultar elemento', exact: true }).click();
  await expect(video).toHaveCount(0);
  await expect.poll(() => removedVideo!.evaluate((el: HTMLVideoElement) => el.paused)).toBe(true);
  await expect(page.locator('.canvas-item video')).toHaveJSProperty('paused', true);
  await expect(page.locator('.canvas-item video')).toHaveJSProperty('muted', true);
  await expect(page.locator('.hidden-item-label')).toHaveText('Oculto');
  await viewer.reload(); await expect(viewer.getByTestId('overlay-stage')).toBeVisible();
  await expect(video).toHaveCount(0);
  await page.getByRole('button', { name: 'Mostrar elemento', exact: true }).click();
  await expect(video).toHaveJSProperty('muted', false);
  await page.getByLabel('Sonido en el overlay', { exact: true }).click();
  await expect(video).toHaveJSProperty('muted', true);
  await expect(video).toHaveJSProperty('paused', false);
  await removedVideo!.dispose();
  await number(page, 'X', '2200');
  await expect(viewer.locator('.overlay-item video')).toHaveCount(0);
  await expect(page.locator('.canvas-item video')).toHaveJSProperty('paused', true);
  await number(page, 'X', '100');
  await expect(video).toBeVisible(); await expect(video).toHaveJSProperty('paused', false);
  await viewer.reload(); await expect(video).toHaveJSProperty('paused', false);
  const playing = (await socketRequest(page, room) as RoomState).items[0] as VideoItem;
  await expect.poll(async () => {
    const actual = await video.evaluate((el: HTMLVideoElement) => el.currentTime);
    const difference = Math.abs(actual - videoPosition(playing, Date.now(), 6));
    return Math.min(difference, 6 - difference);
  }).toBeLessThan(.7);
  expect((await socketRequest(page, room, { t: 'video.control', id: item.id, action: 'pause' }, room.viewerKey)).code).toBe('403');
  expect((await socketRequest(page, room, { t: 'item.patch', id: item.id, patch: { text: 'No' } })).code).toBe('400');
  await page.getByLabel('Repetir vídeo', { exact: true }).click();
  await expect(video).toHaveJSProperty('loop', false);
  await page.getByRole('button', { name: 'Reiniciar vídeo', exact: true }).click();
  await expect(video).toHaveJSProperty('ended', true, { timeout: 12000 });
  await expect(page.getByText('Finalizado', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Reproducir vídeo', exact: true }).click();
  await expect(video).toHaveJSProperty('paused', false);
  await viewer.close();
});

test('vídeo: firmas, límites y entrega por rangos HTTP', async ({ page, request }) => {
  const room = await createRoom(request); await page.goto('/');
  const path = `/api/rooms/${room.roomId}/media`;
  const headers = { Authorization: `Bearer ${room.editorKey}`, 'Content-Type': 'video/mp4', 'X-Image-Width': '160', 'X-Image-Height': '90', 'X-Media-Duration': '6' };
  expect((await request.post(path, { headers, data: 'fake video' })).status()).toBe(415);
  expect((await request.post(path, { headers, data: Buffer.alloc(50 * 1024 * 1024 + 1) })).status()).toBe(413);
  const file = readFileSync('tests/fixtures/motion.mp4');
  expect((await request.post(path, { headers: { ...headers, 'X-Media-Duration': '0' }, data: file })).status()).toBe(400);
  const uploaded = await request.post(path, { headers, data: file }); expect(uploaded.status()).toBe(201);
  const media = await uploaded.json(), url = `/media/${room.roomId}/${media.id}`;
  const head = await request.head(url); expect(head.status()).toBe(200);
  expect(head.headers()['content-length']).toBe(String(file.length)); expect(head.headers()['content-type']).toBe('video/mp4');
  for (const [range, offset, end] of [['bytes=0-31', 0, 32], ['bytes=-16', file.length - 16, file.length], ['bytes=32-', 32, file.length]] as const) {
    const part = await request.get(url, { headers: { Range: range } });
    expect(part.status()).toBe(206); expect(await part.body()).toEqual(file.subarray(offset, end));
    expect(part.headers()['content-range']).toBe(`bytes ${offset}-${end - 1}/${file.length}`);
  }
  const invalid = await request.get(url, { headers: { Range: `bytes=${file.length}-` } });
  expect(invalid.status()).toBe(416); expect(invalid.headers()['content-range']).toBe(`bytes */${file.length}`);
  expect((await request.get(url, { headers: { Range: 'bytes=0-9', 'If-Range': '"different"' } })).status()).toBe(200);
  expect((await request.get(url, { headers: { 'If-None-Match': head.headers().etag } })).status()).toBe(304);
});
