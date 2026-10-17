import { useEffect, useState } from 'react';
import type { TimerItem } from '../shared/model';
import { MAX_TIMER_DURATION } from '../shared/timers';
import type { RoomConnection } from './useRoom';
import { useTimerValue } from './TimerContent';

function durationFields(ms: number) {
  return { hours: String(Math.floor(ms / 3600000)), minutes: String(Math.floor(ms % 3600000 / 60000)), seconds: String(ms % 60000 / 1000) };
}
function DurationControl({ item, send }: { item: TimerItem; send: RoomConnection['send'] }) {
  const [draft, setDraft] = useState(() => durationFields(item.durationMs));
  // A remotely confirmed duration replaces the local draft; only the explicit
  // Apply action writes a duration, never blur or a change of selection.
  useEffect(() => { setDraft(durationFields(item.durationMs)); }, [item.durationMs]);
  const hours = Number(draft.hours), minutes = Number(draft.minutes), seconds = Number(draft.seconds);
  const durationMs = (hours * 3600 + minutes * 60 + seconds) * 1000;
  const valid = Object.values(draft).every(value => /^\d+$/.test(value)) && [hours, minutes, seconds].every(Number.isInteger)
    && hours >= 0 && minutes >= 0 && minutes <= 59 && seconds >= 0 && seconds <= 59 && durationMs >= 1000 && durationMs <= MAX_TIMER_DURATION;
  return <div className="timer-duration"><div className="timer-duration-fields">
    {(['hours', 'minutes', 'seconds'] as const).map((key, index) => <label key={key}>{['Horas', 'Minutos', 'Segundos'][index]}
      <input type="number" aria-label={['Horas de duración', 'Minutos de duración', 'Segundos de duración'][index]}
        min={0} max={key === 'hours' ? 24 : 59} step={1} value={draft[key]} onChange={e => setDraft(current => ({ ...current, [key]: e.target.value }))} />
    </label>)}
  </div><button className="secondary-button" disabled={!valid} onClick={() => send({ t: 'timer.set', id: item.id, durationMs })}>Aplicar duración</button>
    <p className="property-note">De 1 segundo a 24 horas. Aplicar restablece la cuenta y la deja pausada.</p>
  </div>;
}
export function TimerProperties({ item, send, serverOffset }: { item: TimerItem; send: RoomConnection['send']; serverOffset: number }) {
  const { text, finished } = useTimerValue(item, serverOffset);
  const running = item.running && !finished;
  return <section className="property-section timer-properties"><h3>{item.kind === 'countdown' ? 'Cuenta regresiva' : 'Cronómetro'}</h3>
    <output className="timer-readout" aria-label="Tiempo del temporizador">{text}</output>
    <p className="property-note timer-status">{finished ? 'Finalizado' : running ? 'En marcha' : 'En pausa'}</p>
    <div className="video-actions"><button className="secondary-button" onClick={() => send({ t: 'timer.control', id: item.id, action: running ? 'pause' : 'start' })}>
      {running ? 'Pausar temporizador' : 'Iniciar temporizador'}</button>
      <button className="secondary-button" onClick={() => send({ t: 'timer.control', id: item.id, action: 'reset' })}>Reiniciar temporizador</button>
    </div>
    {item.kind === 'countdown' && <DurationControl key={item.id} item={item} send={send} />}
    <p className="property-note">Ocultarlo no detiene el tiempo. Reiniciar lo deja pausado {item.kind === 'countdown' ? 'en la duración configurada.' : 'en cero.'}</p>
  </section>;
}
