// ============================================================
//  BackToNotes - app.js
//  Vanilla JS. State + render + events. Mobile-first responsive.
// ============================================================

// ============ CONSTANTS ============
const DEFAULT_COLLECTIONS = [
  { id: 'estudar',  name: 'Para Estudar',  icon: 'book-open',    color: '#b8843d', system: true },
  { id: 'estudado', name: 'Já Estudei',    icon: 'book-check',   color: '#5a7a4f', system: true },
  { id: 'escritos', name: 'Meus Escritos', icon: 'feather',      color: '#6b1f2a', system: true },
  { id: 'posts',    name: 'Posts Salvos',  icon: 'bookmark',     color: '#7a5230', system: true },
  { id: 'links',    name: 'Links',         icon: 'link',         color: '#3d5a6c', system: true },
  { id: 'prints',   name: 'Imagens',       icon: 'image',        color: '#6a5687', system: true },
];

const ITEM_TYPES = [
  { id: 'note',  label: 'Nota / Escrito', icon: 'file-text' },
  { id: 'link',  label: 'Link',           icon: 'link' },
  { id: 'post',  label: 'Post Salvo',     icon: 'bookmark' },
  { id: 'file',  label: 'Arquivo',        icon: 'folder' },
  { id: 'image', label: 'Imagem', icon: 'image' },
];

const SORT_OPTIONS = [
  { id: 'recent', label: 'recentes' },
  { id: 'oldest', label: 'mais antigos' },
  { id: 'alpha',  label: 'alfabético' },
];

const TEXT_STYLE_DEFAULT = { font: 'serif', size: 'normal', align: 'left' };
const TEXT_STYLE_OPTIONS = {
  font: [
    { id: 'serif', label: 'Serif' },
    { id: 'sans', label: 'Sans' },
    { id: 'mono', label: 'Mono' },
  ],
  size: [
    { id: 'small', label: 'P' },
    { id: 'normal', label: 'M' },
    { id: 'large', label: 'G' },
    { id: 'xlarge', label: 'GG' },
  ],
  align: [
    { id: 'left', label: 'Alinhar a esquerda', icon: 'align-left' },
    { id: 'center', label: 'Centralizar', icon: 'align-center' },
    { id: 'right', label: 'Alinhar a direita', icon: 'align-right' },
    { id: 'justify', label: 'Justificar', icon: 'align-justify' },
  ],
};

const CARD_TYPE_FILTERS = [
  { id: 'all', label: 'Tudo', icon: 'inbox' },
  { id: 'text', label: 'Texto', icon: 'file-text' },
  { id: 'print', label: 'Imagem', icon: 'image' },
  { id: 'link', label: 'Link', icon: 'link' },
  { id: 'post', label: 'Post', icon: 'bookmark' },
  { id: 'pdf', label: 'PDF', icon: 'file-text' },
  { id: 'word', label: 'Word', icon: 'file-text' },
  { id: 'document', label: 'Arquivo', icon: 'folder' },
];

const SIDEBAR_SYSTEM_TYPE_MAP = {
  posts: 'post',
  links: 'link',
  prints: 'print',
};
const DOCUMENT_KINDS = new Set(['pdf', 'word', 'file']);

const STORAGE_KEY = 'biblioteca:v1';
const ONBOARDING_KEY = 'backtonotes:onboarding:v1';
const SYNC_TABLE = 'backnotes_libraries';
const ANALYTICS_TABLE = 'backnotes_analytics_events';
const ANALYTICS_SESSION_KEY = 'backtonotes:analytics-session:v1';
const FILE_DB_NAME = 'backtonotes-files';
const FILE_DB_VERSION = 1;
const FILE_STORE = 'files';

// ============ HELPERS ============
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
const isEditableTarget = (el) => el?.closest?.('input, textarea, select, [contenteditable="true"]');
const isMobile = () => window.matchMedia('(max-width: 767.98px)').matches;

function normalizeTextStyle(style) {
  const src = style && typeof style === 'object' ? style : {};
  const pick = (group, value, fallback) =>
    TEXT_STYLE_OPTIONS[group].some(opt => opt.id === value) ? value : fallback;
  return {
    font: pick('font', src.font, TEXT_STYLE_DEFAULT.font),
    size: pick('size', src.size, TEXT_STYLE_DEFAULT.size),
    align: pick('align', src.align, TEXT_STYLE_DEFAULT.align),
  };
}

function isDefaultTextStyle(style) {
  const normalized = normalizeTextStyle(style);
  return Object.keys(TEXT_STYLE_DEFAULT).every(key => normalized[key] === TEXT_STYLE_DEFAULT[key]);
}

function textStyleClass(style) {
  const normalized = normalizeTextStyle(style);
  return `text-font-${normalized.font} text-size-${normalized.size} text-align-${normalized.align}`;
}

function icon(name, size=16) {
  return `<svg width="${size}" height="${size}"><use href="#i-${name}"/></svg>`;
}

function getDomain(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return null; }
}

function formatBytes(bytes) {
  const n = Number(bytes || 0);
  if (!n) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = n;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  const precision = value >= 10 || unit === 0 ? 0 : 1;
  return `${value.toFixed(precision)} ${units[unit]}`;
}

function openFileDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(FILE_DB_NAME, FILE_DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(FILE_STORE)) db.createObjectStore(FILE_STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function putStoredFile(file) {
  const db = await openFileDb();
  const record = {
    id: 'file_' + uid(),
    name: file.name || 'arquivo',
    type: file.type || 'application/octet-stream',
    size: file.size || 0,
    blob: file,
    createdAt: Date.now(),
  };
  await new Promise((resolve, reject) => {
    const tx = db.transaction(FILE_STORE, 'readwrite');
    tx.objectStore(FILE_STORE).put(record);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  return record;
}

async function getStoredFile(id) {
  if (!id) return null;
  const db = await openFileDb();
  const record = await new Promise((resolve, reject) => {
    const tx = db.transaction(FILE_STORE, 'readonly');
    const req = tx.objectStore(FILE_STORE).get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return record;
}

const pdfPreviewUrls = new Map();

function isPdfFileLike(file) {
  if (!file) return false;
  const type = String(file.fileType || file.type || '').toLowerCase();
  const name = String(file.fileName || file.name || '').toLowerCase();
  return type === 'application/pdf' || name.endsWith('.pdf');
}

function isImageFileLike(file) {
  if (!file) return false;
  const type = String(file.fileType || file.type || '').toLowerCase();
  const name = String(file.fileName || file.name || '').toLowerCase();
  return type.startsWith('image/') || /\.(avif|bmp|gif|heic|heif|jpe?g|png|svg|tiff?|webp)$/i.test(name);
}

function isWordFileLike(file) {
  if (!file) return false;
  const type = String(file.fileType || file.type || '').toLowerCase();
  const name = String(file.fileName || file.name || '').toLowerCase();
  return type === 'application/msword' ||
    type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    name.endsWith('.doc') ||
    name.endsWith('.docx');
}

function cardTypeKind(item) {
  if (!item) return 'file';
  if (item.imageData || item.type === 'image') return 'print';
  if (item.fileStorageId || item.type === 'file') {
    if (isPdfFileLike(item)) return 'pdf';
    if (isWordFileLike(item)) return 'word';
    return 'file';
  }
  if (item.type === 'link') return 'link';
  if (item.type === 'post') return 'post';
  if (item.type === 'note') return 'text';
  return 'file';
}

function itemMatchesKind(item, kind) {
  if (!kind || kind === 'all') return true;
  const itemKind = cardTypeKind(item);
  if (kind === 'document') return DOCUMENT_KINDS.has(itemKind);
  return itemKind === kind;
}

function rememberPdfPreviewUrl(url, scope) {
  if (!pdfPreviewUrls.has(scope)) pdfPreviewUrls.set(scope, new Set());
  pdfPreviewUrls.get(scope).add(url);
}

function revokePdfPreviewUrls(scope = null) {
  const scopes = scope ? [scope] : Array.from(pdfPreviewUrls.keys());
  scopes.forEach(key => {
    pdfPreviewUrls.get(key)?.forEach(url => URL.revokeObjectURL(url));
    pdfPreviewUrls.delete(key);
  });
}

async function hydratePdfPreviews(root = document) {
  const previews = $$('[data-pdf-preview-id]', root);
  for (const preview of previews) {
    const item = state.items.find(i => i.id === preview.dataset.pdfPreviewId) || state.viewing;
    const frame = $('iframe', preview);
    const status = $('.pdf-preview-status', preview);
    if (!item?.fileStorageId || !frame) continue;
    try {
      const record = await getStoredFile(item.fileStorageId);
      if (!record?.blob || !isPdfFileLike({ ...item, type: record.type, name: record.name })) {
        if (status) status.textContent = 'PDF nao encontrado neste navegador.';
        continue;
      }
      const url = URL.createObjectURL(record.blob);
      if (!document.body.contains(preview)) {
        URL.revokeObjectURL(url);
        continue;
      }
      rememberPdfPreviewUrl(url, preview.dataset.pdfPreviewScope || 'viewer');
      frame.src = `${url}#toolbar=0&navpanes=0`;
      preview.classList.add('is-loaded');
      if (status) status.textContent = 'Preview carregado.';
    } catch (err) {
      console.error(err);
      if (status) status.textContent = 'Nao foi possivel carregar a previa.';
    }
  }
}

function normalizeUrl(text) {
  const v = String(text || '').trim();
  if (/^https?:\/\/\S+$/i.test(v)) return v;
  if (/^[\w.-]+\.[a-z]{2,}(\/\S*)?$/i.test(v)) return 'https://' + v;
  return null;
}

function formatDate(ts) {
  if (!ts) return '';
  const now = Date.now();
  const diff = now - ts;
  const day = 86400000;
  const days = Math.floor(diff / day);
  if (days < 1) return 'hoje';
  if (days < 2) return 'ontem';
  if (days < 7) return `há ${days} dias`;
  if (days < 14) return 'há 1 sem';
  if (days < 30) return `há ${Math.floor(days/7)} sem`;
  if (days < 60) return 'há 1 mês';
  if (days < 365) return `há ${Math.floor(days/30)} meses`;
  return new Date(ts).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
}

function syncDefaultCollections(collections) {
  const existing = Array.isArray(collections) ? collections : [];
  const byId = new Map(existing.map(c => [c.id, c]));
  const systemIds = new Set(DEFAULT_COLLECTIONS.map(c => c.id));
  const systemCols = DEFAULT_COLLECTIONS.map(def => {
    const current = byId.get(def.id) || {};
    const next = { ...def, ...current, system: true };
    if (def.id === 'prints' && /^prints?$/i.test(String(current.name || ''))) next.name = def.name;
    return next;
  });
  const userCols = existing.filter(c => !systemIds.has(c.id));
  return [...systemCols, ...userCols];
}

function shortUrl(url) {
  try {
    const u = new URL(url);
    const path = (u.pathname || '').replace(/\/$/, '');
    return (u.hostname.replace(/^www\./, '') + path).slice(0, 72);
  } catch { return String(url || '').slice(0, 72); }
}

function faviconUrl(url) {
  const domain = getDomain(url);
  return domain ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64` : '';
}

// ============ PROVIDER DETECTION ============
// Recognizes the URL's source (YouTube video/short/live, TikTok video/profile,
// Instagram reel/post/story/IGTV/profile, X/Twitter post/profile, Vimeo,
// Twitch channel/clip/vod, Spotify track/album/playlist/episode).
// Returns: { provider, kind, id, user, aspect: 'h'|'v'|'s'|'c' }
// aspect drives the card layout — h: 16:9 hero, v: 9:16 poster left,
// s: 1:1 poster left, c: card-only badge (no poster).

function detectProvider(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '').replace(/^m\./, '');
    const parts = (u.pathname || '/').split('/').filter(Boolean);

    if (host === 'youtu.be') return { provider:'youtube', kind:'video', id:parts[0], aspect:'h' };
    if (host === 'youtube.com' || host === 'music.youtube.com') {
      if (u.pathname === '/watch') return { provider:'youtube', kind:'video', id:u.searchParams.get('v'), aspect:'h' };
      if (parts[0] === 'shorts') return { provider:'youtube', kind:'short', id:parts[1], aspect:'v' };
      if (parts[0] === 'embed') return { provider:'youtube', kind:'video', id:parts[1], aspect:'h' };
      if (parts[0] === 'live') return { provider:'youtube', kind:'live', id:parts[1], aspect:'h' };
    }
    if (host === 'tiktok.com' || host.endsWith('.tiktok.com')) {
      if (parts[0]?.startsWith('@') && parts[1] === 'video') return { provider:'tiktok', kind:'video', user:parts[0].slice(1), id:parts[2], aspect:'v' };
      if (parts[0]?.startsWith('@')) return { provider:'tiktok', kind:'profile', user:parts[0].slice(1), aspect:'c' };
      if (parts[0] === 'video' || parts[0] === 't') return { provider:'tiktok', kind:'video', id:parts[1], aspect:'v' };
      return { provider:'tiktok', kind:'video', aspect:'v' };
    }
    if (host === 'instagram.com') {
      if (parts[0] === 'reel' || parts[0] === 'reels') return { provider:'instagram', kind:'reel', id:parts[1], aspect:'v' };
      if (parts[0] === 'stories' && parts[1]) return { provider:'instagram', kind:'story', user:parts[1], id:parts[2], aspect:'v' };
      if (parts[0] === 'p') return { provider:'instagram', kind:'post', id:parts[1], aspect:'s' };
      if (parts[0] === 'tv') return { provider:'instagram', kind:'tv', id:parts[1], aspect:'v' };
      if (parts.length === 1 && parts[0] && !parts[0].includes('.')) return { provider:'instagram', kind:'profile', user:parts[0], aspect:'c' };
    }
    if (host === 'twitter.com' || host === 'x.com') {
      if (parts.length >= 3 && parts[1] === 'status') return { provider:'twitter', kind:'post', user:parts[0], id:parts[2], aspect:'c' };
      if (parts.length === 1 && parts[0]) return { provider:'twitter', kind:'profile', user:parts[0], aspect:'c' };
    }
    if (host === 'vimeo.com') {
      if (parts[0] && /^\d+$/.test(parts[0])) return { provider:'vimeo', kind:'video', id:parts[0], aspect:'h' };
    }
    if (host === 'fb.watch') {
      return { provider:'facebook', kind:'reel', id:parts[0], aspect:'v' };
    }
    if (host === 'facebook.com' || host.endsWith('.facebook.com')) {
      if (parts[0] === 'reel' || parts[0] === 'reels') return { provider:'facebook', kind:'reel', id:parts[1], aspect:'v' };
      if (parts[0] === 'watch') return { provider:'facebook', kind:'video', id:u.searchParams.get('v') || parts[1], aspect:'h' };
      if (parts.includes('videos')) return { provider:'facebook', kind:'video', id:parts[parts.indexOf('videos') + 1], aspect:'h' };
      if (parts[0] === 'share' && (parts[1] === 'r' || parts[1] === 'v')) return { provider:'facebook', kind:parts[1] === 'r' ? 'reel' : 'video', id:parts[2], aspect:parts[1] === 'r' ? 'v' : 'h' };
    }
    if (host === 'twitch.tv' || host.endsWith('.twitch.tv')) {
      if (parts.length === 1 && parts[0]) return { provider:'twitch', kind:'channel', user:parts[0], aspect:'h' };
      if (parts[0] === 'videos' && parts[1]) return { provider:'twitch', kind:'vod', id:parts[1], aspect:'h' };
      if (parts[1] === 'clip' || parts[0] === 'clips') return { provider:'twitch', kind:'clip', id:parts[parts.length-1], user:parts[0]!=='clips'?parts[0]:undefined, aspect:'h' };
    }
    if (host === 'open.spotify.com') {
      const kind = parts[0]; // track/album/playlist/artist/episode/show
      if (['track','album','playlist','artist','episode','show'].includes(kind) && parts[1]) {
        const aspect = kind === 'artist' ? 'c' : 's';
        return { provider:'spotify', kind, id:parts[1], aspect };
      }
    }
  } catch {}
  return null;
}

// Back-compat shim — getYouTubeId is used by card variant logic.
function getYouTubeId(url) {
  const m = detectProvider(url);
  return (m?.provider === 'youtube' && m.id) ? m.id : null;
}

function youtubeThumbUrl(id) { return `https://img.youtube.com/vi/${encodeURIComponent(id)}/hqdefault.jpg`; }

// ============ BRAND PRESENTATION ============
// Per provider+kind: label badge, gradient backdrop, accent color, optional
// sub-label. Drives the visual treatment of branded preview cards.

const BRAND_INFO = {
  'youtube:video':    { label:'Vídeo',    gradient:'linear-gradient(135deg,#3a0a0a,#cc0000 60%,#ff334a)', accent:'#ff0033', glyph:'play-rect' },
  'youtube:short':    { label:'Shorts',   gradient:'linear-gradient(180deg,#0d0d0d,#7a0a14 70%,#cc0000)', accent:'#ff0033', glyph:'play-rect' },
  'youtube:live':     { label:'Ao vivo',  gradient:'linear-gradient(135deg,#0d0d0d,#cc0000)', accent:'#ff0033', glyph:'play-rect' },

  'tiktok:video':     { label:'TikTok',   gradient:'linear-gradient(135deg,#000 0%,#0c0c0c 50%,#000 100%)', accent:'#ee1d52', glyph:'tiktok' },
  'tiktok:profile':   { label:'TikTok',   sub:'perfil', gradient:'linear-gradient(135deg,#000,#1c1c1c)', accent:'#ee1d52', glyph:'tiktok' },

  'instagram:reel':   { label:'Reel',     gradient:'linear-gradient(135deg,#feda75 0%,#fa7e1e 25%,#d62976 50%,#962fbf 75%,#4f5bd5 100%)', accent:'#d62976', glyph:'instagram' },
  'instagram:post':   { label:'Post',     gradient:'linear-gradient(135deg,#feda75 0%,#fa7e1e 25%,#d62976 55%,#962fbf 85%,#4f5bd5 100%)', accent:'#d62976', glyph:'instagram' },
  'instagram:story':  { label:'Story',    sub:'24h', gradient:'conic-gradient(from 210deg at 50% 50%, #feda75, #d62976, #962fbf, #4f5bd5, #d62976, #feda75)', accent:'#d62976', glyph:'instagram' },
  'instagram:tv':     { label:'IGTV',     gradient:'linear-gradient(135deg,#962fbf,#4f5bd5)', accent:'#962fbf', glyph:'instagram' },
  'instagram:profile':{ label:'Instagram',sub:'perfil', gradient:'linear-gradient(135deg,#feda75,#d62976 60%,#962fbf)', accent:'#d62976', glyph:'instagram' },

  'twitter:post':     { label:'X',        gradient:'linear-gradient(135deg,#000,#15202b)', accent:'#1d9bf0', glyph:'x' },
  'twitter:profile':  { label:'X',        sub:'perfil', gradient:'linear-gradient(135deg,#000,#15202b)', accent:'#1d9bf0', glyph:'x' },

  'vimeo:video':      { label:'Vimeo',    gradient:'linear-gradient(135deg,#0a1f2c 0%,#162d3a 40%,#1ab7ea 100%)', accent:'#1ab7ea', glyph:'play-rect' },

  'facebook:reel':    { label:'Reel',     sub:'Facebook', gradient:'linear-gradient(135deg,#071b46 0%,#0866ff 62%,#5aa7ff 100%)', accent:'#0866ff', glyph:'facebook' },
  'facebook:video':   { label:'Video',    sub:'Facebook', gradient:'linear-gradient(135deg,#06152f 0%,#0866ff 72%,#5aa7ff 100%)', accent:'#0866ff', glyph:'facebook' },

  'twitch:channel':   { label:'Twitch',   sub:'canal', gradient:'linear-gradient(135deg,#1f0a3d,#6441a5 60%,#9146ff)', accent:'#9146ff', glyph:'twitch' },
  'twitch:clip':      { label:'Twitch',   sub:'clip',  gradient:'linear-gradient(135deg,#1f0a3d,#9146ff)', accent:'#9146ff', glyph:'twitch' },
  'twitch:vod':       { label:'Twitch',   sub:'vídeo', gradient:'linear-gradient(135deg,#1f0a3d,#9146ff)', accent:'#9146ff', glyph:'twitch' },

  'spotify:track':    { label:'Faixa',    gradient:'linear-gradient(135deg,#063a1f,#1db954)', accent:'#1db954', glyph:'spotify' },
  'spotify:album':    { label:'Álbum',    gradient:'linear-gradient(135deg,#1a1a1a,#1db954)', accent:'#1db954', glyph:'spotify' },
  'spotify:playlist': { label:'Playlist', gradient:'linear-gradient(135deg,#3a1a3a,#1db954)', accent:'#1db954', glyph:'spotify' },
  'spotify:artist':   { label:'Artista',  gradient:'linear-gradient(135deg,#1a1a1a,#1db954)', accent:'#1db954', glyph:'spotify' },
  'spotify:episode':  { label:'Episódio', gradient:'linear-gradient(135deg,#1a1a1a,#1db954)', accent:'#1db954', glyph:'spotify' },
  'spotify:show':     { label:'Podcast',  gradient:'linear-gradient(135deg,#1a1a1a,#1db954)', accent:'#1db954', glyph:'spotify' },
};

function brandInfo(meta) {
  if (!meta) return null;
  return BRAND_INFO[`${meta.provider}:${meta.kind}`] || null;
}

// Minimal inline glyphs for branded posters. Stylized, not exact logo copies.
const BRAND_GLYPHS = {
  'play-rect': `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="1" y="5" width="22" height="14" rx="4"/><polygon points="10,9 17,12 10,15" fill="#fff"/></svg>`,
  'tiktok': `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M14.5 3v9.5a3.2 3.2 0 1 1-2.7-3.16v3.16a1 1 0 1 0 1 1V3z M15.5 5.5a4 4 0 0 0 3.5 2v2.4a6.5 6.5 0 0 1-3.5-1.07V3h-1.5v2.5z"/></svg>`,
  'instagram': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>`,
  'x': `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 3l7.5 9.6L3.5 21h2.4l5.6-6.8 5.3 6.8H21l-7.9-10L20.4 3H18l-5.2 6.3L7.8 3z"/></svg>`,
  'twitch': `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4 3h16v11l-4 4h-4l-3 3H7v-3H4zm2 2v11h3v3l3-3h4l3-3V5zm6 3h2v5h-2zm5 0h2v5h-2z"/></svg>`,
  'spotify': `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="currentColor"/><path d="M7 10.5c3.5-1 7.5-.5 10.5 1.2M7.7 13.6c2.8-.7 6-.4 8.5 1M8.2 16.4c2.2-.5 4.7-.3 6.7.8" stroke="#0a3a1a" stroke-width="1.6" stroke-linecap="round" fill="none"/></svg>`,
  'facebook': `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M13.6 20v-7h2.3l.4-2.7h-2.7V8.6c0-.8.2-1.3 1.4-1.3h1.4V4.9c-.7-.1-1.4-.1-2.1-.1-2.2 0-3.7 1.3-3.7 3.7v1.8H8.2V13h2.4v7z" fill="#fff"/></svg>`,
};

function brandGlyph(name, size = 24) {
  const svg = BRAND_GLYPHS[name] || BRAND_GLYPHS['play-rect'];
  return svg.replace('<svg ', `<svg width="${size}" height="${size}" `);
}

// ============ LINK PREVIEW (provider-aware) ============
function renderLinkPreview(url, extraClass='', thumbUrl=null) {
  const domain = getDomain(url);
  if (!domain) return '';

  const meta = detectProvider(url);
  const youtubeId = getYouTubeId(url);

  // YouTube videos — full 16:9 hero treatment with real thumb.
  if (youtubeId && meta?.kind === 'video') {
    return `
      <a class="link-preview video-preview ${extraClass}" href="${esc(url)}" target="_blank" rel="noopener" data-stop draggable="false">
        <span class="video-thumb-wrap">
          <img class="video-thumb" src="${esc(youtubeThumbUrl(youtubeId))}" alt="" draggable="false">
          <span class="video-play" aria-hidden="true"></span>
        </span>
        <span class="link-preview-text">
          <span class="link-preview-domain">${esc(domain)}</span>
          <span class="link-preview-url">${esc(shortUrl(url))}</span>
        </span>
      </a>`;
  }

  // Vimeo with a real thumb (from oEmbed) — also use the 16:9 hero.
  if (meta?.provider === 'vimeo' && meta.kind === 'video' && thumbUrl) {
    return `
      <a class="link-preview video-preview vimeo-preview ${extraClass}" href="${esc(url)}" target="_blank" rel="noopener" data-stop draggable="false">
        <span class="video-thumb-wrap">
          <img class="video-thumb" src="${esc(thumbUrl)}" alt="" draggable="false" referrerpolicy="no-referrer">
          <span class="video-play vimeo-play" aria-hidden="true"></span>
        </span>
        <span class="link-preview-text">
          <span class="link-preview-domain" style="color:#1ab7ea">${esc(domain)}</span>
          <span class="link-preview-url">${esc(shortUrl(url))}</span>
        </span>
      </a>`;
  }

  // Any other recognized provider — branded poster, with real thumb if we have one.
  const info = brandInfo(meta);
  if (info) {
    const aspectClass = `aspect-${meta.aspect}`;
    const userLine = meta.user ? `<span class="branded-user">@${esc(meta.user)}</span>` : '';
    const subBadge = info.sub ? `<span class="branded-sub">${esc(info.sub)}</span>` : '';
    const realThumb = thumbUrl || (youtubeId && meta.kind === 'short' ? youtubeThumbUrl(youtubeId) : null);
    const thumbHtml = realThumb
      ? `<img class="branded-thumb" src="${esc(realThumb)}" alt="" draggable="false" referrerpolicy="no-referrer"><span class="branded-veil"></span>`
      : '';
    const glyphSize = meta.aspect === 'c' ? 18 : 28;
    const glyphHtml = realThumb && meta.aspect !== 'c' ? '' : `<span class="branded-glyph">${brandGlyph(info.glyph, glyphSize)}</span>`;
    return `
      <a class="link-preview branded ${aspectClass} ${extraClass}" href="${esc(url)}" target="_blank" rel="noopener" data-stop draggable="false">
        <span class="branded-poster" style="background:${info.gradient}">
          ${thumbHtml}
          ${glyphHtml}
          ${userLine}
          <span class="branded-badge">${esc(info.label)}${subBadge}</span>
        </span>
        <span class="link-preview-text">
          <span class="link-preview-domain" style="color:${info.accent}">${esc(domain)}</span>
          <span class="link-preview-url">${esc(shortUrl(url))}</span>
        </span>
      </a>`;
  }

  // Fallback: favicon-only link preview.
  return `
    <a class="link-preview ${extraClass}" href="${esc(url)}" target="_blank" rel="noopener" data-stop draggable="false">
      <img class="link-favicon" src="${esc(faviconUrl(url))}" alt="" draggable="false">
      <span class="link-preview-text">
        <span class="link-preview-domain">${esc(domain)}</span>
        <span class="link-preview-url">${esc(shortUrl(url))}</span>
      </span>
    </a>`;
}

const oembedCache = new Map();
const microlinkCache = new Map();
let oembedTitleTimer = null;
let oembedTitleSeq = 0;

const OEMBED_ENDPOINTS = {
  youtube: (url) => `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
  tiktok:  (url) => `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`,
  vimeo:   (url) => `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`,
  spotify: (url) => `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`,
};

// Providers that don't have a public oEmbed (or it requires auth). Fall back
// to microlink.io's free metadata endpoint, which scrapes og:image and the
// like. 50 req/day on the free tier, which is plenty for a personal lib.
const MICROLINK_PROVIDERS = new Set(['instagram', 'twitch', 'twitter', 'facebook']);

async function fetchMicrolinkMeta(url) {
  if (!url) return null;
  if (microlinkCache.has(url)) return microlinkCache.get(url);
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(url)}`, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) throw new Error('microlink failed');
    const data = await res.json();
    if (data.status !== 'success' || !data.data) throw new Error('microlink bad payload');
    let thumb = data.data.image?.url || data.data.logo?.url || null;
    // Microlink returns a tiny inline data: URL for IG/X when it can't reach the
    // real og:image. That fallback is useless — drop it so we fall through to
    // the og:image scrape.
    if (thumb && thumb.startsWith('data:')) thumb = null;
    const result = {
      title: String(data.data.title || '').trim() || null,
      thumb,
      author: data.data.author || null,
    };
    microlinkCache.set(url, result);
    return result;
  } catch (e) {
    microlinkCache.set(url, null);
    return null;
  }
}

// Generic og:image scrape via CORS proxy. Works for any public page that
// emits Open Graph meta tags — Instagram, Twitch, X, news sites, blog posts.
// We try a couple of free proxies in series so a single outage doesn't take
// thumb fetching down entirely.
const ogCache = new Map();
const CORS_PROXIES = [
  // codetabs is reliable and CORS-permissive — primary path.
  (url) => ({ url: `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(url)}`, json: false }),
  // allorigins as a backup (sometimes flaky from sandbox origins).
  (url) => ({ url: `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`, json: false }),
  (url) => ({ url: `https://api.allorigins.win/get?url=${encodeURIComponent(url)}&charset=utf8`, json: true, field: 'contents' }),
];

function decodeHtmlEntities(s) {
  return String(s ?? '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'");
}

function extractMeta(html, prop) {
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${prop}["']`, 'i'),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) return decodeHtmlEntities(m[1]);
  }
  return null;
}

async function fetchOgImage(url) {
  if (!url) return null;
  if (ogCache.has(url)) return ogCache.get(url);
  // Known thumb URLs that are just provider placeholders (Instagram logo,
  // favicon, generic icon) — these mean the real content is gated or the
  // page requires JS to render. Reject so the gradient fallback shows
  // instead of a useless logo.
  const PLACEHOLDER_PATTERNS = [
    /static\.cdninstagram\.com\/rsrc\.php/i,   // IG generic logo
    /instagram\.com\/static\/images/i,
    /\/favicon\.ico(\?|$)/i,                    // favicons
    /abs\.twimg\.com\/icons/i,                  // X site icon
    /abs\.twimg\.com\/responsive-web/i,         // X generic asset
    /www\.gstatic\.com\/youtube/i,
  ];
  for (const proxyFn of CORS_PROXIES) {
    const cfg = proxyFn(url);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 7500);
      const res = await fetch(cfg.url, { signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) continue;
      let html;
      if (cfg.json) {
        const j = await res.json();
        html = j[cfg.field] || '';
      } else {
        html = await res.text();
      }
      if (typeof html !== 'string' || html.length < 50) continue;
      const thumbRaw = extractMeta(html, 'og:image') || extractMeta(html, 'twitter:image');
      const title = extractMeta(html, 'og:title') || extractMeta(html, 'twitter:title');
      if (thumbRaw && !PLACEHOLDER_PATTERNS.some((re) => re.test(thumbRaw))) {
        const result = { title, thumb: thumbRaw, author: null };
        ogCache.set(url, result);
        return result;
      }
    } catch (e) { /* try next proxy */ }
  }
  ogCache.set(url, null);
  return null;
}

// Generic oEmbed fetcher. Returns { title, thumb, author } or null.
// Caches by URL so repeated paste/render doesn't re-hit the network.
// Tries direct fetch first; if that fails (CORS, network), proxies via the
// same CORS proxy used for og:image — many oEmbed endpoints don't set the
// right headers when called from a browser origin.
async function fetchOEmbedMeta(url) {
  if (!url) return null;
  if (oembedCache.has(url)) return oembedCache.get(url);
  const meta = detectProvider(url);
  const provider = meta?.provider;
  const endpointFn = provider && OEMBED_ENDPOINTS[provider];
  if (!endpointFn) { oembedCache.set(url, null); return null; }
  const endpoint = endpointFn(url);
  const attempts = [
    () => fetch(endpoint),
    () => fetch(`https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(endpoint)}`),
  ];
  for (const attempt of attempts) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      const res = await attempt({ signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) continue;
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch { continue; }
      // Some providers respond with {code: 400, message: ...} for missing
      // content. Treat any non-200-shaped payload as a miss.
      if (data.code && Number(data.code) >= 400) continue;
      if (!data.thumbnail_url && !data.title) continue;
      const result = {
        title: String(data.title || '').trim() || null,
        thumb: data.thumbnail_url || null,
        author: data.author_name || null,
      };
      oembedCache.set(url, result);
      return result;
    } catch (e) { /* try next attempt */ }
  }
  oembedCache.set(url, null);
  return null;
}

// Unified provider metadata. Tries oEmbed first (YouTube/TikTok/Vimeo/Spotify),
// then og:image scraping via CORS proxy for IG/Twitch/X, then microlink as a
// last resort. Returns { title, thumb, author } or null.
async function fetchProviderMetadata(url) {
  const oe = await fetchOEmbedMeta(url);
  if (oe?.thumb) return oe;
  const detected = detectProvider(url);
  if (detected && MICROLINK_PROVIDERS.has(detected.provider)) {
    // Scrape og:image directly — most reliable for IG/Twitch/X public pages.
    const og = await fetchOgImage(url);
    if (og?.thumb) {
      return {
        title: oe?.title || og.title,
        thumb: og.thumb,
        author: oe?.author || null,
      };
    }
    // Last-ditch fallback: microlink (limited but sometimes works).
    const ml = await fetchMicrolinkMeta(url);
    if (ml?.thumb) {
      return {
        title: oe?.title || ml.title,
        thumb: ml.thumb,
        author: oe?.author || ml.author,
      };
    }
  }
  return oe;
}

function shouldDeferProviderMetadata(url) {
  const detected = detectProvider(url);
  return detected && MICROLINK_PROVIDERS.has(detected.provider);
}

async function quickProviderMetadata(url) {
  return shouldDeferProviderMetadata(url) ? null : await fetchProviderMetadata(url);
}

// Back-compat shim — older code asked for the title only.
async function fetchYouTubeTitle(url) {
  const m = await fetchProviderMetadata(url);
  return m?.title || null;
}

function canAutoFillTitle() {
  const titleEl = $('#f-title');
  if (!titleEl) return false;
  return !titleEl.value.trim() || titleEl.dataset.autoTitle === 'true';
}

// Schedules an oEmbed fetch when the user types a URL into the editor.
// When it resolves, fills in the title and stashes the thumbnail on the
// draft so the saved item picks it up.
function scheduleOEmbedFill(url) {
  clearTimeout(oembedTitleTimer);
  const currentSeq = ++oembedTitleSeq;
  oembedTitleTimer = setTimeout(async () => {
    const normalized = normalizeUrl(url);
    if (!normalized || !detectProvider(normalized)) return;
    const meta = await fetchProviderMetadata(normalized);
    if (!meta || currentSeq !== oembedTitleSeq) return;
    const urlEl = $('#f-url');
    const titleEl = $('#f-title');
    if (!urlEl || normalizeUrl(urlEl.value) !== normalized) return;
    if (meta.title && titleEl && canAutoFillTitle()) {
      titleEl.value = meta.title;
      titleEl.dataset.autoTitle = 'true';
      if (modalDraft) modalDraft.title = meta.title;
    }
    if (modalDraft && meta.thumb) modalDraft.thumbUrl = meta.thumb;
  }, 350);
}

// Back-compat alias used elsewhere in the file.
const scheduleYouTubeTitleFill = scheduleOEmbedFill;

// ============ STATE ============
let state = {
  items: [],
  collections: [...DEFAULT_COLLECTIONS],
  activeCol: 'all',
  activeTag: null,
  activeKind: 'all',
  sortMode: 'recent',
  search: '',
  editing: null,
  viewing: null,
  quickAdd: null,
  newFolder: null,
  selectMode: false,
  selectedIds: [],
  showSearch: false,
  showSidebar: false,
  showOnboarding: false,
  showStats: false,
  loading: true,
};

let saveTimer;
let saveErrorShown = false;
let syncTimer;
let suppressCloudPush = false;
let pageViewTracked = false;
let analyticsBlocked = false;
const syncState = {
  client: null,
  configured: false,
  user: null,
  busy: false,
  status: 'offline',
  lastSync: null,
  lastError: '',
};
const analyticsState = {
  loading: false,
  error: '',
  events: [],
  lastLoaded: null,
};

function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      await externalizeImagesForStorage();
      const payload = JSON.stringify({
        items: persistableItems(),
        collections: state.collections,
      });
      try {
        localStorage.setItem(STORAGE_KEY, payload);
      } catch (err) {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.setItem(STORAGE_KEY, payload);
      }
      saveErrorShown = false;
    } catch (e) {
      console.error('Save failed:', e);
      if (!saveErrorShown) {
        saveErrorShown = true;
        showToast('Não foi possível salvar. Libere espaço ou remova imagens grandes.', 5000);
      }
    }
  }, 250);
}

