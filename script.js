// Flag Recognition Quiz - Vanilla JS
// Uses local SVG/PNG flags and caches assets via a Service Worker for offline use.

// -------------------------
// Theme: Dark/Light handling
// -------------------------
const THEME_LS_KEY = 'flags:theme'; // 'light' | 'dark' or null for system
const MODE_LS_KEY = 'flags:mode'; // 'quiz' | 'pairs'

function getSystemTheme() {
  try {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch { return 'light'; }
}

function updateMetaThemeColor() {
  try {
    const meta = document.querySelector('#meta-theme-color');
    if (!meta) return;
    const cs = getComputedStyle(document.documentElement);
    const c = (cs.getPropertyValue('--theme-color') || '').trim();
    if (c) meta.setAttribute('content', c);
  } catch {}
}

function setTheme(theme, { persist = true } = {}) {
  // theme must be 'light' or 'dark'. If null/undefined, remove explicit theme to follow system.
  if (theme === 'light' || theme === 'dark') {
    document.documentElement.setAttribute('data-theme', theme);
    if (persist) try { localStorage.setItem(THEME_LS_KEY, theme); } catch {}
  } else {
    document.documentElement.removeAttribute('data-theme');
    if (persist) try { localStorage.removeItem(THEME_LS_KEY); } catch {}
  }
  // Defer meta update to ensure styles are applied
  requestAnimationFrame(updateMetaThemeColor);
  updateToggleIcon();
}

function getEffectiveTheme() {
  const saved = (() => { try { return localStorage.getItem(THEME_LS_KEY); } catch { return null; } })();
  return (saved === 'light' || saved === 'dark') ? saved : getSystemTheme();
}

function updateToggleIcon() {
  const btn = document.getElementById('themeToggle');
  if (!btn) return;
  const eff = getEffectiveTheme();
  if (eff === 'dark') {
    btn.textContent = '☀️';
    btn.setAttribute('aria-label', 'Switch to light mode');
    btn.setAttribute('title', 'Switch to light mode');
  } else {
    btn.textContent = '🌙';
    btn.setAttribute('aria-label', 'Switch to dark mode');
    btn.setAttribute('title', 'Switch to dark mode');
  }
}

// Initialize theme on load (respect saved, else system)
(function initTheme() {
  try {
    const saved = localStorage.getItem(THEME_LS_KEY);
    if (saved === 'light' || saved === 'dark') {
      // Early inline script already set attribute; ensure meta reflects it
      requestAnimationFrame(updateMetaThemeColor);
    } else {
      // Follow system; ensure meta reflects computed CSS
      requestAnimationFrame(updateMetaThemeColor);
    }
    // React to system changes only if user hasn't explicitly chosen
    if (window.matchMedia) {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const onChange = () => {
        const explicit = (() => { try { return localStorage.getItem(THEME_LS_KEY); } catch { return null; } })();
        if (explicit !== 'light' && explicit !== 'dark') {
          // No explicit preference: update meta/icon
          updateMetaThemeColor();
          updateToggleIcon();
        }
      };
      if (mq.addEventListener) mq.addEventListener('change', onChange);
      else if (mq.addListener) mq.addListener(onChange);
    }
    // Wire toggle click later (after DOM is parsed)
    window.addEventListener('DOMContentLoaded', () => {
      const btn = document.getElementById('themeToggle');
      if (btn) {
        btn.addEventListener('click', () => {
          const current = getEffectiveTheme();
          const next = current === 'dark' ? 'light' : 'dark';
          setTheme(next, { persist: true });
        });
        updateToggleIcon();
      }
    });
  } catch {}
})();

// -------------------------
// Data: Flags (loaded dynamically)
// -------------------------
let FLAGS = [];
const FLAGS_API_BASE = 'https://flagsapi.com';
const FLAGCDN_BASE = 'https://flagcdn.com'; // SVG provider for crisp flags
const FLAG_STYLE = 'flat';
// Prefer higher-resolution rasters when vector is unavailable
const FLAG_SIZE = 512; // px

// Prefer local assets first when available
const LOCAL_COUNTRIES_JSON = './assets/countries.json';
const localFlagSvgUrl = (code) => `./assets/flags/${String(code || '').toLowerCase()}.svg`;
const localFlagPngUrl = (code) => `./assets/flags/${String(code || '').toLowerCase()}.png`;

const flagUrl = (code, style = FLAG_STYLE, size = FLAG_SIZE) => `${FLAGS_API_BASE}/${code}/${style}/${size}.svg`;
const flagSvgUrl = (code) => {
  // FlagCDN requires lowercase ISO 3166-1 alpha-2 codes
  return `${FLAGCDN_BASE}/${String(code || '').toLowerCase()}.svg`;
};

const flagCandidates = (code) => [
  // Local assets first
  localFlagSvgUrl(code),
  localFlagPngUrl(code),
  // Remote providers as fallback
  flagSvgUrl(code),
  flagUrl(code, 'flat', 512),
  flagUrl(code, 'flat', 256),
  flagUrl(code, 'shiny', 512)
];

function setFlagImage(el, code, name, spinnerEl) {
  const candidates = flagCandidates(code);
  let i = 0;
  const tryNext = () => {
    if (i >= candidates.length) {
      // Last resort: clear image and set alt text
      el.removeAttribute('src');
      el.alt = `Flag unavailable for ${name || code}`;
      if (spinnerEl) spinnerEl.classList.add('hidden');
      return;
    }
    const url = candidates[i++];
    // Clear srcset to avoid the browser preferring lower-res by mistake; vectors handle all sizes
    el.srcset = '';
    el.sizes = '';
    // Reduce referrer issues with some CDNs
    try { el.referrerPolicy = 'no-referrer'; } catch {}
    if (spinnerEl) spinnerEl.classList.remove('hidden');
    // Reset fade-in state before loading a new image
    el.classList.remove('loaded');
    el.src = url;
  };
  el.onerror = tryNext;
  el.onload = () => {
    // Reset on successful load so future loads can set their own handlers
    el.onerror = null;
    if (spinnerEl) spinnerEl.classList.add('hidden');
    // Apply fade-in when the image has finished loading
    el.classList.add('loaded');
  };
  tryNext();
}

async function loadFlagsDataset() {
  // Fetch country names and ISO codes; prefer local file or localStorage, fallback to network and then to a minimal list
  const LS_KEY = 'flags:countries:v1';

  // Helper to normalize various shapes to [{code, name}]
  const normalize = (data) => {
    if (!Array.isArray(data)) return [];
    // If already simplified
    if (data.length && data[0] && 'code' in data[0] && 'name' in data[0]) {
      return data
        .map((c) => ({ code: String(c.code || '').toUpperCase(), name: c.name || '' }))
        .filter((c) => /^[A-Z]{2}$/.test(c.code) && c.name && c.code !== 'XK');
    }
    // REST Countries shape
    return data
      .map((c) => ({ code: String(c.cca2 || '').toUpperCase(), name: c.name?.common || '' }))
      .filter((c) => /^[A-Z]{2}$/.test(c.code) && c.name && c.code !== 'XK');
  };

  // 1) Try localStorage cache first
  try {
    const cached = localStorage.getItem(LS_KEY);
    if (cached) {
      const raw = JSON.parse(cached);
      const simple = normalize(raw);
      if (simple.length) {
        FLAGS = simple.map((c) => ({ ...c, flag: localFlagSvgUrl(c.code) }))
          .sort((a, b) => a.name.localeCompare(b.name));
        return;
      }
    }
  } catch {}

  // 2) Try local file (same-origin)
  try {
    const resp = await fetch(LOCAL_COUNTRIES_JSON, { cache: 'no-cache' });
    if (resp.ok) {
      const data = await resp.json();
      const simple = normalize(data);
      if (simple.length) {
        FLAGS = simple.map((c) => ({ ...c, flag: localFlagSvgUrl(c.code) }))
          .sort((a, b) => a.name.localeCompare(b.name));
        try { localStorage.setItem(LS_KEY, JSON.stringify(simple)); } catch {}
        return;
      }
    }
  } catch {}

  // 3) Network: REST Countries
  try {
    const resp = await fetch('https://restcountries.com/v3.1/all?fields=cca2,name,flags,region');
    const data = await resp.json();
    const simple = normalize(data);
    FLAGS = simple
      .map((c) => ({ ...c, flag: localFlagSvgUrl(c.code) }))
      .sort((a, b) => a.name.localeCompare(b.name));
    // Store simplified list for next time
    try { localStorage.setItem(LS_KEY, JSON.stringify(simple)); } catch {}
  } catch (e) {
    // 4) Minimal fallback (ensures the app still works offline)
    const fallback = [
      { code: 'FR', name: 'France' },
      { code: 'IT', name: 'Italy' },
      { code: 'DE', name: 'Germany' },
      { code: 'BE', name: 'Belgium' },
      { code: 'IE', name: 'Ireland' },
      { code: 'AT', name: 'Austria' },
      { code: 'PL', name: 'Poland' },
      { code: 'UA', name: 'Ukraine' },
      { code: 'NL', name: 'Netherlands' },
      { code: 'RO', name: 'Romania' },
      { code: 'JP', name: 'Japan' },
      { code: 'NG', name: 'Nigeria' },
      { code: 'FI', name: 'Finland' },
      { code: 'SE', name: 'Sweden' },
      { code: 'DK', name: 'Denmark' }
    ];
    FLAGS = fallback.map((c) => ({ ...c, flag: localFlagSvgUrl(c.code) }));
  }
}

// -------------------------
// Utilities
// -------------------------
const shuffle = (arr) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const sample = (arr, n, excludeIndex) => {
  const indices = arr.map((_, i) => i).filter(i => i !== excludeIndex);
  const picked = [];
  while (picked.length < n && indices.length) {
    const idx = Math.floor(Math.random() * indices.length);
    picked.push(indices.splice(idx, 1)[0]);
  }
  return picked.map(i => arr[i]);
};

const preloadImages = (urls) => {
  urls.forEach(src => {
    const img = new Image();
    img.src = src;
  });
};

// -------------------------
// Game State
// -------------------------
const gameState = {
  total: 10,
  current: 0,
  score: 0,
  questions: [], // array of { correct: Flag, options: Flag[] }
  locked: false,
  // Timer
  timerId: null,
  endsAt: 0,
  timedOut: false
};

// -------------------------
// DOM Elements
// -------------------------
const els = {
  modeSelect: document.getElementById('modeSelect'),
  progress: document.getElementById('progress'),
  progressBar: document.getElementById('progressBar'),
  progressCounter: document.getElementById('progressCounter'),
  timer: document.getElementById('timer'),
  flagImage: document.getElementById('flagImage'),
  flagSpinner: document.getElementById('flagSpinner'),
  answersWrap: document.getElementById('answers'),
  answerButtons: Array.from(document.querySelectorAll('.answer')),
  nextBtn: document.getElementById('nextBtn'),
  quizCard: document.getElementById('quiz-card'),
  // Pairs mode elements
  pairsCard: document.getElementById('pairs-card'),
  pairsNames: document.getElementById('pairs-names'),
  pairsFlags: document.getElementById('pairs-flags'),
  pairsNextBtn: document.getElementById('pairsNextBtn'),
  resultsCard: document.getElementById('results-card'),
  resultTitle: document.getElementById('result-title'),
  resultScore: document.getElementById('result-score'),
  bestScore: document.getElementById('best-score'),
  playAgainBtn: document.getElementById('playAgainBtn')
};

// -------------------------
// Setup
// -------------------------
function createQuestions() {
  const pool = shuffle(FLAGS);
  const chosen = pool.slice(0, Math.max(gameState.total, 10));
  const questions = chosen.map(correct => {
    const correctIndex = FLAGS.findIndex(f => f.code === correct.code);
    const distractors = sample(FLAGS, 3, correctIndex);
    const options = shuffle([correct, ...distractors]);
    return { correct, options };
  });
  return questions.slice(0, gameState.total);
}

function setProgress() {
  const current = Math.min(gameState.current + 1, gameState.total);
  if (els.progress) {
    els.progress.textContent = `Question ${current} of ${gameState.total}`;
  }
  if (els.progressCounter) {
    const remaining = Math.max(gameState.total - current, 0);
    els.progressCounter.textContent = `${current} / ${gameState.total} • ${remaining} left`;
  }
  if (els.progressBar) {
    els.progressBar.max = gameState.total;
    // Show the current question (starts at 1 on the first question)
    els.progressBar.value = current;
    els.progressBar.setAttribute('aria-valuemin', '0');
    els.progressBar.setAttribute('aria-valuemax', String(gameState.total));
    els.progressBar.setAttribute('aria-valuenow', String(current));
  }
}

// Shared header helpers
function showTimer(show) {
  if (!els.timer) return;
  els.timer.classList.toggle('hidden', !show);
}

// -------------------------
// Timer
// -------------------------
const TIMER_TOTAL_MS = 3 * 60 * 1000; // 3 minutes

function fmtTime(ms) {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
  const ss = String(totalSec % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

function updateTimerUI(ms) {
  if (!els.timer) return;
  const t = fmtTime(ms);
  els.timer.textContent = t;
  els.timer.setAttribute('aria-label', `Time remaining ${t}`);
}

function clearTimer() {
  if (gameState.timerId) {
    clearInterval(gameState.timerId);
    gameState.timerId = null;
  }
}

function startTimer() {
  clearTimer();
  gameState.timedOut = false;
  gameState.endsAt = Date.now() + TIMER_TOTAL_MS;
  updateTimerUI(TIMER_TOTAL_MS);
  gameState.timerId = setInterval(() => {
    const msLeft = gameState.endsAt - Date.now();
    if (msLeft <= 0) {
      updateTimerUI(0);
      clearTimer();
      gameState.timedOut = true;
      showResults();
      return;
    }
    updateTimerUI(msLeft);
  }, 1000);
}

function renderQuestion() {
  const q = gameState.questions[gameState.current];
  if (!q) return;

  setProgress();
  setFlagImage(els.flagImage, q.correct.code, q.correct.name, els.flagSpinner);
  els.flagImage.alt = `Flag of ${q.correct.name}`;

  // Normalize options to exactly 4 entries (fallback if anything went wrong)
  let options = q.options.slice(0, 4);
  const codesInOptions = new Set(options.map(o => o?.code).filter(Boolean));
  if (options.length < 4) {
    const fillers = FLAGS.filter(f => f.code !== q.correct.code && !codesInOptions.has(f.code));
    while (options.length < 4 && fillers.length) options.push(fillers.shift());
  }

  els.answerButtons.forEach((btn, i) => {
    const opt = options[i];
    const label = opt && opt.name ? opt.name : '';
    btn.textContent = label;
    btn.title = label;
    btn.setAttribute('aria-label', label || `Option ${i + 1}`);
    btn.dataset.correct = String(Boolean(opt && opt.code === q.correct.code));
    btn.classList.remove('correct', 'wrong');
    btn.disabled = false;
  });

  gameState.locked = false;
  els.nextBtn.disabled = true;
  // Ensure Next button is visible on every question
  els.nextBtn.classList.remove('hidden');
  els.nextBtn.textContent = (gameState.current + 1 === gameState.total) ? 'See results' : 'Next question';
}

function handleAnswerClick(e) {
  const btn = e.currentTarget;
  if (gameState.locked) return;
  gameState.locked = true;

  const isCorrect = btn.dataset.correct === 'true';
  if (isCorrect) gameState.score += 1;

  // Mark selected
  btn.classList.add(isCorrect ? 'correct' : 'wrong');

  // Reveal correct
  els.answerButtons.forEach(b => {
    b.disabled = true;
    if (b.dataset.correct === 'true') b.classList.add('correct');
  });

  els.nextBtn.disabled = false;
  // Move focus to Next for quicker flow
  requestAnimationFrame(() => els.nextBtn.focus());
}

function nextQuestion() {
  if (gameState.current + 1 >= gameState.total) {
    showResults();
  } else {
    gameState.current += 1;
    renderQuestion();
  }
}

function showResults() {
  clearTimer();
  els.quizCard.classList.add('hidden');
  els.resultsCard.classList.remove('hidden');

  const s = gameState.score;
  const msg = gameState.timedOut
    ? '⏱️ Time’s up!'
    : s >= 9
    ? '🌟 Excellent!'
    : s >= 6
    ? '👏 Good job!'
    : '💪 Keep practicing!';
  els.resultTitle.textContent = msg;
  els.resultScore.textContent = `You scored ${s} / ${gameState.total}.`;

  // Bonus: Best score in localStorage
  try {
    const best = Number(localStorage.getItem('bestScore') || 0);
    if (s > best) localStorage.setItem('bestScore', String(s));
    const bestNow = Math.max(best, s);
    els.bestScore.textContent = `Best score: ${bestNow} / ${gameState.total}`;
  } catch {}
}

function startGame() {
  gameState.current = 0;
  gameState.score = 0;
  gameState.questions = createQuestions();
  gameState.timedOut = false;

  // Preload this round's flags
  preloadImages(gameState.questions.map(q => q.correct.flag));

  els.resultsCard.classList.add('hidden');
  els.quizCard.classList.remove('hidden');
  els.pairsCard.classList.add('hidden');
  // Make sure Next button shows at game start (disabled until answer)
  els.nextBtn.classList.remove('hidden');
  renderQuestion();
  showTimer(true);
  startTimer();
}

// Event wiring
els.answerButtons.forEach(btn => btn.addEventListener('click', handleAnswerClick));
els.nextBtn.addEventListener('click', nextQuestion);

// -------------------------
// Mode switching & Pairs Mode
// -------------------------
let appMode = 'quiz'; // 'quiz' | 'pairs'

function setMode(mode) {
  appMode = (mode === 'pairs') ? 'pairs' : 'quiz';
  try { localStorage.setItem(MODE_LS_KEY, appMode); } catch {}
  // Hide both, specific starters will reveal
  els.quizCard.classList.add('hidden');
  els.pairsCard.classList.add('hidden');
  els.resultsCard.classList.add('hidden');
  // Reset progress visuals
  if (els.progress) els.progress.textContent = '';
  if (els.progressCounter) els.progressCounter.textContent = '';
  if (els.progressBar) { els.progressBar.value = 0; els.progressBar.max = 1; }
  clearTimer();
  showTimer(appMode === 'quiz');
  if (appMode === 'quiz') startGame(); else startPairsGame();
}

// Pairing game state
const pairingState = {
  sessionTotal: 20,
  roundSize: 5,
  pool: [], // selected FLAGS for the entire session (20)
  roundIndex: 0, // 0..3
  matched: 0,
  attempts: 0,
  selectedName: null, // code
  selectedFlag: null // code
};

function setPairsProgress() {
  const current = pairingState.matched;
  const total = pairingState.sessionTotal;
  if (els.progress) {
    const done = Math.min(current, total);
    els.progress.textContent = `Pairs matched ${done} of ${total}`;
  }
  if (els.progressCounter) {
    const remaining = Math.max(total - current, 0);
    els.progressCounter.textContent = `${current} / ${total} • ${remaining} left`;
  }
  if (els.progressBar) {
    els.progressBar.max = total;
    els.progressBar.value = current;
    els.progressBar.setAttribute('aria-valuemin', '0');
    els.progressBar.setAttribute('aria-valuemax', String(total));
    els.progressBar.setAttribute('aria-valuenow', String(current));
  }
}

function clearPairsBoard() {
  els.pairsNames.innerHTML = '';
  els.pairsFlags.innerHTML = '';
  pairingState.selectedName = null;
  pairingState.selectedFlag = null;
}

function renderPairsRound() {
  setPairsProgress();
  els.quizCard.classList.add('hidden');
  els.pairsCard.classList.remove('hidden');
  els.resultsCard.classList.add('hidden');
  els.pairsNextBtn.classList.add('hidden');

  clearPairsBoard();
  const start = pairingState.roundIndex * pairingState.roundSize;
  const items = pairingState.pool.slice(start, start + pairingState.roundSize);
  const names = shuffle(items);
  const flags = shuffle(items);

  // Render names
  names.forEach((c) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pair-btn';
    btn.textContent = c.name;
    btn.dataset.code = c.code;
    btn.setAttribute('aria-label', `Country ${c.name}`);
    btn.addEventListener('click', () => handleNameClick(btn));
    els.pairsNames.appendChild(btn);
  });

  // Preload flags
  preloadImages(flags.map(f => f.flag));

  // Render flags
  flags.forEach((c) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pair-btn';
    btn.dataset.code = c.code;
    btn.setAttribute('aria-label', `Flag of ${c.name}`);
    const img = document.createElement('img');
    img.alt = `Flag of ${c.name}`;
    img.className = 'flag-thumb';
    setFlagImage(img, c.code, c.name);
    btn.appendChild(img);
    btn.addEventListener('click', () => handleFlagClick(btn));
    els.pairsFlags.appendChild(btn);
  });
}

function clearPairSelections() {
  const all = [...els.pairsNames.querySelectorAll('.pair-btn.selected'), ...els.pairsFlags.querySelectorAll('.pair-btn.selected')];
  all.forEach(b => b.classList.remove('selected'));
  pairingState.selectedName = null;
  pairingState.selectedFlag = null;
}

function onPairResolve(correct, nameBtn, flagBtn) {
  if (correct) {
    nameBtn.classList.add('correct');
    flagBtn.classList.add('correct');
    nameBtn.disabled = true;
    flagBtn.disabled = true;
    // Visually fade matched items
    nameBtn.classList.add('paired');
    flagBtn.classList.add('paired');
    nameBtn.setAttribute('aria-disabled', 'true');
    flagBtn.setAttribute('aria-disabled', 'true');
    pairingState.matched += 1;
    setPairsProgress();
    // If round done
    const start = pairingState.roundIndex * pairingState.roundSize;
    const roundMatched = els.pairsNames.querySelectorAll('.pair-btn[disabled]').length;
    if (roundMatched >= pairingState.roundSize) {
      if (pairingState.matched >= pairingState.sessionTotal) {
        showPairsResults();
      } else {
        els.pairsNextBtn.classList.remove('hidden');
        // Move focus to Next for flow
        requestAnimationFrame(() => els.pairsNextBtn.focus());
      }
    }
  } else {
    nameBtn.classList.add('wrong');
    flagBtn.classList.add('wrong');
    pairingState.attempts += 1;
    setTimeout(() => {
      nameBtn.classList.remove('wrong', 'selected');
      flagBtn.classList.remove('wrong', 'selected');
    }, 600);
  }
  pairingState.selectedName = null;
  pairingState.selectedFlag = null;
}

function tryResolvePair() {
  const nameCode = pairingState.selectedName;
  const flagCode = pairingState.selectedFlag;
  if (!nameCode || !flagCode) return;
  const nameBtn = els.pairsNames.querySelector(`.pair-btn.selected[data-code="${nameCode}"]`);
  const flagBtn = els.pairsFlags.querySelector(`.pair-btn.selected[data-code="${flagCode}"]`);
  const correct = nameCode === flagCode;
  onPairResolve(correct, nameBtn, flagBtn);
}

function handleNameClick(btn) {
  if (btn.disabled) return;
  // Toggle selection
  const already = btn.classList.contains('selected');
  els.pairsNames.querySelectorAll('.pair-btn').forEach(b => b.classList.remove('selected'));
  if (already) {
    pairingState.selectedName = null;
    btn.classList.remove('selected');
  } else {
    pairingState.selectedName = btn.dataset.code;
    btn.classList.add('selected');
  }
  tryResolvePair();
}

function handleFlagClick(btn) {
  if (btn.disabled) return;
  const already = btn.classList.contains('selected');
  els.pairsFlags.querySelectorAll('.pair-btn').forEach(b => b.classList.remove('selected'));
  if (already) {
    pairingState.selectedFlag = null;
    btn.classList.remove('selected');
  } else {
    pairingState.selectedFlag = btn.dataset.code;
    btn.classList.add('selected');
  }
  tryResolvePair();
}

function nextPairsRound() {
  pairingState.roundIndex += 1;
  renderPairsRound();
}

function startPairsGame() {
  clearTimer();
  showTimer(false);
  els.resultsCard.classList.add('hidden');
  els.quizCard.classList.add('hidden');
  els.pairsCard.classList.remove('hidden');
  pairingState.pool = shuffle(FLAGS).slice(0, pairingState.sessionTotal);
  pairingState.roundIndex = 0;
  pairingState.matched = 0;
  pairingState.attempts = 0;
  renderPairsRound();
}

function showPairsResults() {
  els.quizCard.classList.add('hidden');
  els.pairsCard.classList.add('hidden');
  els.resultsCard.classList.remove('hidden');
  const s = pairingState.matched;
  els.resultTitle.textContent = 'Pairs complete!';
  els.resultScore.textContent = `You matched ${s} / ${pairingState.sessionTotal} countries` + (pairingState.attempts ? ` with ${pairingState.attempts} extra attempts.` : '.');
  try {
    const best = Number(localStorage.getItem('bestPairs') || 0);
    if (s > best) localStorage.setItem('bestPairs', String(s));
    const bestNow = Math.max(best, s);
    els.bestScore.textContent = `Best pairs: ${bestNow} / ${pairingState.sessionTotal}`;
  } catch {}
}

// Wire mode UI
if (els.modeSelect) {
  try {
    const saved = localStorage.getItem(MODE_LS_KEY);
    if (saved === 'pairs' || saved === 'quiz') els.modeSelect.value = saved;
  } catch {}
  els.modeSelect.addEventListener('change', () => setMode(els.modeSelect.value));
}

// Pairs next button
if (els.pairsNextBtn) els.pairsNextBtn.addEventListener('click', nextPairsRound);

// Play again respects current mode
els.playAgainBtn.addEventListener('click', () => {
  if (appMode === 'pairs') startPairsGame(); else startGame();
});

// Initialize: load dataset, then start
(async () => {
  try {
    els.progress.textContent = 'Loading…';
    await loadFlagsDataset();
  } finally {
    // Start with saved mode or default to quiz
    const saved = (() => { try { return localStorage.getItem(MODE_LS_KEY); } catch { return null; } })();
    setMode(saved === 'pairs' ? 'pairs' : 'quiz');
  }
})();

// -------------------------
// PWA: Service Worker Registration
// -------------------------
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./service-worker.js')
      .catch(() => {/* noop */});
  });
}
