import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { RoomConnection } from './useRoom';
const presets = [
  ['1920x1080', 'Full HD · 1920 × 1080'], ['1280x720', 'HD · 1280 × 720'],
  ['2560x1440', '1440p · 2560 × 1440'], ['3840x2160', '4K · 3840 × 2160'],
  ['1080x1920', 'Vertical · 1080 × 1920'], ['1080x1080', 'Cuadrado · 1080 × 1080'],
];
export function StageSettings({ room, close }: { room: RoomConnection; close: () => void }) {
  const stage = room.state!.stage;
  const [width, setWidth] = useState(String(stage.w)), [height, setHeight] = useState(String(stage.h));
  useEffect(() => { setWidth(String(stage.w)); setHeight(String(stage.h)); }, [stage.w, stage.h]);
  const size = `${width}x${height}`, preset = presets.some(([value]) => value === size) ? size : 'custom';
  const valid = [width, height].every(value => /^\d+$/.test(value) && Number(value) >= 64 && Number(value) <= 3840);
  const enabled = room.status === 'connected' && room.role === 'editor' && !room.pending;
  return <div className="modal-backdrop" onMouseDown={close}><form className="modal stage-settings" role="dialog" aria-modal="true" aria-label="Tamaño del escenario" onMouseDown={e => e.stopPropagation()}
    onKeyDown={e => { if (e.key === 'Escape') close(); }} onSubmit={e => { e.preventDefault(); if (valid && enabled && room.send({ t: 'stage.resize', w: Number(width), h: Number(height) })) close(); }}>
    <button type="button" className="modal-close" aria-label="Cerrar" onClick={close}><X size={18} /></button>
    <h2>Tamaño del escenario</h2><p>El tamaño cambia el área visible. Los elementos conservan su posición y tamaño; podrás reorganizarlos o deshacer el cambio.</p>
    <label className="property-label">FORMATO<select aria-label="Formato del escenario" value={preset} onChange={e => {
      if (e.target.value !== 'custom') { const [w, h] = e.target.value.split('x'); setWidth(w); setHeight(h); }
    }}><option value="custom" disabled>Personalizado</option>{presets.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <div className="stage-dimensions"><label>Ancho<input autoFocus aria-label="Ancho del escenario" type="number" min="64" max="3840" step="1" value={width} onChange={e => setWidth(e.target.value)} /></label>
      <label>Alto<input aria-label="Alto del escenario" type="number" min="64" max="3840" step="1" value={height} onChange={e => setHeight(e.target.value)} /></label></div>
    <p>De 64 a 3840 píxeles por lado. Configura el mismo ancho y alto en la fuente de navegador de OBS.</p>
    <button className="primary-button" type="submit" disabled={!valid || !enabled}>Aplicar tamaño</button>
  </form></div>;
}