function persistableItems(items = state.items) {
  return items.map(item => {
    if (!item?.imageData || !item.imageStorageId) return item;
    const { imageData, originalImageData, cropRect, ...rest } = item;
    return rest;
  });
}

async function dataUrlToBlob(dataUrl) {
  const res = await fetch(dataUrl);
  return await res.blob();
}

async function putStoredDataUrl(dataUrl, name = 'imagem') {
  const blob = await dataUrlToBlob(dataUrl);
  const ext = blob.type?.split('/')[1]?.replace('jpeg', 'jpg') || 'png';
  const filename = /\.[a-z0-9]+$/i.test(name) ? name : `${name}.${ext}`;
  const file = new File([blob], filename, { type: blob.type || 'image/png' });
  return await putStoredFile(file);
}

async function externalizeImagesForStorage() {
  let changed = false;
  for (const item of state.items) {
    if (!item?.imageData || item.imageStorageId) continue;
    const safeName = item.fileName || item.title || 'imagem';
    const stored = await putStoredDataUrl(item.imageData, safeName);
    item.imageStorageId = stored.id;
    item.imageFileName = stored.name;
    item.imageFileType = stored.type;
    item.imageFileSize = stored.size;
    changed = true;
  }
  return changed;
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function hydrateStoredImages() {
  const missing = state.items.filter(item => item?.imageStorageId && !item.imageData);
  if (!missing.length) return;
  let changed = false;
  for (const item of missing) {
    try {
      const stored = await getStoredFile(item.imageStorageId);
      if (!stored?.blob) continue;
      item.imageData = await blobToDataUrl(stored.blob);
      changed = true;
    } catch (err) {
      console.warn('Image hydrate failed:', err);
    }
  }
  if (changed) renderAll();
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (Array.isArray(data.items)) state.items = data.items;
      if (Array.isArray(data.collections) && data.collections.length) state.collections = data.collections;
    }
  } catch (e) { console.error('Load failed:', e); }
  state.collections = syncDefaultCollections(state.collections);
  // Scrub data: URL thumbs left over from older Microlink fallbacks — those
  // were never real images, just generic provider placeholders.
  state.items = state.items.map(it =>
    (it.thumbUrl && it.thumbUrl.startsWith('data:')) ? { ...it, thumbUrl: null, thumbFailed: false } : it
  );
  state.loading = false;
  state.showOnboarding = !localStorage.getItem(ONBOARDING_KEY);
}

function closeOnboarding() {
  state.showOnboarding = false;
  try { localStorage.setItem(ONBOARDING_KEY, 'seen'); } catch {}
  renderOnboarding();
}

function openOnboarding() {
  closeSyncPanel();
  state.showOnboarding = true;
  renderOnboarding();
}

function syncConfig() {
  const cfg = window.BACKNOTES_SUPABASE || {};
  const ownerEmails = Array.isArray(cfg.ownerEmails) ? cfg.ownerEmails : [];
  return {
    url: String(cfg.url || '').trim(),
    anonKey: String(cfg.anonKey || '').trim(),
    ownerEmails: ownerEmails.map(email => String(email || '').trim().toLowerCase()).filter(Boolean),
  };
}

function canUseSync() {
  const cfg = syncConfig();
  return !!(cfg.url && cfg.anonKey);
}

function analyticsSessionId() {
  try {
    let id = localStorage.getItem(ANALYTICS_SESSION_KEY);
    if (!id) {
      id = 's_' + uid();
      localStorage.setItem(ANALYTICS_SESSION_KEY, id);
    }
    return id;
  } catch {
    return 's_' + uid();
  }
}

function isStatsOwner() {
  const email = String(syncState.user?.email || '').trim().toLowerCase();
  if (!email) return false;
  const owners = syncConfig().ownerEmails;
  return owners.length > 0 && owners.includes(email);
}

function analyticsMetadata(extra = {}) {
  return {
    active_col: state.activeCol,
    active_kind: state.activeKind,
    viewport: isMobile() ? 'mobile' : 'desktop',
    width: window.innerWidth || 0,
    height: window.innerHeight || 0,
    ...extra,
  };
}

async function trackEvent(eventName, eventTarget = '', metadata = {}) {
  if (analyticsBlocked || !syncState.client || !syncState.configured) return;
  const name = String(eventName || '').slice(0, 80);
  if (!name) return;
  try {
    await syncState.client.from(ANALYTICS_TABLE).insert({
      session_id: analyticsSessionId(),
      user_id: syncState.user?.id || null,
      event_name: name,
      event_target: String(eventTarget || '').slice(0, 120),
      path: `${location.pathname}${location.search}`.slice(0, 220),
      metadata: analyticsMetadata(metadata),
      user_agent: navigator.userAgent.slice(0, 260),
    });
  } catch (err) {
    const message = String(err?.message || err || '');
    if (/relation .* does not exist|schema cache|backnotes_analytics_events|permission denied|row-level security/i.test(message)) {
      analyticsBlocked = true;
    }
    // Analytics should never interrupt saving notes or browsing.
    console.warn('Analytics event skipped:', err);
  }
}

function trackPageViewOnce() {
  if (pageViewTracked) return;
  pageViewTracked = true;
  trackEvent('page_view', 'app', {
    referrer: document.referrer ? document.referrer.slice(0, 220) : '',
    title: document.title,
  });
}

