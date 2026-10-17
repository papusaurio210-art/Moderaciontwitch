import { test, expect, type Page } from '@playwright/test';
import { createRoom, socketRequest, panelUrl, overlayUrl } from './helpers';
import { timerText } from '../../src/shared/timers';
import type { RoomState, TimerItem } from '../../src/shared/model';

async function duration(page: Page, hours: string, minutes: string, seconds: string) {
  await page.getByLabel('Horas de duración', { exact: true }).fill(hours);
  await page.getByLabel('Minutos de duración', { exact: true }).fill(minutes);
  await page.getByLabel('Segundos de duración', { exact: true }).fill(seconds);
}
function seconds(text: string) { return text.split(':').reduce((total, part) => total * 60 + Number(part), 0); }

test('cuenta regresiva: duración, apariencia, reloj desfasado, pausa y finalización en cero', async ({ page, context, request }) => {
  test.setTimeout(60_000);
  const room = await createRoom(request); await page.goto(panelUrl(room));
  await expect(page.getByText('Conectado', { exact: true })).toBeVisible();
  const viewer = await context.newPage();
  await viewer.addInitScript(() => { const now = Date.now; Date.now = () => now() + 3600000; });
  await viewer.goto(overlayUrl(room));
  await page.getByRole('button', { name: 'Añadir cuenta regresiva', exact: true }).click();
  const output = viewer.locator('.item-timer');
  await expect(output).toHaveText('05:00');
  await expect(page.getByLabel('Contenido del texto', { exact: true })).toHaveCount(0);
  await duration(page, '24', '0', '1');
  await expect(page.getByRole('button', { name: 'Aplicar duración' })).toBeDisabled();
  await expect(output).toHaveText('05:00');
  await duration(page, '0', '0', '8');
  await page.getByRole('button', { name: 'Aplicar duración' }).click();
  await expect(output).toHaveText('00:08');
  await page.getByLabel('Color del texto', { exact: true }).fill('#12efab');
  const font = page.getByRole('spinbutton', { name: 'Tamaño de fuente', exact: true });
  await font.fill('80'); await font.press('Enter');
  await page.getByRole('button', { name: 'Cursiva', exact: true }).click();
  await expect(output).toHaveCSS('font-size', '80px');
  await expect(output).toHaveCSS('font-style', 'italic');
  await expect(output).toHaveCSS('color', 'rgb(18, 239, 171)');
  await page.getByRole('button', { name: 'Iniciar temporizador', exact: true }).click();
  await expect.poll(async () => seconds((await output.textContent())!)).toBeLessThan(8);
  await page.getByRole('button', { name: 'Pausar temporizador', exact: true }).click();
  await expect(page.locator('.timer-status')).toHaveText('En pausa');
  const paused = (await socketRequest(page, room) as RoomState).items[0] as TimerItem;
  expect(paused).toMatchObject({ running: false, startedAt: null, kind: 'countdown', durationMs: 8000 });
  expect(paused.elapsedMs).toBeGreaterThan(0);
  const frozen = timerText(paused, Date.now());
  await expect(output).toHaveText(frozen);
  await page.reload(); await viewer.reload();
  await expect(output).toHaveText(frozen);
  await page.locator('.canvas-item').click();
  await expect(page.locator('.timer-readout')).toHaveText(frozen);
  await expect(output).toHaveCSS('color', 'rgb(18, 239, 171)');
  await page.getByRole('button', { name: 'Iniciar temporizador', exact: true }).click();
  await expect.poll(async () => seconds((await output.textContent())!)).toBeLessThan(seconds(frozen));
  await page.getByRole('button', { name: 'Reiniciar temporizador', exact: true }).click();
  await expect(output).toHaveText('00:08'); await expect(page.locator('.timer-status')).toHaveText('En pausa');
  await page.getByRole('button', { name: 'Iniciar temporizador', exact: true }).click();
  await expect(page.locator('.timer-status')).toHaveText('En marcha');
  await duration(page, '0', '0', '3'); await page.getByRole('button', { name: 'Aplicar duración' }).click();
  await expect(output).toHaveText('00:03');
  await expect(page.locator('.timer-status')).toHaveText('En pausa');
  await page.getByRole('button', { name: 'Iniciar temporizador', exact: true }).click();
  await expect(page.locator('.timer-status')).toHaveText('En marcha');
  await page.getByRole('button', { name: 'Ocultar elemento', exact: true }).click();
  await expect(output).toHaveCount(0); await expect(page.locator('.hidden-item-label')).toHaveText('Oculto');
  await expect(page.locator('.canvas-item .item-timer')).toHaveText('00:00');
  await expect(page.locator('.timer-status')).toHaveText('Finalizado');
  const finishedRevision = (await socketRequest(page, room) as RoomState).rev;
  await viewer.reload(); await expect(viewer.getByTestId('overlay-stage')).toBeVisible();
  expect((await socketRequest(page, room) as RoomState).rev).toBe(finishedRevision);
  await page.getByRole('button', { name: 'Mostrar elemento', exact: true }).click();
  await expect(output).toHaveText('00:00');
  await page.getByRole('button', { name: 'Iniciar temporizador', exact: true }).click();
  await expect(page.locator('.timer-status')).toHaveText('En marcha');
  await page.getByRole('button', { name: 'Reiniciar temporizador', exact: true }).click();
  await expect(output).toHaveText('00:03'); await expect(page.locator('.timer-status')).toHaveText('En pausa');
  await page.screenshot({ path: 'test-results/countdown-editor.png', fullPage: true });
  await viewer.close();
});

