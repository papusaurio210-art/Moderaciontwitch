import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { EyeOff, ImagePlus, LockKeyhole, Scan, Upload } from 'lucide-react';
import { clamp, intersectsStage, type Item, type ItemPatch, type Stage } from '../shared/model';
import { resizeItem, type ResizeHandle } from '../shared/canvas-geometry';
import { snapMove, type SnapResult } from '../shared/snapping';
import { boundsOf, moveItems, selectionBounds } from '../shared/editing';
import { ItemContent, itemStyle } from './components';
import type { RoomConnection } from './useRoom';

export interface View { x: number; y: number; zoom: number }
interface Props {
  room: RoomConnection; selectedIds: string[]; setSelection: React.Dispatch<React.SetStateAction<string[]>>;
  view: View; setView: React.Dispatch<React.SetStateAction<View>>;
  grid: boolean; snap: boolean; hand: boolean; fitSignal: number;
  revealUpload: Stage | null;
  upload: (files: FileList | File[], at?: { x: number; y: number }) => void; chooseFile: () => void;
}

const handles: { handle: ResizeHandle; className: string; label: string }[] = [
  { handle: 'nw', className: 'tl', label: 'Redimensionar desde la esquina superior izquierda' },
  { handle: 'ne', className: 'tr', label: 'Redimensionar desde la esquina superior derecha' },
  { handle: 'sw', className: 'bl', label: 'Redimensionar desde la esquina inferior izquierda' },
  { handle: 'se', className: 'br', label: 'Redimensionar elemento' },
  { handle: 'n', className: 'edge top', label: 'Estirar desde arriba' },
  { handle: 's', className: 'edge bottom', label: 'Estirar desde abajo' },
  { handle: 'w', className: 'edge left', label: 'Estirar desde la izquierda' },
  { handle: 'e', className: 'edge right', label: 'Estirar desde la derecha' },
];

