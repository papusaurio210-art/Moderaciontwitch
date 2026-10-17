import { test, expect, type Page } from '@playwright/test';
import { createRoom, panelUrl, overlayUrl, socketRequest } from './helpers';
const saved = (page: Page) => expect(page.getByText('Cambios guardados', { exact: true })).toBeVisible();
async function resize(page: Page, preset: string) {
  await page.getByRole('button', { name: 'Configurar escenario', exact: true }).click();
  await page.getByLabel('Formato del escenario').selectOption(preset);
  await page.getByRole('button', { name: 'Aplicar tamaño', exact: true }).click(); await saved(page);
}
test('copiar conserva una instantánea después de editar y eliminar; pegar, deshacer y aislar sesiones', async ({ page, request, context }) => {
  const room = await createRoom(request); await page.goto(panelUrl(room));
  await page.getByRole('button', { name: 'Añadir texto', exact: true }).click();
  await page.getByLabel('Contenido del texto', { exact: true }).fill('Texto original'); await saved(page);
  const original = (await socketRequest(page, room)).items[0], beforeCopy = (await socketRequest(page, room)).rev;
  await page.getByRole('button', { name: 'Copiar selección', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pegar elementos', exact: true })).toBeEnabled();
  expect((await socketRequest(page, room)).rev).toBe(beforeCopy);
  await page.getByLabel('Contenido del texto', { exact: true }).fill('Modificado después'); await saved(page);
  await page.getByRole('button', { name: 'Eliminar del escenario', exact: true }).click(); await saved(page);
  await page.keyboard.press('Control+v'); await saved(page);
  await expect(page.locator('.canvas-item .item-text')).toHaveText('Texto original');
  const pasted = (await socketRequest(page, room)).items[0]; expect(pasted.id).not.toBe(original.id); expect(pasted.x).toBe(original.x + 24);
  await page.getByRole('button', { name: 'Deshacer', exact: true }).click(); await saved(page); await expect(page.locator('.canvas-item')).toHaveCount(0);
  await page.getByRole('button', { name: 'Rehacer', exact: true }).click(); await saved(page); await expect(page.locator('.canvas-item')).toHaveCount(1);
  await page.getByRole('button', { name: 'Pegar elementos', exact: true }).click(); await saved(page);
  expect((await socketRequest(page, room)).items[1].x).toBe(original.x + 48);
  // Keyboard copy uses the confirmed selection, independently from its source.
  await page.keyboard.press('Control+c'); await saved(page); await page.keyboard.press('Control+v'); await saved(page);
  await expect(page.locator('.canvas-item')).toHaveCount(3);
  const other = await context.newPage(); await other.goto(panelUrl(room));
  await expect(other.getByRole('button', { name: 'Pegar elementos', exact: true })).toBeDisabled();
  expect((await socketRequest(page, room, { t: 'clipboard.paste' })).code).toBe('409');
  await page.reload(); await expect(page.getByText('Conectado', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Pegar elementos', exact: true })).toBeDisabled();
  await expect(page.locator('.canvas-item')).toHaveCount(3);
});

test('formatos del escenario: sincronización, recorte, historial, dimensiones personalizadas y permisos', async ({ page, request, context }) => {
  test.setTimeout(60000);
  const room = await createRoom(request); await page.goto(panelUrl(room));
  const item = (await socketRequest(page, room, { t: 'shape.add', shape: 'rect', x: 1400, y: 100 })).op.item;
  const viewer = await context.newPage(); await viewer.setViewportSize({ width: 1080, height: 1920 }); await viewer.goto(overlayUrl(room));
  await expect(viewer.locator('.overlay-item')).toHaveCount(1);
  await resize(page, '1080x1920');
  await expect(viewer.getByTestId('overlay-stage')).toHaveCSS('width', '1080px'); await expect(viewer.getByTestId('overlay-stage')).toHaveCSS('height', '1920px');
  await expect(viewer.locator('.overlay-item')).toHaveCount(0);
  expect((await socketRequest(page, room)).items).toEqual([item]);
  await page.getByRole('button', { name: 'Deshacer', exact: true }).click(); await saved(page); await expect(viewer.locator('.overlay-item')).toHaveCount(1);
  await page.getByRole('button', { name: 'Rehacer', exact: true }).click(); await saved(page); await expect(viewer.locator('.overlay-item')).toHaveCount(0);
  await page.getByRole('button', { name: 'Enlaces del estudio', exact: true }).click();
  await expect(page.getByText('Añade una fuente de navegador de 1080 × 1920.')).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await resize(page, '3840x2160'); expect((await socketRequest(page, room)).stage).toMatchObject({ w: 3840, h: 2160 });
  await page.getByRole('button', { name: 'Configurar escenario', exact: true }).click();
  await page.getByLabel('Ancho del escenario').fill('5000'); await expect(page.getByRole('button', { name: 'Aplicar tamaño' })).toBeDisabled();
  await page.getByLabel('Ancho del escenario').fill('1000'); await page.getByLabel('Alto del escenario').fill('800');
  await page.getByRole('button', { name: 'Aplicar tamaño' }).click(); await saved(page);
  await page.reload(); expect((await socketRequest(page, room)).stage).toMatchObject({ w: 1000, h: 800 });
  await expect(page.locator('.stage-paper')).toHaveCSS('width', '1000px');
  for (const command of [{ t: 'stage.resize', w: 1280, h: 720 }, { t: 'clipboard.copy', ids: [item.id] }, { t: 'clipboard.paste' }]) {
    expect((await socketRequest(page, room, command, room.viewerKey)).code).toBe('403');
  }
  expect((await socketRequest(page, room, { t: 'stage.resize', w: 0, h: 720 })).code).toBe('400');
  await resize(page, '1080x1080'); await page.screenshot({ path: 'test-results/square-editor.png' });
});

test('ajuste magnético al escenario, guías, Alt y desactivación', async ({ page, request }) => {
  const room = await createRoom(request); await page.goto(panelUrl(room));
  const item = (await socketRequest(page, room, { t: 'shape.add', shape: 'rect', x: 200, y: 200 })).op.item;
  const node = page.locator(`[data-item-id="${item.id}"]`);
  async function dragNearEdge(alt = false) {
    const box = (await node.boundingBox())!, stage = (await page.locator('.stage-paper').boundingBox())!, zoom = stage.width / 1920;
    const currentX = parseFloat(await node.evaluate(n => (n as HTMLElement).style.left));
    const from = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    if (alt) await page.keyboard.down('Alt');
    await page.mouse.move(from.x, from.y); await page.mouse.down();
    await page.mouse.move(from.x + (4 - currentX) * zoom, from.y, { steps: 6 });
    if (!alt) await expect(page.getByTestId('snap-x')).toBeVisible();
    else await expect(page.getByTestId('snap-x')).toHaveCount(0);
    await page.mouse.up(); if (alt) await page.keyboard.up('Alt'); await saved(page);
  }
  await dragNearEdge(); expect((await socketRequest(page, room)).items[0].x).toBe(0);
  await expect(page.getByTestId('snap-x')).toHaveCount(0);
  await dragNearEdge(true); expect((await socketRequest(page, room)).items[0].x).toBe(4);
  await page.getByRole('button', { name: 'Ajuste magnético', exact: true }).click();
  const box = (await node.boundingBox())!, paper = (await page.locator('.stage-paper').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 3 * paper.width / 1920, box.y + box.height / 2, { steps: 3 });
  await expect(page.getByTestId('snap-x')).toHaveCount(0); await page.mouse.up(); await saved(page);
  expect((await socketRequest(page, room)).items[0].x).toBe(7);
});

test('formato y controles accesibles en una ventana estrecha', async ({ page, request }) => {
  await page.setViewportSize({ width: 800, height: 900 });
  const room = await createRoom(request); await page.goto(panelUrl(room));
  await expect(page.getByRole('button', { name: 'Configurar escenario', exact: true })).toBeEnabled();
  for (const name of ['Configurar escenario', 'Ajuste magnético', 'Copiar selección', 'Pegar elementos', 'Ajustar']) {
    const box = (await page.getByRole('button', { name, exact: true }).boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(800);
    expect(box.y + box.height).toBeLessThanOrEqual(900);
  }
  await page.getByRole('button', { name: 'Configurar escenario', exact: true }).click();
  await page.getByLabel('Formato del escenario').selectOption('1080x1920');
  await page.screenshot({ path: 'test-results/stage-settings.png' });
  await page.getByRole('button', { name: 'Aplicar tamaño', exact: true }).click(); await saved(page);
  const stage = (await page.locator('.stage-paper').boundingBox())!;
  expect(stage.height / stage.width).toBeCloseTo(1920 / 1080);
  await page.screenshot({ path: 'test-results/portrait-editor.png' });
});