function summarizeAnalytics(events = []) {
  const now = Date.now();
  const dayMs = 86400000;
  const since = (days) => events.filter(e => new Date(e.created_at).getTime() >= now - (days * dayMs));
  const uniqueSessions = (rows) => new Set(rows.map(e => e.session_id).filter(Boolean)).size;
  const countBy = (rows, keyFn) => {
    const map = new Map();
    rows.forEach(row => {
      const key = keyFn(row);
      if (!key) return;
      map.set(key, (map.get(key) || 0) + 1);
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  };
  const last24h = since(1);
  const last7d = since(7);
  const last30d = since(30);
  const actions = countBy(events.filter(e => e.event_name === 'action'), e => e.event_target).slice(0, 8);
  const cards = countBy(events.filter(e => e.event_name === 'card_saved'), e => e.event_target || e.metadata?.type).slice(0, 6);
  const devices = countBy(events, e => e.metadata?.viewport || 'desconhecido');
  return {
    totalEvents: events.length,
    visitors24h: uniqueSessions(last24h),
    visitors7d: uniqueSessions(last7d),
    visitors30d: uniqueSessions(last30d),
    actions,
    cards,
    devices,
  };
}

async function loadAnalyticsPanel() {
  state.showStats = true;
  if (!isStatsOwner()) {
    analyticsState.error = 'Entre com o e-mail dono configurado para ver as estatisticas.';
    analyticsState.events = [];
    renderStatsPanel();
    return;
  }
  if (!syncState.client) {
    analyticsState.error = 'Supabase ainda nao carregou.';
    renderStatsPanel();
    return;
  }
  analyticsState.loading = true;
  analyticsState.error = '';
  renderStatsPanel();
  try {
    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    const { data, error } = await syncState.client
      .from(ANALYTICS_TABLE)
      .select('created_at,session_id,event_name,event_target,metadata')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(2500);
    if (error) throw error;
    analyticsState.events = Array.isArray(data) ? data : [];
    analyticsState.lastLoaded = Date.now();
  } catch (err) {
    console.error(err);
    analyticsState.error = readableSyncError(err) || 'Nao foi possivel carregar as estatisticas.';
  } finally {
    analyticsState.loading = false;
    renderStatsPanel();
  }
}

function closeStatsPanel() {
  state.showStats = false;
  renderStatsPanel();
}

function loadSupabaseClient() {
  if (window.supabase?.createClient) return Promise.resolve(true);
  return new Promise((resolve) => {
    const existing = document.querySelector('script[data-supabase-js]');
    if (existing) {
      existing.addEventListener('load', () => resolve(!!window.supabase?.createClient), { once: true });
      existing.addEventListener('error', () => resolve(false), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
    script.async = true;
    script.dataset.supabaseJs = 'true';
    script.onload = () => resolve(!!window.supabase?.createClient);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}

function librarySnapshot() {
  return {
    version: 2,
    updatedAt: new Date().toISOString(),
    items: persistableItems(),
    collections: state.collections,
  };
}

function mergeLibrarySnapshots(localData, remoteData) {
  const itemMap = new Map();
  [...(remoteData?.items || []), ...(localData?.items || [])].forEach(item => {
    if (!item) return;
    const id = item.id || uid();
    const prev = itemMap.get(id);
    const itemTime = Number(item.updatedAt || item.createdAt || 0);
    const prevTime = Number(prev?.updatedAt || prev?.createdAt || 0);
    if (!prev || itemTime >= prevTime) itemMap.set(id, { ...item, id });
  });
  const colMap = new Map();
  [...syncDefaultCollections(remoteData?.collections || []), ...(localData?.collections || [])].forEach(col => {
    if (col?.id) colMap.set(col.id, col);
  });
  return {
    items: [...itemMap.values()],
    collections: syncDefaultCollections([...colMap.values()]),
  };
}

function applyLibraryData(data) {
  if (!data || !Array.isArray(data.items)) return false;
  state.items = data.items;
  state.collections = syncDefaultCollections(Array.isArray(data.collections) ? data.collections : state.collections);
  state.activeCol = 'all';
  state.activeKind = 'all';
  state.activeTag = null;
  state.selectedIds = [];
  state.selectMode = false;
  suppressCloudPush = true;
  persist();
  setTimeout(() => { suppressCloudPush = false; }, 400);
  return true;
}

function setSyncStatus(status, error = '') {
  syncState.status = status;
  syncState.lastError = error;
  renderApp();
}

function syncLabel() {
  if (!syncState.configured) return 'Configurar';
  if (!syncState.user) return 'Entrar';
  if (syncState.busy) return 'Sync...';
  return 'Sync';
}

function syncTitle() {
  if (!syncState.configured) return 'Configurar Supabase';
  if (!syncState.user) return 'Entrar para sincronizar';
  return syncState.lastSync ? `Sincronizado ${formatDate(syncState.lastSync)}` : 'Sincronizar agora';
}

function readableSyncError(err) {
  const message = String(err?.message || err || '');
  const code = String(err?.error_code || err?.code || '');
  if (/failed to fetch|networkerror|load failed/i.test(message)) {
    return 'Nao consegui conectar ao Supabase. Confira se o Project URL esta correto em supabase-config.js.';
  }
  if (/relation .* does not exist|schema cache|backnotes_analytics_events/i.test(message)) {
    return 'A tabela de estatisticas ainda nao existe. Rode o supabase-schema.sql atualizado no SQL Editor.';
  }
  if (/permission denied|row-level security|not authorized|violates row-level/i.test(message)) {
    return 'Seu usuario nao tem permissao para ver este painel. Confira o e-mail dono no supabase-schema.sql.';
  }
  if (/weak_password/i.test(code) || /password.*at least 6 characters/i.test(message)) {
    return 'A senha precisa ter pelo menos 6 caracteres.';
  }
  if (/email.*invalid|invalid.*email/i.test(`${code} ${message}`)) {
    return 'Digite um e-mail valido para criar a conta.';
  }
  if (/user_already_exists|already registered|already exists/i.test(`${code} ${message}`)) {
    return 'Este e-mail ja tem uma conta. Use Entrar.';
  }
  if (/signup.*disabled|signups not allowed/i.test(`${code} ${message}`)) {
    return 'A criacao de contas esta desativada no Supabase.';
  }
  if (/rate limit|too many/i.test(message)) {
    return 'Muitas tentativas em pouco tempo. Aguarde um pouco e tente novamente.';
  }
  return message || 'Erro de sincronizacao';
}

function scheduleCloudPush() {
  // BackToNotes is local-first: user data is saved in this browser.
  // Cloud sync only runs when the user explicitly clicks "Sincronizar agora".
}

async function pushLibraryToCloud({ silent = false } = {}) {
  if (!syncState.client || !syncState.user || syncState.busy) return;
  syncState.busy = true;
  if (!silent) setSyncStatus('syncing');
  try {
    const { error } = await syncState.client.from(SYNC_TABLE).upsert({
      user_id: syncState.user.id,
      data: librarySnapshot(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
    if (error) throw error;
    syncState.lastSync = Date.now();
    syncState.status = 'online';
    syncState.lastError = '';
    if (!silent) showToast('Biblioteca sincronizada');
  } catch (err) {
    console.error(err);
    syncState.status = 'error';
    syncState.lastError = readableSyncError(err);
    if (!silent) showToast(syncState.lastError || 'Nao foi possivel sincronizar');
  } finally {
    syncState.busy = false;
    renderApp();
  }
}

async function pullLibraryFromCloud({ merge = true, silent = false } = {}) {
  if (!syncState.client || !syncState.user || syncState.busy) return;
  syncState.busy = true;
  if (!silent) setSyncStatus('syncing');
  try {
    const { data, error } = await syncState.client
      .from(SYNC_TABLE)
      .select('data,updated_at')
      .eq('user_id', syncState.user.id)
      .maybeSingle();
    if (error) throw error;
    if (data?.data) {
      const nextData = merge ? mergeLibrarySnapshots(librarySnapshot(), data.data) : data.data;
      applyLibraryData(nextData);
    }
    syncState.lastSync = Date.now();
    syncState.status = 'online';
    syncState.lastError = '';
    syncState.busy = false;
    await pushLibraryToCloud({ silent: true });
    syncState.busy = true;
  } catch (err) {
    console.error(err);
    syncState.status = 'error';
    syncState.lastError = readableSyncError(err);
    if (!silent) showToast(syncState.lastError || 'Nao foi possivel baixar o sync');
  } finally {
    syncState.busy = false;
    renderAll();
  }
}

async function initSync() {
  syncState.configured = canUseSync();
  if (!syncState.configured) {
    syncState.status = 'offline';
    renderApp();
    return;
  }
  const cfg = syncConfig();
  const loaded = await loadSupabaseClient();
  if (!loaded) {
    syncState.status = 'error';
    syncState.lastError = 'Nao foi possivel carregar o Supabase JS';
    renderApp();
    return;
  }
  syncState.client = window.supabase.createClient(cfg.url, cfg.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  const { data } = await syncState.client.auth.getSession();
  syncState.user = data.session?.user || null;
  syncState.status = syncState.user ? 'online' : 'offline';
  syncState.client.auth.onAuthStateChange((_event, session) => {
    syncState.user = session?.user || null;
    syncState.status = syncState.user ? 'online' : 'offline';
    renderApp();
  });
  renderApp();
  trackPageViewOnce();
}

// ============ THUMB ENRICHMENT ============
// Fetches a thumbnail for any item with a URL but no cached thumb. Used to
// backfill IG/Twitch/X items where the thumb requires a network call.
// Persists silently and re-renders when results arrive.

const enrichInFlight = new Set();

async function enrichItemAsync(itemId) {
  if (enrichInFlight.has(itemId)) return;
  const it = state.items.find(i => i.id === itemId);
  if (!it || !it.url || it.thumbUrl || it.thumbFailed) return;
  if (!detectProvider(it.url)) return;
  enrichInFlight.add(itemId);
  try {
    const meta = await fetchProviderMetadata(it.url);
    const after = state.items.find(i => i.id === itemId);
    if (!after) return;
    if (meta?.thumb) {
      state.items = state.items.map(i =>
        i.id === itemId ? { ...i, thumbUrl: meta.thumb, ...(i.title ? {} : { title: meta.title || i.title }) } : i
      );
      persist();
      renderApp();
    } else {
      // Mark as attempted so we don't keep retrying.
      state.items = state.items.map(i => i.id === itemId ? { ...i, thumbFailed: true } : i);
      persist();
    }
  } finally {
    enrichInFlight.delete(itemId);
  }
}

// Called on boot — walks existing items and backfills any thumbs we can.
// Throttled to a small concurrency so a big library doesn't slam the network.
async function enrichLibrary() {
  const pending = state.items.filter(i => i.url && !i.thumbUrl && !i.thumbFailed && detectProvider(i.url));
  if (!pending.length) return;
  const CONCURRENCY = 3;
  let cursor = 0;
  const next = async () => {
    while (cursor < pending.length) {
      const it = pending[cursor++];
      await enrichItemAsync(it.id);
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, next));
}

// ============ MUTATIONS ============
function saveItem(item) {
  const exists = state.items.find(i => i.id === item.id);
  const now = Date.now();
  if (exists) {
    state.items = state.items.map(i => i.id === item.id ? { ...item, updatedAt: now } : i);
  } else {
    state.items = [{ ...item, id: uid(), createdAt: now, updatedAt: now }, ...state.items];
  }
  state.editing = null;
  state.viewing = null;
  state.quickAdd = null;
  persist();
  renderAll();
  // Kick off thumb enrichment if this item has a URL and no thumb yet.
  const saved = state.items.find(i => i.id === (item.id || state.items[0]?.id));
  if (saved) trackEvent('card_saved', cardTypeKind(saved), { type: saved.type || '', has_file: !!saved.fileStorageId, has_image: !!saved.imageData });
  if (saved?.url && !saved.thumbUrl && !saved.thumbFailed) {
    enrichItemAsync(saved.id);
  }
}

function toggleItemPin(id) {
  const item = state.items.find(i => i.id === id);
  if (!item) return;
  const pinnedAt = item.pinnedAt ? null : Date.now();
  state.items = state.items.map(i => i.id === id ? { ...i, pinnedAt } : i);
  if (state.viewing?.id === id) state.viewing = { ...state.viewing, pinnedAt };
  persist();
  renderAll();
  showToast(pinnedAt ? 'Card fixado na tela inicial' : 'Card desafixado');
}

function toggleCollectionPin(id) {
  const col = state.collections.find(c => c.id === id);
  if (!col || col.system) return;
  const pinnedAt = col.pinnedAt ? null : Date.now();
  state.collections = state.collections.map(c => c.id === id ? { ...c, pinnedAt } : c);
  persist();
  renderApp();
  showToast(pinnedAt ? 'Pasta fixada no sidebar' : 'Pasta desafixada');
}

// ============ CONFIRM DIALOG ============
// Custom modal-style yes/no prompt that matches the app's design, replacing
// the native browser confirm() popup. Renders into #confirm-root so it can
// layer on top of any open modal (e.g. confirming a delete from inside the
// editor). Returns a Promise<boolean>.
function confirmDialog({ title, message, confirmText = 'Confirmar', cancelText = 'Cancelar', danger = false } = {}) {
  return new Promise((resolve) => {
    const root = $('#confirm-root');
    if (!root) { resolve(window.confirm(message || title)); return; }
    const overlayKind = isMobile() ? 'bottom-sheet' : 'center';
    root.innerHTML = `
      <div class="overlay ${overlayKind} confirm-overlay" data-confirm-overlay>
        <div class="panel confirm-panel" data-stop-prop role="alertdialog" aria-modal="true">
          ${isMobile() ? '<div class="sheet-grip"></div>' : ''}
          <div class="confirm-body">
            <h3 class="confirm-title">${esc(title)}</h3>
            ${message ? `<p class="confirm-message">${esc(message)}</p>` : ''}
          </div>
          <div class="confirm-actions">
            <button class="confirm-btn confirm-cancel" data-confirm-action="cancel">${esc(cancelText)}</button>
            <button class="confirm-btn ${danger ? 'danger' : 'primary'}" data-confirm-action="ok" autofocus>${esc(confirmText)}</button>
          </div>
        </div>
      </div>
    `;
    const cleanup = (result) => {
      root.innerHTML = '';
      document.removeEventListener('keydown', onKey);
      resolve(result);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cleanup(false); }
      if (e.key === 'Enter') { e.preventDefault(); cleanup(true); }
    };
    document.addEventListener('keydown', onKey, true);
    root.querySelectorAll('[data-confirm-action]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        cleanup(btn.dataset.confirmAction === 'ok');
      });
    });
    root.querySelector('[data-confirm-overlay]').addEventListener('click', (e) => {
      if (e.target.closest('[data-stop-prop]')) return;
      cleanup(false);
    });
    setTimeout(() => root.querySelector('[data-confirm-action="ok"]')?.focus(), 50);
  });
}

function deleteItem(id) {
  const item = state.items.find(i => i.id === id);
  if (!item) return;
  // If item is already in trash, ask to permanently delete. Otherwise
  // move it to trash (soft delete — keeps it recoverable for 30 days).
  const isAlreadyTrashed = !!item.deletedAt;
  const titlePreview = (item.title || '').trim().slice(0, 60) || 'este item';
  confirmDialog({
    title: isAlreadyTrashed ? 'Apagar definitivamente?' : 'Mover para a lixeira?',
    message: isAlreadyTrashed
      ? `“${titlePreview}” será apagado para sempre. Esta ação não pode ser desfeita.`
      : `“${titlePreview}” fica na lixeira por 30 dias antes de ser apagado.`,
    confirmText: isAlreadyTrashed ? 'Apagar para sempre' : 'Mover para lixeira',
    cancelText: 'Cancelar',
    danger: true,
  }).then((ok) => {
    if (!ok) return;
    if (isAlreadyTrashed) {
      state.items = state.items.filter(i => i.id !== id);
    } else {
      state.items = state.items.map(i =>
        i.id === id ? { ...i, deletedAt: Date.now() } : i
      );
    }
    state.editing = null;
    state.viewing = null;
    state.quickAdd = null;
    persist();
    renderAll();
  });
}

function restoreItem(id) {
  state.items = state.items.map(i => i.id === id ? { ...i, deletedAt: null } : i);
  state.viewing = null;
  persist();
  renderAll();
  showToast('Item restaurado');
}

function emptyTrash() {
  const trashed = state.items.filter(i => i.deletedAt);
  if (!trashed.length) return;
  confirmDialog({
    title: 'Esvaziar lixeira?',
    message: `${trashed.length} ${trashed.length === 1 ? 'item será apagado' : 'itens serão apagados'} para sempre.`,
    confirmText: 'Esvaziar',
    cancelText: 'Cancelar',
    danger: true,
  }).then((ok) => {
    if (!ok) return;
    state.items = state.items.filter(i => !i.deletedAt);
    persist();
    renderAll();
  });
}

function toggleStudied(id) {
  state.items = state.items.map(i => {
    if (i.id !== id) return i;
    const newCol = i.collection === 'estudado' ? 'estudar' : 'estudado';
    return { ...i, collection: newCol, updatedAt: Date.now() };
  });
  persist();
  renderApp();
}

function moveItemToCollection(itemId, collectionId, opts = {}) {
  if (!state.collections.some(c => c.id === collectionId)) return;
  const item = state.items.find(i => i.id === itemId);
  if (!item || item.collection === collectionId) return;
  const fromCol = state.collections.find(c => c.id === item.collection);
  const toCol = state.collections.find(c => c.id === collectionId);

  state.items = state.items.map(i =>
    i.id === itemId ? { ...i, collection: collectionId, updatedAt: Date.now() } : i
  );
  persist();
  renderApp();

  if (!opts.silent && toCol) {
    showToast(`Movido para ${toCol.name}`, 2200, () => {
      // undo
      state.items = state.items.map(i =>
        i.id === itemId ? { ...i, collection: fromCol?.id } : i
      );
      persist(); renderApp();
    });
  }
}

function selectedItemSet() {
  return new Set(state.selectedIds || []);
}

function clearSelection(opts = {}) {
  state.selectedIds = [];
  if (opts.exit) state.selectMode = false;
  renderApp();
}

function toggleSelectMode(force) {
  state.selectMode = typeof force === 'boolean' ? force : !state.selectMode;
  if (!state.selectMode) state.selectedIds = [];
  renderApp();
}

function toggleItemSelection(id) {
  if (!id) return;
  const item = state.items.find(i => i.id === id && (state.activeCol === 'lixeira' ? i.deletedAt : !i.deletedAt));
  if (!item) return;
  const set = selectedItemSet();
  const selected = !set.has(id);
  if (selected) set.add(id);
  else set.delete(id);
  state.selectedIds = [...set];
  updateSelectionDom(id, selected);
}

function updateSelectionDom(id, selected) {
  const card = document.querySelector(`[data-card-id="${id}"]`);
  if (card) {
    card.classList.toggle('selected', selected);
    const mark = card.querySelector('.card-select-mark');
    if (mark) {
      mark.innerHTML = icon(selected ? 'check-circle' : 'circle', 18);
      mark.setAttribute('aria-label', selected ? 'Desmarcar card' : 'Selecionar card');
    }
  }
  const count = state.selectedIds?.length || 0;
  const total = document.querySelector('.bulk-status strong');
  const label = document.querySelector('.bulk-status span');
  if (total) total.textContent = count;
  if (label) {
    const noun = state.activeCol === 'lixeira' ? 'item' : 'card';
    label.textContent = count === 1 ? `${noun} selecionado` : `${noun}s selecionados`;
  }
}

function selectAllVisibleItems() {
  const ids = filteredItems().map(item => item.id);
  if (!ids.length) return;
  const allSelected = ids.every(id => state.selectedIds.includes(id));
  state.selectedIds = allSelected ? [] : ids;
  state.selectMode = true;
  renderApp();
}

function permanentlyDeleteSelectedTrash() {
  const ids = new Set(state.selectedIds || []);
  const count = state.items.filter(item => ids.has(item.id) && item.deletedAt).length;
  if (!count) return;
  confirmDialog({
    title: count === 1 ? 'Apagar item definitivamente?' : `Apagar ${count} itens definitivamente?`,
    message: 'Esta acao nao pode ser desfeita.',
    confirmText: count === 1 ? 'Apagar para sempre' : 'Apagar selecionados',
    cancelText: 'Cancelar',
    danger: true,
  }).then((ok) => {
    if (!ok) return;
    state.items = state.items.filter(item => !(ids.has(item.id) && item.deletedAt));
    state.selectedIds = [];
    state.selectMode = false;
    persist();
    renderAll();
    showToast(count === 1 ? 'Item apagado para sempre' : `${count} itens apagados para sempre`);
  });
}

function moveSelectedItemsToCollection(collectionId) {
  const target = userCollections().find(c => c.id === collectionId);
  if (!target) return;
  const ids = new Set(state.selectedIds || []);
  if (!ids.size) return;
  const previous = new Map();
  state.items = state.items.map(item => {
    if (!ids.has(item.id) || item.deletedAt) return item;
    previous.set(item.id, item.collection);
    return { ...item, collection: collectionId, updatedAt: Date.now() };
  });
  const movedCount = previous.size;
  state.selectedIds = [];
  state.selectMode = false;
  persist();
  renderApp();
  if (movedCount) {
    showToast(`${movedCount} ${movedCount === 1 ? 'item movido' : 'itens movidos'} para ${target.name}`, 2400, () => {
      state.items = state.items.map(item =>
        previous.has(item.id) ? { ...item, collection: previous.get(item.id), updatedAt: Date.now() } : item
      );
      persist();
      renderApp();
    });
  }
}

function addCollection() {
  state.newFolder = { name: '', icon: 'folder', color: '#87807a', editing: false };
  state.editing = null;
  state.viewing = null;
  state.quickAdd = null;
  renderModal();
  setTimeout(() => $('#nf-name')?.focus(), 60);
}

function closeNewFolder() {
  state.newFolder = null;
  renderModal();
}

function saveNewFolder() {
  if (!state.newFolder) return;
  const name = ($('#nf-name')?.value || '').trim();
  if (!name) { $('#nf-name')?.focus(); return; }

  if (state.newFolder.editing && state.newFolder.id) {
    const col = state.collections.find(c => c.id === state.newFolder.id);
    if (!col) return;
    col.name = name;
    col.icon = state.newFolder.icon;
    col.color = state.newFolder.color;
    state.activeCol = col.id;
    state.activeTag = null;
    state.activeKind = 'all';
    state.newFolder = null;
    persist();
    renderAll();
    return;
  }

  const id = 'c_' + uid();
  state.collections.push({
    id, name, system: false,
    icon: state.newFolder.icon,
    color: state.newFolder.color,
  });
  state.activeCol = id;
  state.activeTag = null;
  state.activeKind = 'all';
  state.newFolder = null;
  state.showSidebar = false;
  persist();
  renderAll();
}

function patchNewFolder(patch) {
  if (!state.newFolder) return;
  const nameInput = $('#nf-name');
  state.newFolder = { ...state.newFolder, name: nameInput ? nameInput.value : state.newFolder.name, ...patch };
  refreshNewFolderUI();
}

function editCollection(id) {
  const col = state.collections.find(c => c.id === id);
  if (!col) return;
  state.newFolder = {
    id: col.id,
    name: col.name,
    icon: col.icon || 'folder',
    color: col.color || '#87807a',
    editing: true,
    kind: col.system ? 'collection' : 'folder',
  };
  state.editing = null;
  state.viewing = null;
  state.quickAdd = null;
  renderModal();
  setTimeout(() => $('#nf-name')?.focus(), 60);
}

function deleteCollection(id) {
  const col = state.collections.find(c => c.id === id);
  if (!col || col.system) return;
  confirmDialog({
    title: `Apagar “${col.name}”?`,
    message: 'A pasta sera removida. Os itens dentro ficam sem pasta e continuam em Tudo.',
    confirmText: 'Deletar pasta',
    cancelText: 'Cancelar',
    danger: true,
  }).then((ok) => {
    if (!ok) return;
    state.collections = state.collections.filter(c => c.id !== id);
    state.items = state.items.map(i => i.collection === id ? { ...i, collection: undefined } : i);
    if (state.activeCol === id) state.activeCol = 'all';
    state.activeKind = 'all';
    persist();
    renderApp();
  });
}

function setActiveCol(id) {
  const sameView = state.activeCol === id && !state.activeTag && state.activeKind === 'all' && !state.selectMode && !state.selectedIds.length;
  if (sameView) {
    if (state.showSidebar) {
      state.showSidebar = false;
      renderApp();
    }
    return;
  }
  state.activeCol = id;
  state.activeTag = null;
  state.activeKind = 'all';
  state.showSidebar = false;
  state.selectedIds = [];
  state.selectMode = false;
  renderApp();
}

function setActiveTag(tag) {
  const nextTag = state.activeTag === tag ? null : tag;
  if (state.activeTag === nextTag && !state.selectedIds.length) return;
  state.activeTag = nextTag;
  state.selectedIds = [];
  renderApp();
}

function setActiveKind(kind) {
  const nextKind = kind || 'all';
  if (state.activeKind === nextKind && !state.activeTag && !state.selectedIds.length) return;
  state.activeKind = nextKind;
  state.activeTag = null;
  state.selectedIds = [];
  renderApp();
}

function cycleSortMode() {
  const idx = SORT_OPTIONS.findIndex(s => s.id === state.sortMode);
  state.sortMode = SORT_OPTIONS[(idx + 1) % SORT_OPTIONS.length].id;
  renderApp();
}

function userCollections() {
  return state.collections.filter(c => !c.system);
}

function isUserCollectionId(id) {
  return userCollections().some(c => c.id === id);
}

function activeUserCollectionId() {
  return isUserCollectionId(state.activeCol) ? state.activeCol : undefined;
}

function openEditor(item) {
  state.editing = item || { isNew: true, collection: activeUserCollectionId() };
  state.viewing = null;
  state.quickAdd = null;
  renderModal();
}
function closeEditor() { state.editing = null; renderModal(); }
function openViewer(item) {
  if (!item) return;
  state.viewing = item;
  state.editing = null;
  state.quickAdd = null;
  renderModal();
}
function closeViewer() { state.viewing = null; renderModal(); }
function openQuickAdd(draft) {
  state.quickAdd = {
    ...draft,
    title: draft.title || '',
    collection: draft.collection || activeUserCollectionId(),
  };
  state.editing = null;
  state.viewing = null;
  renderModal();
}
function closeQuickAdd() { state.quickAdd = null; renderModal(); }

function saveQuickAdd() {
  if (!state.quickAdd) return;
  const title = $('#quick-title')?.value.trim();
  const item = {
    ...state.quickAdd,
    title: title || state.quickAdd.title || defaultQuickTitle(state.quickAdd),
  };
  delete item.previewLabel; delete item.kind; delete item.originalImageData; delete item.cropRect;
  saveItem(item);
}
function editQuickAdd() {
  if (!state.quickAdd) return;
  const draft = { ...state.quickAdd, isNew: true };
  delete draft.previewLabel; delete draft.kind;
  state.quickAdd = null;
  state.viewing = null;
  state.editing = draft;
  renderModal();
}
function openSearch() {
  state.showSearch = true;
  state.search = '';
  renderSearchOverlay();
  setTimeout(() => $('#search-input')?.focus(), 30);
}
function closeSearch() { state.showSearch = false; state.search = ''; renderSearchOverlay(); }

function toggleSidebar(open) {
  state.showSidebar = typeof open === 'boolean' ? open : !state.showSidebar;
  renderApp();
}

// ============ DERIVED ============
function itemInActiveScope(it) {
  const isTrashView = state.activeCol === 'lixeira';
  if (isTrashView) return !!it.deletedAt;
  if (it.deletedAt) return false;
  return state.activeCol === 'all' || it.collection === state.activeCol;
}

function filteredItems() {
  const q = state.search.trim().toLowerCase();
  let items = state.items.filter(it => {
    if (!itemInActiveScope(it)) return false;
    if (!itemMatchesKind(it, state.activeKind)) return false;
    if (state.activeTag && !(it.tags || []).includes(state.activeTag)) return false;
    if (!q) return true;
    return (
      (it.title || '').toLowerCase().includes(q) ||
      (it.content || '').toLowerCase().includes(q) ||
      (it.url || '').toLowerCase().includes(q) ||
      (it.tags || []).some(t => t.toLowerCase().includes(q))
    );
  });
  const sorters = {
    recent: (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0),
    oldest: (a, b) => (a.updatedAt || 0) - (b.updatedAt || 0),
    alpha:  (a, b) => (a.title || '').localeCompare(b.title || '', 'pt-BR'),
  };
  const sorter = sorters[state.sortMode] || sorters.recent;
  return items.sort((a, b) => {
    const pinDelta = (b.pinnedAt || 0) - (a.pinnedAt || 0);
    return pinDelta || sorter(a, b);
  });
}

function collCounts() {
  const live = state.items.filter(i => !i.deletedAt);
  const m = { all: live.length, lixeira: state.items.length - live.length };
  live.forEach(i => { m[i.collection] = (m[i.collection] || 0) + 1; });
  return m;
}

function tagCounts() {
  const map = new Map();
  state.items.forEach(it => {
    if (state.activeCol !== 'all' && it.collection !== state.activeCol) return;
    (it.tags || []).forEach(t => map.set(t, (map.get(t) || 0) + 1));
  });
  return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));
}

function typeFilterCounts() {
  return CARD_TYPE_FILTERS
    .map(filter => ({
      ...filter,
      count: state.items.filter(it => itemInActiveScope(it) && itemMatchesKind(it, filter.id)).length,
    }))
    .filter(filter => filter.id === 'all' || filter.count > 0);
}

function globalTypeCounts() {
  const counts = { all: 0 };
  state.items.forEach(it => {
    if (it.deletedAt) return;
    counts.all++;
    const kind = cardTypeKind(it);
    counts[kind] = (counts[kind] || 0) + 1;
    if (DOCUMENT_KINDS.has(kind)) counts.document = (counts.document || 0) + 1;
  });
  return counts;
}

function statsLine() {
  const now = Date.now();
  const week = 7 * 86400000;
  const year = new Date().getFullYear();
  const total = state.items.length;
  const recentWeek = state.items.filter(i => (i.createdAt || i.updatedAt || 0) > (now - week)).length;
  const studied = state.items.filter(i => i.collection === 'estudado').length;
  const studiedYear = state.items.filter(i =>
    i.collection === 'estudado' && new Date(i.updatedAt || 0).getFullYear() === year
  ).length;
  return { total, recentWeek, studied, studiedYear, year };
}

function globalSearchResults() {
  const q = state.search.trim().toLowerCase();
  if (!q) return [];
  return state.items.filter(it =>
    (it.title || '').toLowerCase().includes(q) ||
    (it.content || '').toLowerCase().includes(q) ||
    (it.url || '').toLowerCase().includes(q) ||
    (it.tags || []).some(t => t.toLowerCase().includes(q))
  ).slice(0, 12);
}

function defaultQuickTitle(draft) {
  if (draft.type === 'image') return 'Imagem salva';
  if (draft.type === 'link') return getDomain(draft.url) || 'Link salvo';
  return 'Nota salva';
}

function pastePreviewText(text) {
  const value = String(text || '');
  return value.length > 700 ? value.slice(0, 700).trimEnd() + '...' : value;
}

function renderFolderPicker(selectedId, attrName) {
  const folders = userCollections();
  if (!folders.length) {
    return `<p class="folder-picker-empty">Sem pastas criadas ainda. Salve sem pasta ou crie uma pelo sidebar.</p>`;
  }
  return folders.map(c => `
    <button class="chip chip-coll ${selectedId === c.id ? 'active' : ''}" ${attrName}="${esc(c.id)}" style="${selectedId === c.id ? `background:${c.color};border-color:${c.color}` : ''}">
      ${esc(c.name)}
    </button>
  `).join('');
}

function renderTextStyleToolbar(style) {
  const normalized = normalizeTextStyle(style);
  const groupLabels = { font: 'Fonte', size: 'Tamanho', align: 'Alinhamento' };
  const symbolFor = (group, opt) => {
    if (group === 'align') return icon(opt.icon, 16);
    if (group === 'font') return opt.id === 'mono' ? '<span aria-hidden="true">{ }</span>' : `<span aria-hidden="true">${opt.id === 'serif' ? 'S' : 'A'}</span>`;
    if (group === 'size') return `<span aria-hidden="true">${esc(opt.label)}</span>`;
    return esc(opt.label);
  };
  return `
    <div class="text-style-toolbar" id="text-style-toolbar">
      ${Object.entries(TEXT_STYLE_OPTIONS).map(([group, options]) => `
        <div class="text-style-group" aria-label="${esc(groupLabels[group])}">
          ${options.map(opt => `
            <button class="text-style-btn ${normalized[group] === opt.id ? 'active' : ''}" type="button" data-text-style="${esc(group)}" data-value="${esc(opt.id)}" aria-label="${esc(opt.label)}" title="${esc(opt.label)}">
              ${symbolFor(group, opt)}
            </button>
          `).join('')}
        </div>
      `).join('')}
      <div class="text-style-group text-style-tools" aria-label="Marcadores">
        <button class="text-style-btn" type="button" data-text-tool="bullet" aria-label="Marcadores" title="Marcadores">
          ${icon('list', 16)}
        </button>
      </div>
    </div>
  `;
}

// ============ EXPORT / IMPORT ============
function exportLibrary() {
  const data = { items: state.items, collections: state.collections, exportedAt: new Date().toISOString(), version: 1 };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `biblioteca-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast(`Exportado: ${state.items.length} itens`);
}

function importLibrary() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json,.json';
  input.onchange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!Array.isArray(data.items)) throw new Error('arquivo inválido');
      const overwrite = confirm(`Importar ${data.items.length} itens?\n\nOK = substituir o acervo atual\nCancelar = mesclar com o atual`);
      if (overwrite) {
        state.items = data.items;
        if (Array.isArray(data.collections) && data.collections.length) state.collections = syncDefaultCollections(data.collections);
      } else {
        // merge: by id, new ones win
        const byId = new Map(state.items.map(i => [i.id, i]));
        data.items.forEach(i => byId.set(i.id || uid(), i));
        state.items = [...byId.values()];
      }
      persist();
      renderAll();
      showToast(`Importado: ${data.items.length} itens`);
    } catch (err) {
      console.error(err);
      alert('Arquivo inválido ou corrompido.');
    }
  };
  input.click();
}

async function handleEditorImageUpload(file) {
  if (!file || !isImageFileLike(file)) {
    showToast('Escolha uma imagem valida');
    return;
  }
  if (!modalDraft) return;
  try {
    syncDraftFromDom();
    const raw = await fileToDataUrl(file);
    const imageData = await compressImageDataUrl(raw);
    const titleFromFile = file.name ? file.name.replace(/\.[^.]+$/, '') : '';
    modalDraft = {
      ...modalDraft,
      type: 'image',
      title: modalDraft.title || titleFromFile,
      imageData,
      originalImageData: imageData,
      cropRect: null,
      fileStorageId: '',
      fileName: '',
      fileType: '',
      fileSize: 0,
      url: modalDraft.url || '',
      collection: modalDraft.collection || activeUserCollectionId(),
    };
    if (!modalDraft.tags?.length) modalDraft.tags = ['imagem'];
    state.editing = { ...modalDraft, isNew: !modalDraft.id };
    refreshEditorImageUI();
    trackEvent('action', 'upload_image', { file_type: file.type || '', size: file.size || 0 });
    showToast('Foto carregada');
  } catch (err) {
    console.error(err);
    showToast('Nao foi possivel carregar a foto');
  }
}

async function attachImageToEditingItem(file, sourceLabel = 'Imagem colada') {
  if (!file || !isImageFileLike(file) || !modalDraft) return false;
  try {
    syncDraftFromDom();
    const raw = await fileToDataUrl(file);
    const imageData = await compressImageDataUrl(raw);
    modalDraft = {
      ...modalDraft,
      type: 'image',
      imageData,
      originalImageData: imageData,
      cropRect: null,
      fileStorageId: '',
      fileName: '',
      fileType: '',
      fileSize: 0,
      collection: modalDraft.collection || activeUserCollectionId(),
    };
    if (!modalDraft.tags?.length) modalDraft.tags = ['imagem'];
    state.editing = { ...modalDraft, isNew: !modalDraft.id };
    refreshEditorImageUI();
    trackEvent('action', 'paste_image', { file_type: file.type || '', size: file.size || 0 });
    showToast(sourceLabel);
    return true;
  } catch (err) {
    console.error(err);
    showToast('Nao foi possivel colar a imagem');
    return false;
  }
}

async function handleEditorFileUpload(file) {
  if (!file) return;
  if (!modalDraft) return;
  if (isImageFileLike(file)) {
    await handleEditorImageUpload(file);
    return;
  }
  try {
    syncDraftFromDom();
    const stored = await putStoredFile(file);
    const titleFromFile = file.name ? file.name.replace(/\.[^.]+$/, '') : '';
    modalDraft = {
      ...modalDraft,
      type: 'file',
      title: modalDraft.title || titleFromFile,
      fileStorageId: stored.id,
      fileName: stored.name,
      fileType: stored.type,
      fileSize: stored.size,
      imageData: '',
      originalImageData: '',
      cropRect: null,
      url: modalDraft.url || '',
      collection: modalDraft.collection || activeUserCollectionId(),
    };
    state.editing = { ...modalDraft, isNew: !modalDraft.id };
    refreshEditorFileUI();
    trackEvent('action', 'upload_file', { file_type: stored.type || '', size: stored.size || 0 });
    showToast('Arquivo carregado');
  } catch (err) {
    console.error(err);
    showToast('Nao foi possivel carregar o arquivo');
  }
}

function clearEditorFile() {
  if (!modalDraft) return;
  syncDraftFromDom();
  modalDraft = {
    ...modalDraft,
    fileStorageId: '',
    fileName: '',
    fileType: '',
    fileSize: 0,
  };
  state.editing = { ...modalDraft, isNew: !modalDraft.id };
  refreshEditorFileUI();
}

function clearEditorImage() {
  if (!modalDraft) return;
  syncDraftFromDom();
  modalDraft = {
    ...modalDraft,
    imageData: '',
    originalImageData: '',
    cropRect: null,
  };
  state.editing = { ...modalDraft, isNew: !modalDraft.id };
  refreshEditorImageUI();
}

async function downloadStoredFile(itemId) {
  const item = state.items.find(i => i.id === itemId) || state.viewing;
  if (!item?.fileStorageId) return;
  try {
    const record = await getStoredFile(item.fileStorageId);
    if (!record?.blob) {
      showToast('Arquivo nao encontrado neste navegador');
      return;
    }
    const url = URL.createObjectURL(record.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = item.fileName || record.name || item.title || 'arquivo';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1200);
  } catch (err) {
    console.error(err);
    showToast('Nao foi possivel abrir o arquivo');
  }
}

async function openPdfReader(itemId) {
  const item = state.items.find(i => i.id === itemId) || state.viewing;
  if (!item?.fileStorageId || !isPdfFileLike(item)) return;
  const root = $('#confirm-root');
  if (!root) return;
  revokePdfPreviewUrls('reader');
  root.innerHTML = `
    <div class="pdf-reader-overlay" data-action="close-pdf-reader" role="dialog" aria-label="Leitor de PDF">
      <div class="pdf-reader-panel" data-stop-prop>
        <div class="pdf-reader-head">
          <div class="pdf-reader-title">
            ${icon('file-text', 18)}
            <span>${esc(item.fileName || item.title || 'PDF')}</span>
          </div>
          <div class="pdf-reader-actions">
            <button class="view-file-download" data-action="download-file" data-id="${esc(item.id)}">${icon('download', 15)}<span>Baixar</span></button>
            <button class="lightbox-close" data-action="close-pdf-reader" aria-label="Fechar">${icon('x', 22)}</button>
          </div>
        </div>
        <div class="pdf-reader-frame pdf-preview" data-pdf-preview-id="${esc(item.id)}" data-pdf-preview-scope="reader">
          <iframe title="Leitor de PDF" loading="lazy"></iframe>
        </div>
      </div>
    </div>
  `;
  hydratePdfPreviews(root);
  const onKey = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); closePdfReader(); document.removeEventListener('keydown', onKey, true); }
  };
  document.addEventListener('keydown', onKey, true);
}

function closePdfReader() {
  revokePdfPreviewUrls('reader');
  const root = $('#confirm-root');
  if (root) root.innerHTML = '';
}

// ============ LIGHTBOX (full-screen image viewer) ============
function openLightbox(src) {
  if (!src) return;
  const root = $('#confirm-root');
  if (!root) return;
  root.innerHTML = `
    <div class="lightbox-overlay" data-action="close-lightbox" role="dialog" aria-label="Imagem em tela cheia">
      <button class="lightbox-close" data-action="close-lightbox" aria-label="Fechar">${icon('x', 22)}</button>
      <img class="lightbox-img" src="${esc(src)}" alt="" draggable="false">
    </div>
  `;
  const onKey = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); closeLightbox(); document.removeEventListener('keydown', onKey, true); }
  };
  document.addEventListener('keydown', onKey, true);
}
function closeLightbox() {
  const root = $('#confirm-root');
  if (!root) return;
  root.innerHTML = '';
}

// ============ TOAST ============
function showToast(msg, ms = 2200, undoFn = null) {
  const root = $('#toast-root');
  if (!root) return;
  const id = uid();
  const el = document.createElement('div');
  el.className = 'toast';
  el.dataset.toastId = id;
  el.innerHTML = `<span>${esc(msg)}</span>${undoFn ? '<button data-undo>Desfazer</button>' : ''}`;
  root.appendChild(el);
  if (undoFn) {
    el.querySelector('[data-undo]').addEventListener('click', () => {
      undoFn();
      el.classList.add('fade-out');
      setTimeout(() => el.remove(), 200);
    });
  }
  setTimeout(() => {
    el.classList.add('fade-out');
    setTimeout(() => el.remove(), 200);
  }, ms);
}

// Expose for next chunk of code
window.state = state;


// ============ RENDER: MAIN APP ============
function renderBulkMoveBar(folders, selectedCount) {
  if (!state.selectMode) return '';
  const isTrashView = state.activeCol === 'lixeira';
  const visibleCount = filteredItems().length;
  if (isTrashView) {
    const allSelected = visibleCount > 0 && selectedCount === visibleCount;
    return `
      <div class="bulk-bar bulk-trash">
        <div class="bulk-status">
          <strong>${selectedCount}</strong>
          <span>${selectedCount === 1 ? 'item selecionado' : 'itens selecionados'}</span>
        </div>
        <div class="bulk-targets" aria-label="Acoes da lixeira">
          <button class="bulk-folder-btn" data-action="select-all-visible" title="${allSelected ? 'Limpar seleção' : 'Selecionar tudo'}">
            ${icon(allSelected ? 'x' : 'check-circle', 15)}
            <span>${allSelected ? 'Limpar seleção' : 'Selecionar tudo'}</span>
          </button>
          <button class="bulk-folder-btn danger" data-action="delete-selected-trash" ${selectedCount ? '' : 'disabled'} title="Apagar selecionados para sempre">
            ${icon('trash', 15)}
            <span>Apagar para sempre</span>
          </button>
        </div>
        <button class="bulk-close" data-action="clear-selection" title="Sair da seleção" aria-label="Sair da seleção">${icon('x', 15)}</button>
      </div>
    `;
  }
  return `
    <div class="bulk-bar">
      <div class="bulk-status">
        <strong>${selectedCount}</strong>
        <span>${selectedCount === 1 ? 'card selecionado' : 'cards selecionados'}</span>
      </div>
      <div class="bulk-targets" aria-label="Mover selecionados para pasta">
        ${folders.length
          ? folders.map(col => `
            <button class="bulk-folder-btn" data-action="bulk-move" data-id="${esc(col.id)}" title="Mover para ${esc(col.name)}">
              <span style="color:${col.color}">${icon(col.icon, 15)}</span>
              <span>${esc(col.name)}</span>
            </button>
          `).join('')
          : '<span class="bulk-empty">Crie uma pasta para mover os cards selecionados.</span>'}
      </div>
      <button class="bulk-close" data-action="clear-selection" title="Sair da seleção" aria-label="Sair da seleção">${icon('x', 15)}</button>
    </div>
  `;
}

function renderApp() {
  revokePdfPreviewUrls('card');
  document.body.classList.toggle('select-mode', !!state.selectMode);
  const c = collCounts();
  const cur = state.collections.find(c => c.id === state.activeCol);
  const activeColName = state.activeCol === 'all' ? 'Tudo'
    : state.activeCol === 'lixeira' ? 'Lixeira'
    : (cur?.name || 'Coleção');
  const typeFilters = typeFilterCounts();
  const validKindIds = new Set(CARD_TYPE_FILTERS.map(f => f.id));
  if (state.activeKind !== 'all' && !validKindIds.has(state.activeKind)) state.activeKind = 'all';
  const items = filteredItems();
  const visibleIds = new Set(items.map(i => i.id));
  if (state.selectedIds?.some(id => !visibleIds.has(id))) {
    state.selectedIds = state.selectedIds.filter(id => visibleIds.has(id));
  }
  const selectedCount = state.selectedIds?.length || 0;
  const stats = statsLine();
  const globalTypes = globalTypeCounts();

  // Collections hidden from the sidebar (still exist in state so any items
  // already in them aren't orphaned — just not surfaced in nav).
  const HIDDEN_FROM_SIDEBAR = new Set(['estudar', 'estudado', 'escritos']);
  const sysCols = state.collections.filter(c => c.system && !HIDDEN_FROM_SIDEBAR.has(c.id));
  const sidebarTextItem = { id: 'text', name: 'Texto', icon: 'file-text', color: '#6b1f2a' };
  const sidebarSystemTypeItems = sysCols
    .map(col => ({ ...col, id: SIDEBAR_SYSTEM_TYPE_MAP[col.id], collectionId: col.id }))
    .filter(item => item.id);
  if (!sidebarSystemTypeItems.some(item => item.id === 'document')) {
    sidebarSystemTypeItems.push({ id: 'document', name: 'Arquivo', icon: 'folder', color: '#87807a' });
  }
  const sidebarTypeItems = uniqueSidebarTypeItems(sidebarSystemTypeItems);
  const userCols = state.collections
    .filter(c => !c.system)
    .sort((a, b) => (b.pinnedAt || 0) - (a.pinnedAt || 0));

  $('#app').innerHTML = `
    <div class="app">
      <!-- Top bar (visible at all sizes — drawer-only sidebar layout) -->
      <header class="topbar">
        <button class="topbar-menu" data-action="open-sidebar" aria-label="Abrir menu">${icon('menu', 20)}</button>
        <div class="topbar-brand" data-action="set-col" data-id="all" role="button" tabindex="0">
          <span class="brand-word"><span>BackTo</span><span>Notes</span></span>
        </div>
        <button class="topbar-login-btn ${syncState.user ? 'online' : ''}" data-action="open-sync" title="${esc(syncTitle())}">
          <span>${syncState.user ? 'Logado' : 'Entrar'}</span>
        </button>
        <button class="topbar-search-btn" data-action="open-search" aria-label="Buscar">${icon('search', 17)}</button>
        <button class="topbar-add-btn" data-action="new-item" aria-label="Adicionar item">${icon('plus', 18)}</button>
      </header>

      <!-- Sidebar / drawer -->
      <div class="sidebar-backdrop ${state.showSidebar ? 'open' : ''}" data-action="close-sidebar"></div>
      <aside class="sidebar ${state.showSidebar ? 'open' : ''}">
        <div class="sidebar-logo">
          <div class="sidebar-logo-box">${icon('library', 22)}</div>
          <div>
            <div class="sidebar-logo-name"><span class="brand-word"><span>BackTo</span><span>Notes</span></span></div>
          </div>
        </div>

        <button class="col-item ${state.activeCol === 'all' && state.activeKind === 'all' ? 'active' : ''}" data-action="set-col" data-id="all" data-drop-col="all">
          <span class="col-item-left">${icon('inbox', 16)}<span>Tudo</span></span>
          <span class="col-item-right">${c.all || 0}</span>
        </button>
        ${renderSidebarTypeItem(sidebarTextItem, globalTypes.text || 0)}

        <div class="sidebar-section-label">Coleções</div>
        <div data-folder-area>
          ${sidebarTypeItems.map(item => renderSidebarTypeItem(item, globalTypes[item.id] || 0)).join('')}
        </div>

        <div class="sidebar-divider" aria-hidden="true"></div>

        <div data-folder-area class="folders-section">
          <div class="folders-section-head">
            <span class="folders-section-label">Minhas pastas</span>
            <button class="folders-section-add" data-action="add-col" title="Nova pasta" aria-label="Nova pasta">${icon('plus', 14)}</button>
          </div>
          <div class="folder-list">
            ${userCols.length === 0
              ? '<p class="folder-empty">crie pastas para organizar do seu jeito</p>'
              : userCols.map(col => renderColItem(col, state.activeCol === col.id, c[col.id] || 0, { editable: true, deletable: true, draggable: true })).join('')}
          </div>
        </div>

        <div class="sidebar-foot">
          <button data-action="export-library" title="Exportar tudo como JSON">${icon('download', 14)}<span>Exportar</span></button>
          <button data-action="import-library" title="Importar JSON">${icon('upload', 14)}<span>Importar</span></button>
          <button data-action="open-onboarding" title="Abrir tutorial">${icon('library', 14)}<span>Tutorial</span></button>
          ${isStatsOwner() ? `<button data-action="open-stats" title="Ver estatisticas">${icon('bar-chart', 14)}<span>Stats</span></button>` : ''}
          <button class="sidebar-sync-btn" data-action="open-sync" title="${esc(syncTitle())}">${icon('upload', 14)}<span>${esc(syncLabel())}</span></button>
          <button class="tweaks-trigger" data-action="open-tweaks" title="Ajustes—paleta, ritmo, voz" aria-label="Abrir Tweaks">${icon('sliders', 14)}</button>
        </div>

        <button class="sidebar-trash ${state.activeCol === 'lixeira' ? 'active' : ''}" data-action="set-col" data-id="lixeira">
          ${icon('trash', 14)}<span>Lixeira</span><span class="trash-count">${c.lixeira || 0}</span>
        </button>
      </aside>

      <main class="main">
        <header class="header">
          <div class="header-title-row ${state.activeCol === 'all' ? 'home' : ''}">
            <div>
              ${state.activeCol !== 'all' ? `<h2 class="header-title">${esc(activeColName)}</h2>` : ''}
            </div>
            <div class="header-actions">
              <button class="header-login-btn ${syncState.user ? 'online' : ''}" data-action="open-sync" title="${esc(syncTitle())}">
                <span>${syncState.user ? 'Logado' : 'Entrar'}</span>
              </button>
              ${items.length ? `<button class="icon-btn ${state.selectMode ? 'active' : ''}" data-action="toggle-select-mode" title="${state.selectMode ? 'Sair da seleção' : 'Selecionar vários'}" aria-label="${state.selectMode ? 'Sair da seleção' : 'Selecionar vários'}">${icon('check-circle', 16)}</button>` : ''}
              <button class="icon-btn" data-action="export-library" title="Exportar" aria-label="Exportar JSON">${icon('download', 16)}</button>
              <button class="icon-btn" data-action="open-search" title="Buscar  ⌘K" aria-label="Buscar">${icon('search', 17)}</button>
              <button class="icon-btn primary" data-action="new-item" title="Adicionar  ⌘N" aria-label="Adicionar item">${icon('plus', 18)}</button>
            </div>
          </div>
        </header>
        </header>

        ${typeFilters.length > 0 && typeFilters[0].count > 0 ? `
          <div class="toolbar">
            <div class="tagrow-wrap">
              <span class="tagrow-label">Tipos</span>
              ${typeFilters.map(t => `
                <button class="tagchip ${state.activeKind === t.id ? 'active' : ''}" data-action="set-kind" data-kind="${esc(t.id)}" title="Ver ${esc(t.label)}">
                  ${icon(t.icon, 12)}<span>${esc(t.label)}</span><span class="ct">${t.count}</span>
                </button>
              `).join('')}
            </div>
            <button class="sort-btn" data-action="cycle-sort" title="Ordenar">
              ${icon('sort', 13)}<b>${SORT_OPTIONS.find(s => s.id === state.sortMode)?.label}</b>
            </button>
          </div>
        ` : ''}

        <section class="content">
          ${state.loading
            ? '<div style="padding:80px 0;text-align:center;opacity:0.4;font-style:italic;">carregando...</div>'
            : items.length === 0
              ? renderEmpty(state.items.length === 0)
              : `<div class="grid">${items.map((it, i) => renderCard(it, i)).join('')}</div>`}
        </section>
      </main>

      ${renderBulkMoveBar(userCols, selectedCount)}

      <button class="fab" data-action="new-item" aria-label="Adicionar item">${icon('plus', 22)}</button>

      <!-- Mobile drop bar (visible while dragging on mobile) -->
      <div class="drop-bar" id="drop-bar">
        <div class="drop-bar-label">Solte sobre uma <em>pasta</em></div>
        <div class="drop-bar-targets">
          ${userCols.length
            ? userCols.map(col => `
              <button class="drop-target-pill" data-drop-col="${esc(col.id)}">
                <span class="icon" style="color:${col.color}">${icon(col.icon, 22)}</span>
                <span class="name">${esc(col.name)}</span>
              </button>
            `).join('')
            : '<span class="drop-bar-empty">Crie uma pasta para mover cards.</span>'}
        </div>
      </div>

      <div class="ext-drop-overlay">
        <div class="ext-drop-overlay-inner">Solte para adicionar à biblioteca</div>
      </div>
    </div>
  `;
  hydratePdfPreviews($('#app'));
}

function uniqueSidebarTypeItems(items) {
  const seen = new Set();
  return items.filter(item => {
    const key = item.id || String(item.name || '').trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function renderSidebarTypeItem(item, count) {
  const active = state.activeCol === 'all' && state.activeKind === item.id;
  const editLabel = item.collectionId ? 'Editar nome da coleção' : '';
  return `
    <button class="col-item ${active ? 'active' : ''}" data-action="set-kind" data-kind="${esc(item.id)}" data-root="all" style="--col-color:${item.color || 'var(--primary)'}">
      <span class="col-item-left">
        <span class="col-item-icon" style="color:${item.color || 'var(--primary)'}">${icon(item.icon || 'file-text', 16)}</span>
        <span>${esc(item.name)}</span>
      </span>
      <span class="col-item-right">
        ${item.collectionId ? `<span class="col-action col-edit" data-action="edit-col" data-id="${esc(item.collectionId)}" title="${esc(editLabel)}" aria-label="${esc(editLabel)}" draggable="false">${icon('pencil', 12)}</span>` : ''}
        <span>${count}</span>
      </span>
    </button>
  `;
}

function renderColItem(col, active, count, options = {}) {
  const { editable = false, deletable = false, draggable = false } =
    typeof options === 'boolean' ? { editable: options, deletable: options, draggable: options } : options;
  const isDraggable = draggable; // user folders are reorderable
  const editLabel = col.system ? 'Editar nome da coleção' : 'Editar nome da pasta';
  const pinned = !!col.pinnedAt;
  return `
    <button class="col-item ${active ? 'active' : ''} ${pinned ? 'is-pinned' : ''} ${isDraggable ? 'folder-draggable' : ''}" data-action="set-col" data-id="${esc(col.id)}" data-drop-col="${esc(col.id)}" ${isDraggable ? `draggable="true" data-folder-id="${esc(col.id)}"` : ''} style="--col-color:${col.color}">
      <span class="col-item-left">
        <span class="col-item-icon" style="color:${col.color}">${icon(col.icon, 16)}</span>
        <span>${esc(col.name)}</span>
      </span>
      <span class="col-item-right">
        ${deletable ? `<span class="col-action col-pin ${pinned ? 'active' : ''}" data-action="toggle-pin-col" data-id="${esc(col.id)}" title="${pinned ? 'Desafixar pasta' : 'Fixar pasta no sidebar'}" aria-label="${pinned ? 'Desafixar pasta' : 'Fixar pasta no sidebar'}" draggable="false">${icon('pin', 12)}</span>` : ''}
        ${editable ? `<span class="col-action col-edit" data-action="edit-col" data-id="${esc(col.id)}" title="${esc(editLabel)}" aria-label="${esc(editLabel)}" draggable="false">${icon('pencil', 12)}</span>` : ''}
        ${deletable ? `
          <span class="col-action col-delete" data-action="del-col" data-id="${esc(col.id)}" title="Deletar pasta" aria-label="Deletar pasta" draggable="false">${icon('x', 12)}</span>
        ` : ''}
        <span>${count}</span>
      </span>
    </button>
  `;
}

function renderEmpty(isNew) {
  // Show a clear first-run hint so newcomers know what to do. The hint
  // collapses to just the icon/button once the user has added their first
  // item (isNew = false means the library has items elsewhere).
  if (!isNew) {
    return `
      <div class="empty">
        <div class="empty-mark">${icon('library', 26)}</div>
        <p class="empty-text">nada por aqui ainda</p>
      <button class="empty-btn" data-action="new-item" aria-label="Adicionar item" title="Adicionar item">${icon('plus', 22)}</button>
      </div>
    `;
  }
  return `
    <div class="empty welcome">
      <div class="empty-mark">${icon('library', 28)}</div>
      <h2 class="empty-title">comece sua biblioteca</h2>
      <p class="empty-text">cole um link, arraste arquivos, ou clique no <span class="empty-plus">+</span></p>
      <div class="empty-shortcuts">
        <span><kbd>⌘</kbd> <kbd>V</kbd> colar</span>
        <span class="empty-shortcut-dot"></span>
        <span><kbd>⌘</kbd> <kbd>N</kbd> novo</span>
        <span class="empty-shortcut-dot"></span>
        <span><kbd>⌘</kbd> <kbd>K</kbd> buscar</span>
      </div>
      <button class="empty-btn primary" data-action="new-item" aria-label="Adicionar item" title="Adicionar item">${icon('plus', 22)}</button>
    </div>
  `;
}

function renderCard(item, idx) {
  const type = ITEM_TYPES.find(t => t.id === item.type) || ITEM_TYPES[0];
  const col = state.collections.find(c => c.id === item.collection);
  const isStudyable = item.collection === 'estudar' || item.collection === 'estudado';
  const isStudied = item.collection === 'estudado';
  const domain = item.url ? getDomain(item.url) : null;
  const providerMeta = item.url ? detectProvider(item.url) : null;
  const isYoutubeVideo = providerMeta?.provider === 'youtube' && providerMeta.kind === 'video';
  // Any item with a real thumb on a video/poster-shaped source gets the big
  // hero treatment, just like YouTube. The play overlay is shown only for
  // sources where playback is the primary action.
  const playableKinds = new Set([
    'youtube:video','youtube:short','youtube:live',
    'vimeo:video',
    'twitch:channel','twitch:clip','twitch:vod',
    'tiktok:video',
    'instagram:reel','instagram:tv',
    'facebook:reel','facebook:video',
  ]);
  const heroKinds = new Set([
    ...playableKinds,
    'instagram:post','instagram:story',
    'spotify:track','spotify:album','spotify:playlist','spotify:episode','spotify:show',
  ]);
  const providerKey = providerMeta ? `${providerMeta.provider}:${providerMeta.kind}` : null;
  const isPlayable = providerKey && playableKinds.has(providerKey);
  const hasHeroThumb = item.thumbUrl && providerKey && heroKinds.has(providerKey);
  const isHeroVideo = isYoutubeVideo || hasHeroThumb;
  const tags = item.tags || [];
  const hasPdfPreview = item.fileStorageId && isPdfFileLike(item);
  const variant = item.imageData ? 'image' : hasPdfPreview ? 'pdf' : isHeroVideo ? 'video' : item.type;
  const hasTextStyle = item.type === 'note' && item.textStyle && !isDefaultTextStyle(item.textStyle);
  const isCenteredTextPreview = !hasTextStyle && item.previewStyle === 'centered-text' && item.type === 'note' && !!item.content;
  const contentStyleClass = hasTextStyle ? textStyleClass(item.textStyle) : '';
  const dateLabel = formatDate(item.updatedAt || item.createdAt);
  const heroInfo = providerKey ? brandInfo(providerMeta) : null;
  const isSelected = selectedItemSet().has(item.id);
  const isPinned = !!item.pinnedAt;
  const cardClass = `card variant-${variant === 'video' ? 'video' : variant === 'pdf' ? 'pdf' : item.type} ${isPinned ? 'is-pinned' : ''} ${isCenteredTextPreview ? 'variant-centered-text' : ''} ${state.selectMode ? 'select-mode-card' : ''} ${isSelected ? 'selected' : ''}`;
  const draggableAttr = state.selectMode ? 'false' : 'true';
  const selectMark = state.selectMode
    ? `<span class="card-select-mark" data-action="toggle-card-select" data-id="${esc(item.id)}" aria-label="${isSelected ? 'Desmarcar card' : 'Selecionar card'}">${isSelected ? icon('check-circle', 18) : icon('circle', 18)}</span>`
    : '';

  const head = `
    <div class="card-top">
      <span class="card-type">${icon(type.icon, 11)}<span>${esc(type.label)}</span></span>
      ${col ? `<span class="card-coll" style="color:${col.color}">${esc(col.name)}</span>` : ''}
    </div>
  `;
  const titleHtml = `<h3 class="card-title">${item.title ? esc(item.title) : '<em style="opacity:0.5">Sem título</em>'}</h3>`;
  const contentHtml = item.content ? `<p class="card-content ${isCenteredTextPreview ? 'centered-preview' : ''} ${contentStyleClass}">${esc(item.content)}</p>` : '';
  const tagsHtml = tags.slice(0, 3).map(t => `<span class="tag">${esc(t)}</span>`).join('') +
    (tags.length > 3 ? `<span class="tag-more">+${tags.length - 3}</span>` : '');
  const fileHtml = item.fileStorageId && !hasPdfPreview ? `
    <div class="card-file">
      <span class="card-file-icon">${icon('folder', 16)}</span>
      <span class="card-file-text">
        <strong>${esc(item.fileName || item.title || 'Arquivo')}</strong>
        <small>${esc(formatBytes(item.fileSize) || item.fileType || 'arquivo salvo')}</small>
      </span>
    </div>
  ` : '';
  const studyHtml = isStudyable
    ? `<button class="study-toggle ${isStudied ? 'studied' : ''}" data-action="toggle-studied" data-id="${esc(item.id)}" title="${isStudied ? 'Para estudar' : 'Estudado'}">${icon(isStudied ? 'check-circle' : 'circle', 18)}</button>`
    : '';
  const foot = `
    <div class="card-foot">
      <span class="card-date">${esc(dateLabel)}</span>
      <button class="card-pin ${isPinned ? 'active' : ''}" data-action="toggle-pin-item" data-id="${esc(item.id)}" title="${isPinned ? 'Desafixar card' : 'Fixar card na tela inicial'}" aria-label="${isPinned ? 'Desafixar card' : 'Fixar card na tela inicial'}">${icon('pin', 13)}</button>
      <div class="tags">${tagsHtml}</div>
      ${studyHtml}
    </div>
  `;

  // Image variant: image on top, body below
  if (variant === 'image' && item.imageData) {
    return `
      <article class="${cardClass}" data-action="view" data-id="${esc(item.id)}" data-card-id="${esc(item.id)}" draggable="${draggableAttr}" style="animation-delay:${Math.min(idx * 25, 200)}ms">
        ${selectMark}
        <img class="card-image" src="${esc(item.imageData)}" alt="" draggable="false">
        <div class="card-body">
          ${head}${titleHtml}
          ${contentHtml}
          ${foot}
        </div>
      </article>
    `;
  }

  if (variant === 'pdf') {
    return `
      <article class="${cardClass}" data-action="view" data-id="${esc(item.id)}" data-card-id="${esc(item.id)}" draggable="${draggableAttr}" style="animation-delay:${Math.min(idx * 25, 200)}ms">
        ${selectMark}
        <div class="card-pdf-preview" data-pdf-preview-id="${esc(item.id)}" data-pdf-preview-scope="card" aria-hidden="true">
          <iframe title="Preview de ${esc(item.fileName || item.title || 'PDF')}" loading="lazy" tabindex="-1"></iframe>
          <div class="card-pdf-fallback">
            ${icon('file-text', 24)}
            <span>PDF</span>
          </div>
        </div>
        <div class="card-body">
          ${head}
          ${titleHtml}
          <div class="card-file card-file-compact">
            <span class="card-file-icon">${icon('file-text', 16)}</span>
            <span class="card-file-text">
              <strong>${esc(item.fileName || item.title || 'PDF')}</strong>
              <small>${esc(formatBytes(item.fileSize) || 'PDF')}</small>
            </span>
          </div>
          ${contentHtml}
          ${foot}
        </div>
      </article>
    `;
  }

  // Video variant: real thumb on top, branded play overlay + corner badge.
  // Used for YouTube/Vimeo/Twitch/IG-Reel/TikTok/Spotify whenever a thumb
  // is available — same hero treatment regardless of provider.
  if (variant === 'video' && isHeroVideo) {
    const thumbSrc = isYoutubeVideo ? youtubeThumbUrl(providerMeta.id) : item.thumbUrl;
    const accent = heroInfo?.accent || '#ff0033';
    const isVerticalSource = providerMeta && ['v'].includes(providerMeta.aspect);
    const playOverlay = isPlayable
      ? `<span class="video-play" style="background:${accent}" aria-hidden="true"></span>`
      : '';
    const badgeHtml = heroInfo
      ? `<span class="video-badge" style="background:${accent}">${esc(heroInfo.label)}${heroInfo.sub ? `<small>${esc(heroInfo.sub)}</small>` : ''}</span>`
      : '';
    return `
      <article class="${cardClass}" data-action="view" data-id="${esc(item.id)}" data-card-id="${esc(item.id)}" draggable="${draggableAttr}" style="animation-delay:${Math.min(idx * 25, 200)}ms">
        ${selectMark}
        <span class="video-thumb-wrap${isVerticalSource ? ' vertical-source' : ''}">
          <img class="video-thumb" src="${esc(thumbSrc)}" alt="" draggable="false" referrerpolicy="no-referrer">
          ${badgeHtml}
          ${playOverlay}
        </span>
        <div class="card-body">
          ${head}${titleHtml}
          ${contentHtml}
          ${foot}
        </div>
      </article>
    `;
  }

  // Default (note/link/post/file): inline content + optional link preview
  return `
    <article class="${cardClass}" data-action="view" data-id="${esc(item.id)}" data-card-id="${esc(item.id)}" draggable="${draggableAttr}" style="animation-delay:${Math.min(idx * 25, 200)}ms">
      ${selectMark}
      ${head}
      ${titleHtml}
      ${fileHtml}
      ${contentHtml}
      ${domain && !item.imageData ? renderLinkPreview(item.url, '', item.thumbUrl) : ''}
      ${foot}
    </article>
  `;
}


// ============ RENDER: MODAL / VIEWER / QUICK-ADD ============
let modalDraft = null;
let modalWasOpen = false;
let cropDrag = null;

function renderModal() {
  const root = $('#modal-root');
  revokePdfPreviewUrls();
  if (state.newFolder) { renderNewFolder(root); return; }
  if (state.quickAdd) { renderQuickAdd(root); return; }
  if (state.viewing) { renderViewer(root); return; }
  if (!state.editing) { root.innerHTML = ''; modalWasOpen = false; return; }

  const active = document.activeElement;
  const focusedId = (active && active.id && root.contains(active)) ? active.id : null;
  const focusedSel = (active && typeof active.selectionStart === 'number') ? active.selectionStart : null;

  const it = state.editing;
  const isNew = !!it.isNew;
  const d = {
    id: it.id || null,
    type: it.type || 'note',
    title: it.title || '',
    content: it.content || '',
    url: it.url || '',
    imageData: it.imageData || '',
    fileStorageId: it.fileStorageId || '',
    fileName: it.fileName || '',
    fileType: it.fileType || '',
    fileSize: it.fileSize || 0,
    collection: it.collection || (isNew ? activeUserCollectionId() : ''),
    previewStyle: it.previewStyle || '',
    textStyle: it.textStyle && !isDefaultTextStyle(it.textStyle) ? normalizeTextStyle(it.textStyle) : null,
    tags: Array.isArray(it.tags) ? [...it.tags] : [],
  };
  const editorTextStyle = normalizeTextStyle(d.textStyle);

  const overlayKind = isMobile() ? 'bottom-sheet' : 'center';
  root.innerHTML = `
    <div class="overlay ${overlayKind}" data-close-overlay>
      <div class="panel modal-panel" data-stop-prop>
        ${isMobile() ? '<div class="sheet-grip"></div>' : ''}
        <div class="modal-head">
          <span class="modal-head-label">${isNew ? 'Novo Item' : 'Editar'}</span>
          <button class="icon-btn" style="opacity:0.55" data-action="close-editor" title="Fechar  ESC">${icon('x', 17)}</button>
        </div>

        <div class="modal-body">
          <div class="type-row" id="type-row">
            ${ITEM_TYPES.map(t => `
              <button class="chip ${d.type === t.id ? 'active' : ''}" data-type="${t.id}">
                ${icon(t.icon, 12)}<span>${esc(t.label)}</span>
              </button>
            `).join('')}
          </div>

          <div>
            <label class="field-label">Título</label>
            <input class="input-title" id="f-title" value="${esc(d.title)}" placeholder="Dê um nome...">
          </div>

          <div id="url-field" style="${(d.type === 'link' || d.type === 'post' || d.type === 'file') ? '' : 'display:none'}">
            <label class="field-label">${d.type === 'file' ? 'Caminho ou link' : 'Link'}</label>
            <input class="input-url" id="f-url" value="${esc(d.url)}" placeholder="${d.type === 'file' ? 'Ex: ~/Documentos/arquivo.pdf' : 'https://...'}">
          </div>

          <div id="file-upload-field" style="${d.type === 'file' ? '' : 'display:none'}">
            <label class="field-label">Arquivo do dispositivo</label>
            <div class="file-upload-box">
              <input class="file-input" id="f-file" type="file">
              <div class="file-upload-actions">
                <label class="file-upload-btn" for="f-file">
                  ${icon('upload', 15)}
                  <span>${d.fileStorageId ? 'Trocar arquivo' : 'Escolher arquivo'}</span>
                </label>
                ${d.fileStorageId ? `<button class="file-remove-btn" data-action="clear-editor-file" type="button">${icon('x', 14)}<span>Remover</span></button>` : ''}
              </div>
              <p class="file-upload-hint">PDF, Word, planilhas, ZIP e outros arquivos. Salvo neste navegador; arquivos muito grandes podem ocupar bastante espaco no celular.</p>
              ${d.fileStorageId ? `
                <div class="stored-file">
                  <span class="stored-file-icon">${icon('folder', 18)}</span>
                  <span class="stored-file-main">
                    <strong>${esc(d.fileName || d.title || 'Arquivo')}</strong>
                    <small>${esc([d.fileType || 'arquivo', formatBytes(d.fileSize)].filter(Boolean).join(' · '))}</small>
                  </span>
                </div>
              ` : ''}
            </div>
          </div>

          <div id="image-upload-field" style="${d.type === 'image' ? '' : 'display:none'}">
            <label class="field-label">Foto</label>
            <div class="image-upload-box">
              <input class="image-file-input" id="f-image" type="file" accept="image/*">
              <div class="image-upload-actions">
                <label class="image-upload-btn" for="f-image">
                  ${icon('upload', 15)}
                  <span>${d.imageData ? 'Trocar foto' : 'Escolher foto'}</span>
                </label>
                ${d.imageData ? `<button class="image-remove-btn" data-action="clear-editor-image" type="button">${icon('x', 14)}<span>Remover</span></button>` : ''}
              </div>
              <p class="image-upload-hint">Use fotos do celular ou computador.</p>
              ${renderEditorImagePreview(d.imageData, d.title)}
            </div>
          </div>

          <div>
            <label class="field-label" data-content-label>${d.type === 'note' ? 'Conteúdo' : 'Anotações'}</label>
            <div style="${d.type === 'note' ? '' : 'display:none'}">${renderTextStyleToolbar(d.textStyle)}</div>
            <textarea class="textarea ${d.type === 'note' ? `note-textarea ${textStyleClass(editorTextStyle)}` : ''}" id="f-content" rows="${d.type === 'note' ? 8 : 4}" placeholder="${d.type === 'note' ? 'Escreva aqui...' : 'O que achou? Por que salvou?'}">${esc(d.content)}</textarea>
            <p class="field-hint">Tambem da para colar uma imagem aqui para salvar texto e preview no mesmo item.</p>
          </div>

          <div>
            <label class="field-label">Pasta</label>
            <div class="coll-row" id="coll-row">
              ${renderFolderPicker(d.collection, 'data-coll')}
            </div>
          </div>

          <div>
            <label class="field-label">Tags</label>
            <div class="tag-row" id="tag-row">
              ${d.tags.map(t => `
                <span class="tag-chip" data-tag="${esc(t)}">
                  ${esc(t)}
                  <button class="tag-remove" data-remove-tag="${esc(t)}">${icon('x', 11)}</button>
                </span>
              `).join('')}
              <input class="tag-input" id="f-tag" placeholder="adicionar tag...">
            </div>
          </div>
        </div>

        <div class="modal-foot">
          <div>
            ${!isNew ? `<button class="icon-btn" style="color:var(--burgundy);opacity:0.7" data-action="delete-item" data-id="${esc(d.id)}" title="Apagar">${icon('trash', 16)}</button>` : ''}
          </div>
          <div class="modal-foot-actions">
            <button class="icon-btn" style="opacity:0.6" data-action="close-editor" title="Cancelar  ESC">${icon('x', 17)}</button>
            <button class="icon-btn primary" data-action="save-item" title="Salvar">${icon('check-circle', 17)}</button>
          </div>
        </div>
      </div>
    </div>
  `;

  modalDraft = d;
  if (!modalWasOpen) {
    setTimeout(() => $('#f-title')?.focus(), 60);
  } else if (focusedId) {
    setTimeout(() => {
      const el = $('#' + focusedId);
      if (el) {
        el.focus();
        if (focusedSel !== null && el.setSelectionRange) {
          try { el.setSelectionRange(focusedSel, focusedSel); } catch (e) {}
        }
      }
    }, 0);
  }
  modalWasOpen = true;
}

function renderViewer(root) {
  modalWasOpen = false;
  const item = state.items.find(i => i.id === state.viewing?.id) || state.viewing;
  if (!item) { closeViewer(); return; }

  const type = ITEM_TYPES.find(t => t.id === item.type) || ITEM_TYPES[0];
  const col = state.collections.find(c => c.id === item.collection);
  const domain = item.url ? getDomain(item.url) : null;
  const tags = Array.isArray(item.tags) ? item.tags : [];
  const overlayKind = isMobile() ? 'bottom-sheet' : 'center';
  const hasPdfPreview = isPdfFileLike(item);
  const viewTextStyleClass = item.type === 'note' && item.textStyle && !isDefaultTextStyle(item.textStyle)
    ? textStyleClass(item.textStyle)
    : '';
  const modalClass = [
    item.imageData ? 'modal-image' : '',
    hasPdfPreview ? 'modal-pdf' : '',
  ].filter(Boolean).join(' ');

  root.innerHTML = `
    <div class="overlay ${overlayKind}" data-close-overlay>
      <div class="panel modal-panel ${modalClass}" data-stop-prop>
        ${isMobile() ? '<div class="sheet-grip"></div>' : ''}
        <div class="modal-head">
          <span class="modal-head-label">${esc(formatDate(item.updatedAt || item.createdAt))}</span>
          <button class="icon-btn" style="opacity:0.55" data-action="close-viewer" title="Fechar  ESC">${icon('x', 17)}</button>
        </div>

        <div class="modal-body">
          <div class="view-meta">
            <span>${icon(type.icon, 12)} ${esc(type.label)}</span>
            ${col ? `<span style="color:${col.color}">${esc(col.name)}</span>` : ''}
          </div>

          <h1 class="view-title">${item.title ? esc(item.title) : 'Sem título'}</h1>

          ${domain ? renderLinkPreview(item.url, 'view-link-preview', item.thumbUrl) : ''}

          ${item.fileStorageId ? `
            <div class="view-file">
              <div class="view-file-main">
                <span class="view-file-icon">${icon('folder', 22)}</span>
                <span>
                  <strong>${esc(item.fileName || item.title || 'Arquivo')}</strong>
                  <small>${esc([item.fileType || 'arquivo', formatBytes(item.fileSize)].filter(Boolean).join(' · '))}</small>
                </span>
              </div>
              <div class="view-file-actions">
                ${hasPdfPreview ? `
                  <button class="view-file-open" data-action="open-pdf-reader" data-id="${esc(item.id)}">
                    ${icon('external', 15)}<span>Tela cheia</span>
                  </button>
                ` : ''}
                <button class="view-file-download" data-action="download-file" data-id="${esc(item.id)}">
                  ${icon('download', 15)}<span>Baixar</span>
                </button>
              </div>
            </div>
          ` : ''}

          ${item.fileStorageId && hasPdfPreview ? `
            <div class="pdf-preview" data-pdf-preview-id="${esc(item.id)}" data-pdf-preview-scope="viewer">
              <div class="pdf-preview-head">
                <span>${icon('file-text', 14)}<strong>Preview do PDF</strong></span>
                <span class="pdf-preview-actions">
                  <small class="pdf-preview-status">Carregando...</small>
                  <button class="pdf-open-btn" data-action="open-pdf-reader" data-id="${esc(item.id)}">${icon('external', 13)}<span>Tela cheia</span></button>
                </span>
              </div>
              <iframe title="Preview do PDF" loading="lazy"></iframe>
            </div>
          ` : ''}

          ${item.imageData ? `<img class="view-image" data-action="open-lightbox" data-src="${esc(item.imageData)}" src="${esc(item.imageData)}" alt="${esc(item.title || 'Imagem salva')}">` : ''}

          ${item.content
            ? `<div class="view-content ${item.type === 'note' ? `serif ${viewTextStyleClass}` : ''}">${esc(item.content)}</div>`
            : (item.imageData || item.fileStorageId) ? '' : '<p class="view-empty">Sem anotações ainda.</p>'}

          ${tags.length ? `<div class="tags">${tags.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}
        </div>

        <div class="modal-foot">
          <div>
            <button class="icon-btn ${item.pinnedAt ? 'active' : ''}" style="color:var(--primary);opacity:0.85" data-action="toggle-pin-item" data-id="${esc(item.id)}" title="${item.pinnedAt ? 'Desafixar card' : 'Fixar card'}">${icon('pin', 16)}</button>
            ${item.deletedAt
              ? `<button class="icon-btn" style="color:var(--moss);opacity:0.85" data-action="restore-item" data-id="${esc(item.id)}" title="Restaurar">${icon('upload', 16)}</button>`
              : `<button class="icon-btn" style="color:var(--primary);opacity:0.8" data-action="delete-item" data-id="${esc(item.id)}" title="Mover para lixeira">${icon('trash', 16)}</button>`}
          </div>
          <div class="modal-foot-actions">
            <button class="icon-btn" style="opacity:0.65" data-action="close-viewer" title="Fechar  ESC">${icon('x', 17)}</button>
            ${item.deletedAt
              ? `<button class="icon-btn danger" data-action="delete-item" data-id="${esc(item.id)}" title="Apagar para sempre">${icon('trash', 17)}</button>`
              : `<button class="icon-btn primary" data-action="edit" data-id="${esc(item.id)}" title="Editar">${icon('feather', 17)}</button>`}
          </div>
        </div>
      </div>
    </div>
  `;
  hydratePdfPreviews(root);
}

function renderNewFolder(root) {
  modalWasOpen = false;
  const d = state.newFolder;
  const isEditing = !!d.editing;
  const editTitle = d.kind === 'collection' ? 'Editar coleção' : 'Editar pasta';
  const overlayKind = isMobile() ? 'bottom-sheet' : 'center';
  const folderIcons = ['folder', 'bookmark', 'book-open', 'book-check', 'feather', 'link', 'image', 'file-text'];
  const folderColors = ['#87807a', '#3d5a47', '#6b1f2a', '#b8843d', '#5a7a4f', '#3d5a6c', '#7a5230', '#6a5687'];

  root.innerHTML = `
    <div class="overlay ${overlayKind}" data-close-overlay>
      <div class="panel modal-panel new-folder-panel" data-stop-prop>
        ${isMobile() ? '<div class="sheet-grip"></div>' : ''}
        <div class="modal-head">
          <span class="modal-head-label">${isEditing ? editTitle : 'Nova pasta'}</span>
          <button class="icon-btn" style="opacity:0.55" data-action="close-new-folder" title="Fechar  ESC">${icon('x', 17)}</button>
        </div>

        <div class="modal-body">
          <div class="nf-preview">
            <span class="nf-preview-label">Pré-visualização</span>
            <div class="col-item nf-preview-row">
              <span class="col-item-left">
                <span style="color:${d.color};display:inline-flex;flex-shrink:0;">${icon(d.icon, 16)}</span>
                <span>${esc(d.name || 'Sua pasta')}</span>
              </span>
              <span class="col-item-right">0</span>
            </div>
          </div>

          <div>
            <label class="field-label">Nome</label>
            <input class="input-title" id="nf-name" value="${esc(d.name)}" placeholder="Ex.: leituras de inverno" maxlength="40">
          </div>

          <div>
            <label class="field-label">Ícone</label>
            <div class="nf-icon-row">
              ${folderIcons.map(i => `
                <button class="nf-icon-chip ${d.icon === i ? 'active' : ''}" data-nf-icon="${i}" aria-label="${i}" style="${d.icon === i ? `color:${d.color}` : ''}">
                  ${icon(i, 16)}
                </button>
              `).join('')}
            </div>
          </div>

          <div>
            <label class="field-label">Cor</label>
            <div class="nf-color-row">
              ${folderColors.map(c => `
                <button class="nf-color-swatch ${d.color === c ? 'active' : ''}" data-nf-color="${c}" style="background:${c}" aria-label="${c}"></button>
              `).join('')}
            </div>
          </div>
        </div>

        <div class="modal-foot">
          <div></div>
          <div class="modal-foot-actions">
            <button class="icon-btn" style="opacity:0.65" data-action="close-new-folder" title="Cancelar  ESC">${icon('x', 17)}</button>
            <button class="icon-btn primary" data-action="save-new-folder" title="${isEditing ? `Salvar ${d.kind === 'collection' ? 'coleção' : 'pasta'}` : 'Criar pasta'}">${icon('check-circle', 17)}</button>
          </div>
        </div>
      </div>
    </div>
  `;
  setTimeout(() => $('#nf-name')?.focus(), 60);
}

function refreshNewFolderUI() {
  if (!state.newFolder) return;
  const d = state.newFolder;
  const previewIcon = document.querySelector('.nf-preview-row .col-item-left span:first-child');
  if (previewIcon) {
    previewIcon.style.color = d.color;
    previewIcon.innerHTML = icon(d.icon, 16);
  }
  const previewName = document.querySelector('.nf-preview-row .col-item-left span:last-child');
  if (previewName) previewName.textContent = d.name?.trim() || 'Sua pasta';
  $$('[data-nf-icon]').forEach(btn => {
    const active = btn.dataset.nfIcon === d.icon;
    btn.classList.toggle('active', active);
    btn.style.color = active ? d.color : '';
  });
  $$('[data-nf-color]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.nfColor === d.color);
  });
}

function renderQuickAddPreviewContent(d) {
  if (d.imageData) {
    const isCropped = !!(d.originalImageData && d.imageData !== d.originalImageData);
    return `
      <div class="crop-tools ${isCropped ? 'is-cropped' : ''}">
        <div class="crop-help">
          ${isCropped
            ? `<strong>Imagem recortada</strong><br><span>arraste novamente para refinar, ou volte ao original</span>`
            : `<strong>Arraste sobre a imagem para recortar</strong><br><span>solte para aplicar - ou salve a imagem inteira</span>`}
        </div>
        ${isCropped
          ? `<button class="crop-btn crop-btn-secondary" data-action="clear-crop">${icon('upload', 13)}<span>Imagem inteira</span></button>`
          : ''}
      </div>
      <div class="crop-stage" data-crop-stage>
        <img src="${esc(d.imageData)}" alt="">
      </div>
      <div class="crop-selection" data-crop-selection></div>
      ${d.content ? `<p class="paste-preview-text with-image">${esc(pastePreviewText(d.content))}</p>` : ''}
    `;
  }
  if (d.fileStorageId) return renderStoredFilePreview(d);
  if (d.url) return renderLinkPreview(d.url, 'view-link-preview', d.thumbUrl);
  return `<p class="paste-preview-text">${esc(pastePreviewText(d.content))}</p>`;
}

function refreshQuickAddPreviewUI() {
  if (!state.quickAdd) return;
  setQuickTitleFromDom();
  const preview = document.querySelector('.paste-preview');
  if (preview) preview.innerHTML = renderQuickAddPreviewContent(state.quickAdd);
}

function renderQuickAdd(root) {
  modalWasOpen = false;
  const d = state.quickAdd;
  const type = ITEM_TYPES.find(t => t.id === d.type) || ITEM_TYPES[0];
  const hasCrop = !!d.cropRect;
  const overlayKind = isMobile() ? 'bottom-sheet' : 'center';

  root.innerHTML = `
    <div class="overlay ${overlayKind}" data-close-overlay>
      <div class="panel modal-panel" data-stop-prop>
        ${isMobile() ? '<div class="sheet-grip"></div>' : ''}
        <div class="modal-head">
          <span class="modal-head-label">${esc(d.previewLabel || 'Adicionar')}</span>
          <button class="icon-btn" style="opacity:0.55" data-action="close-quick-add" title="Fechar  ESC">${icon('x', 17)}</button>
        </div>

        <div class="modal-body">
          <div class="view-meta">
            <span>${icon(type.icon, 12)} ${esc(type.label)}</span>
          </div>

          <div>
            <label class="field-label">Título</label>
            <input class="input-title" id="quick-title" value="${esc(d.title)}" placeholder="Dê um nome...">
          </div>

          <div>
            <label class="field-label">Pasta</label>
            <div class="coll-row" id="quick-coll-row">
              ${renderFolderPicker(d.collection, 'data-quick-coll')}
            </div>
          </div>

          <div>
            <label class="field-label">Prévia</label>
            <div class="paste-preview">
              ${d.imageData
                ? `
                  <div class="crop-tools ${d.originalImageData && d.imageData !== d.originalImageData ? 'is-cropped' : ''}">
                    <div class="crop-help">
                      ${d.originalImageData && d.imageData !== d.originalImageData
                        ? `<strong>Imagem recortada</strong><br><span>arraste novamente para refinar, ou volte ao original</span>`
                        : `<strong>Arraste sobre a imagem para recortar</strong><br><span>solte para aplicar — ou salve a imagem inteira</span>`}
                    </div>
                    ${d.originalImageData && d.imageData !== d.originalImageData
                      ? `<button class="crop-btn crop-btn-secondary" data-action="clear-crop">${icon('upload', 13)}<span>Imagem inteira</span></button>`
                      : ''}
                  </div>
                  <div class="crop-stage" data-crop-stage>
                    <img src="${esc(d.imageData)}" alt="">
                  </div>
                  <div class="crop-selection" data-crop-selection></div>
                  ${d.content ? `<p class="paste-preview-text with-image">${esc(pastePreviewText(d.content))}</p>` : ''}
                `
                : d.fileStorageId
                  ? `
                    <div class="stored-file">
                      <span class="stored-file-icon">${icon('folder', 18)}</span>
                      <span class="stored-file-main">
                        <strong>${esc(d.fileName || d.title || 'Arquivo')}</strong>
                        <small>${esc([d.fileType || 'arquivo', formatBytes(d.fileSize)].filter(Boolean).join(' · '))}</small>
                      </span>
                    </div>
                  `
                : d.url
                  ? renderLinkPreview(d.url, 'view-link-preview', d.thumbUrl)
                  : `<p class="paste-preview-text">${esc(pastePreviewText(d.content))}</p>`}
            </div>
          </div>
        </div>

        <div class="modal-foot">
          <span style="font-size:11px;opacity:0.5;font-style:italic;font-family:var(--font-serif)">Pronto para salvar</span>
          <div class="modal-foot-actions">
            ${d.type === 'note' ? `<button class="icon-btn" style="opacity:0.7" data-action="edit-quick-add" title="Editar texto">${icon('feather', 17)}</button>` : ''}
            <button class="icon-btn" style="opacity:0.65" data-action="close-quick-add" title="Cancelar  ESC">${icon('x', 17)}</button>
            <button class="icon-btn primary" data-action="save-quick-add" title="Salvar">${icon('check-circle', 17)}</button>
          </div>
        </div>
      </div>
    </div>
  `;

  setTimeout(() => $('#quick-title')?.focus(), 60);
}

function renderSearchOverlay() {
  const root = $('#search-root');
  if (!state.showSearch) { root.innerHTML = ''; return; }

  root.innerHTML = `
    <div class="overlay top" data-close-overlay>
      <div class="panel search-panel" data-stop-prop>
        <div class="search-head">
          ${icon('search', 17)}
          <input class="search-input" id="search-input" placeholder="Buscar título, conteúdo, link, tag..." value="${esc(state.search)}">
          <kbd>ESC</kbd>
        </div>
        <div class="search-results" id="search-results">${renderSearchResultsHTML()}</div>
      </div>
    </div>
  `;
}

function closeSyncPanel() {
  const root = $('#confirm-root');
  if (root) root.innerHTML = '';
  state.showStats = false;
}

function renderSyncPanel() {
  const root = $('#confirm-root');
  if (!root) return;
  state.showStats = false;
  const configured = syncState.configured;
  const userEmail = syncState.user?.email || '';
  root.innerHTML = `
    <div class="overlay center sync-overlay" data-sync-overlay>
      <div class="panel sync-panel" data-stop-prop role="dialog" aria-modal="true" aria-label="Sincronizacao Supabase">
        <div class="modal-head">
          <span class="modal-head-label">BackToNotes Sync</span>
          <button class="icon-btn" data-action="close-sync" title="Fechar">${icon('x', 17)}</button>
        </div>
        <div class="sync-body">
          ${configured ? `
            ${!syncState.client && syncState.lastError ? `
              <div class="sync-hero">
                <h2>Conexao indisponivel</h2>
                <p>${esc(syncState.lastError)}</p>
              </div>
              <ol class="sync-steps">
                <li>Confira sua conexao com a internet.</li>
                <li>Recarregue o app e tente novamente.</li>
              </ol>
            ` : syncState.user ? `
              <div class="sync-status-card">
                <strong>${esc(userEmail)}</strong>
                <span>${syncState.busy ? 'Sincronizando...' : syncState.lastSync ? `Ultimo sync: ${esc(formatDate(syncState.lastSync))}` : 'Salvo neste navegador'}</span>
                ${syncState.lastError ? `<small>${esc(syncState.lastError)}</small>` : ''}
              </div>
              <div class="sync-actions">
                <button class="sync-btn primary" data-action="sync-now">${icon('upload', 15)}<span>Sincronizar agora</span></button>
                <button class="sync-btn" data-action="sync-logout">${icon('x', 15)}<span>Sair</span></button>
              </div>
            ` : `
              <div class="sync-hero">
                <h2>Entre ou crie uma conta</h2>
                <p>Sincronize suas notas, links, imagens e arquivos entre o computador e o celular.</p>
              </div>
              ${syncState.lastError ? `<p class="sync-error">${esc(syncState.lastError)}</p>` : ''}
              <button class="sync-google-btn" data-action="sync-google" type="button">
                <span class="sync-google-mark">G</span>
                <span>Continuar com o Google</span>
              </button>
              <div class="sync-divider"><span>ou</span></div>
              <label class="field-label" for="sync-email">E-mail</label>
              <input class="sync-input" id="sync-email" type="email" autocomplete="email" placeholder="voce@email.com">
              <label class="field-label" for="sync-password">Senha</label>
              <input class="sync-input" id="sync-password" type="password" autocomplete="current-password" placeholder="minimo 6 caracteres">
              <div class="sync-actions">
                <button class="sync-btn primary" data-action="sync-login">${icon('check-circle', 15)}<span>Entrar</span></button>
                <button class="sync-btn" data-action="sync-signup">${icon('plus', 15)}<span>Criar conta</span></button>
              </div>
            `}
          ` : `
            <div class="sync-hero">
              <h2>Configure o sync</h2>
              <p>O Supabase ainda nao esta configurado neste site.</p>
            </div>
            <ol class="sync-steps">
              <li>Crie um projeto no Supabase.</li>
              <li>Rode o arquivo <code>supabase-schema.sql</code> no SQL Editor.</li>
              <li>Preencha <code>supabase-config.js</code> com a URL e a anon key.</li>
            </ol>
          `}
        </div>
      </div>
    </div>
  `;
  setTimeout(() => $('#sync-email')?.focus(), 60);
}

function renderStatsPanel() {
  const root = $('#confirm-root');
  if (!root) return;
  if (!state.showStats) {
    if (root.querySelector('.stats-overlay')) root.innerHTML = '';
    return;
  }
  const summary = summarizeAnalytics(analyticsState.events);
  const row = (label, value) => `
    <div class="stats-card">
      <span>${esc(label)}</span>
      <strong>${esc(value)}</strong>
    </div>
  `;
  const list = (items, emptyLabel = 'Sem dados ainda') => items.length
    ? items.map(([name, count], idx) => `
      <div class="stats-list-row">
        <span><b>${idx + 1}</b>${esc(statsActionLabel(name))}</span>
        <strong>${count}</strong>
      </div>
    `).join('')
    : `<p class="stats-empty">${esc(emptyLabel)}</p>`;
  const lastLoaded = analyticsState.lastLoaded ? `Atualizado ${formatDate(analyticsState.lastLoaded)}` : 'Ultimos 30 dias';
  root.innerHTML = `
    <div class="overlay center stats-overlay" data-stats-overlay>
      <div class="panel stats-panel" data-stop-prop role="dialog" aria-modal="true" aria-label="Painel estatistico">
        <div class="modal-head">
          <span class="modal-head-label">${icon('bar-chart', 15)} Estatisticas</span>
          <button class="icon-btn" data-action="close-stats" title="Fechar">${icon('x', 17)}</button>
        </div>
        <div class="stats-body">
          <div class="stats-hero">
            <div>
              <p class="stats-kicker">Painel privado</p>
              <h2>Uso do BackToNotes</h2>
              <span>${esc(lastLoaded)}</span>
            </div>
            <button class="stats-refresh" data-action="refresh-stats">${icon('refresh', 14)}<span>Atualizar</span></button>
          </div>
          ${analyticsState.error ? `<div class="sync-error">${esc(analyticsState.error)}</div>` : ''}
          ${analyticsState.loading ? '<p class="stats-empty">Carregando estatisticas...</p>' : `
            <div class="stats-grid">
              ${row('Hoje', summary.visitors24h)}
              ${row('7 dias', summary.visitors7d)}
              ${row('30 dias', summary.visitors30d)}
              ${row('Eventos', summary.totalEvents)}
            </div>
            <div class="stats-columns">
              <section class="stats-section">
                <h3>Funcoes mais usadas</h3>
                ${list(summary.actions)}
              </section>
              <section class="stats-section">
                <h3>Cards criados</h3>
                ${list(summary.cards, 'Nenhum card criado no periodo')}
              </section>
              <section class="stats-section">
                <h3>Dispositivos</h3>
                ${list(summary.devices)}
              </section>
            </div>
          `}
        </div>
      </div>
    </div>
  `;
}

function statsActionLabel(action) {
  const labels = {
    'new-item': 'Adicionar item',
    'save-item': 'Salvar card',
    'save-quick-add': 'Salvar colagem',
    'view': 'Abrir card',
    'open-search': 'Buscar',
    'set-kind': 'Filtrar por tipo',
    'set-col': 'Abrir pasta/colecao',
    'add-col': 'Criar pasta',
    'edit-col': 'Editar pasta',
    'del-col': 'Deletar pasta',
    'toggle-pin-item': 'Fixar card',
    'toggle-pin-col': 'Fixar pasta',
    'delete-item': 'Enviar para lixeira',
    'restore-item': 'Restaurar item',
    'delete-selected-trash': 'Apagar lixeira',
    'export-library': 'Exportar biblioteca',
    'import-library': 'Importar biblioteca',
    'open-sync': 'Abrir login/sync',
    'sync-login': 'Entrar',
    'sync-signup': 'Criar conta',
    'sync-google': 'Login Google',
    'sync-now': 'Sincronizar',
    'paste_text': 'Texto colado',
    'paste_link': 'Link colado',
    'paste_image': 'Imagem colada',
    'upload_image': 'Upload de imagem',
    'upload_file': 'Upload de arquivo',
    'note': 'Nota',
    'link': 'Link',
    'post': 'Post',
    'image': 'Imagem',
    'file': 'Arquivo',
    'document': 'Arquivo',
  };
  return labels[action] || action || 'Outro';
}

function renderOnboarding() {
  const root = $('#confirm-root');
  if (!root) return;
  if (!state.showOnboarding) {
    if (root.querySelector('[data-onboarding-overlay]')) root.innerHTML = '';
    return;
  }
  const overlayKind = isMobile() ? 'bottom-sheet' : 'center';
  const steps = [
    {
      icon: 'plus',
      title: 'Salve em segundos',
      text: 'Cole um texto ou link, arraste arquivos, ou toque no botao de adicionar.',
    },
    {
      icon: 'folder',
      title: 'Organize por pastas',
      text: 'Crie pastas para separar estudos, ideias, imagens, PDFs e outros arquivos.',
    },
    {
      icon: 'search',
      title: 'Encontre rapido',
      text: 'Use os filtros por tipo e a busca para voltar ao que voce guardou.',
    },
  ];
  root.innerHTML = `
    <div class="overlay ${overlayKind} onboarding-overlay" data-onboarding-overlay>
      <div class="panel onboarding-panel" data-stop-prop role="dialog" aria-modal="true" aria-label="Boas-vindas ao BackToNotes">
        ${isMobile() ? '<div class="sheet-grip"></div>' : ''}
        <div class="onboarding-head">
          <span class="onboarding-mark">${icon('library', 24)}</span>
          <div>
            <p class="onboarding-kicker">BackToNotes</p>
            <h2>Comece sua biblioteca</h2>
          </div>
        </div>
        <div class="onboarding-steps">
          ${steps.map((step, index) => `
            <div class="onboarding-step">
              <span class="onboarding-step-icon">${icon(step.icon, 18)}</span>
              <span class="onboarding-step-copy">
                <strong>${index + 1}. ${esc(step.title)}</strong>
                <small>${esc(step.text)}</small>
              </span>
            </div>
          `).join('')}
        </div>
        <div class="onboarding-actions">
          <button class="onboarding-skip" data-action="close-onboarding">Pular</button>
          <button class="onboarding-start" data-action="close-onboarding">${icon('check-circle', 16)}<span>Comecar</span></button>
        </div>
      </div>
    </div>
  `;
}

async function handleSyncGoogle() {
  if (!syncState.client) { renderSyncPanel(); return; }
  syncState.busy = true;
  renderSyncPanel();
  try {
    const { error } = await syncState.client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.href.split('#')[0] },
    });
    if (error) throw error;
  } catch (err) {
    console.error(err);
    syncState.lastError = readableSyncError(err);
    showToast(syncState.lastError || 'Nao foi possivel entrar com Google');
    syncState.busy = false;
    renderSyncPanel();
    renderApp();
  }
}

async function handleSyncAuth(mode) {
  if (!syncState.client) { renderSyncPanel(); return; }
  const email = $('#sync-email')?.value.trim();
  const password = $('#sync-password')?.value;
  if (!email || !password) {
    showToast('Informe e-mail e senha');
    return;
  }
  syncState.busy = true;
  renderSyncPanel();
  try {
    const res = mode === 'signup'
      ? await syncState.client.auth.signUp({ email, password })
      : await syncState.client.auth.signInWithPassword({ email, password });
    if (res.error) throw res.error;
    syncState.user = res.data.user || res.data.session?.user || null;
    syncState.status = syncState.user ? 'online' : 'offline';
    showToast(mode === 'signup' ? 'Conta criada. Verifique o e-mail se solicitado.' : 'Sync conectado');
    syncState.busy = false;
  } catch (err) {
    console.error(err);
    syncState.lastError = readableSyncError(err);
    showToast(syncState.lastError || 'Nao foi possivel entrar');
  } finally {
    syncState.busy = false;
    renderSyncPanel();
    renderApp();
  }
}

async function handleSyncLogout() {
  if (!syncState.client) return;
  await syncState.client.auth.signOut();
  syncState.user = null;
  syncState.status = 'offline';
  syncState.lastSync = null;
  showToast('Sync desconectado');
  renderSyncPanel();
  renderApp();
}

function renderSearchResultsHTML() {
  if (!state.search.trim()) return '<p class="search-empty">Digite para buscar</p>';
  const results = globalSearchResults();
  if (results.length === 0) return '<p class="search-empty">Nada encontrado</p>';
  return results.map(it => {
    const col = state.collections.find(c => c.id === it.collection);
    return `
      <button class="search-result" data-action="open-result" data-id="${esc(it.id)}">
        <div class="search-result-text">
          <p class="search-result-title">${it.title ? esc(it.title) : 'Sem título'}</p>
          ${it.content ? `<p class="search-result-body">${esc(it.content)}</p>` : ''}
        </div>
        ${col ? `<span class="search-result-coll" style="color:${col.color}">${esc(col.name)}</span>` : ''}
      </button>
    `;
  }).join('');
}

function updateSearchResults() {
  const root = $('#search-results');
  if (root) root.innerHTML = renderSearchResultsHTML();
}

function renderAll() {
  renderApp();
  renderModal();
  renderSearchOverlay();
  renderOnboarding();
}


// ============ DRAG & DROP ============
// Two parallel implementations sharing UI state:
//   - HTML5 native drag-and-drop for mouse / desktop
//   - Long-press pointer drag for touch
// Both end in moveItemToCollection(itemId, collectionId).

let draggingItemId = null;
let currentDropTarget = null;
let longPress = null;       // { card, itemId, startX, startY, timer, active }
let stickyMobileDrag = null; // { card, itemId } after long-press selection
let suppressNextDragClick = false;
let ghostEl = null;
let lastGhostXY = null;
const LONG_PRESS_MS = 380;
const LONG_PRESS_TOLERANCE = 8;

function setDropTarget(el) {
  if (currentDropTarget === el) return;
  if (currentDropTarget) currentDropTarget.classList.remove('drop-target');
  currentDropTarget = el;
  if (currentDropTarget) currentDropTarget.classList.add('drop-target');
}
function clearDropTarget() { setDropTarget(null); }
function setDraggingMode(active) { document.body.classList.toggle('dragging-item', active); }

function releasePointerCaptureSafe(card, pointerId) {
  if (!card || pointerId == null) return;
  try {
    if (card.hasPointerCapture?.(pointerId)) card.releasePointerCapture(pointerId);
  } catch {}
}

function clearMobileDragSelection() {
  stickyMobileDrag?.card?.classList.remove('dragging', 'long-press-arming');
  stickyMobileDrag = null;
  suppressNextDragClick = false;
  draggingItemId = null;
  endDragGhost();
  clearDropTarget();
  setDraggingMode(false);
}

function keepMobileDragSelection(card, itemId) {
  stickyMobileDrag = { card, itemId };
  draggingItemId = itemId;
  card.classList.add('dragging');
  setDraggingMode(true);
  showToast('Toque em uma pasta para mover', 1600);
}

function completeMobileDrop(colId) {
  if (!stickyMobileDrag) return;
  if (!isUserCollectionId(colId)) {
    clearMobileDragSelection();
    return;
  }
  const { itemId } = stickyMobileDrag;
  clearMobileDragSelection();
  moveItemToCollection(itemId, colId);
}

function startDragGhost(card, x, y) {
  ghostEl = $('#drag-ghost');
  if (!ghostEl) return;
  ghostEl.innerHTML = card.outerHTML;
  ghostEl.classList.add('active');
  positionGhost(x, y);
}
function positionGhost(x, y) {
  if (!ghostEl) return;
  lastGhostXY = { x, y };
  ghostEl.style.transform = `translate3d(${x - 115}px, ${y - 60}px, 0) rotate(-3deg) scale(0.92)`;
}
function endDragGhost() {
  if (!ghostEl) return;
  ghostEl.classList.remove('active');
  ghostEl.innerHTML = '';
  ghostEl = null;
  lastGhostXY = null;
}

function findDropCollectionAt(x, y) {
  const el = document.elementFromPoint(x, y);
  if (!el) return null;
  const colTarget = el.closest('[data-drop-col]');
  if (colTarget) return colTarget;
  // Soft target — folder area
  const folder = el.closest('[data-folder-area]');
  if (!folder) return null;
  const targets = [...folder.querySelectorAll('[data-drop-col]')];
  if (!targets.length) return null;
  return targets.reduce((best, t) => {
    const r = t.getBoundingClientRect();
    const d = Math.abs(y - (r.top + r.height / 2));
    return (!best || d < best.d) ? { t, d } : best;
  }, null).t;
}

// === HTML5 native drag (desktop) — items + folder reorder ===
let draggingFolderId = null;
let folderDropTarget = null;

function setFolderDropTarget(el, position) {
  if (folderDropTarget && folderDropTarget !== el) {
    folderDropTarget.classList.remove('folder-drop-above', 'folder-drop-below');
  }
  folderDropTarget = el;
  if (!el) return;
  el.classList.toggle('folder-drop-above', position === 'above');
  el.classList.toggle('folder-drop-below', position === 'below');
}
function clearFolderDropTarget() {
  folderDropTarget?.classList.remove('folder-drop-above', 'folder-drop-below');
  folderDropTarget = null;
}

function reorderFolder(srcId, destId, position) {
  if (!srcId || !destId || srcId === destId) return;
  const cols = [...state.collections];
  const srcIdx = cols.findIndex(c => c.id === srcId);
  if (srcIdx < 0) return;
  const [moved] = cols.splice(srcIdx, 1);
  let destIdx = cols.findIndex(c => c.id === destId);
  if (destIdx < 0) return;
  if (position === 'below') destIdx += 1;
  cols.splice(destIdx, 0, moved);
  state.collections = cols;
  persist();
  renderApp();
}

document.addEventListener('dragstart', (e) => {
  // Folder reorder takes precedence: user folders are draggable too.
  const folder = e.target.closest('.folder-draggable[data-folder-id]');
  if (folder) {
    e.stopPropagation();
    draggingFolderId = folder.dataset.folderId;
    folder.classList.add('reordering');
    setDraggingMode(true);
    try {
      e.dataTransfer.setData('application/x-bn-folder', draggingFolderId);
      e.dataTransfer.effectAllowed = 'move';
    } catch {}
    return;
  }
  const card = e.target.closest('.card[draggable="true"]');
  if (!card) return;
  draggingItemId = card.dataset.cardId;
  card.classList.add('dragging');
  setDraggingMode(true);
  try {
    e.dataTransfer.setData('application/x-biblioteca-item', draggingItemId);
    e.dataTransfer.effectAllowed = 'move';
    const ghost = card.cloneNode(true);
    ghost.style.cssText = 'position:absolute;top:-9999px;left:-9999px;width:220px;opacity:0.9;';
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 110, 50);
    setTimeout(() => ghost.remove(), 0);
  } catch {}
});

