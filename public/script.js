/**
 * HeartEcho — Core Application Logic
 * Supporting 3 Themes (Cute & Bright with Dove, Vintage Parchment, Futuristic Cyber-Holo)
 * Features: Mock Letters, LocalStorage, Writing Desk, Delete Confirmation, Heart Likes,
 * Search, Filters, Sorting, Web Audio Synthesizer, and Interactive Modals.
 */

// ---------------------------------------------------------------------------
// 1. Initial Mock Letters (Heartfelt, Varied, High-Quality Content)
// ---------------------------------------------------------------------------
const DEFAULT_MOCK_LETTERS = [
  {
    id: 'mock-1',
    recipient: 'To anyone who feels invisible today',
    category: 'comfort',
    message: 'In case no one told you this morning: your existence matters. The way you hold the door for strangers, the soft kindness in your quiet eyes, the bravery it takes for you to get out of bed on days the world feels heavy. You don\'t have to be loud to leave a mark on this universe. Rest if you must, but don\'t give up. Someone is cheering for you from across the ether.',
    sender: 'A fellow traveler',
    stamp: 'dove',
    date: 'Sep 22, 2026',
    timestamp: Date.now() - 3600000 * 2, // 2 hours ago
    likes: 42,
    hugs: 14
  },
  {
    id: 'mock-2',
    recipient: 'To the kind barista who noticed I was crying',
    category: 'gratitude',
    message: 'Last Tuesday at 7:30 AM, my hands were shaking and I couldn\'t stop tears from escaping behind my sunglasses. You didn\'t ask awkward questions. You just drew a little smiling sunshine on my oat vanilla latte lid and whispered, "On the house today. You\'ve got this." I walked to my bench and cried relief instead of despair. You saved my whole week.',
    sender: 'The girl in the oversized coat',
    stamp: 'coffee',
    date: 'Sep 21, 2026',
    timestamp: Date.now() - 3600000 * 26,
    likes: 68,
    hugs: 25
  },
  {
    id: 'mock-3',
    recipient: 'To my younger self when everything felt too heavy',
    category: 'reflection',
    message: 'Hey little dreamer. I know right now you are staring out of your bedroom window wondering if you will ever belong, or if the ache in your chest ever quiets down. I promise you: it does. You will see cities you only read about in library books. You will find people who love your laugh and don\'t make you feel like too much. Keep holding on. It gets so beautiful.',
    sender: 'Your future self, smiling',
    stamp: 'star',
    date: 'Sep 20, 2026',
    timestamp: Date.now() - 3600000 * 48,
    likes: 95,
    hugs: 37
  },
  {
    id: 'mock-4',
    recipient: 'To a stranger studying late at the library',
    category: 'encouragement',
    message: 'I saw you sitting with two empty mugs of coffee and stacks of highlighted notes at 11 PM. You rubbed your temples with that look of sheer exhaustion. I just wanted to leave this note on your table: whatever exam, interview, or milestone you are fighting for, your worth is not defined by a test score. Take a sip of water, unclamp your jaw, and give yourself credit for trying so hard.',
    sender: 'The person in the green cardigan',
    stamp: 'flower',
    date: 'Sep 19, 2026',
    timestamp: Date.now() - 3600000 * 72,
    likes: 34,
    hugs: 11
  },
  {
    id: 'mock-5',
    recipient: 'To my mother, for all the quiet sacrifices',
    category: 'love',
    message: 'Growing up, I never noticed how you always took the smallest portion at dinner so we could have seconds. Or how you mended your worn-out winter coat three years in a row just so I could get the shoes I wanted for school. Now that I am an adult navigating this world, I see every ounce of your silent love. Thank you for being my warmest shelter.',
    sender: 'Your forever grateful child',
    stamp: 'heart',
    date: 'Sep 18, 2026',
    timestamp: Date.now() - 3600000 * 96,
    likes: 81,
    hugs: 29
  },
  {
    id: 'mock-6',
    recipient: 'To the dreamer holding onto a silent wish',
    category: 'encouragement',
    message: 'The world might tell you to be practical, to stay in line, to tame the fire inside your ribs. But the wildest ideas often build the warmest realities. Don\'t bury your dream just because others don\'t have the vision to see it yet. One day you will look back at this exact moment and be thankful you didn\'t quit.',
    sender: 'A believer in impossible things',
    stamp: 'dove',
    date: 'Sep 17, 2026',
    timestamp: Date.now() - 3600000 * 120,
    likes: 53,
    hugs: 19
  }
];

