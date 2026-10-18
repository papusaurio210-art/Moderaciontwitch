import { useState, type FormEvent } from 'react';
import { ArrowRight, Layers, Monitor, ShieldCheck } from 'lucide-react';
import { Brand } from './components';
import { Channels } from './Channels';
import { channelPath } from './channel-storage';
import { saveChannelAction } from './useChannels';

export function Home() {
  const [name, setName] = useState('');
  const [secret, setSecret] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [createdLink, setCreatedLink] = useState('');
  async function create(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const response = await fetch('/api/rooms', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` }, body: JSON.stringify({ name }) });
      const data = await response.json() as { roomId: string; editorKey: string; error?: string };
      if (!response.ok) throw new Error(data.error || 'No se pudo crear el estudio.');
      setSecret('');
      const path = channelPath(data);
      try { saveChannelAction({ type: 'add', roomId: data.roomId, editorKey: data.editorKey, name }); }
      catch (error) { setCreatedLink(path); setError(`El estudio se creó, pero no se pudo guardar en Mis canales. ${error instanceof Error ? error.message : ''}`); setBusy(false); return; }
      location.assign(path);
    } catch (error) { setError(error instanceof Error ? error.message : 'No se pudo conectar.'); setBusy(false); }
  }
  return <div className="home-page">
    <header className="home-header"><Brand /><span className="version-tag">ESTUDIO DE OVERLAYS</span></header>
    <main className="home-main">
      <Channels />
      <section className="create-card" id="crear-estudio"><span className="card-icon"><Layers size={24} /></span><h2>Crea tu estudio</h2><p>Un espacio independiente para cada canal. Su acceso se guardará en este navegador, en Mis canales.</p>
        <form onSubmit={create}>
          <fieldset disabled={busy || !!createdLink}>
            <label>Nombre del canal<input autoComplete="organization" value={name} onChange={e => setName(e.target.value)} maxLength={60} placeholder="Por ejemplo, el canal de María" required /></label>
          <label>Clave de administración<input type="password" autoComplete="off" value={secret} onChange={e => setSecret(e.target.value)} placeholder="Introduce tu clave de creación" required /></label>
          <p className="field-help"><ShieldCheck size={14} />La clave permite crear salas. Los enlaces de edición y visualización serán independientes.</p>
          <button className="primary-button create-submit" disabled={busy}>{busy ? 'Preparando tu estudio…' : 'Crear estudio'}<ArrowRight size={17} /></button>
          </fieldset>
          {error && <p className="form-error" role="alert">{error}</p>}
          {createdLink && <a className="primary-button" href={createdLink}>Abrir estudio creado</a>}
        </form>
        <div className="create-note"><Monitor size={16} /><span>La cámara y la transmisión se mantienen en tu OBS.</span></div>
      </section>
    </main>
    <footer className="home-footer"><span>Hecho para quienes están detrás del directo.</span><span>Overlay Studio · Multimedia</span></footer>
  </div>;
}
