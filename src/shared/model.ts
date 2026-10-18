export interface Stage { x: number; y: number; w: number; h: number }
export interface BaseItem {
  id: string; name: string;
  x: number; y: number; w: number; h: number; rot: number;
  opacity: number; visible: boolean; locked: boolean;
}
export type Fit = 'contain' | 'cover' | 'fill';
export interface ImageItem extends BaseItem { type: 'image' | 'gif'; mediaId: string; fit?: Fit }
export interface VideoItem extends BaseItem {
  type: 'video'; mediaId: string; fit: Fit;
  loop: boolean; muted: boolean; volume?: number; playing: boolean; position: number; startedAt: number | null;
}
export interface TextStyle {
  fontFamily: 'Inter' | 'JetBrains Mono' | 'Arial' | 'Georgia'; fontSize: number;
  color: string; bold: boolean; italic: boolean; align: 'left' | 'center' | 'right';
  strokeColor: string; strokeWidth: number; shadow: boolean; background: string | null;
}
export interface TextItem extends BaseItem, TextStyle { type: 'text'; text: string }
export type TimerKind = 'countdown' | 'stopwatch';
export type TimerAction = 'start' | 'pause' | 'reset';
export interface TimerItem extends BaseItem, TextStyle {
  type: 'timer'; kind: TimerKind; durationMs: number; elapsedMs: number; running: boolean; startedAt: number | null;
}
export const shapeKinds = ['rect', 'ellipse', 'line', 'arrow'] as const;
export type ShapeKind = typeof shapeKinds[number];
export interface ShapeStyle { fill: string | null; borderColor: string; borderWidth: number }
export interface ShapeItem extends BaseItem, ShapeStyle { type: 'shape'; shape: ShapeKind }
export const shapeDefaults: Record<ShapeKind, ShapeStyle & { name: string; w: number; h: number }> = {
  rect: { name: 'Rectángulo', w: 360, h: 220, fill: '#8c70ff', borderColor: '#ffffff', borderWidth: 0 },
  ellipse: { name: 'Círculo', w: 240, h: 240, fill: '#8c70ff', borderColor: '#ffffff', borderWidth: 0 },
  line: { name: 'Línea', w: 360, h: 32, fill: null, borderColor: '#ffffff', borderWidth: 6 },
  arrow: { name: 'Flecha', w: 360, h: 80, fill: null, borderColor: '#ffffff', borderWidth: 8 },
};
export type Item = ImageItem | VideoItem | TextItem | ShapeItem | TimerItem;
export type ItemPatch = Partial<Omit<BaseItem, 'id'> & TextStyle & ShapeStyle & { text: string; fit: Fit; loop: boolean; muted: boolean; volume: number }>;
export const defaultTextStyle: TextStyle = {
  fontFamily: 'Inter', fontSize: 64, color: '#ffffff', bold: true, italic: false, align: 'left',
  strokeColor: '#000000', strokeWidth: 0, shadow: false, background: null,
};
export interface MediaFile {
  id: string; name: string; mime: string; size: number;
  width: number; height: number; createdAt: number; duration?: number;
}
export interface RoomState {
  roomId: string; name: string; rev: number; stage: Stage;
  items: Item[]; media: MediaFile[];
}
export type Role = 'editor' | 'viewer';
export type EditCommand =
  | { t: 'media.rename'; id: string; name: string }
  | { t: 'media.remove'; id: string }
  | { t: 'stage.resize'; w: number; h: number }
  | { t: 'clipboard.copy'; ids: string[] }
  | { t: 'clipboard.paste' }
  | { t: 'items.move'; ids: string[]; dx: number; dy: number }
  | { t: 'items.align'; ids: string[]; alignment: import('./editing').Alignment; target: 'selection' | 'stage' }
  | { t: 'items.duplicate' | 'items.remove'; ids: string[] }
  | { t: 'history.undo' | 'history.redo' }
  | { t: 'item.add'; mediaId: string; x: number; y: number }
  | { t: 'text.add'; x: number; y: number }
  | { t: 'shape.add'; shape: ShapeKind; x: number; y: number }
  | { t: 'timer.add'; kind: TimerKind; x: number; y: number }
  | { t: 'timer.control'; id: string; action: TimerAction }
  | { t: 'timer.set'; id: string; durationMs: number }
  | { t: 'video.control'; id: string; action: 'play' | 'pause' | 'restart' }
  | { t: 'item.patch'; id: string; patch: ItemPatch }
  | { t: 'item.remove'; id: string }
  | { t: 'item.reorder'; ids: string[] };