// ---------------------------------------------------------------------------
// 2. Application State Management
// ---------------------------------------------------------------------------
const state = {
  letters: [],
  likedIds: new Set(),
  currentTheme: 'cute',
  activeFilter: 'all',
  searchQuery: '',
  sortBy: 'newest',
  selectedStamp: 'dove',
  letterToDeleteId: null,
  activeModalLetter: null,
  audioEnabled: true
};

// Category Configuration (Names, Icons, Theme-Specific Display)
const CATEGORIES = {
  comfort: { label: 'Comfort & Healing', icon: '🌸', short: 'Comfort' },
  gratitude: { label: 'Gratitude & Thanks', icon: '💛', short: 'Gratitude' },
  encouragement: { label: 'Hope & Courage', icon: '✨', short: 'Courage' },
  love: { label: 'Love & Friendship', icon: '💌', short: 'Love' },
  reflection: { label: 'Quiet Reflection', icon: '🍃', short: 'Reflection' }
};

// Stamp Configuration per Theme
const STAMP_CONFIG = {
  cute: {
    dove: { icon: '🕊️', name: 'Dove Peace' },
    heart: { icon: '💖', name: 'Warm Heart' },
    flower: { icon: '🌸', name: 'Gentle Bloom' },
    star: { icon: '⭐', name: 'Night Star' },
    coffee: { icon: '☕', name: 'Cozy Cup' }
  },
  vintage: {
    dove: { icon: '📜', name: 'Royal Seal' },
    heart: { icon: '🩸', name: 'Wax Crest' },
    flower: { icon: '🌿', name: 'Botanical' },
    star: { icon: '⚜️', name: 'Fleur-de-lis' },
    coffee: { icon: '🖋️', name: 'Postal Mark' }
  },
  futuristic: {
    dove: { icon: '⚡', name: 'Quantum Core' },
    heart: { icon: '💎', name: 'Pulse Node' },
    flower: { icon: '💠', name: 'Data Crystal' },
    star: { icon: '🌌', name: 'Void Beacon' },
    coffee: { icon: '🛰️', name: 'Orbital Pod' }
  }
};

// ---------------------------------------------------------------------------
// 3. Web Audio API Tactile Sound Engine (Zero external dependencies)
// ---------------------------------------------------------------------------
class SoundSynth {
  constructor() {
    this.ctx = null;
  }

  init() {
    if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playPop() {
    if (!state.audioEnabled) return;
    this.init();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(780, now + 0.12);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.15);
  }

  playFoldSend() {
    if (!state.audioEnabled) return;
    this.init();
    if (!this.ctx) return;

    // Harmonic warm sweep resembling paper glide
    const now = this.ctx.currentTime;
    const notes = [440, 554.37, 659.25, 880];
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const delay = idx * 0.04;

      osc.type = state.currentTheme === 'futuristic' ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(freq, now + delay);

      gain.gain.setValueAtTime(0.08, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.25);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now + delay);
      osc.stop(now + delay + 0.28);
    });
  }

  playDelete() {
    if (!state.audioEnabled) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.15);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.17);
  }

  playThemeSwitch(theme) {
    if (!state.audioEnabled) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    if (theme === 'cute') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.setValueAtTime(659.25, now + 0.08);
      osc.frequency.setValueAtTime(783.99, now + 0.16);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.32);
    } else if (theme === 'vintage') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(261.63, now);
      osc.frequency.setValueAtTime(392.00, now + 0.1);
      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.38);
    } else {
      // Futuristic cyber sweep
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(1200, now + 0.22);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.26);
    }

    osc.connect(gain);
    gain.connect(this.ctx.destination);
  }
}

