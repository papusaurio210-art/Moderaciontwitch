import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createRoom, panelUrl, overlayUrl, upload } from '../e2e/helpers';
import { command, geometry, observe, openSocket, peer, renderedGeometry, report, samplePlayback, stats } from './harness';

test('100 elementos, seis vídeos 720p, tres editores y reconexión sin pérdida de cambios', async ({ page, browser, request, baseURL }, info) => {
  const room = await createRoom(request); await page.goto('/');
  const image = await upload(page, request, room);
  const response = await request.post(`/api/rooms/${room.roomId}/media`, { headers: {
    Authorization: `Bearer ${room.editorKey}`, 'Content-Type': 'video/mp4', 'X-File-Name': 'motion-720p.mp4',
    'X-Image-Width': '1280', 'X-Image-Height': '720', 'X-Media-Duration': '4',
  }, data: readFileSync('tests/fixtures/motion-720p.mp4') });
  expect(response.status()).toBe(201); const video = await response.json();
  const seed = await peer(baseURL!, room);
  try {
    for (let n = 0; n < 100; n++) {
      const x = 20 + n % 10 * 185, y = 20 + Math.floor(n / 10) * 100;
      const state = await command(seed, n < 40 ? { t: 'shape.add', shape: 'rect', x, y }
        : n < 70 ? { t: 'text.add', x, y } : n < 90 ? { t: 'item.add', mediaId: image.id, x, y }
        : n < 96 ? { t: 'item.add', mediaId: video.id, x, y } : { t: 'timer.add', kind: 'stopwatch', x, y });
      const item = state.items.at(-1)!;
      await command(seed, { t: 'item.patch', id: item.id, patch: { name: `Carga ${n}`, w: 160, h: 90, ...(item.type === 'text' ? { fontSize: 16 } : {}) } });
      if (item.type === 'timer') await command(seed, { t: 'timer.control', id: item.id, action: 'start' });
    }
    const initial = structuredClone(seed.state); seed.close();
    const contexts = await Promise.all(Array.from({ length: 3 }, () => browser.newContext({ baseURL, viewport: { width: 1440, height: 960 } })));
    try {
      const others = await Promise.all(contexts.map(context => context.newPage()));
      const editors = [page, others[0], others[1]], viewer = others[2], pages = [...editors, viewer];
      const probes = pages.map(observe), loaded = performance.now();
      await Promise.all(pages.map((client, n) => client.goto(n === 3 ? overlayUrl(room) : panelUrl(room))));
      await Promise.all(editors.map(client => expect(client.locator('.canvas-item')).toHaveCount(100)));
      await expect(viewer.locator('.overlay-item')).toHaveCount(100);
      await expect.poll(() => viewer.locator('.overlay-item video').evaluateAll(videos => videos.filter(v => !(v as HTMLVideoElement).paused && (v as HTMLVideoElement).readyState >= 2).length)).toBe(6);
      const readyMs = performance.now() - loaded;
      // Actual UI operations, sent through each panel's own authenticated session.
      await Promise.all(editors.map(async (client, n) => {
        await client.getByRole('tab', { name: 'Capas' }).click();
        await client.getByRole('button', { name: `Carga ${n}`, exact: true }).click();
      }));
      const playback = samplePlayback(viewer, 60000), interactions: number[] = [];
      // Closing a failed test must not leave an unhandled page-evaluation promise.
      void playback.catch(() => {});
      const baseRev = probes[0].state!.rev;
      for (let round = 0; round < 20; round++) {
        const start = performance.now();
        await Promise.all(editors.map(async (client, n) => {
          const field = client.getByRole('spinbutton', { name: 'X', exact: true });
          await field.fill(String(initial.items[n].x + (round + 1) * 3)); await field.press('Enter');
          await expect(client.getByText('Cambios guardados', { exact: true })).toBeVisible();
        }));
        const expectedRev = baseRev + (round + 1) * 3;
        await expect.poll(() => probes.map(p => p.state?.rev)).toEqual(pages.map(() => expectedRev));
        await expect.poll(() => renderedGeometry(viewer, '.overlay-item')).toEqual(geometry(probes[0].state!));
        expect(probes.map(p => p.state)).toEqual(pages.map(() => probes[0].state));
        interactions.push(performance.now() - start);
      }
      const measured = await playback;
      expect(measured.videos).toHaveLength(6);
      expect(measured.videos.every(v => v.frames > 0 && !v.error)).toBe(true);
      expect(probes.flatMap(p => p.ackMs).length).toBe(60);
      expect(stats(probes.flatMap(p => p.ackMs)).p95).toBeLessThan(2500);
      // The disconnected editor must receive a full snapshot including edits it missed.
      await editors[2].evaluate(() => window.dispatchEvent(new Event('offline'))); await contexts[1].setOffline(true);
      await expect(editors[2].getByText('Reconectando', { exact: true })).toBeVisible();
      await expect(editors[2].getByRole('button', { name: 'Añadir texto', exact: true })).toBeDisabled();
      const x = editors[0].getByRole('spinbutton', { name: 'X', exact: true }); await x.fill('77'); await x.press('Enter');
      await expect(editors[0].getByText('Cambios guardados', { exact: true })).toBeVisible();
      const restored = performance.now(); await contexts[1].setOffline(false); await editors[2].evaluate(() => window.dispatchEvent(new Event('online')));
      await expect(editors[2].getByText('Conectado', { exact: true })).toBeVisible();
      await expect.poll(() => probes[2].state).toEqual(probes[0].state);
      await expect.poll(() => renderedGeometry(editors[2], '.canvas-item')).toEqual(geometry(probes[0].state!));
      const recoveryMs = performance.now() - restored;
      // Reload the viewer as OBS would refresh its browser source.
      await viewer.reload(); await expect(viewer.locator('.overlay-item')).toHaveCount(100);
      await expect.poll(() => probes[3].state).toEqual(probes[0].state);
      expect(probes.map(p => p.gaps)).toEqual([0, 0, 0, 0]); expect(probes.flatMap(p => p.errors)).toEqual([]);
      expect(stats(probes.flatMap(p => p.ackMs)).p95).toBeLessThan(2500);
      await report(info, { browser: browser.version(), scenario: '100 mixed / 6 H.264 1280x720 30fps / 3 editors + 1 viewer', readyMs, recoveryMs,
        editorAckMs: stats(probes.flatMap(p => p.ackMs)), threeEditorRoundToOverlayMs: stats(interactions),
        observationMs: measured.durationMs, viewerRafIntervalMs: stats(measured.frameIntervals), viewerLongTaskMs: stats(measured.longTasks), videos: measured.videos });
      await viewer.screenshot({ path: info.outputPath('overlay-load.png'), omitBackground: true });
    } finally { await Promise.all(contexts.map(context => context.close())); }
  } finally { seed.close(); }
});

