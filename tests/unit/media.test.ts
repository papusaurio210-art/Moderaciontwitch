import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { mediaMime, clientMessage } from '../../src/worker/validation';
import { byteRange } from '../../src/worker/range';
import { videoPosition, type VideoItem } from '../../src/shared/model';

describe('archivos multimedia', () => {
  it.each([['gif', 'image/gif'], ['mp4', 'video/mp4'], ['webm', 'video/webm']])('reconoce %s por sus bytes', (extension, mime) => {
    expect(mediaMime(readFileSync(`tests/fixtures/motion.${extension}`).subarray(0, 4096))).toBe(mime);
  });
  it('rechaza un vídeo falso y una cabecera EBML que no declara WebM', () => {
    expect(mediaMime(new TextEncoder().encode('fake.mp4'))).toBeNull();
    expect(mediaMime(new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, ...Array(40).fill(0)]))).toBeNull();
  });
});
describe('rangos HTTP para reproducción y búsqueda', () => {
  it.each([
    ['bytes=0-9', { offset: 0, length: 10 }], ['bytes=90-', { offset: 90, length: 10 }],
    ['bytes=-12', { offset: 88, length: 12 }], ['bytes=95-999', { offset: 95, length: 5 }],
    ['bytes=-200', { offset: 0, length: 100 }], ['bytes=100-', null], ['bytes=5-1', null],
    ['bytes=-0', null], ['bytes=-', null], ['bytes=0-1,4-5', null], ['bytes=9007199254740992-', null],
  ])('%s', (header, result) => expect(byteRange(header as string, 100)).toEqual(result));
});
describe('línea temporal compartida de vídeo', () => {
  const video: VideoItem = { id: crypto.randomUUID(), type: 'video', mediaId: crypto.randomUUID(), name: 'Vídeo',
    x: 0, y: 0, w: 100, h: 100, rot: 0, visible: true, locked: false, opacity: 1, fit: 'contain',
    loop: true, muted: true, playing: true, position: 2, startedAt: 1000 };
  it('sitúa a un visor que llega tarde en el bucle actual', () => expect(videoPosition(video, 6000, 6)).toBe(1));
  it('conserva el instante pausado aunque pase el tiempo', () => expect(videoPosition({ ...video, playing: false, startedAt: null }, 90000, 6)).toBe(2));
  it('detiene el vídeo sin bucle al terminar', () => expect(videoPosition({ ...video, loop: false }, 90000, 6)).toBe(6));
  it('no retrocede por un reloj anterior al inicio', () => expect(videoPosition(video, 0, 6)).toBe(2));
});
describe('validación de texto y controles', () => {
  it.each([{ fontSize: 0 }, { text: 'x'.repeat(4001) }, { color: 'url(https://example.com)' }, { fontFamily: 'Unknown' }, { strokeWidth: 17 }, { playing: true }, { startedAt: 0 }])('rechaza propiedades fuera del contrato', patch => {
    expect(clientMessage.safeParse({ t: 'item.patch', id: crypto.randomUUID(), patch }).success).toBe(false);
  });
});
