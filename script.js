// Flag Recognition Quiz - Vanilla JS
// Uses local SVG flags and caches assets via a Service Worker for offline use.

// -------------------------
// Data: Flags (loaded dynamically)
// -------------------------
let FLAGS = [];
const FLAGS_API_BASE = 'https://flagsapi.com';
const FLAGCDN_BASE = 'https://flagcdn.com'; // SVG provider for crisp flags
const FLAG_STYLE = 'flat';
// Prefer higher-resolution rasters when vector is unavailable
const FLAG_SIZE = 512; // px

const flagUrl = (code, style = FLAG_STYLE, size = FLAG_SIZE) => `${FLAGS_API_BASE}/${code}/${style}/${size}.svg`;
const flagSvgUrl = (code) => {
  // FlagCDN requires lowercase ISO 3166-1 alpha-2 codes
  return `${FLAGCDN_BASE}/${String(code || '').toLowerCase()}.svg`;
};

const flagCandidates = (code) => [
  // Prefer crisp vector first
  flagSvgUrl(code),
  // Then fall back to high-res rasters
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
  // Fetch country names and ISO codes; fallback to a minimal local list if network fails
  try {
    // REST Countries: country name and alpha-2 code
    const resp = await fetch('https://restcountries.com/v3.1/all?fields=cca2,name,flags,region');
    const data = await resp.json();
    FLAGS = data
      .map((c) => ({ code: String(c.cca2 || '').toUpperCase(), name: c.name?.common || '' }))
      .filter((c) => /^[A-Z]{2}$/.test(c.code) && c.name && c.code !== 'XK')
      .map((c) => ({ ...c, flag: flagUrl(c.code) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (e) {
    // Minimal fallback (ensures the app still works offline)
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
    FLAGS = fallback.map((c) => ({ ...c, flag: flagUrl(c.code) }));
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
  locked: false
};

// -------------------------
// DOM Elements
// -------------------------
const els = {
  progress: document.getElementById('progress'),
  progressBar: document.getElementById('progressBar'),
  progressCounter: document.getElementById('progressCounter'),
  flagImage: document.getElementById('flagImage'),
  flagSpinner: document.getElementById('flagSpinner'),
  answersWrap: document.getElementById('answers'),
  answerButtons: Array.from(document.querySelectorAll('.answer')),
  nextBtn: document.getElementById('nextBtn'),
  quizCard: document.getElementById('quiz-card'),
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
  els.quizCard.classList.add('hidden');
  els.resultsCard.classList.remove('hidden');

  const s = gameState.score;
  const msg = s >= 9 ? '🌟 Excellent!' : s >= 6 ? '👏 Good job!' : '💪 Keep practicing!';
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

  // Preload this round's flags
  preloadImages(gameState.questions.map(q => q.correct.flag));

  els.resultsCard.classList.add('hidden');
  els.quizCard.classList.remove('hidden');
  // Make sure Next button shows at game start (disabled until answer)
  els.nextBtn.classList.remove('hidden');
  renderQuestion();
}

// Event wiring
els.answerButtons.forEach(btn => btn.addEventListener('click', handleAnswerClick));
els.nextBtn.addEventListener('click', nextQuestion);
els.playAgainBtn.addEventListener('click', startGame);

// Initialize: load dataset, then start
(async () => {
  try {
    els.progress.textContent = 'Loading…';
    await loadFlagsDataset();
  } finally {
    startGame();
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
