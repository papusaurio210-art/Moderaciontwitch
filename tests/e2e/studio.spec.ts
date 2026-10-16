import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { admin, createRoom, socketRequest, png, upload, panelUrl, overlayUrl, type Room } from './helpers';
import { createHash } from 'node:crypto';
import type { RoomState } from '../../src/shared/model';

test('crear, subir, mover, recortar y recuperar el overlay en otro navegador', async ({ page, browser }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); await expect(page.getByRole('heading', { name: 'Crea tu estudio' })).toBeVisible();
  await page.getByLabel('Nombre del canal').fill('La habitación violeta');
  await page.getByLabel('Clave de administración', { exact: true }).fill(admin);
  await page.getByRole('button', { name: 'Crear estudio' }).click();
  await expect(page.getByText('Conectado', { exact: true })).toBeVisible();
  const url = new URL(page.url()), editorKey = new URLSearchParams(url.hash.slice(1)).get('key')!;
  const room: Room = { roomId: url.pathname.split('/')[2], editorKey,
    viewerKey: createHash('sha256').update(`overlay-studio:viewer:v1:${editorKey}`).digest('hex') };
  const viewerContext = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const viewer = await viewerContext.newPage();
  await viewer.goto(new URL(overlayUrl(room), page.url()).href);
  await expect(viewer.getByTestId('overlay-stage')).toBeVisible();
  await page.locator('input[type=file]').setInputFiles({ name: 'bienvenida.png', mimeType: 'image/png', buffer: await png(page) });
  await expect(page.locator('.canvas-item')).toHaveCount(1);
  await expect(viewer.locator('.overlay-item img')).toBeVisible();
  await expect(page.getByText('Cambios guardados', { exact: true })).toBeVisible();
  const before = await socketRequest(page, room) as RoomState;
  const box = (await page.locator('.canvas-item').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 55, box.y + box.height / 2 - 30, { steps: 8 });
  // A different browser sees transient dragging before the pointer is released.
  await expect.poll(async () => viewer.locator('.overlay-item').evaluate(el => parseFloat((el as HTMLElement).style.left))).toBeGreaterThan(before.items[0].x);
  await page.mouse.up(); await expect(page.getByText('Cambios guardados', { exact: true })).toBeVisible();
  const moved = await socketRequest(page, room) as RoomState; expect(moved.items[0].x).toBeGreaterThan(before.items[0].x);
  await page.getByRole('spinbutton', { name: 'X', exact: true }).fill('1850'); await page.getByRole('spinbutton', { name: 'X', exact: true }).press('Enter');
  await expect(viewer.locator('.overlay-item')).toHaveCSS('left', '1850px');
  await expect(viewer.getByTestId('overlay-stage')).toHaveCSS('overflow', 'hidden');
  await page.getByRole('spinbutton', { name: 'X', exact: true }).fill('2000'); await page.getByRole('spinbutton', { name: 'X', exact: true }).press('Enter');
  await expect(viewer.locator('.overlay-item')).toHaveCount(0);
  await page.getByRole('spinbutton', { name: 'X', exact: true }).fill('100'); await page.getByRole('spinbutton', { name: 'X', exact: true }).press('Enter');
  await expect(viewer.locator('.overlay-item')).toHaveCSS('left', '100px');
  await viewer.evaluate(() => window.dispatchEvent(new Event('offline'))); await viewerContext.setOffline(true);
  await page.getByRole('spinbutton', { name: 'X', exact: true }).fill('220'); await page.getByRole('spinbutton', { name: 'X', exact: true }).press('Enter');
  await expect(page.getByText('Cambios guardados', { exact: true })).toBeVisible();
  await viewerContext.setOffline(false); await viewer.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(viewer.locator('.overlay-item')).toHaveCSS('left', '220px');
  await page.reload(); await viewer.reload();
  await expect(page.getByText('Conectado', { exact: true })).toBeVisible();
  await expect(viewer.locator('.overlay-item')).toHaveCSS('left', '220px');
  await expect(viewer.locator('body')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await page.locator('.canvas-item').click();
  await page.screenshot({ path: 'test-results/studio.png', fullPage: true });
  await viewer.screenshot({ path: 'test-results/overlay.png', omitBackground: true });
  expect(errors).toEqual([]); await viewerContext.close();
});

