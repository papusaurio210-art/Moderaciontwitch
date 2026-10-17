import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { EyeOff, ImagePlus, LockKeyhole, Scan, Upload } from 'lucide-react';
import { clamp, intersectsStage, type Item, type ItemPatch } from '../shared/model';
import { ItemContent, itemStyle } from './components';
import type { RoomConnection } from './useRoom';

export interface View { x: number; y: number; zoom: number }
interface Props {
  room: RoomConnection; selectedId: string | null; select: (id: string | null) => void;
  view: View; setView: React.Dispatch<React.SetStateAction<View>>;
  grid: boolean; hand: boolean; fitSignal: number;
  upload: (files: FileList | File[], at?: { x: number; y: number }) => void; chooseFile: () => void;
}

export function Canvas({ room, selectedId, select, view, setView, grid, hand, fitSignal, upload, chooseFile }: Props) {
  const canvas = useRef<HTMLDivElement>(null);
  const viewRef = useRef(view); viewRef.current = view;
  const [space, setSpace] = useState(false);
  const [draggingFile, setDraggingFile] = useState(false);
  const state = room.state!;
  const enabled = room.status === 'connected' && room.role === 'editor';
  const fit = useCallback(() => {
    const node = canvas.current; if (!node) return;
    const zoom = Math.min((node.clientWidth - 112) / state.stage.w, (node.clientHeight - 140) / state.stage.h, 1);
    setView({ zoom: Math.max(.08, zoom), x: (node.clientWidth - state.stage.w * zoom) / 2, y: (node.clientHeight - state.stage.h * zoom) / 2 });
  }, [setView, state.stage.w, state.stage.h]);
  useEffect(() => { fit(); }, [fit, fitSignal]);
  useEffect(() => {
    const observer = new ResizeObserver(fit); if (canvas.current) observer.observe(canvas.current);
    return () => observer.disconnect();
  }, [fit]);
  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.code === 'Space' && !/INPUT|TEXTAREA/.test((e.target as HTMLElement).tagName)) { e.preventDefault(); setSpace(true); } };
    const up = (e: KeyboardEvent) => { if (e.code === 'Space') setSpace(false); };
    const blur = () => setSpace(false);
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', blur);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur); };
  }, []);
  useEffect(() => {
    const node = canvas.current!;
    const wheel = (e: WheelEvent) => {
      e.preventDefault(); const bounds = node.getBoundingClientRect(); const v = viewRef.current;
      const zoom = clamp(v.zoom * Math.exp(-e.deltaY * .0015), .08, 2);
      const x = e.clientX - bounds.left, y = e.clientY - bounds.top;
      setView({ zoom, x: x - (x - v.x) * zoom / v.zoom, y: y - (y - v.y) * zoom / v.zoom });
    };
    node.addEventListener('wheel', wheel, { passive: false }); return () => node.removeEventListener('wheel', wheel);
  }, [setView]);

  function dragItem(event: ReactPointerEvent, item: Item, mode: 'move' | 'resize' | 'rotate' = 'move') {
    if (hand || space || event.button === 1) return;
    event.stopPropagation();
    if (!enabled || item.locked || event.button !== 0) return;
    event.preventDefault(); select(item.id);
    const node = event.currentTarget as HTMLElement; node.setPointerCapture(event.pointerId);
    const startX = event.clientX, startY = event.clientY, zoom = view.zoom;
    const bounds = canvas.current!.getBoundingClientRect();
    let patch: ItemPatch = {}, moved = false;
    const move = (e: PointerEvent) => {
      const dx = (e.clientX - startX) / zoom, dy = (e.clientY - startY) / zoom;
      if (Math.abs(dx) + Math.abs(dy) < 1 && !moved) return;
      moved = true;
      if (mode === 'move') patch = { x: clamp(Math.round(item.x + dx), -100000, 100000), y: clamp(Math.round(item.y + dy), -100000, 100000) };
      if (mode === 'resize') {
        const a = item.rot * Math.PI / 180;
        const localDx = dx * Math.cos(a) + dy * Math.sin(a);
        const localDy = -dx * Math.sin(a) + dy * Math.cos(a);
        const maxWidth = Math.min(16384, 16384 * item.w / item.h);
        const width = clamp(item.w + localDx, 1, e.shiftKey ? 16384 : maxWidth);
        const height = e.shiftKey ? clamp(item.h + localDy, 1, 16384) : width * item.h / item.w;
        const dw = width - item.w, dh = height - item.h;
        patch = { w: width, h: height, x: item.x + (dw * Math.cos(a) - dh * Math.sin(a) - dw) / 2,
          y: item.y + (dw * Math.sin(a) + dh * Math.cos(a) - dh) / 2 };
      }
      if (mode === 'rotate') {
        const x = (e.clientX - bounds.left - view.x) / zoom - item.x - item.w / 2;
        const y = (e.clientY - bounds.top - view.y) / zoom - item.y - item.h / 2;
        const angle = Math.atan2(y, x) * 180 / Math.PI + 90;
        patch = { rot: e.shiftKey ? Math.round(angle / 15) * 15 : Math.round(angle) };
      }
      room.preview(item.id, patch);
    };
    const end = () => {
      node.removeEventListener('pointermove', move); node.removeEventListener('pointerup', end); node.removeEventListener('pointercancel', end);
      if (moved) room.send({ t: 'item.patch', id: item.id, patch });
    };
    node.addEventListener('pointermove', move); node.addEventListener('pointerup', end); node.addEventListener('pointercancel', end);
  }
  function background(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button === 1 || (event.button === 0 && (hand || space))) {
      event.preventDefault(); const node = event.currentTarget; node.setPointerCapture(event.pointerId);
      const start = { x: event.clientX, y: event.clientY, view };
      const move = (e: PointerEvent) => setView({ ...view, x: start.view.x + e.clientX - start.x, y: start.view.y + e.clientY - start.y });
      const end = () => { node.removeEventListener('pointermove', move); node.removeEventListener('pointerup', end); node.removeEventListener('pointercancel', end); };
      node.addEventListener('pointermove', move); node.addEventListener('pointerup', end); node.addEventListener('pointercancel', end);
    } else if (event.button === 0) select(null);
  }
  return <div className={`canvas ${hand || space ? 'panning' : ''} ${draggingFile ? 'file-over' : ''}`} ref={canvas} data-testid="editor-canvas"
    onPointerDown={background} onAuxClick={e => e.preventDefault()}
    onDragOver={e => { e.preventDefault(); setDraggingFile(true); }}
    onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDraggingFile(false); }}
    onDrop={e => {
      e.preventDefault(); setDraggingFile(false); if (!enabled) return;
      const bounds = canvas.current!.getBoundingClientRect();
      const at = { x: Math.round((e.clientX - bounds.left - view.x) / view.zoom), y: Math.round((e.clientY - bounds.top - view.y) / view.zoom) };
      const mediaId = e.dataTransfer.getData('application/overlay-media');
      if (mediaId) room.send({ t: 'item.add', mediaId, ...at }); else upload(e.dataTransfer.files, at);
    }}>
    {grid && <div className="canvas-grid" style={{ backgroundSize: `${40 * view.zoom}px ${40 * view.zoom}px`, backgroundPosition: `${view.x}px ${view.y}px` }} />}
    <div className="canvas-topnote"><span>ESCENARIO</span><span>Los elementos visibles dentro aparecen en tu overlay</span></div>
    <div className="world" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})` }}>
      <div className="stage-paper" style={{ width: state.stage.w, height: state.stage.h }} />
      <div className="stage-caption" style={{ transform: `scale(${1 / view.zoom})` }}><span className="stage-dot" />OVERLAY · {state.stage.w} × {state.stage.h}</div>
      {room.rendered.map(item => <div key={item.id} data-item-id={item.id}
        className={`canvas-item ${selectedId === item.id ? 'selected' : ''} ${item.locked ? 'locked' : ''} ${!item.visible ? 'is-hidden' : ''}`}
        style={{ ...itemStyle(item), opacity: 1, '--handle-scale': 1 / view.zoom } as React.CSSProperties}
        onPointerDown={e => dragItem(e, item)}>
        <div className="canvas-item-content" style={{ opacity: item.visible ? item.opacity : .25 }}>
          <ItemContent roomId={state.roomId} item={item} media={item.type === 'text' ? undefined : state.media.find(m => m.id === item.mediaId)} editor active={item.visible && intersectsStage(item, state.stage)} serverOffset={room.serverOffset} />
        </div>
        {!item.visible && <>
          <div className="hidden-item-border" style={{ borderWidth: 1 / view.zoom }} />
          <span className="hidden-item-label"><EyeOff size={11} />Oculto</span>
        </>}
        {selectedId === item.id && <>
          <div className="selection-border" style={{ borderWidth: 1.5 / view.zoom }} />
          <div className="selection-label">{item.locked && <LockKeyhole size={10} />}{!intersectsStage(item, state.stage) ? 'Fuera del escenario' : item.name}</div>
          {!item.locked && <><i className="corner tl" /><i className="corner tr" /><i className="corner bl" />
            <button aria-label="Redimensionar imagen" className="corner br resize-handle" onPointerDown={e => dragItem(e, item, 'resize')} />
            <button aria-label="Rotar imagen" className="rotate-handle" onPointerDown={e => dragItem(e, item, 'rotate')} />
          </>}
          <span className="selection-measures">{Math.round(item.w)} × {Math.round(item.h)} · {Math.round(item.rot)}°</span>
        </>}
      </div>)}
    </div>
    {state.items.length === 0 && <div className="empty-stage"><span className="empty-art"><ImagePlus size={30} strokeWidth={1.3} /></span>
      <h2>El escenario es tuyo</h2><p>Arrastra un archivo al lienzo<br />y dale personalidad a tu directo.</p>
      <button className="secondary-button" onPointerDown={e => e.stopPropagation()} onClick={chooseFile} disabled={!enabled}><Upload size={14} />Añadir archivo</button>
      <span className="empty-formats">IMÁGENES Y GIF · MP4 Y WEBM</span>
    </div>}
    {draggingFile && <div className="drop-veil"><Upload size={30} /><strong>Suelta tu archivo aquí</strong></div>}
    <div className="canvas-hint"><Scan size={13} />Rueda para zoom<span>·</span>Espacio + arrastrar para navegar</div>
  </div>;
}
