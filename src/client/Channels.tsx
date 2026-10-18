import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowUpRight, BookmarkPlus, ExternalLink, Pencil, Search, Star, Trash2, Users, X } from 'lucide-react';
import { channelName, channelPath, parseEditorLink, sortedChannels, verifyEditor, type Channel } from './channels';
import { saveChannelAction, useChannels } from './useChannels';

type Dialog = { mode: 'add' | 'rename' | 'remove'; channel?: Channel; current?: { roomId: string; editorKey: string; name: string } };
export function ChannelDialog({ mode, channel, current, onClose }: Dialog & { onClose: () => void }) {
  const [name, setName] = useState(channel?.name ?? current?.name ?? ''), [link, setLink] = useState('');
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null), form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    form.current?.querySelector<HTMLElement>(mode === 'remove' ? '[data-cancel]' : 'input')?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); form.current?.querySelector<HTMLButtonElement>('[data-cancel]')?.click(); }
      if (event.key === 'Tab') {
        const fields = Array.from(form.current!.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), a[href]'));
        const first = fields[0], last = fields.at(-1);
        if (!form.current?.contains(document.activeElement) || (event.shiftKey && document.activeElement === first)) { event.preventDefault(); (event.shiftKey ? last : first)?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    window.addEventListener('keydown', keydown, true);
    return () => { window.removeEventListener('keydown', keydown, true); abort.current?.abort(); if (previous?.isConnected) previous.focus(); };
  }, [mode]);
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy) return; setError('');
    try {
      if (mode === 'remove') saveChannelAction({ type: 'remove', roomId: channel!.roomId });
      else if (mode === 'rename') saveChannelAction({ type: 'rename', roomId: channel!.roomId, name: channelName(name) });
      else {
        const label = channelName(name), target = current ?? parseEditorLink(link, location.origin);
        if (!current) {
          setBusy(true); abort.current = new AbortController();
          await verifyEditor(target, abort.current.signal);
          if (abort.current.signal.aborted) return;
        }
        saveChannelAction({ type: 'add', ...target, name: label });
      }
      onClose();
    } catch (error) {
      if (!abort.current?.signal.aborted) { setError(error instanceof Error ? error.message : 'No se pudo guardar el acceso.'); setBusy(false); }
    }
  }
  const title = mode === 'add' ? 'Guardar canal' : mode === 'rename' ? 'Renombrar acceso' : 'Quitar acceso';
  return <div className="modal-backdrop" onMouseDown={onClose}><form ref={form} className="modal channel-dialog" role="dialog" aria-modal="true" aria-label={title} onSubmit={submit}
    onMouseDown={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
    <button type="button" className="modal-close" aria-label="Cerrar" onClick={onClose}><X size={18} /></button>
    <h2>{title}</h2>
    {mode === 'remove' ? <p>Se quitará <strong>{channel!.name}</strong> de este navegador. Su sala, archivos y overlay en OBS seguirán funcionando. Necesitarás su enlace para volver a agregarlo.</p>
      : <><p>{mode === 'rename' ? 'Este nombre solo cambia en tu lista. El nombre de la sala se conserva.' : 'El acceso de edición se guardará en este navegador. Quien utilice este perfil del navegador podrá abrirlo.'}</p>
        <label>Nombre para tu lista<input value={name} onChange={e => setName(e.target.value)} maxLength={60} required disabled={busy} autoComplete="off" placeholder="Por ejemplo, Canal de Ana" /></label>
        {mode === 'add' && !current && <label>Enlace de edición<input type="password" value={link} onChange={e => setLink(e.target.value)} required disabled={busy} autoComplete="off" spellCheck={false} placeholder="Pega aquí el enlace privado del panel" /><small>Usa un enlace de esta instalación. No sirve el enlace de OBS ni el de Twitch.</small></label>}</>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="channel-dialog-actions"><button type="button" data-cancel className="secondary-button" onClick={onClose}>Cancelar</button>
      <button className={mode === 'remove' ? 'delete-button' : 'primary-button'} disabled={busy || (mode !== 'remove' && !name.trim())}>{busy ? 'Comprobando acceso…' : mode === 'remove' ? 'Quitar de este navegador' : mode === 'rename' ? 'Guardar nombre' : 'Guardar canal'}</button></div>
  </form></div>;
}

export function Channels() {
  const { channels, error: storageError } = useChannels();
  const [query, setQuery] = useState(''), [favorites, setFavorites] = useState(false), [error, setError] = useState('');
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const visible = sortedChannels(channels, query, favorites);
  function act(action: 'favorite' | 'open', channel: Channel) {
    try { saveChannelAction({ type: action, roomId: channel.roomId }); setError(''); }
    catch (error) { setError(error instanceof Error ? error.message : 'No se pudo actualizar la lista.'); }
  }
  return <section className="channels-section" id="mis-canales" aria-labelledby="channels-title">
    <div className="eyebrow"><Users size={15} />TUS ACCESOS, EN UN LUGAR</div>
    <div className="channels-heading"><h1 id="channels-title">Mis canales</h1><span>{channels.length} guardados</span></div>
    <p className="channels-description">Abre el editor de cada canal y prepara sus overlays. Puedes trabajar con varios en pestañas distintas.</p>
    <button className="primary-button" onClick={() => setDialog({ mode: 'add' })}><BookmarkPlus size={16} />Agregar canal existente</button>
    <p className="channels-local-note">Guardados solo en este navegador y dirección web. Si borras sus datos o cambias de equipo, tendrás que volver a agregar los enlaces.</p>
    {(storageError || error) && <p className="form-error" role="alert">{storageError || error}</p>}
    <div className="channels-filters"><label><Search size={16} /><input aria-label="Buscar canales" placeholder="Buscar por nombre…" value={query} onChange={e => setQuery(e.target.value)} /></label>
      <button className={`secondary-button ${favorites ? 'active' : ''}`} aria-pressed={favorites} onClick={() => setFavorites(!favorites)}><Star size={14} />Favoritos</button></div>
    <div className="channel-list">
      {visible.map(channel => <article className="channel-card" key={channel.roomId} data-channel-id={channel.roomId}>
        <div className="channel-card-top"><span className="channel-avatar" aria-hidden="true">{Array.from(channel.name)[0].toLocaleUpperCase()}</span>
          <div><h2>{channel.name}</h2><span>Acceso de edición guardado</span></div>
          <button className={`icon-button ${channel.favorite ? 'active' : ''}`} aria-label={`${channel.favorite ? 'Quitar de' : 'Añadir a'} favoritos: ${channel.name}`} aria-pressed={channel.favorite} onClick={() => act('favorite', channel)}><Star size={17} fill={channel.favorite ? 'currentColor' : 'none'} /></button></div>
        <div className="channel-card-actions"><a className="primary-button" href={channelPath(channel)} onClick={() => act('open', channel)}>Abrir editor<ArrowUpRight size={15} /></a>
          <a className="icon-button" href={channelPath(channel)} target="_blank" rel="noopener noreferrer" aria-label={`Abrir ${channel.name} en otra pestaña`} title="Abrir en otra pestaña" onClick={() => act('open', channel)}><ExternalLink size={16} /></a>
          <button className="icon-button" aria-label={`Renombrar ${channel.name}`} title="Renombrar acceso" onClick={() => setDialog({ mode: 'rename', channel })}><Pencil size={16} /></button>
          <button className="icon-button" aria-label={`Quitar ${channel.name}`} title="Quitar de Mis canales" onClick={() => setDialog({ mode: 'remove', channel })}><Trash2 size={16} /></button></div>
      </article>)}
      {!visible.length && <div className="channels-empty"><Users size={30} /><h2>{channels.length ? 'No hay canales con estos filtros' : 'Tu próximo directo empieza aquí'}</h2>
        <p>{channels.length ? 'Prueba otro nombre o muestra todos los canales.' : 'Agrega el enlace de un canal que moderas o crea un estudio nuevo.'}</p>
        {!!channels.length && <button className="secondary-button" onClick={() => { setQuery(''); setFavorites(false); }}>Mostrar todos</button>}</div>}
    </div>
    {dialog && <ChannelDialog {...dialog} onClose={() => setDialog(null)} />}
  </section>;
}

export function SaveCurrentChannel({ roomId, editorKey, name, enabled }: { roomId: string; editorKey: string; name: string; enabled: boolean }) {
  const { channels } = useChannels(), saved = channels.some(c => c.roomId === roomId);
  const [open, setOpen] = useState(false);
  return <><button className="icon-button" aria-label={saved ? 'Canal guardado en Mis canales' : 'Guardar en Mis canales'} title={saved ? 'Canal guardado en Mis canales' : 'Guardar en Mis canales'} disabled={!enabled || saved} onClick={() => setOpen(true)}><BookmarkPlus size={19} /></button>
    {open && <ChannelDialog mode="add" current={{ roomId, editorKey, name }} onClose={() => setOpen(false)} />}</>;
}
