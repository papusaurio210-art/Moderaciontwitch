import { describe, expect, it } from 'vitest';
import { CHANNELS_KEY, changeChannels, channelPath, parseEditorLink, readChannels, sortedChannels } from '../../src/client/channels';
const origin = 'https://studio.example', roomId = 'a'.repeat(32), editorKey = 'b'.repeat(64);
const target = { roomId, editorKey }, add = { type: 'add' as const, ...target, name: '  Canal de Ana  ' };
function store(initial: string | null = null) {
  let value = initial;
  return { getItem: (_: string) => value, setItem: (_: string, next: string) => { value = next; } };
}
describe('perfiles locales', () => {
  it('acepta solo enlaces de edición de la instalación actual y conserva las claves en el fragmento', () => {
    expect(parseEditorLink(` ${origin}${channelPath(target)} `, origin)).toEqual(target);
    expect(parseEditorLink(channelPath(target), origin)).toEqual(target);
    expect(new URL(channelPath(target), origin).search).toBe('');
  });
  it.each([
    `https://other.example${channelPath(target)}`, `https://user:pass@studio.example${channelPath(target)}`,
    `javascript:alert(1)`, `/overlay/${roomId}?k=${editorKey}`, `/panel/${roomId}#key=bad`,
    `/panel/${roomId}?key=${editorKey}`, `/panel/${roomId}#key=${editorKey}&key=${editorKey}`,
    `/panel/${roomId}#key=${editorKey}&anything=1`, `https://twitch.tv/ana`,
  ])('rechaza enlaces ajenos, incompletos o ambiguos: %s', link => {
    expect(() => parseEditorLink(link, origin)).toThrow();
  });
  it('persiste nombres locales, favoritos y aperturas sin mezclar los canales', () => {
    const storage = store(); changeChannels(storage, add, 1);
    changeChannels(storage, { ...add, roomId: 'c'.repeat(32), name: 'Luis' }, 2);
    changeChannels(storage, { type: 'rename', roomId, name: '  Ana  ' });
    changeChannels(storage, { type: 'favorite', roomId }); changeChannels(storage, { type: 'open', roomId, }, 3);
    expect(readChannels(storage)[0]).toEqual({ ...target, name: 'Ana', favorite: true, createdAt: 1, lastOpened: 3 });
    expect(readChannels(storage)[1].name).toBe('Luis');
    changeChannels(storage, { type: 'remove', roomId }); expect(readChannels(storage)).toHaveLength(1);
  });
  it('no sobrescribe accesos duplicados ni una lista dañada', () => {
    const storage = store(); changeChannels(storage, add); const before = storage.getItem(CHANNELS_KEY);
    expect(() => changeChannels(storage, { ...add, name: 'Otro alias' })).toThrow('ya está');
    expect(storage.getItem(CHANNELS_KEY)).toBe(before);
    const damaged = store('{broken'); expect(() => changeChannels(damaged, add)).toThrow('datos se conservaron');
    expect(damaged.getItem(CHANNELS_KEY)).toBe('{broken');
  });
  it.each([{ version: 2, channels: [] }, { version: 1, channels: [{}] }, null])('rechaza formatos de almacenamiento incompatibles: %j', data => {
    expect(() => readChannels(store(JSON.stringify(data)))).toThrow();
  });
  it('propaga errores de almacenamiento sin informar de un guardado falso', () => {
    const storage = { getItem: () => null, setItem: () => { throw new DOMException('full', 'QuotaExceededError'); } };
    expect(() => changeChannels(storage, add)).toThrow('full');
  });
  it('ordena favoritos primero y luego recientes; combina búsqueda y favoritos', () => {
    const storage = store(); changeChannels(storage, add, 1);
    changeChannels(storage, { ...add, roomId: 'c'.repeat(32), name: 'Luis' }, 3);
    const channels = changeChannels(storage, { type: 'favorite', roomId });
    expect(sortedChannels(channels).map(c => c.name)).toEqual(['Canal de Ana', 'Luis']);
    expect(sortedChannels(channels, ' ANA ', true)).toHaveLength(1);
    expect(sortedChannels(channels, 'Luis', true)).toHaveLength(0);
  });
  it('no permite nombres vacíos ni más de 100 accesos', () => {
    const storage = store(); expect(() => changeChannels(storage, { ...add, name: '  ' })).toThrow();
    for (let n = 0; n < 100; n++) changeChannels(storage, { ...add, roomId: n.toString(16).padStart(32, '0') });
    expect(() => changeChannels(storage, add)).toThrow('100');
    expect(readChannels(storage)).toHaveLength(100);
  });
});
