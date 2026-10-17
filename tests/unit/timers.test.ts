import { describe, expect, it } from 'vitest';
import { defaultTextStyle, type TimerItem } from '../../src/shared/model';
import { controlTimer, timerElapsed, timerFinished, timerText } from '../../src/shared/timers';
import { clientMessage } from '../../src/worker/validation';

const timer: TimerItem = { id: crypto.randomUUID(), type: 'timer', kind: 'countdown', name: 'Prueba',
  x: 0, y: 0, w: 640, h: 140, rot: 0, opacity: 1, visible: true, locked: false, ...defaultTextStyle,
  durationMs: 5000, elapsedMs: 0, running: true, startedAt: 1000 };

describe('tiempo compartido', () => {
  it.each([[1000, '00:05'], [1001, '00:05'], [5999, '00:01'], [6000, '00:00'], [90000, '00:00']])('cuenta regresiva en %s ms', (now, text) => {
    expect(timerText(timer, now as number)).toBe(text);
  });
  it('pausar conserva fracciones de segundo y reanudar no las pierde', () => {
    const paused = controlTimer(timer, 'pause', 2500);
    expect(timerElapsed(paused, 90000)).toBe(1500);
    const resumed = controlTimer(paused, 'start', 100000);
    expect(timerText(resumed, 103499)).toBe('00:01');
    expect(timerFinished(resumed, 103500)).toBe(true);
  });
  it('iniciar repetidamente no reinicia un contador en marcha', () => {
    const startedAgain = controlTimer(timer, 'start', 3000);
    expect(timerElapsed(startedAgain, 4000)).toBe(timerElapsed(timer, 4000));
  });
  it('reiniciar deja el temporizador pausado en su valor inicial', () => {
    expect(controlTimer(timer, 'reset', 4000)).toMatchObject({ running: false, elapsedMs: 0, startedAt: null });
    expect(timerText(controlTimer(timer, 'reset', 4000), 90000)).toBe('00:05');
  });
  it('iniciar una cuenta finalizada comienza una nueva cuenta completa', () => {
    expect(timerText(controlTimer(timer, 'start', 90000), 90000)).toBe('00:05');
  });
  it('un reloj anterior al inicio no agrega tiempo ni produce valores negativos', () => {
    expect(timerText(timer, 0)).toBe('00:05');
    expect(timerElapsed({ ...timer, kind: 'stopwatch' }, 0)).toBe(0);
  });
  it.each([[999, '00:00'], [1000, '00:01'], [3599999, '59:59'], [3600000, '01:00:00'], [90000000, '25:00:00']])('cronómetro con %s ms transcurridos', (elapsed, text) => {
    expect(timerText({ ...timer, kind: 'stopwatch' }, 1000 + Number(elapsed))).toBe(text);
  });
  it('mantiene el formato de horas de una cuenta larga hasta finalizar', () => {
    expect(timerText({ ...timer, durationMs: 3600000 }, 3600001)).toBe('00:00:01');
    expect(timerText({ ...timer, durationMs: 3600000 }, 3601000)).toBe('00:00:00');
  });
});
describe('validación de temporizadores', () => {
  it.each([0, -1000, 1500, 86401000, Infinity, '5000'])('rechaza duración inválida %s', durationMs => {
    expect(clientMessage.safeParse({ t: 'timer.set', id: timer.id, durationMs }).success).toBe(false);
  });
  it.each([1000, 86400000])('acepta duración límite %s', durationMs => {
    expect(clientMessage.safeParse({ t: 'timer.set', id: timer.id, durationMs }).success).toBe(true);
  });
  it.each([{ elapsedMs: 999 }, { running: true }, { startedAt: 0 }, { durationMs: 1000 }, { kind: 'stopwatch' }])('impide alterar el reloj mediante parches', patch => {
    expect(clientMessage.safeParse({ t: 'item.patch', id: timer.id, patch }).success).toBe(false);
  });
  it('no acepta relojes ni clases de temporizador enviados por el cliente', () => {
    expect(clientMessage.safeParse({ t: 'timer.add', kind: 'alarm', x: 0, y: 0 }).success).toBe(false);
    expect(clientMessage.safeParse({ t: 'timer.control', id: timer.id, action: 'start', startedAt: 0 }).success).toBe(false);
  });
});
