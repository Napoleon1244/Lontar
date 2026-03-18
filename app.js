/* ═══════════════════════════════════════
   LONTAR — app.js  v4
   - Hapus: TOC, catalog search
   - Tambah: Gemini Flash (user API key)
   - Lebih cepat, lebih bersih
   ═══════════════════════════════════════ */
'use strict';

// ── State ──────────────────────────────
let isCancelled = false;
let currentBook = null;

// ── Helpers ────────────────────────────
const ls = (k, v) => v === undefined
  ? localStorage.getItem(k)
  : (() => { try { localStorage.setItem(k, v); } catch(_){} })();

const sleep = ms => new Promise(r => setTimeout(r, ms));

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function inlineMarkup(raw) {
  let s = esc(raw);
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/__(.+?)__/g, '<strong>$1</strong>');
  s = s.replace(/(?<![_\w])_([^_\n]+?)_(?![_\w])/g, '<em>$1</em>');
  s = s.replace(/(?<![*\w])\*([^*\n]+?)\*(?![*\w])/g, '<em>$1</em>');
  return s;
}

function fetchWithTimeout(url, ms, opts = {}) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(id));
}

// ── Popular books ───────────────────────
const POPULAR_BOOKS = [
  { id:'1342',  title:'Pride and Prejudice',               author:'Jane Austen' },
  { id:'84',    title:'Frankenstein',                      author:'Mary Shelley' },
  { id:'11',    title:"Alice's Adventures in Wonderland",  author:'Lewis Carroll' },
  { id:'1661',  title:'The Adventures of Sherlock Holmes', author:'Arthur Conan Doyle' },
  { id:'345',   title:'Dracula',                           author:'Bram Stoker' },
  { id:'2701',  title:'Moby-Dick',                         author:'Herman Melville' },
  { id:'98',    title:'A Tale of Two Cities',              author:'Charles Dickens' },
  { id:'5200',  title:'Metamorphosis',                     author:'Franz Kafka' },
  { id:'1952',  title:'The Yellow Wallpaper',              author:'Charlotte P. Gilman' },
  { id:'1184',  title:'The Count of Monte Cristo',         author:'Alexandre Dumas' },
  { id:'74',    title:'The Adventures of Tom Sawyer',      author:'Mark Twain' },
  { id:'25344', title:'The Scarlet Letter',                author:'Nathaniel Hawthorne' },
];

// ── CORS proxies ────────────────────────
const PROXIES = [
  u => `https://corsproxy.io/?${encodeURIComponent(u)}`,
  u => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  u => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
];

/* ════════════════════════════════════
   INIT
════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  applyAllSettings();
  renderLists();

  document.getElementById('bookInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') startLoad();
  });

  document.getElementById('readerScreen').addEventListener('scroll', onReaderScroll, { passive: true });

  if ('serviceWorker' in navigator)
    navigator.serviceWorker.register('sw.js').catch(() => {});
});

/* ════════════════════════════════════
   SCREENS
════════════════════════════════════ */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id + 'Screen').classList.add('active');
}

function goHome() {
  isCancelled = true;
  closeAllPanels();
  if (currentBook) ls('lontar_scroll_' + currentBook.id,
    String(document.getElementById('readerScreen').scrollTop));
  showScreen('home');
  renderLists();
}

function cancelLoad() {
  isCancelled = true;
  showScreen('home');
}

/* ════════════════════════════════════
   PANELS
════════════════════════════════════ */
function openPanel(name) {
  closeAllPanels();
  document.getElementById(name + 'Panel')?.classList.add('open');
  document.getElementById('panelOverlay').classList.add('active');
}
function closeAllPanels() {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('open'));
  document.getElementById('panelOverlay').classList.remove('active');
}

/* ════════════════════════════════════
   SETTINGS
════════════════════════════════════ */
function applyAllSettings() {
  _applyFontSize(ls('lontar_fs') || '15');
  _applyCol(ls('lontar_col') || 'normal');

  const fs = ls('lontar_fs') || '15';
  document.getElementById('fontSizeRange').value = fs;
  document.getElementById('fontSizeVal').textContent = fs + 'px';

  const col = ls('lontar_col') || 'normal';
  document.querySelectorAll('.seg').forEach(b =>
    b.classList.toggle('active', b.dataset.col === col));

  const css = ls('lontar_css') || '';
  document.getElementById('customCssInput').value = css;
  document.getElementById('customCssStyle').textContent = css;

  const gkey = ls('lontar_gemini_key') || '';
  document.getElementById('geminiKeyInput').value = gkey;
  updateEngineLabel();
}

