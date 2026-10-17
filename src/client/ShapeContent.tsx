import type { ShapeItem } from '../shared/model';

export function ShapeContent({ item }: { item: ShapeItem }) {
  // All geometry stays inside the item bounds, including thick strokes on
  // small shapes, so stage clipping and selection agree with the visible art.
  const { w, h } = item;
  const stroke = Math.min(item.borderWidth, w / 2, h / 2);
  const inset = stroke / 2;
  const headHalf = Math.min(h / 2, Math.max(stroke * 2, 16));
  const headBase = w - Math.min(w / 2, headHalf * 1.5);
  const center = h / 2;
  return <svg className="item-shape" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={item.name}>
    {item.shape === 'rect' && <rect x={inset} y={inset} width={w - stroke} height={h - stroke}
      fill={item.fill ?? 'none'} stroke={item.borderColor} strokeWidth={stroke} />}
    {item.shape === 'ellipse' && <ellipse cx={w / 2} cy={center} rx={(w - stroke) / 2} ry={(h - stroke) / 2}
      fill={item.fill ?? 'none'} stroke={item.borderColor} strokeWidth={stroke} />}
    {item.shape === 'line' && stroke > 0 && <line x1={inset} y1={center} x2={w - inset} y2={center}
      stroke={item.borderColor} strokeWidth={stroke} strokeLinecap="round" />}
    {item.shape === 'arrow' && stroke > 0 && <polygon fill={item.borderColor}
      points={`0,${center - inset} ${headBase},${center - inset} ${headBase},${center - headHalf} ${w},${center} ${headBase},${center + headHalf} ${headBase},${center + inset} 0,${center + inset}`} />}
  </svg>;
}
