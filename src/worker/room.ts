import { DurableObject } from 'cloudflare:workers';
import type { Env } from './index';
import type { Item, MediaFile, Operation, Role, RoomState, ServerMessage, VideoItem } from '../shared/model';
import { applyOperation, defaultTextStyle, shapeDefaults, videoPosition } from '../shared/model';
import { controlTimer } from '../shared/timers';
import { sha256 } from '../shared/keys';
import { bearer, HttpError, json, smallJson } from './http';
import { clientMessage, mediaMime, MAX_IMAGE_BYTES, MAX_VIDEO_BYTES, MAX_ROOM_BYTES } from './validation';

interface Attachment { role: Role | null; deadline: number; windowStart: number; messages: number }

export class Room extends DurableObject<Env> {
  private state: RoomState | null = null;
  private editorHash = '';
  private viewerHash = '';

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS room (id INTEGER PRIMARY KEY CHECK(id=1), state TEXT NOT NULL, editor_hash TEXT NOT NULL, viewer_hash TEXT NOT NULL)');
    ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS uploads (id TEXT PRIMARY KEY, bytes INTEGER NOT NULL, created_at INTEGER NOT NULL)');
    const row = ctx.storage.sql.exec<{ state: string; editor_hash: string; viewer_hash: string }>('SELECT state, editor_hash, viewer_hash FROM room WHERE id=1').toArray()[0];
    if (row) { this.state = JSON.parse(row.state); this.editorHash = row.editor_hash; this.viewerHash = row.viewer_hash; }
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  async fetch(request: Request): Promise<Response> {
    try {
      const path = new URL(request.url).pathname;
      if (path === '/init' && request.method === 'POST') {
        if (this.state) throw new HttpError(409, 'La sala ya existe.');
        const { roomId, name, editorHash, viewerHash } = await smallJson(request);
        this.state = { roomId, name, rev: 0, stage: { x: 0, y: 0, w: 1920, h: 1080 }, items: [], media: [] };
        this.editorHash = editorHash; this.viewerHash = viewerHash;
        this.ctx.storage.sql.exec('INSERT INTO room VALUES (1, ?, ?, ?)', JSON.stringify(this.state), editorHash, viewerHash);
        return json({ ok: true });
      }
      if (!this.state) throw new HttpError(404, 'La sala no existe.');
      if (path === '/ws') {
        const pair = new WebSocketPair();
        const [client, server] = Object.values(pair);
        if (this.ctx.getWebSockets().length >= 50) throw new HttpError(429, 'La sala tiene demasiadas conexiones.');
        this.ctx.acceptWebSocket(server);
        const deadline = Date.now() + 5000;
        server.serializeAttachment({ role: null, deadline, windowStart: Date.now(), messages: 0 } satisfies Attachment);
        const scheduled = await this.ctx.storage.getAlarm();
        if (scheduled === null || scheduled > deadline) await this.ctx.storage.setAlarm(deadline);
        return new Response(null, { status: 101, webSocket: client });
      }
      if (path === '/media' && request.method === 'POST') return await this.upload(request);
      throw new HttpError(404, 'Ruta no encontrada.');
    } catch (error) {
      // Finish consuming a forwarded upload before replying, including an
      // authorization rejection, so the Worker/DO transport can close cleanly.
      if (request.body && !request.body.locked && !request.bodyUsed) {
        await request.body.pipeTo(new WritableStream()).catch(() => {});
      }
      if (error instanceof HttpError) return json({ error: error.message }, error.status);
      return json({ error: 'No se pudo completar la operación.' }, 500);
    }
  }

  private send(ws: WebSocket, message: ServerMessage) { try { ws.send(JSON.stringify(message)); } catch { /* Disconnected peer. */ } }
  private broadcast(message: ServerMessage, except?: WebSocket) {
    for (const ws of this.ctx.getWebSockets()) if (ws !== except && (ws.deserializeAttachment() as Attachment)?.role) this.send(ws, message);
  }
  private presence() {
    const roles = this.ctx.getWebSockets().filter(ws => ws.readyState === WebSocket.OPEN).map(ws => (ws.deserializeAttachment() as Attachment)?.role);
    this.broadcast({ t: 'presence', editors: roles.filter(r => r === 'editor').length, viewers: roles.filter(r => r === 'viewer').length });
  }
  private commit(op: Operation, requestId?: string) {
    const next = applyOperation(this.state!, op, this.state!.rev + 1);
    // All acknowledged changes are durable before the broadcast. Previews are
    // explicitly transient and do not advance the authoritative revision.
    this.ctx.storage.sql.exec('UPDATE room SET state=? WHERE id=1', JSON.stringify(next));
    this.state = next;
    this.broadcast({ t: 'op', rev: next.rev, op, requestId });
  }
  private snapshot(ws: WebSocket, role: Role, t: 'welcome' | 'state') {
    this.send(ws, { t, state: this.state!, role, serverNow: Date.now() });
  }
  async alarm() {
    for (const ws of this.ctx.getWebSockets()) {
      const a = ws.deserializeAttachment() as Attachment;
      if (!a.role && a.deadline <= Date.now()) {
        this.send(ws, { t: 'error', code: '401', message: 'Autenticación requerida.' });
        ws.close(4001, 'Autenticación requerida');
      }
    }
    const pending = this.ctx.getWebSockets().filter(ws => ws.readyState === WebSocket.OPEN)
      .map(ws => ws.deserializeAttachment() as Attachment).filter(a => !a.role && a.deadline > Date.now());
    if (pending.length) await this.ctx.storage.setAlarm(Math.min(...pending.map(a => a.deadline)));
  }