export type Operation =
  | { t: 'media.rename'; id: string; name: string }
  | { t: 'media.remove'; id: string }
  | { t: 'stage.set'; stage: Stage }
  | { t: 'items.change'; upserts: Item[]; removed: string[]; order?: string[] }
  | { t: 'item.upsert'; item: Item }
  | { t: 'item.remove'; id: string }
  | { t: 'item.reorder'; ids: string[] }
  | { t: 'media.add'; media: MediaFile };
export type ServerMessage =
  | { t: 'clipboard'; count: number; requestId?: string }
  | { t: 'history'; undo: number; redo: number }
  | { t: 'welcome' | 'state'; role: Role; state: RoomState; serverNow: number }
  | { t: 'op'; rev: number; op: Operation; requestId?: string }
  | { t: 'previews'; patches: { id: string; patch: ItemPatch }[] }
  | { t: 'preview'; id: string; patch: ItemPatch }
  | { t: 'presence'; editors: number; viewers: number }
  | { t: 'error'; code: string; message: string; requestId?: string };

export function applyOperation(state: RoomState, op: Operation, rev: number): RoomState {
  switch (op.t) {
    case 'media.rename': return { ...state, rev, media: state.media.map(m => m.id === op.id ? { ...m, name: op.name } : m) };
    case 'media.remove': return { ...state, rev, media: state.media.filter(m => m.id !== op.id) };
    case 'stage.set': return { ...state, rev, stage: op.stage };
    case 'items.change': {
      const updates = new Map(op.upserts.map(i => [i.id, i]));
      const items = state.items.filter(i => !op.removed.includes(i.id)).map(i => updates.get(i.id) ?? i);
      items.push(...op.upserts.filter(i => !state.items.some(old => old.id === i.id)));
      return { ...state, rev, items: op.order ? op.order.map(id => items.find(i => i.id === id)!).filter(Boolean) : items };
    }
    case 'item.upsert': return { ...state, rev, items: state.items.some(i => i.id === op.item.id)
      ? state.items.map(i => i.id === op.item.id ? op.item : i) : [...state.items, op.item] };
    case 'item.remove': return { ...state, rev, items: state.items.filter(i => i.id !== op.id) };
    case 'item.reorder': return { ...state, rev, items: op.ids.map(id => state.items.find(i => i.id === id)!).filter(Boolean) };
    case 'media.add': return { ...state, rev, media: [...state.media, op.media] };
  }
}

export function intersectsStage(item: BaseItem, stage: Stage): boolean {
  const a = item.rot * Math.PI / 180;
  const w = Math.abs(item.w * Math.cos(a)) + Math.abs(item.h * Math.sin(a));
  const h = Math.abs(item.w * Math.sin(a)) + Math.abs(item.h * Math.cos(a));
  const cx = item.x + item.w / 2, cy = item.y + item.h / 2;
  return cx + w / 2 > stage.x && cx - w / 2 < stage.x + stage.w
    && cy + h / 2 > stage.y && cy - h / 2 < stage.y + stage.h;
}

export const mediaUrl = (roomId: string, id: string) => `/media/${roomId}/${id}`;
export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function videoPosition(item: VideoItem, now: number, duration: number): number {
  const elapsed = item.position + (item.playing && item.startedAt !== null ? Math.max(0, now - item.startedAt) / 1000 : 0);
  if (!Number.isFinite(duration) || duration <= 0) return elapsed;
  return item.loop ? elapsed % duration : Math.min(duration, elapsed);
}
