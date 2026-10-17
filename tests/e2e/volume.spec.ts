import { test, expect } from '@playwright/test';
import { createRoom, socketRequest, panelUrl, overlayUrl } from './helpers';
import type { RoomState, VideoItem } from '../../src/shared/model';

test('volumen por vídeo: audio real, barra, silencio, sincronización y persistencia', async ({ page, context, request }) => {
  test.setTimeout(60_000);
  const room = await createRoom(request); await page.goto(panelUrl(room));
  await expect(page.getByText('Conectado', { exact: true })).toBeVisible();
  const viewer = await context.newPage(); await viewer.goto(overlayUrl(room));
  // Browser autoplay policy requires a viewer gesture for an audible track.
  // OBS's browser source handles playback under its own policy.
  await viewer.mouse.click(10, 10);
  await page.locator('input[type=file]').setInputFiles('tests/fixtures/tone.webm');
  const video = viewer.locator('.overlay-item video');
  await expect(video).toHaveJSProperty('paused', false);
  await expect(video).toHaveJSProperty('muted', true);
  await expect(video).toHaveJSProperty('volume', 1);
  await expect.poll(() => video.evaluate((el: HTMLVideoElement) => el.currentTime)).toBeGreaterThan(.2);
  expect(await video.evaluate((el: HTMLVideoElement) => {
    const stream = (el as any).captureStream() as MediaStream;
    const count = stream.getAudioTracks().length;
    stream.getTracks().forEach(track => track.stop()); return count;
  })).toBe(1);
  const original = (await socketRequest(page, room) as RoomState).items[0] as VideoItem;
  const other = await context.newPage(); await other.goto(panelUrl(room)); await other.locator('.canvas-item').click();
  const slider = page.getByRole('slider', { name: 'Volumen del vídeo' });
  const remoteSlider = other.getByRole('slider', { name: 'Volumen del vídeo' });
  await expect(slider).toHaveValue('100');
  await page.getByLabel('Sonido en el overlay', { exact: true }).click();
  await expect(video).toHaveJSProperty('muted', false);
  await video.evaluate(el => {
    (window as any).volumePauses = 0;
    el.addEventListener('pause', () => { (window as any).volumePauses++; });
  });
  await slider.press('Home');
  await expect(video).toHaveJSProperty('volume', 0);
  for (let i = 0; i < 3; i++) await slider.press('PageUp');
  await expect(slider).toHaveValue('30');
  await expect(page.locator('.volume-control output')).toHaveText('30%');
  await expect(video).toHaveJSProperty('volume', .3);
  await expect(remoteSlider).toHaveValue('30');
  await expect(page.locator('.canvas-item video')).toHaveJSProperty('muted', true);
  expect(await viewer.evaluate(() => (window as any).volumePauses)).toBe(0);
  const adjusted = (await socketRequest(page, room) as RoomState).items[0] as VideoItem;
  expect(adjusted).toMatchObject({ volume: .3, playing: original.playing, position: original.position, startedAt: original.startedAt, x: original.x });
  // A focused but idle slider also reflects changes made by another editor.
  await remoteSlider.press('End');
  await expect(video).toHaveJSProperty('volume', 1);
  await expect(slider).toHaveValue('100');
  await slider.press('Home'); for (let i = 0; i < 3; i++) await slider.press('PageUp');
  await expect(video).toHaveJSProperty('volume', .3);
  await page.getByLabel('Sonido en el overlay', { exact: true }).click();
  await expect(video).toHaveJSProperty('muted', true);
  await expect(video).toHaveJSProperty('volume', .3);
  await page.getByLabel('Sonido en el overlay', { exact: true }).click();
  await expect(video).toHaveJSProperty('muted', false);
  await expect(video).toHaveJSProperty('volume', .3);
  await page.getByRole('button', { name: 'Ocultar elemento', exact: true }).click();
  await expect(video).toHaveCount(0);
  await expect(page.locator('.canvas-item video')).toHaveJSProperty('paused', true);
  await page.getByRole('button', { name: 'Mostrar elemento', exact: true }).click();
  await expect(video).toHaveJSProperty('volume', .3);
  await page.reload(); await viewer.reload();
  await expect(video).toHaveJSProperty('volume', .3);
  await page.locator('.canvas-item').click(); await expect(slider).toHaveValue('30');
  await page.screenshot({ path: 'test-results/video-volume.png', fullPage: true });
  await page.locator('.media-card').click();
  await expect(slider).toHaveValue('100');
  const firstVideo = viewer.locator(`[data-item-id="${original.id}"] video`);
  await expect(firstVideo).toHaveJSProperty('volume', .3);
  await slider.press('Home');
  await expect(viewer.locator('.overlay-item video').last()).toHaveJSProperty('volume', 0);
  await expect(firstVideo).toHaveJSProperty('volume', .3);
  await page.locator(`[data-item-id="${original.id}"]`).click(); await expect(slider).toHaveValue('30');
  for (const volume of [-.1, 1.1, '50', null]) {
    expect((await socketRequest(page, room, { t: 'item.patch', id: original.id, patch: { volume } })).code).toBe('400');
  }
  expect((await socketRequest(page, room, { t: 'item.patch', id: original.id, patch: { volume: .8 } }, room.viewerKey)).code).toBe('403');
  await expect(firstVideo).toHaveJSProperty('volume', .3);
  await other.close(); await viewer.close();
});

test('vídeos antiguos sin volumen usan 100 % y el texto rechaza propiedades de audio', async ({ page, context, request }) => {
  const room = await createRoom(request); await page.goto(panelUrl(room));
  await expect(page.getByText('Conectado', { exact: true })).toBeVisible();
  await page.locator('input[type=file]').setInputFiles('tests/fixtures/motion.mp4');
  await expect(page.locator('.canvas-item video')).toBeVisible();
  // Simulate the persisted snapshot schema used by rooms before this feature.
  const legacy = await context.newPage();
  await legacy.routeWebSocket('**/ws/**', ws => {
    const server = ws.connectToServer();
    server.onMessage(data => {
      if (data === 'pong') { ws.send(data); return; }
      const message = JSON.parse(String(data));
      if (message.state) for (const item of message.state.items) delete item.volume;
      if (message.op?.item) delete message.op.item.volume;
      ws.send(JSON.stringify(message));
    });
  });
  await legacy.goto(overlayUrl(room));
  await expect(legacy.locator('.overlay-item video')).toHaveJSProperty('volume', 1);
  await legacy.goto(panelUrl(room)); await legacy.locator('.canvas-item').click();
  await expect(legacy.getByRole('slider', { name: 'Volumen del vídeo' })).toHaveValue('100');
  await page.getByRole('button', { name: 'Añadir texto', exact: true }).click();
  await expect(page.getByLabel('Contenido del texto', { exact: true })).toBeVisible();
  await expect(page.getByRole('slider', { name: 'Volumen del vídeo' })).toHaveCount(0);
  const state = await socketRequest(page, room) as RoomState;
  const text = state.items.find(item => item.type === 'text')!;
  expect((await socketRequest(page, room, { t: 'item.patch', id: text.id, patch: { volume: .5 } })).code).toBe('400');
  await legacy.close();
});
