import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, Check, CheckCheck, ChevronDown, Copy, ExternalLink, Eye, EyeOff, Grid2X2, Hand,
  Image as ImageIcon, ImagePlus, Keyboard, Layers, Link, LoaderCircle, LockKeyhole, Maximize, Minus,
  MousePointer2, PanelRight, Plus, Search, Settings2, Trash2, UnlockKeyhole, Upload, X, Type, Square, Circle, ArrowRight, Hourglass, Timer } from 'lucide-react';
import { clamp, shapeDefaults, type ItemPatch, type ShapeKind, type TimerKind } from '../shared/model';
import { viewerKeyFromEditor } from '../shared/keys';
import { Brand, ConnectionBadge, ViewerCount, MediaThumbnail, ItemIcon } from './components';
import { Canvas, type View } from './Canvas';
import type { RoomConnection } from './useRoom';
import { NumberField, NameField, TextProperties, VideoProperties, ShapeProperties } from './Properties';
import { TimerProperties } from './TimerProperties';
import { inspectFile } from './media';

function Tool({ label, active, onClick, children, disabled }: { label: string; active?: boolean; onClick: () => void; children: ReactNode; disabled?: boolean }) {
  return <button className={`icon-button ${active ? 'active' : ''}`} aria-label={label} title={label} onClick={onClick} disabled={disabled}>{children}</button>;
}

