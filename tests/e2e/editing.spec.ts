import { test, expect, type Page } from '@playwright/test';
import { createRoom, panelUrl, overlayUrl, socketRequest, type Room } from './helpers';
const saved = (page: Page) => expect(page.getByText('Cambios guardados', { exact: true })).toBeVisible();
async function history(page: Page, action: 'Deshacer' | 'Rehacer') {
  await expect(page.getByRole('button', { name: action, exact: true })).toBeEnabled();
  await page.getByRole('button', { name: action, exact: true }).click(); await saved(page);
}
async function seed(page: Page, room: Room) {
  const a = (await socketRequest(page, room, { t: 'shape.add', shape: 'rect', x: 100, y: 100 })).op.item;
  const b = (await socketRequest(page, room, { t: 'shape.add', shape: 'ellipse', x: 800, y: 500 })).op.item;
  return [a, b];
}
test('selección múltiple, movimiento en vivo, alineación y duplicado con deshacer/rehacer', async ({ page, request, context }) => {
  const room = await createRoom(request); await page.goto(panelUrl(room));
  const [a, b] = await seed(page, room), viewer = await context.newPage(); await viewer.goto(overlayUrl(room));
  await page.getByRole('tab', { name: 'Capas' }).click();
  await page.locator('.layer-select').filter({ hasText: 'Rectángulo' }).click();
  await page.locator('.layer-select').filter({ hasText: 'Círculo' }).click({ modifiers: ['Shift'] });
  await expect(page.getByText('2 elementos seleccionados')).toBeVisible();
  const node = page.locator(`[data-item-id="${a.id}"]`), box = (await node.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2 + 30, { steps: 5 });
  await expect.poll(async () => parseFloat(await viewer.locator(`[data-item-id="${a.id}"]`).evaluate(n => (n as HTMLElement).style.left))).toBeGreaterThan(100);
  const before = await socketRequest(page, room); expect(before.items[0].x).toBe(100); // preview is transient
  await page.mouse.up(); await saved(page);
  const moved = await socketRequest(page, room); expect(moved.rev).toBe(before.rev + 1);
  expect(moved.items[1].x - moved.items[0].x).toBe(700);
  await history(page, 'Deshacer'); expect((await socketRequest(page, room)).items).toEqual([a, b]);
  await history(page, 'Rehacer'); expect((await socketRequest(page, room)).items).toEqual(moved.items);
  await page.getByRole('button', { name: 'Alinear a la izquierda', exact: true }).click(); await saved(page);
  const aligned = await socketRequest(page, room); expect(aligned.items[0].x).toBe(aligned.items[1].x);
  await page.getByRole('button', { name: 'Duplicar selección', exact: true }).click(); await saved(page);
  await expect(page.locator('.canvas-item')).toHaveCount(4); await expect(page.locator('.canvas-item.selected')).toHaveCount(2);
  const duplicated = await socketRequest(page, room); expect(duplicated.items.slice(2).map((i: any) => i.shape)).toEqual(['rect', 'ellipse']);
  await history(page, 'Deshacer'); await expect(viewer.locator('.overlay-item')).toHaveCount(2);
  await history(page, 'Rehacer'); await expect(page.locator('.canvas-item.selected')).toHaveCount(2);
  await page.getByRole('button', { name: 'Eliminar selección', exact: true }).click(); await saved(page); await expect(page.locator('.canvas-item')).toHaveCount(2);
  await history(page, 'Deshacer'); expect((await socketRequest(page, room)).items).toEqual(duplicated.items);
  await page.screenshot({ path: 'test-results/group-editor.png' });
});

