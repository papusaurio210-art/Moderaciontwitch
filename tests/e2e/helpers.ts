import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
export const admin = readFileSync('.dev.vars', 'utf8').match(/^ADMIN_SECRET=(.+)$/m)![1].trim();
export type Room = { roomId: string; editorKey: string; viewerKey: string };
export const panelUrl = (room: Room) => `/panel/${room.roomId}#key=${room.editorKey}`;
export const overlayUrl = (room: Room) => `/overlay/${room.roomId}?k=${room.viewerKey}`;
// Uploads now wait outside the broadcast area; tests of on-air media explicitly place them inside.
export async function moveSelectedToStage(page: Page, position = { X: 120, Y: 120 }) {
  await expect(page.locator('.canvas-item.selected')).toHaveCount(1);
  for (const [axis, value] of Object.entries(position)) {
    const input = page.getByRole('spinbutton', { name: axis, exact: true });
    await input.fill(String(value)); await input.press('Enter');
    await expect(input).toHaveValue(String(value));
    await expect(page.getByText('Cambios guardados', { exact: true })).toBeVisible();
  }
}
export async function createRoom(request: APIRequestContext): Promise<Room> {
  const response = await request.post('/api/rooms', { headers: { Authorization: `Bearer ${admin}` }, data: { name: 'Canal de prueba' } });
  expect(response.status()).toBe(201); return response.json();
}
export async function socketRequest(page: Page, room: Room, command?: unknown, key = room.editorKey): Promise<any> {
  return page.evaluate(({ roomId, key, command }) => new Promise((resolve, reject) => {
    const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws/${roomId}`);
    const timeout = setTimeout(() => { ws.close(); reject(new Error('WebSocket timeout')); }, 8000);
    ws.onopen = () => ws.send(JSON.stringify({ t: 'hello', key }));
    ws.onmessage = event => {
      const msg = JSON.parse(event.data);
      if (msg.t === 'welcome') {
        if (command) ws.send(JSON.stringify(command));
        else { clearTimeout(timeout); ws.close(); resolve(msg.state); }
      }
      if (msg.t === 'op' || msg.t === 'error') { clearTimeout(timeout); ws.close(); resolve(msg); }
    };
    ws.onclose = event => { clearTimeout(timeout); resolve({ closed: event.code }); };
    ws.onerror = () => { clearTimeout(timeout); reject(new Error('WebSocket failed')); };
  }), { roomId: room.roomId, key, command });
}
export async function png(page: Page) {
  const data = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 720; canvas.height = 405;
    const ctx = canvas.getContext('2d')!; const gradient = ctx.createLinearGradient(0, 0, 720, 405);
    gradient.addColorStop(0, '#7857e8'); gradient.addColorStop(1, '#253c57'); ctx.fillStyle = gradient; ctx.fillRect(0, 0, 720, 405);
    ctx.fillStyle = '#ffffff0c'; ctx.beginPath(); ctx.arc(635, 70, 220, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#8bffd3'; ctx.font = '18px sans-serif'; ctx.fillText('MI CANAL / EN DIRECTO', 58, 110);
    ctx.fillStyle = 'white'; ctx.font = 'bold 48px sans-serif'; ctx.fillText('Ya estamos aquí.', 58, 195);
    ctx.fillStyle = '#d6cbf1'; ctx.font = '22px sans-serif'; ctx.fillText('Bienvenidos a un nuevo directo.', 58, 245);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  return Buffer.from(data, 'base64');
}
export async function upload(page: Page, request: APIRequestContext, room: Room) {
  const response = await request.post(`/api/rooms/${room.roomId}/media`, { headers: {
    Authorization: `Bearer ${room.editorKey}`, 'Content-Type': 'image/png', 'X-Image-Width': '720', 'X-Image-Height': '405', 'X-File-Name': 'bienvenida.png',
  }, data: await png(page) });
  expect(response.status()).toBe(201); return response.json();
}