document.addEventListener('dragend', () => {
  // Folder reorder cleanup
  if (draggingFolderId) {
    $$('.col-item.reordering').forEach(c => c.classList.remove('reordering'));
    clearFolderDropTarget();
    draggingFolderId = null;
    setDraggingMode(false);
    return;
  }
  draggingItemId = null;
  $$('.card.dragging').forEach(c => c.classList.remove('dragging'));
  clearDropTarget();
  setDraggingMode(false);
});

document.addEventListener('dragover', (e) => {
  // Folder-on-folder reorder
  if (draggingFolderId) {
    const target = e.target.closest('.folder-draggable[data-folder-id]');
    if (target && target.dataset.folderId !== draggingFolderId) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const r = target.getBoundingClientRect();
      const position = (e.clientY - r.top) < r.height / 2 ? 'above' : 'below';
      setFolderDropTarget(target, position);
    } else {
      clearFolderDropTarget();
    }
    return;
  }
  if (draggingItemId === null) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  setDropTarget(findDropCollectionAt(e.clientX, e.clientY) || null);
});

document.addEventListener('drop', (e) => {
  if (draggingFolderId) {
    const target = e.target.closest('.folder-draggable[data-folder-id]');
    if (target && target.dataset.folderId !== draggingFolderId) {
      e.preventDefault();
      const r = target.getBoundingClientRect();
      const position = (e.clientY - r.top) < r.height / 2 ? 'above' : 'below';
      reorderFolder(draggingFolderId, target.dataset.folderId, position);
    }
    clearFolderDropTarget();
    draggingFolderId = null;
    setDraggingMode(false);
    return;
  }
  if (draggingItemId === null) return;
  e.preventDefault();
  const target = findDropCollectionAt(e.clientX, e.clientY);
  const colId = target?.dataset.dropCol;
  if (colId && colId !== 'all') moveItemToCollection(draggingItemId, colId);
  draggingItemId = null;
  clearDropTarget();
  setDraggingMode(false);
});