test('historial por editor: conserva cambios ajenos y rechaza conflictos', async ({ page, request, context }) => {
  const room = await createRoom(request); await page.goto(panelUrl(room)); const [a, b] = await seed(page, room);
  await page.getByRole('tab', { name: 'Capas' }).click(); await page.locator('.layer-select').filter({ hasText: 'Rectángulo' }).click();
  const x = page.getByRole('spinbutton', { name: 'X', exact: true }); await x.fill('200'); await x.press('Enter'); await saved(page);
  const other = await context.newPage(); await other.goto(panelUrl(room)); await expect(other.getByRole('button', { name: 'Deshacer', exact: true })).toBeDisabled();
  await socketRequest(other, room, { t: 'item.patch', id: b.id, patch: { opacity: .5 } });
  await history(page, 'Deshacer'); const undone = await socketRequest(page, room); expect(undone.items[0].x).toBe(100); expect(undone.items[1].opacity).toBe(.5);
  await history(page, 'Rehacer');
  await socketRequest(other, room, { t: 'item.patch', id: a.id, patch: { x: 350 } });
  await page.getByRole('button', { name: 'Deshacer', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Otro editor'); expect((await socketRequest(page, room)).items[0].x).toBe(350);
  await expect(page.getByRole('button', { name: 'Deshacer', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Cerrar aviso' }).click();
  await x.fill('400'); await x.press('Enter'); await saved(page); await history(page, 'Deshacer');
  await x.fill('500'); await x.press('Enter'); await saved(page); await expect(page.getByRole('button', { name: 'Rehacer', exact: true })).toBeDisabled();
  await page.reload(); await expect(page.getByText('Conectado', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Deshacer', exact: true })).toBeDisabled(); expect((await socketRequest(page, room)).items[0].x).toBe(500);
});

test('recuadro, atajos, bloqueo y permisos de operaciones de grupo', async ({ page, request }) => {
  const room = await createRoom(request); await page.goto(panelUrl(room)); const [a, b] = await seed(page, room);
  const first = (await page.locator(`[data-item-id="${a.id}"]`).boundingBox())!, second = (await page.locator(`[data-item-id="${b.id}"]`).boundingBox())!;
  await page.mouse.move(first.x - 12, first.y - 12); await page.mouse.down();
  await page.mouse.move(second.x + second.width + 12, second.y + second.height + 12, { steps: 5 }); await page.mouse.up();
  await expect(page.locator('.canvas-item.selected')).toHaveCount(2);
  await page.keyboard.press('Control+d'); await saved(page); await expect(page.locator('.canvas-item')).toHaveCount(4);
  await page.keyboard.press('Control+z'); await saved(page); await expect(page.locator('.canvas-item')).toHaveCount(2);
  await page.keyboard.press('Control+Shift+z'); await saved(page); await expect(page.locator('.canvas-item')).toHaveCount(4);
  await page.getByRole('tab', { name: 'Capas' }).click();
  await page.locator('.layer-select').filter({ hasText: /^Rectángulo$/ }).click();
  const xField = page.getByRole('spinbutton', { name: 'X', exact: true });
  await xField.fill('150'); await xField.press('Enter'); await saved(page);
  // Clicking the canvas returns keyboard shortcuts to the editor after using a field.
  await page.locator(`[data-item-id="${a.id}"]`).click({ force: true });
  await page.keyboard.press('Control+d'); await saved(page); await expect(page.locator('.canvas-item')).toHaveCount(5);
  await history(page, 'Deshacer'); await expect(page.locator('.canvas-item')).toHaveCount(4);
  await page.keyboard.press('Escape'); await page.keyboard.press('Control+a'); await expect(page.locator('.canvas-item.selected')).toHaveCount(4);
  await socketRequest(page, room, { t: 'item.patch', id: a.id, patch: { locked: true } });
  await expect(page.getByRole('button', { name: 'Alinear arriba', exact: true })).toBeDisabled();
  const before = await socketRequest(page, room);
  const blocked = await socketRequest(page, room, { t: 'items.move', ids: [a.id, b.id], dx: 20, dy: 20 }); expect(blocked.code).toBe('409');
  expect((await socketRequest(page, room)).items).toEqual(before.items);
  for (const command of [{ t: 'items.move', ids: [b.id], dx: 1, dy: 1 }, { t: 'items.preview', ids: [b.id], dx: 1, dy: 1 }, { t: 'items.duplicate', ids: [b.id] }, { t: 'items.remove', ids: [b.id] }, { t: 'items.align', ids: [b.id], alignment: 'left', target: 'stage' }, { t: 'history.undo' }]) {
    expect((await socketRequest(page, room, command, room.viewerKey)).code).toBe('403');
  }
  expect((await socketRequest(page, room, { t: 'items.remove', ids: [b.id, crypto.randomUUID()] })).code).toBe('409');
  expect((await socketRequest(page, room)).items).toEqual(before.items);
});

test('duplicar conserva medios y estilos, pausa copias y respeta el límite de elementos', async ({ page, request }) => {
  test.setTimeout(60000);
  const room = await createRoom(request); await page.goto(panelUrl(room));
  await page.locator('input[type=file]').setInputFiles('tests/fixtures/motion.mp4');
  await expect(page.locator('.canvas-item video')).toHaveCount(1); await saved(page);
  const video = (await socketRequest(page, room)).items[0];
  await socketRequest(page, room, { t: 'item.patch', id: video.id, patch: { volume: .3, visible: false, muted: false } });
  const timer = (await socketRequest(page, room, { t: 'timer.add', kind: 'stopwatch', x: 50, y: 50 })).op.item;
  await socketRequest(page, room, { t: 'timer.control', id: timer.id, action: 'start' });
  const result = await socketRequest(page, room, { t: 'items.duplicate', ids: [timer.id, video.id] });
  expect(result.op.upserts.map((i: any) => i.type)).toEqual(['video', 'timer']);
  const [copyVideo, copyTimer] = result.op.upserts;
  expect(copyVideo).toMatchObject({ mediaId: video.mediaId, volume: .3, muted: false, visible: false, playing: false, startedAt: null });
  expect(copyVideo.position).toBeGreaterThanOrEqual(0); expect(copyTimer.running).toBe(false); expect(copyTimer.elapsedMs).toBeGreaterThan(0);
  expect((await socketRequest(page, room)).media).toHaveLength(1);
  // A separate room avoids creating hundreds of live video decoders.
  const limitRoom = await createRoom(request); await page.goto(panelUrl(limitRoom));
  await seed(page, limitRoom);
  for (let round = 0; round < 7; round++) {
    const current = await socketRequest(page, limitRoom);
    expect((await socketRequest(page, limitRoom, { t: 'items.duplicate', ids: current.items.map((i: any) => i.id) })).t).toBe('op');
  }
  const before = await socketRequest(page, limitRoom); expect(before.items).toHaveLength(256);
  const rejected = await socketRequest(page, limitRoom, { t: 'items.duplicate', ids: before.items.map((i: any) => i.id) });
  expect(rejected.code).toBe('409'); expect((await socketRequest(page, limitRoom)).rev).toBe(before.rev);
});
