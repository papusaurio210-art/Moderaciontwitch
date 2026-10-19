import { boundsOf } from './editing';
import { clamp, type Item, type ItemPatch, type Stage } from './model';

export type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
const directions: Record<ResizeHandle, [number, number]> = {
  nw: [-1, -1], n: [0, -1], ne: [1, -1], e: [1, 0],
  se: [1, 1], s: [0, 1], sw: [-1, 1], w: [-1, 0],
};

/** Keep the opposite edge/corner fixed, including on rotated elements. */
export function resizeItem(item: Item, handle: ResizeHandle, dx: number, dy: number, free = false): ItemPatch {
  const [sx, sy] = directions[handle], angle = item.rot * Math.PI / 180;
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const localX = dx * cos + dy * sin, localY = -dx * sin + dy * cos;
  const proportional = sx !== 0 && sy !== 0 && !free;
  let w = item.w, h = item.h;
  if (proportional) {
    const scale = clamp(1 + (sx * localX * w + sy * localY * h) / (w * w + h * h),
      Math.max(1 / w, 1 / h), Math.min(16384 / w, 16384 / h));
    w *= scale; h *= scale;
  } else {
    if (sx) w = clamp(w + sx * localX, 1, 16384);
    if (sy) h = clamp(h + sy * localY, 1, 16384);
  }
  const geometry = (amount: number) => {
    const dw = (w - item.w) * amount, dh = (h - item.h) * amount;
    return { w: item.w + dw, h: item.h + dh,
      x: item.x + (sx * dw * cos - sy * dh * sin - dw) / 2,
      y: item.y + (sx * dw * sin + sy * dh * cos - dh) / 2 };
  };
  const valid = (box: Stage) => Math.abs(box.x) <= 100000 && Math.abs(box.y) <= 100000;
  let result = geometry(1);
  if (!valid(result)) {
    let low = 0, high = 1;
    for (let i = 0; i < 40; i++) { const mid = (low + high) / 2; if (valid(geometry(mid))) low = mid; else high = mid; }
    result = geometry(low);
  }
  // Changing the box alone with `contain` would leave the picture unstretched.
  return { ...result, ...(!proportional && 'mediaId' in item && (result.w !== item.w || result.h !== item.h) ? { fit: 'fill' as const } : {}) };
}

export function initialMediaSize(stage: Stage, media: { width: number; height: number }) {
  const scale = Math.min(1, stage.w / 2 / media.width);
  return { w: media.width * scale, h: media.height * scale };
}

const overlaps = (a: Stage, b: Stage, gap = 0) => a.x < b.x + b.w + gap && a.x + a.w + gap > b.x
  && a.y < b.y + b.h + gap && a.y + a.h + gap > b.y;

/** New uploads never intersect the broadcast rectangle, even when dropped on it. */
export function uploadPlacement(stage: Stage, size: { w: number; h: number }, occupied: Stage[], at?: { x: number; y: number }): Stage {
  if (at) {
    const candidate = { ...size, x: clamp(at.x, -100000, 100000), y: clamp(at.y, -100000, 100000) };
    if (!overlaps(candidate, stage) && !occupied.some(box => overlaps(candidate, box, 24))) return candidate;
  }
  const step = Math.max(stage.w / 2, size.w) + 64, bottom = stage.y + Math.max(stage.h, size.h);
  for (let x = stage.x + stage.w + 64; x <= 100000; x += step) {
    let y = stage.y;
    while (y <= 100000 && y + size.h <= bottom) {
      const candidate = { ...size, x, y }, collisions = occupied.filter(box => overlaps(candidate, box, 24));
      if (!collisions.length) return candidate;
      y = Math.max(...collisions.map(box => box.y + box.h + 24));
    }
  }
  throw new Error('No queda espacio junto al escenario. Mueve algunos elementos del lienzo e inténtalo de nuevo.');
}

export const occupiedBounds = (items: Item[]) => items.map(boundsOf);