function setFontSize(v) {
  _applyFontSize(v);
  document.getElementById('fontSizeVal').textContent = v + 'px';
  ls('lontar_fs', v);
}
function _applyFontSize(v) { document.documentElement.style.setProperty('--fs', v + 'px'); }

function setCol(btn) {
  document.querySelectorAll('.seg').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  _applyCol(btn.dataset.col);
  ls('lontar_col', btn.dataset.col);
}
function _applyCol(c) { document.documentElement.setAttribute('data-col', c); }

function applyCustomCss() {
  const css = document.getElementById('customCssInput').value;
  document.getElementById('customCssStyle').textContent = css;
  ls('lontar_css', css);
  showToast('css diterapkan ✓');
}
function clearCustomCss() {
  document.getElementById('customCssInput').value = '';
  document.getElementById('customCssStyle').textContent = '';
  ls('lontar_css', '');
  showToast('css dihapus');
}

function saveGeminiKey() {
  const key = document.getElementById('geminiKeyInput').value.trim();
  ls('lontar_gemini_key', key);
  updateEngineLabel();
  showToast(key ? 'kunci gemini disimpan ✓' : 'kunci dihapus, pakai google translate');
}

function updateEngineLabel() {
  const key = ls('lontar_gemini_key') || '';
  const el = document.getElementById('engineLabel');
  if (el) el.textContent = key ? '● gemini flash' : '● google translate';
}

/* ════════════════════════════════════
   BOOK LISTS
════════════════════════════════════ */
function renderLists() {
  // Popular
  document.getElementById('popularList').innerHTML =
    POPULAR_BOOKS.map(b => bookItem(b.id, b.title, b.author)).join('');

  // History
  const h = getHistory();
  const sec = document.getElementById('historySec');
  if (!h.length) { sec.style.display = 'none'; return; }
  sec.style.display = '';
  document.getElementById('historyList').innerHTML =
    h.map(b => bookItem(b.id, b.title, b.author)).join('');
}

function bookItem(id, title, author) {
  const cached = !!getCachedBook(id);
  return `<li><button onclick="loadById('${esc(id)}')">
    <span class="bl-title">${esc(title)}</span>
    <span class="bl-meta">${esc(author || '')}${cached ? ' ·&nbsp;<span class="dot">●</span>' : ''}</span>
  </button></li>`;
}

function getHistory() {
  try { return JSON.parse(ls('lontar_history') || '[]'); } catch { return []; }
}
function saveHistory(b) {
  let h = getHistory().filter(x => x.id !== b.id);
  h.unshift({ id: b.id, title: b.title, author: b.author });
  ls('lontar_history', JSON.stringify(h.slice(0, 10)));
}
function clearHistory() {
  ls('lontar_history', '[]');
  renderLists();
  showToast('riwayat dihapus');
}
function loadById(id) {
  document.getElementById('bookInput').value = id;
  startLoad();
}

/* ════════════════════════════════════
   ID EXTRACTION
════════════════════════════════════ */
function extractBookId(input) {
  input = input.trim();
  if (!input) throw new Error('Masukkan URL atau ID buku.');
  if (/^\d+$/.test(input)) return input;
  const pats = [
    /gutenberg\.org\/ebooks\/(\d+)/,
    /gutenberg\.org\/files\/(\d+)/,
    /gutenberg\.org\/cache\/epub\/(\d+)/,
    /pg(\d+)\.txt/, /\/(\d+)\//, /(\d{2,6})/,
  ];
  for (const p of pats) { const m = input.match(p); if (m) return m[1]; }
  throw new Error('ID tidak ditemukan. Coba masukkan angka saja, misal: 1342');
}

/* ════════════════════════════════════
   FETCH
════════════════════════════════════ */
async function fetchBookText(bookId) {
  const urls = [
    `https://www.gutenberg.org/cache/epub/${bookId}/pg${bookId}.txt`,
    `https://www.gutenberg.org/files/${bookId}/${bookId}-0.txt`,
    `https://www.gutenberg.org/files/${bookId}/${bookId}.txt`,
    `https://www.gutenberg.org/files/${bookId}/${bookId}-8.txt`,
  ];
  // Direct first (Gutenberg punya CORS header di cache URL)
  for (const u of urls) {
    if (isCancelled) throw new Error('Dibatalkan');
    try {
      setStatus('mengambil ' + u.split('/').pop() + '…');
      const r = await fetchWithTimeout(u, 10000);
      if (r.ok) { const t = await r.text(); if (t?.length > 500) return t; }
    } catch(_) {}
  }
  // Proxy fallback
  for (const u of urls) {
    for (const mkP of PROXIES) {
      if (isCancelled) throw new Error('Dibatalkan');
      try {
        setStatus('proxy: ' + u.split('/').pop() + '…');
        const r = await fetchWithTimeout(mkP(u), 14000);
        if (r.ok) {
          let t = await r.text();
          if (t?.trimStart().startsWith('{"contents"'))
            try { t = JSON.parse(t).contents; } catch(_){}
          if (t?.length > 500) return t;
        }
      } catch(_) {}
    }
  }
  throw new Error('Gagal mengunduh buku. Cek ID dan coba lagi.');
}

