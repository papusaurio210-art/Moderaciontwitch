import type { CSSProperties } from 'react';
import { Image as ImageIcon, Radio, Triangle } from 'lucide-react';
import { mediaUrl, type ImageItem, type MediaFile } from '../shared/model';

export function Brand({ compact = false }: { compact?: boolean }) {
  return <a className="brand" href="/" aria-label="Overlay Studio, inicio"><span className="brand-mark"><Triangle size={17} fill="currentColor" /></span>
    {!compact && <span>overlay<span className="brand-light">studio</span></span>}</a>;
}
export function ConnectionBadge({ status }: { status: string }) {
  const names: Record<string, string> = { connected: 'Conectado', connecting: 'Conectando', offline: 'Reconectando', denied: 'Sin acceso' };
  return <span className={`connection ${status}`} role="status"><span className="status-dot" />{names[status]}</span>;
}
export function ImageContent({ roomId, item, media }: { roomId: string; item: ImageItem; media?: MediaFile }) {
  return media ? <img src={mediaUrl(roomId, media.id)} alt={item.name} draggable={false} className="item-image" />
    : <div className="missing-image"><ImageIcon size={24} /><span>Archivo no disponible</span></div>;
}
export function itemStyle(item: ImageItem): CSSProperties {
  return { position: 'absolute', left: item.x, top: item.y, width: item.w, height: item.h,
    transform: `rotate(${item.rot}deg)`, transformOrigin: 'center', opacity: item.opacity };
}
export function ViewerCount({ count }: { count: number }) {
  return <span className="viewer-count" title="Páginas del overlay conectadas. No indica si OBS está transmitiendo."><Radio size={13} />{count} {count === 1 ? 'visor' : 'visores'}</span>;
}
