export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: {
    'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
  } });
}
export function bearer(request: Request) {
  return request.headers.get('Authorization')?.match(/^Bearer (\S+)$/)?.[1] ?? '';
}
export async function smallJson(request: Request) {
  if (Number(request.headers.get('Content-Length')) > 4096) throw new HttpError(413, 'Solicitud demasiado grande.');
  const text = await request.text();
  if (text.length > 4096) throw new HttpError(413, 'Solicitud demasiado grande.');
  try { return JSON.parse(text); } catch { throw new HttpError(400, 'El contenido JSON no es válido.'); }
}