export function Canvas({ room, selectedIds, setSelection, view, setView, grid, snap, hand, fitSignal, revealUpload, upload, chooseFile }: Props) {
  const canvas = useRef<HTMLDivElement>(null);
  const lastRevealed = useRef<Stage | null>(null);
  const viewRef = useRef(view); viewRef.current = view;
  const [guides, setGuides] = useState<Pick<SnapResult, 'x' | 'y'>>({});
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const group = room.rendered.filter(i => selectedIds.includes(i.id));
  const groupBounds = group.length > 1 ? selectionBounds(group) : null;
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
    const node = canvas.current; if (!node || !revealUpload || lastRevealed.current === revealUpload) return;
    lastRevealed.current = revealUpload;
    const left = Math.min(state.stage.x, revealUpload.x), top = Math.min(state.stage.y, revealUpload.y);
    const right = Math.max(state.stage.x + state.stage.w, revealUpload.x + revealUpload.w);
    const bottom = Math.max(state.stage.y + state.stage.h, revealUpload.y + revealUpload.h);
    const zoom = clamp(Math.min(viewRef.current.zoom, (node.clientWidth - 112) / (right - left), (node.clientHeight - 140) / (bottom - top)), .08, 2);
    setView({ zoom, x: (node.clientWidth - (right - left) * zoom) / 2 - left * zoom,
      y: (node.clientHeight - (bottom - top) * zoom) / 2 - top * zoom });
  }, [revealUpload, setView, state.stage]);
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

  function leaveField() {
    const field = document.activeElement;
    if (field instanceof HTMLElement && field.matches('input, textarea, select')) field.blur();
  }

  function dragItem(event: ReactPointerEvent, item: Item, mode: 'move' | 'resize' | 'rotate' = 'move', handle: ResizeHandle = 'se') {
    if (hand || space || event.button === 1) return;
    event.stopPropagation();
    if (!enabled || event.button !== 0) return;
    leaveField(); event.preventDefault();
    if (mode === 'move' && (event.shiftKey || event.ctrlKey || event.metaKey)) {
      setSelection(current => current.includes(item.id) ? current.filter(id => id !== item.id) : [...current, item.id]); return;
    }
    const ids = mode === 'move' && selectedIds.includes(item.id) ? selectedIds : [item.id];
    setSelection(ids);
    const moving = room.rendered.filter(i => ids.includes(i.id));
    if (room.pending || moving.some(i => i.locked)) return;
    const node = event.currentTarget as HTMLElement; node.setPointerCapture(event.pointerId);
    const startX = event.clientX, startY = event.clientY, zoom = view.zoom;
    const bounds = canvas.current!.getBoundingClientRect();
    let patch: ItemPatch = {}, moved = false, delta = { dx: 0, dy: 0 };
    const move = (e: PointerEvent) => {
      const dx = (e.clientX - startX) / zoom, dy = (e.clientY - startY) / zoom;
      if (Math.abs(dx) + Math.abs(dy) < 1 && !moved) return;
      moved = true;
      if (mode === 'move') {
        delta = { dx: clamp(Math.round(dx), -100000, 100000), dy: clamp(Math.round(dy), -100000, 100000) };
        const snapped: SnapResult = snap && !e.altKey ? snapMove(moving, room.rendered, state.stage, delta.dx, delta.dy, 6 / zoom) : delta;
        setGuides({ x: snapped.x, y: snapped.y }); delta = { dx: snapped.dx, dy: snapped.dy };
        const updated = moveItems(moving, delta.dx, delta.dy);
        room.previewMany(updated.map(i => ({ id: i.id, patch: { x: i.x, y: i.y } })), delta);
        return;
      }
      if (mode === 'resize') {
        patch = resizeItem(item, handle, dx, dy, e.shiftKey);
      }
      if (mode === 'rotate') {
        const x = (e.clientX - bounds.left - view.x) / zoom - item.x - item.w / 2;
        const y = (e.clientY - bounds.top - view.y) / zoom - item.y - item.h / 2;
        const angle = Math.atan2(y, x) * 180 / Math.PI + 90;
        patch = { rot: e.shiftKey ? Math.round(angle / 15) * 15 : Math.round(angle) };
      }
      room.preview(item.id, patch);
    };
    const end = (e: PointerEvent) => {
      node.removeEventListener('pointermove', move); node.removeEventListener('pointerup', end); node.removeEventListener('pointercancel', end);
      setGuides({});
      if (e.type === 'pointercancel') { room.clearPreviews(); return; }
      if (moved) {
        if (mode === 'move') room.send({ t: 'items.move', ids, ...delta });
        else room.send({ t: 'item.patch', id: item.id, patch });
      }
    };
    node.addEventListener('pointermove', move); node.addEventListener('pointerup', end); node.addEventListener('pointercancel', end);
  }
  function background(event: ReactPointerEvent<HTMLDivElement>) {
    leaveField();
    if (event.button === 1 || (event.button === 0 && (hand || space))) {
      event.preventDefault(); const node = event.currentTarget; node.setPointerCapture(event.pointerId);
      const start = { x: event.clientX, y: event.clientY, view };
      const move = (e: PointerEvent) => setView({ ...view, x: start.view.x + e.clientX - start.x, y: start.view.y + e.clientY - start.y });
      const end = () => { node.removeEventListener('pointermove', move); node.removeEventListener('pointerup', end); node.removeEventListener('pointercancel', end); };
      node.addEventListener('pointermove', move); node.addEventListener('pointerup', end); node.addEventListener('pointercancel', end);
    } else if (event.button === 0) {
      const node = event.currentTarget, rect = node.getBoundingClientRect();
      const x = event.clientX - rect.left, y = event.clientY - rect.top;
      const previous = event.shiftKey || event.ctrlKey || event.metaKey ? selectedIds : [];
      event.preventDefault(); node.setPointerCapture(event.pointerId);
      let box: { x: number; y: number; w: number; h: number } | null = null;
      const move = (e: PointerEvent) => {
        const endX = e.clientX - rect.left, endY = e.clientY - rect.top;
        if (Math.abs(endX - x) + Math.abs(endY - y) < 4) return;
        box = { x: Math.min(x, endX), y: Math.min(y, endY), w: Math.abs(endX - x), h: Math.abs(endY - y) };
        setMarquee(box);
      };
      const end = (e: PointerEvent) => {
        node.removeEventListener('pointermove', move); node.removeEventListener('pointerup', end); node.removeEventListener('pointercancel', end);
        setMarquee(null); if (e.type === 'pointercancel') return;
        const found = box ? room.rendered.filter(item => {
          const b = boundsOf(item), left = b.x * view.zoom + view.x, top = b.y * view.zoom + view.y;
          return left < box!.x + box!.w && left + b.w * view.zoom > box!.x && top < box!.y + box!.h && top + b.h * view.zoom > box!.y;
        }).map(i => i.id) : [];
        setSelection([...new Set([...previous, ...found])]);
      };
      node.addEventListener('pointermove', move); node.addEventListener('pointerup', end); node.addEventListener('pointercancel', end);
    }
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
        className={`canvas-item ${selectedIds.includes(item.id) ? 'selected' : ''} ${item.locked ? 'locked' : ''} ${!item.visible ? 'is-hidden' : ''}`}
        style={{ ...itemStyle(item), opacity: 1, '--handle-scale': 1 / view.zoom } as React.CSSProperties}
        onPointerDown={e => dragItem(e, item)}>
        <div className="canvas-item-content" style={{ opacity: item.visible ? item.opacity : .25 }}>
          <ItemContent roomId={state.roomId} item={item} media={'mediaId' in item ? state.media.find(m => m.id === item.mediaId) : undefined} editor active={item.visible && intersectsStage(item, state.stage)} serverOffset={room.serverOffset} />
        </div>
        {!item.visible && <>
          <div className="hidden-item-border" style={{ borderWidth: 1 / view.zoom }} />
          <span className="hidden-item-label"><EyeOff size={11} />Oculto</span>
        </>}
        {selectedIds.includes(item.id) && <>
          <div className="selection-border" style={{ borderWidth: 1.5 / view.zoom }} />
          <div className="selection-label">{item.locked && <LockKeyhole size={10} />}{!intersectsStage(item, state.stage) ? 'Fuera del escenario' : item.name}</div>
          {!item.locked && selectedIds.length === 1 && <>
            {handles.map(h => <button key={h.handle} aria-label={h.label} title={h.label} disabled={!enabled}
              className={`corner resize-handle ${h.className}`} onPointerDown={e => dragItem(e, item, 'resize', h.handle)} />)}
            <button aria-label="Rotar elemento" className="rotate-handle" onPointerDown={e => dragItem(e, item, 'rotate')} />
          </>}
          <span className="selection-measures">{Math.round(item.w)} × {Math.round(item.h)} · {Math.round(item.rot)}°</span>
        </>}
      </div>)}
      {groupBounds && <div className="group-border" style={{ left: groupBounds.x, top: groupBounds.y, width: groupBounds.w, height: groupBounds.h, borderWidth: 1 / view.zoom }} />}
    </div>
    {guides.x !== undefined && <div className="snap-guide vertical" data-testid="snap-x" style={{ left: guides.x * view.zoom + view.x }} />}
    {guides.y !== undefined && <div className="snap-guide horizontal" data-testid="snap-y" style={{ top: guides.y * view.zoom + view.y }} />}
    {marquee && <div className="selection-marquee" style={{ left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h }} />}
    {state.items.length === 0 && <div className="empty-stage"><span className="empty-art"><ImagePlus size={30} strokeWidth={1.3} /></span>
      <h2>El escenario es tuyo</h2><p>Arrastra un archivo al lienzo<br />y dale personalidad a tu directo.</p>
      <button className="secondary-button" onPointerDown={e => e.stopPropagation()} onClick={chooseFile} disabled={!enabled}><Upload size={14} />Añadir archivo</button>
      <span className="empty-formats">IMÁGENES Y GIF · MP4 Y WEBM</span>
    </div>}
    {draggingFile && <div className="drop-veil"><Upload size={30} /><strong>Suelta tu archivo aquí</strong></div>}
    <div className="canvas-hint"><Scan size={13} />Rueda para zoom<span>·</span>Espacio + arrastrar para navegar</div>
  </div>;
}