/* ════════════════════════════════════
   PARSE
════════════════════════════════════ */
function parseGutenbergText(raw) {
  const txt = raw.replace(/\r\n/g,'\n').replace(/\r/g,'\n');

  // Metadata
  let title = '', author = '';
  const tM = txt.match(/^Title:\s*(.+?)[ \t]*$/mi);
  if (tM) title = tM[1].trim();
  if (!title) {
    const m = txt.match(/Project Gutenberg (?:eBook|EBook|e-book) of ([^,\n]+)/i);
    if (m) title = m[1].trim();
  }
  if (!title) {
    const lines = txt.split('\n').filter(l => l.trim());
    if (lines.length) title = lines[0].trim().replace(/^The Project Gutenberg[^:]*:\s*/i,'');
  }
  const aM = txt.match(/^Author:\s*(.+?)[ \t]*$/mi)
           || txt.match(/^Authors?:\s*(.+?)[ \t]*$/mi);
  if (aM) author = aM[1].trim();
  if (!author) {
    const m = txt.match(/Project Gutenberg[^,\n]+,\s*by\s+([^\n]+)/i);
    if (m) author = m[1].trim();
  }
  // "Surname, Firstname" → "Firstname Surname"
  if (author && /^[^,]+,\s*[^,]+$/.test(author)) {
    const [sur, fn] = author.split(',');
    author = fn.trim() + ' ' + sur.trim();
  }

  title  = title  || 'Tanpa Judul';
  author = author || 'Penulis Tidak Diketahui';

  // Strip header/footer
  let body = txt;
  const sm = body.match(/\*{3}\s*START OF (?:THE|THIS) PROJECT GUTENBERG[^\n]*\n/i);
  if (sm) body = body.slice(body.indexOf(sm[0]) + sm[0].length);
  const em = body.match(/\*{3}\s*END OF (?:THE|THIS) PROJECT GUTENBERG[^\n]*/i);
  if (em) body = body.slice(0, body.indexOf(em[0]));

  // Clean
  body = body
    .replace(/^\[(?:Illustration|Ilustrasi|Frontispiece|Gambar|Figure|Footnote)[^\]]*\][ \t]*$/gim, '')
    .replace(/^[-_=*#]{4,}[ \t]*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // Unwrap Gutenberg hard-wrap (~70 char/line)
  body = body
    .replace(/\n\n/g, '\x00')
    .replace(/([^\x00])\n([^\x00])/g, '$1 $2')
    .replace(/\x00/g, '\n\n')
    .replace(/ {2,}/g, ' ');

  return { title, author, body };
}

/* ════════════════════════════════════
   TRANSLATE — Google Translate
════════════════════════════════════ */
async function gtxTranslate(text, retries = 3) {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=id&dt=t&q=${encodeURIComponent(text)}`;
  for (let i = 0; i < retries; i++) {
    if (isCancelled) throw new Error('Dibatalkan');
    try {
      const r = await fetchWithTimeout(url, 15000);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const d = await r.json();
      return d[0].map(x => x?.[0] || '').join('');
    } catch(e) {
      if (isCancelled) throw new Error('Dibatalkan');
      if (i === retries - 1) return text;
      await sleep(800 * (i + 1));
    }
  }
  return text;
}

/* ════════════════════════════════════
   TRANSLATE — Gemini Flash
   Free tier: 15 req/menit, 1M token/menit
   Kirim chunk besar, delay antar request
════════════════════════════════════ */
async function geminiTranslate(text, apiKey, retries = 2) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
  const prompt = `Terjemahkan teks sastra berikut ke Bahasa Indonesia. Pertahankan gaya sastra, pilihan kata, dan nuansa asli teks. Kembalikan HANYA terjemahan tanpa penjelasan apapun.\n\n${text}`;

  for (let i = 0; i < retries; i++) {
    if (isCancelled) throw new Error('Dibatalkan');
    try {
      const r = await fetchWithTimeout(url, 30000, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 8192 },
        }),
      });
      if (r.status === 429) {
        // Rate limited — tunggu lebih lama
        await sleep(5000 * (i + 1));
        continue;
      }
      if (!r.ok) throw new Error('Gemini HTTP ' + r.status);
      const d = await r.json();
      const out = d?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!out) throw new Error('Respons Gemini kosong');
      return out.trim();
    } catch(e) {
      if (isCancelled) throw new Error('Dibatalkan');
      if (i === retries - 1) return text; // fallback ke original
      await sleep(2000 * (i + 1));
    }
  }
  return text;
}

/* ════════════════════════════════════
   TRANSLATE — dispatcher + chunking
════════════════════════════════════ */
function splitChunks(text, maxLen) {
  const paras = text.split(/\n\n+/);
  const chunks = [];
  let cur = '';
  for (const p of paras) {
    const candidate = cur ? cur + '\n\n' + p : p;
    if (candidate.length > maxLen && cur) { chunks.push(cur.trim()); cur = p; }
    else cur = candidate;
  }
  if (cur.trim()) chunks.push(cur.trim());
  return chunks.filter(Boolean);
}

async function translateFull(text, onProgress) {
  const geminiKey = ls('lontar_gemini_key') || '';
  const useGemini = !!geminiKey;

  // Gemini bisa terima chunk lebih besar → lebih sedikit request → lebih cepat
  const chunkSize = useGemini ? 4000 : 1800;
  const delayMs   = useGemini ? 4200 : 260;  // Gemini free: ~15 RPM → ~4s/req

  const chunks = splitChunks(text, chunkSize);
  const out = [];
  const t0 = Date.now();

  for (let i = 0; i < chunks.length; i++) {
    if (isCancelled) throw new Error('Dibatalkan');

    const translated = useGemini
      ? await geminiTranslate(chunks[i], geminiKey)
      : await gtxTranslate(chunks[i]);

    out.push(translated);

    const pct = Math.round(((i + 1) / chunks.length) * 100);
    onProgress(pct);

    const engine = useGemini ? 'gemini' : 'gtranslate';
    setStatus(`[${engine}] bagian ${i + 1}/${chunks.length}…`);

    // ETA
    const elapsed = (Date.now() - t0) / 1000;
    const rem = Math.ceil(((chunks.length - i - 1) / (i + 1)) * elapsed);
    if (i > 0 && rem > 0) {
      document.getElementById('progressEta').textContent =
        `~${rem < 60 ? rem + 'd' : Math.ceil(rem / 60) + 'm'} tersisa`;
    }

    if (i < chunks.length - 1) await sleep(delayMs);
  }

  return out.join('\n\n');
}

/* ════════════════════════════════════
   MAIN PIPELINE
════════════════════════════════════ */
async function startLoad() {
  const input = document.getElementById('bookInput').value;
  let bookId;
  try { bookId = extractBookId(input); }
  catch(e) { showToast('⚠ ' + e.message); return; }

  const cached = getCachedBook(bookId);
  if (cached) { displayBook(cached); return; }

  isCancelled = false;
  showScreen('loading');
  document.getElementById('loadingTitle').textContent = 'memuat buku…';
  document.getElementById('progressEta').textContent  = '';
  setProgress(0);

  try {
    setStatus('menghubungi project gutenberg…');
    const raw = await fetchBookText(bookId);
    if (isCancelled) return;

    setStatus('memproses teks…');
    setProgress(5);
    const parsed = parseGutenbergText(raw);
    document.getElementById('loadingTitle').textContent = parsed.title;

    const engine = ls('lontar_gemini_key') ? 'gemini flash' : 'google translate';
    setStatus(`menerjemahkan via ${engine}…`);
    setProgress(8);
    const translated = await translateFull(parsed.body, pct => setProgress(8 + Math.round(pct * 0.9)));
    if (isCancelled) return;

    setProgress(100);
    await sleep(250);

    const bookData = {
      id: bookId, title: parsed.title, author: parsed.author,
      original: parsed.body, translated,
      engine: ls('lontar_gemini_key') ? 'gemini' : 'gtranslate',
      cachedAt: new Date().toISOString(),
    };
    cacheBook(bookData);
    saveHistory(bookData);
    displayBook(bookData);

  } catch(e) {
    if (isCancelled) { showScreen('home'); return; }
    showScreen('home');
    showToast('gagal: ' + e.message, 5000);
  }
}

/* ════════════════════════════════════
   DISPLAY
════════════════════════════════════ */
const HEADING_RE = /^(chapter|part|book|section|bab|bagian|prologue|epilogue|preface|pendahuluan|introduction|\d+\.|[IVXivx]{1,6}\.?\s*$)/i;

function contentToHtml(text) {
  return text.split(/\n\n+/).map(block => {
    const b = block.trim();
    if (!b) return '';
    const isH = b.length < 100 && b.split('\n').length <= 2 && HEADING_RE.test(b);
    return isH
      ? `<h2>${esc(b)}</h2>`
      : `<p>${inlineMarkup(b.replace(/\n/g, ' '))}</p>`;
  }).join('');
}

function displayBook(bookData) {
  currentBook = bookData;
  document.getElementById('toolbarTitle').textContent  = bookData.title;
  document.getElementById('readerTitle').textContent   = bookData.title;
  document.getElementById('readerAuthor').textContent  = bookData.author;

  // Engine badge
  const badge = document.getElementById('engineBadge');
  if (badge) badge.textContent = bookData.engine === 'gemini' ? 'gemini' : 'gtranslate';

  document.getElementById('readerContent').innerHTML = contentToHtml(bookData.translated || bookData.original);
  showScreen('reader');

  // Restore scroll
  const saved = parseInt(ls('lontar_scroll_' + bookData.id) || '0', 10);
  requestAnimationFrame(() => {
    const s = document.getElementById('readerScreen');
    s.scrollTop = saved > 100 ? saved : 0;
    onReaderScroll();
  });
}

/* ════════════════════════════════════
   READING PROGRESS
════════════════════════════════════ */
function onReaderScroll() {
  const s = document.getElementById('readerScreen');
  const pct = s.scrollHeight > s.clientHeight
    ? Math.round(s.scrollTop / (s.scrollHeight - s.clientHeight) * 100) : 0;
  document.getElementById('readProgress').style.width = pct + '%';
  document.getElementById('readPct').textContent = pct > 4 ? pct + '%' : '';
}

/* ════════════════════════════════════
   CACHE
════════════════════════════════════ */
const memCache = {};
function getCachedBook(id) {
  if (memCache[id]) return memCache[id];
  try {
    const r = ls('lontar_book_' + id);
    if (r) { const d = JSON.parse(r); memCache[id] = d; return d; }
  } catch(_) {}
  return null;
}
function cacheBook(b) {
  memCache[b.id] = b;
  try {
    let json = JSON.stringify(b);
    if (json.length > 4_000_000) { const s = {...b}; delete s.original; json = JSON.stringify(s); }
    ls('lontar_book_' + b.id, json);
  } catch(_) {
    try {
      Object.keys(localStorage).filter(k => k.startsWith('lontar_book_'))
        .slice(0, -2).forEach(k => localStorage.removeItem(k));
      ls('lontar_book_' + b.id, JSON.stringify(b));
    } catch(_) {}
  }
}
function deleteCachedBook(id) {
  delete memCache[id];
  try { localStorage.removeItem('lontar_book_' + id); } catch(_) {}
}
function reloadBook() {
  if (!currentBook) return;
  deleteCachedBook(currentBook.id);
  loadById(currentBook.id);
}

/* ════════════════════════════════════
   DOWNLOAD
════════════════════════════════════ */
function downloadAs(fmt) {
  if (!currentBook) { showToast('tidak ada buku yang sedang dibaca'); return; }
  const text  = currentBook.translated || currentBook.original || '';
  const slug  = currentBook.title.toLowerCase().replace(/[^a-z0-9]+/g,'-').slice(0,40);
  let content, filename;

  if (fmt === 'txt') {
    const sep = '='.repeat(Math.min(currentBook.title.length, 60));
    content  = `${currentBook.title}\n${sep}\n${currentBook.author}\n\n${text}`;
    filename = slug + '-id.txt';
  } else {
    const body = text.split(/\n\n+/).map(b => {
      const t = b.trim();
      return (t.length < 100 && HEADING_RE.test(t)) ? `## ${t}` : t;
    }).filter(Boolean).join('\n\n');
    content  = `# ${currentBook.title}\n\n**${currentBook.author}**\n\n---\n\n${body}`;
    filename = slug + '-id.md';
  }

  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([content], {type:'text/plain;charset=utf-8'})),
    download: filename,
  });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
  showToast('↓ ' + filename);
  closeAllPanels();
}

/* ════════════════════════════════════
   UI HELPERS
════════════════════════════════════ */
function setProgress(p) { document.getElementById('progressFill').style.width = p + '%'; }
function setStatus(m)   { document.getElementById('loadingStatus').textContent = m; }

let _toast;
function showToast(msg, dur = 2500) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(_toast);
  _toast = setTimeout(() => t.classList.remove('show'), dur);
}
