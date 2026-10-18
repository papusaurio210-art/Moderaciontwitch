import { test, expect, type Page } from '@playwright/test';
import { createRoom, panelUrl, overlayUrl, socketRequest, upload } from './helpers';
const saved = (page: Page) => expect(page.getByText('Cambios guardados', { exact: true })).toBeVisible();
test('biblioteca: filtrar por tipo, uso y nombre; renombrar y sincronizar entre editores', async ({ page, request, context }) => {
  test.setTimeout(60000);
  const room = await createRoom(request); await page.goto(panelUrl(room)); const image = await upload(page, request, room);
  await page.locator('input[type=file]').setInputFiles(['tests/fixtures/motion.gif', 'tests/fixtures/motion.mp4']);
  await expect(page.locator('.media-card')).toHaveCount(3); await expect(page.locator('.canvas-item')).toHaveCount(2); await saved(page);
  await page.getByLabel('Tipo de archivo').selectOption('image'); await expect(page.locator('.media-card')).toHaveCount(1);
  await page.getByLabel('Uso del archivo').selectOption('used'); await expect(page.getByText('No hay archivos con estos filtros.')).toBeVisible();
  await page.getByRole('button', { name: 'Limpiar filtros' }).click(); await expect(page.locator('.media-card')).toHaveCount(3);
  await page.getByLabel('Tipo de archivo').selectOption('gif'); await expect(page.locator('.media-card')).toHaveCount(1);
  await expect(page.locator('.media-card strong')).toHaveText('motion.gif');
  await page.getByRole('tab', { name: 'Capas' }).click(); await page.getByRole('tab', { name: 'Biblioteca' }).click();
  await expect(page.getByLabel('Tipo de archivo')).toHaveValue('gif');
  await page.getByLabel('Tipo de archivo').selectOption('all'); await page.getByLabel('Uso del archivo').selectOption('unused');
  await expect(page.locator('.media-card strong')).toHaveText('bienvenida.png');
  await page.locator('.media-card').click(); await saved(page); await expect(page.locator('.media-card')).toHaveCount(0);
  await page.getByLabel('Uso del archivo').selectOption('all');
  await page.getByLabel('Buscar archivos', { exact: true }).fill(' BIENVENIDA ');
  const other = await context.newPage(); await other.goto(panelUrl(room));
  await page.getByRole('button', { name: 'Renombrar bienvenida.png', exact: true }).click();
  await page.getByLabel('Nombre del archivo').fill('   '); await expect(page.getByRole('button', { name: 'Guardar nombre' })).toBeDisabled();
  await page.getByLabel('Nombre del archivo').fill('Logo del canal.png'); await page.getByRole('button', { name: 'Guardar nombre' }).click(); await saved(page);
  await expect(page.locator('.media-card')).toHaveCount(0);
  await page.getByLabel('Buscar archivos', { exact: true }).fill('logo'); await expect(page.locator('.media-card strong')).toHaveText('Logo del canal.png');
  await expect(other.locator(`[data-media-id="${image.id}"] .media-card strong`)).toHaveText('Logo del canal.png');
  const state = await socketRequest(page, room); expect(state.items.find((i: any) => i.mediaId === image.id).name).toBe('bienvenida.png');
  expect((await request.get(`/media/${room.roomId}/${image.id}`)).status()).toBe(200);
  await page.getByLabel('Buscar archivos', { exact: true }).fill('');
  await page.screenshot({ path: 'test-results/library-editor.png' });
  await page.reload(); await expect(page.locator(`[data-media-id="${image.id}"] .media-card strong`)).toHaveText('Logo del canal.png');
});

