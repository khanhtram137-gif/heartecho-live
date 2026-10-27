/**
 * HeartEcho Together — shared client
 * Theme sync with the main site, participant names, the room bar,
 * and a small realtime layer over one WebSocket per room.
 */
(function () {
  'use strict';

  const THEMES = ['cute', 'vintage', 'futuristic'];
  const THEME_TEXT = {
    cute: { icon: '🕊️', title: 'HeartEcho', sub: 'Together Room' },
    vintage: { icon: '📜', title: 'HeartEcho Gazette', sub: 'The Parlour' },
    futuristic: { icon: '🚀', title: 'HEART//ECHO', sub: 'SYNC//DECK' }
  };
  const ADJ = ['Gentle', 'Quiet', 'Warm', 'Brave', 'Soft', 'Kind', 'Sunny', 'Misty', 'Tender', 'Calm', 'Bright', 'Cozy'];
  const NOUN = ['Dove', 'Sparrow', 'Lantern', 'Petal', 'Comet', 'Willow', 'Pebble', 'Ember', 'Breeze', 'Robin', 'Maple', 'Moth'];

  const params = new URLSearchParams(location.search);
  const isGuest = params.get('guest') === '1';

  // ------------------------------------------------------------ utilities
  function esc(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function store(kind) {
    try { return kind === 'session' ? window.sessionStorage : window.localStorage; } catch { return null; }
  }
  function getItem(key, kind) { try { return store(kind)?.getItem(key) ?? null; } catch { return null; } }
  function setItem(key, val, kind) { try { store(kind)?.setItem(key, val); } catch {} }

  function randomName() {
    return `${ADJ[Math.floor(Math.random() * ADJ.length)]} ${NOUN[Math.floor(Math.random() * NOUN.length)]}`;
  }

  function myName() {
    if (isGuest) {
      let n = getItem('he_guest_name', 'session');
      if (!n) { n = randomName(); setItem('he_guest_name', n, 'session'); }
      return n;
    }
    let n = getItem('heartecho_name');
    if (!n) { n = randomName(); setItem('heartecho_name', n); }
    return n;
  }

  function saveName(n) {
    if (isGuest) setItem('he_guest_name', n, 'session');
    else setItem('heartecho_name', n);
  }

  function roomId() {
    const r = (params.get('r') || 'main').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64);
    return r || 'main';
  }

  function toast(message, icon = '💌') {
    let box = document.getElementById('toastContainer');
    if (!box) {
      box = document.createElement('div');
      box.id = 'toastContainer';
      box.className = 'toast-container';
      document.body.appendChild(box);
    }
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = `<span>${icon}</span> <span>${esc(message)}</span>`;
    box.appendChild(t);
    setTimeout(() => t.remove(), 3600);
  }

  // A tab-local id. Stays the same across reconnects, unlike the server-assigned id.
  const clientId = Math.random().toString(36).slice(2, 10);

  // ---------------------------------------------------------------- theme
  function currentTheme() {
    const t = getItem('heartecho_theme');
    return THEMES.includes(t) ? t : 'cute';
  }

  function applyTheme(theme, save) {
    if (!THEMES.includes(theme)) return;
    document.documentElement.setAttribute('data-theme', theme);
    if (save) setItem('heartecho_theme', theme);
    const txt = THEME_TEXT[theme];
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('logoIcon', txt.icon);
    set('logoTitle', txt.title);
    set('logoSubtitle', txt.sub);
    document.querySelectorAll('[data-theme-choice]').forEach(b => {
      b.classList.toggle('active', b.dataset.themeChoice === theme);
    });
    window.dispatchEvent(new CustomEvent('he-theme', { detail: theme }));
  }

  function initTheme() {
    applyTheme(currentTheme(), false);
    document.querySelectorAll('[data-theme-choice]').forEach(b => {
      b.addEventListener('click', () => applyTheme(b.dataset.themeChoice, true));
    });
    // Follow theme changes made in another tab (e.g. on the main site).
    window.addEventListener('storage', e => {
      if (e.key === 'heartecho_theme' && THEMES.includes(e.newValue)) applyTheme(e.newValue, false);
    });
  }

  // ------------------------------------------------------------- realtime
  /**
   * connect(moduleId, handlers) → room
   * handlers: onWelcome(me, isReconnect), onMessage(data, peer), onPresence(peer, data),
   *           onJoin(peer), onLeave(peer), getSnapshot(), onSnapshot(data, peer),
   *           onNoSnapshot(), onStatus(status)
   */
  function connect(moduleId, handlers = {}) {
    const room = {
      module: moduleId,
      id: roomId(),
      me: { id: null, name: myName(), color: '#999' },
      peers: new Map(),
      status: 'connecting',
      send(d) { return raw({ t: 'b', d }); },
      sendTo(to, d) { return raw({ t: 'to', to, d }); },
      setPresence(d) { return raw({ t: 'presence', d }); },
      rename(name) {
        name = String(name || '').trim().slice(0, 24);
        if (!name) return;
        saveName(name);
        room.me.name = name;
        raw({ t: 'name', name });
        emitChange();
      },
      peerName(id) { return id === room.me.id ? room.me.name : (room.peers.get(id)?.name || 'Someone'); },
      onChange: null
    };

    let ws = null;
    let tries = 0;
    let everConnected = false;
    let pingTimer = null;
    let snapTimer = null;
    let snapReceived = false;

    function emitChange() { if (room.onChange) room.onChange(room); }
    function setStatus(s) { room.status = s; handlers.onStatus?.(s); emitChange(); }

    function raw(obj) {
      if (!ws || ws.readyState !== WebSocket.OPEN) return false;
      try { ws.send(JSON.stringify(obj)); return true; } catch { return false; }
    }

    if (location.protocol === 'file:') {
      setStatus('local');
      setTimeout(() => handlers.onNoSnapshot?.(), 0);
      return room;
    }

    function open() {
      setStatus(everConnected ? 'reconnecting' : 'connecting');
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      const url = `${proto}://${location.host}/ws/${moduleId}/${encodeURIComponent(room.id)}?name=${encodeURIComponent(room.me.name)}`;
      try { ws = new WebSocket(url); } catch { schedule(); return; }

      ws.onmessage = ev => {
        if (ev.data === 'pong') return;
        let msg;
        try { msg = JSON.parse(ev.data); } catch { return; }
        handle(msg);
      };
      ws.onclose = () => {
        clearInterval(pingTimer);
        clearTimeout(snapTimer);
        // Everyone we knew is gone from our point of view until we rejoin.
        for (const p of room.peers.values()) handlers.onLeave?.(p);
        room.peers.clear();
        schedule();
      };
      ws.onerror = () => { try { ws.close(); } catch {} };
    }

    function schedule() {
      setStatus(everConnected ? 'reconnecting' : 'offline');
      const wait = Math.min(10000, 1000 * Math.pow(2, tries++));
      setTimeout(open, wait);
    }

    function askSnapshot(attempt) {
      raw({ t: 'need-snapshot' });
      clearTimeout(snapTimer);
      snapTimer = setTimeout(() => {
        if (snapReceived) return;
        if (attempt < 2 && room.peers.size > 0) askSnapshot(attempt + 1);
        else handlers.onNoSnapshot?.();
      }, 3500);
    }

    function handle(msg) {
      switch (msg.t) {
        case 'welcome': {
          const reconnect = everConnected;
          everConnected = true;
          tries = 0;
          room.me = msg.you;
          room.peers.clear();
          msg.peers.forEach(p => room.peers.set(p.id, p));
          setStatus('live');
          clearInterval(pingTimer);
          pingTimer = setInterval(() => { try { ws.send('ping'); } catch {} }, 25000);
          handlers.onWelcome?.(room.me, reconnect);
          msg.peers.forEach(p => { if (p.presence) handlers.onPresence?.(p, p.presence); });
          snapReceived = false;
          if (room.peers.size > 0) askSnapshot(0);
          else handlers.onNoSnapshot?.();
          break;
        }
        case 'join':
          room.peers.set(msg.peer.id, msg.peer);
          handlers.onJoin?.(msg.peer);
          emitChange();
          break;
        case 'leave': {
          const p = room.peers.get(msg.id);
          room.peers.delete(msg.id);
          if (p) handlers.onLeave?.(p);
          emitChange();
          break;
        }
        case 'peer':
          if (msg.peer.id === room.me.id) room.me = { ...room.me, name: msg.peer.name };
          else if (room.peers.has(msg.peer.id)) room.peers.set(msg.peer.id, { ...room.peers.get(msg.peer.id), name: msg.peer.name });
          emitChange();
          break;
        case 'presence': {
          const p = room.peers.get(msg.from);
          if (p) { p.presence = msg.d; handlers.onPresence?.(p, msg.d); }
          break;
        }
        case 'b': {
          const p = room.peers.get(msg.from) || { id: msg.from, name: 'Someone', color: '#999' };
          handlers.onMessage?.(msg.d, p);
          break;
        }
        case 'to': {
          const p = room.peers.get(msg.from) || { id: msg.from, name: 'Someone', color: '#999' };
          if (msg.d && msg.d.__snap !== undefined) {
            if (snapReceived) return;
            snapReceived = true;
            clearTimeout(snapTimer);
            handlers.onSnapshot?.(msg.d.__snap, p);
          } else {
            handlers.onMessage?.(msg.d, p);
          }
          break;
        }
        case 'snapshot-request': {
          const data = handlers.getSnapshot ? handlers.getSnapshot() : null;
          raw({ t: 'to', to: msg.for, d: { __snap: data } });
          break;
        }
        case 'no-snapshot':
          if (!snapReceived) { clearTimeout(snapTimer); handlers.onNoSnapshot?.(); }
          break;
        case 'full':
          toast(`This room is full (${msg.max} people). Try a new private room.`, '🚪');
          break;
      }
    }

    open();
    return room;
  }

  // ------------------------------------------------------------- room bar
  function renderRoomBar(el, room, moduleTitle) {
    el.innerHTML = `
      <div class="roombar-left">
        <span class="room-status" data-status="connecting"><span class="room-status-dot"></span><span class="room-status-text">Connecting…</span></span>
        <span class="room-name">Room <strong>${esc(room.id)}</strong> · ${esc(moduleTitle)}</span>
        <div class="room-people" aria-label="People in this room"></div>
      </div>
      <div class="roombar-right">
        <label class="room-me">
          <span class="room-me-dot"></span>
          <input type="text" class="room-me-input" maxlength="24" aria-label="Your name" value="${esc(room.me.name)}">
        </label>
        <div class="room-menu">
          <button type="button" class="btn btn-secondary btn-sm room-menu-btn" aria-haspopup="true" aria-expanded="false">Room ▾</button>
          <div class="room-menu-panel" hidden>
            <button type="button" data-act="tab">＋ One more in a new tab</button>
            <button type="button" data-act="copy">🔗 Copy room link</button>
            <button type="button" data-act="private">🔒 Start a private room</button>
            ${room.id !== 'main' ? '<button type="button" data-act="main">🏠 Back to the main room</button>' : ''}
          </div>
        </div>
      </div>`;

    const statusEl = el.querySelector('.room-status');
    const statusText = el.querySelector('.room-status-text');
    const people = el.querySelector('.room-people');
    const meDot = el.querySelector('.room-me-dot');
    const input = el.querySelector('.room-me-input');
    const menuBtn = el.querySelector('.room-menu-btn');
    const panel = el.querySelector('.room-menu-panel');

    const STATUS = {
      connecting: 'Connecting…', live: 'Live', reconnecting: 'Reconnecting…',
      offline: 'Offline — retrying', local: 'Local preview (open through the Worker to go live)'
    };

    function update() {
      statusEl.dataset.status = room.status;
      statusText.textContent = STATUS[room.status] || room.status;
      meDot.style.background = room.me.color;
      if (document.activeElement !== input) input.value = room.me.name;
      const all = [{ ...room.me, isMe: true }, ...room.peers.values()];
      people.innerHTML = all.map(p => `
        <span class="room-person${p.isMe ? ' is-me' : ''}" style="--pc:${esc(p.color)}" title="${esc(p.name)}${p.isMe ? ' (you)' : ''}">
          ${esc(p.name.slice(0, 1).toUpperCase())}
        </span>`).join('') +
        `<span class="room-count">${all.length} here</span>`;
    }
    room.onChange = update;
    update();

    input.addEventListener('change', () => room.rename(input.value));
    input.addEventListener('keydown', e => { if (e.key === 'Enter') input.blur(); });

    menuBtn.addEventListener('click', e => {
      e.stopPropagation();
      panel.hidden = !panel.hidden;
      menuBtn.setAttribute('aria-expanded', String(!panel.hidden));
    });
    document.addEventListener('click', e => {
      if (!el.contains(e.target)) { panel.hidden = true; menuBtn.setAttribute('aria-expanded', 'false'); }
    });

    panel.addEventListener('click', async e => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (!act) return;
      panel.hidden = true;
      const url = new URL(location.href);
      url.searchParams.delete('guest');
      if (act === 'tab') {
        url.searchParams.set('guest', '1');
        window.open(url.toString(), '_blank', 'noopener');
      } else if (act === 'copy') {
        try { await navigator.clipboard.writeText(url.toString()); toast('Room link copied. Anyone who opens it joins this room.', '🔗'); }
        catch { prompt('Copy this link:', url.toString()); }
      } else if (act === 'private') {
        url.searchParams.set('r', Math.random().toString(36).slice(2, 8));
        location.href = url.toString();
      } else if (act === 'main') {
        url.searchParams.delete('r');
        location.href = url.toString();
      }
    });
  }

  // ------------------------------------------------------------ module shell
  const registry = {};
  function defineModule(id, def) { registry[id] = def; document.dispatchEvent(new CustomEvent('he-module', { detail: id })); }

  window.HE = {
    esc, toast, clientId, params, isGuest,
    currentTheme, applyTheme, initTheme,
    connect, renderRoomBar,
    defineModule, registry,
    throttle(fn, ms) {
      let last = 0, timer = null, pending = null;
      const run = () => { last = Date.now(); timer = null; const a = pending; pending = null; fn(...a); };
      const t = (...args) => {
        pending = args;
        const wait = ms - (Date.now() - last);
        if (wait <= 0) { clearTimeout(timer); run(); }
        else if (!timer) timer = setTimeout(run, wait);
      };
      t.flush = () => { if (timer) { clearTimeout(timer); run(); } };
      return t;
    }
  };
})();
