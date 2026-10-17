import { describe, expect, it } from 'vitest';
import { alignItems, boundsOf, historyEntry, historyOperation, moveItems, selectionBounds, trimHistory } from '../../src/shared/editing';
import { applyOperation, type Item, type RoomState } from '../../src/shared/model';
import { clientMessage } from '../../src/worker/validation';
const a: Item = { id: crypto.randomUUID(), type: 'shape', shape: 'rect', name: 'A', x: 10, y: 20, w: 100, h: 40, rot: 0, visible: true, locked: false, opacity: 1, fill: null, borderColor: '#ffffff', borderWidth: 1 };
const b: Item = { ...a, id: crypto.randomUUID(), name: 'B', x: 300, y: 200, w: 50, h: 60 };
const stage = { x: 0, y: 0, w: 1920, h: 1080 };
const state = (items: Item[]): RoomState => ({ roomId: 'a'.repeat(32), name: 'Test', rev: 1, items, media: [], stage });
describe('edición en grupo', () => {
  it('limita el desplazamiento compartido sin deformar la distancia', () => {
    const result = moveItems([{ ...a, x: 99990 }, { ...b, x: 99980 }], 100, -25);
    expect(result.map(i => i.x)).toEqual([100000, 99990]); expect(result[0].y).toBe(-5); expect(a.x).toBe(10);
  });
  it('calcula los límites rotados para selección y alineación', () => {
    const rotated = { ...a, rot: 90 }, bounds = boundsOf(rotated);
    expect(bounds.w).toBeCloseTo(40); expect(bounds.h).toBeCloseTo(100);
    const aligned = alignItems([rotated], 'left', stage)[0]; expect(boundsOf(aligned).x).toBeCloseTo(0);
  });
  it.each(['left', 'center', 'right', 'top', 'middle', 'bottom'] as const)('alinea %s a los límites de la selección', alignment => {
    const items = alignItems([a, b], alignment, selectionBounds([a, b]));
    const points = items.map(i => alignment === 'left' ? i.x : alignment === 'right' ? i.x + i.w : alignment === 'center' ? i.x + i.w / 2 : alignment === 'top' ? i.y : alignment === 'bottom' ? i.y + i.h : i.y + i.h / 2);
    expect(points[0]).toBeCloseTo(points[1]);
  });
  it('centra un elemento respecto a un escenario con origen desplazado', () => expect(alignItems([a], 'center', { ...stage, x: 100 })[0].x).toBe(1010));
  it.each([
    { t: 'items.move', ids: [], dx: 0, dy: 0 },
    { t: 'items.move', ids: [a.id, a.id], dx: 0, dy: 0 },
    { t: 'items.move', ids: [a.id], dx: Infinity, dy: 0 },
    { t: 'items.align', ids: [a.id], alignment: 'invalid', target: 'stage' },
    { t: 'items.duplicate', ids: [a.id], item: a },
    { t: 'history.undo', items: [a] },
    { t: 'items.change', upserts: [a], removed: [] },
  ])('rechaza comandos inválidos y restauraciones del cliente %j', command => expect(clientMessage.safeParse(command).success).toBe(false));
});
describe('historial protegido', () => {
  it('deshace y rehace un grupo en una sola revisión', () => {
    const before = [a, b], after = moveItems(before, 35, -20), entry = historyEntry(before, after)!;
    const restored = applyOperation(state(after), historyOperation(state(after), entry, 'undo')!, 2);
    expect(restored.items).toEqual(before); expect(restored.rev).toBe(2);
    expect(applyOperation(restored, historyOperation(restored, entry, 'redo')!, 3).items).toEqual(after);
  });
  it('conserva cambios de otro editor en elementos ajenos', () => {
    const after = { ...a, x: 99 }, entry = historyEntry([a, b], [after, b])!;
    const current = state([after, { ...b, opacity: .3 }]);
    expect(applyOperation(current, historyOperation(current, entry, 'undo')!, 2).items).toEqual([a, { ...b, opacity: .3 }]);
  });
  it('rechaza restaurar elementos modificados por otro editor', () => {
    const after = { ...a, x: 99 }, entry = historyEntry([a], [after])!;
    expect(historyOperation(state([{ ...after, opacity: .3 }]), entry, 'undo')).toBeNull();
  });
  it('restaura eliminaciones en su orden original y detecta reordenaciones ajenas', () => {
    const entry = historyEntry([a, b], [b])!;
    expect(applyOperation(state([b]), historyOperation(state([b]), entry, 'undo')!, 2).items).toEqual([a, b]);
    const reorder = historyEntry([a, b], [b, a])!;
    expect(historyOperation(state([a, b]), reorder, 'undo')).toBeNull();
  });
  it('no registra cambios vacíos y limita el historial', () => {
    expect(historyEntry([a], [a])).toBeNull();
    const entry = historyEntry([a], [b])!;
    expect(trimHistory({ undo: Array(50).fill(entry), redo: [] }).undo).toHaveLength(30);
    const big = { before: Array(500).fill({ ...a, name: 'x'.repeat(4000) }), after: [] };
    expect(trimHistory({ undo: [big], redo: [] }).undo).toHaveLength(0);
  });
});
