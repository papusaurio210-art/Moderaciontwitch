import { useState } from 'react';
import { AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal, AlignStartVertical, AlignCenterVertical, AlignEndVertical, Copy } from 'lucide-react';
import { alignments } from '../shared/editing';
import type { Item } from '../shared/model';
import type { RoomConnection } from './useRoom';

export function SelectionTools({ items, room }: { items: Item[]; room: RoomConnection }) {
  const [target, setTarget] = useState<'selection' | 'stage'>('selection');
  const icons = [AlignStartVertical, AlignCenterVertical, AlignEndVertical, AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal];
  const labels = ['Alinear a la izquierda', 'Centrar horizontalmente', 'Alinear a la derecha', 'Alinear arriba', 'Centrar verticalmente', 'Alinear abajo'];
  const ids = items.map(i => i.id), locked = items.some(i => i.locked);
  return <section className="property-section selection-tools"><h3>Alinear y duplicar</h3>
    {items.length > 1 ? <label className="property-label">ALINEAR RESPECTO A<select aria-label="Referencia de alineación" value={target} onChange={e => setTarget(e.target.value as typeof target)}>
      <option value="selection">Selección</option><option value="stage">Escenario</option>
    </select></label> : <p className="property-note">Alinear respecto al escenario.</p>}
    <div className="alignment-buttons">{alignments.map((alignment, index) => { const Icon = icons[index]; return <button key={alignment} className="icon-button" aria-label={labels[index]} title={labels[index]} disabled={locked || room.pending > 0}
      onClick={() => room.send({ t: 'items.align', ids, alignment, target: items.length === 1 ? 'stage' : target })}><Icon size={17} /></button>; })}</div>
    {locked && <p className="property-note">Desbloquea la selección para moverla o alinearla.</p>}
    <button className="secondary-button" disabled={room.pending > 0} onClick={() => room.send({ t: 'items.duplicate', ids })}><Copy size={14} />Duplicar selección</button>
  </section>;
}
