import { describe, expect, it } from 'vitest';
import { applyOperation, intersectsStage, type ImageItem, type RoomState } from '../../src/shared/model';
import { clientMessage, imageMime } from '../../src/worker/validation';
import { viewerKeyFromEditor } from '../../src/shared/keys';

const item: ImageItem = { id: crypto.randomUUID(), type: 'image', mediaId: crypto.randomUUID(), name: 'Imagen',
  x: 1900, y: 100, w: 100, h: 100, rot: 0, opacity: 1, locked: false, visible: true };
const state: RoomState = { roomId: 'a'.repeat(32), name: 'Prueba', rev: 4, stage: { x: 0, y: 0, w: 1920, h: 1080 }, items: [item], media: [] };

describe('recorte de la composición', () => {
  it('conserva elementos parcialmente visibles', () => expect(intersectsStage(item, state.stage)).toBe(true));
  it('descarta elementos completamente fuera', () => expect(intersectsStage({ ...item, x: 1920 }, state.stage)).toBe(false));
  it('considera el rectángulo envolvente rotado', () => expect(intersectsStage({ ...item, x: 1925, rot: 45 }, state.stage)).toBe(true));
  it('respeta el origen del escenario', () => expect(intersectsStage({ ...item, x: 100, y: 100 }, { x: 200, y: 200, w: 1920, h: 1080 })).toBe(false));
});
describe('estado compartido', () => {
  it('aplica un cambio canónico sin duplicar el elemento ni mutar el original', () => {
    const result = applyOperation(state, { t: 'item.upsert', item: { ...item, x: 15 } }, 5);
    expect(result.items).toHaveLength(1); expect(result.items[0].x).toBe(15); expect(state.items[0].x).toBe(1900); expect(result.rev).toBe(5);
  });
  it('elimina la referencia de un elemento', () => expect(applyOperation(state, { t: 'item.remove', id: item.id }, 5).items).toEqual([]));
  it('recupera la misma clave de visor sin usar almacenamiento', async () => {
    const key = 'b'.repeat(64), viewer = await viewerKeyFromEditor(key);
    expect(viewer).toMatch(/^[a-f0-9]{64}$/); expect(viewer).not.toBe(key); expect(await viewerKeyFromEditor(key)).toBe(viewer);
  });
});
describe('frontera de validación', () => {
  it.each([{ x: Infinity }, { w: 0 }, { h: 17000 }, { opacity: 2 }, { mediaId: crypto.randomUUID() }, { type: 'video' }, { x: '12' }, {}])('rechaza el parche inválido %j', patch => {
    expect(clientMessage.safeParse({ t: 'item.patch', id: item.id, patch }).success).toBe(false);
  });
  it('permite geometría válida y valores negativos fuera del escenario', () => expect(clientMessage.safeParse({ t: 'item.patch', id: item.id, patch: { x: -80, y: 200, rot: 45 } }).success).toBe(true));
  it('rechaza SVG aunque se presente como una imagen', () => expect(imageMime(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBeNull());
  it('exige una cabecera PNG completa', () => expect(imageMime(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]))).toBeNull());
});
