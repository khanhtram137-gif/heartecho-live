/**
 * Module 2 — Postcard Corkboard
 * Every postcard property (pos, color, text, z, del) is its own last-writer-wins register
 * versioned by [time, participantId].
 */
(function () {
  'use strict';
  const { esc } = HE;

  const NOTE_W = 190;
  const NOTE_H = 168;
  const PROPS = ['pos', 'color', 'text', 'z', 'del'];
  const COLORS = ['c1', 'c2', 'c3', 'c4', 'c5'];
  const FLAG_MS = 1600;

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const cmp = (a, b) => (a[0] - b[0]) || (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0);

  function validSeq(s) { return Array.isArray(s) && s.length === 2 && Number.isFinite(s[0]) && typeof s[1] === 'string'; }
  function validValue(p, v) {
    switch (p) {
      case 'pos': return v && Number.isFinite(v.x) && Number.isFinite(v.y);
      case 'color': return COLORS.includes(v);
      case 'text': return typeof v === 'string' && v.length <= 280;
      case 'z': return Number.isFinite(v);
      case 'del': return typeof v === 'boolean';
    }
    return false;
  }

  HE.defineModule('notes', {
    title: 'Postcard Corkboard',
    badge: '📌 Write together',
    tagline: 'Pin postcards, move them, write on them. Everyone works on the same board at the same time.',
    source: {
      name: 'FigJam & Miro sticky notes · Figma’s multiplayer model',
      text: 'Sticky-note boards let a whole class think on one wall. Figma has described how its multiplayer works: each property of an object is synced on its own, and the last write wins. Two people can then move and recolor the same card without breaking it. This board works the same way and shows you when a write wins and when one loses.'
    },
    rules: [
      'Each postcard has five properties: position (a fraction of the board’s size), color, text, stacking order and removed. Each one carries its own version [time, participant id].',
      'Changing one property sends only that property: its value, its new version, and the version you were looking at before the change.',
      'A new version’s time is the larger of “now” and “the largest time seen so far + 1”.',
      'On receiving a change, the higher version wins. If the times are equal, the higher id wins. Every screen ends up with the same board.',
      'A red Conflict flag (1.6 s) means someone overwrote your change without having seen it. A Discarded flag means an update arrived too late and lost.',
      'While dragging, position is sent every 40 ms. Who is dragging which card travels as presence and disappears when they leave.',
      'Newcomers receive every postcard, versions included, from the person who has been in the room longest.'
    ],
    howto: [
      'Double-click (or double-tap) an empty spot to pin a postcard.',
      'Drag the top strip to move it, and tap a dot to recolor it.',
      'Type inside to write. ✕ removes the card.',
      'Two tabs, one card: drag it in both at once and watch the flags.'
    ],

    mount(stage) {
      stage.innerHTML = `
        <div class="nb-board" id="nbBoard">
          <div class="nb-empty" id="nbEmpty"><div><span class="nb-empty-icon">📌</span>Double-click anywhere to pin a postcard.</div></div>
          <aside class="nb-log" aria-live="polite">
            <div class="nb-log-title">Latest changes</div>
            <ol id="nbLog"></ol>
          </aside>
        </div>
        <p class="module-hint" style="margin-top:.7rem">Drag the top strip to move · dots recolor · ✕ removes</p>`;

      const board = stage.querySelector('#nbBoard');
      const emptyEl = stage.querySelector('#nbEmpty');
      const logEl = stage.querySelector('#nbLog');

      const notes = new Map();     // id -> { id, p: { pos:{v,s}, ... } }
      const els = new Map();       // id -> element
      const dragBy = new Map();    // noteId -> peer
      const textSenders = new Map();
      const log = [];
      let maxT = 0;
      let seq = 0;
      let dragging = null;

      const myId = () => room.me.id || `local-${HE.clientId}`;

      function nextSeq() {
        const t = Math.max(Date.now(), maxT + 1);
        maxT = t;
        return [t, myId()];
      }

      function maxZ() {
        let z = 0;
        notes.forEach(n => { if (n.p.z && n.p.z.v > z) z = n.p.z.v; });
        return z;
      }

      // ------------------------------------------------------- render
      function ensureEl(id) {
        let el = els.get(id);
        if (el) return el;
        el = document.createElement('div');
        el.className = 'nb-note';
        el.dataset.id = id;
        el.innerHTML = `
          <div class="nb-grip">
            ${COLORS.map(c => `<button type="button" class="nb-dot" data-c="${c}" aria-label="Color ${c.slice(1)}"></button>`).join('')}
            <span class="nb-grip-space"></span>
            <button type="button" class="nb-del" aria-label="Remove postcard" title="Remove">✕</button>
          </div>
          <textarea class="nb-text" maxlength="280" placeholder="Write something kind…" aria-label="Postcard text"></textarea>`;
        board.appendChild(el);
        els.set(id, el);
        return el;
      }

      function render(id) {
        const n = notes.get(id);
        if (!n) return;
        const el = ensureEl(id);
        const visible = n.p.pos && !(n.p.del && n.p.del.v);
        el.style.display = visible ? '' : 'none';
        if (!visible) return;

        const W = board.clientWidth, H = board.clientHeight;
        el.style.left = clamp(n.p.pos.v.x * W, 0, Math.max(0, W - NOTE_W)) + 'px';
        el.style.top = clamp(n.p.pos.v.y * H, 0, Math.max(0, H - NOTE_H)) + 'px';
        el.style.zIndex = String(Math.min(99990, (n.p.z ? n.p.z.v : 0) + 1));

        const color = n.p.color ? n.p.color.v : 'c1';
        el.dataset.color = color;
        el.querySelectorAll('.nb-dot').forEach(d => d.classList.toggle('on', d.dataset.c === color));

        const ta = el.querySelector('.nb-text');
        const text = n.p.text ? n.p.text.v : '';
        if (ta.value !== text) {
          if (document.activeElement === ta) {
            const a = ta.selectionStart, b = ta.selectionEnd;
            ta.value = text;
            ta.setSelectionRange(Math.min(a, text.length), Math.min(b, text.length));
          } else {
            ta.value = text;
          }
        }

        const peer = dragBy.get(id);
        el.classList.toggle('is-dragged', !!peer);
        let tag = el.querySelector('.nb-dragtag');
        if (peer) {
          el.style.setProperty('--pc', peer.color);
          if (!tag) { tag = document.createElement('span'); tag.className = 'nb-dragtag'; el.appendChild(tag); }
          tag.style.setProperty('--pc', peer.color);
          tag.textContent = `${peer.name} is moving this`;
        } else if (tag) {
          tag.remove();
        }
      }

      function renderAll() {
        notes.forEach((_, id) => render(id));
        const any = [...notes.values()].some(n => n.p.pos && !(n.p.del && n.p.del.v));
        emptyEl.style.display = any ? 'none' : '';
      }

      function flag(id, kind) {
        const el = els.get(id);
        if (!el || el.style.display === 'none') return;
        el.querySelector('.nb-flag')?.remove();
        const f = document.createElement('span');
        f.className = `nb-flag ${kind}`;
        f.textContent = kind === 'conflict' ? 'Conflict · overwritten' : 'Discarded · arrived late';
        el.appendChild(f);
        if (kind === 'conflict') el.classList.add('is-conflict');
        clearTimeout(el._flagTimer);
        el._flagTimer = setTimeout(() => { f.remove(); el.classList.remove('is-conflict'); }, FLAG_MS);
      }

      // ---------------------------------------------------------- log
      function label(id) {
        const t = notes.get(id)?.p.text?.v?.trim();
        return t ? `“${t.length > 16 ? t.slice(0, 16) + '…' : t}”` : 'a postcard';
      }
      function addLog(who, verb, id) {
        if (!verb) return;
        const now = Date.now();
        const top = log[0];
        if (top && top.name === who.name && top.verb === verb && top.id === id && now - top.t < 4000) {
          top.t = now;
        } else {
          log.unshift({ name: who.name, color: who.color, verb, id, t: now });
          log.length = Math.min(log.length, 5);
        }
        renderLog();
      }
      function ago(t) {
        const s = Math.round((Date.now() - t) / 1000);
        if (s < 5) return 'now';
        if (s < 60) return `${s}s`;
        return `${Math.round(s / 60)}m`;
      }
      function renderLog() {
        logEl.innerHTML = log.length
          ? log.map(e => `<li style="--pc:${esc(e.color)}"><i></i><span><strong>${esc(e.name)}</strong> ${esc(e.verb)} ${esc(label(e.id))}</span><time>${ago(e.t)}</time></li>`).join('')
          : '<li class="nb-log-empty">Nothing yet.</li>';
      }
      setInterval(renderLog, 5000);

      function verbFor(p, v) {
        return { pos: 'moved', color: 'recolored', text: 'edited', del: v ? 'removed' : 'restored' }[p] || null;
      }

      // ----------------------------------------------------- changes
      function localSet(id, p, v, doLog = true) {
        const n = notes.get(id);
        if (!n) return;
        const prev = n.p[p] ? n.p[p].s : [0, ''];
        const s = nextSeq();
        n.p[p] = { v, s };
        render(id);
        if (p === 'del') renderAll();
        room.send({ type: 'sets', ops: [{ id, p, v, s, prev }] });
        if (doLog) addLog(room.me, verbFor(p, v), id);
      }

      function applyOp(op, peer, silent) {
        if (!op || typeof op.id !== 'string' || op.id.length > 64 || !PROPS.includes(op.p)) return;
        if (!validSeq(op.s) || !validValue(op.p, op.v)) return;
        const prev = validSeq(op.prev) ? op.prev : [0, ''];
        maxT = Math.max(maxT, op.s[0]);

        let n = notes.get(op.id);
        if (!n) { n = { id: op.id, p: {} }; notes.set(op.id, n); }
        const cur = n.p[op.p];

        if (!cur || cmp(op.s, cur.s) > 0) {
          const overwroteMine = cur && cur.s[1] === myId() && cmp(prev, cur.s) < 0;
          n.p[op.p] = { v: op.v, s: op.s };
          render(op.id);
          if (!silent) {
            addLog(peer, verbFor(op.p, op.v), op.id);
            if (overwroteMine) flag(op.id, 'conflict');
          }
        } else if (!silent && cmp(op.s, cur.s) < 0) {
          flag(op.id, 'discarded');
        }
      }

      function createAt(px, py) {
        const W = board.clientWidth, H = board.clientHeight;
        const id = `${HE.clientId}-${++seq}`;
        const n = { id, p: {} };
        notes.set(id, n);
        const vals = {
          pos: { x: clamp((px - NOTE_W / 2) / W, 0, Math.max(0, (W - NOTE_W) / W)), y: clamp((py - 15) / H, 0, Math.max(0, (H - NOTE_H) / H)) },
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          text: '',
          z: maxZ() + 1,
          del: false
        };
        const ops = PROPS.map(p => {
          const s = nextSeq();
          n.p[p] = { v: vals[p], s };
          return { id, p, v: vals[p], s, prev: [0, ''] };
        });
        room.send({ type: 'sets', ops });
        renderAll();
        addLog(room.me, 'pinned', id);
        els.get(id).querySelector('.nb-text').focus();
      }

      // -------------------------------------------------------- input
      let lastTap = { t: 0, x: 0, y: 0 };
      board.addEventListener('pointerdown', e => {
        if (e.target !== board && e.target !== emptyEl && !emptyEl.contains(e.target)) return;
        const r = board.getBoundingClientRect();
        const x = e.clientX - r.left, y = e.clientY - r.top;
        const now = Date.now();
        if (now - lastTap.t < 380 && Math.hypot(x - lastTap.x, y - lastTap.y) < 26) {
          lastTap.t = 0;
          e.preventDefault();
          createAt(x, y);
        } else {
          lastTap = { t: now, x, y };
        }
      });

      board.addEventListener('click', e => {
        const note = e.target.closest('.nb-note');
        if (!note) return;
        const id = note.dataset.id;
        const dot = e.target.closest('.nb-dot');
        if (dot) { if (notes.get(id)?.p.color?.v !== dot.dataset.c) localSet(id, 'color', dot.dataset.c); return; }
        if (e.target.closest('.nb-del')) localSet(id, 'del', true);
      });

      board.addEventListener('input', e => {
        if (!e.target.classList.contains('nb-text')) return;
        const id = e.target.closest('.nb-note').dataset.id;
        let send = textSenders.get(id);
        if (!send) {
          send = HE.throttle(v => localSet(id, 'text', v), 180);
          textSenders.set(id, send);
        }
        send(e.target.value.slice(0, 280));
      });
      board.addEventListener('focusout', e => {
        if (!e.target.classList.contains('nb-text')) return;
        textSenders.get(e.target.closest('.nb-note').dataset.id)?.flush();
      });

      board.addEventListener('pointerdown', e => {
        const grip = e.target.closest('.nb-grip');
        if (!grip || e.target.closest('.nb-dot, .nb-del')) return;
        e.preventDefault();
        const el = grip.closest('.nb-note');
        const id = el.dataset.id;
        const r = el.getBoundingClientRect();
        const offX = e.clientX - r.left, offY = e.clientY - r.top;
        grip.setPointerCapture(e.pointerId);
        dragging = id;
        room.setPresence({ drag: id });
        localSet(id, 'z', maxZ() + 1, false);
        const sendPos = HE.throttle((x, y) => localSet(id, 'pos', { x, y }), 40);

        const move = ev => {
          const b = board.getBoundingClientRect();
          const W = b.width, H = b.height;
          const left = clamp(ev.clientX - b.left - offX, 0, Math.max(0, W - NOTE_W));
          const top = clamp(ev.clientY - b.top - offY, 0, Math.max(0, H - NOTE_H));
          el.style.left = left + 'px';
          el.style.top = top + 'px';
          sendPos(Math.round((left / W) * 10000) / 10000, Math.round((top / H) * 10000) / 10000);
        };
        const up = () => {
          sendPos.flush();
          grip.removeEventListener('pointermove', move);
          grip.removeEventListener('pointerup', up);
          grip.removeEventListener('pointercancel', up);
          dragging = null;
          room.setPresence({ drag: null });
        };
        grip.addEventListener('pointermove', move);
        grip.addEventListener('pointerup', up);
        grip.addEventListener('pointercancel', up);
      });

      // ---------------------------------------------------------- room
      function dropPresence(peer) {
        for (const [nid, p] of dragBy) {
          if (p.id === peer.id) { dragBy.delete(nid); render(nid); }
        }
      }
      function snapshot() {
        return { maxT, notes: [...notes.values()].map(n => ({ id: n.id, p: n.p })) };
      }
      function merge(data, peer) {
        if (!data || !Array.isArray(data.notes)) return 0;
        if (Number.isFinite(data.maxT)) maxT = Math.max(maxT, data.maxT);
        let count = 0;
        data.notes.slice(0, 500).forEach(n => {
          if (!n || typeof n.id !== 'string' || !n.p) return;
          PROPS.forEach(p => { if (n.p[p]) applyOp({ id: n.id, p, v: n.p[p].v, s: n.p[p].s }, peer, true); });
          if (n.p.pos && !(n.p.del && n.p.del.v)) count++;
        });
        renderAll();
        return count;
      }

      const room = HE.connect('notes', {
        onWelcome(me, reconnect) {
          if (reconnect && notes.size) room.send({ type: 'merge', ...snapshot() });
        },
        getSnapshot: snapshot,
        onSnapshot(data, peer) {
          const n = merge(data, peer);
          if (n) HE.toast(`${peer.name} handed you ${n} postcard${n === 1 ? '' : 's'}.`, '📌');
        },
        onMessage(d, peer) {
          if (!d) return;
          if (d.type === 'sets' && Array.isArray(d.ops)) {
            const ops = d.ops.slice(0, 10);
            const isNew = ops.length > 1 && ops[0] && typeof ops[0].id === 'string' && !notes.has(ops[0].id);
            ops.forEach(op => applyOp(op, peer, isNew));
            if (isNew) addLog(peer, 'pinned', ops[0].id);
            renderAll();
          } else if (d.type === 'merge') {
            merge(d, peer);
          }
        },
        onPresence(peer, d) {
          dropPresence(peer);
          if (d && typeof d.drag === 'string') { dragBy.set(d.drag, peer); render(d.drag); }
        },
        onLeave: dropPresence
      });

      new ResizeObserver(() => { if (!dragging) renderAll(); }).observe(board);
      renderLog();
      return room;
    }
  });
})();
