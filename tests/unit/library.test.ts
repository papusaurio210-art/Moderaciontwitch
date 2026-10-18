import { describe, expect, it } from 'vitest';
import { filterMedia, mediaKind, mediaUsage } from '../../src/shared/library';
import { historyEntry, historyOperation } from '../../src/shared/editing';
import { applyOperation, type Item, type MediaFile, type RoomState } from '../../src/shared/model';
import { clientMessage } from '../../src/worker/validation';
const image: MediaFile = { id: crypto.randomUUID(), name: 'Bienvenida.PNG', mime: 'image/png', size: 500, width: 100, height: 100, createdAt: 1 };
const gif: MediaFile = { ...image, id: crypto.randomUUID(), name: 'Animación.gif', mime: 'image/gif' };
const video: MediaFile = { ...image, id: crypto.randomUUID(), name: 'Intro.webm', mime: 'video/webm' };
const item: Item = { id: crypto.randomUUID(), type: 'image', mediaId: image.id, name: 'Capa personalizada', x: 0, y: 0, w: 100, h: 100, rot: 0, visible: false, locked: true, opacity: 0 };
const state: RoomState = { roomId: 'a'.repeat(32), name: 'Test', rev: 1, stage: { x: 0, y: 0, w: 1920, h: 1080 }, media: [image, gif, video], items: [item] };
describe('gestión de biblioteca', () => {
  it('separa imágenes, GIF y vídeos', () => expect(state.media.map(mediaKind)).toEqual(['image', 'gif', 'video']));
  it('cuenta también elementos ocultos, bloqueados y transparentes', () => expect(mediaUsage([item, { ...item, id: crypto.randomUUID() }], image.id)).toBe(2));
  it('combina búsqueda sin mayúsculas ni espacios externos con tipo y uso', () => {
    expect(filterMedia(state.media, state.items, ' BIENVENIDA ', 'image', 'used')).toEqual([image]);
    expect(filterMedia(state.media, state.items, '', 'all', 'unused')).toEqual([gif, video]);
    expect(filterMedia(state.media, state.items, '', 'gif', 'used')).toEqual([]);
  });
  it('renombra únicamente el catálogo conservando las capas y el archivo', () => {
    const next = applyOperation(state, { t: 'media.rename', id: image.id, name: 'Nuevo nombre' }, 2);
    expect(next.media[0]).toEqual({ ...image, name: 'Nuevo nombre' }); expect(next.items).toBe(state.items);
    expect(state.media[0].name).toBe('Bienvenida.PNG'); expect(next.rev).toBe(2);
  });
  it('elimina solo el medio solicitado y actualiza el espacio lógico', () => {
    const next = applyOperation(state, { t: 'media.remove', id: gif.id }, 2);
    expect(next.media).toEqual([image, video]); expect(next.media.reduce((n, m) => n + m.size, 0)).toBe(1000);
  });
  it('no permite deshacer ni rehacer elementos que requieren archivos eliminados', () => {
    const remove = historyEntry([item], [])!, add = historyEntry([], [item])!;
    const missing = { ...state, media: [], items: [] };
    expect(historyOperation(missing, remove, 'undo')).toBeNull(); expect(historyOperation(missing, add, 'redo')).toBeNull();
    expect(historyOperation({ ...state, items: [] }, remove, 'undo')).not.toBeNull();
  });
  it.each(['', '   ', 'x'.repeat(121), 42, null])('rechaza nombres inválidos %s', name => expect(clientMessage.safeParse({ t: 'media.rename', id: image.id, name }).success).toBe(false));
  it('normaliza espacios externos y permite nombres Unicode', () => {
    const result = clientMessage.parse({ t: 'media.rename', id: image.id, name: '  Mi animación 🎉  ' });
    expect(result).toMatchObject({ name: 'Mi animación 🎉' });
  });
  it.each([{ t: 'media.remove', id: image.id, force: true }, { t: 'media.rename', id: image.id, name: 'ok', mime: 'image/svg+xml' }, { t: 'media.remove', id: '../file' }])('rechaza parámetros no autorizados %j', msg => expect(clientMessage.safeParse(msg).success).toBe(false));
});
