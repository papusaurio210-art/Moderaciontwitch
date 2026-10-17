import { useEffect, useState } from 'react';
import type { TimerItem } from '../shared/model';
import { timerFinished, timerText } from '../shared/timers';
import { TextContent } from './TextContent';

export function useTimerValue(item: TimerItem, serverOffset: number) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    setNow(Date.now());
    if (!item.running || timerFinished(item, Date.now() + serverOffset)) return;
    const interval = setInterval(() => {
      const current = Date.now(); setNow(current);
      if (timerFinished(item, current + serverOffset)) clearInterval(interval);
    }, 100);
    return () => clearInterval(interval);
  }, [item.kind, item.running, item.startedAt, item.elapsedMs, item.durationMs, serverOffset]);
  return { text: timerText(item, now + serverOffset), finished: timerFinished(item, now + serverOffset) };
}
export function TimerContent({ item, serverOffset }: { item: TimerItem; serverOffset: number }) {
  const { text } = useTimerValue(item, serverOffset);
  return <TextContent item={item} timer>{text}</TextContent>;
}
