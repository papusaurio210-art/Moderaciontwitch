import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { LoaderCircle, LockKeyhole } from 'lucide-react';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
import '@fontsource/inter/latin-400-italic.css';
import '@fontsource/inter/latin-700-italic.css';
import '@fontsource/jetbrains-mono/latin-400.css';
import '@fontsource/jetbrains-mono/latin-700.css';
import '@fontsource/jetbrains-mono/latin-400-italic.css';
import '@fontsource/jetbrains-mono/latin-700-italic.css';
import './styles.css';
import './media.css';
import { Home } from './Home';
import { Panel } from './Panel';
import { Overlay } from './Overlay';
import { useRoom } from './useRoom';
import { Brand } from './components';

function StudioRoute({ roomId, overlay }: { roomId: string; overlay: boolean }) {
  const key = overlay ? new URLSearchParams(location.search).get('k') ?? '' : new URLSearchParams(location.hash.slice(1)).get('key') ?? '';
  const room = useRoom(roomId, key);
  if (overlay) return <Overlay room={room} />;
  if (!room.state || room.status === 'denied' || room.role === 'viewer') return <div className="loading-page"><Brand /><div>
    {room.status === 'denied' || room.role === 'viewer' ? <LockKeyhole size={28} /> : <LoaderCircle className="spin" size={28} />}
    <h1>{room.status === 'denied' || room.role === 'viewer' ? 'Este panel necesita acceso de editor' : 'Conectando con tu estudio'}</h1>
    <p>{room.error || (room.role === 'viewer' ? 'Utiliza el enlace privado del panel.' : 'Estamos recuperando tu escenario y tus archivos.')}</p><a className="secondary-button" href="/">Volver al inicio</a></div></div>;
  return <Panel room={room} editorKey={key} />;
}
const route = location.pathname.match(/^\/(panel|overlay)\/([a-f0-9]{32})\/?$/);
if (route?.[1] === 'overlay') document.documentElement.classList.add('overlay-page');
createRoot(document.getElementById('root')!).render(<StrictMode>{route ? <StudioRoute roomId={route[2]} overlay={route[1] === 'overlay'} /> : <Home />}</StrictMode>);