  async webSocketMessage(ws: WebSocket, data: string | ArrayBuffer) {
    let requestId: string | undefined;
    try {
      if (typeof data !== 'string' || new TextEncoder().encode(data).byteLength > 65536) { ws.close(1009, 'Mensaje demasiado grande'); return; }
      const a = ws.deserializeAttachment() as Attachment;
      if (Date.now() - a.windowStart >= 1000) { a.windowStart = Date.now(); a.messages = 0; }
      if (++a.messages > 200) { ws.close(1008, 'Demasiados mensajes'); return; }
      ws.serializeAttachment(a);
      let parsed: unknown;
      try { parsed = JSON.parse(data); } catch { throw new HttpError(400, 'JSON no válido.'); }
      if (parsed && typeof parsed === 'object' && 'requestId' in parsed && typeof parsed.requestId === 'string') requestId = parsed.requestId.slice(0, 80);
      const result = clientMessage.safeParse(parsed);
      if (!result.success) throw new HttpError(400, 'El cambio contiene campos o valores no válidos.');
      const msg = result.data;
      if (!a.role) {
        if (msg.t !== 'hello' || Date.now() > a.deadline) { ws.close(4001, 'Autenticación requerida'); return; }
        const hash = await sha256(msg.key);
        const role = hash === this.editorHash ? 'editor' : hash === this.viewerHash ? 'viewer' : null;
        if (!role) { ws.close(4001, 'Enlace no válido'); return; }
        a.role = role; ws.serializeAttachment(a);
        this.snapshot(ws, role, 'welcome'); this.presence();
        return;
      }
      if (msg.t === 'hello') throw new HttpError(400, 'La conexión ya está autenticada.');
      if (msg.t === 'sync') { this.snapshot(ws, a.role, 'state'); return; }
      if (a.role !== 'editor') throw new HttpError(403, 'Este enlace solo permite visualizar.');
      const state = this.state!;
      if (msg.t === 'text.add') {
        if (state.items.length >= 500) throw new HttpError(409, 'Límite de 500 elementos alcanzado.');
        this.commit({ t: 'item.upsert', item: { id: crypto.randomUUID(), type: 'text', name: 'Texto',
          text: 'Tu texto aquí', x: msg.x, y: msg.y, w: 720, h: 180, rot: 0,
          opacity: 1, visible: true, locked: false, ...defaultTextStyle } }, msg.requestId);
      } else if (msg.t === 'shape.add') {
        if (state.items.length >= 500) throw new HttpError(409, 'Límite de 500 elementos alcanzado.');
        this.commit({ t: 'item.upsert', item: { id: crypto.randomUUID(), type: 'shape', shape: msg.shape,
          x: msg.x, y: msg.y, rot: 0, opacity: 1, visible: true, locked: false, ...shapeDefaults[msg.shape] } }, msg.requestId);
      } else if (msg.t === 'timer.add') {
        if (state.items.length >= 500) throw new HttpError(409, 'Límite de 500 elementos alcanzado.');
        this.commit({ t: 'item.upsert', item: { id: crypto.randomUUID(), type: 'timer', kind: msg.kind,
          name: msg.kind === 'countdown' ? 'Cuenta regresiva' : 'Cronómetro', x: msg.x, y: msg.y, w: 640, h: 140, rot: 0,
          opacity: 1, visible: true, locked: false, ...defaultTextStyle, fontFamily: 'JetBrains Mono', fontSize: 96, align: 'center',
          durationMs: msg.kind === 'countdown' ? 300000 : 0, elapsedMs: 0, running: false, startedAt: null } }, msg.requestId);
      } else if (msg.t === 'timer.control' || msg.t === 'timer.set') {
        const item = state.items.find(i => i.id === msg.id);
        if (!item || item.type !== 'timer') throw new HttpError(400, 'Selecciona un temporizador.');
        if (msg.t === 'timer.set' && item.kind !== 'countdown') throw new HttpError(400, 'La duración solo se configura en una cuenta regresiva.');
        this.commit({ t: 'item.upsert', item: msg.t === 'timer.control' ? controlTimer(item, msg.action, Date.now())
          : { ...item, durationMs: msg.durationMs, elapsedMs: 0, running: false, startedAt: null } }, msg.requestId);
      } else if (msg.t === 'item.add') {
        if (state.items.length >= 500) throw new HttpError(409, 'Límite de 500 elementos alcanzado.');
        const media = state.media.find(m => m.id === msg.mediaId);
        if (!media) throw new HttpError(404, 'El archivo no está disponible.');
        const scale = Math.min(1, state.stage.w / 2 / media.width);
        const base = { id: crypto.randomUUID(), mediaId: media.id, name: media.name,
          x: msg.x, y: msg.y, w: media.width * scale, h: media.height * scale, rot: 0,
          opacity: 1, visible: true, locked: false, fit: 'contain' as const };
        const item: Item = media.mime.startsWith('video/')
          ? { ...base, type: 'video', loop: true, muted: true, volume: 1, playing: true, position: 0, startedAt: Date.now() }
          : { ...base, type: media.mime === 'image/gif' ? 'gif' : 'image' };
        this.commit({ t: 'item.upsert', item }, msg.requestId);
      } else if (msg.t === 'video.control') {
        const item = state.items.find(i => i.id === msg.id);
        if (!item || item.type !== 'video') throw new HttpError(400, 'Selecciona un vídeo para controlar su reproducción.');
        const now = Date.now(), duration = state.media.find(m => m.id === item.mediaId)?.duration ?? 0;
        const position = msg.action === 'restart' ? 0 : videoPosition(item, now, duration);
        const next: VideoItem = { ...item, position: msg.action === 'play' && duration > 0 && position >= duration ? 0 : position,
          playing: msg.action !== 'pause', startedAt: msg.action === 'pause' ? null : now };
        this.commit({ t: 'item.upsert', item: next }, msg.requestId);
      } else if (msg.t === 'item.reorder') {
        if (msg.ids.length !== state.items.length || new Set(msg.ids).size !== state.items.length
          || msg.ids.some(id => !state.items.some(i => i.id === id))) throw new HttpError(400, 'El orden de capas no es válido.');
        this.commit(msg, msg.requestId);
      } else {
        const item = state.items.find(i => i.id === msg.id);
        if (!item) throw new HttpError(404, 'El elemento ya no existe.');
        if (msg.t === 'item.remove') this.commit(msg, msg.requestId);
        else {
          if (item.locked && Object.keys(msg.patch).some(k => ['x', 'y', 'w', 'h', 'rot'].includes(k))) throw new HttpError(409, 'Desbloquea el elemento antes de moverlo.');
          if (msg.t === 'item.preview') this.broadcast({ t: 'preview', id: item.id, patch: msg.patch }, ws);
          else {
            const textFields = Object.keys(defaultTextStyle);
            if (Object.keys(msg.patch).some(k => (textFields.includes(k) && item.type !== 'text' && item.type !== 'timer')
              || (k === 'text' && item.type !== 'text')
              || (['loop', 'muted', 'volume'].includes(k) && item.type !== 'video')
              || (['fill', 'borderColor', 'borderWidth'].includes(k) && item.type !== 'shape')
              || (k === 'fill' && item.type === 'shape' && ['line', 'arrow'].includes(item.shape))
              || (k === 'fit' && !('mediaId' in item)))) {
              throw new HttpError(400, 'Estas propiedades no corresponden al tipo de elemento.');
            }
            let next = { ...item, ...msg.patch } as Item;
            if (item.type === 'video' && next.type === 'video' && msg.patch.loop !== undefined) {
              const now = Date.now(), duration = state.media.find(m => m.id === item.mediaId)?.duration ?? 0;
              next = { ...next, position: videoPosition(item, now, duration), startedAt: item.playing ? now : null };
            }
            this.commit({ t: 'item.upsert', item: next }, msg.requestId);
          }
        }
      }
    } catch (error) {
      this.send(ws, { t: 'error', code: error instanceof HttpError ? String(error.status) : '500',
        message: error instanceof HttpError ? error.message : 'No se pudo guardar el cambio.', requestId });
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string) {
    if (ws.readyState !== WebSocket.CLOSED) ws.close(code === 1005 || code === 1006 ? 1000 : code, reason);
    this.presence();
  }
  async webSocketError(ws: WebSocket) { ws.close(1011, 'Conexión interrumpida'); this.presence(); }

  private async upload(request: Request): Promise<Response> {
    const token = bearer(request);
    if (!token || await sha256(token) !== this.editorHash) throw new HttpError(403, 'Se requiere acceso de editor.');
    const size = Number(request.headers.get('Content-Length'));
    if (!Number.isInteger(size) || size < 1) throw new HttpError(411, 'El archivo debe indicar su tamaño.');
    const declaredVideo = ['video/mp4', 'video/webm'].includes(request.headers.get('Content-Type') ?? '');
    if (size > (declaredVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES)) {
      // Drain without buffering so an in-flight HTTP upload receives the 413
      // response reliably through the local Worker/DO transport.
      await request.body?.pipeTo(new WritableStream());
      throw new HttpError(413, declaredVideo ? 'El vídeo supera el límite de 50 MB.' : 'La imagen o GIF supera el límite de 25 MB.');
    }
    const width = Number(request.headers.get('X-Image-Width')), height = Number(request.headers.get('X-Image-Height'));
    if (![width, height].every(n => Number.isInteger(n) && n > 0 && n <= 16384)) throw new HttpError(400, 'Dimensiones no válidas (máximo 16384 px).');
    let name: string;
    try { name = decodeURIComponent(request.headers.get('X-File-Name') ?? 'Imagen').trim().slice(0, 120); }
    catch { throw new HttpError(400, 'Nombre de archivo no válido.'); }
    if (!request.body) throw new HttpError(400, 'Falta el archivo.');
    const reader = request.body.getReader();
    const rejectUpload = async (status: number, message: string): Promise<never> => {
      while (!(await reader.read()).done) { /* Complete the forwarded body without buffering. */ }
      throw new HttpError(status, message);
    };
    const chunks: Uint8Array[] = []; let prefixLength = 0;
    while (prefixLength < 4096) { const next = await reader.read(); if (next.done) break; chunks.push(next.value); prefixLength += next.value.length; }
    const prefix = new Uint8Array(prefixLength); let offset = 0;
    for (const chunk of chunks) { prefix.set(chunk, offset); offset += chunk.length; }
    const mime = mediaMime(prefix);
    if (!mime) return await rejectUpload(415, 'Usa un archivo PNG, JPG, WebP, GIF, MP4 o WebM válido.');
    const isVideo = mime.startsWith('video/');
    if (!isVideo && size > MAX_IMAGE_BYTES) {
      return await rejectUpload(413, 'La imagen o GIF supera el límite de 25 MB.');
    }
    const duration = isVideo ? Number(request.headers.get('X-Media-Duration')) : undefined;
    if (isVideo && (!Number.isFinite(duration) || duration! <= 0 || duration! > 86400)) {
      return await rejectUpload(400, 'El vídeo debe tener una duración válida de hasta 24 horas.');
    }
    this.ctx.storage.sql.exec('DELETE FROM uploads WHERE created_at < ?', Date.now() - 600_000);
    const pending = this.ctx.storage.sql.exec<{ count: number; bytes: number }>('SELECT COUNT(*) AS count, COALESCE(SUM(bytes),0) AS bytes FROM uploads').one();
    if (this.state!.media.length + pending.count >= 500 || this.state!.media.reduce((n, m) => n + m.size, 0) + pending.bytes + size > MAX_ROOM_BYTES) {
      return await rejectUpload(409, 'La biblioteca alcanzó su límite de archivos o espacio.');
    }
    const id = crypto.randomUUID(), r2Key = `rooms/${this.state!.roomId}/${id}`;
    this.ctx.storage.sql.exec('INSERT INTO uploads VALUES (?, ?, ?)', id, size, Date.now());
    try {
      const stream = new FixedLengthStream(size);
      const writer = stream.writable.getWriter();
      const pump = (async () => {
        try {
          await writer.write(prefix);
          while (true) { const next = await reader.read(); if (next.done) break; await writer.write(next.value); }
          await writer.close();
        } catch (error) { await writer.abort(error).catch(() => {}); throw error; }
        finally { await reader.cancel().catch(() => {}); }
      })();
      await Promise.all([this.env.MEDIA.put(r2Key, stream.readable, { httpMetadata: { contentType: mime } }), pump]);
      const media: MediaFile = { id, name: name || 'Archivo', mime, size, width, height, createdAt: Date.now(), ...(isVideo ? { duration } : {}) };
      this.commit({ t: 'media.add', media });
      return json(media, 201);
    } catch {
      await this.env.MEDIA.delete(r2Key);
      throw new HttpError(400, 'No se pudo guardar el archivo. Compruébalo e inténtalo de nuevo.');
    } finally { this.ctx.storage.sql.exec('DELETE FROM uploads WHERE id=?', id); }
  }
}
