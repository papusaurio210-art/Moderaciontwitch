import { describe, expect, it } from 'vitest';
import { initialMediaSize, resizeItem, uploadPlacement, type ResizeHandle } from '../../src/shared/canvas-geometry';
import { intersectsStage, type ImageItem, type Stage } from '../../src/shared/model';

const stage = { x: 0, y: 0, w: 1920, h: 1080 };
const image: ImageItem = { id: 'image', mediaId: 'media', name: 'Imagen', type: 'image',
  x: 100, y: 200, w: 400, h: 200, rot: 0, opacity: 1, visible: true, locked: false, fit: 'contain' };
const point = (box: typeof image, x: number, y: number) => {
  const a = box.rot * Math.PI / 180;
  return [box.x + box.w / 2 + x * box.w / 2 * Math.cos(a) - y * box.h / 2 * Math.sin(a),
    box.y + box.h / 2 + x * box.w / 2 * Math.sin(a) + y * box.h / 2 * Math.cos(a)];
};

describe('preparación de archivos fuera del directo', () => {
  it('coloca lotes de diferentes tamaños sin tocar el escenario ni superponerse', () => {
    const occupied: Stage[] = [];
    for (const size of [{ w: 720, h: 405 }, { w: 96, h: 54 }, { w: 960, h: 540 }, { w: 300, h: 1200 }]) {
      const placed = uploadPlacement(stage, size, occupied);
      expect(intersectsStage({ ...image, ...placed }, stage)).toBe(false);
      for (const previous of occupied) expect(intersectsStage({ ...image, ...placed }, previous)).toBe(false);
      occupied.push(placed);
    }
  });
  it('respeta una entrega exterior y redirige una entrega interior o parcialmente solapada', () => {
    expect(uploadPlacement(stage, { w: 100, h: 100 }, [], { x: -200, y: 200 })).toMatchObject({ x: -200, y: 200 });
    for (const at of [{ x: 100, y: 100 }, { x: -50, y: 100 }]) {
      const placed = uploadPlacement(stage, { w: 100, h: 100 }, [], at);
      expect(intersectsStage({ ...image, ...placed }, stage)).toBe(false);
    }
  });
  it('adapta tamaño y posición al formato del escenario', () => {
    const portrait = { x: 0, y: 0, w: 1080, h: 1920 };
    const size = initialMediaSize(portrait, { width: 1920, height: 1080 });
    expect(size).toEqual({ w: 540, h: 303.75 });
    expect(uploadPlacement(portrait, size, [])).toMatchObject({ x: 1144, y: 0 });
  });
});

describe('tiradores de tamaño', () => {
  it.each([
    ['w', -80, 0, { x: 20, y: 200, w: 480, h: 200 }],
    ['e', 80, 0, { x: 100, y: 200, w: 480, h: 200 }],
    ['n', 0, -60, { x: 100, y: 140, w: 400, h: 260 }],
    ['s', 0, 60, { x: 100, y: 200, w: 400, h: 260 }],
  ] as const)('estira desde %s y mantiene fijo el lado opuesto', (handle, dx, dy, expected) => {
    expect(resizeItem(image, handle, dx, dy)).toMatchObject({ ...expected, fit: 'fill' });
  });
  const handles: [ResizeHandle, number, number][] = [
    ['nw', -1, -1], ['n', 0, -1], ['ne', 1, -1], ['e', 1, 0],
    ['se', 1, 1], ['s', 0, 1], ['sw', -1, 1], ['w', -1, 0],
  ];
  it.each(handles)('mantiene el anclaje al arrastrar %s sobre una imagen rotada', (handle, sx, sy) => {
    const original = { ...image, rot: 37 }, a = original.rot * Math.PI / 180;
    const dx = sx * 80 * Math.cos(a) - sy * 40 * Math.sin(a), dy = sx * 80 * Math.sin(a) + sy * 40 * Math.cos(a);
    const resized = { ...original, ...resizeItem(original, handle, dx, dy) };
    const before = point(original, -sx, -sy), after = point(resized, -sx, -sy);
    expect(after[0]).toBeCloseTo(before[0]); expect(after[1]).toBeCloseTo(before[1]);
    if (sx && sy) { expect(resized.w / resized.h).toBeCloseTo(original.w / original.h); expect(resized.fit).toBe('contain'); }
  });
  it('una esquina también responde a un arrastre vertical; Shift libera las proporciones', () => {
    expect(resizeItem(image, 'se', 0, 100).w).toBeGreaterThan(image.w);
    expect(resizeItem(image, 'se', 0, 100, true)).toMatchObject({ w: 400, h: 300, fit: 'fill' });
  });
  it('limita tamaños y coordenadas sin invertir el elemento ni desplazar el anclaje', () => {
    expect(resizeItem(image, 'w', 100000, 0)).toMatchObject({ w: 1, x: 499 });
    expect(resizeItem(image, 's', 0, 100000)).toMatchObject({ h: 16384 });
    const original = { ...image, x: -99999 };
    const resized = { ...original, ...resizeItem(original, 'w', -1000, 0) };
    expect(resized.x).toBeGreaterThanOrEqual(-100000);
    expect(resized.x + resized.w).toBeCloseTo(original.x + original.w);
  });
});
