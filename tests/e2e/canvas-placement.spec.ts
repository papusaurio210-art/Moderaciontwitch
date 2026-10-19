import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createRoom, panelUrl, overlayUrl, socketRequest, png, type Room } from './helpers';
import { intersectsStage, type RoomState } from '../../src/shared/model';

async function saved(page: Page) { await expect(page.getByText('Cambios guardados', { exact: true })).toBeVisible(); }
async function drag(page: Page, label: string, dx: number, dy: number) {
  const box = (await page.getByRole('button', { name: label, exact: true }).boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy, { steps: 6 });
  await page.mouse.up(); await saved(page);
}
async function snapshot(page: Page, room: Room): Promise<RoomState> { return socketRequest(page, room); }

test('las subidas quedan fuera del directo y aparecen al arrastrarlas dentro', async ({ page, context, request }) => {
  const room = await createRoom(request); await page.goto(panelUrl(room));
  const viewer = await context.newPage(); await viewer.goto(overlayUrl(room));
  await page.locator('input[type=file]').setInputFiles([
    { name: 'imagen.png', mimeType: 'image/png', buffer: await png(page) },
    { name: 'video.webm', mimeType: 'video/webm', buffer: readFileSync('tests/fixtures/tone.webm') },
    { name: 'animacion.gif', mimeType: 'image/gif', buffer: readFileSync('tests/fixtures/motion.gif') },
  ]);
  await expect(page.locator('.canvas-item')).toHaveCount(3); await saved(page);
  await expect(page.locator('.media-card')).toHaveCount(3);
  const state = await snapshot(page, room);
  for (const item of state.items) expect(intersectsStage(item, state.stage)).toBe(false);
  await expect(viewer.locator('.overlay-item')).toHaveCount(0);
  await expect(page.locator('.canvas-item video')).toHaveJSProperty('paused', true);
  await expect(page.locator('.canvas-item video')).toHaveJSProperty('muted', true);
  await page.screenshot({ path: 'test-results/uploads-outside-stage.png' });
  const canvas = await page.getByTestId('editor-canvas').boundingBox(), last = page.locator('.canvas-item.selected');
  for (const element of await page.locator('.canvas-item').all()) {
    const bounds = (await element.boundingBox())!;
    expect(bounds.x).toBeGreaterThan(canvas!.x); expect(bounds.x + bounds.width).toBeLessThan(canvas!.x + canvas!.width);
  }
  const box = (await last.boundingBox())!;
  expect(box.x).toBeGreaterThan(canvas!.x); expect(box.x + box.width).toBeLessThan(canvas!.x + canvas!.width);
  const stageBox = (await page.locator('.stage-paper').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
  await page.mouse.move(stageBox.x + stageBox.width / 2, stageBox.y + stageBox.height / 2, { steps: 12 });
  await page.mouse.up(); await saved(page);
  await expect(viewer.locator('.overlay-item')).toHaveCount(1);
  await page.reload(); await viewer.reload();
  await expect(viewer.locator('.overlay-item')).toHaveCount(1);
  expect((await snapshot(page, room)).items.filter(item => !intersectsStage(item, state.stage))).toHaveLength(2);
});

test('soltar un archivo externo encima del escenario tampoco lo muestra en vivo', async ({ page, context, request }) => {
  const room = await createRoom(request); await page.goto(panelUrl(room));
  const viewer = await context.newPage(); await viewer.goto(overlayUrl(room));
  const bytes = [...await png(page)], box = (await page.locator('.stage-paper').boundingBox())!;
  const dataTransfer = await page.evaluateHandle(bytes => {
    const data = new DataTransfer(); data.items.add(new File([new Uint8Array(bytes)], 'arrastrada.png', { type: 'image/png' })); return data;
  }, bytes);
  await page.getByTestId('editor-canvas').dispatchEvent('drop', { dataTransfer, clientX: box.x + 100, clientY: box.y + 100 });
  await dataTransfer.dispose();
  await expect(page.locator('.canvas-item')).toHaveCount(1); await saved(page);
  const state = await snapshot(page, room); expect(intersectsStage(state.items[0], state.stage)).toBe(false);
  await expect(viewer.locator('.overlay-item')).toHaveCount(0);
});

test('estirar lados y esquinas sincroniza la imagen, mantiene el anclaje y permite deshacer', async ({ page, context, request }) => {
  const room = await createRoom(request); await page.goto(panelUrl(room));
  await page.locator('input[type=file]').setInputFiles({ name: 'imagen.png', mimeType: 'image/png', buffer: await png(page) });
  await expect(page.locator('.canvas-item.selected')).toHaveCount(1); await saved(page);
  const item = (await snapshot(page, room)).items[0];
  await socketRequest(page, room, { t: 'item.patch', id: item.id, patch: { x: 500, y: 300, w: 400, h: 240 } });
  const viewer = await context.newPage(); await viewer.goto(overlayUrl(room));
  await expect(viewer.locator('.overlay-item')).toHaveCSS('width', '400px');
  for (const [label, dx, dy, axis] of [
    ['Estirar desde la derecha', 35, 0, 'w'], ['Estirar desde abajo', 0, 25, 'h'],
    ['Estirar desde la izquierda', -30, 0, 'w'], ['Estirar desde arriba', 0, -25, 'h'],
  ] as const) {
    const before = (await snapshot(page, room)).items[0];
    await drag(page, label, dx, dy);
    const after = (await snapshot(page, room)).items[0];
    expect(after[axis]).toBeGreaterThan(before[axis]);
    expect(after[axis === 'w' ? 'h' : 'w']).toBeCloseTo(before[axis === 'w' ? 'h' : 'w']);
    await expect(viewer.locator('.overlay-item img')).toHaveCSS('object-fit', 'fill');
    await expect.poll(() => viewer.locator('.overlay-item').evaluate((el, axis) => parseFloat((el as HTMLElement).style[axis === 'w' ? 'width' : 'height']), axis)).toBeCloseTo(after[axis], 2);
    await page.getByRole('button', { name: 'Deshacer', exact: true }).click(); await saved(page);
    expect((await snapshot(page, room)).items[0]).toEqual(before);
  }
  await socketRequest(page, room, { t: 'item.patch', id: item.id, patch: { rot: 30 } });
  await expect(viewer.locator('.overlay-item')).toHaveCSS('transform', 'matrix(0.866025, 0.5, -0.5, 0.866025, 0, 0)');
  const before = (await snapshot(page, room)).items[0];
  await drag(page, 'Redimensionar desde la esquina superior izquierda', -30, -30);
  const after = (await snapshot(page, room)).items[0];
  expect(after.w).toBeGreaterThan(before.w); expect(after.w / after.h).toBeCloseTo(before.w / before.h);
  await page.screenshot({ path: 'test-results/resize-controls.png' });
  await page.reload(); await viewer.reload();
  expect((await snapshot(page, room)).items[0]).toEqual(after);
  await expect(viewer.locator('.overlay-item img')).toHaveCSS('object-fit', 'contain');
});