const soundSynth = new SoundSynth();

// ---------------------------------------------------------------------------
// 4. Storage & Persistence
// ---------------------------------------------------------------------------
function loadStoredData() {
  // 1. Letters
  try {
    const rawLetters = localStorage.getItem('heartecho_letters');
    if (rawLetters) {
      state.letters = JSON.parse(rawLetters);
    } else {
      state.letters = [...DEFAULT_MOCK_LETTERS];
      saveLetters();
    }
  } catch (e) {
    console.warn('Storage read fallback:', e);
    state.letters = [...DEFAULT_MOCK_LETTERS];
  }

  // 2. Liked letters
  try {
    const rawLikes = localStorage.getItem('heartecho_liked');
    if (rawLikes) {
      state.likedIds = new Set(JSON.parse(rawLikes));
    }
  } catch (e) {
    state.likedIds = new Set();
  }

  // 3. Theme
  try {
    const savedTheme = localStorage.getItem('heartecho_theme');
    if (savedTheme && ['cute', 'vintage', 'futuristic'].includes(savedTheme)) {
      state.currentTheme = savedTheme;
    }
  } catch (e) {
    state.currentTheme = 'cute';
  }

  // 4. Audio
  try {
    const savedAudio = localStorage.getItem('heartecho_audio');
    if (savedAudio !== null) {
      state.audioEnabled = savedAudio === 'true';
    }
  } catch (e) {}
}

function saveLetters() {
  try {
    localStorage.setItem('heartecho_letters', JSON.stringify(state.letters));
  } catch (e) {
    console.error('Failed to save letters:', e);
  }
}

function saveLikes() {
  try {
    localStorage.setItem('heartecho_liked', JSON.stringify(Array.from(state.likedIds)));
  } catch (e) {
    console.error('Failed to save likes:', e);
  }
}

// ---------------------------------------------------------------------------
// 5. Theme Switching Engine
// ---------------------------------------------------------------------------
function applyTheme(themeName, playSound = false) {
  if (!['cute', 'vintage', 'futuristic'].includes(themeName)) return;

  state.currentTheme = themeName;
  document.documentElement.setAttribute('data-theme', themeName);
  localStorage.setItem('heartecho_theme', themeName);

  // Update theme buttons active state in header
  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.themeChoice === themeName);
  });

  // Dynamic branding updates
  const logoIcon = document.getElementById('logoIcon');
  const logoTitle = document.getElementById('logoTitle');
  const logoSubtitle = document.getElementById('logoSubtitle');
  const heroBadgeText = document.getElementById('heroBadgeText');
  const heroTitle = document.getElementById('heroTitle');
  const composerBadge = document.getElementById('composerBadge');
  const paperWatermark = document.getElementById('paperWatermark');
  const wallBadge = document.getElementById('wallBadge');
  const togetherBadge = document.getElementById('togetherBadge');
  const togetherNavLabel = document.getElementById('togetherNavLabel');

  if (themeName === 'cute') {
    logoIcon.textContent = '🕊️';
    logoTitle.textContent = 'HeartEcho';
    logoSubtitle.textContent = 'Letters to the World';
    heroBadgeText.textContent = 'A safe, tender harbor for kind words';
    heroTitle.textContent = 'Leave a gentle whisper for someone who needs it today.';
    composerBadge.textContent = '🕊️ The Writing Desk';
    paperWatermark.textContent = 'HeartEcho Dove Stationery';
    wallBadge.textContent = '📬 Community Letters';
    if (togetherBadge) togetherBadge.textContent = '💞 Together, live';
    if (togetherNavLabel) togetherNavLabel.textContent = 'Together';
  } else if (themeName === 'vintage') {
    logoIcon.textContent = '📜';
    logoTitle.textContent = 'HeartEcho Gazette';
    logoSubtitle.textContent = 'Chronicles of Kindness';
    heroBadgeText.textContent = 'Est. 1892 • Antique Postal Archives';
    heroTitle.textContent = 'Words inscribed with tenderness outlive the passage of time.';
    composerBadge.textContent = '🖋️ The Antiquarian Desk';
    paperWatermark.textContent = 'Fine Vellum • Cold Pressed';
    wallBadge.textContent = '📯 The Public Dispatch';
    if (togetherBadge) togetherBadge.textContent = '🕯️ The Parlour';
    if (togetherNavLabel) togetherNavLabel.textContent = 'Parlour';
  } else if (themeName === 'futuristic') {
    logoIcon.textContent = '🚀';
    logoTitle.textContent = 'HEART//ECHO';
    logoSubtitle.textContent = 'Interstellar Memory Capsule';
    heroBadgeText.textContent = 'Quantum Warmth Transmission [ONLINE]';
    heroTitle.textContent = 'Broadcast heartfelt light across the endless digital cosmos.';
    composerBadge.textContent = '⚡ Quantum Transmitter';
    paperWatermark.textContent = 'DATA-CAPSULE // ENCRYPTED LIGHT';
    wallBadge.textContent = '📡 Global Transmission Feed';
    if (togetherBadge) togetherBadge.textContent = '📡 SYNC//DECK';
    if (togetherNavLabel) togetherNavLabel.textContent = 'Sync';
  }

  // Update stamp selector options for active theme
  renderStampOptions();

  // Re-render letters so card stamps and badges update to match the active theme
  renderLettersGrid();

  if (playSound) {
    soundSynth.playThemeSwitch(themeName);
    showToast(`Style switched to ${themeName.toUpperCase()} mood! ✨`);
  }
}

