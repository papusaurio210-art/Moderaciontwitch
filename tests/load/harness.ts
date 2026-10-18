import { expect, type Page, type TestInfo } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { applyOperation, type EditCommand, type RoomState, type ServerMessage } from '../../src/shared/model';
import type { Room } from '../e2e/helpers';

export function openSocket(origin: string, roomId: string) {
  // Node's built-in WebSocket supports headers; unlike a browser it does not
  // supply Origin automatically. Preserve the application's same-origin check.
  const NodeSocket = WebSocket as unknown as new (url: string, options: { headers: Record<string, string> }) => WebSocket;
  return new NodeSocket(`${origin.replace(/^http/, 'ws')}/ws/${roomId}`, { headers: { Origin: origin } });
}
export async function peer(origin: string, room: Room) {
  const ws = openSocket(origin, room.roomId);
  let state: RoomState;
  const pending = new Map<string, { resolve: (message: ServerMessage) => void; reject: (error: Error) => void }>();
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => { ws.close(); reject(new Error('El cliente de preparación no pudo autenticarse.')); }, 10000);
    ws.addEventListener('open', () => ws.send(JSON.stringify({ t: 'hello', key: room.editorKey })));
    ws.addEventListener('message', event => {
      const message = JSON.parse(String(event.data)) as ServerMessage;
      if (message.t === 'welcome' || message.t === 'state') { state = message.state; clearTimeout(timer); resolve(); }
      if (message.t === 'op') state = applyOperation(state, message.op, message.rev);
      if ('requestId' in message && message.requestId) pending.get(message.requestId)?.resolve(message);
    });
    ws.addEventListener('error', () => { clearTimeout(timer); reject(new Error('Error de conexión del cliente de preparación.')); });
    ws.addEventListener('close', () => { clearTimeout(timer); if (!state) reject(new Error('La conexión se cerró antes de autenticar.')); for (const task of pending.values()) task.reject(new Error('El cliente de preparación se desconectó.')); });
  });
  return {
    get state() { return state!; },
    async send(command: EditCommand): Promise<ServerMessage> {
      // Preparation must not accidentally exercise the abuse limiter.
      await delay(10);
      const requestId = crypto.randomUUID();
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => { pending.delete(requestId); reject(new Error('Operación sin respuesta en 10 s.')); }, 10000);
        const cleanup = () => { clearTimeout(timer); pending.delete(requestId); };
        pending.set(requestId, { resolve: message => { cleanup(); resolve(message); }, reject: error => { cleanup(); reject(error); } });
        ws.send(JSON.stringify({ ...command, requestId }));
      });
    },
    close() { ws.close(); },
  };
}
export type Peer = Awaited<ReturnType<typeof peer>>;
export async function command(client: Peer, message: EditCommand) {
  const reply = await client.send(message);
  expect(reply.t, reply.t === 'error' ? reply.message : undefined).toBe('op');
  return client.state;
}

export function observe(page: Page) {
  const probe = { state: null as RoomState | null, gaps: 0, welcomes: 0, ackMs: [] as number[], errors: [] as string[] };
  const starts = new Map<string, number>();
  page.on('pageerror', error => probe.errors.push(error.message.replace(/[a-f0-9]{64}/g, '[redacted]')));
  page.on('websocket', socket => {
    if (!new URL(socket.url()).pathname.startsWith('/ws/')) return;
    socket.on('framesent', ({ payload }) => {
      if (payload === 'ping') return;
      const message = JSON.parse(String(payload));
      if (message.requestId) starts.set(message.requestId, performance.now());
    });
    socket.on('framereceived', ({ payload }) => {
      if (payload === 'pong') return;
      const message = JSON.parse(String(payload)) as ServerMessage;
      if (message.t === 'welcome' || message.t === 'state') { probe.state = message.state; probe.welcomes++; }
      if (message.t === 'op' && probe.state) {
        if (message.rev !== probe.state.rev + 1) probe.gaps++;
        probe.state = applyOperation(probe.state, message.op, message.rev);
        if (message.requestId && starts.has(message.requestId)) {
          probe.ackMs.push(performance.now() - starts.get(message.requestId)!); starts.delete(message.requestId);
        }
      }
      if (message.t === 'error') probe.errors.push(`Protocolo ${message.code}: ${message.message}`);
    });
  });
  return probe;
}
export async function renderedGeometry(page: Page, selector: string) {
  return page.locator(selector).evaluateAll(nodes => nodes.map(node => {
    const el = node as HTMLElement;
    return { id: el.dataset.itemId!, x: parseFloat(el.style.left), y: parseFloat(el.style.top), w: parseFloat(el.style.width), h: parseFloat(el.style.height) };
  }));
}
export function geometry(state: RoomState) {
  return state.items.map(({ id, x, y, w, h }) => ({ id, x, y, w, h }));
}
export function stats(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b), round = (n: number) => Math.round(n * 10) / 10;
  return { samples: values.length, p50: round(sorted[Math.floor((sorted.length - 1) * .5)] ?? 0), p95: round(sorted[Math.ceil(sorted.length * .95) - 1] ?? 0), max: round(sorted.at(-1) ?? 0) };
}
export async function report(info: TestInfo, data: Record<string, unknown>) {
  const content = JSON.stringify({ environment: 'Local Chromium + Wrangler, Linux; no equivale a OBS ni a producción', node: process.version, ...data }, null, 2);
  const path = info.outputPath('metrics.json'); await writeFile(path, content);
  await info.attach('metrics', { path, contentType: 'application/json' });
  console.log(content);
}
export async function samplePlayback(page: Page, duration: number) {
  return page.evaluate(duration => new Promise<{ durationMs: number; frameIntervals: number[]; longTasks: number[]; videos: { frames: number; dropped: number; error: boolean }[] }>(resolve => {
    const videos = Array.from(document.querySelectorAll<HTMLVideoElement>('.overlay-item video'));
    const start = performance.now(), initial = videos.map(video => video.getVideoPlaybackQuality());
    const frameIntervals: number[] = [], longTasks: number[] = [];
    const observer = new PerformanceObserver(list => { for (const entry of list.getEntries()) longTasks.push(entry.duration); });
    observer.observe({ type: 'longtask' });
    let previous = start, animation = 0;
    const frame = (now: number) => { frameIntervals.push(now - previous); previous = now; animation = requestAnimationFrame(frame); };
    animation = requestAnimationFrame(frame);
    setTimeout(() => {
      cancelAnimationFrame(animation); observer.disconnect();
      resolve({ durationMs: performance.now() - start, frameIntervals, longTasks,
        videos: videos.map((video, i) => { const quality = video.getVideoPlaybackQuality(); return { frames: quality.totalVideoFrames - initial[i].totalVideoFrames, dropped: quality.droppedVideoFrames - initial[i].droppedVideoFrames, error: !!video.error || video.paused }; }),
      });
    }, duration);
  }), duration);
}
