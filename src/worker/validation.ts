import { z } from 'zod';

const coordinate = z.number().finite().min(-100_000).max(100_000);
const id = z.string().uuid();
const geometry = {
  x: coordinate, y: coordinate,
  w: z.number().finite().min(1).max(16_384), h: z.number().finite().min(1).max(16_384),
  rot: z.number().finite().min(-360).max(360),
};
export const previewPatch = z.object(geometry).partial().strict();
export const itemPatch = z.object({ ...geometry,
  name: z.string().trim().min(1).max(120),
  opacity: z.number().finite().min(0).max(1), visible: z.boolean(), locked: z.boolean(),
}).partial().strict().refine(p => Object.keys(p).length > 0);
const requestId = z.string().max(80).optional();
export const clientMessage = z.discriminatedUnion('t', [
  z.object({ t: z.literal('hello'), key: z.string().regex(/^[a-f0-9]{64}$/) }).strict(),
  z.object({ t: z.literal('sync') }).strict(),
  z.object({ t: z.literal('item.add'), mediaId: id, x: coordinate, y: coordinate, requestId }).strict(),
  z.object({ t: z.literal('item.patch'), id, patch: itemPatch, requestId }).strict(),
  z.object({ t: z.literal('item.preview'), id, patch: previewPatch }).strict(),
  z.object({ t: z.literal('item.remove'), id, requestId }).strict(),
  z.object({ t: z.literal('item.reorder'), ids: z.array(id).max(500), requestId }).strict(),
]);

export const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
export const MAX_ROOM_BYTES = 500 * 1024 * 1024;
export function imageMime(bytes: Uint8Array): string | null {
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));
  if (bytes.length >= 24 && [137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => bytes[i] === b)
    && ascii(12, 16) === 'IHDR') return 'image/png';
  if (bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
  if (bytes.length >= 16 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP'
    && ['VP8 ', 'VP8L', 'VP8X'].includes(ascii(12, 16))) return 'image/webp';
  return null;
}
