import { useEffect, useState } from 'react';
import { Image as ImageIcon, LoaderCircle, Pencil, Plus, Search, Trash2, Upload, X } from 'lucide-react';
import { filterMedia, mediaUsage, type MediaKind } from '../shared/library';
import type { RoomConnection } from './useRoom';
import { MediaThumbnail } from './components';

export function Library({ room, hidden, selectedMediaId, uploading, chooseFile }: {
  room: RoomConnection; hidden: boolean; selectedMediaId?: string; uploading: boolean; chooseFile: () => void;
}) {
  const state = room.state!, enabled = room.status === 'connected' && room.role === 'editor';
  const [query, setQuery] = useState(''), [kind, setKind] = useState<'all' | MediaKind>('all');
  const [usage, setUsage] = useState<'all' | 'used' | 'unused'>('all');
  const [dialog, setDialog] = useState<{ id: string; mode: 'rename' | 'remove' } | null>(null);
  const [name, setName] = useState('');
  useEffect(() => { if (hidden) setDialog(null); }, [hidden]);
  const file = state.media.find(m => m.id === dialog?.id), used = file ? mediaUsage(state.items, file.id) : 0;
  useEffect(() => { if (dialog && !file) setDialog(null); }, [dialog, file]);
  const files = filterMedia(state.media, state.items, query, kind, usage);
  const bytes = state.media.reduce((n, m) => n + m.size, 0);
  const close = () => setDialog(null);
  return <div className="library-content" hidden={hidden}>
    <div className="library-search"><Search size={14} /><input placeholder="Buscar archivos…" aria-label="Buscar archivos" value={query} onChange={e => setQuery(e.target.value)} /><kbd>⌕</kbd></div>
    <div className="library-filters"><label>Tipo<select aria-label="Tipo de archivo" value={kind} onChange={e => setKind(e.target.value as typeof kind)}>
      <option value="all">Todos</option><option value="image">Imágenes</option><option value="gif">GIF</option><option value="video">Vídeos</option>
    </select></label><label>Uso<select aria-label="Uso del archivo" value={usage} onChange={e => setUsage(e.target.value as typeof usage)}>
      <option value="all">Todos</option><option value="used">En uso</option><option value="unused">Sin uso</option>
    </select></label></div>
    <div className="library-subtitle"><span>TUS ARCHIVOS</span><span>{files.length} / {state.media.length}</span></div>
    <div className="media-list">
      {!state.media.length ? <div className="empty-library"><span><ImageIcon size={24} strokeWidth={1.2} /></span><strong>Tu biblioteca, a tu manera</strong><p>Sube los gráficos de tu canal.<br />Estarán aquí cuando los necesites.</p></div>
        : files.map(m => { const uses = mediaUsage(state.items, m.id); return <article key={m.id} className="library-entry" data-media-id={m.id}>
          <button className={`media-card ${selectedMediaId === m.id ? 'selected' : ''}`} title={`Añadir ${m.name} al escenario`}
            draggable={enabled} disabled={!enabled} onDragStart={e => e.dataTransfer.setData('application/overlay-media', m.id)}
            onClick={() => room.send({ t: 'item.add', mediaId: m.id, x: 120, y: 120 })}>
            <span className="media-thumb"><MediaThumbnail roomId={state.roomId} media={m} /><span className="mime-chip">{m.mime.split('/')[1].toUpperCase()}</span><span className="add-to-stage"><Plus size={18} /></span></span>
            <strong>{m.name}</strong><small>{m.width} × {m.height}</small></button>
          <div className="media-actions"><span title={uses ? `Usado por ${uses} elementos, incluidos los ocultos` : 'No aparece en el escenario'}>{uses ? `En uso · ${uses}` : 'Sin uso'}</span>
            <button aria-label={`Renombrar ${m.name}`} title="Renombrar archivo" disabled={!enabled || !!room.pending} onClick={() => { setName(m.name); setDialog({ id: m.id, mode: 'rename' }); }}><Pencil size={12} /></button>
            <button aria-label={`Eliminar archivo ${m.name}`} title="Eliminar archivo" disabled={!enabled || !!room.pending} onClick={() => setDialog({ id: m.id, mode: 'remove' })}><Trash2 size={12} /></button>
          </div></article>; })}
      {!!state.media.length && !files.length && <div className="no-results"><p>No hay archivos con estos filtros.</p><button className="secondary-button" onClick={() => { setQuery(''); setKind('all'); setUsage('all'); }}>Limpiar filtros</button></div>}
    </div>
    <div className="library-bottom"><div className="storage-line"><span>Almacenamiento</span><span>{(bytes / 1024 / 1024).toFixed(1)} / 500 MB</span></div><div className="storage-track"><i style={{ width: `${bytes / (500 * 1024 * 1024) * 100}%` }} /></div>
      <button className="secondary-button upload-button" onClick={chooseFile} disabled={!enabled || uploading}>{uploading ? <LoaderCircle size={15} className="spin" /> : <Upload size={15} />}{uploading ? 'Subiendo archivo…' : 'Subir archivos'}</button>
      <span className="upload-formats">IMÁGENES / GIF: 25 MB · VÍDEO: 50 MB</span></div>
    {dialog && file && <div className="modal-backdrop" onMouseDown={close}><form className="modal library-dialog" role="dialog" aria-modal="true" aria-label={dialog.mode === 'rename' ? 'Renombrar archivo' : 'Eliminar archivo'}
      onMouseDown={e => e.stopPropagation()} onKeyDown={e => { e.stopPropagation(); if (e.key === 'Escape') close(); }} onSubmit={e => {
        e.preventDefault(); if (!enabled || room.pending) return;
        if (dialog.mode === 'rename') {
          if (!name.trim() || name.trim().length > 120) return;
          if (room.send({ t: 'media.rename', id: file.id, name: name.trim() })) close();
        } else if (!used && room.send({ t: 'media.remove', id: file.id })) close();
      }}>
      <button type="button" className="modal-close" aria-label="Cerrar" onClick={close}><X size={18} /></button>
      <h2>{dialog.mode === 'rename' ? 'Renombrar archivo' : 'Eliminar archivo'}</h2>
      {dialog.mode === 'rename' ? <><p>Este nombre se usa en la biblioteca. Las capas conservan sus nombres.</p><label className="property-label">NOMBRE<input autoFocus aria-label="Nombre del archivo" maxLength={120} value={name} onChange={e => setName(e.target.value)} /></label></>
        : <><strong className="delete-file-name">{file.name}</strong><p>{(file.size / 1024 / 1024).toFixed(2)} MB · {file.width} × {file.height}</p>
          <p>{used ? `Está en uso en ${used} elemento${used === 1 ? '' : 's'}. Elimina sus elementos del escenario, incluidos los ocultos, antes de borrar el archivo.`
            : 'Se eliminará de la biblioteca y se liberará su espacio. Esta acción no se puede deshacer; las copias del portapapeles o del historial que necesiten este archivo dejarán de poder restaurarse.'}</p></>}
      <div className="library-dialog-actions"><button type="button" className="secondary-button" autoFocus={dialog.mode === 'remove'} onClick={close}>Cancelar</button>
        <button type="submit" className={dialog.mode === 'rename' ? 'primary-button' : 'delete-button'} disabled={!enabled || !!room.pending || (dialog.mode === 'rename' ? !name.trim() || name.trim().length > 120 : used > 0)}>
          {dialog.mode === 'rename' ? 'Guardar nombre' : 'Eliminar definitivamente'}</button></div>
    </form></div>}
  </div>;
}
