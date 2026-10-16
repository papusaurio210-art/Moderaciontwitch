export interface Stage { x: number; y: number; w: number; h: number }
export interface ImageItem {
  id: string; type: 'image'; mediaId: string; name: string;
  x: number; y: number; w: number; h: number; rot: number;
  opacity: number; visible: boolean; locked: boolean;
}
export type ItemPatch = Partial<Pick<ImageItem, 'name' | 'x' | 'y' | 'w' | 'h' | 'rot' | 'opacity' | 'visible' | 'locked'>>;
export interface MediaFile {
  id: string; name: string; mime: string; size: number;
  width: number; height: number; createdAt: number;
}
export interface RoomState {
  roomId: string; name: string; rev: number; stage: Stage;
  items: ImageItem[]; media: MediaFile[];
}
export type Role = 'editor' | 'viewer';
export type EditCommand =
  | { t: 'item.add'; mediaId: string; x: number; y: number }
  | { t: 'item.patch'; id: string; patch: ItemPatch }
  | { t: 'item.remove'; id: string }
  | { t: 'item.reorder'; ids: string[] };
export type Operation =
  | { t: 'item.upsert'; item: ImageItem }
  | { t: 'item.remove'; id: string }
  | { t: 'item.reorder'; ids: string[] }
  | { t: 'media.add'; media: MediaFile };
export type ServerMessage =
  | { t: 'welcome' | 'state'; role: Role; state: RoomState; serverNow: number }
  | { t: 'op'; rev: number; op: Operation; requestId?: string }
  | { t: 'preview'; id: string; patch: ItemPatch }
  | { t: 'presence'; editors: number; viewers: number }
  | { t: 'error'; code: string; message: string; requestId?: string };

export function applyOperation(state: RoomState, op: Operation, rev: number): RoomState {
  switch (op.t) {
    case 'item.upsert': return { ...state, rev, items: state.items.some(i => i.id === op.item.id)
      ? state.items.map(i => i.id === op.item.id ? op.item : i) : [...state.items, op.item] };
    case 'item.remove': return { ...state, rev, items: state.items.filter(i => i.id !== op.id) };
    case 'item.reorder': return { ...state, rev, items: op.ids.map(id => state.items.find(i => i.id === id)!).filter(Boolean) };
    case 'media.add': return { ...state, rev, media: [...state.media, op.media] };
  }
}

export function intersectsStage(item: ImageItem, stage: Stage): boolean {
  const a = item.rot * Math.PI / 180;
  const w = Math.abs(item.w * Math.cos(a)) + Math.abs(item.h * Math.sin(a));
  const h = Math.abs(item.w * Math.sin(a)) + Math.abs(item.h * Math.cos(a));
  const cx = item.x + item.w / 2, cy = item.y + item.h / 2;
  return cx + w / 2 > stage.x && cx - w / 2 < stage.x + stage.w
    && cy + h / 2 > stage.y && cy - h / 2 < stage.y + stage.h;
}

export const mediaUrl = (roomId: string, id: string) => `/media/${roomId}/${id}`;
export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