test('cronómetro: controles entre editores, reconexión, independencia y recorte', async ({ page, context, request }) => {
  const room = await createRoom(request); await page.goto(panelUrl(room));
  await expect(page.getByText('Conectado', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Añadir cronómetro', exact: true }).click();
  await expect(page.locator('.item-timer')).toHaveText('00:00');
  await expect(page.getByRole('button', { name: 'Aplicar duración' })).toHaveCount(0);
  const first = (await socketRequest(page, room) as RoomState).items[0] as TimerItem;
  const viewer = await context.newPage(); await viewer.goto(overlayUrl(room));
  const other = await context.newPage(); await other.goto(panelUrl(room)); await other.locator('.canvas-item').click();
  const output = viewer.locator(`[data-item-id="${first.id}"] .item-timer`);
  await other.getByRole('button', { name: 'Iniciar temporizador', exact: true }).click();
  await expect.poll(async () => seconds((await output.textContent())!)).toBeGreaterThanOrEqual(2);
  const before = await socketRequest(page, room) as RoomState;
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await expect(page.getByText('Reconectando', { exact: true })).toBeVisible();
  await expect(page.getByText('Conectado', { exact: true })).toBeVisible();
  await viewer.reload();
  await expect.poll(async () => seconds((await output.textContent())!)).toBeGreaterThanOrEqual(2);
  const after = await socketRequest(page, room) as RoomState;
  expect(after.rev).toBe(before.rev);
  await page.getByRole('button', { name: 'Pausar temporizador', exact: true }).click();
  await expect(other.locator('.timer-status')).toHaveText('En pausa');
  const paused = (await socketRequest(page, room) as RoomState).items[0] as TimerItem;
  await expect(output).toHaveText(timerText(paused, Date.now()));
  await page.getByRole('button', { name: 'Añadir cronómetro', exact: true }).click();
  await expect(page.getByLabel('Nombre del elemento', { exact: true })).toHaveCount(1);
  await expect(page.locator('.timer-readout')).toHaveText('00:00');
  await page.getByRole('button', { name: 'Iniciar temporizador', exact: true }).click();
  const state = await socketRequest(page, room) as RoomState, second = state.items[1];
  const secondOutput = viewer.locator(`[data-item-id="${second.id}"] .item-timer`);
  await expect.poll(async () => seconds((await secondOutput.textContent())!)).toBeGreaterThanOrEqual(1);
  await expect(output).toHaveText(timerText(paused, Date.now()));
  const x = page.getByRole('spinbutton', { name: 'X', exact: true });
  await x.fill('2200'); await x.press('Enter');
  await expect(secondOutput).toHaveCount(0);
  await expect.poll(async () => seconds((await page.locator('.timer-readout').textContent())!)).toBeGreaterThanOrEqual(2);
  await x.fill('200'); await x.press('Enter');
  await expect.poll(async () => seconds((await secondOutput.textContent())!)).toBeGreaterThanOrEqual(2);
  await page.getByRole('button', { name: 'Reiniciar temporizador', exact: true }).click();
  await expect(secondOutput).toHaveText('00:00');
  await expect(output).toHaveText(timerText(paused, Date.now()));
  await other.close(); await viewer.close();
});

test('temporizadores: permisos, reloj reservado al servidor y duración limitada', async ({ page, request }) => {
  const room = await createRoom(request); await page.goto('/');
  expect((await socketRequest(page, room, { t: 'timer.add', kind: 'countdown', x: 0, y: 0 }, room.viewerKey)).code).toBe('403');
  for (const kind of ['countdown', 'stopwatch']) {
    const added = await socketRequest(page, room, { t: 'timer.add', kind, x: 20, y: 30 }), id = added.op.item.id;
    for (const command of [{ t: 'timer.control', id, action: 'start' }, { t: 'timer.set', id, durationMs: 1000 }]) {
      expect((await socketRequest(page, room, command, room.viewerKey)).code).toBe('403');
    }
    for (const patch of [{ startedAt: 0 }, { elapsedMs: 999 }, { running: true }, { text: 'fake' }, { fill: '#ffffff' }, { volume: .5 }]) {
      expect((await socketRequest(page, room, { t: 'item.patch', id, patch })).code).toBe('400');
    }
    for (const durationMs of [0, -1000, 1500, 86401000, '1000']) {
      expect((await socketRequest(page, room, { t: 'timer.set', id, durationMs })).code).toBe('400');
    }
    if (kind === 'stopwatch') expect((await socketRequest(page, room, { t: 'timer.set', id, durationMs: 1000 })).code).toBe('400');
    else {
      const configured = await socketRequest(page, room, { t: 'timer.set', id, durationMs: 86400000 });
      expect(configured.op.item).toMatchObject({ running: false, durationMs: 86400000, elapsedMs: 0 });
    }
  }
  const text = await socketRequest(page, room, { t: 'text.add', x: 0, y: 0 });
  expect((await socketRequest(page, room, { t: 'timer.control', id: text.op.item.id, action: 'start' })).code).toBe('400');
});
