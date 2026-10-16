import { useState, type FormEvent } from 'react';
import { ArrowRight, Image, Layers, Monitor, Radio, ShieldCheck, Sparkles } from 'lucide-react';
import { Brand } from './components';

export function Home() {
  const [name, setName] = useState('');
  const [secret, setSecret] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function create(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const response = await fetch('/api/rooms', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` }, body: JSON.stringify({ name }) });
      const data = await response.json() as { roomId: string; editorKey: string; error?: string };
      if (!response.ok) throw new Error(data.error || 'No se pudo crear el estudio.');
      setSecret(''); location.assign(`/panel/${data.roomId}#key=${data.editorKey}`);
    } catch (error) { setError(error instanceof Error ? error.message : 'No se pudo conectar.'); setBusy(false); }
  }
  return <div className="home-page">
    <header className="home-header"><Brand /><span className="version-tag">ESTUDIO DE OVERLAYS</span></header>
    <main className="home-main">
      <section className="home-intro"><div className="eyebrow"><span className="status-dot" />TU DIRECTO, EN TUS MANOS</div>
        <h1>Un lienzo.<br /><span>Infinitas posibilidades.</span></h1>
        <p>Prepara tus gráficos y dales vida durante el directo. Tú editas desde el panel; tu audiencia ve el resultado en OBS.</p>
        <div className="home-demo" aria-hidden="true"><div className="demo-grid" /><div className="demo-frame"><span className="demo-label">1920 × 1080</span>
          <div className="demo-card"><Sparkles size={28} /><strong>Tu próximo gran momento.</strong><span>Diseña lo que viene después.</span><i /><i /><i /><i /></div>
          <div className="demo-cursor"><svg viewBox="0 0 24 24"><path d="M4 2 20 14 12 15 9 22Z" /></svg><span>Editor</span></div>
        </div><div className="demo-chip"><Radio size={13} />Cambios en tiempo real</div></div>
        <div className="home-features"><span><Image size={17} />Imágenes, GIF y vídeo</span><span><Layers size={17} />Texto y capas</span><span><Monitor size={17} />Listo para OBS</span></div>
      </section>
      <section className="create-card"><span className="card-icon"><Layers size={24} /></span><h2>Crea tu estudio</h2><p>Un espacio propio para los gráficos de tu canal.</p>
        <form onSubmit={create}>
          <label>Nombre del canal<input autoComplete="organization" value={name} onChange={e => setName(e.target.value)} maxLength={60} placeholder="Por ejemplo, el canal de María" required /></label>
          <label>Clave de administración<input type="password" autoComplete="off" value={secret} onChange={e => setSecret(e.target.value)} placeholder="Introduce tu clave de creación" required /></label>
          <p className="field-help"><ShieldCheck size={14} />La clave permite crear salas. Los enlaces de edición y visualización serán independientes.</p>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="primary-button create-submit" disabled={busy}>{busy ? 'Preparando tu estudio…' : 'Crear estudio'}<ArrowRight size={17} /></button>
        </form>
        <div className="create-note"><Monitor size={16} /><span>La cámara y la transmisión se mantienen en tu OBS.</span></div>
      </section>
    </main>
    <footer className="home-footer"><span>Hecho para quienes están detrás del directo.</span><span>Overlay Studio · Multimedia</span></footer>
  </div>;
}
