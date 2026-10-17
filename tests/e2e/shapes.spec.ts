import { test, expect, type Page } from '@playwright/test';
import { createRoom, socketRequest, panelUrl, overlayUrl, upload } from './helpers';
import type { RoomState } from '../../src/shared/model';

async function number(page: Page, name: string, value: string) {
  const field = page.getByRole('spinbutton', { name, exact: true }); await field.fill(value); await field.press('Enter');
}

test('rectángulos y círculos: estilos, capas, ocultar, bloqueo y persistencia entre editores', async ({ page, context, request }) => {
  test.setTimeout(60_000);
  const room = await createRoom(request); await page.goto(panelUrl(room));
  await expect(page.getByText('Conectado', { exact: true })).toBeVisible();
  const viewer = await context.newPage(); await viewer.goto(overlayUrl(room));
  const other = await context.newPage(); await other.goto(panelUrl(room));
  await page.getByRole('button', { name: 'Añadir rectángulo', exact: true }).click();
  await expect(viewer.locator('.item-shape rect')).toHaveAttribute('fill', '#8c70ff');
  await expect(page.getByLabel('Ajuste del archivo')).toHaveCount(0);
  await expect(page.getByRole('slider')).toHaveCount(0);
  const rectId = (await socketRequest(page, room) as RoomState).items[0].id;
  const rect = viewer.locator(`[data-item-id="${rectId}"]`);
  await number(page, 'X', '220'); await number(page, 'Y', '200');
  await number(page, 'Ancho', '500'); await number(page, 'Alto', '300');
  await page.getByLabel('Color de relleno', { exact: true }).fill('#123456');
  await number(page, 'Grosor del borde', '8');
  await page.getByLabel('Color del borde', { exact: true }).fill('#fedcba');
  await number(page, 'Opacidad', '60');
  await expect(rect).toHaveCSS('opacity', '0.6');
  await expect(rect.locator('rect')).toHaveAttribute('fill', '#123456');
  await expect(rect.locator('rect')).toHaveAttribute('stroke', '#fedcba');
  await expect(rect.locator('rect')).toHaveAttribute('stroke-width', '8');
  await expect(rect.locator('rect')).toHaveAttribute('width', '492');
  await other.locator('.canvas-item').click();
  await expect(other.getByLabel('Color de relleno', { exact: true })).toHaveValue('#123456');
  await other.getByLabel('Color de relleno', { exact: true }).fill('#2468ac');
  await expect(rect.locator('rect')).toHaveAttribute('fill', '#2468ac');
  await page.getByRole('button', { name: 'Añadir círculo', exact: true }).click();
  await expect(viewer.locator('.item-shape ellipse')).toHaveAttribute('rx', '120');
  await expect(page.getByLabel('Nombre del elemento', { exact: true })).toHaveCount(1);
  await expect(page.getByLabel('Nombre del elemento', { exact: true })).toHaveValue('Círculo');
  const state = await socketRequest(page, room) as RoomState;
  const circleId = state.items[1].id;
  expect(state.media).toHaveLength(0);
  const circle = viewer.locator(`[data-item-id="${circleId}"]`);
  await number(page, 'X', '600'); await number(page, 'Y', '350');
  await number(page, 'Grosor del borde', '12');
  // Visibility and style controls reflect the server-confirmed state.
  await page.getByLabel('Relleno de la figura', { exact: true }).click();
  await expect(page.getByLabel('Relleno de la figura', { exact: true })).not.toBeChecked();
  await expect(circle.locator('ellipse')).toHaveAttribute('fill', 'none');
  await number(page, 'Ancho', '360');
  await expect(circle.locator('ellipse')).toHaveAttribute('rx', '174');
  await expect(circle.locator('ellipse')).toHaveAttribute('ry', '114');
  await page.getByRole('button', { name: 'Atrás', exact: true }).click();
  await expect(viewer.locator('.overlay-item').first()).toHaveAttribute('data-item-id', circleId);
  await page.getByRole('button', { name: 'Bloquear elemento', exact: true }).click();
  await expect(page.getByRole('spinbutton', { name: 'X', exact: true })).toBeDisabled();
  expect((await socketRequest(page, room, { t: 'item.patch', id: circleId, patch: { x: 0 } })).code).toBe('409');
  await page.getByRole('button', { name: 'Desbloquear elemento', exact: true }).click();
  await page.getByRole('button', { name: 'Ocultar elemento', exact: true }).click();
  await expect(circle).toHaveCount(0);
  const hidden = page.locator(`[data-item-id="${circleId}"]`);
  await expect(hidden.locator('.hidden-item-label')).toHaveText('Oculto');
  await expect(hidden.locator('.canvas-item-content')).toHaveCSS('opacity', '0.25');
  await number(page, 'X', '1000');
  await page.reload(); await viewer.reload();
  await expect(page.locator(`[data-item-id="${circleId}"] .hidden-item-label`)).toBeVisible();
  await expect(rect.locator('rect')).toHaveAttribute('fill', '#2468ac');
  await expect(circle).toHaveCount(0);
  await hidden.click();
  await expect(page.getByRole('spinbutton', { name: 'X', exact: true })).toHaveValue('1000');
  await page.getByRole('button', { name: 'Mostrar elemento', exact: true }).click();
  await expect(circle.locator('ellipse')).toHaveAttribute('fill', 'none');
  await page.screenshot({ path: 'test-results/shapes-editor.png', fullPage: true });
  await page.getByRole('button', { name: 'Eliminar del escenario' }).click();
  await expect(circle).toHaveCount(0); await expect(other.locator('.canvas-item')).toHaveCount(1);
  await page.getByRole('button', { name: 'Añadir texto', exact: true }).click();
  await expect(page.getByLabel('Contenido del texto', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Nombre del elemento', { exact: true })).toHaveCount(1);
  await expect(page.getByLabel('Nombre del elemento', { exact: true })).toHaveValue('Texto');
  await page.locator(`[data-item-id="${rectId}"]`).click();
  await expect(page.getByLabel('Nombre del elemento', { exact: true })).toHaveCount(1);
  await expect(page.getByLabel('Nombre del elemento', { exact: true })).toHaveValue('Rectángulo');
  await expect(page.getByLabel('Contenido del texto', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Color de relleno', { exact: true })).toHaveValue('#2468ac');
  await other.close(); await viewer.close();
});

test('líneas y flechas: grosor, rotación, arrastre, manijas y recorte del escenario', async ({ page, context, request }) => {
  const room = await createRoom(request); await page.goto(panelUrl(room));
  await expect(page.getByText('Conectado', { exact: true })).toBeVisible();
  const viewer = await context.newPage(); await viewer.goto(overlayUrl(room));
  await page.getByRole('button', { name: 'Mover lienzo', exact: true }).click();
  await page.getByRole('button', { name: 'Añadir línea', exact: true }).click();
  await expect(page.getByTestId('editor-canvas')).not.toHaveClass(/panning/);
  await expect(viewer.locator('.item-shape line')).toHaveAttribute('stroke-width', '6');
  await expect(page.getByLabel('Relleno de la figura')).toHaveCount(0);
  await page.getByLabel('Color del trazo', { exact: true }).fill('#12efab');
  await number(page, 'Grosor del trazo', '12');
  await number(page, 'X', '300'); await number(page, 'Y', '200');
  await number(page, 'Rotación', '90');
  await expect(viewer.locator('.overlay-item')).toHaveCSS('transform', 'matrix(0, 1, -1, 0, 0, 0)');
  await expect(viewer.locator('line')).toHaveAttribute('stroke', '#12efab');
  await page.getByRole('button', { name: 'Añadir flecha', exact: true }).click();
  await expect(viewer.locator('.item-shape polygon')).toBeVisible();
  await expect(page.getByLabel('Nombre del elemento', { exact: true })).toHaveCount(1);
  await expect(page.getByLabel('Nombre del elemento', { exact: true })).toHaveValue('Flecha');
  await page.getByLabel('Color del trazo', { exact: true }).fill('#ffbb33');
  await number(page, 'Grosor del trazo', '16');
  const state = await socketRequest(page, room) as RoomState;
  const arrow = state.items[1], selector = `[data-item-id="${arrow.id}"]`;
  const box = (await page.locator(selector).boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down(); await page.mouse.move(box.x + box.width / 2 + 30, box.y + box.height / 2 + 25, { steps: 5 }); await page.mouse.up();
  await expect.poll(async () => (await socketRequest(page, room) as RoomState).items[1].x).toBeGreaterThan(arrow.x);
  const handle = (await page.getByRole('button', { name: 'Redimensionar elemento', exact: true }).boundingBox())!;
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2); await page.mouse.down();
  await page.mouse.move(handle.x + 45, handle.y + 30, { steps: 5 }); await page.mouse.up();
  await expect.poll(async () => (await socketRequest(page, room) as RoomState).items[1].w).toBeGreaterThan(arrow.w);
  await expect(viewer.locator(`${selector} polygon`)).toHaveAttribute('fill', '#ffbb33');
  await number(page, 'X', '1950'); await expect(viewer.locator(selector)).toHaveCount(0);
  await expect(page.locator(`${selector} .item-shape`)).toBeVisible();
  await number(page, 'X', '1900'); await expect(viewer.locator(`${selector} polygon`)).toBeVisible();
  await number(page, 'X', '800'); await number(page, 'Rotación', '-30');
  await viewer.reload(); await expect(viewer.locator(`${selector} polygon`)).toHaveAttribute('fill', '#ffbb33');
  await expect.poll(async () => viewer.locator(selector).evaluate(el => (el as HTMLElement).style.transform)).toBe('rotate(-30deg)');
  await page.screenshot({ path: 'test-results/arrows-editor.png', fullPage: true });
  await viewer.close();
});

test('figuras: permisos, aislamiento de propiedades y bordes en tamaños mínimos', async ({ page, context, request }) => {
  const room = await createRoom(request); await page.goto(panelUrl(room));
  await expect(page.getByText('Conectado', { exact: true })).toBeVisible();
  const viewer = await context.newPage(); await viewer.goto(overlayUrl(room));
  expect((await socketRequest(page, room, { t: 'shape.add', shape: 'rect', x: 0, y: 0 }, room.viewerKey)).code).toBe('403');
  for (const shape of ['rect', 'ellipse', 'line', 'arrow'] as const) {
    const added = await socketRequest(page, room, { t: 'shape.add', shape, x: 20, y: 20 });
    const id = added.op.item.id;
    for (const patch of [{ text: 'no' }, { fit: 'cover' }, { volume: .5 }, { borderWidth: 65 }, { fill: 'url(https://example.com)' }]) {
      expect((await socketRequest(page, room, { t: 'item.patch', id, patch })).code).toBe('400');
    }
    if (shape === 'line' || shape === 'arrow') expect((await socketRequest(page, room, { t: 'item.patch', id, patch: { fill: '#ffffff' } })).code).toBe('400');
    expect((await socketRequest(page, room, { t: 'item.patch', id, patch: { borderWidth: 12 } }, room.viewerKey)).code).toBe('403');
    await socketRequest(page, room, { t: 'item.patch', id, patch: { w: 1, h: 1, borderWidth: 64 } });
    const svg = viewer.locator(`[data-item-id="${id}"] .item-shape`);
    await expect(svg).toHaveAttribute('viewBox', '0 0 1 1');
    const bounds = await svg.evaluate((el: SVGSVGElement) => {
      const b = el.getBBox(); return { x: b.x, y: b.y, w: b.width, h: b.height };
    });
    expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.y).toBeGreaterThanOrEqual(0);
    expect(bounds.w).toBeGreaterThan(0); expect(bounds.h).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.w).toBeLessThanOrEqual(1); expect(bounds.y + bounds.h).toBeLessThanOrEqual(1);
  }
  const text = await socketRequest(page, room, { t: 'text.add', x: 10, y: 10 });
  const media = await upload(page, request, room);
  const image = await socketRequest(page, room, { t: 'item.add', mediaId: media.id, x: 0, y: 0 });
  for (const id of [text.op.item.id, image.op.item.id]) {
    expect((await socketRequest(page, room, { t: 'item.patch', id, patch: { fill: null, borderWidth: 2 } })).code).toBe('400');
  }
  await viewer.close();
});
