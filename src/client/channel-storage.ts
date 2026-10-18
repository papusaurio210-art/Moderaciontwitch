// Only access links for this installation are stored. No admin secret or room data.
export const CHANNELS_KEY = 'overlay-studio:channels:v1';
export const CHANNELS_EVENT = 'overlay-studio:channels-changed';
export interface Channel {
  roomId: string; editorKey: string; name: string; favorite: boolean; createdAt: number; lastOpened: number;
}
type Store = Pick<Storage, 'getItem' | 'setItem'>;
const roomPattern = /^[a-f0-9]{32}$/, keyPattern = /^[a-f0-9]{64}$/;
export const channelPath = (channel: Pick<Channel, 'roomId' | 'editorKey'>) => `/panel/${channel.roomId}#key=${channel.editorKey}`;
export function parseEditorLink(value: string, origin: string): Pick<Channel, 'roomId' | 'editorKey'> {
  let url: URL;
  try { url = new URL(value.trim(), origin); } catch { throw new Error('Pega un enlace de edición válido.'); }
  if (url.origin !== origin || !['http:', 'https:'].includes(url.protocol) || url.username || url.password)
    throw new Error('El enlace debe pertenecer a esta instalación de Overlay Studio.');
  const match = url.pathname.match(/^\/panel\/([a-f0-9]{32})\/?$/), params = new URLSearchParams(url.hash.slice(1));
  const editorKey = params.get('key') ?? '';
  if (!match || url.search || [...params.keys()].length !== 1 || !keyPattern.test(editorKey))
    throw new Error('Usa el enlace privado de edición, no el enlace de OBS ni el de Twitch.');
  return { roomId: match[1], editorKey };
}
export function channelName(value: string): string {
  const name = value.trim();
  if (!name || name.length > 60) throw new Error('Escribe un nombre de entre 1 y 60 caracteres.');
  return name;
}
export function readChannels(storage: Pick<Storage, 'getItem'>): Channel[] {
  const raw = storage.getItem(CHANNELS_KEY);
  if (raw === null) return [];
  try {
    const data = JSON.parse(raw);
    if (data.version !== 1 || !Array.isArray(data.channels) || data.channels.length > 100) throw new Error();
    const ids = new Set<string>();
    return data.channels.map((c: Channel) => {
      if (!c || typeof c.roomId !== 'string' || !roomPattern.test(c.roomId) || ids.has(c.roomId)
        || typeof c.editorKey !== 'string' || !keyPattern.test(c.editorKey) || typeof c.name !== 'string'
        || channelName(c.name) !== c.name || typeof c.favorite !== 'boolean'
        || !Number.isFinite(c.createdAt) || c.createdAt < 0 || !Number.isFinite(c.lastOpened) || c.lastOpened < 0) throw new Error();
      ids.add(c.roomId);
      return { roomId: c.roomId, editorKey: c.editorKey, name: c.name, favorite: c.favorite, createdAt: c.createdAt, lastOpened: c.lastOpened };
    });
  } catch { throw new Error('No se pudo leer la lista guardada. Sus datos se conservaron; puedes seguir usando tus enlaces de edición.'); }
}
export type ChannelAction =
  | { type: 'add'; roomId: string; editorKey: string; name: string }
  | { type: 'rename'; roomId: string; name: string }
  | { type: 'favorite' | 'remove' | 'open'; roomId: string };
export function changeChannels(storage: Store, action: ChannelAction, now = Date.now()): Channel[] {
  const channels = readChannels(storage), existing = channels.find(c => c.roomId === action.roomId);
  let next: Channel[];
  if (action.type === 'add') {
    if (existing) throw new Error('Este canal ya está en Mis canales. Puedes abrirlo desde su tarjeta.');
    if (channels.length >= 100) throw new Error('Puedes guardar hasta 100 canales en este navegador.');
    if (!roomPattern.test(action.roomId) || !keyPattern.test(action.editorKey)) throw new Error('El enlace de edición no es válido.');
    next = [...channels, { roomId: action.roomId, editorKey: action.editorKey, name: channelName(action.name), favorite: false, createdAt: now, lastOpened: now }];
  } else {
    if (!existing) throw new Error('Este acceso ya se quitó de Mis canales.');
    next = action.type === 'remove' ? channels.filter(c => c.roomId !== action.roomId) : channels.map(c => c.roomId !== action.roomId ? c : {
      ...c, ...(action.type === 'rename' ? { name: channelName(action.name) } : action.type === 'favorite' ? { favorite: !c.favorite } : { lastOpened: now }),
    });
  }
  storage.setItem(CHANNELS_KEY, JSON.stringify({ version: 1, channels: next }));
  return next;
}
export function sortedChannels(channels: Channel[], query = '', favoritesOnly = false): Channel[] {
  return channels.filter(c => c.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()) && (!favoritesOnly || c.favorite))
    .sort((a, b) => Number(b.favorite) - Number(a.favorite) || b.lastOpened - a.lastOpened || a.name.localeCompare(b.name));
}
export function verifyEditor(channel: Pick<Channel, 'roomId' | 'editorKey'>, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new Error('Comprobación cancelada.')); return; }
    const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws/${channel.roomId}`);
    let done = false;
    const finish = (error?: string) => {
      if (done) return; done = true; clearTimeout(timer); signal.removeEventListener('abort', abort); ws.close();
      if (error) reject(new Error(error)); else resolve();
    };
    const abort = () => finish('Comprobación cancelada.');
    const timer = setTimeout(() => finish('No se pudo comprobar el acceso. Revisa tu conexión y vuelve a intentarlo.'), 8000);
    signal.addEventListener('abort', abort, { once: true });
    ws.onopen = () => ws.send(JSON.stringify({ t: 'hello', key: channel.editorKey }));
    ws.onmessage = event => {
      try {
        const message = JSON.parse(event.data);
        if (message.t === 'welcome') finish(message.role === 'editor' ? undefined : 'Este enlace solo permite visualizar. Necesitas el enlace de edición.');
        else if (message.t === 'error') finish('No se pudo validar este enlace de edición.');
      } catch { finish('No se pudo comprobar el acceso.'); }
    };
    ws.onerror = () => finish('No se pudo conectar con la sala. Revisa el enlace y tu conexión.');
    ws.onclose = () => finish('El enlace no permite editar esta sala. Solicita su enlace de edición.');
  });
}
