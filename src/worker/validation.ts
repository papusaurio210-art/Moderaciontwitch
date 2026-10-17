import { z } from 'zod';
import { shapeKinds } from '../shared/model';

const coordinate = z.number().finite().min(-100_000).max(100_000);
const id = z.string().uuid();
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const geometry = {
  x: coordinate, y: coordinate,
  w: z.number().finite().min(1).max(16_384), h: z.number().finite().min(1).max(16_384),
  rot: z.number().finite().min(-360).max(360),
};
export const previewPatch = z.object(geometry).partial().strict();
export const itemPatch = z.object({ ...geometry,
  name: z.string().trim().min(1).max(120),
  opacity: z.number().finite().min(0).max(1), visible: z.boolean(), locked: z.boolean(),
  text: z.string().max(4000), fontFamily: z.enum(['Inter', 'JetBrains Mono', 'Arial', 'Georgia']),
  fontSize: z.number().finite().min(8).max(512), color, bold: z.boolean(), italic: z.boolean(),
  align: z.enum(['left', 'center', 'right']), strokeColor: color,
  strokeWidth: z.number().finite().min(0).max(16), shadow: z.boolean(), background: color.nullable(),
  fit: z.enum(['contain', 'cover', 'fill']), loop: z.boolean(), muted: z.boolean(),
  volume: z.number().finite().min(0).max(1),
  fill: color.nullable(), borderColor: color, borderWidth: z.number().finite().min(0).max(64),
}).partial().strict().refine(p => Object.keys(p).length > 0);
const requestId = z.string().max(80).optional();
export const clientMessage = z.discriminatedUnion('t', [
  z.object({ t: z.literal('hello'), key: z.string().regex(/^[a-f0-9]{64}$/) }).strict(),
  z.object({ t: z.literal('sync') }).strict(),
  z.object({ t: z.literal('item.add'), mediaId: id, x: coordinate, y: coordinate, requestId }).strict(),
  z.object({ t: z.literal('text.add'), x: coordinate, y: coordinate, requestId }).strict(),
  z.object({ t: z.literal('shape.add'), shape: z.enum(shapeKinds), x: coordinate, y: coordinate, requestId }).strict(),
  z.object({ t: z.literal('video.control'), id, action: z.enum(['play', 'pause', 'restart']), requestId }).strict(),
  z.object({ t: z.literal('item.patch'), id, patch: itemPatch, requestId }).strict(),
  z.object({ t: z.literal('item.preview'), id, patch: previewPatch }).strict(),
  z.object({ t: z.literal('item.remove'), id, requestId }).strict(),
  z.object({ t: z.literal('item.reorder'), ids: z.array(id).max(500), requestId }).strict(),
]);

export const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
export const MAX_ROOM_BYTES = 500 * 1024 * 1024;
export function imageMime(bytes: Uint8Array): string | null {
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));
  if (bytes.length >= 24 && [137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => bytes[i] === b)
    && ascii(12, 16) === 'IHDR') return 'image/png';
  if (bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
  if (bytes.length >= 16 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP'
    && ['VP8 ', 'VP8L', 'VP8X'].includes(ascii(12, 16))) return 'image/webp';
  if (bytes.length >= 13 && ['GIF87a', 'GIF89a'].includes(ascii(0, 6))) return 'image/gif';
  return null;
}

export function mediaMime(bytes: Uint8Array): string | null {
  const image = imageMime(bytes); if (image) return image;
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));
  if (bytes.length >= 16 && ascii(4, 8) === 'ftyp') {
    const size = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0);
    const brands = [ascii(8, 12)];
    for (let offset = 16; offset + 4 <= Math.min(size, bytes.length); offset += 4) brands.push(ascii(offset, offset + 4));
    if (size >= 16 && brands.some(brand => ['isom', 'iso2', 'mp41', 'mp42', 'avc1', 'M4V '].includes(brand))) return 'video/mp4';
  }
  if (bytes.length >= 16 && [0x1a, 0x45, 0xdf, 0xa3].every((b, i) => bytes[i] === b)
    && ascii(4, Math.min(128, bytes.length)).includes('\x42\x82\x84webm')) return 'video/webm';
  return null;
}
