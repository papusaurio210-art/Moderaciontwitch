import { describe, expect, it } from 'vitest';
import { snapMove } from '../../src/shared/snapping';
import { copyItems, pasteItems } from '../../src/shared/clipboard';
import { boundsOf, historyEntry, historyOperation } from '../../src/shared/editing';
import { applyOperation, defaultTextStyle, type Item, type RoomState } from '../../src/shared/model';
import { clientMessage } from '../../src/worker/validation';
const a: Item = { id: crypto.randomUUID(), type: 'shape', shape: 'rect', name: 'Logo', x: 100, y: 100, w: 100, h: 100, rot: 0, visible: true, locked: false, opacity: 1, fill: null, borderColor: '#ffffff', borderWidth: 1 };
const stage = { x: 0, y: 0, w: 1920, h: 1080 };
const state: RoomState = { roomId: 'a'.repeat(32), name: 'Test', rev: 1, items: [a], media: [], stage };
describe('ajuste magnético', () => {
  it('ajusta al borde del escenario dentro de la tolerancia', () => {
    const result = snapMove([a], [], stage, -97, 0, 6); expect(result.dx).toBe(-100); expect(result.x).toBe(0);
  });
  it('no ajusta fuera de la tolerancia', () => expect(snapMove([a], [], stage, -90, 0, 6)).toEqual({ dx: -90, dy: 0 }));
  it('elige el centro más cercano y considera el zoom mediante la tolerancia', () => {
    expect(snapMove([a], [], stage, 800, 0, 6).x).toBeUndefined();
    expect(snapMove([a], [], stage, 800, 0, 12)).toMatchObject({ dx: 810, x: 960 });
  });
  it('ajusta un grupo por sus límites completos y excluye a sus miembros', () => {
    const b = { ...a, id: crypto.randomUUID(), x: 300 };
    expect(snapMove([a, b], [a, b], stage, -97, 0, 6)).toMatchObject({ dx: -100, x: 0 });
  });
  it('incluye elementos bloqueados como guía y excluye los ocultos', () => {
    const b = { ...a, id: crypto.randomUUID(), x: 500, locked: true };
    expect(snapMove([a], [b], stage, 397, 0, 6)).toMatchObject({ dx: 400, x: 500 });
    expect(snapMove([a], [{ ...b, visible: false }], stage, 397, 0, 6).x).toBeUndefined();
  });
  it('usa los bordes rotados', () => {
    const rotated = { ...a, w: 200, rot: 45 }, b = boundsOf(rotated);
    expect(snapMove([rotated], [], stage, -b.x + 3, 0, 6).dx).toBeCloseTo(-b.x);
  });
  it('no muestra guías imposibles al alcanzar el límite de coordenadas', () => {
    const item = { ...a, x: 99999 }, target = { x: 100006, y: 500, w: 100, h: 100 };
    const result = snapMove([item], [], target, 10, 0, 8); expect(result.dx).toBe(1); expect(result.x).toBeUndefined();
  });
});
describe('portapapeles de la sesión', () => {
  it('copia el aspecto sin mantener referencias mutables y genera identidades nuevas', () => {
    const original = { ...a }, copied = copyItems([original], [], 10000); original.x = 800;
    const pasted = pasteItems(copied, 24); expect(pasted[0].x).toBe(124); expect(pasted[0].id).not.toBe(a.id);
    expect(pasted[0].name).toBe('Logo (copia)'); expect(copied[0].x).toBe(100);
  });
  it('congela el reloj al copiar y conserva esa posición al pegar después', () => {
    const timer: Item = { ...a, ...defaultTextStyle, type: 'timer', kind: 'stopwatch', durationMs: 0, elapsedMs: 500, running: true, startedAt: 1000 };
    const copied = copyItems([timer], [], 3500); expect(copied[0]).toMatchObject({ running: false, startedAt: null, elapsedMs: 3000 });
    expect(pasteItems(copied, 48)[0]).toMatchObject({ elapsedMs: 3000, x: 148 });
  });
  it('congela el vídeo y conserva sonido, volumen y archivo', () => {
    const video: Item = { ...a, type: 'video', mediaId: crypto.randomUUID(), fit: 'contain', loop: false, muted: false, volume: .4, playing: true, position: 2, startedAt: 1000 };
    expect(copyItems([video], [], 3500)[0]).toMatchObject({ mediaId: video.mediaId, position: 4.5, playing: false, startedAt: null, volume: .4, muted: false });
  });
});
describe('tamaño del escenario e historial', () => {
  it('cambia el área visible sin transformar los elementos', () => {
    const next = applyOperation(state, { t: 'stage.set', stage: { ...stage, w: 1080, h: 1920 } }, 2);
    expect(next.items).toBe(state.items); expect(next.stage.h).toBe(1920); expect(next.rev).toBe(2);
    const entry = historyEntry(state.items, next.items, state.stage, next.stage)!;
    const unrelated = { ...next, items: [{ ...a, x: 900 }] };
    const restored = applyOperation(unrelated, historyOperation(unrelated, entry, 'undo')!, 3);
    expect(restored.stage).toEqual(stage); expect(restored.items[0].x).toBe(900);
    expect(applyOperation(restored, historyOperation(restored, entry, 'redo')!, 4).stage).toEqual(next.stage);
    expect(historyOperation({ ...next, stage: { ...stage, w: 1280 } }, entry, 'undo')).toBeNull();
  });
  it.each([0, 63, 3841, 1080.5, Infinity, '1080'])('rechaza dimensiones inválidas %s', w => expect(clientMessage.safeParse({ t: 'stage.resize', w, h: 1080 }).success).toBe(false));
  it.each([64, 1080, 1920, 3840])('permite dimensión %i', w => expect(clientMessage.safeParse({ t: 'stage.resize', w, h: 1080 }).success).toBe(true));
  it.each([{ t: 'stage.resize', w: 1280, h: 720, x: 0 }, { t: 'clipboard.paste', items: [a] }, { t: 'clipboard.copy', ids: [] }, { t: 'clipboard.copy', ids: [a.id, a.id] }])('rechaza campos reservados %j', msg => expect(clientMessage.safeParse(msg).success).toBe(false));
});