function renderStampOptions() {
  const container = document.getElementById('stampOptions');
  if (!container) return;

  const currentThemeStamps = STAMP_CONFIG[state.currentTheme] || STAMP_CONFIG.cute;
  container.innerHTML = Object.entries(currentThemeStamps).map(([key, info]) => {
    const isActive = state.selectedStamp === key ? 'active' : '';
    return `
      <button type="button" class="stamp-btn ${isActive}" data-stamp="${key}" aria-label="${info.name}">
        <span class="stamp-icon">${info.icon}</span>
        <span class="stamp-name">${info.name}</span>
      </button>
    `;
  }).join('');

  // Re-bind click handlers
  container.querySelectorAll('.stamp-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      soundSynth.playPop();
      state.selectedStamp = btn.dataset.stamp;
      container.querySelectorAll('.stamp-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
}

// ---------------------------------------------------------------------------
// 6. Letters Feed & Rendering
// ---------------------------------------------------------------------------
function getFilteredAndSortedLetters() {
  let list = [...state.letters];

  // 1. Filter by category
  if (state.activeFilter !== 'all') {
    list = list.filter(item => item.category === state.activeFilter);
  }

  // 2. Filter by search query
  if (state.searchQuery.trim()) {
    const q = state.searchQuery.toLowerCase().trim();
    list = list.filter(item => 
      item.recipient.toLowerCase().includes(q) ||
      item.message.toLowerCase().includes(q) ||
      item.sender.toLowerCase().includes(q)
    );
  }

  // 3. Sorting
  if (state.sortBy === 'newest') {
    list.sort((a, b) => b.timestamp - a.timestamp);
  } else if (state.sortBy === 'popular') {
    list.sort((a, b) => b.likes - a.likes);
  } else if (state.sortBy === 'oldest') {
    list.sort((a, b) => a.timestamp - b.timestamp);
  }

  return list;
}

function renderLettersGrid() {
  const grid = document.getElementById('lettersGrid');
  const emptyState = document.getElementById('emptyState');
  const countAll = document.getElementById('countAll');
  if (!grid) return;

  const filteredLetters = getFilteredAndSortedLetters();

  // Update total count
  if (countAll) countAll.textContent = state.letters.length;
  updateStatsMetrics();

  if (filteredLetters.length === 0) {
    grid.innerHTML = '';
    if (emptyState) emptyState.classList.remove('hidden');
    return;
  }

  if (emptyState) emptyState.classList.add('hidden');

  const themeStamps = STAMP_CONFIG[state.currentTheme] || STAMP_CONFIG.cute;

  grid.innerHTML = filteredLetters.map(letter => {
    const cat = CATEGORIES[letter.category] || { label: letter.category, icon: '💌', short: letter.category };
    const stampInfo = themeStamps[letter.stamp] || { icon: '🕊️', name: 'Stamp' };
    const isLiked = state.likedIds.has(letter.id);
    const likeBtnClass = isLiked ? 'hearted' : '';

    return `
      <article class="letter-card" data-letter-id="${letter.id}">
        <div class="card-header-row">
          <div class="card-stamp-badge" title="${stampInfo.name}">
            <span>${stampInfo.icon}</span>
          </div>
          <div class="card-meta-tags">
            <span class="card-category-tag">${cat.icon} ${cat.short}</span>
            <span class="card-date">${letter.date}</span>
          </div>
        </div>

        <div class="card-body" onclick="openLetterModal('${letter.id}')">
          <h3 class="card-recipient">${escapeHtml(letter.recipient)}</h3>
          <p class="card-message-snippet">${escapeHtml(letter.message)}</p>
          <div class="card-sender-signoff">— ${escapeHtml(letter.sender || 'A quiet friend')}</div>
        </div>

        <div class="card-actions-row">
          <div class="card-actions-left">
            <button 
              type="button" 
              class="btn-card-action btn-card-heart ${likeBtnClass}" 
              data-heart-id="${letter.id}" 
              title="Give warmth / heart"
              aria-label="Give heart to this letter"
            >
              <span class="heart-icon">${isLiked ? '❤️' : '🤍'}</span>
              <span class="heart-count">${letter.likes}</span>
            </button>
            <button 
              type="button" 
              class="btn-card-action btn-card-delete" 
              data-delete-id="${letter.id}" 
              title="Delete this letter"
              aria-label="Delete this letter"
            >
              <span class="delete-icon">🗑️</span>
            </button>
          </div>

          <span class="read-more-link" onclick="openLetterModal('${letter.id}')">
            Read Full <span>→</span>
          </span>
        </div>
      </article>
    `;
  }).join('');

  // Attach event listeners for heart buttons
  grid.querySelectorAll('[data-heart-id]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.heartId;
      toggleHeartLetter(id);
    });
  });

  // Attach event listeners for delete buttons
  grid.querySelectorAll('[data-delete-id]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.deleteId;
      promptDeleteLetter(id);
    });
  });
}

