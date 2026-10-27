/**
 * HeartEcho Live — Cloudflare Worker + Durable Object (free plan)
 *
 * - Static files in /public are served by Workers Static Assets.
 * - /ws/<module>/<room> upgrades to a WebSocket handled by one Durable Object per room.
 * - The room is a relay: it assigns ids/colors, announces join/leave, forwards messages,
 *   and asks the longest-standing participant to hand a snapshot to each newcomer.
 *   Nothing is written to storage, so the free plan's limits are never touched by data.
 * - Uses the WebSocket Hibernation API so idle rooms cost no duration.
 */
import { DurableObject } from 'cloudflare:workers';

const MODULES = new Set(['stamps', 'notes', 'sketch']);
const MAX_PEERS = 24;
const MAX_MSG_BYTES = 900 * 1024;     // Cloudflare caps a WS message at 1 MiB
const MAX_MSGS_PER_SEC = 60;          // per-connection flood guard
const COLORS = ['#ff5d8f', '#3d8bfd', '#f59f00', '#12b886', '#9b5cff',
                '#ff7a3d', '#0aa5c2', '#d63fc5', '#5c940d', '#e03131'];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const m = url.pathname.match(/^\/ws\/([a-z]+)\/([A-Za-z0-9_-]{1,64})$/);
    if (m) {
      if (!MODULES.has(m[1])) return new Response('Unknown module', { status: 404 });
      if (request.headers.get('Upgrade') !== 'websocket') {
        return new Response('Expected a WebSocket upgrade', { status: 426 });
      }
      const stub = env.ROOMS.get(env.ROOMS.idFromName(`${m[1]}:${m[2]}`));
      return stub.fetch(request);
    }
    return env.ASSETS.fetch(request);
  }
};

export class Room extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    // Keep-alive pings are answered without waking the object from hibernation.
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
    this.rate = new WeakMap();
  }

  async fetch(request) {
    const url = new URL(request.url);
    const { 0: client, 1: server } = new WebSocketPair();
    const others = this.peers();

    this.ctx.acceptWebSocket(server);

    if (others.length >= MAX_PEERS) {
      server.send(JSON.stringify({ t: 'full', max: MAX_PEERS }));
      server.close(1013, 'Room is full');
      return new Response(null, { status: 101, webSocket: client });
    }

    const used = new Set(others.map(p => p.info.color));
    const info = {
      id: crypto.randomUUID().replace(/-/g, '').slice(0, 8),
      name: cleanName(url.searchParams.get('name')) || `Guest ${others.length + 1}`,
      color: COLORS.find(c => !used.has(c)) || COLORS[others.length % COLORS.length],
      joined: Date.now(),
      presence: null
    };
    server.serializeAttachment(info);

    server.send(JSON.stringify({ t: 'welcome', you: info, peers: others.map(p => p.info) }));
    this.broadcast({ t: 'join', peer: info }, server);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, raw) {
    if (typeof raw !== 'string' || raw.length > MAX_MSG_BYTES) return;
    if (!this.allow(ws)) return;

    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    const info = ws.deserializeAttachment();
    if (!info) return;

    switch (msg.t) {
      case 'b': // broadcast to everyone else
        this.broadcast({ t: 'b', from: info.id, d: msg.d }, ws);
        break;

      case 'to': { // direct message (snapshots travel this way)
        const target = this.peers().find(p => p.info.id === msg.to);
        if (target) safeSend(target.ws, { t: 'to', from: info.id, d: msg.d });
        break;
      }

      case 'presence': // ephemeral state remembered for newcomers (e.g. "dragging note 3")
        info.presence = msg.d ?? null;
        ws.serializeAttachment(info);
        this.broadcast({ t: 'presence', from: info.id, d: info.presence }, ws);
        break;

      case 'name': {
        const name = cleanName(msg.name);
        if (!name) break;
        info.name = name;
        ws.serializeAttachment(info);
        this.broadcast({ t: 'peer', peer: info }, null);
        break;
      }

      case 'need-snapshot': { // newcomer asks; the longest-standing participant answers
        const skip = new Set([info.id, ...(Array.isArray(msg.skip) ? msg.skip : [])]);
        const helper = this.peers()
          .filter(p => !skip.has(p.info.id))
          .sort((a, b) => a.info.joined - b.info.joined)[0];
        if (helper) safeSend(helper.ws, { t: 'snapshot-request', for: info.id });
        else safeSend(ws, { t: 'no-snapshot' });
        break;
      }
    }
  }

  async webSocketClose(ws, code) {
    this.leave(ws);
    try { ws.close(code === 1005 ? 1000 : code, 'bye'); } catch {}
  }

  async webSocketError(ws) {
    this.leave(ws);
  }

  // ---------------------------------------------------------------- helpers
  leave(ws) {
    const info = ws.deserializeAttachment();
    if (!info || info.left) return;
    info.left = true;
    try { ws.serializeAttachment(info); } catch {}
    this.broadcast({ t: 'leave', id: info.id }, ws);
  }

  peers() {
    const out = [];
    for (const ws of this.ctx.getWebSockets()) {
      const info = ws.deserializeAttachment();
      if (info && !info.left && ws.readyState === WebSocket.OPEN) out.push({ ws, info });
    }
    return out;
  }

  broadcast(obj, except) {
    const data = JSON.stringify(obj);
    for (const { ws } of this.peers()) {
      if (ws !== except) safeSend(ws, data);
    }
  }

  allow(ws) {
    const now = Date.now();
    const r = this.rate.get(ws) || { start: now, n: 0 };
    if (now - r.start > 1000) { r.start = now; r.n = 0; }
    r.n += 1;
    this.rate.set(ws, r);
    return r.n <= MAX_MSGS_PER_SEC;
  }
}

function safeSend(ws, obj) {
  try { ws.send(typeof obj === 'string' ? obj : JSON.stringify(obj)); } catch {}
}

function cleanName(s) {
  if (typeof s !== 'string') return '';
  return s.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 24);
}