// === Long-press touch drag (mobile) ===
document.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse') return; // mouse uses HTML5 drag
  if (state.editing || state.viewing || state.quickAdd || state.showSearch) return;
  if (e.target.closest('button, input, textarea, select, a, [data-stop]')) return;
  if (e.target.closest('.crop-stage')) return; // crop tool handles this
  const card = e.target.closest('.card');
  if (!card) return;

  if (stickyMobileDrag) clearMobileDragSelection();
  try { card.setPointerCapture?.(e.pointerId); } catch {}
  longPress = {
    card, itemId: card.dataset.cardId,
    startX: e.clientX, startY: e.clientY,
    pointerId: e.pointerId,
    active: false,
    timer: setTimeout(() => {
      if (!longPress) return;
      longPress.active = true;
      draggingItemId = longPress.itemId;
      longPress.card.classList.add('long-press-arming');
      setDraggingMode(true);
      startDragGhost(longPress.card, e.clientX, e.clientY);
      longPress.card.classList.add('dragging');
      longPress.card.classList.remove('long-press-arming');
      if (navigator.vibrate) try { navigator.vibrate(15); } catch {}
    }, LONG_PRESS_MS),
  };
});

document.addEventListener('pointermove', (e) => {
  if (!longPress) return;
  const dx = e.clientX - longPress.startX;
  const dy = e.clientY - longPress.startY;
  if (!longPress.active) {
    if (Math.abs(dx) + Math.abs(dy) > LONG_PRESS_TOLERANCE) {
      clearTimeout(longPress.timer);
      releasePointerCaptureSafe(longPress.card, longPress.pointerId);
      longPress = null;
    }
    return;
  }
  // Active drag
  e.preventDefault();
  positionGhost(e.clientX, e.clientY);
  setDropTarget(findDropCollectionAt(e.clientX, e.clientY) || null);
});