test('eliminar protege archivos en uso, solicita confirmación y bloquea historial y portapapeles rotos', async ({ page, request, context }) => {
  test.setTimeout(60000);
  const room = await createRoom(request); await page.goto(panelUrl(room)); const file = await upload(page, request, room);
  await page.locator('.media-card').click(); await expect(page.locator('.canvas-item')).toHaveCount(1); await saved(page);
  await page.getByRole('button', { name: 'Copiar selección', exact: true }).click(); await saved(page);
  await page.getByRole('button', { name: 'Ocultar elemento', exact: true }).click(); await saved(page);
  await page.getByRole('button', { name: 'Eliminar archivo bienvenida.png', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Está en uso en 1 elemento');
  await expect(page.getByRole('button', { name: 'Eliminar definitivamente' })).toBeDisabled();
  // Delete inside the dialog must not remove the selected stage element.
  await page.keyboard.press('Delete'); expect((await socketRequest(page, room)).items).toHaveLength(1);
  expect((await socketRequest(page, room, { t: 'media.remove', id: file.id })).code).toBe('409');
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page.getByRole('button', { name: 'Eliminar del escenario', exact: true }).click(); await saved(page);
  await page.getByRole('button', { name: 'Eliminar archivo bienvenida.png', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('no se puede deshacer');
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  expect((await request.head(`/media/${room.roomId}/${file.id}`)).status()).toBe(200);
  const other = await context.newPage(); await other.goto(panelUrl(room));
  const viewer = await context.newPage(); await viewer.goto(overlayUrl(room));
  await page.getByRole('button', { name: 'Eliminar archivo bienvenida.png', exact: true }).click();
  await page.getByRole('button', { name: 'Eliminar definitivamente' }).click(); await saved(page);
  await expect(page.locator('.media-card')).toHaveCount(0); await expect(other.locator('.media-card')).toHaveCount(0);
  await expect.poll(async () => (await request.head(`/media/${room.roomId}/${file.id}`, { headers: { 'Cache-Control': 'no-cache' } })).status()).toBe(404);
  const state = await socketRequest(page, room); expect(state.media).toHaveLength(0); expect(state.items).toHaveLength(0);
  await page.getByRole('button', { name: 'Deshacer', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('archivo eliminado'); await expect(page.locator('.canvas-item')).toHaveCount(0);
  await page.getByRole('button', { name: 'Cerrar aviso', exact: true }).click();
  await page.getByRole('button', { name: 'Pegar elementos', exact: true }).click(); await expect(page.getByRole('alert')).toContainText('ya no está disponible');
  expect((await socketRequest(page, room, { t: 'item.add', mediaId: file.id, x: 0, y: 0 })).code).toBe('404');
  await expect(viewer.locator('.overlay-item')).toHaveCount(0);
  await page.reload(); await expect(page.locator('.media-card')).toHaveCount(0);
});

test('biblioteca: permisos, aislamiento y una incorporación concurrente impide borrar', async ({ page, request, context }) => {
  const room = await createRoom(request); await page.goto(panelUrl(room)); const file = await upload(page, request, room);
  const otherRoom = await createRoom(request);
  for (const command of [{ t: 'media.rename', id: file.id, name: 'Inválido' }, { t: 'media.remove', id: file.id }]) {
    expect((await socketRequest(page, room, command, room.viewerKey)).code).toBe('403');
    expect((await socketRequest(page, otherRoom, command)).code).toBe('404');
  }
  expect((await socketRequest(page, room, { t: 'media.rename', id: file.id, name: '' })).code).toBe('400');
  await page.getByRole('button', { name: 'Eliminar archivo bienvenida.png', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Eliminar definitivamente' })).toBeEnabled();
  const other = await context.newPage(); await other.goto(panelUrl(room));
  await other.locator('.media-card').click(); await saved(other);
  await expect(page.getByRole('button', { name: 'Eliminar definitivamente' })).toBeDisabled();
  expect((await socketRequest(page, room, { t: 'media.remove', id: file.id })).code).toBe('409');
  expect((await request.head(`/media/${room.roomId}/${file.id}`)).status()).toBe(200);
  await page.screenshot({ path: 'test-results/library-in-use.png' });
});
