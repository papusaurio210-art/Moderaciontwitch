import { useEffect, useState } from 'react';
import { intersectsStage, type RoomState } from '../shared/model';
import { ImageContent, itemStyle } from './components';
import type { RoomConnection } from './useRoom';

export function Overlay({ room }: { room: RoomConnection }) {
  const [size, setSize] = useState({ w: innerWidth, h: innerHeight });
  useEffect(() => {
    document.documentElement.classList.add('overlay-page');
    const resize = () => setSize({ w: innerWidth, h: innerHeight });
    window.addEventListener('resize', resize);
    return () => { document.documentElement.classList.remove('overlay-page'); window.removeEventListener('resize', resize); };
  }, []);
  const debug = new URLSearchParams(location.search).get('debug') === '1';
  const state = room.state;
  if (!state) return debug ? <div className="overlay-debug">{room.error || 'Conectando al estudio…'}</div> : null;
  const scale = Math.min(size.w / state.stage.w, size.h / state.stage.h);
  return <>
    <div className={`overlay-clip ${debug ? 'debug-border' : ''}`} data-testid="overlay-stage"
      style={{ width: state.stage.w * scale, height: state.stage.h * scale }}>
      <div style={{ position: 'relative', width: state.stage.w, height: state.stage.h, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
        {room.rendered.filter(item => item.visible && intersectsStage(item, state.stage) && state.media.some(m => m.id === item.mediaId)).map(item =>
          <div className="overlay-item" key={item.id} data-item-id={item.id} style={{ ...itemStyle(item), left: item.x - state.stage.x, top: item.y - state.stage.y }}>
            <ImageContent roomId={state.roomId} item={item} media={state.media.find(m => m.id === item.mediaId)} />
          </div>)}
      </div>
    </div>
    {debug && <div className="overlay-debug">{room.status} · rev {state.rev} · {state.stage.w} × {state.stage.h}{room.error && ` · ${room.error}`}</div>}
  </>;
}