test('los roles y la autenticación protegen todas las escrituras', async ({ page, request }) => {
  expect((await request.post('/api/rooms', { data: { name: 'Sin clave' } })).status()).toBe(401);
  const room = await createRoom(request); await page.goto('/');
  const result = await socketRequest(page, room, { t: 'item.add', mediaId: crypto.randomUUID(), x: 0, y: 0 }, room.viewerKey);
  expect(result).toMatchObject({ t: 'error', code: '403' });
  const denied = await socketRequest(page, room, undefined, '0'.repeat(64)); expect(denied.closed).toBe(4001);
  const response = await request.post(`/api/rooms/${room.roomId}/media`, { headers: { Authorization: `Bearer ${room.viewerKey}` }, data: 'test' });
  expect(response.status()).toBe(403);
  const snapshot = await socketRequest(page, room) as RoomState; expect(snapshot.rev).toBe(0); expect(snapshot.items).toEqual([]);
  await page.goto(`/panel/${room.roomId}#key=${room.viewerKey}`);
  await expect(page.getByRole('heading', { name: 'Este panel necesita acceso de editor' })).toBeVisible();
});

test('validación de archivos, aislamiento de salas y eventos de biblioteca', async ({ page, request }) => {
  const room = await createRoom(request), other = await createRoom(request); await page.goto(panelUrl(room));
  await expect(page.getByText('Conectado', { exact: true })).toBeVisible();
  const headers = { Authorization: `Bearer ${room.editorKey}`, 'Content-Type': 'image/png', 'X-Image-Width': '720', 'X-Image-Height': '405' };
  const fake = await request.post(`/api/rooms/${room.roomId}/media`, { headers, data: '<svg><script>alert(1)</script></svg>' }); expect(fake.status()).toBe(415);
  const big = await request.post(`/api/rooms/${room.roomId}/media`, { headers, data: Buffer.alloc(25 * 1024 * 1024 + 1) }); expect(big.status()).toBe(413);
  const media = await upload(page, request, room);
  await expect(page.locator('.media-card')).toHaveCount(1);
  const image = await request.get(`/media/${room.roomId}/${media.id}`); expect(image.status()).toBe(200); expect(image.headers()['content-type']).toBe('image/png'); expect(image.headers()['x-content-type-options']).toBe('nosniff');
  expect((await request.get(`/media/${other.roomId}/${media.id}`)).status()).toBe(404);
  const result = await socketRequest(page, other, { t: 'item.add', mediaId: media.id, x: 0, y: 0 }); expect(result.code).toBe('404');
  expect((await socketRequest(page, other) as RoomState).media).toEqual([]);
});

test('revisiones, parches inválidos, bloqueo y reconexión sin perder el estado confirmado', async ({ page, request }) => {
  const room = await createRoom(request); await page.goto('/'); const media = await upload(page, request, room);
  const added = await socketRequest(page, room, { t: 'item.add', mediaId: media.id, x: 10, y: 20, requestId: 'create' });
  expect(added).toMatchObject({ t: 'op', rev: 2, requestId: 'create' }); const id = added.op.item.id;
  const invalid = await socketRequest(page, room, { t: 'item.patch', id, patch: { type: 'video' } }); expect(invalid.code).toBe('400');
  const locked = await socketRequest(page, room, { t: 'item.patch', id, patch: { locked: true }, requestId: 'lock' }); expect(locked.rev).toBe(3);
  const denied = await socketRequest(page, room, { t: 'item.patch', id, patch: { x: 900 } }); expect(denied.code).toBe('409');
  const badOrder = await socketRequest(page, room, { t: 'item.reorder', ids: [] }); expect(badOrder.code).toBe('400');
  const state = await socketRequest(page, room) as RoomState;
  expect(state.rev).toBe(3); expect(state.items[0]).toMatchObject({ x: 10, y: 20, locked: true });
});

