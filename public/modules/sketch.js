/**
 * Module 3 — Stationery Sketch
 * One sheet of letter paper, one ink color per participant.
 * Points are integers 0–10000 (fractions of the sheet) and stream every ~30 ms.
 */
(function () {
  'use strict';
  const { esc } = HE;

  const SEND_MS = 30;
  const MAX_POINTS = 120000;     // numbers kept in finished lines (x,y pairs) — keeps snapshots small
  const MIN_STEP = 6;            // skip points closer than 0.06% of the sheet

  HE.defineModule('sketch', {
    title: 'Stationery Sketch',
    badge: '✏️ Draw together',
    tagline: 'One sheet of letter paper, one ink color each. Lines appear as they are drawn.',
    source: {
      name: 'Excalidraw live collaboration',
      text: 'Shared whiteboards like Excalidraw stream each stroke while it is still being drawn, so a doodle feels like it is happening on the same table. Here the table is a sheet of HeartEcho stationery: a margin doodle, a heart around a word, a signature from everyone in the room.'
    },
    rules: [
      'The room gives each person one ink color.',
      'While you draw, points are collected and sent about every 30 ms. Other screens extend the line right away, in your color and at the same width.',
      'Points are fractions of the sheet’s size, so a line lands in the same place on a phone and on a projector.',
      'Lifting the pen adds the line to the list of finished lines. Newcomers receive that list from the person who has been in the room longest.',
      '“Clear all” empties the sheet on every screen and shows who did it for 2 seconds.',
      'On purpose there are no brushes, no color mixing and no undo.'
    ],
    howto: [
      'Draw with a mouse, a finger or a pen.',
      'Your ink color is shown below the sheet.',
      'Open a second tab and draw in both at once.'
    ],

    mount(stage) {
      stage.innerHTML = `
        <div class="sk-paper" id="skPaper">
          <canvas class="sk-canvas" id="skCanvas" aria-label="Shared drawing sheet"></canvas>
        </div>
        <div class="module-toolbar">
          <span class="sk-ink" id="skInk"><i></i><span>Your ink</span></span>
          <span class="sk-inks" id="skInks" aria-label="Inks in this room"></span>
          <span class="spacer"></span>
          <span class="module-hint" id="skCount">0 lines</span>
          <button type="button" class="btn btn-outline btn-sm" id="skClear">🧽 Clear all</button>
        </div>`;

      const paper = stage.querySelector('#skPaper');
      const canvas = stage.querySelector('#skCanvas');
      const ctx = canvas.getContext('2d');
      const inkEl = stage.querySelector('#skInk');
      const inksEl = stage.querySelector('#skInks');
      const countEl = stage.querySelector('#skCount');

      let finished = [];            // [{ id, color, owner, pts:[x,y,...] }]
      const finishedIds = new Set();
      const live = new Map();       // id -> stroke in progress (mine or theirs)
      let mine = null;
      let pending = [];
      let flushTimer = null;
      let seq = 0;
      let W = 0, H = 0;

      // ---------------------------------------------------------- canvas
      function lineWidth() { return Math.max(1.6, W * 0.0045); }

      function resize() {
        const dpr = window.devicePixelRatio || 1;
        W = paper.clientWidth;
        H = paper.clientHeight;
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        redraw();
      }

      function drawFrom(stroke, fromPair) {
        const p = stroke.pts;
        const n = p.length / 2;
        if (n === 0) return;
        ctx.strokeStyle = stroke.color;
        ctx.fillStyle = stroke.color;
        ctx.lineWidth = lineWidth();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        if (n === 1) {
          ctx.beginPath();
          ctx.arc(p[0] / 10000 * W, p[1] / 10000 * H, lineWidth() / 2, 0, Math.PI * 2);
          ctx.fill();
          return;
        }
        const start = Math.max(0, fromPair - 1);
        ctx.beginPath();
        ctx.moveTo(p[start * 2] / 10000 * W, p[start * 2 + 1] / 10000 * H);
        for (let i = start + 1; i < n; i++) ctx.lineTo(p[i * 2] / 10000 * W, p[i * 2 + 1] / 10000 * H);
        ctx.stroke();
      }

      function redraw() {
        ctx.clearRect(0, 0, W, H);
        finished.forEach(s => drawFrom(s, 0));
        live.forEach(s => drawFrom(s, 0));
        countEl.textContent = `${finished.length} line${finished.length === 1 ? '' : 's'}`;
      }

      function finish(stroke) {
        live.delete(stroke.id);
        if (finishedIds.has(stroke.id) || stroke.pts.length === 0) return;
        finished.push(stroke);
        finishedIds.add(stroke.id);
        let total = finished.reduce((a, s) => a + s.pts.length, 0);
        let dropped = false;
        while (total > MAX_POINTS && finished.length > 1) {
          const old = finished.shift();
          finishedIds.delete(old.id);
          total -= old.pts.length;
          dropped = true;
        }
        if (dropped) redraw();
        countEl.textContent = `${finished.length} line${finished.length === 1 ? '' : 's'}`;
      }

      function cleanPts(arr) {
        if (!Array.isArray(arr)) return [];
        const out = [];
        for (let i = 0; i + 1 < arr.length && i < 4000; i += 2) {
          const x = arr[i], y = arr[i + 1];
          if (Number.isFinite(x) && Number.isFinite(y)) out.push(Math.round(Math.min(10000, Math.max(0, x))), Math.round(Math.min(10000, Math.max(0, y))));
        }
        return out;
      }
      const okColor = c => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c) ? c : '#888888';

      function banner(name, color) {
        paper.querySelector('.sk-banner')?.remove();
        const b = document.createElement('div');
        b.className = 'sk-banner';
        b.style.setProperty('--pc', color);
        b.innerHTML = `<i></i>${esc(name)} cleared the sheet`;
        paper.appendChild(b);
        setTimeout(() => b.remove(), 2000);
      }

      function clearAll() {
        finished = [];
        finishedIds.clear();
        live.clear();
        if (mine) { mine.pts = mine.pts.slice(-2); live.set(mine.id, mine); }
        redraw();
      }

      // ---------------------------------------------------------- input
      function point(e) {
        const r = canvas.getBoundingClientRect();
        return [
          Math.round(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * 10000),
          Math.round(Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) * 10000)
        ];
      }

      function flush() {
        if (!mine || pending.length === 0) return;
        room.send({ type: 'pts', id: mine.id, color: mine.color, pts: pending });
        pending = [];
      }

      canvas.addEventListener('pointerdown', e => {
        if (e.button !== 0) return;
        e.preventDefault();
        canvas.setPointerCapture(e.pointerId);
        const [x, y] = point(e);
        mine = { id: `${HE.clientId}-${++seq}`, color: room.me.color || '#ff5d8f', owner: room.me.id, pts: [x, y] };
        live.set(mine.id, mine);
        pending = [x, y];
        drawFrom(mine, 0);
        clearInterval(flushTimer);
        flushTimer = setInterval(flush, SEND_MS);
      });

      canvas.addEventListener('pointermove', e => {
        if (!mine) return;
        const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
        const before = mine.pts.length / 2;
        for (const ev of events) {
          const [x, y] = point(ev);
          const lx = mine.pts[mine.pts.length - 2], ly = mine.pts[mine.pts.length - 1];
          if (Math.abs(x - lx) + Math.abs(y - ly) < MIN_STEP) continue;
          mine.pts.push(x, y);
          pending.push(x, y);
        }
        if (mine.pts.length / 2 > before) drawFrom(mine, before);
      });

      function end() {
        if (!mine) return;
        clearInterval(flushTimer);
        flush();
        room.send({ type: 'end', id: mine.id });
        finish(mine);
        mine = null;
      }
      canvas.addEventListener('pointerup', end);
      canvas.addEventListener('pointercancel', end);

      stage.querySelector('#skClear').addEventListener('click', () => {
        clearAll();
        banner(room.me.name, room.me.color);
        room.send({ type: 'clear', name: room.me.name, color: room.me.color });
      });

      // ----------------------------------------------------------- room
      function updateInks() {
        inkEl.style.setProperty('--pc', room.me.color);
        inksEl.innerHTML = [...room.peers.values()]
          .map(p => `<span style="--pc:${esc(p.color)}" title="${esc(p.name)}"></span>`).join('');
      }

      const room = HE.connect('sketch', {
        onWelcome() { updateInks(); },
        onJoin: updateInks,
        onLeave(peer) {
          // A line left half-drawn by someone who left is kept as finished.
          live.forEach(s => { if (s.owner === peer.id) finish(s); });
          updateInks();
        },
        getSnapshot() { return { strokes: finished }; },
        onSnapshot(data) {
          if (!data || !Array.isArray(data.strokes)) return;
          const incoming = data.strokes
            .filter(s => s && typeof s.id === 'string' && !finishedIds.has(s.id))
            .map(s => ({ id: s.id.slice(0, 64), color: okColor(s.color), owner: s.owner, pts: cleanPts(s.pts) }));
          incoming.forEach(s => finishedIds.add(s.id));
          finished = incoming.concat(finished);
          redraw();
          if (incoming.length) HE.toast(`Received ${incoming.length} finished line${incoming.length === 1 ? '' : 's'}.`, '✏️');
        },
        onMessage(d, peer) {
          if (!d) return;
          if (d.type === 'pts' && typeof d.id === 'string') {
            if (finishedIds.has(d.id)) return;
            let s = live.get(d.id);
            if (!s) { s = { id: d.id.slice(0, 64), color: okColor(d.color), owner: peer.id, pts: [] }; live.set(s.id, s); }
            const add = cleanPts(d.pts);
            const before = s.pts.length / 2;
            s.pts.push(...add);
            drawFrom(s, before);
          } else if (d.type === 'end') {
            const s = live.get(d.id);
            if (s) finish(s);
          } else if (d.type === 'clear') {
            clearAll();
            banner(String(d.name || peer.name).slice(0, 24), okColor(d.color || peer.color));
          }
        }
      });

      new ResizeObserver(resize).observe(paper);
      resize();
      updateInks();
      return room;
    }
  });
})();