export function Panel({ room, editorKey }: { room: RoomConnection; editorKey: string }) {
  const state = room.state!;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<'library' | 'layers'>('library');
  const [search, setSearch] = useState('');
  const [grid, setGrid] = useState(true);
  const [hand, setHand] = useState(false);
  const [view, setView] = useState<View>({ x: 0, y: 0, zoom: .4 });
  const [fitSignal, setFitSignal] = useState(0);
  const [viewerKey, setViewerKey] = useState('');
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState('');
  const [help, setHelp] = useState(false);
  const [links, setLinks] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const enabled = room.status === 'connected' && room.role === 'editor';
  const selected = room.rendered.find(i => i.id === selectedId);
  const media = selected && 'mediaId' in selected ? state.media.find(m => m.id === selected.mediaId) : null;
  const overlayUrl = viewerKey ? `${location.origin}/overlay/${state.roomId}?k=${viewerKey}` : '';
  const editUrl = `${location.origin}/panel/${state.roomId}#key=${editorKey}`;

  useEffect(() => { void viewerKeyFromEditor(editorKey).then(setViewerKey); }, [editorKey]);
  useEffect(() => { if (room.lastAddedId) setSelectedId(room.lastAddedId); }, [room.lastAddedId]);
  useEffect(() => { document.title = `${state.name} · Overlay Studio`; }, [state.name]);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 3200); return () => clearTimeout(timer); }, [notice]);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (/INPUT|TEXTAREA|SELECT/.test((event.target as HTMLElement).tagName) || help || links) return;
      if ((event.ctrlKey || event.metaKey) && event.key === '0') { event.preventDefault(); setFitSignal(n => n + 1); }
      if (event.key === 'Escape') setSelectedId(null);
      if (!selected || !enabled) return;
      if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); room.send({ t: 'item.remove', id: selected.id }); }
      if (!selected.locked && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
        event.preventDefault(); const d = event.shiftKey ? 10 : 1;
        room.send({ t: 'item.patch', id: selected.id, patch: {
          x: clamp(selected.x + (event.key === 'ArrowRight' ? d : event.key === 'ArrowLeft' ? -d : 0), -100000, 100000),
          y: clamp(selected.y + (event.key === 'ArrowDown' ? d : event.key === 'ArrowUp' ? -d : 0), -100000, 100000),
        } });
      }
    };
    window.addEventListener('keydown', keydown); return () => window.removeEventListener('keydown', keydown);
  }, [selected, enabled, room.send, help, links]);

  async function upload(files: FileList | File[], at?: { x: number; y: number }) {
    if (!enabled || uploading) return;
    setUploading(true); room.setError('');
    try {
      for (const file of Array.from(files)) {
        const size = await inspectFile(file);
        const response = await fetch(`/api/rooms/${state.roomId}/media`, { method: 'POST', headers: {
          Authorization: `Bearer ${editorKey}`, 'Content-Type': size.mime,
          'X-File-Name': encodeURIComponent(file.name), 'X-Image-Width': String(size.width), 'X-Image-Height': String(size.height),
          ...(size.duration === undefined ? {} : { 'X-Media-Duration': String(size.duration) }),
        }, body: file });
        const result = await response.json() as { id: string; error?: string };
        if (!response.ok) throw new Error(result.error || 'No se pudo subir el archivo.');
        const scale = Math.min(1, state.stage.w / 2 / size.width);
        const position = at ?? { x: Math.round((state.stage.w - size.width * scale) / 2), y: Math.round((state.stage.h - size.height * scale) / 2) };
        room.send({ t: 'item.add', mediaId: result.id, ...position });
      }
    } catch (error) { room.setError(error instanceof Error ? error.message : 'No se pudo subir el archivo.'); }
    finally { setUploading(false); if (fileInput.current) fileInput.current.value = ''; }
  }
  async function copy(text: string, message: string) {
    try { await navigator.clipboard.writeText(text); setNotice(message); }
    catch { setLinks(true); setNotice('Selecciona y copia el enlace desde esta ventana.'); }
  }
  const save = (patch: ItemPatch) => { if (selected) room.send({ t: 'item.patch', id: selected.id, patch }); };
  function reorder(direction: -1 | 1) {
    const ids = state.items.map(i => i.id), from = ids.indexOf(selectedId!);
    const to = clamp(from + direction, 0, ids.length - 1);
    if (from === to || from < 0) return;
    [ids[from], ids[to]] = [ids[to], ids[from]];
    room.send({ t: 'item.reorder', ids });
  }
  function addTimer(kind: TimerKind) {
    setHand(false);
    room.send({ t: 'timer.add', kind, x: state.stage.x + (state.stage.w - 640) / 2, y: state.stage.y + (state.stage.h - 140) / 2 });
  }
  function addShape(shape: ShapeKind) {
    const size = shapeDefaults[shape];
    setHand(false);
    room.send({ t: 'shape.add', shape, x: state.stage.x + (state.stage.w - size.w) / 2, y: state.stage.y + (state.stage.h - size.h) / 2 });
  }
  function zoomBy(factor: number) { setView(v => ({ ...v, zoom: clamp(v.zoom * factor, .08, 2) })); }

  return <div className="studio">
    <header className="studio-header"><div className="studio-identity"><Brand compact /><span className="header-divider" /><div className="room-title"><strong>{state.name}</strong><span>Estudio de overlays</span></div><span className="resolution-tag">1080p</span></div>
      <div className="header-status"><ConnectionBadge status={room.status} /><ViewerCount count={room.presence.viewers} /></div>
      <div className="header-actions"><button className="secondary-button overlay-preview" onClick={() => window.open(overlayUrl, '_blank', 'noopener,noreferrer')} disabled={!viewerKey}><ExternalLink size={14} />Ver overlay</button>
        <button className="primary-button" onClick={() => void copy(overlayUrl, 'Enlace del overlay copiado')} disabled={!viewerKey}><Copy size={14} /><span>Copiar enlace OBS</span></button>
        <Tool label="Enlaces del estudio" onClick={() => setLinks(true)}><ChevronDown size={16} /></Tool></div>
    </header>
    <div className="studio-body">
      <nav className="tool-rail" aria-label="Herramientas"><Tool label="Seleccionar" active={!hand} onClick={() => setHand(false)}><MousePointer2 size={20} /></Tool>
        <Tool label="Mover lienzo" active={hand} onClick={() => setHand(true)}><Hand size={20} /></Tool><span className="rail-divider" />
        <Tool label="Añadir archivo" onClick={() => fileInput.current?.click()} disabled={!enabled || uploading}><ImagePlus size={21} /></Tool>
        <Tool label="Añadir texto" onClick={() => room.send({ t: 'text.add', x: 120, y: 120 })} disabled={!enabled}><Type size={21} /></Tool>
        <span className="rail-divider" />
        <Tool label="Añadir rectángulo" onClick={() => addShape('rect')} disabled={!enabled}><Square size={20} /></Tool>
        <Tool label="Añadir círculo" onClick={() => addShape('ellipse')} disabled={!enabled}><Circle size={20} /></Tool>
        <Tool label="Añadir línea" onClick={() => addShape('line')} disabled={!enabled}><Minus size={20} /></Tool>
        <Tool label="Añadir flecha" onClick={() => addShape('arrow')} disabled={!enabled}><ArrowRight size={20} /></Tool>
        <span className="rail-divider" />
        <Tool label="Añadir cuenta regresiva" onClick={() => addTimer('countdown')} disabled={!enabled}><Hourglass size={20} /></Tool>
        <Tool label="Añadir cronómetro" onClick={() => addTimer('stopwatch')} disabled={!enabled}><Timer size={20} /></Tool>
        <div className="rail-bottom"><Tool label="Atajos de teclado" onClick={() => setHelp(true)}><Keyboard size={19} /></Tool></div>
      </nav>
      <aside className="library-panel"><div className="sidebar-tabs" role="tablist" aria-label="Contenido del estudio">
        <button role="tab" aria-selected={tab === 'library'} className={tab === 'library' ? 'selected' : ''} onClick={() => setTab('library')}><ImageIcon size={15} />Biblioteca</button>
        <button role="tab" aria-selected={tab === 'layers'} className={tab === 'layers' ? 'selected' : ''} onClick={() => setTab('layers')}><Layers size={15} />Capas<span className="count">{state.items.length}</span></button>
      </div>
        {tab === 'library' ? <>
          <div className="library-search"><Search size={14} /><input placeholder="Buscar archivos…" aria-label="Buscar archivos" value={search} onChange={e => setSearch(e.target.value)} /><kbd>⌕</kbd></div>
          <div className="library-subtitle"><span>TUS ARCHIVOS</span><span>{state.media.length} archivos</span></div>
          <div className="media-list">
            {!state.media.length ? <div className="empty-library"><span><ImageIcon size={24} strokeWidth={1.2} /></span><strong>Tu biblioteca, a tu manera</strong><p>Sube los gráficos de tu canal.<br />Estarán aquí cuando los necesites.</p></div>
              : state.media.filter(m => m.name.toLocaleLowerCase().includes(search.toLocaleLowerCase())).map(m => <button key={m.id} className={`media-card ${media?.id === m.id ? 'selected' : ''}`} title={`Añadir ${m.name} al escenario`}
                draggable={enabled} disabled={!enabled} onDragStart={e => e.dataTransfer.setData('application/overlay-media', m.id)}
                onClick={() => room.send({ t: 'item.add', mediaId: m.id, x: 120, y: 120 })}>
                <span className="media-thumb"><MediaThumbnail roomId={state.roomId} media={m} /><span className="mime-chip">{m.mime.split('/')[1].toUpperCase()}</span><span className="add-to-stage"><Plus size={18} /></span></span>
                <strong>{m.name}</strong><small>{m.width} × {m.height}</small></button>)}
            {!!state.media.length && !state.media.some(m => m.name.toLocaleLowerCase().includes(search.toLocaleLowerCase())) && <p className="no-results">No hay archivos con ese nombre.</p>}
          </div>
          <div className="library-bottom"><div className="storage-line"><span>Almacenamiento</span><span>{(state.media.reduce((n, m) => n + m.size, 0) / 1024 / 1024).toFixed(1)} / 500 MB</span></div><div className="storage-track"><i style={{ width: `${state.media.reduce((n, m) => n + m.size, 0) / (500 * 1024 * 1024) * 100}%` }} /></div>
            <button className="secondary-button upload-button" onClick={() => fileInput.current?.click()} disabled={!enabled || uploading}>{uploading ? <LoaderCircle size={15} className="spin" /> : <Upload size={15} />}{uploading ? 'Subiendo archivo…' : 'Subir archivos'}</button>
            <span className="upload-formats">IMÁGENES / GIF: 25 MB · VÍDEO: 50 MB</span></div>
        </> : <><div className="library-subtitle"><span>ORDEN DEL ESCENARIO</span><span>{state.items.length} elementos</span></div><div className="layers-list">
          {[...state.items].reverse().map(item => <div className={`layer-row ${item.id === selectedId ? 'selected' : ''}`} key={item.id}>
            <button className="layer-select" onClick={() => setSelectedId(item.id)}><ItemIcon item={item} size={15} /><span>{item.name}</span></button>
            <button aria-label={`${item.visible ? 'Ocultar' : 'Mostrar'} ${item.name}`} disabled={!enabled} onClick={() => room.send({ t: 'item.patch', id: item.id, patch: { visible: !item.visible } })}>{item.visible ? <Eye size={13} /> : <EyeOff size={13} />}</button>
            <button aria-label={`${item.locked ? 'Desbloquear' : 'Bloquear'} ${item.name}`} disabled={!enabled} onClick={() => room.send({ t: 'item.patch', id: item.id, patch: { locked: !item.locked } })}>{item.locked ? <LockKeyhole size={13} /> : <UnlockKeyhole size={13} />}</button>
          </div>)}
          {!state.items.length && <div className="empty-library"><Layers size={25} /><strong>Todo en su sitio</strong><p>Los elementos que añadas aparecerán en esta lista.</p></div>}
        </div><p className="layers-help">Las capas superiores se dibujan al frente.</p></>}
      </aside>
      <main className="workspace"><div className="canvas-toolbar"><div className="workspace-label"><Layers size={14} /><span>Escenario principal</span></div>
        <div className="canvas-controls"><Tool label="Mostrar cuadrícula" active={grid} onClick={() => setGrid(g => !g)}><Grid2X2 size={15} /></Tool><span className="toolbar-divider" />
          <Tool label="Alejar" onClick={() => zoomBy(1 / 1.2)}><Minus size={14} /></Tool><span className="zoom-value">{Math.round(view.zoom * 100)}%</span><Tool label="Acercar" onClick={() => zoomBy(1.2)}><Plus size={14} /></Tool>
          <button className="fit-button" title="Ajustar al escenario (Ctrl+0)" onClick={() => setFitSignal(n => n + 1)}><Maximize size={13} /><span>Ajustar</span></button></div>
      </div>
        <Canvas room={room} selectedId={selectedId} select={setSelectedId} view={view} setView={setView} grid={grid} hand={hand} fitSignal={fitSignal} upload={(files, at) => void upload(files, at)} chooseFile={() => fileInput.current?.click()} />
        <footer className="canvas-footer"><span className={`save-state ${room.pending || room.status !== 'connected' ? 'pending' : ''}`}>{room.pending ? <LoaderCircle className="spin" size={13} /> : <CheckCheck size={14} />}
          {room.status !== 'connected' ? 'Esperando conexión' : room.pending ? 'Guardando cambios…' : room.isPreviewing ? 'Editando en vivo…' : 'Cambios guardados'}</span>
          <span>{state.items.length} {state.items.length === 1 ? 'elemento' : 'elementos'}<i />{state.stage.w} × {state.stage.h}<span className="footer-transparent"><i />Fondo transparente</span></span></footer>
      </main>
      <aside className="properties-panel"><div className="properties-heading"><span><span className="purple-dot" />PROPIEDADES</span><Settings2 size={15} /></div>
        {selected ? <fieldset className="properties-content" disabled={!enabled}>
          <div className="selected-type"><span><ItemIcon item={selected} />{selected.type === 'shape' ? shapeDefaults[selected.shape].name : selected.type === 'timer' ? selected.kind === 'countdown' ? 'Cuenta regresiva' : 'Cronómetro' : { image: 'Imagen', gif: 'GIF animado', video: 'Vídeo', text: 'Texto' }[selected.type]}</span><div><Tool label={selected.visible ? 'Ocultar elemento' : 'Mostrar elemento'} onClick={() => save({ visible: !selected.visible })}>{selected.visible ? <Eye size={15} /> : <EyeOff size={15} />}</Tool>
            <Tool label={selected.locked ? 'Desbloquear elemento' : 'Bloquear elemento'} active={selected.locked} onClick={() => save({ locked: !selected.locked })}>{selected.locked ? <LockKeyhole size={14} /> : <UnlockKeyhole size={14} />}</Tool></div></div>
          <NameField key={`name:${selected.id}`} item={selected} save={save} />
          {selected.type === 'shape' && <ShapeProperties key={`shape:${selected.id}`} item={selected} save={save} />}
          {selected.type === 'timer' && <TimerProperties key={`timer:${selected.id}`} item={selected} send={room.send} serverOffset={room.serverOffset} />}
          {(selected.type === 'text' || selected.type === 'timer') && <TextProperties key={`text:${selected.id}`} item={selected} save={save} />}
          {selected.type === 'video' && <VideoProperties item={selected} save={save} send={room.send} duration={media?.duration} serverOffset={room.serverOffset} pending={room.pending} />}
          {'mediaId' in selected && <label className="property-label media-fit">AJUSTE<select aria-label="Ajuste del archivo" value={selected.fit ?? 'contain'} onChange={e => save({ fit: e.target.value as 'contain' | 'cover' | 'fill' })}><option value="contain">Contener</option><option value="cover">Cubrir</option><option value="fill">Estirar</option></select></label>}
          <section className="property-section"><h3>Transformación<span>PX</span></h3><div className="number-grid">
            <NumberField label="X" value={selected.x} min={-100000} max={100000} onSave={x => save({ x })} disabled={selected.locked} />
            <NumberField label="Y" value={selected.y} min={-100000} max={100000} onSave={y => save({ y })} disabled={selected.locked} />
            <NumberField label="Ancho" value={selected.w} min={1} max={16384} onSave={w => save({ w })} disabled={selected.locked} />
            <NumberField label="Alto" value={selected.h} min={1} max={16384} onSave={h => save({ h })} disabled={selected.locked} />
          </div><NumberField label="Rotación" value={selected.rot} min={-360} max={360} suffix="°" onSave={rot => save({ rot })} disabled={selected.locked} /></section>
          <section className="property-section"><h3>Opacidad<span>{Math.round(selected.opacity * 100)}%</span></h3><NumberField label="Opacidad" value={selected.opacity * 100} min={0} max={100} suffix="%" onSave={opacity => save({ opacity: opacity / 100 })} /></section>
          <section className="property-section"><h3>Orden de capa<span>{state.items.findIndex(i => i.id === selected.id) + 1} / {state.items.length}</span></h3><div className="layer-order"><button className="secondary-button" onClick={() => reorder(1)} disabled={state.items.at(-1)?.id === selected.id}><ArrowUp size={14} />Adelante</button><button className="secondary-button" onClick={() => reorder(-1)} disabled={state.items[0]?.id === selected.id}><ArrowDown size={14} />Atrás</button></div></section>
          {media && <section className="source-info"><span>ARCHIVO ORIGINAL</span><strong title={media.name}>{media.name}</strong><small>{media.width} × {media.height} · {(media.size / 1024).toFixed(0)} KB</small></section>}
          <button className="delete-button" onClick={() => room.send({ t: 'item.remove', id: selected.id })}><Trash2 size={14} />Eliminar del escenario</button>
        </fieldset> : <div className="empty-properties"><span className="property-illustration"><MousePointer2 size={29} strokeWidth={1.2} /></span><h3>Cada detalle cuenta</h3><p>Selecciona un elemento para ajustar su posición, tamaño y apariencia.</p><div className="property-tips"><span><MousePointer2 size={14} />Clic para seleccionar</span><span><Maximize size={14} />Arrastra para transformar</span><span><Layers size={14} />Organiza desde Capas</span></div></div>}
        <div className="properties-footer"><PanelRight size={13} /><span>Lo que diseñas, en tu directo.</span></div>
      </aside>
    </div>
    <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,.mp4,.webm,.gif" multiple hidden aria-label="Subir archivos" onChange={e => e.target.files && void upload(e.target.files)} />
    {room.error && <div className="toast error-toast" role="alert"><span>{room.error}</span><button aria-label="Cerrar aviso" onClick={() => room.setError('')}><X size={15} /></button></div>}
    {notice && <div className="toast" role="status"><Check size={16} /><span>{notice}</span></div>}
    {help && <div className="modal-backdrop" onMouseDown={() => setHelp(false)}><section className="modal" role="dialog" aria-modal="true" aria-label="Atajos de teclado" onMouseDown={e => e.stopPropagation()}><button className="modal-close" aria-label="Cerrar" onClick={() => setHelp(false)}><X size={18} /></button><Keyboard className="modal-icon" /><h2>Un poco más de control</h2><p>Pequeños atajos para grandes directos.</p>
      <dl className="shortcuts"><dt>Mover el lienzo</dt><dd>Espacio + arrastrar</dd><dt>Acercar o alejar</dt><dd>Rueda del ratón</dd><dt>Ajustar escenario</dt><dd>Ctrl / ⌘ + 0</dd><dt>Mover elemento</dt><dd>Flechas · Shift: 10 px</dd><dt>Eliminar elemento</dt><dd>Supr / Retroceso</dd><dt>Redimensionar libremente</dt><dd>Shift + manija</dd><dt>Rotar en pasos de 15°</dt><dd>Shift + rotación</dd><dt>Quitar selección</dt><dd>Esc</dd></dl></section></div>}
    {links && <div className="modal-backdrop" onMouseDown={() => setLinks(false)}><section className="modal links-modal" role="dialog" aria-modal="true" aria-label="Enlaces del estudio" onMouseDown={e => e.stopPropagation()}><button className="modal-close" aria-label="Cerrar" onClick={() => setLinks(false)}><X size={18} /></button><Link className="modal-icon" /><h2>Conecta tu estudio</h2><p>Guarda estos enlaces para volver a tu sala.</p>
      <label>Overlay para OBS<span className="link-description">Añade una fuente de navegador de 1920 × 1080.</span><input readOnly value={overlayUrl} onFocus={e => e.currentTarget.select()} /></label><button className="secondary-button" onClick={() => void copy(overlayUrl, 'Enlace del overlay copiado')}><Copy size={14} />Copiar enlace de visualización</button>
      <label>Panel de edición<span className="link-description">Comparte este enlace solo con quienes puedan editar.</span><input readOnly value={editUrl} onFocus={e => e.currentTarget.select()} /></label><button className="secondary-button" onClick={() => void copy(editUrl, 'Enlace del panel copiado')}><Copy size={14} />Copiar enlace de edición</button>
    </section></div>}
  </div>;
}
