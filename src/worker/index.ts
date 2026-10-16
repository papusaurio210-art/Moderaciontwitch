import { Room } from './room';
import { bearer, HttpError, json, smallJson } from './http';
import { randomHex, sha256, viewerKeyFromEditor } from '../shared/keys';
import { byteRange } from './range';

export { Room };
export interface Env {
  ROOM: DurableObjectNamespace<Room>;
  MEDIA: R2Bucket;
  ASSETS: Fetcher;
  ADMIN_SECRET?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    try {
      if (url.pathname === '/api/health') return json({ ok: true, service: 'overlay-studio' });
      if (url.pathname === '/api/rooms' && request.method === 'POST') {
        if (!env.ADMIN_SECRET) throw new HttpError(503, 'Falta configurar la clave de administración.');
        const key = bearer(request);
        if (!key || await sha256(key) !== await sha256(env.ADMIN_SECRET)) throw new HttpError(401, 'La clave de administración no es válida.');
        const body = await smallJson(request);
        if (typeof body?.name !== 'string' || !body.name.trim() || body.name.trim().length > 60) throw new HttpError(400, 'El nombre debe tener entre 1 y 60 caracteres.');
        const roomId = randomHex(16), editorKey = randomHex(32);
        const viewerKey = await viewerKeyFromEditor(editorKey);
        const stub = env.ROOM.get(env.ROOM.idFromName(roomId));
        const initialized = await stub.fetch(new Request('https://room.internal/init', {
          method: 'POST', body: JSON.stringify({ roomId, name: body.name.trim(),
            editorHash: await sha256(editorKey), viewerHash: await sha256(viewerKey) }),
        }));
        if (!initialized.ok) throw new HttpError(500, 'No se pudo crear la sala.');
        return json({ roomId, editorKey, viewerKey }, 201);
      }
      const ws = url.pathname.match(/^\/ws\/([a-f0-9]{32})$/);
      const upload = url.pathname.match(/^\/api\/rooms\/([a-f0-9]{32})\/media$/);
      if (ws || upload) {
        if (ws) {
          if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') throw new HttpError(426, 'Se requiere WebSocket.');
          if (request.headers.get('Origin') !== url.origin) throw new HttpError(403, 'Origen no permitido.');
        } else if (request.method !== 'POST') throw new HttpError(405, 'Método no permitido.');
        const roomId = (ws ?? upload)![1];
        const stub = env.ROOM.get(env.ROOM.idFromName(roomId));
        return await stub.fetch(new Request(`https://room.internal/${ws ? 'ws' : 'media'}`, request));
      }
      const media = url.pathname.match(/^\/media\/([a-f0-9]{32})\/([a-f0-9-]{36})$/);
      if (media && ['GET', 'HEAD'].includes(request.method)) {
        const key = `rooms/${media[1]}/${media[2]}`;
        const object = await env.MEDIA.head(key);
        if (!object) throw new HttpError(404, 'Archivo no encontrado.');
        const headers = new Headers({
          'Content-Type': object.httpMetadata?.contentType ?? 'application/octet-stream',
          'Cache-Control': 'public, max-age=31536000, immutable',
          'ETag': object.httpEtag, 'Content-Length': String(object.size),
          'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'",
          'Referrer-Policy': 'no-referrer',
          'Accept-Ranges': 'bytes',
        });
        if (request.headers.get('If-None-Match') === object.httpEtag) return new Response(null, { status: 304, headers });
        if (request.method === 'HEAD') return new Response(null, { headers });
        const rangeHeader = request.headers.get('Range');
        const ifRange = request.headers.get('If-Range');
        const useRange = rangeHeader && (!ifRange || ifRange === object.httpEtag);
        const range = useRange ? byteRange(rangeHeader, object.size) : undefined;
        if (range === null) {
          headers.set('Content-Range', `bytes */${object.size}`); headers.set('Content-Length', '0');
          return new Response(null, { status: 416, headers });
        }
        const data = await env.MEDIA.get(key, range ? { range } : undefined);
        if (!data) throw new HttpError(404, 'Archivo no encontrado.');
        if (range) {
          headers.set('Content-Range', `bytes ${range.offset}-${range.offset + range.length - 1}/${object.size}`);
          headers.set('Content-Length', String(range.length));
        }
        return new Response(data.body, { status: range ? 206 : 200, headers });
      }
      if (/^\/(api|ws|media)(\/|$)/.test(url.pathname)) throw new HttpError(404, 'Ruta no encontrada.');
      return env.ASSETS.fetch(request);
    } catch (error) {
      if (error instanceof HttpError) return json({ error: error.message }, error.status);
      return json({ error: 'No se pudo completar la operación. Inténtalo de nuevo.' }, 500);
    }
  },
} satisfies ExportedHandler<Env>;