test('transformaciones, capas y cambios compartidos entre dos editores', async ({ page, context, request }) => {
  const room = await createRoom(request); await page.goto(panelUrl(room));
  await expect(page.getByText('Conectado', { exact: true })).toBeVisible();
  const media = await upload(page, request, room);
  const added = await socketRequest(page, room, { t: 'item.add', mediaId: media.id, x: 100, y: 100 });
  const id = added.op.item.id;
  const other = await context.newPage(); await other.goto(panelUrl(room));
  const viewer = await context.newPage(); await viewer.goto(overlayUrl(room));
  await expect(other.getByText('Conectado', { exact: true })).toBeVisible();
  await page.locator('.canvas-item').click(); await other.locator('.canvas-item').click();
  const setField = async (editor: Page, name: string, value: string) => {
    const input = editor.getByRole('spinbutton', { name, exact: true }); await input.fill(value); await input.press('Enter');
  };
  await setField(page, 'Ancho', '500');
  await expect(other.getByRole('spinbutton', { name: 'Ancho', exact: true })).toHaveValue('500');
  await setField(other, 'Rotación', '30');
  await expect(page.getByRole('spinbutton', { name: 'Rotación', exact: true })).toHaveValue('30');
  await setField(page, 'Opacidad', '60');
  await expect(viewer.locator('.overlay-item')).toHaveCSS('opacity', '0.6');
  await expect.poll(() => viewer.locator('.overlay-item').evaluate(el => (el as HTMLElement).style.transform)).toBe('rotate(30deg)');
  await page.getByRole('button', { name: 'Bloquear elemento', exact: true }).click();
  await expect(other.getByRole('spinbutton', { name: 'X', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Ocultar elemento', exact: true }).click();
  await expect(viewer.locator('.overlay-item')).toHaveCount(0);
  await other.getByRole('button', { name: 'Mostrar elemento', exact: true }).click();
  await expect(viewer.locator('.overlay-item')).toHaveCount(1);
  await page.getByRole('button', { name: 'Desbloquear elemento', exact: true }).click();
  await setField(page, 'Rotación', '0');
  await expect(viewer.locator('.overlay-item')).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');
  const handle = (await page.getByRole('button', { name: 'Redimensionar imagen' }).boundingBox())!;
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2); await page.mouse.down();
  await page.mouse.move(handle.x + 40, handle.y + 25, { steps: 6 }); await page.mouse.up();
  await expect.poll(async () => Number(await other.getByRole('spinbutton', { name: 'Ancho', exact: true }).inputValue())).toBeGreaterThan(500);
  await page.locator('.media-card').click(); await expect(viewer.locator('.overlay-item')).toHaveCount(2);
  await page.getByRole('button', { name: 'Atrás', exact: true }).click();
  await expect.poll(async () => (await socketRequest(page, room) as RoomState).items.at(-1)?.id).toBe(id);
  await page.getByRole('button', { name: 'Eliminar del escenario' }).click();
  await expect(other.locator('.canvas-item')).toHaveCount(1); await expect(viewer.locator('.overlay-item')).toHaveCount(1);
  const state = await socketRequest(page, room) as RoomState;
  expect(state.items[0]).toMatchObject({ id, rot: 0, opacity: 0.6, locked: false, visible: true });
  await other.close(); await viewer.close();
});

test('una conexión sin hello caduca y las previsualizaciones abandonadas no quedan guardadas', async ({ page, request }) => {
  const room = await createRoom(request); await page.goto('/'); const media = await upload(page, request, room);
  const added = await socketRequest(page, room, { t: 'item.add', mediaId: media.id, x: 10, y: 20 });
  const result = await page.evaluate(({ roomId }) => new Promise<number>((resolve, reject) => {
    const ws = new WebSocket(`ws://${location.host}/ws/${roomId}`);
    const timer = setTimeout(() => { ws.close(); reject(new Error('Authentication deadline missed')); }, 7500);
    ws.onclose = e => { clearTimeout(timer); resolve(e.code); };
  }), room);
  expect(result).toBe(4001);
  await page.goto(overlayUrl(room)); await expect(page.locator('.overlay-item')).toHaveCSS('left', '10px');
  await page.evaluate(({ roomId, editorKey, id }) => new Promise<void>(resolve => {
    const ws = new WebSocket(`ws://${location.host}/ws/${roomId}`);
    ws.onopen = () => ws.send(JSON.stringify({ t: 'hello', key: editorKey }));
    ws.onmessage = event => { if (JSON.parse(event.data).t === 'welcome') { ws.send(JSON.stringify({ t: 'item.preview', id, patch: { x: 800 } })); setTimeout(() => { ws.close(); resolve(); }, 100); } };
  }), { ...room, id: added.op.item.id });
  await expect(page.locator('.overlay-item')).toHaveCSS('left', '800px');
  await expect(page.locator('.overlay-item')).toHaveCSS('left', '10px', { timeout: 5000 });
  expect((await socketRequest(page, room) as RoomState).items[0].x).toBe(10);
});