function updateStatsMetrics() {
  const lettersCountEl = document.getElementById('statLettersCount');
  const smilesCountEl = document.getElementById('statSmilesCount');

  if (lettersCountEl) {
    const totalDelivered = 1420 + state.letters.length;
    lettersCountEl.textContent = totalDelivered.toLocaleString();
  }

  if (smilesCountEl) {
    const totalLikes = state.letters.reduce((acc, curr) => acc + (curr.likes || 0), 9800);
    smilesCountEl.textContent = totalLikes.toLocaleString();
  }
}

// ---------------------------------------------------------------------------
// 7. Interactive Letter Actions (Heart, Delete, Compose)
// ---------------------------------------------------------------------------
function toggleHeartLetter(id) {
  const letter = state.letters.find(l => l.id === id);
  if (!letter) return;

  soundSynth.playPop();

  if (state.likedIds.has(id)) {
    state.likedIds.delete(id);
    letter.likes = Math.max(0, letter.likes - 1);
  } else {
    state.likedIds.add(id);
    letter.likes += 1;
    showToast('Sent a warm heart! ❤️');
  }

  saveLikes();
  saveLetters();
  renderLettersGrid();
}

function promptDeleteLetter(id) {
  const letter = state.letters.find(l => l.id === id);
  if (!letter) return;

  state.letterToDeleteId = id;
  const modal = document.getElementById('deleteModalBackdrop');
  if (modal) {
    modal.classList.remove('hidden');
    soundSynth.playPop();
  }
}

