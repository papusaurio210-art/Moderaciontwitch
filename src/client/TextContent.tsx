import type { ReactNode } from 'react';
import type { TextStyle } from '../shared/model';

export function TextContent({ item, children, timer = false }: { item: TextStyle; children: ReactNode; timer?: boolean }) {
  return <div className={`item-text${timer ? ' item-timer' : ''}`} style={{ fontFamily: item.fontFamily, fontSize: item.fontSize,
    fontWeight: item.bold ? 700 : 400, fontStyle: item.italic ? 'italic' : 'normal', color: item.color,
    textAlign: item.align, WebkitTextStroke: `${item.strokeWidth}px ${item.strokeColor}`, paintOrder: 'stroke fill',
    textShadow: item.shadow ? '0 3px 7px #000a' : 'none', background: item.background ?? 'transparent', padding: item.strokeWidth,
  }}>{children}</div>;
}
