import { test, expect, type Page } from '@playwright/test';
import { admin, createRoom, panelUrl, overlayUrl, socketRequest, type Room } from './helpers';
import { CHANNELS_KEY } from '../../src/client/channels';
async function addChannel(page: Page, room: Room, name: string) {
  await page.getByRole('button', { name: 'Agregar canal existente' }).click();
  await page.getByLabel('Nombre para tu lista').fill(name);
  await page.getByLabel('Enlace de edición').fill(new URL(panelUrl(room), page.url()).href);
  await page.getByRole('button', { name: 'Guardar canal', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}
const card = (page: Page, room: Room) => page.locator(`[data-channel-id="${room.roomId}"]`);

test('dos canales: guardar, abrir en paralelo, editar sin mezclar salas y quitar solo el acceso local', async ({ page, request, context, browser }) => {
  const ana = await createRoom(request), luis = await createRoom(request);
  await page.goto('/'); await addChannel(page, ana, 'Canal de Ana'); await addChannel(page, luis, 'Canal de Luis');
  await expect(page.locator('.channel-card')).toHaveCount(2);
  const [editorAna] = await Promise.all([context.waitForEvent('page'), page.getByRole('link', { name: 'Abrir Canal de Ana en otra pestaña' }).click()]);
  const [editorLuis] = await Promise.all([context.waitForEvent('page'), page.getByRole('link', { name: 'Abrir Canal de Luis en otra pestaña' }).click()]);
  await expect(editorAna.getByText('Conectado', { exact: true })).toBeVisible();
  await expect(editorLuis.getByText('Conectado', { exact: true })).toBeVisible();
  await editorAna.getByRole('button', { name: 'Añadir texto', exact: true }).click();
  await expect(editorAna.locator('.canvas-item')).toHaveCount(1);
  await expect(editorLuis.locator('.canvas-item')).toHaveCount(0);
  const viewer = await context.newPage(); await viewer.goto(overlayUrl(ana)); await expect(viewer.locator('.overlay-item')).toHaveCount(1);
  await page.getByRole('button', { name: 'Quitar Canal de Ana', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('seguirán funcionando');
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click(); await expect(card(page, ana)).toBeVisible();
  await page.getByRole('button', { name: 'Quitar Canal de Ana', exact: true }).click();
  await page.getByRole('button', { name: 'Quitar de este navegador' }).click();
  await expect(card(page, ana)).toHaveCount(0); expect((await socketRequest(page, ana)).items).toHaveLength(1);
  await viewer.reload(); await expect(viewer.locator('.overlay-item')).toHaveCount(1);
  await editorAna.getByRole('button', { name: 'Añadir rectángulo', exact: true }).click(); await expect(viewer.locator('.overlay-item')).toHaveCount(2);
  await page.reload(); await expect(card(page, luis)).toBeVisible();
  const fresh = await browser.newContext(); const freshPage = await fresh.newPage();
  await freshPage.goto(new URL('/', page.url()).href); await expect(freshPage.locator('.channel-card')).toHaveCount(0); await fresh.close();
});

test('favoritos, nombres locales, filtros, duplicados y cambios entre pestañas', async ({ page, request, context }) => {
  const ana = await createRoom(request), luis = await createRoom(request);
  await page.goto('/'); await addChannel(page, ana, 'Ana'); await addChannel(page, luis, 'Luis');
  const other = await context.newPage(); await other.goto('/');
  await page.getByRole('button', { name: 'Añadir a favoritos: Ana', exact: true }).click();
  await expect(other.getByRole('button', { name: 'Quitar de favoritos: Ana' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.channel-card').first()).toHaveAttribute('data-channel-id', ana.roomId);
  await page.getByRole('button', { name: 'Renombrar Ana', exact: true }).click();
  await page.getByLabel('Nombre para tu lista').fill('Ana · Principal');
  await page.getByRole('button', { name: 'Guardar nombre' }).click();
  await expect(other.getByRole('heading', { name: 'Ana · Principal', exact: true })).toBeVisible();
  expect((await socketRequest(page, ana)).name).toBe('Canal de prueba');
  await page.getByRole('button', { name: 'Favoritos', exact: true }).click(); await expect(page.locator('.channel-card')).toHaveCount(1);
  await page.getByLabel('Buscar canales').fill('Luis'); await expect(page.getByRole('heading', { name: 'No hay canales con estos filtros' })).toBeVisible();
  await page.getByRole('button', { name: 'Mostrar todos' }).click(); await expect(page.locator('.channel-card')).toHaveCount(2);
  await page.getByRole('button', { name: 'Agregar canal existente' }).click();
  await page.getByLabel('Nombre para tu lista').fill('Duplicado'); await page.getByLabel('Enlace de edición').fill(panelUrl(ana));
  await page.getByRole('button', { name: 'Guardar canal', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('ya está en Mis canales'); await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.screenshot({ path: 'test-results/channels.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('button', { name: 'Agregar canal existente' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/channels-mobile.png', fullPage: true });
  await other.evaluate(key => localStorage.removeItem(key), CHANNELS_KEY); await expect(page.locator('.channel-card')).toHaveCount(0);
});

test('solo guarda enlaces con acceso de editor comprobado, sin guardar claves de administración', async ({ page, request }) => {
  const room = await createRoom(request); await page.goto('/');
  await page.getByRole('button', { name: 'Agregar canal existente' }).click(); await page.getByLabel('Nombre para tu lista').fill('Mi canal');
  for (const [link, message] of [
    [`https://other.example${panelUrl(room)}`, 'esta instalación'],
    [overlayUrl(room), 'enlace privado de edición'],
    [panelUrl({ ...room, editorKey: room.viewerKey }), 'solo permite visualizar'],
    [panelUrl({ ...room, editorKey: '0'.repeat(64) }), 'no permite editar'],
  ]) {
    await page.getByLabel('Enlace de edición').fill(link); await page.getByRole('button', { name: 'Guardar canal', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText(message); await expect(page.locator('.channel-card')).toHaveCount(0);
  }
  await page.keyboard.press('Escape');
  await page.getByLabel('Nombre del canal', { exact: true }).fill('Creado aquí'); await page.getByLabel('Clave de administración', { exact: true }).fill(admin);
  await page.getByRole('button', { name: 'Crear estudio', exact: true }).click(); await expect(page.getByText('Conectado', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Canal guardado en Mis canales' })).toBeDisabled();
  const stored = await page.evaluate(key => localStorage.getItem(key), CHANNELS_KEY);
  expect(stored).not.toContain(admin); expect(JSON.parse(stored!).channels).toHaveLength(1);
  await page.goto('/'); await expect(page.getByRole('heading', { name: 'Creado aquí', exact: true })).toBeVisible();
});

test('guarda un panel existente de forma explícita y mantiene intactas las salas al limpiar la lista', async ({ page, request, context }) => {
  const room = await createRoom(request); await page.goto(panelUrl(room)); await expect(page.getByText('Conectado', { exact: true })).toBeVisible();
  expect(await page.evaluate(key => localStorage.getItem(key), CHANNELS_KEY)).toBeNull();
  await page.getByRole('button', { name: 'Guardar en Mis canales', exact: true }).click();
  await page.getByLabel('Nombre para tu lista').fill('Mi amigo');
  await page.getByRole('button', { name: 'Guardar canal', exact: true }).click();
  const [home] = await Promise.all([context.waitForEvent('page'), page.getByRole('link', { name: 'Mis canales', exact: true }).click()]);
  await expect(home.getByRole('heading', { name: 'Mi amigo', exact: true })).toBeVisible();
  await home.evaluate(() => localStorage.clear()); await home.reload();
  await expect(page.getByRole('button', { name: 'Guardar en Mis canales', exact: true })).toBeEnabled();
  expect((await socketRequest(page, room)).roomId).toBe(room.roomId);
});

test('almacenamiento bloqueado: permite recuperar la sala creada y no finge guardar un perfil', async ({ page }) => {
  await page.addInitScript(key => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name, value) { if (name === key) throw new DOMException('Blocked', 'QuotaExceededError'); original.call(this, name, value); };
  }, CHANNELS_KEY);
  await page.goto('/'); await page.getByLabel('Nombre del canal', { exact: true }).fill('Sala recuperable');
  await page.getByLabel('Clave de administración', { exact: true }).fill(admin); await page.getByRole('button', { name: 'Crear estudio', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('El estudio se creó');
  await expect(page.getByRole('button', { name: 'Crear estudio', exact: true })).toBeDisabled();
  await page.getByRole('link', { name: 'Abrir estudio creado' }).click(); await expect(page.getByText('Conectado', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Guardar en Mis canales', exact: true }).click();
  await page.getByRole('button', { name: 'Guardar canal', exact: true }).click(); await expect(page.getByRole('alert')).toContainText('no permite guardar');
  expect(await page.evaluate(key => localStorage.getItem(key), CHANNELS_KEY)).toBeNull();
});