document.addEventListener('pointerup', (e) => {
  if (!longPress) return;
  clearTimeout(longPress.timer);
  const wasActive = longPress.active;
  const itemId = longPress.itemId;
  const card = longPress.card;
  const pointerId = longPress.pointerId;
  longPress = null;
  releasePointerCaptureSafe(card, pointerId);
  card.classList.remove('long-press-arming');
  if (!wasActive) return; // it was just a tap — let click handle it

  endDragGhost();
  const target = findDropCollectionAt(e.clientX, e.clientY);
  const colId = target?.dataset.dropCol;
  clearDropTarget();
  if (isUserCollectionId(colId)) {
    card.classList.remove('dragging');
    setDraggingMode(false);
    draggingItemId = null;
    moveItemToCollection(itemId, colId);
    return;
  }
  suppressNextDragClick = true;
  keepMobileDragSelection(card, itemId);
});

document.addEventListener('pointercancel', () => {
  if (!longPress) return;
  clearTimeout(longPress.timer);
  const { active, card, itemId, pointerId } = longPress;
  longPress = null;
  releasePointerCaptureSafe(card, pointerId);
  card?.classList.remove('long-press-arming');
  if (active) {
    endDragGhost();
    clearDropTarget();
    suppressNextDragClick = false;
    keepMobileDragSelection(card, itemId);
    return;
  }
  card?.classList.remove('dragging');
  endDragGhost();
  clearDropTarget();
  setDraggingMode(false);
  draggingItemId = null;
});