test('500 elementos: límite, mover y deshacer en grupo, recuperación y aislamiento de una ráfaga', async ({ page, context, request, baseURL }, info) => {
  const room = await createRoom(request), client = await peer(baseURL!, room);
  try {
    await command(client, { t: 'shape.add', shape: 'rect', x: 10, y: 10 });
    while (client.state.items.length < 500) await command(client, { t: 'items.duplicate', ids: client.state.items.slice(0, Math.min(client.state.items.length, 500 - client.state.items.length)).map(i => i.id) });
    const before = structuredClone(client.state);
    expect(await client.send({ t: 'text.add', x: 0, y: 0 })).toMatchObject({ t: 'error', code: '409' });
    expect(client.state).toEqual(before);
    const viewer = await context.newPage(), probes = [observe(page), observe(viewer)];
    await Promise.all([page.goto(panelUrl(room)), viewer.goto(overlayUrl(room))]);
    await expect(page.locator('.canvas-item')).toHaveCount(500); await expect(viewer.locator('.overlay-item')).toHaveCount(500);
    await page.locator('.canvas-item').last().click({ position: { x: 8, y: 8 } });
    await expect(page.locator('.canvas-item.selected')).toHaveCount(1);
    await page.keyboard.press('Control+a');
    await expect(page.locator('.canvas-item.selected')).toHaveCount(500);
    const start = performance.now(); await page.keyboard.press('ArrowRight');
    await expect(page.getByText('Cambios guardados', { exact: true })).toBeVisible();
    await expect.poll(() => probes[0].state?.rev).toBe(before.rev + 1);
    await expect.poll(() => renderedGeometry(viewer, '.overlay-item')).toEqual(geometry(before).map(i => ({ ...i, x: i.x + 1 })));
    const move500Ms = performance.now() - start;
    await page.getByRole('button', { name: 'Deshacer', exact: true }).click();
    await expect.poll(() => renderedGeometry(viewer, '.overlay-item')).toEqual(geometry(before));
    await page.getByRole('button', { name: 'Rehacer', exact: true }).click();
    await expect.poll(() => renderedGeometry(viewer, '.overlay-item')).toEqual(geometry(before).map(i => ({ ...i, x: i.x + 1 })));
    // A separate connection exceeds the rate limit; the legitimate panels stay usable.
    const closeCode = await new Promise<number>((resolve, reject) => {
      const ws = openSocket(baseURL!, room.roomId);
      const timer = setTimeout(() => { ws.close(); reject(new Error('La ráfaga no se cerró dentro del plazo.')); }, 10000);
      ws.onopen = () => ws.send(JSON.stringify({ t: 'hello', key: room.editorKey }));
      ws.onmessage = e => {
        if (JSON.parse(String(e.data)).t === 'welcome') for (let n = 0; n < 240; n++) ws.send(JSON.stringify({ t: 'hello', key: room.editorKey }));
      };
      ws.onclose = event => { clearTimeout(timer); resolve(event.code); };
    });
    expect(closeCode).toBe(1008);
    expect(probes.flatMap(p => p.errors)).toEqual([]);
    await page.keyboard.press('Delete'); await expect(page.locator('.canvas-item')).toHaveCount(0); await expect(viewer.locator('.overlay-item')).toHaveCount(0);
    await page.getByRole('button', { name: 'Deshacer', exact: true }).click(); await expect(viewer.locator('.overlay-item')).toHaveCount(500);
    const confirmed = structuredClone(probes[1].state);
    await page.reload(); await expect(page.locator('.canvas-item')).toHaveCount(500);
    await expect.poll(() => probes[0].state).toEqual(confirmed);
    expect(probes.flatMap(p => p.errors)).toEqual([]);
    expect(probes.map(p => p.gaps)).toEqual([0, 0]);
    await report(info, { scenario: '500 shapes, UI group move/undo/redo/delete, reload, per-connection rate limit', move500Ms, rateLimitCloseCode: closeCode, editorAckMs: stats(probes[0].ackMs) });
  } finally { client.close(); }
});
