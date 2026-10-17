import { useEffect, useRef, useState } from 'react';
import { clamp, videoPosition, type BaseItem, type ItemPatch, type ShapeItem, type TextItem, type TimerItem, type VideoItem } from '../shared/model';
import type { RoomConnection } from './useRoom';

export function NumberField({ label, value, onSave, min, max, suffix = '', disabled = false }: { label: string; value: number; onSave: (n: number) => void; min: number; max: number; suffix?: string; disabled?: boolean }) {
  const [draft, setDraft] = useState(String(Math.round(value * 100) / 100));
  const editing = useRef(false);
  useEffect(() => { if (!editing.current) setDraft(String(Math.round(value * 100) / 100)); }, [value]);
  return <label className="number-field"><span>{label}</span><input type="number" aria-label={label} value={draft} min={min} max={max} disabled={disabled}
    onFocus={() => { editing.current = true; }}
    onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
    onBlur={e => { editing.current = false; const text = e.currentTarget.value, n = Number(text); if (text.trim() && Number.isFinite(n)) { const next = clamp(n, min, max); setDraft(String(next)); if (next !== value) onSave(next); } else setDraft(String(value)); }} /><small>{suffix}</small></label>;
}
export function NameField({ item, save }: { item: BaseItem; save: (patch: ItemPatch) => void }) {
  const [name, setName] = useState(item.name);
  const editing = useRef(false);
  useEffect(() => { if (!editing.current) setName(item.name); }, [item.id, item.name]);
  return <label className="property-label">NOMBRE DEL ELEMENTO<input aria-label="Nombre del elemento" value={name} maxLength={120} onFocus={() => { editing.current = true; }} onChange={e => setName(e.target.value)}
    onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} onBlur={e => { editing.current = false; const next = e.currentTarget.value.trim(); next ? save({ name: next }) : setName(item.name); }} /></label>;
}

