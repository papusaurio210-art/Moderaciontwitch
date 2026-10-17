import { clamp, type BaseItem, type Item, type Operation, type RoomState, type Stage } from './model';

export const alignments = ['left', 'center', 'right', 'top', 'middle', 'bottom'] as const;
export type Alignment = typeof alignments[number];
export function boundsOf(item: BaseItem): Stage {
  const angle = item.rot * Math.PI / 180;
  const w = Math.abs(item.w * Math.cos(angle)) + Math.abs(item.h * Math.sin(angle));
  const h = Math.abs(item.w * Math.sin(angle)) + Math.abs(item.h * Math.cos(angle));
  return { x: item.x + (item.w - w) / 2, y: item.y + (item.h - h) / 2, w, h };
}
export function selectionBounds(items: BaseItem[]): Stage {
  const boxes = items.map(boundsOf), x = Math.min(...boxes.map(b => b.x)), y = Math.min(...boxes.map(b => b.y));
  return { x, y, w: Math.max(...boxes.map(b => b.x + b.w)) - x, h: Math.max(...boxes.map(b => b.y + b.h)) - y };
}
export function moveItems(items: Item[], dx: number, dy: number): Item[] {
  // Clamp one shared delta so the group keeps its relative positions.
  dx = clamp(dx, Math.max(...items.map(i => -100000 - i.x)), Math.min(...items.map(i => 100000 - i.x)));
  dy = clamp(dy, Math.max(...items.map(i => -100000 - i.y)), Math.min(...items.map(i => 100000 - i.y)));
  return items.map(item => ({ ...item, x: item.x + dx, y: item.y + dy }));
}
export function alignItems(items: Item[], alignment: Alignment, target: Stage): Item[] {
  return items.map(item => {
    const b = boundsOf(item);
    const dx = alignment === 'left' ? target.x - b.x : alignment === 'center' ? target.x + target.w / 2 - b.x - b.w / 2 : alignment === 'right' ? target.x + target.w - b.x - b.w : 0;
    const dy = alignment === 'top' ? target.y - b.y : alignment === 'middle' ? target.y + target.h / 2 - b.y - b.h / 2 : alignment === 'bottom' ? target.y + target.h - b.y - b.h : 0;
    return { ...item, x: item.x + dx, y: item.y + dy };
  });
}

export interface HistoryEntry { before: Item[]; after: Item[]; orderBefore?: string[]; orderAfter?: string[]; stageBefore?: Stage; stageAfter?: Stage }
export interface EditHistory { undo: HistoryEntry[]; redo: HistoryEntry[] }
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
export function historyEntry(before: Item[], after: Item[], stageBefore?: Stage, stageAfter?: Stage): HistoryEntry | null {
  const old = new Map(before.map(i => [i.id, i])), next = new Map(after.map(i => [i.id, i]));
  const changed = new Set([...old.keys(), ...next.keys()].filter(id => !same(old.get(id), next.get(id))));
  const orderBefore = before.map(i => i.id), orderAfter = after.map(i => i.id), reordered = !same(orderBefore, orderAfter);
  const resized = stageBefore && stageAfter && !same(stageBefore, stageAfter);
  if (!changed.size && !reordered && !resized) return null;
  return { before: before.filter(i => changed.has(i.id)), after: after.filter(i => changed.has(i.id)), ...(reordered ? { orderBefore, orderAfter } : {}), ...(resized ? { stageBefore, stageAfter } : {}) };
}
export function historyOperation(state: RoomState, entry: HistoryEntry, direction: 'undo' | 'redo'): Operation | null {
  if (entry.stageBefore && entry.stageAfter) {
    if (!same(state.stage, direction === 'undo' ? entry.stageAfter : entry.stageBefore)) return null;
    return { t: 'stage.set', stage: direction === 'undo' ? entry.stageBefore : entry.stageAfter };
  }
  const expected = direction === 'undo' ? entry.after : entry.before, restore = direction === 'undo' ? entry.before : entry.after;
  const expectedOrder = direction === 'undo' ? entry.orderAfter : entry.orderBefore, order = direction === 'undo' ? entry.orderBefore : entry.orderAfter;
  const ids = new Set([...expected, ...restore].map(i => i.id));
  // Never overwrite another editor's changes. Unrelated property edits remain intact.
  for (const id of ids) if (!same(state.items.find(i => i.id === id), expected.find(i => i.id === id))) return null;
  if (expectedOrder && !same(state.items.map(i => i.id), expectedOrder)) return null;
  const removed = [...ids].filter(id => !restore.some(i => i.id === id));
  if (state.items.length - removed.length + restore.filter(i => !state.items.some(s => s.id === i.id)).length > 500) return null;
  return { t: 'items.change', upserts: restore, removed, ...(order ? { order } : {}) };
}
export function trimHistory(history: EditHistory): EditHistory {
  history.undo = history.undo.slice(-30); history.redo = history.redo.slice(-30);
  while (JSON.stringify(history).length > 500000 && history.undo.length) history.undo.shift();
  while (JSON.stringify(history).length > 500000 && history.redo.length) history.redo.shift();
  return history;
}
