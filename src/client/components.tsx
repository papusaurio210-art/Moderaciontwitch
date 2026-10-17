import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { ArrowRight, Circle, Film, Hourglass, Image as ImageIcon, Minus, Radio, Square, Timer, Triangle, Type } from 'lucide-react';
import { mediaUrl, videoPosition, type BaseItem, type Item, type MediaFile, type VideoItem } from '../shared/model';
import { ShapeContent } from './ShapeContent';
import { TextContent } from './TextContent';
import { TimerContent } from './TimerContent';

export function ItemIcon({ item, size = 14 }: { item: Item; size?: number }) {
  const Icon = item.type === 'shape' ? { rect: Square, ellipse: Circle, line: Minus, arrow: ArrowRight }[item.shape]
    : item.type === 'timer' ? item.kind === 'countdown' ? Hourglass : Timer
    : item.type === 'text' ? Type : item.type === 'video' ? Film : ImageIcon;
  return <Icon size={size} />;
}

export function Brand({ compact = false }: { compact?: boolean }) {
  return <a className="brand" href="/" aria-label="Overlay Studio, inicio"><span className="brand-mark"><Triangle size={17} fill="currentColor" /></span>
    {!compact && <span>overlay<span className="brand-light">studio</span></span>}</a>;
}
export function ConnectionBadge({ status }: { status: string }) {
  const names: Record<string, string> = { connected: 'Conectado', connecting: 'Conectando', offline: 'Reconectando', denied: 'Sin acceso' };
  return <span className={`connection ${status}`} role="status"><span className="status-dot" />{names[status]}</span>;
}
function VideoContent({ src, item, editor, active, serverOffset }: { src: string; item: VideoItem; editor: boolean; active: boolean; serverOffset: number }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState('');
  // Old rooms have no volume field. Apply audio gain separately so adjusting
  // it never tears down playback or restarts the shared timeline.
  useEffect(() => { if (ref.current) ref.current.volume = item.volume ?? 1; }, [item.volume, src]);
  useEffect(() => {
    const video = ref.current!; let disposed = false, blocked = false;
    setError('');
    const sync = () => {
      if (!active) { video.pause(); return; }
      if (video.readyState < 1) return;
      const position = videoPosition(item, Date.now() + serverOffset, video.duration);
      if (!video.seeking && Math.abs(video.currentTime - position) > (item.playing ? .45 : .02)) video.currentTime = position;
      if (active && item.playing && (!video.ended || item.loop) && !blocked) {
        if (video.paused) void video.play().catch(error => {
          if (!disposed && error.name !== 'AbortError') { blocked = true; setError('No se pudo reproducir. Usa MP4 H.264 o WebM VP8/VP9.'); }
        });
      } else video.pause();
    };
    video.muted = editor || item.muted;
    video.addEventListener('loadedmetadata', sync); sync();
    const timer = setInterval(sync, 250);
    return () => { disposed = true; clearInterval(timer); video.removeEventListener('loadedmetadata', sync); video.pause(); };
  }, [item.playing, item.position, item.startedAt, item.loop, item.muted, active, editor, serverOffset, src]);
  return <><video ref={ref} src={src} className="item-video" aria-label={item.name} muted={editor || item.muted} loop={item.loop}
    playsInline preload="auto" style={{ objectFit: item.fit }} onError={() => setError('Formato de vídeo no compatible. Usa MP4 H.264 o WebM VP8/VP9.')} />
    {error && editor && <span className="media-error" role="alert">{error}</span>}</>;
}
export function ItemContent({ roomId, item, media, editor = false, active = true, serverOffset = 0 }: {
  roomId: string; item: Item; media?: MediaFile; editor?: boolean; active?: boolean; serverOffset?: number;
}) {
  if (item.type === 'shape') return <ShapeContent item={item} />;
  if (item.type === 'text') return <TextContent item={item}>{item.text}</TextContent>;
  if (item.type === 'timer') return <TimerContent item={item} serverOffset={serverOffset} />;
  if (item.type === 'video' && media) return <VideoContent src={mediaUrl(roomId, media.id)} item={item} editor={editor} active={active} serverOffset={serverOffset} />;
  return media ? <img src={mediaUrl(roomId, media.id)} alt={item.name} draggable={false} className="item-image" style={{ objectFit: item.fit ?? 'contain' }} />
    : <div className="missing-image"><ImageIcon size={24} /><span>Archivo no disponible</span></div>;
}
export function itemStyle(item: BaseItem): CSSProperties {
  return { position: 'absolute', left: item.x, top: item.y, width: item.w, height: item.h,
    transform: `rotate(${item.rot}deg)`, transformOrigin: 'center', opacity: item.opacity };
}

export function MediaThumbnail({ roomId, media }: { roomId: string; media: MediaFile }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (media.mime !== 'image/gif') return;
    const img = new Image(); let disposed = false;
    img.onload = () => {
      if (!disposed && canvas.current) {
        const context = canvas.current.getContext('2d');
        context?.drawImage(img, 0, 0, canvas.current.width, canvas.current.height);
      }
      img.onload = null; img.src = '';
    };
    img.src = mediaUrl(roomId, media.id);
    return () => { disposed = true; img.onload = null; img.src = ''; };
  }, [roomId, media.id, media.mime]);
  if (media.mime.startsWith('video/')) return <video src={mediaUrl(roomId, media.id)} muted playsInline preload="metadata" aria-label={media.name} />;
  if (media.mime === 'image/gif') {
    const scale = Math.min(160 / media.width, 100 / media.height, 1);
    return <canvas ref={canvas} width={Math.max(1, Math.round(media.width * scale))} height={Math.max(1, Math.round(media.height * scale))} aria-label={media.name} />;
  }
  return <img src={mediaUrl(roomId, media.id)} alt="" draggable={false} />;
}
export function ViewerCount({ count }: { count: number }) {
  return <span className="viewer-count" title="Páginas del overlay conectadas. No indica si OBS está transmitiendo."><Radio size={13} />{count} {count === 1 ? 'visor' : 'visores'}</span>;
}