// === External drops (from desktop / other browsers) ===
let extDragCounter = 0;
function isExternalDrag(e) {
  const types = e.dataTransfer?.types || [];
  return [...types].some(t => t === 'Files' || t === 'text/plain' || t === 'text/uri-list');
}
document.addEventListener('dragenter', (e) => {
  if (!isExternalDrag(e) || draggingItemId !== null) return;
  extDragCounter++;
  document.body.classList.add('ext-dragging');
});
document.addEventListener('dragleave', (e) => {
  if (draggingItemId !== null) return;
  extDragCounter = Math.max(0, extDragCounter - 1);
  if (extDragCounter === 0) document.body.classList.remove('ext-dragging');
});
window.addEventListener('drop', async (e) => {
  if (draggingItemId !== null) return; // internal drag handles its own drop
  if (!isExternalDrag(e)) return;
  e.preventDefault();
  extDragCounter = 0;
  document.body.classList.remove('ext-dragging');

  const dt = e.dataTransfer;
  // File first
  const file = dt.files?.[0];
  if (file) {
    if (isImageFileLike(file)) {
      const raw = await fileToDataUrl(file);
      const imageData = await compressImageDataUrl(raw);
      openQuickAdd({
        type: 'image', title: file.name.replace(/\.[^.]+$/, ''), content: '', url: '',
        imageData, originalImageData: imageData, cropRect: null,
        collection: activeUserCollectionId(),
        tags: ['imagem'], previewLabel: 'Imagem solta',
      });
      return;
    }
    try {
      const stored = await putStoredFile(file);
      openQuickAdd({
        type: 'file', title: file.name.replace(/\.[^.]+$/, ''), content: '', url: '',
        fileStorageId: stored.id, fileName: stored.name, fileType: stored.type, fileSize: stored.size,
        collection: activeUserCollectionId(),
        tags: [], previewLabel: 'Arquivo solto',
      });
    } catch (err) {
      console.error(err);
      showToast('Nao foi possivel carregar o arquivo');
    }
    return;
  }
  const uri = dt.getData('text/uri-list') || dt.getData('text/plain');
  if (!uri) return;
  const url = normalizeUrl(uri);
  if (url) {
    const meta = await quickProviderMetadata(url);
    openQuickAdd({
      type: 'link',
      title: meta?.title || getDomain(url) || '',
      content: '', url,
      thumbUrl: meta?.thumb || null,
      author: meta?.author || null,
      collection: activeUserCollectionId(),
      tags: [], previewLabel: 'Link solto',
    });
  } else {
    openQuickAdd({
      type: 'note', title: '', content: uri, url: '',
      collection: activeUserCollectionId(),
      tags: [], previewLabel: 'Texto solto',
    });
  }
});
document.addEventListener('dragover', (e) => {
  if (isExternalDrag(e)) e.preventDefault();
});

// ============ IMAGE / CROP HELPERS ============
function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function canvasToStorageDataUrl(canvas, preferPng = true) {
  if (preferPng) {
    const png = canvas.toDataURL('image/png');
    if (png.length <= 4200000) return png;
  }
  return canvas.toDataURL('image/jpeg', 0.94);
}

function renderEditorImagePreview(dataUrl, title = '') {
  return dataUrl ? `
    <button class="editor-image-preview" data-action="open-lightbox" data-src="${esc(dataUrl)}" type="button" aria-label="Ver foto em tela cheia">
      <img src="${esc(dataUrl)}" alt="${esc(title || 'Foto selecionada')}" draggable="false">
    </button>
  ` : '';
}

function renderStoredFilePreview(d) {
  return d?.fileStorageId ? `
    <div class="stored-file">
      <span class="stored-file-icon">${icon('folder', 18)}</span>
      <span class="stored-file-main">
        <strong>${esc(d.fileName || d.title || 'Arquivo')}</strong>
        <small>${esc([d.fileType || 'arquivo', formatBytes(d.fileSize)].filter(Boolean).join(' - '))}</small>
      </span>
    </div>
  ` : '';
}

function refreshEditorFileUI() {
  const field = $('#file-upload-field');
  if (!field || !modalDraft) return;
  const hasFile = !!modalDraft.fileStorageId;
  const titleInput = $('#f-title');
  if (titleInput && !titleInput.value && modalDraft.title) titleInput.value = modalDraft.title;
  const btnText = field.querySelector('.file-upload-btn span');
  if (btnText) btnText.textContent = hasFile ? 'Trocar arquivo' : 'Escolher arquivo';
  const actions = field.querySelector('.file-upload-actions');
  const removeBtn = field.querySelector('.file-remove-btn');
  if (hasFile && !removeBtn && actions) {
    actions.insertAdjacentHTML('beforeend', `<button class="file-remove-btn" data-action="clear-editor-file" type="button">${icon('x', 14)}<span>Remover</span></button>`);
  }
  if (!hasFile && removeBtn) removeBtn.remove();
  field.querySelector('.stored-file')?.remove();
  if (hasFile) {
    field.querySelector('.file-upload-box')?.insertAdjacentHTML('beforeend', renderStoredFilePreview(modalDraft));
  }
  setEditorTypeUI(modalDraft.type || 'file');
}

function refreshEditorImageUI() {
  const field = $('#image-upload-field');
  if (!field || !modalDraft) return;
  const hasImage = !!modalDraft.imageData;
  const titleInput = $('#f-title');
  if (titleInput && !titleInput.value && modalDraft.title) titleInput.value = modalDraft.title;
  const btnText = field.querySelector('.image-upload-btn span');
  if (btnText) btnText.textContent = hasImage ? 'Trocar foto' : 'Escolher foto';
  const actions = field.querySelector('.image-upload-actions');
  const removeBtn = field.querySelector('.image-remove-btn');
  if (hasImage && !removeBtn && actions) {
    actions.insertAdjacentHTML('beforeend', `<button class="image-remove-btn" data-action="clear-editor-image" type="button">${icon('x', 14)}<span>Remover</span></button>`);
  }
  if (!hasImage && removeBtn) removeBtn.remove();
  field.querySelector('.editor-image-preview')?.remove();
  if (hasImage) {
    field.querySelector('.image-upload-box')?.insertAdjacentHTML('beforeend', renderEditorImagePreview(modalDraft.imageData, modalDraft.title));
  }
  setEditorTypeUI(modalDraft.type || 'image');
}

function compressImageDataUrl(dataUrl, maxSize = 3800) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      if (dataUrl.length <= 3600000 && Math.max(img.width, img.height) <= maxSize) { resolve(dataUrl); return; }
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const width = Math.max(1, Math.round(img.width * scale));
      const height = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvasToStorageDataUrl(canvas, dataUrl.startsWith('data:image/png')));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
