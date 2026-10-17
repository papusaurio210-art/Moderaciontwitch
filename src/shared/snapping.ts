import type { Item, Stage } from './model';
import { clamp } from './model';
import { boundsOf, moveItems, selectionBounds } from './editing';

export interface SnapResult { dx: number; dy: number; x?: number; y?: number }
export function snapMove(items: Item[], others: Item[], stage: Stage, dx: number, dy: number, tolerance: number): SnapResult {
  if (!items.length) return { dx, dy };
  const moved = moveItems(items, dx, dy), box = selectionBounds(moved);
  const selected = new Set(items.map(i => i.id));
  const targets = [stage, ...others.filter(i => i.visible && !selected.has(i.id)).map(boundsOf)];
  const closest = (axis: 'x' | 'y', size: 'w' | 'h') => {
    let best: { correction: number; guide: number } | undefined;
    for (const target of targets) for (const fraction of [0, .5, 1]) for (const own of [0, .5, 1]) {
      const guide = target[axis] + target[size] * fraction, correction = guide - box[axis] - box[size] * own;
      if (Math.abs(correction) <= tolerance && (!best || Math.abs(correction) < Math.abs(best.correction))) best = { correction, guide };
    }
    return best;
  };
  const x = closest('x', 'w'), y = closest('y', 'h');
  const rawX = moved[0].x - items[0].x, rawY = moved[0].y - items[0].y;
  const next = moveItems(items, clamp(rawX + (x?.correction ?? 0), -100000, 100000), clamp(rawY + (y?.correction ?? 0), -100000, 100000));
  const result: SnapResult = { dx: next[0].x - items[0].x, dy: next[0].y - items[0].y };
  if (x && Math.abs(result.dx - rawX - x.correction) < .001) result.x = x.guide;
  if (y && Math.abs(result.dy - rawY - y.correction) < .001) result.y = y.guide;
  return result;
}
