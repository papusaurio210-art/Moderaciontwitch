import { videoPosition, type Item, type MediaFile } from './model';
import { timerElapsed } from './timers';
import { moveItems } from './editing';

export function copyItems(items: Item[], media: MediaFile[], now: number): Item[] {
  return items.map(item => {
    if (item.type === 'video') return { ...item, playing: false, startedAt: null, position: videoPosition(item, now, media.find(m => m.id === item.mediaId)?.duration ?? 0) };
    if (item.type === 'timer') return { ...item, running: false, startedAt: null, elapsedMs: timerElapsed(item, now) };
    return { ...item };
  });
}
export function pasteItems(items: Item[], offset: number): Item[] {
  return moveItems(items, offset, offset).map(item => ({ ...item, id: crypto.randomUUID(), name: `${item.name.slice(0, 112)} (copia)` }));
}