function executeDeleteLetter() {
  if (!state.letterToDeleteId) return;

  const id = state.letterToDeleteId;
  state.letters = state.letters.filter(l => l.id !== id);
  state.likedIds.delete(id);

  saveLetters();
  saveLikes();
  soundSynth.playDelete();
  renderLettersGrid();
  closeDeleteModal();
  showToast('Letter removed from the public wall. 🕊️');
}

function closeDeleteModal() {
  state.letterToDeleteId = null;
  const modal = document.getElementById('deleteModalBackdrop');
  if (modal) modal.classList.add('hidden');
}

// ---------------------------------------------------------------------------
// 8. Letter Writing & Submission
// ---------------------------------------------------------------------------
function handleLetterSubmit(e) {
  e.preventDefault();

  const recipientInput = document.getElementById('recipientInput');
  const categorySelect = document.getElementById('categorySelect');
  const messageInput = document.getElementById('messageInput');
  const senderInput = document.getElementById('senderInput');

  const recipient = recipientInput.value.trim();
  const category = categorySelect.value;
  const message = messageInput.value.trim();
  const sender = senderInput.value.trim() || 'A quiet friend';

  if (!recipient || !message) {
    showToast('Please fill in both the recipient and your message! 💌');
    return;
  }

  const today = new Date();
  const formattedDate = today.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  const newLetter = {
    id: 'user-' + Date.now(),
    recipient: recipient,
    category: category,
    message: message,
    sender: sender,
    stamp: state.selectedStamp || 'dove',
    date: formattedDate,
    timestamp: Date.now(),
    likes: 1, // Automatically receives sender's warmth
    hugs: 0
  };

  // Add new letter to top of feed
  state.letters.unshift(newLetter);
  state.likedIds.add(newLetter.id); // Creator hearts it by default
  saveLetters();
  saveLikes();

  soundSynth.playFoldSend();
  showToast('Your letter took flight and is posted on the homepage! 🕊️');

  // Reset form
  recipientInput.value = '';
  messageInput.value = '';
  document.getElementById('charCount').textContent = '0 / 1000 characters';

  // Smooth scroll to the newly posted letter on the wall
  renderLettersGrid();
  const wallEl = document.getElementById('lettersWall');
  if (wallEl) {
    wallEl.scrollIntoView({ behavior: 'smooth' });
  }
}

