import { useCallback, useEffect, useRef, useState } from 'react';
import { applyOperation, type EditCommand, type ItemPatch, type Role, type RoomState, type ServerMessage } from '../shared/model';

export function useRoom(roomId: string, key: string) {
  const [state, setState] = useState<RoomState | null>(null);
  const stateRef = useRef<RoomState | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'offline' | 'denied'>('connecting');
  const [error, setError] = useState('');
  const [presence, setPresence] = useState({ editors: 0, viewers: 0 });
  const [pending, setPending] = useState(0);
  const [previews, setPreviews] = useState<Record<string, ItemPatch>>({});
  const [lastAddedIds, setLastAddedIds] = useState<string[]>([]);
  const [clipboardCount, setClipboardCount] = useState(0);
  const [clipboardCopied, setClipboardCopied] = useState(0);
  const [history, setHistory] = useState({ undo: 0, redo: 0 });
  const [serverOffset, setServerOffset] = useState(0);
  const socket = useRef<WebSocket | null>(null);
  const pendingIds = useRef(new Set<string>());
  const lastPreview = useRef(0);
  const previewTimes = useRef<Record<string, number>>({});

  useEffect(() => {
    const timer = setInterval(() => setPreviews(current => {
      const expired = Object.keys(current).filter(id => Date.now() - (previewTimes.current[id] ?? 0) > 2000);
      if (!expired.length) return current;
      const next = { ...current }; for (const id of expired) delete next[id]; return next;
    }), 500);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let disposed = false, retry = 0, reconnect: ReturnType<typeof setTimeout> | undefined;
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    const update = (value: RoomState | null) => { stateRef.current = value; setState(value); };
    update(null); setPreviews({}); pendingIds.current.clear(); setPending(0);
    if (!/^[a-f0-9]{64}$/.test(key)) { setStatus('denied'); setError('Este enlace está incompleto. Solicita un enlace nuevo al administrador.'); return; }
    const connect = () => {
      if (disposed) return;
      setStatus(stateRef.current ? 'offline' : 'connecting');
      const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws/${roomId}`);
      socket.current = ws;
      let lastPong = Date.now();
      ws.onopen = () => {
        ws.send(JSON.stringify({ t: 'hello', key }));
        heartbeat = setInterval(() => {
          if (Date.now() - lastPong > 45_000) { ws.close(4000, 'Reconectando'); return; }
          if (ws.readyState === WebSocket.OPEN) ws.send('ping');
        }, 15_000);
      };
      ws.onmessage = event => {
        if (disposed) return;
        if (event.data === 'pong') { lastPong = Date.now(); return; }
        const msg = JSON.parse(event.data) as ServerMessage;
        if (msg.t === 'welcome' || msg.t === 'state') {
          setServerOffset(msg.serverNow - Date.now());
          if (msg.t === 'welcome') { setHistory({ undo: 0, redo: 0 }); setClipboardCount(0); }
          retry = 0; setStatus('connected'); if (msg.t === 'welcome') setError(''); setRole(msg.role); update(msg.state);
          pendingIds.current.clear(); setPending(0); setPreviews({});
        } else if (msg.t === 'op') {
          const previous = stateRef.current;
          if (!previous) return;
          const own = !!msg.requestId && pendingIds.current.has(msg.requestId);
          if (msg.requestId) pendingIds.current.delete(msg.requestId);
          setPending(pendingIds.current.size);
          if (msg.rev <= previous.rev) return;
          if (msg.rev !== previous.rev + 1) { ws.send(JSON.stringify({ t: 'sync' })); return; }
          if (own) {
            const upserts = msg.op.t === 'item.upsert' ? [msg.op.item] : msg.op.t === 'items.change' ? msg.op.upserts : [];
            const added = upserts.filter(item => !previous.items.some(i => i.id === item.id)).map(i => i.id);
            if (added.length) setLastAddedIds(added);
          }
          update(applyOperation(previous, msg.op, msg.rev));
          const ids = msg.op.t === 'item.upsert' ? [msg.op.item.id] : msg.op.t === 'item.remove' ? [msg.op.id]
            : msg.op.t === 'items.change' ? [...msg.op.upserts.map(i => i.id), ...msg.op.removed] : [];
          if (ids.length) setPreviews(current => { const next = { ...current }; for (const id of ids) delete next[id]; return next; });
        } else if (msg.t === 'clipboard') {
          setClipboardCount(msg.count);
          if (msg.requestId && pendingIds.current.has(msg.requestId)) {
            pendingIds.current.delete(msg.requestId); setPending(pendingIds.current.size); setClipboardCopied(value => value + 1);
          }
        } else if (msg.t === 'history') {
          setHistory({ undo: msg.undo, redo: msg.redo });
        } else if (msg.t === 'previews') {
          setPreviews(current => { const next = { ...current }; for (const { id, patch } of msg.patches) { next[id] = patch; previewTimes.current[id] = Date.now(); } return next; });
        } else if (msg.t === 'preview') {
          previewTimes.current[msg.id] = Date.now();
          setPreviews(current => ({ ...current, [msg.id]: { ...current[msg.id], ...msg.patch } }));
        } else if (msg.t === 'presence') setPresence(msg);
        else if (msg.t === 'error') {
          setError(msg.message);
          if (msg.code === '401') { ws.close(4001, 'Autenticación requerida'); return; }
          if (msg.requestId) { pendingIds.current.delete(msg.requestId); setPending(pendingIds.current.size); }
          setPreviews({}); ws.send(JSON.stringify({ t: 'sync' }));
        }
      };
      ws.onclose = event => {
        clearInterval(heartbeat);
        if (disposed) return;
        if (event.code === 4001) { setStatus('denied'); setError('El enlace no es válido o ya no permite acceder a esta sala.'); return; }
        setStatus('offline');
        reconnect = setTimeout(connect, Math.min(10_000, 1000 * 2 ** retry++));
      };
      ws.onerror = () => { if (!disposed) setStatus('offline'); };
    };
    const offline = () => socket.current?.close(4000, 'Sin conexión');
    const online = () => { if (socket.current?.readyState === WebSocket.CLOSED) { clearTimeout(reconnect); connect(); } };
    window.addEventListener('offline', offline); window.addEventListener('online', online);
    connect();
    return () => { disposed = true; clearTimeout(reconnect); clearInterval(heartbeat); socket.current?.close();
      window.removeEventListener('offline', offline); window.removeEventListener('online', online); };
  }, [roomId, key]);

  const send = useCallback((command: EditCommand) => {
    if (socket.current?.readyState !== WebSocket.OPEN || status !== 'connected' || role !== 'editor') {
      setError('Espera a recuperar la conexión antes de editar.'); setPreviews({}); return false;
    }
    const requestId = crypto.randomUUID();
    pendingIds.current.add(requestId); setPending(pendingIds.current.size);
    socket.current.send(JSON.stringify({ ...command, requestId }));
    return true;
  }, [status, role]);

  const preview = useCallback((id: string, patch: ItemPatch) => {
    previewTimes.current[id] = Date.now();
    setPreviews(current => ({ ...current, [id]: patch }));
    if (Date.now() - lastPreview.current >= 34 && socket.current?.readyState === WebSocket.OPEN) {
      lastPreview.current = Date.now(); socket.current.send(JSON.stringify({ t: 'item.preview', id, patch }));
    }
  }, []);
  const previewMany = useCallback((patches: { id: string; patch: ItemPatch }[], delta: { dx: number; dy: number }) => {
    setPreviews(current => { const next = { ...current }; for (const { id, patch } of patches) { next[id] = patch; previewTimes.current[id] = Date.now(); } return next; });
    if (Date.now() - lastPreview.current >= 34 && socket.current?.readyState === WebSocket.OPEN) {
      lastPreview.current = Date.now(); socket.current.send(JSON.stringify({ t: 'items.preview', ids: patches.map(p => p.id), ...delta }));
    }
  }, []);
  const clearPreviews = useCallback(() => setPreviews({}), []);
  const rendered = state?.items.map(item => ({ ...item, ...previews[item.id] })) ?? [];
  return { state, role, status, error, setError, presence, pending, rendered, send, preview, previewMany, clearPreviews, lastAddedIds, history, clipboardCount, clipboardCopied, serverOffset, isPreviewing: Object.keys(previews).length > 0 };
}
export type RoomConnection = ReturnType<typeof useRoom>;
