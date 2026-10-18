import { useEffect, useState } from 'react';
import { CHANNELS_EVENT, CHANNELS_KEY, changeChannels, readChannels, type Channel, type ChannelAction } from './channel-storage';
export function localChannels() {
  try { return { channels: readChannels(localStorage), error: '' }; }
  catch (error) { return { channels: [] as Channel[], error: error instanceof Error && error.message.startsWith('No se pudo leer') ? error.message : 'El navegador no permite leer los canales guardados. Puedes seguir usando tus enlaces de edición.' }; }
}
export function saveChannelAction(action: ChannelAction) {
  try { changeChannels(localStorage, action); }
  catch (error) {
    if (error instanceof DOMException) throw new Error('El navegador no permite guardar estos cambios. Revisa el espacio y los permisos de almacenamiento; conserva tu enlace de edición.');
    throw error;
  }
  window.dispatchEvent(new Event(CHANNELS_EVENT));
}
export function useChannels() {
  const [state, setState] = useState(localChannels);
  useEffect(() => {
    const update = () => setState(localChannels());
    const storage = (event: StorageEvent) => { if (event.key === CHANNELS_KEY || event.key === null) update(); };
    window.addEventListener('storage', storage); window.addEventListener(CHANNELS_EVENT, update);
    return () => { window.removeEventListener('storage', storage); window.removeEventListener(CHANNELS_EVENT, update); };
  }, []);
  return state;
}
