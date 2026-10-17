import { test, expect } from '@playwright/test';
import { createRoom, socketRequest, panelUrl, overlayUrl } from './helpers';
import type { RoomState } from '../../src/shared/model';

test('barra de volumen: teclado rápido y arrastre con confirmaciones retrasadas', async ({ page, context, request }) => {
  const room = await createRoom(request);
  await page.routeWebSocket('**/ws/**', ws => {
    const server = ws.connectToServer();
    server.onMessage(async data => {
      if (data !== 'pong' && JSON.parse(String(data)).t === 'op') await new Promise(resolve => setTimeout(resolve, 250));
      ws.send(data);
    });
  });
  await page.goto(panelUrl(room));
  await expect(page.getByText('Conectado', { exact: true })).toBeVisible();
  const viewer = await context.newPage(); await viewer.goto(overlayUrl(room));
  await page.locator('input[type=file]').setInputFiles('tests/fixtures/motion.webm');
  const slider = page.getByRole('slider', { name: 'Volumen del vídeo' });
  const video = viewer.locator('.overlay-item video');
  await expect(slider).toHaveValue('100');
  const original = (await socketRequest(page, room) as RoomState).items[0];
  await slider.press('Home');
  for (let step = 0; step < 20; step++) await slider.press('ArrowRight');
  await expect(slider).toHaveValue('20');
  await expect(video).toHaveJSProperty('volume', .2);
  await expect(page.getByText('Cambios guardados', { exact: true })).toBeVisible();
  await expect(slider).toHaveValue('20');
  const track = (await slider.boundingBox())!;
  const left = track.x + 8, width = track.width - 16, y = track.y + track.height / 2;
  await page.mouse.move(left + width * .2, y); await page.mouse.down();
  await page.mouse.move(left + width * .8, y, { steps: 8 });
  // The viewer updates while the thumb is still being dragged.
  await expect.poll(async () => Math.abs(await video.evaluate((el: HTMLVideoElement) => el.volume) - .8)).toBeLessThan(.03);
  await page.mouse.move(left + width * .8, y + 60); await page.mouse.up();
  await expect(page.getByText('Cambios guardados', { exact: true })).toBeVisible();
  await expect(video).toHaveJSProperty('muted', true);
  expect((await socketRequest(page, room) as RoomState).items[0]).toMatchObject({ x: original.x, y: original.y });
  // Releasing outside the track must end the gesture and allow remote updates.
  await socketRequest(page, room, { t: 'item.patch', id: original.id, patch: { volume: .45 } });
  await expect(slider).toHaveValue('45');
  await expect(video).toHaveJSProperty('volume', .45);
  await viewer.close();
});
