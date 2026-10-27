/**
 * Module 1 — Letter Stamp Board
 * A letter sits in the middle. Click to leave a stamp (kept) or an emote (one-time event).
 */
(function () {
  'use strict';
  const { esc } = HE;

  const PICS = [
    { k: 'hug', icon: '🫂', label: 'Hug' },
    { k: 'heart', icon: '💖', label: 'Love' },
    { k: 'moved', icon: '🥹', label: 'Moved' },
    { k: 'star', icon: '⭐', label: 'Star' },
    { k: 'question', icon: '❓', label: 'Question' }
  ];
  const ICON = Object.fromEntries(PICS.map(p => [p.k, p.icon]));
  const MAX_STAMPS = 300;

  const CATEGORIES = {
    comfort: '🌸 Comfort', gratitude: '💛 Gratitude', encouragement: '✨ Courage',
    love: '💌 Love', reflection: '🍃 Reflection'
  };
  const LETTER_STAMPS = {
    cute: { dove: '🕊️', heart: '💖', flower: '🌸', star: '⭐', coffee: '☕' },
    vintage: { dove: '📜', heart: '🩸', flower: '🌿', star: '⚜️', coffee: '🖋️' },
    futuristic: { dove: '⚡', heart: '💎', flower: '💠', star: '🌌', coffee: '🛰️' }
  };

  // The main room always shows the same letter, so every device agrees on what is in the middle.
  const FEATURED = {
    id: 'mock-1',
    recipient: 'To anyone who feels invisible today',
    category: 'comfort',
    message: 'In case no one told you this morning: your existence matters. The way you hold the door for strangers, the soft kindness in your quiet eyes, the bravery it takes for you to get out of bed on days the world feels heavy. You don\'t have to be loud to leave a mark on this universe. Rest if you must, but don\'t give up. Someone is cheering for you from across the ether.',
    sender: 'A fellow traveler',
    stamp: 'dove'
  };

  function findLocalLetter(roomId) {
    if (roomId === 'main') return FEATURED;
    try {
      const list = JSON.parse(localStorage.getItem('heartecho_letters') || '[]');
      const l = list.find(x => x.id === roomId);
      if (l) return { id: l.id, recipient: l.recipient, category: l.category, message: l.message, sender: l.sender, stamp: l.stamp };
    } catch {}
    // Letters written by someone (user-…) wait for their owner; any other room shows the featured letter.
    return /^user-/.test(roomId) ? null : FEATURED;
  }

  function cleanLetter(l) {
    if (!l || typeof l !== 'object') return null;
    const s = (v, n) => String(v ?? '').slice(0, n);
    return { id: s(l.id, 64), recipient: s(l.recipient, 80), category: s(l.category, 20), message: s(l.message, 1000), sender: s(l.sender, 40), stamp: s(l.stamp, 12) };
  }

  function hashRot(id) {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
    return ((Math.abs(h) % 25) - 12);
  }

  HE.defineModule('stamps', {
    title: 'Letter Stamp Board',
    badge: '🫂 React together',
    tagline: 'A stamp stays where you leave it. An emote floats up and fades.',
    source: {
      name: 'FigJam — Stamps & Emotes',
      text: 'FigJam has two ways to react: a stamp stays on the board, and an emote floats up for a moment and then disappears. Here the canvas holds one letter instead of a design file. The stamp marks the line that moved you, and the emote is a passing sigh.'
    },
    rules: [
      'Stamp positions are sent as fractions of the letter’s size (0–1 inside the letter), so a stamp lands on the same line on every screen.',
      'A stamp is sent once, with its picture, the stamper’s name and color. Every screen keeps it; the board keeps the latest 300.',
      'An emote is a single event. Nobody stores it.',
      'When you join, the person who has been in the room longest hands you every stamp. Emotes sent before you arrived are gone for good.',
      '“Clear my stamps” removes the stamps made in this tab, on every screen.'
    ],
    howto: [
      'Pick a picture, then click anywhere on the board.',
      'Shift + click stamps in the other mode (stamp ⇄ emote).',
      'Keys 1–5 pick a picture.',
      'From any letter on the wall: “Read together” opens a room for that letter.'
    ],

    mount(stage) {
      stage.innerHTML = `
        <div class="sb-board" id="sbBoard">
          <article class="sb-letter" id="sbLetter" aria-live="polite"></article>
          <div class="sb-layer" id="sbLayer"></div>
        </div>
        <div class="module-toolbar">
          <div class="sb-pics" role="radiogroup" aria-label="Pictures">
            ${PICS.map((p, i) => `<button type="button" class="sb-pic${i === 0 ? ' active' : ''}" data-k="${p.k}" aria-label="${p.label}" title="${p.label} (${i + 1})">${p.icon}<kbd>${i + 1}</kbd></button>`).join('')}
          </div>
          <button type="button" class="mode-toggle" id="sbMode" aria-label="Switch between stamp and emote">
            <span data-mode="stamp" class="on">Stamp</span><span data-mode="emote">Emote</span>
          </button>
          <span class="spacer"></span>
          <button type="button" class="btn btn-ghost btn-sm" id="sbClear">🧽 Clear my stamps</button>
        </div>
        <p class="module-hint" style="margin-top:.5rem">Click = <span id="sbHintMode">stamp</span> · Shift + click = <span id="sbHintOther">emote</span></p>`;

      const board = stage.querySelector('#sbBoard');
      const letterEl = stage.querySelector('#sbLetter');
      const layer = stage.querySelector('#sbLayer');
      const modeBtn = stage.querySelector('#sbMode');

      const stamps = new Map();   // id -> stamp
      const els = new Map();      // id -> element
      let seq = 0;
      let pic = 'hug';
      let mode = 'stamp';
      let letter = findLocalLetter(HE.params.get('r') || 'main');
      let letterFromHere = !!letter;
      let firstSnapshot = true;

      // ---------------------------------------------------------- letter
      function renderLetter() {
        const theme = HE.currentTheme();
        if (!letter) {
          letterEl.classList.add('is-waiting');
          letterEl.innerHTML = `
            <div class="sb-letter-top"><span class="sb-letter-stamp">✉️</span></div>
            <h3 class="sb-letter-to">A letter is on its way…</h3>
            <p class="sb-letter-body">This letter was written on another device. It appears the moment someone who has it is in the room.</p>`;
          return;
        }
        letterEl.classList.remove('is-waiting');
        const st = (LETTER_STAMPS[theme] || LETTER_STAMPS.cute)[letter.stamp] || '🕊️';
        letterEl.innerHTML = `
          <div class="sb-letter-top">
            <span class="sb-letter-stamp">${st}</span>
            <span class="sb-letter-cat">${esc(CATEGORIES[letter.category] || '💌 Letter')}</span>
          </div>
          <h3 class="sb-letter-to">${esc(letter.recipient)}</h3>
          <p class="sb-letter-body">${esc(letter.message)}</p>
          <div class="sb-letter-from">— ${esc(letter.sender || 'A quiet friend')}</div>`;
      }

      // ----------------------------------------------------- geometry
      function toRatio(clientX, clientY) {
        const r = letterEl.getBoundingClientRect();
        return {
          x: Math.round(((clientX - r.left) / r.width) * 10000) / 10000,
          y: Math.round(((clientY - r.top) / r.height) * 10000) / 10000
        };
      }
      function toBoard(x, y) {
        return {
          left: letterEl.offsetLeft + x * letterEl.offsetWidth,
          top: letterEl.offsetTop + y * letterEl.offsetHeight
        };
      }
      function place(el, s) {
        const p = toBoard(s.x, s.y);
        el.style.left = p.left + 'px';
        el.style.top = p.top + 'px';
      }

      // -------------------------------------------------------- stamps
      function validStamp(s) {
        return s && typeof s.id === 'string' && ICON[s.k] && Number.isFinite(s.x) && Number.isFinite(s.y);
      }

      function addStamp(s) {
        if (!validStamp(s) || stamps.has(s.id)) return;
        s.name = String(s.name || 'Someone').slice(0, 24);
        stamps.set(s.id, s);
        const el = document.createElement('div');
        el.className = 'sb-stamp';
        el.style.setProperty('--pc', s.color || '#999');
        el.style.setProperty('--rot', hashRot(s.id) + 'deg');
        el.innerHTML = `<span class="sb-stamp-pic"><span>${ICON[s.k]}</span></span><span class="sb-tag">${esc(s.name)}</span>`;
        place(el, s);
        layer.appendChild(el);
        els.set(s.id, el);
        trim();
      }

      function removeStamp(id) {
        stamps.delete(id);
        els.get(id)?.remove();
        els.delete(id);
      }

      function trim() {
        if (stamps.size <= MAX_STAMPS) return;
        const sorted = [...stamps.values()].sort((a, b) => a.ts - b.ts);
        sorted.slice(0, stamps.size - MAX_STAMPS).forEach(s => removeStamp(s.id));
      }

      function showEmote(e) {
        if (!ICON[e.k] || !Number.isFinite(e.x) || !Number.isFinite(e.y)) return;
        const el = document.createElement('div');
        el.className = 'sb-emote';
        el.style.setProperty('--pc', e.color || '#999');
        el.innerHTML = `<span class="sb-emote-pic">${ICON[e.k]}</span><span class="sb-tag">${esc(String(e.name || '').slice(0, 24))}</span>`;
        place(el, e);
        layer.appendChild(el);
        setTimeout(() => el.remove(), 2000);
      }

      function notice(text) {
        const n = document.createElement('div');
        n.className = 'sb-notice';
        n.textContent = text;
        board.appendChild(n);
        setTimeout(() => n.remove(), 6000);
      }

      // --------------------------------------------------------- room
      const room = HE.connect('stamps', {
        onWelcome(me, reconnect) {
          if (reconnect) {
            // Hand over anything we made while offline; receivers skip ids they already have.
            const mine = [...stamps.values()].filter(s => s.by === HE.clientId);
            if (mine.length) room.send({ type: 'merge', stamps: mine });
          }
        },
        getSnapshot() {
          return { letter: letterFromHere || letter ? letter : null, stamps: [...stamps.values()] };
        },
        onSnapshot(data) {
          const list = Array.isArray(data?.stamps) ? data.stamps.slice(-MAX_STAMPS) : [];
          list.forEach(addStamp);
          if (!letter && data?.letter) { letter = cleanLetter(data.letter); renderLetter(); relayout(); }
          else if (letter && !data?.letter) room.send({ type: 'letter', letter });
          if (firstSnapshot) {
            notice(`Received ${list.length} stamp${list.length === 1 ? '' : 's'}. Emotes sent before you joined were not delivered.`);
            firstSnapshot = false;
          }
        },
        onMessage(d) {
          if (!d) return;
          if (d.type === 'stamp') addStamp(d.s);
          else if (d.type === 'emote') showEmote(d);
          else if (d.type === 'clear') [...stamps.values()].filter(s => s.by === d.by).forEach(s => removeStamp(s.id));
          else if (d.type === 'merge' && Array.isArray(d.stamps)) d.stamps.slice(-MAX_STAMPS).forEach(addStamp);
          else if (d.type === 'letter' && !letter) { letter = cleanLetter(d.letter); renderLetter(); relayout(); }
        }
      });

      // ------------------------------------------------------- input
      function setPic(k) {
        pic = k;
        stage.querySelectorAll('.sb-pic').forEach(b => b.classList.toggle('active', b.dataset.k === k));
      }
      function setMode(m) {
        mode = m;
        modeBtn.querySelectorAll('span').forEach(s => s.classList.toggle('on', s.dataset.mode === m));
        stage.querySelector('#sbHintMode').textContent = m;
        stage.querySelector('#sbHintOther').textContent = m === 'stamp' ? 'emote' : 'stamp';
      }

      stage.querySelectorAll('.sb-pic').forEach(b => b.addEventListener('click', () => setPic(b.dataset.k)));
      modeBtn.addEventListener('click', () => setMode(mode === 'stamp' ? 'emote' : 'stamp'));
      document.addEventListener('keydown', e => {
        if (e.target.closest('input, textarea')) return;
        const i = Number(e.key) - 1;
        if (i >= 0 && i < PICS.length) setPic(PICS[i].k);
      });

      board.addEventListener('click', e => {
        const { x, y } = toRatio(e.clientX, e.clientY);
        const asStamp = (mode === 'stamp') !== e.shiftKey;
        const me = room.me;
        if (asStamp) {
          const s = { id: `${HE.clientId}-${++seq}`, k: pic, x, y, name: me.name, color: me.color, by: HE.clientId, ts: Date.now() };
          addStamp(s);
          room.send({ type: 'stamp', s });
        } else {
          const ev = { type: 'emote', k: pic, x, y, name: me.name, color: me.color };
          showEmote(ev);
          room.send(ev);
        }
      });

      stage.querySelector('#sbClear').addEventListener('click', () => {
        const mine = [...stamps.values()].filter(s => s.by === HE.clientId);
        mine.forEach(s => removeStamp(s.id));
        room.send({ type: 'clear', by: HE.clientId });
        HE.toast(mine.length ? `Cleared ${mine.length} of your stamps.` : 'You have no stamps here yet.', '🧽');
      });

      function relayout() { stamps.forEach((s, id) => place(els.get(id), s)); }
      new ResizeObserver(relayout).observe(board);
      window.addEventListener('he-theme', () => { renderLetter(); requestAnimationFrame(relayout); });

      renderLetter();
      return room;
    }
  });
})();