function TextField({ item, save }: { item: TextItem; save: (patch: ItemPatch) => void }) {
  const [draft, setDraft] = useState(item.text);
  const editing = useRef(false);
  useEffect(() => { if (!editing.current) setDraft(item.text); }, [item.text]);
  return <label className="property-label">CONTENIDO<textarea aria-label="Contenido del texto" value={draft} maxLength={4000} rows={4}
    onFocus={() => { editing.current = true; }} onBlur={() => { editing.current = false; setDraft(item.text); }}
    onChange={e => { setDraft(e.target.value); save({ text: e.target.value }); }} /></label>;
}
export function TextProperties({ item, save }: { item: TextItem | TimerItem; save: (patch: ItemPatch) => void }) {
  return <section className="property-section text-properties"><h3>{item.type === 'timer' ? 'Apariencia' : 'Texto'}</h3>
    {item.type === 'text' && <TextField item={item} save={save} />}
    <label className="property-label">FUENTE<select aria-label="Fuente del texto" value={item.fontFamily} onChange={e => save({ fontFamily: e.target.value as TextItem['fontFamily'] })}>
      {['Inter', 'JetBrains Mono', 'Arial', 'Georgia'].map(font => <option key={font}>{font}</option>)}
    </select></label>
    <NumberField label="Tamaño de fuente" value={item.fontSize} min={8} max={512} onSave={fontSize => save({ fontSize })} suffix="px" />
    <div className="text-format-buttons"><button type="button" className={item.bold ? 'active' : ''} aria-label="Negrita" aria-pressed={item.bold} onClick={() => save({ bold: !item.bold })}><b>B</b></button>
      <button type="button" className={item.italic ? 'active' : ''} aria-label="Cursiva" aria-pressed={item.italic} onClick={() => save({ italic: !item.italic })}><i>I</i></button>
      <select aria-label="Alineación del texto" value={item.align} onChange={e => save({ align: e.target.value as TextItem['align'] })}>
        <option value="left">Izquierda</option><option value="center">Centro</option><option value="right">Derecha</option>
      </select></div>
    <label className="color-field">Color del texto<input type="color" aria-label="Color del texto" value={item.color} onChange={e => save({ color: e.target.value })} /></label>
    <NumberField label="Contorno" value={item.strokeWidth} min={0} max={16} onSave={strokeWidth => save({ strokeWidth })} suffix="px" />
    <label className="color-field">Color del contorno<input type="color" aria-label="Color del contorno" value={item.strokeColor} onChange={e => save({ strokeColor: e.target.value })} /></label>
    <label className="check-field"><input type="checkbox" checked={item.shadow} onChange={e => save({ shadow: e.target.checked })} />Sombra del texto</label>
    <label className="check-field"><input type="checkbox" checked={item.background !== null} onChange={e => save({ background: e.target.checked ? '#111318' : null })} />Fondo del texto</label>
    {item.background !== null && <label className="color-field">Color de fondo<input type="color" aria-label="Color de fondo" value={item.background} onChange={e => save({ background: e.target.value })} /></label>}
    <p className="property-note">{item.type === 'timer' ? 'Aumenta el ancho o el alto si se recorta el tiempo.' : 'El texto se ajusta al ancho. Aumenta el alto si se recortan líneas.'}</p>
  </section>;
}
export function ShapeProperties({ item, save }: { item: ShapeItem; save: (patch: ItemPatch) => void }) {
  const closed = item.shape === 'rect' || item.shape === 'ellipse';
  return <section className="property-section shape-properties"><h3>Apariencia</h3>
    {closed && <>
      <label className="check-field"><input type="checkbox" checked={item.fill !== null}
        onChange={e => save({ fill: e.target.checked ? '#8c70ff' : null })} />Relleno de la figura</label>
      {item.fill !== null && <label className="color-field">Color de relleno<input type="color" aria-label="Color de relleno" value={item.fill}
        onChange={e => save({ fill: e.target.value })} /></label>}
    </>}
    <label className="color-field">{closed ? 'Color del borde' : 'Color del trazo'}<input type="color"
      aria-label={closed ? 'Color del borde' : 'Color del trazo'} value={item.borderColor} onChange={e => save({ borderColor: e.target.value })} /></label>
    <NumberField label={closed ? 'Grosor del borde' : 'Grosor del trazo'} value={item.borderWidth} min={0} max={64} suffix="px" onSave={borderWidth => save({ borderWidth })} />
    <p className="property-note">{closed ? 'Sin relleno y con borde puedes crear un marco.' : 'Usa la rotación para orientar el trazo y el ancho para cambiar su longitud.'}</p>
  </section>;
}
function VolumeControl({ volume, save, pending }: { volume: number; save: (patch: ItemPatch) => void; pending: number }) {
  const percent = Math.round(volume * 100);
  const [draft, setDraft] = useState(percent);
  const [adjusting, setAdjusting] = useState(false);
  // Keep the latest local input until all of this editor's changes have been
  // acknowledged; an older acknowledgement must not move the thumb backwards.
  useEffect(() => { if (!adjusting && pending === 0) setDraft(percent); }, [percent, adjusting, pending]);
  return <label className="volume-control"><span>Volumen<output>{draft}%</output></span>
    <input type="range" aria-label="Volumen del vídeo" aria-valuetext={`${draft}%`} min={0} max={100} step={1} value={draft}
      onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); setAdjusting(true); }}
      onPointerUp={() => setAdjusting(false)} onPointerCancel={() => setAdjusting(false)}
      onKeyDown={() => setAdjusting(true)} onKeyUp={() => setAdjusting(false)} onBlur={() => setAdjusting(false)}
      onChange={e => { const value = Number(e.target.value); setDraft(value); save({ volume: value / 100 }); }} />
  </label>;
}
export function VideoProperties({ item, save, send, duration = 0, serverOffset, pending }: {
  item: VideoItem; save: (patch: ItemPatch) => void; send: RoomConnection['send']; duration?: number; serverOffset: number; pending: number;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    setNow(Date.now());
    if (!item.playing || item.loop) return;
    const timer = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(timer);
  }, [item.playing, item.loop, item.startedAt]);
  const ended = !item.loop && duration > 0 && videoPosition(item, now + serverOffset, duration) >= duration;
  const playing = item.playing && !ended;
  return <section className="property-section video-properties"><h3>Reproducción</h3>
    <p className="property-note">{ended ? 'Finalizado' : playing ? 'En reproducción' : 'En pausa'}</p>
    <div className="video-actions"><button className="secondary-button" onClick={() => send({ t: 'video.control', id: item.id, action: playing ? 'pause' : 'play' })}>{playing ? 'Pausar vídeo' : 'Reproducir vídeo'}</button>
      <button className="secondary-button" onClick={() => send({ t: 'video.control', id: item.id, action: 'restart' })}>Reiniciar vídeo</button></div>
    <label className="check-field"><input type="checkbox" checked={item.loop} onChange={e => save({ loop: e.target.checked })} />Repetir vídeo</label>
    <label className="check-field"><input type="checkbox" checked={!item.muted} onChange={e => save({ muted: !e.target.checked })} />Sonido en el overlay</label>
    <VolumeControl key={item.id} volume={item.volume ?? 1} save={save} pending={pending} />
    <p className="property-note">El panel permanece en silencio. Para mezclar el sonido, activa «Controlar audio vía OBS» en la fuente de navegador.</p>
  </section>;
}