// ---------------------------------------------------------------------------
// 9. Full Reading Modal & Surprise Me
// ---------------------------------------------------------------------------
function openLetterModal(id) {
  const letter = state.letters.find(l => l.id === id);
  if (!letter) return;

  state.activeModalLetter = letter;
  soundSynth.playPop();

  const modal = document.getElementById('letterModalBackdrop');
  const modalRecipient = document.getElementById('modalRecipient');
  const modalContent = document.getElementById('modalContent');
  const modalSender = document.getElementById('modalSender');
  const modalCategoryTag = document.getElementById('modalCategoryTag');
  const modalDate = document.getElementById('modalDate');
  const modalStamp = document.getElementById('modalStamp');
  const modalHugCount = document.getElementById('modalHugCount');

  const cat = CATEGORIES[letter.category] || { label: letter.category, icon: '💌', short: letter.category };
  const themeStamps = STAMP_CONFIG[state.currentTheme] || STAMP_CONFIG.cute;
  const stampInfo = themeStamps[letter.stamp] || { icon: '🕊️', name: 'Stamp' };

  modalRecipient.textContent = `To: ${letter.recipient}`;
  modalContent.textContent = letter.message;
  modalSender.textContent = `— ${letter.sender || 'A quiet friend'}`;
  modalCategoryTag.textContent = `${cat.icon} ${cat.label}`;
  modalDate.textContent = letter.date;
  modalStamp.textContent = stampInfo.icon;
  modalHugCount.textContent = letter.hugs || 0;

  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeLetterModal() {
  state.activeModalLetter = null;
  const modal = document.getElementById('letterModalBackdrop');
  if (modal) modal.classList.add('hidden');
  document.body.style.overflow = '';
}

function sendVirtualHug() {
  if (!state.activeModalLetter) return;
  soundSynth.playPop();

  state.activeModalLetter.hugs = (state.activeModalLetter.hugs || 0) + 1;
  const hugCountEl = document.getElementById('modalHugCount');
  if (hugCountEl) hugCountEl.textContent = state.activeModalLetter.hugs;

  saveLetters();
  showToast('You sent a comforting virtual hug! 🫂');
}

function surpriseMe() {
  if (state.letters.length === 0) {
    showToast('The wall is currently quiet. Write the first letter! 🕊️');
    return;
  }
  const randomIndex = Math.floor(Math.random() * state.letters.length);
  const randomLetter = state.letters[randomIndex];
  openLetterModal(randomLetter.id);
}

// ---------------------------------------------------------------------------
// 10. Daily Prompt Interaction
// ---------------------------------------------------------------------------
function answerDailyPrompt() {
  soundSynth.playPop();
  const promptQuestion = document.getElementById('promptQuestion');
  const recipientInput = document.getElementById('recipientInput');
  const categorySelect = document.getElementById('categorySelect');
  const messageInput = document.getElementById('messageInput');
  const composeSection = document.getElementById('composeSection');

  if (recipientInput) recipientInput.value = 'To the stranger whose kindness I remember';
  if (categorySelect) categorySelect.value = 'gratitude';
  if (messageInput) {
    messageInput.placeholder = 'I will never forget when you...';
    messageInput.focus();
  }

  if (composeSection) {
    composeSection.scrollIntoView({ behavior: 'smooth' });
  }

  showToast('Prompt loaded into your stationery! ✍️');
}

// ---------------------------------------------------------------------------
// 11. Toast Notifications System
// ---------------------------------------------------------------------------
function showToast(message) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span>💌</span> <span>${escapeHtml(message)}</span>`;

  container.appendChild(toast);

  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  }, 3600);
}

// ---------------------------------------------------------------------------
// 12. Helper Utilities
// ---------------------------------------------------------------------------
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function restoreSampleLetters() {
  state.letters = [...DEFAULT_MOCK_LETTERS];
  state.likedIds.clear();
  saveLetters();
  saveLikes();
  soundSynth.playFoldSend();
  renderLettersGrid();
  showToast('Restored original sample letters! 📜');
}

// ---------------------------------------------------------------------------
// 13. Initialization & Event Listeners
// ---------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  // 1. Load data
  loadStoredData();

  // 2. Set initial theme
  applyTheme(state.currentTheme, false);

  // 3. Render stamps and grid
  renderStampOptions();
  renderLettersGrid();

  // Set today's date preview in composer
  const datePreview = document.getElementById('composerDatePreview');
  if (datePreview) {
    datePreview.textContent = new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  // 4. Bind Theme Buttons (Header & Footer)
  document.querySelectorAll('[data-theme-choice]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const theme = btn.dataset.themeChoice;
      applyTheme(theme, true);
    });
  });

  // 5. Sound Toggle Button
  const soundBtn = document.getElementById('soundToggleBtn');
  const soundIcon = document.getElementById('soundIcon');
  if (soundBtn) {
    soundBtn.addEventListener('click', () => {
      state.audioEnabled = !state.audioEnabled;
      localStorage.setItem('heartecho_audio', state.audioEnabled);
      soundBtn.querySelector('.sound-label').textContent = state.audioEnabled ? 'Audio On' : 'Audio Off';
      soundIcon.textContent = state.audioEnabled ? '🔔' : '🔕';
      if (state.audioEnabled) soundSynth.playPop();
      showToast(state.audioEnabled ? 'Sound effects enabled 🔔' : 'Sound effects muted 🔕');
    });
  }

  // 6. Letter Composer Form
  const letterForm = document.getElementById('letterForm');
  if (letterForm) {
    letterForm.addEventListener('submit', handleLetterSubmit);
  }

  // Character counter for textarea
  const messageInput = document.getElementById('messageInput');
  const charCount = document.getElementById('charCount');
  if (messageInput && charCount) {
    messageInput.addEventListener('input', () => {
      charCount.textContent = `${messageInput.value.length} / 1000 characters`;
    });
  }

  // 7. Search Input
  const searchInput = document.getElementById('searchLettersInput');
  const clearSearchBtn = document.getElementById('clearSearchBtn');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      if (clearSearchBtn) {
        clearSearchBtn.classList.toggle('visible', !!e.target.value);
      }
      renderLettersGrid();
    });
  }

  if (clearSearchBtn) {
    clearSearchBtn.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      state.searchQuery = '';
      clearSearchBtn.classList.remove('visible');
      renderLettersGrid();
    });
  }

  // 8. Filter Chips
  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      soundSynth.playPop();
      document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      state.activeFilter = chip.dataset.filter;
      renderLettersGrid();
    });
  });

  // 9. Sort Select
  const sortSelect = document.getElementById('sortSelect');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      state.sortBy = e.target.value;
      renderLettersGrid();
    });
  }

  // 10. Restore Sample Letters Button
  const resetLettersBtn = document.getElementById('resetLettersBtn');
  if (resetLettersBtn) {
    resetLettersBtn.addEventListener('click', restoreSampleLetters);
  }

  // 11. Daily Prompt Button
  const answerPromptBtn = document.getElementById('answerPromptBtn');
  if (answerPromptBtn) {
    answerPromptBtn.addEventListener('click', answerDailyPrompt);
  }

  // 12. Surprise Me Button
  const randomLetterBtn = document.getElementById('randomLetterBtn');
  if (randomLetterBtn) {
    randomLetterBtn.addEventListener('click', surpriseMe);
  }

  // 13. Modal Close Handlers
  const closeLetterModalBtn = document.getElementById('closeLetterModalBtn');
  const modalCloseActionBtn = document.getElementById('modalCloseActionBtn');
  const letterModalBackdrop = document.getElementById('letterModalBackdrop');
  if (closeLetterModalBtn) closeLetterModalBtn.addEventListener('click', closeLetterModal);
  if (modalCloseActionBtn) modalCloseActionBtn.addEventListener('click', closeLetterModal);
  if (letterModalBackdrop) {
    letterModalBackdrop.addEventListener('click', (e) => {
      if (e.target === letterModalBackdrop) closeLetterModal();
    });
  }

  // Read together: open a live stamp room for this letter
  const modalTogetherBtn = document.getElementById('modalTogetherBtn');
  if (modalTogetherBtn) {
    modalTogetherBtn.addEventListener('click', () => {
      if (!state.activeModalLetter) return;
      const roomId = String(state.activeModalLetter.id).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64);
      window.location.href = `module.html?m=stamps&r=${encodeURIComponent(roomId)}`;
    });
  }

  // Virtual Hug button in modal
  const modalHugBtn = document.getElementById('modalHugBtn');
  if (modalHugBtn) {
    modalHugBtn.addEventListener('click', sendVirtualHug);
  }

  // 14. Delete Modal Handlers
  const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
  const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
  const deleteModalBackdrop = document.getElementById('deleteModalBackdrop');
  if (cancelDeleteBtn) cancelDeleteBtn.addEventListener('click', closeDeleteModal);
  if (confirmDeleteBtn) confirmDeleteBtn.addEventListener('click', executeDeleteLetter);
  if (deleteModalBackdrop) {
    deleteModalBackdrop.addEventListener('click', (e) => {
      if (e.target === deleteModalBackdrop) closeDeleteModal();
    });
  }

  // Close modals on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeLetterModal();
      closeDeleteModal();
    }
  });

  // Dove mascot interactive reaction on click!
  const mascotCute = document.getElementById('mascotCute');
  if (mascotCute) {
    mascotCute.addEventListener('click', () => {
      soundSynth.playPop();
      const bubble = document.getElementById('doveSpeechBubble');
      const messages = [
        "Sending warmth across the sky! 🕊️💖",
        "Your kind words matter so much! ✨",
        "Cozy hugs delivered right on time! 🌸",
        "No one is alone when we care! 💌"
      ];
      const randomMsg = messages[Math.floor(Math.random() * messages.length)];
      if (bubble) bubble.textContent = randomMsg;
      showToast('The dove flutters with joy! 🕊️✨');
    });
  }
});