function cropRectFromPoints(a, b) {
  const x1 = clamp(Math.min(a.x, b.x), 0, 1);
  const y1 = clamp(Math.min(a.y, b.y), 0, 1);
  const x2 = clamp(Math.max(a.x, b.x), 0, 1);
  const y2 = clamp(Math.max(a.y, b.y), 0, 1);
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}
function pointInImage(e, rect) {
  return {
    x: clamp((e.clientX - rect.left) / rect.width, 0, 1),
    y: clamp((e.clientY - rect.top) / rect.height, 0, 1),
  };
}
function updateCropSelection(rect) {
  const sel = $('[data-crop-selection]');
  if (!sel || !cropDrag?.imgRect || !rect || rect.w < 0.01 || rect.h < 0.01) {
    if (sel) sel.style.display = 'none';
    return;
  }
  const box = cropDrag.imgRect;
  sel.style.display = 'block';
  sel.style.left = (box.left + rect.x * box.width) + 'px';
  sel.style.top = (box.top + rect.y * box.height) + 'px';
  sel.style.width = (rect.w * box.width) + 'px';
  sel.style.height = (rect.h * box.height) + 'px';
}
function setQuickTitleFromDom() {
  if (state.quickAdd) state.quickAdd.title = $('#quick-title')?.value ?? state.quickAdd.title;
}
async function applyImageCrop() {
  if (!state.quickAdd?.imageData || !state.quickAdd.cropRect) return;
  setQuickTitleFromDom();
  const rect = state.quickAdd.cropRect;
  if (rect.w < 0.02 || rect.h < 0.02) return;
  const img = new Image();
  await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; img.src = state.quickAdd.imageData; }).catch(() => null);
  if (!img.naturalWidth || !img.naturalHeight) return;
  const sx = Math.round(rect.x * img.naturalWidth);
  const sy = Math.round(rect.y * img.naturalHeight);
  const sw = Math.max(1, Math.round(rect.w * img.naturalWidth));
  const sh = Math.max(1, Math.round(rect.h * img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = sw; canvas.height = sh;
  canvas.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  state.quickAdd.imageData = canvasToStorageDataUrl(canvas, true);
  state.quickAdd.cropRect = null;
  refreshQuickAddPreviewUI();
}
function clearImageCrop() {
  if (!state.quickAdd?.originalImageData) return;
  setQuickTitleFromDom();
  state.quickAdd.imageData = state.quickAdd.originalImageData;
  state.quickAdd.cropRect = null;
  refreshQuickAddPreviewUI();
}

// Crop pointer handlers
document.addEventListener('pointerdown', (e) => {
  const stage = e.target.closest('[data-crop-stage]');
  if (!stage || !state.quickAdd?.imageData) return;
  const img = stage.querySelector('img');
  if (!img) return;
  setQuickTitleFromDom();
  const rect = img.getBoundingClientRect();
  cropDrag = { imgRect: rect, start: pointInImage(e, rect) };
  state.quickAdd.cropRect = { x: cropDrag.start.x, y: cropDrag.start.y, w: 0, h: 0 };
  updateCropSelection(state.quickAdd.cropRect);
  e.preventDefault(); e.stopPropagation();
});
document.addEventListener('pointermove', (e) => {
  if (!cropDrag || !state.quickAdd) return;
  const current = pointInImage(e, cropDrag.imgRect);
  state.quickAdd.cropRect = cropRectFromPoints(cropDrag.start, current);
  updateCropSelection(state.quickAdd.cropRect);
  e.preventDefault();
});
document.addEventListener('pointerup', () => {
  if (!cropDrag) return;
  cropDrag = null;
  const rect = state.quickAdd?.cropRect;
  // Auto-apply: if the selection is meaningful, crop immediately. If it's
  // a tiny accidental drag (just a click), discard the selection. No
  // separate "Cortar" button needed — the act of releasing IS the action.
  if (rect && rect.w > 0.05 && rect.h > 0.05) {
    applyImageCrop();
  } else {
    if (state.quickAdd) state.quickAdd.cropRect = null;
    updateCropSelection(null);
  }
});
document.addEventListener('pointercancel', () => { cropDrag = null; updateCropSelection(null); });

// ============ CLIPBOARD / PASTE ============
async function draftFromClipboardData(clipboardData) {
  const items = Array.from(clipboardData?.items || []);
  const text = clipboardData?.getData('text/plain')?.trim();
  const imageItem = items.find(it => it.type?.startsWith('image/'));
  if (imageItem) {
    const file = imageItem.getAsFile();
    if (file) {
      const raw = await fileToDataUrl(file);
      const imageData = await compressImageDataUrl(raw);
      return {
        type: 'image', title: '', content: text || '', url: '',
        imageData, originalImageData: imageData, cropRect: null,
        collection: activeUserCollectionId(),
        tags: ['imagem'], previewLabel: text ? 'Texto e imagem colados' : 'Imagem colada',
      };
    }
  }
  if (!text) return null;
  const url = normalizeUrl(text);
  if (url) {
    const meta = await quickProviderMetadata(url);
    return {
      type: 'link',
      title: meta?.title || getDomain(url) || '',
      content: '', url,
      thumbUrl: meta?.thumb || null,
      author: meta?.author || null,
      collection: activeUserCollectionId(),
      tags: [], previewLabel: 'Link colado',
    };
  }
  return {
    type: 'note', title: '', content: text, url: '',
    collection: activeUserCollectionId(),
    tags: [], previewLabel: 'Texto colado', previewStyle: 'centered-text',
  };
}

document.addEventListener('paste', async (e) => {
  const clipboardItems = Array.from(e.clipboardData?.items || []);
  const imageItem = clipboardItems.find(it => it.type?.startsWith('image/'));
  if (state.editing && imageItem && isEditableTarget(e.target)) {
    const file = imageItem.getAsFile();
    if (!file) return;
    e.preventDefault();
    const text = e.clipboardData?.getData('text/plain') || '';
    if (text && e.target.id === 'f-content') {
      const start = e.target.selectionStart ?? e.target.value.length;
      const end = e.target.selectionEnd ?? start;
      e.target.value = e.target.value.slice(0, start) + text + e.target.value.slice(end);
      const cursor = start + text.length;
      try { e.target.setSelectionRange(cursor, cursor); } catch {}
      if (modalDraft) modalDraft.content = e.target.value;
    }
    await attachImageToEditingItem(file);
    return;
  }
  if (state.editing || state.viewing || state.quickAdd || state.showSearch) return;
  if (isEditableTarget(e.target)) return;
  const hasImage = clipboardItems.some(it => it.type?.startsWith('image/'));
  const hasText = !!e.clipboardData?.getData('text/plain')?.trim();
  if (!hasImage && !hasText) return;
  e.preventDefault();
  const draft = await draftFromClipboardData(e.clipboardData);
  if (!draft) return;
  trackEvent('action', draft.type === 'image' ? 'paste_image' : draft.type === 'link' ? 'paste_link' : 'paste_text', {
    type: draft.type,
    has_image: !!draft.imageData,
    has_url: !!draft.url,
  });
  openQuickAdd(draft);
});

// ============ MODAL DRAFT HELPERS ============
function commitDraftFromDom() {
  if (!modalDraft) return null;
  const item = {
    ...modalDraft,
    title: $('#f-title')?.value.trim() || '',
    url: $('#f-url')?.value.trim() || '',
    content: $('#f-content')?.value.trim() || '',
  };
  if (item.type !== 'note' || !item.textStyle || isDefaultTextStyle(item.textStyle)) {
    delete item.textStyle;
  } else {
    item.textStyle = normalizeTextStyle(item.textStyle);
  }
  return item;
}
function syncDraftFromDom() {
  if (!modalDraft) return;
  modalDraft.title = $('#f-title')?.value ?? modalDraft.title;
  modalDraft.url = $('#f-url')?.value ?? modalDraft.url;
  modalDraft.content = $('#f-content')?.value ?? modalDraft.content;
}

function updateFolderSelectionUI(rowSelector, attrName, value) {
  $$(`${rowSelector} [${attrName}]`).forEach(btn => {
    const active = btn.getAttribute(attrName) === value;
    btn.classList.toggle('active', active);
    if (active) {
      const col = state.collections.find(c => c.id === value);
      if (col?.color) {
        btn.style.background = col.color;
        btn.style.borderColor = col.color;
      }
    } else {
      btn.style.background = '';
      btn.style.borderColor = '';
    }
  });
}

function refreshTagRowUI() {
  const row = $('#tag-row');
  if (!row || !modalDraft) return;
  const inputValue = $('#f-tag')?.value || '';
  row.innerHTML = `
    ${modalDraft.tags.map(t => `
      <span class="tag-chip" data-tag="${esc(t)}">
        ${esc(t)}
        <button class="tag-remove" data-remove-tag="${esc(t)}">${icon('x', 11)}</button>
      </span>
    `).join('')}
    <input class="tag-input" id="f-tag" placeholder="adicionar tag..." value="${esc(inputValue)}">
  `;
  $('#f-tag')?.focus();
}

function setEditorTypeUI(type) {
  $('#url-field')?.style && ($('#url-field').style.display = ((type === 'link' || type === 'post' || type === 'file') ? '' : 'none'));
  $('#image-upload-field')?.style && ($('#image-upload-field').style.display = (type === 'image' ? '' : 'none'));
  $('#file-upload-field')?.style && ($('#file-upload-field').style.display = (type === 'file' ? '' : 'none'));
  const urlLabel = document.querySelector('#url-field .field-label');
  if (urlLabel) urlLabel.textContent = type === 'file' ? 'Caminho ou link' : 'Link';
  const urlInput = $('#f-url');
  if (urlInput) urlInput.placeholder = type === 'file' ? 'Ex: ~/Documentos/arquivo.pdf' : 'https://...';
  const contentLabel = document.querySelector('[data-content-label]');
  if (contentLabel) contentLabel.textContent = type === 'note' ? 'Conteúdo' : 'Anotações';
  const textarea = $('#f-content');
  if (textarea) {
    const style = normalizeTextStyle(modalDraft?.textStyle);
    textarea.rows = type === 'note' ? 8 : 4;
    textarea.placeholder = type === 'note' ? 'Escreva aqui...' : 'O que achou? Por que salvou?';
    textarea.className = `textarea ${type === 'note' ? `note-textarea ${textStyleClass(style)}` : ''}`;
  }
  const toolbar = $('#text-style-toolbar');
  if (toolbar) toolbar.style.display = type === 'note' ? '' : 'none';
  $$('#type-row [data-type]').forEach(btn => btn.classList.toggle('active', btn.dataset.type === type));
}

function changeDraftField(key, value) {
  if (!modalDraft) return;
  syncDraftFromDom();
  modalDraft[key] = value;
  state.editing = { ...modalDraft, isNew: !modalDraft.id };
  if (key === 'collection') {
    updateFolderSelectionUI('#coll-row', 'data-coll', value);
    return;
  }
  if (key === 'type') {
    setEditorTypeUI(value);
    return;
  }
  renderModal();
}

function changeDraftTextStyle(key, value) {
  if (!modalDraft) return;
  syncDraftFromDom();
  const style = normalizeTextStyle(modalDraft.textStyle);
  style[key] = value;
  modalDraft.textStyle = isDefaultTextStyle(style) ? null : style;
  state.editing = { ...modalDraft, isNew: !modalDraft.id };
  const normalized = normalizeTextStyle(modalDraft.textStyle);
  $(`[data-text-style="${key}"][data-value="${value}"]`)?.focus();
  $$(`[data-text-style="${key}"]`).forEach(btn => btn.classList.toggle('active', btn.dataset.value === value));
  const textarea = $('#f-content');
  if (textarea) {
    textarea.className = `textarea note-textarea ${textStyleClass(normalized)}`;
    textarea.focus();
  }
}

function toggleDraftBullets() {
  if (!modalDraft) return;
  syncDraftFromDom();
  const lines = String(modalDraft.content || '').split('\n');
  const nonEmpty = lines.filter(line => line.trim());
  const shouldRemove = nonEmpty.length > 0 && nonEmpty.every(line => /^\s*[-*]\s+/.test(line));
  modalDraft.content = lines.map(line => {
    if (!line.trim()) return line;
    return shouldRemove ? line.replace(/^(\s*)[-*]\s+/, '$1') : line.replace(/^(\s*)/, '$1- ');
  }).join('\n');
  state.editing = { ...modalDraft, isNew: !modalDraft.id };
  const textarea = $('#f-content');
  if (textarea) {
    textarea.value = modalDraft.content;
    textarea.focus();
  }
}

function handleSave() {
  const d = commitDraftFromDom();
  if (!d) return;
  if (!d.title && !d.content && !d.url) { closeEditor(); return; }
  saveItem(d);
}

// ============ CLICKS ============
document.addEventListener('click', (e) => {
  if (stickyMobileDrag) {
    e.preventDefault();
    e.stopPropagation();
    const target = e.target.closest('[data-drop-col]');
    const colId = target?.dataset.dropCol;
    if (suppressNextDragClick) {
      suppressNextDragClick = false;
      if (!isUserCollectionId(colId)) return;
    }
    if (isUserCollectionId(colId)) completeMobileDrop(colId);
    else clearMobileDragSelection();
    return;
  }

  if (e.target.closest('[data-stop]') && !state.selectMode) return;

  // Modal-internal interactions
  if (e.target.closest('.modal-panel')) {
    const typeChip = e.target.closest('#type-row [data-type]');
    if (typeChip) { e.stopPropagation(); changeDraftField('type', typeChip.dataset.type); return; }
    const textStyleBtn = e.target.closest('[data-text-style]');
    if (textStyleBtn) { e.stopPropagation(); changeDraftTextStyle(textStyleBtn.dataset.textStyle, textStyleBtn.dataset.value); return; }
    const textToolBtn = e.target.closest('[data-text-tool]');
    if (textToolBtn) {
      e.stopPropagation();
      if (textToolBtn.dataset.textTool === 'bullet') toggleDraftBullets();
      return;
    }
    const collChip = e.target.closest('#coll-row [data-coll]');
    if (collChip) { e.stopPropagation(); changeDraftField('collection', collChip.dataset.coll); return; }
    const removeTagBtn = e.target.closest('[data-remove-tag]');
    if (removeTagBtn) {
      e.stopPropagation();
      const t = removeTagBtn.dataset.removeTag;
      syncDraftFromDom();
      modalDraft.tags = modalDraft.tags.filter(x => x !== t);
      state.editing = { ...modalDraft, isNew: !modalDraft.id };
      refreshTagRowUI();
      return;
    }
    const quickCollChip = e.target.closest('#quick-coll-row [data-quick-coll]');
    if (quickCollChip && state.quickAdd) {
      e.stopPropagation();
      state.quickAdd.title = $('#quick-title')?.value ?? state.quickAdd.title;
      state.quickAdd.collection = quickCollChip.dataset.quickColl;
      updateFolderSelectionUI('#quick-coll-row', 'data-quick-coll', state.quickAdd.collection);
      return;
    }
    const nfIcon = e.target.closest('[data-nf-icon]');
    if (nfIcon && state.newFolder) { e.stopPropagation(); patchNewFolder({ icon: nfIcon.dataset.nfIcon }); return; }
    const nfColor = e.target.closest('[data-nf-color]');
    if (nfColor && state.newFolder) { e.stopPropagation(); patchNewFolder({ color: nfColor.dataset.nfColor }); return; }
  }

  // Overlay click (outside panel) — close
  const overlay = e.target.closest('[data-close-overlay]');
  if (overlay && !e.target.closest('[data-stop-prop]')) {
    if (state.editing || state.viewing || state.quickAdd || state.newFolder) return;
    if (state.showSearch) closeSearch();
    return;
  }
  const onboardingOverlay = e.target.closest('[data-onboarding-overlay]');
  if (onboardingOverlay && !e.target.closest('[data-stop-prop]')) {
    closeOnboarding();
    return;
  }
  const syncOverlay = e.target.closest('[data-sync-overlay]');
  if (syncOverlay && !e.target.closest('[data-stop-prop]')) {
    closeSyncPanel();
    return;
  }
  const statsOverlay = e.target.closest('[data-stats-overlay]');
  if (statsOverlay && !e.target.closest('[data-stop-prop]')) {
    closeStatsPanel();
    return;
  }

  // Generic action dispatcher
  const actionEl = e.target.closest('[data-action]');
  if (!actionEl) return;
  const action = actionEl.dataset.action;
  const id = actionEl.dataset.id;
  e.stopPropagation();
  const trackedItem = id ? state.items.find(i => i.id === id) : null;
  trackEvent('action', action, {
    item_type: trackedItem ? cardTypeKind(trackedItem) : '',
    collection_id: action === 'set-col' || action === 'bulk-move' ? id : '',
  });

  switch (action) {
    case 'set-col': setActiveCol(id); break;
    case 'add-col': addCollection(); break;
    case 'edit-col': editCollection(id); break;
    case 'del-col': deleteCollection(id); break;
    case 'toggle-pin-col': toggleCollectionPin(id); break;
    case 'toggle-select-mode': toggleSelectMode(); break;
    case 'toggle-card-select': toggleItemSelection(id); break;
    case 'toggle-pin-item': toggleItemPin(id); break;
    case 'clear-selection': clearSelection({ exit: true }); break;
    case 'select-all-visible': selectAllVisibleItems(); break;
    case 'delete-selected-trash': permanentlyDeleteSelectedTrash(); break;
    case 'bulk-move': moveSelectedItemsToCollection(id); break;
    case 'new-item': openEditor(null); break;
    case 'view':
      if (state.selectMode) toggleItemSelection(id);
      else openViewer(state.items.find(i => i.id === id));
      break;
    case 'edit': openEditor(state.items.find(i => i.id === id)); break;
    case 'toggle-studied': toggleStudied(id); break;
    case 'open-search': openSearch(); break;
    case 'close-editor': closeEditor(); break;
    case 'close-viewer': closeViewer(); break;
    case 'close-quick-add': closeQuickAdd(); break;
    case 'close-new-folder': closeNewFolder(); break;
    case 'save-new-folder': saveNewFolder(); break;
    case 'apply-crop': applyImageCrop(); break;
    case 'clear-crop': clearImageCrop(); break;
    case 'clear-editor-image': clearEditorImage(); break;
    case 'clear-editor-file': clearEditorFile(); break;
    case 'download-file': downloadStoredFile(id); break;
    case 'open-pdf-reader': openPdfReader(id); break;
    case 'close-pdf-reader': closePdfReader(); break;
    case 'toggle-image-zoom': actionEl.classList.toggle('expanded'); break;
    case 'open-lightbox': openLightbox(actionEl.dataset.src); break;
    case 'close-lightbox': closeLightbox(); break;
    case 'edit-quick-add': editQuickAdd(); break;
    case 'save-item': handleSave(); break;
    case 'save-quick-add': saveQuickAdd(); break;
    case 'delete-item': deleteItem(id); break;
    case 'restore-item': restoreItem(id); break;
    case 'empty-trash': emptyTrash(); break;
    case 'open-result':
      const item = state.items.find(i => i.id === id);
      closeSearch();
      if (item) openViewer(item);
      break;
    case 'open-sidebar': toggleSidebar(true); break;
    case 'close-sidebar': toggleSidebar(false); break;
    case 'set-tag': setActiveTag(actionEl.dataset.tag); break;
    case 'clear-tag': state.activeTag = null; renderApp(); break;
    case 'set-kind':
      if (actionEl.dataset.root === 'all') state.activeCol = 'all';
      setActiveKind(actionEl.dataset.kind);
      break;
    case 'cycle-sort': cycleSortMode(); break;
    case 'export-library': exportLibrary(); break;
    case 'import-library': importLibrary(); break;
    case 'open-onboarding': openOnboarding(); break;
    case 'open-sync': renderSyncPanel(); break;
    case 'close-sync': closeSyncPanel(); break;
    case 'open-stats': loadAnalyticsPanel(); break;
    case 'refresh-stats': loadAnalyticsPanel(); break;
    case 'close-stats': closeStatsPanel(); break;
    case 'close-onboarding': closeOnboarding(); break;
    case 'sync-google': handleSyncGoogle(); break;
    case 'sync-login': handleSyncAuth('login'); break;
    case 'sync-signup': handleSyncAuth('signup'); break;
    case 'sync-logout': handleSyncLogout(); break;
    case 'sync-now': pullLibraryFromCloud(); break;
    case 'open-tweaks':
      if (state.showSidebar) state.showSidebar = false;
      window.btnOpenTweaks?.();
      renderApp();
      break;
  }
});

// ============ KEYBOARD ============
function handleEscapeClose(e) {
  const isEscape = e.key === 'Escape' || e.key === 'Esc' || e.code === 'Escape';
  if (!isEscape) return false;

  const confirmRoot = $('#confirm-root');
  if (confirmRoot?.querySelector('.confirm-overlay')) return false;

  const handled = !!(
    confirmRoot?.querySelector('.pdf-reader-overlay, .lightbox-overlay, .sync-overlay') ||
    state.editing ||
    state.viewing ||
    state.quickAdd ||
    state.newFolder ||
    state.showStats ||
    state.showSearch ||
    state.showOnboarding ||
    state.showSidebar
  );
  if (!handled) return false;

  e.preventDefault();
  e.stopPropagation();

  if (confirmRoot?.querySelector('.pdf-reader-overlay')) closePdfReader();
  else if (confirmRoot?.querySelector('.lightbox-overlay')) closeLightbox();
  else if (confirmRoot?.querySelector('.sync-overlay')) closeSyncPanel();
  else if (state.showStats) closeStatsPanel();
  else if (state.editing) closeEditor();
  else if (state.viewing) closeViewer();
  else if (state.quickAdd) closeQuickAdd();
  else if (state.newFolder) closeNewFolder();
  else if (state.showSearch) closeSearch();
  else if (state.showOnboarding) closeOnboarding();
  else if (state.showSidebar) toggleSidebar(false);
  return true;
}

document.addEventListener('keydown', handleEscapeClose, true);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' || e.key === 'Esc' || e.code === 'Escape') return;
  const mod = e.metaKey || e.ctrlKey;
  if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); openSearch(); return; }
  if (mod && e.key.toLowerCase() === 'n') { e.preventDefault(); openEditor(null); return; }

  // Textareas keep Enter as a real line break inside the item body.
  if (e.target.id === 'f-content' && e.key === 'Enter' && !mod) {
    e.preventDefault();
    e.stopPropagation();
    const el = e.target;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? start;
    el.setRangeText('\n', start, end, 'end');
    if (modalDraft) modalDraft.content = el.value;
    return;
  }

  // Enter on the new-folder name input → submit
  if (e.target.id === 'nf-name' && e.key === 'Enter') {
    e.preventDefault();
    saveNewFolder();
    return;
  }

  if (e.target.id === 'quick-title' && e.key === 'Enter') {
    e.preventDefault();
    saveQuickAdd();
    return;
  }

  // Tag input handling
  const tagInput = $('#f-tag');
  if (e.target === tagInput && modalDraft) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const v = tagInput.value.trim();
      if (v && !modalDraft.tags.includes(v)) {
        modalDraft.tags.push(v);
        syncDraftFromDom();
        state.editing = { ...modalDraft, isNew: !modalDraft.id };
        tagInput.value = '';
        refreshTagRowUI();
      } else { tagInput.value = ''; }
      return;
    }
    if (e.key === 'Backspace' && !tagInput.value && modalDraft.tags.length) {
      modalDraft.tags.pop();
      syncDraftFromDom();
      state.editing = { ...modalDraft, isNew: !modalDraft.id };
      refreshTagRowUI();
      return;
    }
  }

});

// ============ INPUTS ============
document.addEventListener('input', (e) => {
  if (e.target.id === 'search-input') {
    state.search = e.target.value;
    updateSearchResults();
  }
  if (e.target.id === 'f-title') {
    e.target.dataset.autoTitle = 'false';
    if (modalDraft) modalDraft.title = e.target.value;
  }
  if (e.target.id === 'f-url') {
    const value = e.target.value.trim();
    if (modalDraft) modalDraft.url = value;
    scheduleYouTubeTitleFill(value);
  }
  if (e.target.id === 'quick-title' && state.quickAdd) {
    state.quickAdd.title = e.target.value;
  }
  if (e.target.id === 'nf-name' && state.newFolder) {
    state.newFolder.name = e.target.value;
    const preview = document.querySelector('.nf-preview-row .col-item-left span:last-child');
    if (preview) preview.textContent = e.target.value.trim() || 'Sua pasta';
  }
});

document.addEventListener('change', async (e) => {
  if (e.target.id === 'f-image') {
    const file = e.target.files?.[0];
    await handleEditorImageUpload(file);
  }
  if (e.target.id === 'f-file') {
    const file = e.target.files?.[0];
    await handleEditorFileUpload(file);
  }
});

// Re-render on resize between mobile/desktop breakpoint
let lastIsMobile = isMobile();
window.addEventListener('resize', () => {
  const cur = isMobile();
  if (cur !== lastIsMobile) {
    lastIsMobile = cur;
    if (state.showSidebar && !cur) state.showSidebar = false;
    renderAll();
  }
});

// ============ INIT ============
load();
renderAll();
hydrateStoredImages();
if (state.items.some(item => item?.imageData && !item.imageStorageId)) persist();
initSync();
// Backfill thumbs for existing items in the background.
setTimeout(enrichLibrary, 800);
