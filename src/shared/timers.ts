import type { TimerAction, TimerItem } from './model';

export const MAX_TIMER_DURATION = 24 * 60 * 60 * 1000;

export function timerElapsed(item: TimerItem, now: number): number {
  const elapsed = item.elapsedMs + (item.running && item.startedAt !== null ? Math.max(0, now - item.startedAt) : 0);
  return item.kind === 'countdown' ? Math.min(item.durationMs, elapsed) : elapsed;
}
export function timerFinished(item: TimerItem, now: number): boolean {
  return item.kind === 'countdown' && timerElapsed(item, now) >= item.durationMs;
}
export function timerText(item: TimerItem, now: number): string {
  const elapsed = timerElapsed(item, now);
  const seconds = item.kind === 'countdown' ? Math.ceil((item.durationMs - elapsed) / 1000) : Math.floor(elapsed / 1000);
  const hours = Math.floor(seconds / 3600), minutes = Math.floor(seconds % 3600 / 60), remainder = seconds % 60;
  const pad = (value: number) => String(value).padStart(2, '0');
  const showHours = hours > 0 || (item.kind === 'countdown' && item.durationMs >= 3600000);
  return `${showHours ? `${pad(hours)}:` : ''}${pad(minutes)}:${pad(remainder)}`;
}
export function controlTimer(item: TimerItem, action: TimerAction, now: number): TimerItem {
  if (action === 'reset') return { ...item, elapsedMs: 0, running: false, startedAt: null };
  const elapsed = timerElapsed(item, now);
  if (action === 'pause') return { ...item, elapsedMs: elapsed, running: false, startedAt: null };
  // Repeated starts preserve elapsed time. Starting a finished countdown begins
  // a new run; timestamps always come from the server, never from a client.
  return { ...item, elapsedMs: timerFinished(item, now) ? 0 : elapsed, running: true, startedAt: now };
}
