
'use strict';
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = s => { s = Math.max(0, Math.round(s || 0)); return Math.floor(s/60) + ':' + String(s%60).padStart(2,'0'); };
let toastT;
function toast(m){ const t = $('#toast'); t.textContent = m; t.hidden = false;
  requestAnimationFrame(()=>t.classList.add('show'));
  clearTimeout(toastT); toastT = setTimeout(()=>{ t.classList.remove('show'); setTimeout(()=>t.hidden = true, 350); }, 2400); }
const debounce = (f, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(()=>f(...a), ms); }; };

const LS = {
  get(k, d){ try { const v = localStorage.getItem('sw_' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v){ try { localStorage.setItem('sw_' + k, JSON.stringify(v)); } catch {} }
};

if (window.__TAURI__ && window.__TAURI__.http && !window.__swNativeFetch){
  window.__swNativeFetch = async u => {
    const r = await window.__TAURI__.http.fetch(u);
    return { status: r.status, text: await r.text() };
  };
}

const ACCENTS = {
  orange:['#ff5500','#ff9500','rgba(255,85,0,.16)','rgba(255,90,0,.45)'],
  green:['#30d158','#8affb5','rgba(48,209,88,.16)','rgba(48,209,88,.45)'],
  blue:['#0a84ff','#7ad7ff','rgba(10,132,255,.16)','rgba(10,132,255,.45)'],
  pink:['#ff375f','#ff8fa3','rgba(255,55,95,.16)','rgba(255,55,95,.45)'],
  purple:['#bf5af2','#d8b4fe','rgba(191,90,242,.16)','rgba(191,90,242,.45)'],
  teal:['#30d4e0','#9ee8f5','rgba(48,212,224,.16)','rgba(48,212,224,.45)'],
  sunset:['#ff6b35','#ffd166','rgba(255,107,53,.16)','rgba(255,107,53,.45)'],
  mint:['#00c896','#7fffd4','rgba(0,200,150,.16)','rgba(0,200,150,.45)']
};
function buildCustomAccent(hex){
  const c = String(hex || '#ff5500').toLowerCase();
  const r = parseInt(c.slice(1,3),16) || 255, g = parseInt(c.slice(3,5),16) || 85, b = parseInt(c.slice(5,7),16) || 0;
  const lit = v => Math.round(v + (255 - v) * 0.2);
  const h = n => n.toString(16).padStart(2,'0');
  const acc2 = '#' + h(lit(r)) + h(lit(g)) + h(lit(b));
  return [c, acc2, `rgba(${r},${g},${b},.16)`, `rgba(${r},${g},${b},.45)`];
}

const state = {
  likes: LS.get('likes', []),
  history: LS.get('history', []),
  playlists: LS.get('playlists', []),
  stats: LS.get('stats', {sec:0, art:{}, day:{}, tracks:0}),
  autoRelated: LS.get('autorel', true),
  fullOnly: LS.get('fullonly', false),
  viz: LS.get('viz', false),
  amoled: LS.get('amoled', false),
  theme: LS.get('theme', 'dark'),
  accent: LS.get('accent', 'orange'),
  shuffle: LS.get('shuffle', false),
  repeat: LS.get('repeat', 'off'),
  vizMode: LS.get('vizMode', 0),
  eq: LS.get('eq', 'flat'),
  abLoop: null,
  pinned: LS.get('pinned', []),
  karaoke: LS.get('karaoke', false),
  crossfade: LS.get('crossfade', 0),
  bassKnob: LS.get('bassKnob', 50),
  trebleKnob: LS.get('trebleKnob', 50),
  followed: LS.get('followed', []),
  tabs: LS.get('tabs', {}),
  savedSearches: LS.get('savedSearches', []),
  normalize: LS.get('normalize', false),
  localTracks: []
};
if (state.accent === 'custom'){ ACCENTS.custom = buildCustomAccent(LS.get('accent-custom', '#ff5500')); }

function applyTheme(){
  const a = ACCENTS[state.accent] || ACCENTS.orange;
  const r = document.documentElement.style;
  r.setProperty('--acc', a[0]); r.setProperty('--acc2', a[1]);
  r.setProperty('--grad', `linear-gradient(135deg,${a[0]},${a[1]})`);
  r.setProperty('--accg', a[2]);
  document.documentElement.setAttribute('data-theme', state.theme || 'dark');
  document.documentElement.classList.toggle('amoled', state.amoled && state.theme !== 'light');
}

const I = {
  play:  '<svg viewBox="0 0 24 24" width="27" height="27" fill="currentColor"><path d="M8 5.14v13.72c0 .8.87 1.3 1.56.9l11.1-6.86a1.05 1.05 0 0 0 0-1.8L9.56 4.24A1.05 1.05 0 0 0 8 5.14Z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor"><rect x="6" y="4" width="4.6" height="16" rx="1.7"/><rect x="13.4" y="4" width="4.6" height="16" rx="1.7"/></svg>',
  next:  '<svg viewBox="0 0 24 24" width="30" height="30" fill="currentColor"><path d="M5 6.3v11.4a1 1 0 0 0 1.54.84l8.9-5.7a1 1 0 0 0 0-1.68l-8.9-5.7A1 1 0 0 0 5 6.3Z"/><rect x="16.6" y="5" width="2.7" height="14" rx="1.3"/></svg>',
  prev:  '<svg viewBox="0 0 24 24" width="30" height="30" fill="currentColor"><path d="M19 6.3v11.4a1 1 0 0 1-1.54.84l-8.9-5.7a1 1 0 0 1 0-1.68l8.9-5.7A1 1 0 0 1 19 6.3Z"/><rect x="4.7" y="5" width="2.7" height="14" rx="1.3"/></svg>',
  shuffle:'<svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3h5v5"/><path d="M4 20 21 3"/><path d="M21 16v5h-5"/><path d="m15 15 6 6"/><path d="m4 4 5 5"/></svg>',
  repeat:'<svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/></svg>',
  repeat1:'<svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/><text x="12" y="14.5" font-size="9" font-weight="800" fill="currentColor" stroke="none" text-anchor="middle">1</text></svg>',
  heart: '<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>',
  heartF:'<svg viewBox="0 0 24 24" width="21" height="21" fill="currentColor" stroke="currentColor" stroke-width="1" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>',
  note:  '<svg viewBox="0 0 24 24" width="46" height="46" fill="none" stroke="#8e8ea3" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>'
};
const EMPTY_SVG = {
  search: '<svg viewBox="0 0 120 96" width="120" height="96" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="52" cy="42" r="30" stroke="var(--acc2)" stroke-width="5" opacity=".35"/><circle cx="52" cy="42" r="20" stroke="var(--acc)" stroke-width="4"/><path d="M70 60l20 20" stroke="var(--acc)" stroke-width="6"/><path d="M44 42h16M52 34v16" stroke="var(--acc2)" stroke-width="3" opacity=".7"/></svg>',
  library: '<svg viewBox="0 0 120 96" width="120" height="96" fill="none" stroke-linecap="round" stroke-linejoin="round"><rect x="20" y="22" width="22" height="56" rx="5" stroke="var(--acc)" stroke-width="4"/><rect x="48" y="30" width="22" height="48" rx="5" stroke="var(--acc2)" stroke-width="4" opacity=".55"/><rect x="76" y="18" width="22" height="60" rx="5" stroke="var(--acc)" stroke-width="4"/><circle cx="31" cy="70" r="6" stroke="var(--acc2)" stroke-width="3"/><circle cx="87" cy="66" r="7" stroke="var(--acc2)" stroke-width="3"/></svg>',
  queue: '<svg viewBox="0 0 120 96" width="120" height="96" fill="none" stroke-linecap="round" stroke-linejoin="round"><rect x="14" y="18" width="92" height="60" rx="10" stroke="var(--acc)" stroke-width="4"/><path d="M14 38h92" stroke="var(--acc2)" stroke-width="3" opacity=".5"/><circle cx="26" cy="28" r="3" fill="var(--acc2)"/><rect x="26" y="50" width="50" height="5" rx="2.5" stroke="var(--acc2)" stroke-width="2.5"/><rect x="26" y="62" width="35" height="5" rx="2.5" stroke="var(--acc)" stroke-width="2.5" opacity=".6"/><circle cx="88" cy="52" r="11" stroke="var(--acc)" stroke-width="3.5"/><path d="M84 52l3 3 6-6" stroke="var(--acc2)" stroke-width="3"/></svg>'
};
const PLACEHOLDER = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2b2b40"/><stop offset="1" stop-color="#191926"/></linearGradient></defs><rect width="120" height="120" fill="url(#g)"/><path d="M52 82c-7.2 0-13-5.8-13-13s5.8-13 13-13c1.4 0 2.7.2 4 .6V42h-5v-5h10v32.2c0 7-5.8 12.8-13 12.8Z" fill="#45455e" transform="translate(9 -4)"/></svg>');
const EQ = '<span class="eq"><i></i><i></i><i></i></span>';

const API = 'https://api-v2.soundcloud.com';
const FALLBACK_CID = 'UMY1dzQ68n2QbCuypNe8JOivmV2FO2Ep';
let cid = LS.get('cid', null) || FALLBACK_CID;
let cidState = 'mid';
let localProxy = null;
let transport = 'auto';

async function probeLocal(){ try { const r = await fetch('/sc?ping=1', { cache: 'no-store' }); localProxy = r.ok && (r.headers.get('content-type') || '').includes('json'); } catch { localProxy = false; } }

function wrapUrl(t, url){
  if (t === 'local') return '/sc?url=' + encodeURIComponent(url);
  if (t === 'p1' || t === 'p2'){
    if (/[?&]client_id=/.test(url) || /(api-v2\.soundcloud\.com|lrclib\.net|api\.lyrics\.ovh|genius\.com|mymemory\.translated\.net)/.test(url)) return url;
    if (t === 'p1') return 'https://corsproxy.io/?url=' + encodeURIComponent(url);
    return 'https://api.allorigins.win/raw?url=' + encodeURIComponent(url);
  }
  return url;
}
function shimResp(text, status){
  status = status || 200;
  return { ok: status >= 200 && status < 300, status, text: async () => text, json: async () => JSON.parse(text) };
}
function withTimeoutMs(p, ms){
  return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
}
async function rawFetch(url){
  let order = [];
  if (window.__swNativeFetch) order.push('native');
  if (localProxy) order.push('local');
  order.push('direct', 'p1', 'p2');
  if (transport !== 'auto') order = [transport, ...order.filter(t => t !== transport)];
  let lastErr;
  for (const t of order){
    try {
      if (t === 'native'){
        const r = await withTimeoutMs(window.__swNativeFetch(url), 20000);
        transport = t;
        return shimResp(r.text, r.status);
      }
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), 20000);
      const r = await fetch(wrapUrl(t, url), { cache: 'no-store', signal: ctrl.signal });
      clearTimeout(to);
      transport = t; return r;
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('сеть недоступна');
}

const CID_RE = /client_id["']?\s*[:=]\s*["']([0-9a-zA-Z]{28,40})["']/;
async function discoverCid(){
  const r = await rawFetch('https://soundcloud.com/');
  const html = await r.text();
  const assets = [...new Set([...html.matchAll(/https:\/\/a-v2\.sndcdn\.com\/assets\/[^"'\\\s]+?\.js/g)].map(m => m[0]))].slice(0, 14);
  for (const a of assets){
    try {
      const rr = await rawFetch(a);
      const t = await rr.text();
      const m = t.match(CID_RE);
      if (m){ setCid(m[1]); return m[1]; }
    } catch {}
  }
  throw new Error('ключ не найден');
}
function setCid(id){ cid = id; LS.set('cid', id); $('#cid-input').value = id; }

async function apiGet(path, params = {}, retried = false){
  const qs = new URLSearchParams(params);
  qs.set('client_id', cid);
  const r = await rawFetch(`${API}${path}?${qs}`);
  if (r.status === 401 || r.status === 403){
    if (retried) throw new Error('API-ключ отклонён');
    await discoverCid();
    return apiGet(path, params, true);
  }
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const j = await r.json();
  if (cidState !== 'ok'){ cidState = 'ok'; updateCidUI(); }
  return j;
}

function normTrack(t){
  return {
    id: t.id,
    title: t.title || 'Без названия',
    artist: (t.user && t.user.username) || '',
    uid: t.user && t.user.id || 0,
    uart: ((t.user && t.user.avatar_url) || '').replace('-large.', '-t500x500.'),
    art: ((t.artwork_url) || (t.user && t.user.avatar_url) || '').replace('-large.', '-t500x500.'),
    dur: (t.duration || 0) / 1000,
    ok: t.streamable !== false && t.policy !== 'BLOCK' && !!(t.media && t.media.transcodings && t.media.transcodings.length),
    snip: t.policy === 'SNIP',
    link: t.permalink_url || '',
    plays: t.playback_count || 0,
    media: t.media
  };
}
const okList = list => list.filter(x => x.ok && (!state.fullOnly || !x.snip));
let localSeq = 0;
function localTrackObj(lt){
  return {
    id: lt.id,
    title: (lt.name || 'Локальный файл').replace(/\.[^.]+$/, ''),
    artist: 'Локальный файл',
    uid: 0,
    art: '',
    dur: lt.dur || 0,
    ok: true,
    snip: false,
    link: '',
    plays: 0,
    localUrl: lt.url,
    local: true
  };
}

async function searchTracks(q, offset = 0){
  const j = await apiGet('/search/tracks', { q, limit: 30, offset });
  return okList((j.collection || []).map(normTrack));
}
async function searchPlaylists(q, offset = 0){
  const j = await apiGet('/search/playlists', { q, limit: 20, offset });
  return (j.collection || []).map(p => ({
    id: p.id, title: p.title || 'Плейлист', art: (p.artwork_url || '').replace('-large.', '-t500x500.'),
    count: p.track_count || (p.tracks && p.tracks.length) || 0, user: p.user && p.user.username || ''
  }));
}
async function getPlaylistTracks(id){
  const j = await apiGet('/playlists/' + id);
  return okList((j.tracks || []).map(normTrack));
}
async function getArtist(id){
  const u = await apiGet('/users/' + id);
  const j = await apiGet('/users/' + id + '/tracks', { limit: 50 });
  const tracks = okList((j.collection || []).map(normTrack)).sort((a, b) => b.plays - a.plays);
  return { name: u.username || 'Артист', art: (u.avatar_url || '').replace('-large.', '-t500x500.'),
    followers: u.followers_count || 0, desc: (u.description || '').slice(0, 160), tracks };
}
async function getRelated(id){
  const j = await apiGet(`/tracks/${id}/related`, { limit: 20 });
  return okList((j.collection || []).map(normTrack));
}
async function getStreamUrl(t){
  if (t.local){
    if (t.localUrl) return t.localUrl;
    throw new Error('локальный файл недоступен — переимпортируйте в «Моя музыка»');
  }
  let trs = (t.media && t.media.transcodings) || [];
  if (!trs.length){
    const j = await apiGet(`/tracks/${t.id}`);
    trs = (j.media && j.media.transcodings) || [];
  }
  const pick = trs.find(x => x.format && x.format.protocol === 'progressive')
    || trs.find(x => x.format && x.format.protocol === 'hls' && /mpeg$/.test(x.format.mime_type || ''))
    || trs.find(x => x.format && x.format.protocol === 'hls')
    || trs[0];
  if (!pick) throw new Error('нет потока');
  const isHls = !!(pick.format && pick.format.protocol === 'hls');
  if (isHls && !canPlayHls()) throw new Error('HLS не поддерживается браузером');
  const tUrl = pick.url && /^https?:\/\//.test(pick.url) ? pick.url : (API + (pick.url || ''));
  const r = await rawFetch(tUrl + (tUrl.includes('?') ? '&' : '?') + 'client_id=' + encodeURIComponent(cid));
  if (!r.ok) throw new Error('поток ' + r.status);
  const j = await r.json();
  if (!j.url) throw new Error('нет ссылки');
  return j.url;
}

let _naRate = 1, _naVol = 1, _naSrc = '', _naCur = 0, _naDur = 0, _naPaused = true, _naLoading = false;
const audioEv = {};
function fireEv(n){ (audioEv[n] || []).forEach(f => { try { f(); } catch {} }); }
window.__swAudioTime = function(p, d){
  const wasNoDur = !_naDur;
  _naCur = p; if (d > 0) _naDur = d;
  fireEv('timeupdate');
  if (wasNoDur && _naDur > 0){ fireEv('loadedmetadata'); fireEv('canplay'); _naLoading = false; }
};
window.__swAudioEvent = function(e, d){
  if (d > 0) _naDur = d;
  if (e === 'play') _naPaused = false;
  if (e === 'pause') _naPaused = true;
  if (e === 'waiting') _naLoading = true;
  fireEv(e);
};
const audio = window.__swNative ? {
  get paused(){ return _naPaused; },
  get currentTime(){ return _naCur; },
  set currentTime(v){ _naCur = v; nativeCmd({cmd:'audio', op:'seek', v: v}); },
  get duration(){ return _naDur; },
  get playbackRate(){ return _naRate; },
  set playbackRate(r){ _naRate = r; nativeCmd({cmd:'audio', op:'rate', v: r}); },
  get volume(){ return _naVol; },
  set volume(v){ _naVol = v; nativeCmd({cmd:'audio', op:'vol', v: v}); },
  get src(){ return _naSrc; },
  set src(u){ _naSrc = u; _naCur = 0; _naDur = 0; _naPaused = true; _naLoading = true;
              fireEv('waiting'); nativeCmd({cmd:'audio', op:'load', u: u}); },
  set crossOrigin(v){},
  preload: 'auto', readyState: 4,
  play(){ nativeCmd({cmd:'audio', op:'play'}); return Promise.resolve(); },
  pause(){ nativeCmd({cmd:'audio', op:'pause'}); },
  load(){},
  addEventListener(n, f){ (audioEv[n] = audioEv[n] || []).push(f); },
  removeEventListener(n, f){ audioEv[n] = (audioEv[n] || []).filter(x => x !== f); }
} : new Audio();
if (!window.__swNative) audio.preload = 'auto';
try { audio.preservesPitch = true; } catch {}
function canPlayHls(){
  if (window.__swNative) return true;
  try { return !!(audio.canPlayType && audio.canPlayType('application/vnd.apple.mpegurl')); }
  catch { return false; }
}
const P = { q: [], i: -1, playing: false, loadId: 0, mediaUrl: '', viaProxy: false, mediaHls: false, restored: false, crossfading: false, crossfadeIn: false };
let nowSource = 'Обзор';

const current = () => P.q[P.i] || null;

async function playList(list, i, source){
  if (source) nowSource = source;
  P.q = list.slice(); P.i = i;
  await loadTrack(true);
}
let crossfadeRAF = 0;
function normVol(){ return state.normalize ? 0.85 : 1; }
function cancelCrossfade(){ if (crossfadeRAF){ cancelAnimationFrame(crossfadeRAF); crossfadeRAF = 0; } }
function startCrossfadeOut(){
  if (P.crossfading || !state.crossfade || sleepMode) return;
  P.crossfading = true;
  const startVol = audio.volume || 1;
  const dur = Math.max(0.4, Math.min(state.crossfade, audio.duration - audio.currentTime || state.crossfade));
  const startT = performance.now();
  cancelCrossfade();
  crossfadeRAF = requestAnimationFrame(function fade(){
    crossfadeRAF = 0;
    const elapsed = (performance.now() - startT) / 1000;
    const prog = Math.min(1, elapsed / dur);
    audio.volume = Math.max(0, startVol * (1 - prog));
    if (prog < 1 && P.crossfading) crossfadeRAF = requestAnimationFrame(fade);
  });
}
function startCrossfadeIn(){
  if (!state.crossfade){ P.crossfadeIn = false; audio.volume = normVol(); return; }
  const startVol = audio.volume || 0;
  const target = normVol();
  const dur = Math.min(state.crossfade, 2.5);
  const startT = performance.now();
  cancelCrossfade();
  crossfadeRAF = requestAnimationFrame(function fadeIn(){
    crossfadeRAF = 0;
    const elapsed = (performance.now() - startT) / 1000;
    const prog = Math.min(1, elapsed / dur);
    audio.volume = startVol + (target - startVol) * prog;
    if (prog < 1) crossfadeRAF = requestAnimationFrame(fadeIn);
    else { P.crossfadeIn = false; P.crossfading = false; audio.volume = target; }
  });
}
async function loadTrack(autoplay){
  const t = current(); if (!t) return;
  const wasCrossfade = P.crossfading;
  cancelCrossfade();
  P.crossfading = false;
  if (wasCrossfade) P.crossfadeIn = true; else { P.crossfadeIn = false; audio.volume = normVol(); }
  const my = ++P.loadId;
  setBusy(true); showMini(t); setNP(t); pushHistory(t);
  try {
    const url = await getStreamUrl(t);
    if (my !== P.loadId) return;
    P.mediaUrl = url; P.viaProxy = false; P.mediaHls = /\.m3u8($|\?)/i.test(url);
    audio.crossOrigin = (state.viz && !viz.broken) ? 'anonymous' : null;
    audio.src = url;
    if (P.resumePos > 0){ const rp = P.resumePos; P.resumePos = 0;
      audio.addEventListener('loadedmetadata', function once(){ audio.removeEventListener('loadedmetadata', once); try{ audio.currentTime = rp; }catch{} });
    }
    if (autoplay) audio.play().catch(e => { if (e && e.name !== 'AbortError') toast('Не удалось воспроизвести'); });
  } catch (e) {
    if (my !== P.loadId) return;
    setBusy(false);
    const msg = String((e && e.message) || e || '');
    if (/HLS/i.test(msg)) toast('Трек только в HLS — недоступно в этом браузере');
    else toast('Трек недоступен — пропускаю');
    if (autoplay && P.q.length > 1) next(true);
  }
}
P.resumePos = 0;
function toggle(){
  if (!current()) return;
  if (audio.paused) audio.play().catch(() => {}); else audio.pause();
}
function next(auto = false){
  const t = current();
  if (auto && state.repeat === 'one' && t){ audio.currentTime = 0; audio.play().catch(() => {}); return; }
  if (state.shuffle && P.q.length > 1){
    let n; do { n = Math.floor(Math.random() * P.q.length); } while (n === P.i);
    P.i = n; loadTrack(true); return;
  }
  if (P.i < P.q.length - 1){ P.i++; loadTrack(true); return; }
  if (auto && state.autoRelated && t){ extendRelated(); return; }
  if (!auto && P.q.length){ P.i = 0; loadTrack(true); }
}
function prev(){
  if (audio.currentTime > 3 && isFinite(audio.currentTime)){ audio.currentTime = 0; return; }
  if (P.i > 0){ P.i--; loadTrack(true); } else if (audio.readyState > 0){ audio.currentTime = 0; }
}
async function extendRelated(){
  const t = current(); if (!t) return;
  try {
    let rel = await getRelated(t.id);
    const seen = new Set(P.q.map(x => x.id));
    rel = rel.filter(x => !seen.has(x.id)).slice(0, 10);
    if (!rel.length){ toast('Очередь закончилась'); return; }
    P.q.push(...rel); P.i++;
    renderQueue(); loadTrack(true);
  } catch { toast('Очередь закончилась'); }
}

let seekDrag = false;
let statPend = 0, npSent = 0, sessSaved = 0;
audio.addEventListener('play',  () => {
  P.playing = true; syncPlayUI(); nativeNP();
  nativeCmd({cmd:'resumesession'});
  if (state.viz && !viz.ctx && !viz.broken) initViz();
  resumeViz();
  if (P.crossfadeIn){ startCrossfadeIn(); }
});
audio.addEventListener('pause', () => { P.playing = false; syncPlayUI(); nativeNP(); flushStats(); saveSession();
  if (P.crossfading && !P.crossfadeIn){ cancelCrossfade(); P.crossfading = false; audio.volume = normVol(); }
});
audio.addEventListener('ended', () => {
  if (sleepMode === 'end'){ resetSleep('Конец трека — спокойной ночи 🌙'); audio.pause(); return; }
  next(true);
});
audio.addEventListener('loadedmetadata', () => { $('#tdur').textContent = fmt(audio.duration || (current() && current().dur) || 0); nativeNP(); });
audio.addEventListener('waiting', () => setBusy(true));
audio.addEventListener('playing', () => setBusy(false));
audio.addEventListener('canplay',  () => setBusy(false));
let _ttRAF = 0, _ttP = 0, _ttCur = 0;
audio.addEventListener('timeupdate', () => {
  if (state.abLoop && state.abLoop.b != null && audio.currentTime >= state.abLoop.b){
    try { audio.currentTime = state.abLoop.a; } catch {} nativeNP();
  }
  const d = audio.duration || (current() && current().dur) || 1;
  _ttP = Math.min(1000, (audio.currentTime / d) * 1000 || 0);
  _ttCur = audio.currentTime;
  if (!seekDrag && !_ttRAF){
    _ttRAF = requestAnimationFrame(() => {
      _ttRAF = 0;
      seekEl.value = _ttP; seekFill(_ttP / 10);
      $('#tcur').textContent = fmt(_ttCur);
      $('#mini-bar').style.transform = 'scaleX(' + (_ttP / 1000).toFixed(4) + ')';
    });
  }
  updateLyrics();
  statPend += 0.25;
  if (state.crossfade > 0 && !P.crossfading && !sleepMode && !seekDrag && audio.duration > 0){
    const rem = audio.duration - audio.currentTime;
    if (rem > 0 && rem <= state.crossfade) startCrossfadeOut();
  }
  const now = Date.now();
  if (now - npSent > 5000){ npSent = now; nativeNP(); }
  if (now - sessSaved > 10000){ sessSaved = now; saveSession(); }
});
audio.addEventListener('error', () => {
  if (!audio.src || !current()) return;
  if (P.mediaHls && !canPlayHls()){
    toast('HLS не поддерживается — пропускаю');
    next(true);
    return;
  }
  if (audio.crossOrigin && state.viz && !viz.broken){
    viz.broken = true; audio.crossOrigin = null;
    const ct = audio.currentTime || 0;
    audio.src = P.mediaUrl;
    audio.addEventListener('loadedmetadata', function once(){ audio.removeEventListener('loadedmetadata', once);
      try{ audio.currentTime = ct; }catch{} audio.play().catch(()=>{}); });
    toast('Визуализатор отключён для этого потока');
    return;
  }
  if (!P.viaProxy && localProxy && P.mediaUrl && !window.__swNative && !P.mediaHls){
    P.viaProxy = true;
    audio.src = '/sc?url=' + encodeURIComponent(P.mediaUrl);
    audio.play().catch(() => {});
    return;
  }
  toast('Ошибка воспроизведения');
  next(true);
});

function nativeNP(){
  if (!window.__swNative || !window.webkit) return;
  const t = current(); if (!t) return;
  try {
    webkit.messageHandlers.sw.postMessage({cmd:'nowplaying', title:t.title, artist:t.artist, art:t.art || '',
      dur: audio.duration || t.dur || 0, pos: audio.currentTime || 0, rate: audio.playbackRate || 1, playing: !audio.paused});
  } catch {}
}
window.__swRemote = function(cmd, arg){
  if (cmd === 'play') audio.play().catch(()=>{});
  else if (cmd === 'pause') audio.pause();
  else if (cmd === 'next') next();
  else if (cmd === 'prev') prev();
  else if (cmd === 'seek' && isFinite(arg) && arg >= 0){ audio.currentTime = arg; nativeNP(); }
};
function haptic(kind){
  if (!window.__swNative || !window.webkit) return;
  try { webkit.messageHandlers.sw.postMessage({cmd:'haptic', kind: kind || 0}); } catch {}
}
function nativeCmd(obj){
  if (!window.__swNative || !window.webkit) return false;
  try { webkit.messageHandlers.sw.postMessage(obj); return true; } catch { return false; }
}
window.__swSavedPhoto = function(ok){ toast(ok ? 'Карточка сохранена в Фото' : 'Не удалось сохранить'); };

function saveSession(){
  const t = current(); if (!t || !P.q.length){ LS.set('session', null); return; }
  const { media, ...first } = t;
  LS.set('session', {
    q: P.q.map(x => { const { media, localUrl, _by, ...m } = x; return m; }),
    i: P.i, pos: audio.currentTime || 0, src: nowSource,
    shuffle: state.shuffle, repeat: state.repeat, speed: audio.playbackRate || 1
  });
}
function restoreSession(){
  const s = LS.get('session', null);
  if (!s || !s.q || !s.q.length) return false;
  P.q = s.q; P.i = Math.min(s.i || 0, s.q.length - 1); P.resumePos = s.pos || 0;
  if (s.src) nowSource = s.src;
  state.shuffle = !!s.shuffle; state.repeat = s.repeat || 'off';
  loadTrack(false);
  return true;
}

function flushStats(){
  if (statPend < 1) return;
  const t = current();
  const add = Math.round(statPend); statPend = 0;
  if (!t || add < 1) return;
  state.stats.sec = (state.stats.sec || 0) + add;
  state.stats.art = state.stats.art || {};
  state.stats.art[t.artist] = (state.stats.art[t.artist] || 0) + add;
  state.stats.day = state.stats.day || {};
  const today = new Date().toISOString().slice(0, 10);
  state.stats.day[today] = (state.stats.day[today] || 0) + add;
  const hr = new Date().getHours();
  if (hr >= 0 && hr < 5) state.stats.lateNight = true;
  state.stats.tracks = (state.stats.tracks || 0) + 1;
  state.stats.trk = state.stats.trk || {};
  let tk = state.stats.trk[t.id];
  if (!tk){ tk = state.stats.trk[t.id] = { t: t.title, a: t.artist, s: 0 }; }
  else { tk.t = t.title; tk.a = t.artist; }
  tk.s += add;
  LS.set('stats', state.stats);
}

const isLiked = id => state.likes.some(x => x.id === id);
const isFollowed = uid => state.followed.some(x => x.uid === uid);
function toggleFollow(artist){
  if (isFollowed(artist.uid)) state.followed = state.followed.filter(x => x.uid !== artist.uid);
  else state.followed.unshift({ uid: artist.uid, name: artist.name, art: artist.art });
  LS.set('followed', state.followed);
  toast(isFollowed(artist.uid) ? 'Отслеживание включено' : 'Вы отписались');
  haptic(1);
}
function findTrack(id){
  let t = P.q.find(x => x.id === id);
  if (t) return t;
  for (const l of [searchState.list, discoverState.list]){
    const f = l && l.find(x => x.id === id); if (f) return f;
  }
  return state.likes.find(x => x.id === id) || state.history.find(x => x.id === id);
}
function toggleLike(id){
  const t = findTrack(id);
  if (isLiked(id)){ state.likes = state.likes.filter(x => x.id !== id); }
  else if (t){ const { media, ...m } = t; state.likes.unshift(m); haptic(1); }
  else return;
  LS.set('likes', state.likes);
  syncHearts(id);
  if (curScreen === 'library' && libMode === 'likes') renderLib();
}
function pushHistory(t){
  if (t.local) return;
  state.history = state.history.filter(x => x.id !== t.id);
  const { media, ...mini } = t;
  state.history.unshift(mini);
  state.history = state.history.slice(0, 100);
  LS.set('history', state.history);
  if (curScreen === 'library' && libMode === 'history') renderLib();
  renderRecentCaro();
}

const skeleton = n => Array.from({ length: n }, () =>
  '<div class="skrow"><div class="sk" style="width:56px;height:56px;flex:none"></div><div style="flex:1"><div class="sk" style="height:14px;width:72%;margin-bottom:9px"></div><div class="sk" style="height:11px;width:42%"></div></div></div>').join('');
const emptyState = (title, text, retry, icon) =>
  `<div class="empty">${EMPTY_SVG[icon] || I.note}<b>${esc(title)}</b><p>${esc(text)}</p>${retry ? '<button class="chip on" data-retry>Повторить</button>' : ''}</div>`;

function trackRow(t, i, rank){
  const liked = isLiked(t.id);
  const pinned = state.pinned.includes(t.id);
  return `<div class="row-t${pinned ? ' pinned' : ''}" data-i="${i}" data-tid="${esc(t.id)}">
    <div class="thumb"><img loading="lazy" decoding="async" src="${esc(t.art) || PLACEHOLDER}" onerror="this.onerror=null;this.src=PLACEHOLDER"></div>
    <div class="t-info">
      <div class="t-title">${esc(t.title)}</div>
      <div class="t-artist"${t.uid ? ` data-uid="${esc(t.uid)}"` : ''}>${esc(t.artist)}${t.snip ? ' · фрагмент' : ''}</div>
    </div>
    <div class="t-side">
      ${pinned ? '<span class="pin-mark" title="Закреплён">📌</span>' : ''}
      ${rank ? `<span class="rank${rank <= 3 ? ' top' : ''}">${rank}</span>` : ''}
      <span class="t-dur">${fmt(t.dur)}</span>
      <button class="heart${liked ? ' on' : ''}" data-like="${esc(t.id)}" aria-label="Нравится">${liked ? I.heartF : I.heart}</button>
    </div>
  </div>`;
}
const CARO_ROWS = [['Свежая музыка', 'new music 2026'], ['Хип-хоп', 'hip hop'], ['Электроника', 'electronic'], ['Phonk', 'phonk']];
async function loadCaros(){
  const box = $('#caros');
  box.innerHTML = CARO_ROWS.map((r, i) => `<div class="caro" data-caro="${i}">
    <div class="caro-h"><div class="caro-t">${esc(r[0])}</div></div>
    <div class="caro-row">${'<div class="card-t"><div class="card-art sk"></div><div class="sk" style="height:12px;margin-top:8px"></div></div>'.repeat(4)}</div>
  </div>`).join('');
  for (let i = 0; i < CARO_ROWS.length; i++){
    try {
      const list = await searchTracks(CARO_ROWS[i][1], 0);
      const row = box.querySelector(`[data-caro="${i}"] .caro-row`);
      row._list = list;
      row.innerHTML = list.slice(0, 12).map((t, j) => `<div class="card-t" data-ci="${j}">
        <img class="card-art" loading="lazy" decoding="async" src="${esc(t.art) || PLACEHOLDER}" onerror="this.onerror=null;this.src=PLACEHOLDER">
        <div class="card-n">${esc(t.title)}</div>
        <div class="card-a">${esc(t.artist)}</div>
      </div>`).join('');
      updatePlayingRows();
    } catch {}
  }
}
$('#caros').addEventListener('click', e => {
  const c = e.target.closest('[data-ci]'); if (!c) return;
  const row = c.closest('.caro-row'); const list = row._list || [];
  const i = +c.dataset.ci;
  haptic(0);
  if (list[i]) playList(list, i, CARO_ROWS[+row.closest('[data-caro]').dataset.caro][0]);
});
function renderRecentCaro(){
  const box = $('#recent-caro'); if (!box) return;
  const list = (state.history || []).slice(0, 12);
  if (!list.length){ box.innerHTML = ''; return; }
  box.innerHTML = `<div class="caro"><div class="caro-h"><div class="caro-t">Недавно слушали</div></div>
    <div class="caro-row">${list.map((t, j) => `<div class="card-t" data-ri="${j}">
      <img class="card-art" loading="lazy" decoding="async" src="${esc(t.art) || PLACEHOLDER}" onerror="this.onerror=null;this.src=PLACEHOLDER">
      <div class="card-n">${esc(t.title)}</div><div class="card-a">${esc(t.artist)}</div></div>`).join('')}</div></div>`;
  box.querySelector('.caro-row')._list = list;
}
$('#recent-caro').addEventListener('click', e => {
  const c = e.target.closest('[data-ri]'); if (!c) return;
  const row = c.closest('.caro-row'); const list = (row && row._list) || [];
  const i = +c.dataset.ri;
  haptic(0);
  if (list[i]) playList(list, i, 'Недавно слушали');
});

function renderList(cont, list, opts = {}){
  const base = opts.append ? (cont._list || []).length : 0;
  const html = list.map((t, i) => trackRow(t, i + base, opts.rank ? base + i + 1 : 0)).join('');
  if (opts.append){ cont._list = (cont._list || []).concat(list); cont.insertAdjacentHTML('beforeend', html); }
  else { cont._list = list; cont.innerHTML = html; }
  updatePlayingRows();
}
function attachList(cont, source){
  cont.addEventListener('click', e => {
    if (cont._swLP){ cont._swLP = false; return; }
    if (e.target.closest('[data-retry]')){ cont._retry && cont._retry(); return; }
    const ua = e.target.closest('[data-uid]');
    if (ua){ openArtist(+ua.dataset.uid); return; }
    const h = e.target.closest('[data-like]');
    if (h){ toggleLike(+h.dataset.like); return; }
    const r = e.target.closest('.row-t'); if (!r) return;
    const list = cont._list || []; const i = +r.dataset.i;
    if (list[i]) playList(list, i, source);
  });
  let lpT = null, lpY = 0;
  cont.addEventListener('touchstart', e => {
    const r = e.target.closest('.row-t'); if (!r) return;
    lpY = e.touches[0].clientY;
    lpT = setTimeout(() => {
      lpT = null;
      const list = cont._list || []; const i = +r.dataset.i;
      if (list[i]){ cont._swLP = true; haptic(1); trackActionSheet(list[i], source, cont); }
    }, 500);
  }, { passive: true });
  cont.addEventListener('touchmove', e => {
    if (lpT && Math.abs(e.touches[0].clientY - lpY) > 10){ clearTimeout(lpT); lpT = null; }
  }, { passive: true });
  cont.addEventListener('touchend', () => { if (lpT){ clearTimeout(lpT); lpT = null; } }, { passive: true });
  cont.addEventListener('contextmenu', e => {
    const r = e.target.closest('.row-t'); if (!r) return;
    e.preventDefault();
    const list = cont._list || []; const i = +r.dataset.i;
    if (list[i]) trackActionSheet(list[i], source, cont);
  });
}
function playNext(track){
  if (!track) return;
  if (!P.q.length || P.i < 0){ P.q = [track]; P.i = 0; loadTrack(true); return; }
  if (P.q[P.i] && P.q[P.i].id === track.id){ toast('Уже играет'); return; }
  P.q.splice(P.i + 1, 0, track);
  renderQueue();
  toast('Воспроизвести следующим');
  haptic(1);
}
function trackActionSheet(track, source, cont){
  if (!track) return;
  const liked = isLiked(track.id);
  const isPinned = state.pinned.includes(track.id);
  openSheet(track.title || 'Трек',
    `<div class="row-t" style="pointer-events:none;background:var(--card2);margin-bottom:6px">
      <div class="thumb"><img src="${esc(track.art) || PLACEHOLDER}"></div>
      <div class="t-info"><div class="t-title">${esc(track.title)}</div><div class="t-artist">${esc(track.artist)}</div></div>
    </div>
    <button class="btn" id="ta-next" style="margin-top:10px;width:100%">⏭ Сделать следующим</button>
    <button class="btn" id="ta-addpl" style="margin-top:8px;width:100%">＋ Добавить в плейлист</button>
    <button class="btn" id="ta-like" style="margin-top:8px;width:100%">${liked ? '♥ Убрать из любимых' : '♥ В любимые'}</button>
    <button class="btn" id="ta-pin" style="margin-top:8px;width:100%">${isPinned ? '📌 Открепить' : '📌 Закрепить вверху'}</button>
    <button class="btn" id="ta-play" style="margin-top:8px;width:100%">▶ Воспроизвести сейчас</button>`);
  $('#qs-list').onclick = e => {
    if (e.target.closest('#ta-next')){ closeSheet(); playNext(track); }
    else if (e.target.closest('#ta-addpl')){ closeSheet(); addToPlaylistSheet(track); }
    else if (e.target.closest('#ta-like')){ closeSheet(); toggleLike(track.id); }
    else if (e.target.closest('#ta-pin')){ closeSheet(); togglePin(track.id); }
    else if (e.target.closest('#ta-play')){
      closeSheet();
      const list = (cont && cont._list) ? cont._list.filter(x => x && x.id) : [track];
      const idx = list.findIndex(x => x.id === track.id);
      playList(list, idx >= 0 ? idx : 0, source);
    }
  };
}
function updatePlayingRows(){
  const cur = current();
  $$('.row-t').forEach(r => { r.classList.remove('playing'); const eq = r.querySelector('.eq'); if (eq) eq.remove(); });
  if (!cur) return;
  $$(`.row-t[data-tid="${cur.id}"] .thumb`).forEach(th => {
    th.closest('.row-t').classList.add('playing');
    th.insertAdjacentHTML('beforeend', EQ);
  });
}
function syncHearts(id){
  $$(`[data-like="${id}"]`).forEach(b => { const on = isLiked(id); b.classList.toggle('on', on); b.innerHTML = on ? I.heartF : I.heart; });
  const t = current();
  const nb = $('#np-like');
  if (t && (!id || id === t.id)){ const on = isLiked(t.id); nb.classList.toggle('on', on); nb.innerHTML = on ? I.heartF : I.heart; }
}

const searchState = { q: '', mode: 'tracks', offset: 0, loading: false, done: true, list: null };
async function runSearch(q, reset){
  if (q.length < 2){ $('#search-home').style.display = ''; return; }
  if (reset){ searchState.offset = 0; searchState.done = false; $('#search-home').style.display = 'none'; }
  searchState.loading = true; searchState.q = q;
  const c = $('#search-results');
  if (reset) c.innerHTML = skeleton(6);
  try {
    if (searchState.mode === 'playlists'){
      const pl = await searchPlaylists(q, searchState.offset);
      if (searchState.q !== q) return;
      if (reset){ renderPlRows(c, pl); if (!pl.length) c.innerHTML = emptyState('Ничего не найдено', 'Попробуйте другой запрос', false, 'search'); }
      else if (pl.length){ renderPlRows(c, pl, true); }
      searchState.offset += pl.length;
      searchState.done = pl.length < 20;
    } else {
      const list = await searchTracks(q, searchState.offset);
      if (searchState.q !== q) return;
      if (reset){ searchState.list = list; renderList(c, list); if (!list.length) c.innerHTML = emptyState('Ничего не найдено', 'Попробуйте другой запрос или проверьте ключ в настройках', false, 'search'); else pushSearchHistory(q); }
      else if (list.length){ renderList(c, list, { append: true }); searchState.list = c._list; }
      searchState.offset += list.length;
      searchState.done = list.length < 30;
    }
  } catch (e) {
    if (reset){ c.innerHTML = emptyState('Не удалось загрузить', String(e.message || e), true, 'search'); c._retry = () => runSearch(q, true); }
  }
  searchState.loading = false;
}
function renderPlRows(c, pl, append){
  const html = pl.map(p => `<div class="row-t" data-pl="${esc(p.id)}">
    <div class="thumb" style="width:64px;height:64px"><img loading="lazy" decoding="async" src="${esc(p.art) || PLACEHOLDER}" onerror="this.onerror=null;this.src=PLACEHOLDER"></div>
    <div class="t-info"><div class="t-title">${esc(p.title)}</div><div class="t-artist">Плейлист${p.user ? ' · ' + esc(p.user) : ''}</div></div>
    <span class="t-dur">${p.count} тр.</span>
  </div>`).join('');
  if (append) c.insertAdjacentHTML('beforeend', html); else c.innerHTML = html;
}
$('#search-results').addEventListener('click', e => {
  const r = e.target.closest('[data-pl]'); if (!r) return;
  openSCPlaylist(+r.dataset.pl);
});
const doSearch = debounce(v => runSearch(v, true), 420);
$('#q').addEventListener('input', e => {
  const v = e.target.value.trim();
  $('#qclear').hidden = !v;
  doSearch(v);
});
$('#qclear').addEventListener('click', () => {
  $('#q').value = ''; $('#qclear').hidden = true;
  $('#search-results').innerHTML = ''; searchState.done = true;
  $('#search-home').style.display = '';
});
$('#search-seg').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  searchState.mode = b.dataset.v;
  $$('#search-seg button').forEach(x => x.classList.toggle('on', x === b));
  const v = $('#q').value.trim();
  if (v.length >= 2) runSearch(v, true);
});
const SUGG = ['lofi', 'phonk', 'хип-хоп', 'The Weeknd', 'джаз', 'drum and bass', 'эмбиент', 'рок', 'EDM', 'Аигел'];
$('#sugg').innerHTML = SUGG.map(s => `<button class="chip" data-sq="${esc(s)}">${esc(s)}</button>`).join('');
$('#sugg').addEventListener('click', e => {
  const b = e.target.closest('[data-sq]'); if (!b) return;
  $('#q').value = b.dataset.sq; $('#qclear').hidden = false;
  runSearch(b.dataset.sq, true);
});
function renderSearchHistory(){
  const h = LS.get('shistory', []);
  $('#hist-hint').hidden = !h.length;
  const hc = $('#hist-clear'); if (hc) hc.hidden = !h.length;
  $('#hist').innerHTML = h.map(s => `<button class="chip on" data-sq="${esc(s)}">${esc(s)}</button>`).join('');
}
function renderSavedSearches(){
  const saved = state.savedSearches || [];
  const wrap = $('#pinned-search-wrap');
  if (wrap) wrap.hidden = !saved.length;
  const c = $('#pinned-search'); if (!c) return;
  c.innerHTML = saved.map(s => `<div class="chip pin-chip" data-psq="${esc(s)}"><span>${esc(s)}</span><button class="pin-x" data-unpin="${esc(s)}" aria-label="Открепить">×</button></div>`).join('');
}
function pinSearch(q){
  if (!q) return;
  state.savedSearches = state.savedSearches.filter(s => s !== q);
  state.savedSearches.unshift(q);
  state.savedSearches = state.savedSearches.slice(0, 12);
  LS.set('savedSearches', state.savedSearches);
  renderSavedSearches();
  toast('Поиск закреплён');
  haptic(0);
}
function unpinSearch(q){
  state.savedSearches = state.savedSearches.filter(s => s !== q);
  LS.set('savedSearches', state.savedSearches);
  renderSavedSearches();
  toast('Откреплено');
  haptic(0);
}
function searchActionSheet(q){
  openSheet('Поиск: ' + q,
    `<button class="btn" id="sh-pin" style="margin-top:10px;width:100%">📌 Закрепить</button>
     <button class="btn" id="sh-run" style="margin-top:8px;width:100%">▶ Найти</button>`);
  $('#qs-list').onclick = ev => {
    if (ev.target.closest('#sh-pin')){ closeSheet(); pinSearch(q); }
    else if (ev.target.closest('#sh-run')){ closeSheet(); $('#q').value = q; $('#qclear').hidden = false; runSearch(q, true); }
  };
}
$('#hist').addEventListener('click', e => {
  if ($('#hist')._swLP){ $('#hist')._swLP = false; return; }
  const b = e.target.closest('[data-sq]'); if (!b) return;
  $('#q').value = b.dataset.sq; $('#qclear').hidden = false;
  runSearch(b.dataset.sq, true);
});
(() => {
  const el = $('#hist');
  let lpT = null, lpY = 0;
  el.addEventListener('touchstart', e => {
    const b = e.target.closest('[data-sq]'); if (!b) return;
    lpY = e.touches[0].clientY;
    lpT = setTimeout(() => {
      lpT = null; el._swLP = true; haptic(1);
      searchActionSheet(b.dataset.sq);
    }, 500);
  }, { passive: true });
  el.addEventListener('touchmove', e => {
    if (lpT && Math.abs(e.touches[0].clientY - lpY) > 10){ clearTimeout(lpT); lpT = null; }
  }, { passive: true });
  el.addEventListener('touchend', () => { if (lpT){ clearTimeout(lpT); lpT = null; } }, { passive: true });
  el.addEventListener('contextmenu', e => {
    const b = e.target.closest('[data-sq]'); if (!b) return;
    e.preventDefault(); searchActionSheet(b.dataset.sq);
  });
})();
$('#pinned-search').addEventListener('click', e => {
  const x = e.target.closest('[data-unpin]');
  if (x){ unpinSearch(x.dataset.unpin); return; }
  const b = e.target.closest('[data-psq]'); if (!b) return;
  $('#q').value = b.dataset.psq; $('#qclear').hidden = false;
  runSearch(b.dataset.psq, true);
});
$('#hist-clear').addEventListener('click', () => { LS.set('shistory', []); renderSearchHistory(); toast('История поиска очищена'); });
function pushSearchHistory(q){
  let h = LS.get('shistory', []).filter(x => x !== q);
  h.unshift(q);
  LS.set('shistory', h.slice(0, 12));
  renderSearchHistory();
}
renderSearchHistory();
renderSavedSearches();

const GENRES = [
  ['Всё', 'popular'], ['Хип-хоп', 'hip hop'], ['Поп', 'pop'], ['Электроника', 'electronic'],
  ['Хаус', 'house'], ['Техно', 'techno'], ['Дабстеп', 'dubstep'], ['Трэп', 'trap'],
  ['Phonk', 'phonk'], ['Drum & Bass', 'drum and bass'], ['R&B', 'r&b'], ['Рок', 'rock'],
  ['Инди', 'indie'], ['Джаз', 'джаз'], ['Блюз', 'blues'], ['Метал', 'metal'],
  ['Классика', 'classical'], ['Латина', 'latin'], ['Регги', 'reggae'], ['Эмбиент', 'ambient'],
  ['Транс', 'trance'], ['Кантри', 'country'], ['Lofi', 'lofi beats'], ['Саундтреки', 'soundtrack']
];
const discoverState = { genre: 'popular', offset: 0, loading: false, done: true, list: null, loaded: false };
$('#genres').innerHTML = GENRES.map(([label, q], i) =>
  `<button class="chip${i === 0 ? ' on' : ''}" data-g="${esc(q)}">${esc(label)}</button>`).join('');
$('#genres').addEventListener('click', e => {
  const b = e.target.closest('[data-g]'); if (!b) return;
  $$('#genres .chip').forEach(c => c.classList.toggle('on', c === b));
  discoverState.genre = b.dataset.g;
  loadDiscover(true);
});

const MOOD_STATIONS = [
  ['🎧', 'Focus', 'lofi study'],
  ['💪', 'Workout', 'workout energy'],
  ['😴', 'Sleep', 'sleep ambient'],
  ['🌊', 'Chill', 'chillhop'],
  ['🎉', 'Party', 'party dance']
];
$('#mood-stations').innerHTML = MOOD_STATIONS.map(([em, label, q]) =>
  `<button class="chip mood-chip" data-mq="${esc(q)}"><span class="mood-em">${em}</span>${esc(label)}</button>`).join('');
$('#mood-stations').addEventListener('click', e => {
  const b = e.target.closest('[data-mq]'); if (!b) return;
  const q = b.dataset.mq;
  showScreen('search');
  const input = $('#q');
  input.value = q;
  $('#qclear').hidden = false;
  searchState.mode = 'tracks';
  $$('#search-seg button').forEach(x => x.classList.toggle('on', x.dataset.v === 'tracks'));
  $('#search-home').style.display = 'none';
  haptic(0);
  runSearch(q, true);
});
const DECADES = [['80s','80s hits'],['90s','90s rock'],['2000s','2000s pop'],['2010s','2010s hip hop'],['2020s','2020s hits']];
$('#decades').innerHTML = DECADES.map(([label, q]) =>
  `<button class="chip" data-dq="${esc(q)}">${esc(label)}</button>`).join('');
$('#decades').addEventListener('click', e => {
  const b = e.target.closest('[data-dq]'); if (!b) return;
  const q = b.dataset.dq;
  $$('#decades .chip').forEach(c => c.classList.toggle('on', c === b));
  showScreen('search');
  const input = $('#q');
  input.value = q;
  $('#qclear').hidden = false;
  searchState.mode = 'tracks';
  $$('#search-seg button').forEach(x => x.classList.toggle('on', x.dataset.v === 'tracks'));
  $('#search-home').style.display = 'none';
  haptic(0);
  runSearch(q, true);
});
const SURPRISE_POOL = [
  'lofi hip hop','phonk','drum and bass','synthwave','vaporwave','future garage','chillwave','tropical house',
  'deep house','melodic techno','future bass','dubstep','trance','ambient','darksynth','nu disco',
  'indie rock','post rock','shoegaze','psychedelic rock','jazz fusion','neo soul','funk','blues rock',
  'The Weeknd','Daft Punk','Bonobo','Tycho','ODESZA','Glass Animals','Tame Impala','Massive Attack'
];
function surprise(){
  const q = SURPRISE_POOL[Math.floor(Math.random() * SURPRISE_POOL.length)];
  showScreen('search');
  const input = $('#q');
  input.value = q;
  $('#qclear').hidden = false;
  searchState.mode = 'tracks';
  $$('#search-seg button').forEach(x => x.classList.toggle('on', x.dataset.v === 'tracks'));
  $('#search-home').style.display = 'none';
  haptic(0);
  runSearch(q, true);
  toast('🎲 ' + q);
}
$('#surprise').addEventListener('click', surprise);
function buildDailyMixes(){
  const stats = state.stats || {};
  const topArtists = Object.entries(stats.art || {}).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([n]) => n);
  const dist = genreDistribution();
  const topGenres = dist.slice(0, 5);
  const mixes = [];
  const fallback = [['lofi', 'Lofi'], ['hip hop', 'Хип-хоп'], ['electronic', 'Электроника'], ['rock', 'Рок'], ['pop', 'Поп']];
  for (let i = 0; i < 5; i++){
    if (topArtists[i]){
      const g = topGenres[i % Math.max(topGenres.length, 1)];
      mixes.push({ name: 'Daily Mix ' + (i + 1), query: topArtists[i], sub: g ? g.n : 'На основе прослушиваний' });
    } else if (topGenres[i]){
      mixes.push({ name: 'Daily Mix ' + (i + 1), query: topGenres[i].n, sub: topGenres[i].n });
    } else if (fallback[i]){
      mixes.push({ name: 'Daily Mix ' + (i + 1), query: fallback[i][0], sub: fallback[i][1] });
    }
  }
  return mixes;
}
function renderDailyMixes(){
  const box = $('#daily-mixes'); if (!box) return;
  const mixes = buildDailyMixes();
  if (!mixes.length){ box.innerHTML = ''; return; }
  box.innerHTML = `<div class="caro"><div class="caro-h"><div class="caro-t">Твои миксы</div></div>
    <div class="caro-row">${mixes.map((m, i) => `<div class="dmix-card" data-dmi="${i}">
      <div class="dmix-art"><span class="dmix-n">${i + 1}</span></div>
      <div class="card-n">${esc(m.name)}</div><div class="card-a">${esc(m.sub)}</div></div>`).join('')}</div></div>`;
  box.querySelector('.caro-row')._mixes = mixes;
}
$('#daily-mixes').addEventListener('click', e => {
  const c = e.target.closest('[data-dmi]'); if (!c) return;
  const row = c.closest('.caro-row'); const mixes = (row && row._mixes) || [];
  const i = +c.dataset.dmi;
  if (!mixes[i]) return;
  const q = mixes[i].query;
  showScreen('search');
  $('#q').value = q; $('#qclear').hidden = false;
  searchState.mode = 'tracks';
  $$('#search-seg button').forEach(x => x.classList.toggle('on', x.dataset.v === 'tracks'));
  $('#search-home').style.display = 'none';
  haptic(0);
  runSearch(q, true);
});
function renderOnRepeat(){
  const box = $('#onrepeat'); if (!box) return;
  const trk = state.stats.trk || {};
  let list = Object.entries(trk).filter(([,x]) => x && x.s).sort(([,a],[,b]) => (b.s||0) - (a.s||0)).slice(0, 12).map(([id, tk]) => {
    const full = findTrack(+id);
    return full || { id: +id, title: tk.t || 'Без названия', artist: tk.a || '', art: '', dur: 0 };
  });
  if (list.length < 3) list = (state.history || []).slice(0, 12);
  if (!list.length){ box.innerHTML = ''; return; }
  box.innerHTML = `<div class="caro"><div class="caro-h"><div class="caro-t">On Repeat</div></div>
    <div class="caro-row">${list.map((t, j) => `<div class="card-t" data-ori="${j}">
      <img class="card-art" loading="lazy" decoding="async" src="${esc(t.art) || PLACEHOLDER}" onerror="this.onerror=null;this.src=PLACEHOLDER">
      <div class="card-n">${esc(t.title)}</div><div class="card-a">${esc(t.artist)}</div></div>`).join('')}</div></div>`;
  box.querySelector('.caro-row')._list = list;
}
$('#onrepeat').addEventListener('click', e => {
  const c = e.target.closest('[data-ori]'); if (!c) return;
  const row = c.closest('.caro-row'); const list = (row && row._list) || [];
  const i = +c.dataset.ori;
  haptic(0);
  if (list[i]) playList(list, i, 'On Repeat');
});
async function renderFollowedReleases(){
  const box = $('#followed-releases'); if (!box) return;
  const followed = state.followed || [];
  if (!followed.length){ box.innerHTML = ''; return; }
  const head = '<div class="caro-h"><div class="caro-t">Новые релизы</div><button class="caro-more" data-act>Все</button></div>';
  box.innerHTML = `<div class="caro">${head}
    <div class="caro-row">${'<div class="card-t"><div class="card-art sk"></div><div class="sk" style="height:12px;margin-top:8px"></div></div>'.repeat(4)}</div></div>`;
  let all = [];
  for (const fa of followed.slice(0, 6)){
    try {
      const list = await searchTracks(fa.name, 0);
      all = all.concat(list.slice(0, 4));
    } catch {}
  }
  all = all.slice(0, 16);
  if (!all.length){ box.innerHTML = `<div class="caro">${head}<p class="note" style="padding:0 18px 14px">Не удалось получить свежие релизы — <button class="chip on" data-act style="vertical-align:baseline">открыть ленту</button></p></div>`; return; }
  box.innerHTML = `<div class="caro">${head}
    <div class="caro-row">${all.map((t, j) => `<div class="card-t" data-fi="${j}">
      <img class="card-art" loading="lazy" decoding="async" src="${esc(t.art) || PLACEHOLDER}" onerror="this.onerror=null;this.src=PLACEHOLDER">
      <div class="card-n">${esc(t.title)}</div><div class="card-a">${esc(t.artist)}</div></div>`).join('')}</div></div>`;
  box.querySelector('.caro-row')._list = all;
}
$('#followed-releases').addEventListener('click', e => {
  if (e.target.closest('[data-act]')){ openActivity(); return; }
  const c = e.target.closest('[data-fi]'); if (!c) return;
  const row = c.closest('.caro-row'); const list = (row && row._list) || [];
  const i = +c.dataset.fi;
  haptic(0);
  if (list[i]) playList(list, i, 'Новые релизы');
});
async function openActivity(){
  const followed = state.followed || [];
  if (!followed.length){
    openPage('Активность', emptyState('Пока пусто', 'Отслеживайте артистов на их странице — здесь появится лента их свежих релизов', false, 'library'));
    return;
  }
  openPage('Активность', '<div class="sk-line"></div><div class="sk-line" style="width:60%"></div>' + skeleton(5));
  const body = $('#page-body');
  try {
    const seen = new Set();
    let all = [];
    for (const fa of followed.slice(0, 10)){
      try {
        const list = await searchTracks(fa.name, 0);
        list.slice(0, 3).forEach(t => { if (!seen.has(t.id)){ seen.add(t.id); t._by = fa.name; all.push(t); } });
      } catch {}
    }
    if (!all.length){ body.innerHTML = emptyState('Не удалось загрузить', 'Проверьте подключение или API-ключ', true, 'library'); body._retry = () => openActivity(); return; }
    all = all.sort((a, b) => (b.plays || 0) - (a.plays || 0));
    body._list = all;
    body.innerHTML = `<button class="playall" id="pa">▶ Слушать ленту (${all.length})</button>` +
      all.map((t, i) => trackRow(t, i, 0)).join('');
    const pa = $('#pa');
    if (pa) pa.addEventListener('click', () => playList(all.slice(), 0, 'Активность'));
    updatePlayingRows();
  } catch (e) {
    body.innerHTML = emptyState('Не удалось загрузить', String(e.message || e), true, 'library');
    body._retry = () => openActivity();
  }
}
window.__swOpenActivity = openActivity;
async function loadDiscover(reset){
  if (reset){ discoverState.offset = 0; discoverState.done = false; }
  discoverState.loading = true;
  const c = $('#chart-list');
  if (reset) c.innerHTML = skeleton(8);
  try {
    const list = await searchTracks(discoverState.genre, discoverState.offset);
    if (reset){
      discoverState.list = list;
      renderList(c, list, { rank: true });
      if (!list.length) c.innerHTML = emptyState('Пусто', 'Попробуйте другой жанр', false, 'search');
    } else if (list.length){
      renderList(c, list, { append: true, rank: true });
      discoverState.list = c._list;
    }
    discoverState.offset += list.length;
    discoverState.done = list.length < 30;
  } catch (e) {
    if (reset){
      c.innerHTML = emptyState('Не удалось загрузить', 'Проверьте подключение или API-ключ в настройках', true, 'search');
      c._retry = () => loadDiscover(true);
    }
  }
  discoverState.loading = false;
}

const ptr = $('#ptr'), dscroll = $('#discover-scroll');
let ptrY = null, ptrH = 0;
dscroll.addEventListener('touchstart', e => { ptrY = dscroll.scrollTop <= 0 ? e.touches[0].clientY : null; }, { passive: true });
dscroll.addEventListener('touchmove', e => {
  if (ptrY == null) return;
  const d = e.touches[0].clientY - ptrY;
  if (d > 8){ ptrH = Math.min(84, d * 0.45); ptr.style.height = ptrH + 'px'; }
}, { passive: true });
dscroll.addEventListener('touchend', () => {
  if (ptrH > 54 && !discoverState.loading) loadDiscover(true);
  ptrY = null; ptrH = 0; ptr.style.height = '0px';
});

let libMode = 'likes';
let libFilterQ = '';
let libSort = LS.get('libsort', 'recent');
$('#lib-seg').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  libMode = b.dataset.v;
  $$('#lib-seg button').forEach(x => x.classList.toggle('on', x === b));
  $('#lib-filter').hidden = libMode === 'playlists' || libMode === 'mymusic';
  $('#lib-sort').hidden = libMode === 'playlists' || libMode === 'mymusic';
  renderLib();
});
$('#lib-sort').addEventListener('click', e => {
  const b = e.target.closest('[data-sort]'); if (!b) return;
  libSort = b.dataset.sort; LS.set('libsort', libSort);
  $$('#lib-sort .chip').forEach(c => c.classList.toggle('on', c === b));
  renderLib();
});
$('#lib-q').addEventListener('input', debounce(e => { libFilterQ = e.target.value.trim().toLowerCase(); renderLib(); }, 200));
const libFiltered = list => !libFilterQ ? list : list.filter(t =>
  (t.title || '').toLowerCase().includes(libFilterQ) || (t.artist || '').toLowerCase().includes(libFilterQ));
$('#mix-btn').addEventListener('click', async () => {
  if (state.likes.length < 3){ toast('Добавьте минимум 3 любимых трека'); return; }
  toast('Собираю микс…');
  try {
    const seeds = state.likes.slice(0, 3);
    const seen = new Set();
    let mix = [];
    for (const s of seeds){
      const rel = await getRelated(s.id);
      rel.forEach(t => { if (!seen.has(t.id)){ seen.add(t.id); mix.push(t); } });
    }
    const tail = state.likes.slice(3).filter(t => !seen.has(t.id)).map(t => ({ ...t }));
    mix = mix.sort(() => Math.random() - 0.5);
    const head = state.likes[0];
    mix.unshift(head);
    tail.forEach(t => mix.push(t));
    if (mix.length < 3) { toast('Не удалось собрать микс'); return; }
    haptic(1);
    playList(mix, 0, 'Мой микс');
  } catch { toast('Не удалось собрать микс'); }
});
function sortLibList(list){
  const arr = list.slice();
  const pinSet = new Set(state.pinned);
  const pinRank = t => pinSet.has(t.id) ? 1 : 0;
  arr.sort((a, b) => {
    const pa = pinRank(a), pb = pinRank(b);
    if (pa !== pb) return pb - pa;
    if (libSort === 'name') return (a.title||'').localeCompare(b.title||'', 'ru');
    else if (libSort === 'artist') return ((a.artist||'') + (a.title||'')).localeCompare((b.artist||'') + (b.title||''), 'ru');
    else if (libSort === 'plays') return (b.plays||0) - (a.plays||0);
    return 0;
  });
  return arr;
}
function renderLib(){
  const c = $('#lib-list');
  const sp = $('#smart-pls');
  if (libMode === 'mymusic'){
    $('#lib-sort').hidden = true;
    if (sp) sp.hidden = true;
    const list = state.localTracks.map(localTrackObj);
    if (!list.length){
      c.innerHTML = emptyState('Пока пусто', 'Импортируйте свои аудиофайлы в «Ещё» → «Моя музыка» — они появятся здесь', false, 'library');
      c._list = [];
      return;
    }
    renderList(c, list);
    return;
  }
  if (libMode === 'playlists'){
    $('#lib-sort').hidden = true;
    if (sp) sp.hidden = true;
    const pls = state.playlists;
    let html = pls.map(p => `<div class="row-t" data-pll="${esc(p.id)}">
      <div class="thumb" style="border-radius:14px;background:var(--grad);display:grid;place-items:center;color:#fff">
        <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
      </div>
      <div class="t-info"><div class="t-title">${esc(p.name)}</div><div class="t-artist">${p.items.length} тр.</div></div>
    </div>`).join('');
    c.innerHTML = '<button class="chip on" id="newpl" style="margin:0 0 12px">＋ Новый плейлист</button>' + html +
      (pls.length ? '' : emptyState('Пока пусто', 'Создайте плейлист и добавляйте треки кнопкой «+ Список» в плеере', false, 'library'));
    c._list = [];
    return;
  }
  $('#lib-sort').hidden = false;
  if (sp) renderSmartPLs();
  const list = sortLibList(libFiltered((libMode === 'likes' ? state.likes : state.history).slice()));
  renderList(c, list);
  if (!list.length && libFilterQ) c.innerHTML = emptyState('Ничего', 'По запросу «' + libFilterQ + '» в списке нет совпадений', false, 'library');
  if (!list.length && !libFilterQ){
    c.innerHTML = emptyState(
      libMode === 'likes' ? 'Пока пусто' : 'История пуста',
      libMode === 'likes' ? 'Нажимайте на сердечко у треков — они появятся здесь' : 'Здесь появятся треки, которые вы слушали', false, 'library');
  }
}
function smartTopTracks(){
  const trk = state.stats.trk || {};
  return Object.entries(trk).filter(([,x]) => x && x.s).sort(([,a],[,b]) => (b.s||0) - (a.s||0)).slice(0, 30).map(([id, tk]) => {
    const full = findTrack(+id);
    return full || { id: +id, title: tk.t || 'Без названия', artist: tk.a || '', art: '', dur: 0 };
  });
}
function renderSmartPLs(){
  const box = $('#smart-pls'); if (!box) return;
  const top = smartTopTracks();
  const recent = (state.likes || []).slice(0, 30);
  const cards = [];
  if (top.length >= 3) cards.push({ id: 'smart-top', name: 'Топ за месяц', list: top, ic: '🏆' });
  if (recent.length >= 3) cards.push({ id: 'smart-recent', name: 'Недавно добавленные', list: recent, ic: '🕒' });
  if (!cards.length){ box.hidden = true; box.innerHTML = ''; box._cards = []; return; }
  box.hidden = false;
  box.innerHTML = cards.map(c => `<button class="smart-card" data-sp="${esc(c.id)}">
    <div class="smart-ic">${c.ic}</div>
    <div class="smart-n">${esc(c.name)}</div>
    <div class="smart-c">${c.list.length} треков</div>
  </button>`).join('');
  box._cards = cards;
}
$('#smart-pls').addEventListener('click', e => {
  const b = e.target.closest('[data-sp]'); if (!b) return;
  const box = $('#smart-pls');
  const card = box._cards && box._cards.find(c => c.id === b.dataset.sp);
  if (!card || !card.list.length) return;
  haptic(0);
  playList(card.list.slice(), 0, card.name);
});
function togglePin(id){
  const i = state.pinned.indexOf(id);
  if (i >= 0) state.pinned.splice(i, 1); else state.pinned.push(id);
  LS.set('pinned', state.pinned);
  if (curScreen === 'library' && libMode !== 'playlists') renderLib();
  toast(i >= 0 ? 'Откреплено' : 'Закреплено вверху списка');
  haptic(0);
}
$('#lib-list').addEventListener('click', e => {
  if (e.target.closest('#newpl')){ createPlaylist(); return; }
  const r = e.target.closest('[data-pll]'); if (!r) return;
  openLocalPlaylist(+r.dataset.pll);
});
function createPlaylist(){
  const name = prompt('Название плейлиста:');
  if (!name || !name.trim()) return;
  state.playlists.unshift({ id: Date.now(), name: name.trim().slice(0, 40), items: [] });
  LS.set('playlists', state.playlists);
  renderLib();
  toast('Плейлист создан');
}
function addToPlaylistSheet(track){
  openSheet('Добавить в плейлист', state.playlists.map(p =>
    `<div class="row-t" data-addpl="${esc(p.id)}"><div class="t-info"><div class="t-title">${esc(p.name)}</div><div class="t-artist">${p.items.length} тр.</div></div><span class="t-dur">＋</span></div>`).join('') +
    '<button class="btn" id="sheet-newpl" style="margin-top:10px;width:100%">Новый плейлист</button>');
  $('#qs-list').onclick = e => {
    if (e.target.closest('#sheet-newpl')){
      const name = prompt('Название плейлиста:');
      if (name && name.trim()){
        const pl = { id: Date.now(), name: name.trim().slice(0, 40), items: [] };
        state.playlists.unshift(pl); LS.set('playlists', state.playlists);
        const { media, ...m } = track; pl.items.push(m); LS.set('playlists', state.playlists);
        closeSheet(); toast('Добавлено в «' + pl.name + '»');
      }
      return;
    }
    const r = e.target.closest('[data-addpl]'); if (!r) return;
    const pl = state.playlists.find(p => p.id === +r.dataset.addpl); if (!pl) return;
    if (pl.items.some(x => x.id === track.id)){ closeSheet(); toast('Уже есть в «' + pl.name + '»'); return; }
    const { media, ...m } = track; pl.items.push(m);
    LS.set('playlists', state.playlists);
    closeSheet(); toast('Добавлено в «' + pl.name + '»');
  };
}

let curScreen = 'discover';
const TABS = ['search', 'discover', 'library', 'settings'];
function applyTabsVisibility(){
  const tabs = state.tabs || {};
  for (const s of TABS){
    const hidden = tabs[s] === false;
    const tab = $(`.tab[data-s="${s}"]`);
    const scr = $('#scr-' + s);
    if (tab) tab.style.display = hidden ? 'none' : '';
    if (scr) scr.style.display = hidden ? 'none' : '';
  }
  const vtabs = visibleTabs();
  if (vtabs.length && !vtabs.includes(curScreen)) showScreen(vtabs[0]);
}
function visibleTabs(){ return TABS.filter(s => state.tabs[s] !== false); }
function showScreen(s){
  curScreen = s;
  $$('.screen').forEach(el => el.classList.toggle('active', el.id === 'scr-' + s));
  $$('.tab').forEach(b => b.classList.toggle('on', b.dataset.s === s));
  if (s === 'discover' && !discoverState.loaded){ discoverState.loaded = true; loadDiscover(true); }
  if (s === 'discover') { renderDailyMixes(); renderOnRepeat(); renderFollowedReleases(); }
  if (s === 'library') renderLib();
}
$$('.tab').forEach(b => b.addEventListener('click', () => { haptic(0); showScreen(b.dataset.s); }));
(() => {
  let sx = 0, sy = 0;
  $('#screens').addEventListener('touchstart', e => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  $('#screens').addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) < 64 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
    if (e.target.closest('.caro-row, input, #seek')) return;
    const vtabs = visibleTabs();
    const i = vtabs.indexOf(curScreen);
    if (i < 0) return;
    const ni = Math.max(0, Math.min(vtabs.length - 1, i + (dx < 0 ? 1 : -1)));
    if (ni !== i){ haptic(0); showScreen(vtabs[ni]); }
  }, { passive: true });
})();

function showMini(t){
  const m = $('#mini'); m.hidden = false;
  $('#mini-art').src = t.art || PLACEHOLDER;
  $('#mini-t').textContent = t.title;
  $('#mini-a').textContent = t.artist;
}
$('#mini').addEventListener('click', e => {
  if (e.currentTarget._swipe) return;
  if (e.target.closest('#mini-play')){ toggle(); return; }
  if (e.target.closest('#mini-next')){ next(); return; }
  openNP();
});
(() => {
  const m = $('#mini');
  let sx = 0, sy = 0, moved = false;
  m.addEventListener('touchstart', e => {
    const p = e.touches[0]; sx = p.clientX; sy = p.clientY; moved = false;
  }, { passive: true });
  m.addEventListener('touchmove', e => {
    const p = e.touches[0];
    if (Math.abs(p.clientX - sx) > 10 || Math.abs(p.clientY - sy) > 10) moved = true;
  }, { passive: true });
  m.addEventListener('touchend', e => {
    const p = e.changedTouches[0];
    const dx = p.clientX - sx, dy = p.clientY - sy;
    if (moved && Math.abs(dx) > 44 && Math.abs(dx) > Math.abs(dy) * 1.2){
      m._swipe = true;
      haptic(0);
      if (dx < 0) next(); else prev();
      setTimeout(() => { m._swipe = false; }, 500);
    }
  }, { passive: true });
})();

function setWebSession(t){
  if (!('mediaSession' in navigator)) return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: t.title, artist: t.artist, album: 'SoundWave',
      artwork: [{ src: t.art || PLACEHOLDER, sizes: '500x500', type: 'image/jpeg' }]
    });
    navigator.mediaSession.setActionHandler('play', () => audio.play().catch(()=>{}));
    navigator.mediaSession.setActionHandler('pause', () => audio.pause());
    navigator.mediaSession.setActionHandler('nexttrack', () => next());
    navigator.mediaSession.setActionHandler('previoustrack', () => prev());
  } catch {}
}
function setNP(t){
  $('#np-art').src = t.art || PLACEHOLDER;
  $('#np-bg').src = t.art || PLACEHOLDER;
  $('#np-title').textContent = t.title;
  $('#np-artist').textContent = t.artist;
  if (t.uid) $('#np-artist').dataset.uid = t.uid; else delete $('#np-artist').dataset.uid;
  $('#np-from').textContent = nowSource;
  $('#tcur').textContent = '0:00';
  $('#tdur').textContent = fmt(t.dur);
  seekEl.value = 0; seekFill(0);
  syncHearts(t.id);
  renderQueue();
  resetLyrics();
  state.abLoop = null; syncAB();
  setWebSession(t);
  nativeNP();
}
const openNP  = () => { haptic(0); $('#np').classList.add('open'); if (state.viz && !viz.broken && !vizRAF) vizRAF = requestAnimationFrame(drawViz); };
const closeNP = () => $('#np').classList.remove('open');
$('#np-close').addEventListener('click', closeNP);
$('#np-play').addEventListener('click', toggle);
$('#np-next').addEventListener('click', () => next());
$('#np-prev').addEventListener('click', prev);
$('#np-like').addEventListener('click', () => { const t = current(); if (t) toggleLike(t.id); });
$('#np-artist').addEventListener('click', () => { const t = current(); if (t && t.uid) openArtist(t.uid); });
$('#np-addpl').addEventListener('click', () => { const t = current(); if (t) addToPlaylistSheet(t); });
$('#np-comments').addEventListener('click', async () => {
  const t = current(); if (!t) return;
  openSheet('Комментарии', '<div class="sk-line"></div><div class="sk-line" style="width:70%"></div>' + '<div class="sk-line"></div>'.repeat(2));
  try {
    const j = await apiGet('/tracks/' + t.id + '/comments', { limit: 50 });
    const items = (j.collection || []).filter(c => c.body).map(c => ({
      name: (c.user && c.user.username) || 'Аноним',
      avatar: ((c.user && c.user.avatar_url) || '').replace('-large.', '-t500x500.'),
      text: c.body || '',
      time: c.timestamp ? fmt(c.timestamp / 1000) : ''
    }));
    if (!items.length){
      $('#qs-list').innerHTML = '<p class="note" style="text-align:center;padding:30px">Нет комментариев</p>';
      return;
    }
    $('#qs-list').innerHTML = items.map(c => `<div class="cmt">
      <img class="cmt-ava" loading="lazy" src="${esc(c.avatar) || PLACEHOLDER}" onerror="this.onerror=null;this.src=PLACEHOLDER">
      <div class="cmt-body"><div class="cmt-h"><span class="cmt-n">${esc(c.name)}</span>${c.time ? `<span class="cmt-t">${esc(c.time)}</span>` : ''}</div>
      <div class="cmt-txt">${esc(c.text)}</div></div></div>`).join('');
  } catch {
    $('#qs-list').innerHTML = '<p class="note" style="text-align:center;padding:30px">Комментарии недоступны</p>';
  }
});
$('#np-radio').addEventListener('click', () => {
  state.autoRelated = !state.autoRelated;
  LS.set('autorel', state.autoRelated);
  $('#np-radio').classList.toggle('on', state.autoRelated);
  const opt = $('#opt-auto'); if (opt) opt.checked = state.autoRelated;
  toast(state.autoRelated ? 'Радио: похожие будут играть автоматически' : 'Радио выключено');
});
function toggleShuffle(){
  state.shuffle = !state.shuffle; LS.set('shuffle', state.shuffle);
  $('#np-shuffle').classList.toggle('on', state.shuffle);
  toast(state.shuffle ? 'Перемешивание включено' : 'Перемешивание выключено');
}
$('#np-shuffle').addEventListener('click', toggleShuffle);
(() => {
  if (typeof window === 'undefined' || typeof window.DeviceMotionEvent === 'undefined') return;
  let lastShake = 0;
  const TH = 16;
  window.addEventListener('devicemotion', e => {
    const a = e.accelerationIncludingGravity || e.acceleration;
    if (!a) return;
    const mag = Math.sqrt((a.x || 0) * (a.x || 0) + (a.y || 0) * (a.y || 0) + (a.z || 0) * (a.z || 0));
    if (mag < TH) return;
    const now = Date.now();
    if (now - lastShake < 1500) return;
    if (!current()) return;
    lastShake = now;
    haptic(0);
    toggleShuffle();
    if (state.shuffle) toast('Тряхнул — перемешивание');
  }, { passive: true });
})();
$('#np-repeat').addEventListener('click', () => {
  state.repeat = state.repeat === 'off' ? 'all' : state.repeat === 'all' ? 'one' : 'off';
  LS.set('repeat', state.repeat);
  syncRepeat();
  toast(state.repeat === 'off' ? 'Повтор выключен' : state.repeat === 'all' ? 'Повтор очереди' : 'Повтор трека');
});
function syncRepeat(){
  const b = $('#np-repeat');
  b.classList.toggle('on', state.repeat !== 'off');
  b.innerHTML = state.repeat === 'one' ? I.repeat1 : I.repeat;
}
$('#np-abloop').addEventListener('click', () => {
  const t = current(); if (!t) return;
  if (!state.abLoop){ state.abLoop = { a: audio.currentTime || 0, b: null }; toast('A: ' + fmt(state.abLoop.a)); }
  else if (state.abLoop.b == null){
    const b = audio.currentTime || 0;
    if (b <= state.abLoop.a){ toast('B должна быть после A'); return; }
    state.abLoop.b = b; toast('B: ' + fmt(b) + ' — цикл A-B');
  } else { state.abLoop = null; toast('A-B сброшен'); }
  syncAB(); haptic(0);
});
function syncAB(){
  const b = $('#np-abloop'); if (!b) return;
  if (!state.abLoop){ b.classList.remove('on'); b.textContent = 'A-B'; return; }
  b.classList.add('on');
  b.textContent = state.abLoop.b == null ? 'A ' + fmt(state.abLoop.a) : 'A-B';
}
function setBusy(b){ $('#np-play').classList.toggle('busy', b); }
function syncPlayUI(){
  document.body.classList.toggle('paused', !P.playing);
  $('#np-play').innerHTML = P.playing ? I.pause : I.play;
  $('#mini-play').innerHTML = P.playing ? I.pause : I.play;
}

const seekEl = $('#seek');
seekEl.addEventListener('input', () => {
  seekDrag = true;
  const d = audio.duration || (current() && current().dur) || 0;
  $('#tcur').textContent = fmt(seekEl.value / 1000 * d);
  seekFill(seekEl.value / 10);
});
seekEl.addEventListener('change', () => {
  const d = audio.duration;
  if (d > 0 && isFinite(d)) audio.currentTime = seekEl.value / 1000 * d;
  seekDrag = false; nativeNP();
});
function seekFill(p){ seekEl.style.setProperty('--val', p + '%'); }

(() => {
  const np = $('#np'), art = $('#np-drag'), hint = $('#seek-hint');
  let x0 = 0, y0 = 0, dy = 0, dx = 0, axis = null, lastTap = 0, t0 = 0;
  const dur = () => audio.duration || (current() && current().dur) || 0;
  const start = e => {
    const p = e.touches ? e.touches[0] : e;
    x0 = p.clientX; y0 = p.clientY; dx = 0; dy = 0; axis = null; t0 = Date.now();
    np.style.transition = 'none';
  };
  const move = e => {
    if (y0 === null) return;
    const p = e.touches ? e.touches[0] : e;
    dx = p.clientX - x0; dy = p.clientY - y0;
    if (!axis && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) axis = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
    if (axis === 'v'){
      const d = Math.max(0, dy);
      np.style.transform = `translateY(${d}px)`;
    } else if (axis === 'h' && Math.abs(dx) > 8){
      const span = art.clientWidth || 300;
      const delta = dx / span * dur() * 1.6;
      const target = Math.max(0, Math.min(dur(), (audio.currentTime || 0) + delta));
      hint.style.display = 'block';
      hint.textContent = fmt(target) + ' / ' + fmt(dur());
      hint._target = target;
    }
  };
  const end = () => {
    if (y0 === null && x0 === 0) return;
    np.style.transition = ''; np.style.transform = '';
    if (axis === 'v' && dy > 110) closeNP();
    else if (axis === 'h' && hint._target != null && Math.abs(dx) > 24 && dur() > 0){
      audio.currentTime = hint._target; nativeNP();
    }
    hint.style.display = 'none'; hint._target = null;
    if (!axis && Date.now() - t0 < 280){
      const now = Date.now();
      if (now - lastTap < 350){ lastTap = 0; const t = current(); if (t) toggleLike(t.id); }
      else lastTap = now;
    }
    axis = null; dy = 0; dx = 0;
  };
  art.addEventListener('touchstart', start, { passive: true });
  art.addEventListener('touchmove', move, { passive: true });
  art.addEventListener('touchend', end);
})();

function renderQueue(){
  const c = $('#qs-list');
  if (!P.q.length){ c.innerHTML = emptyState('Очередь пуста', 'Выберите трек в поиске или обзоре', false, 'queue'); return; }
  c.innerHTML = P.q.map((t, i) => `<div class="row-t${i === P.i ? ' playing' : ''}" data-q="${i}" data-tid="${esc(t.id)}">
      ${i === P.i ? '<span class="qnum">' + EQ + '</span>' : `<span class="qnum">${i + 1}</span>`}
      <div class="thumb"><img loading="lazy" decoding="async" src="${esc(t.art) || PLACEHOLDER}" onerror="this.onerror=null;this.src=PLACEHOLDER"></div>
      <div class="t-info"><div class="t-title">${esc(t.title)}</div><div class="t-artist">${esc(t.artist)}</div></div>
      <span class="t-dur">${fmt(t.dur)}</span>
    </div>`).join('');
}
$('#qs-list').addEventListener('click', e => {
  const r = e.target.closest('[data-q]'); if (!r || $('#qs-title').textContent !== 'Очередь') return;
  P.i = +r.dataset.q; renderQueue(); loadTrack(true);
});
(() => {
  let dragRow = null, holdT = null, startY = 0;
  const list = $('#qs-list');
  list.addEventListener('touchstart', e => {
    const row = e.target.closest('.row-t[data-q]');
    if (!row || $('#qs-title').textContent !== 'Очередь') return;
    startY = e.touches[0].clientY;
    holdT = setTimeout(() => {
      holdT = null;
      dragRow = row;
      row.classList.add('qrow-drag');
      haptic(1);
    }, 420);
  }, { passive: true });
  list.addEventListener('touchmove', e => {
    if (holdT && Math.abs(e.touches[0].clientY - startY) > 12){ clearTimeout(holdT); holdT = null; }
    if (!dragRow) return;
    e.preventDefault();
    const y = e.touches[0].clientY;
    dragRow.style.transform = `translateY(${y - startY}px)`;
    const over = document.elementFromPoint(e.touches[0].clientX, y);
    const target = over && over.closest('.row-t[data-q]');
    if (target && target !== dragRow){
      const rows = [...list.children];
      const from = rows.indexOf(dragRow), to = rows.indexOf(target);
      startY = y; dragRow.style.transform = '';
      if (from < to) target.after(dragRow); else target.before(dragRow);
      dragRow.style.transform = `translateY(0px)`;
    }
  }, { passive: false });
  list.addEventListener('touchend', () => {
    if (holdT){ clearTimeout(holdT); holdT = null; }
    if (!dragRow) return;
    const from = +dragRow.dataset.q;
    const rows = [...list.children];
    const to = rows.indexOf(dragRow);
    dragRow.classList.remove('qrow-drag');
    dragRow.style.transform = '';
    dragRow = null;
    if (to < 0 || from === to) return;
    const item = P.q.splice(from, 1)[0];
    P.q.splice(to, 0, item);
    if (P.i === from) P.i = to;
    else if (from < P.i && to >= P.i) P.i--;
    else if (from > P.i && to <= P.i) P.i++;
    renderQueue();
    haptic(0);
  });
})();

(() => {
  const btn = $('#np-play');
  let holdT = null, boosted = false, origRate = 1;
  const boost = on => {
    if (on === boosted) return;
    boosted = on;
    if (on){ origRate = audio.playbackRate || 1; audio.playbackRate = 2; toast('⏩ 2× — отпустите для обычной скорости'); haptic(0); }
    else { audio.playbackRate = origRate; }
  };
  btn.addEventListener('touchstart', () => { holdT = setTimeout(() => boost(true), 550); }, { passive: true });
  const off = () => { clearTimeout(holdT); boost(false); };
  btn.addEventListener('touchend', off);
  btn.addEventListener('touchcancel', off);
})();

async function shareCard(){
  const t = current(); if (!t) return;
  const W = 1080, H = 1350;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const x = cv.getContext('2d');
  const acc = ACCENTS[state.accent] || ACCENTS.orange;
  x.fillStyle = state.amoled ? '#000' : '#08080d';
  x.fillRect(0, 0, W, H);
  const img = new Image();
  img.crossOrigin = 'anonymous';
  try { img.src = t.art || PLACEHOLDER; await new Promise(r => { img.onload = r; img.onerror = r; setTimeout(r, 2500); }); } catch {}
  try {
    x.filter = 'blur(60px) saturate(1.6) brightness(0.5)';
    const s = Math.max(W / img.width, H / img.height) * 1.4;
    x.drawImage(img, (W - img.width * s) / 2, (H - img.height * s) / 2, img.width * s, img.height * s);
    x.filter = 'none';
  } catch {}
  x.fillStyle = 'rgba(8,8,13,0.55)';
  x.fillRect(0, 0, W, H);
  const g = x.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, acc[0]); g.addColorStop(1, acc[1]);
  x.fillStyle = g;
  x.font = '900 92px -apple-system, sans-serif';
  x.fillText('SoundWave', 70, 160);
  try {
    x.save();
    x.shadowColor = 'rgba(0,0,0,.6)'; x.shadowBlur = 60;
    const A = 640, dx = (W - A) / 2, dy = 300;
    x.beginPath();
    const r = 56;
    x.moveTo(dx + r, dy); x.arcTo(dx + A, dy, dx + A, dy + A, r); x.arcTo(dx + A, dy + A, dx, dy + A, r);
    x.arcTo(dx, dy + A, dx, dy, r); x.arcTo(dx, dy, dx + A, dy, r); x.closePath();
    x.clip();
    x.fillStyle = '#1d1d2b'; x.fillRect(dx, dy, A, A);
    x.drawImage(img, dx, dy, A, A);
    x.restore();
  } catch {}
  x.fillStyle = '#f5f5f7';
  x.font = '800 54px -apple-system, sans-serif';
  const lines = String(t.title).match(/.{1,26}(\s|$)/g) || [String(t.title)];
  lines.slice(0, 2).forEach((l, i) => x.fillText(l.trim(), 70, 1120 + i * 66));
  x.fillStyle = '#8e8ea3';
  x.font = '600 40px -apple-system, sans-serif';
  x.fillText(String(t.artist).slice(0, 34), 70, 1120 + Math.min(2, lines.length) * 66 + 26);
  const data = cv.toDataURL('image/png');
  const isNative = !!window.__swNative;
  openSheet('Карточка трека',
    `<img class="share-img" src="${data}">
     <div class="btnrow">
       ${isNative ? '<button class="btn" id="sh-save">Сохранить в Фото</button>' : ''}
       <button class="btn" id="sh-copy">Скопировать название</button>
     </div>
     ${navigator.share && t.link ? '<button class="btn" id="sh-link" style="margin-top:8px;width:100%">Поделиться ссылкой</button>' : ''}
     <p class="note">${isNative ? '' : 'В браузере: удерживайте картинку, чтобы сохранить. '}${t.link || ''}</p>`);
  const sl = $('#sh-link');
  if (sl) sl.onclick = () => navigator.share({ title: t.title + ' — ' + t.artist, url: t.link }).catch(()=>{});
  const sv = $('#sh-save');
  if (sv) sv.onclick = () => nativeCmd({cmd:'saveimage', b64: data.split(',')[1]}) || toast('Недоступно');
  $('#sh-copy').onclick = () => { navigator.clipboard && navigator.clipboard.writeText(t.title + ' — ' + t.artist); closeSheet(); toast('Скопировано'); };
}
$('#np-share').addEventListener('click', shareCard);
$('#np-queue').addEventListener('click', () => { openSheet('Очередь'); renderQueue(); });
$('#qs-bd').addEventListener('click', closeSheet);
function openSheet(title, html){
  $('#qs-title').textContent = title;
  $('#qs-list').innerHTML = html || '';
  $('#qs').classList.add('open');
}
function closeSheet(){ $('#qs').classList.remove('open'); $('#qs-list').onclick = null; }

const SPEEDS = [1, 1.25, 1.5, 2, 0.75];
let speedIdx = 0;
$('#np-speed').addEventListener('click', () => {
  speedIdx = (speedIdx + 1) % SPEEDS.length;
  const v = SPEEDS[speedIdx];
  audio.playbackRate = v;
  const b = $('#np-speed');
  b.textContent = (v === 1 ? '1×' : v + '×');
  b.classList.toggle('on', v !== 1);
  toast('Скорость: ' + v + '×');
});

const VIZ_MODES = ['Бары', 'Волна', 'Круги'];
$('#np-vizm').addEventListener('click', () => {
  state.vizMode = (state.vizMode + 1) % 3;
  LS.set('vizMode', state.vizMode);
  const b = $('#np-vizm');
  b.textContent = VIZ_MODES[state.vizMode];
  b.classList.toggle('on', state.vizMode !== 0);
  toast('Спектр: ' + VIZ_MODES[state.vizMode]);
});
$('#np-eq').addEventListener('click', () => { openEQPanel(); });

let sleepMode = 0, sleepTimerT = null, sleepFadeI = null;
function resetSleep(msg){
  clearTimeout(sleepTimerT); clearInterval(sleepFadeI);
  sleepTimerT = null; sleepFadeI = null; sleepMode = 0;
  audio.volume = normVol();
  const b = $('#np-timer');
  b.textContent = 'Таймер'; b.classList.remove('on');
  if (msg) toast(msg);
}
$('#np-timer').addEventListener('click', () => {
  const steps = [0, 15, 30, 60, 'end'];
  const cur = steps.indexOf(sleepMode);
  const nx = steps[(cur + 1) % steps.length];
  clearTimeout(sleepTimerT); clearInterval(sleepFadeI); sleepTimerT = null; sleepFadeI = null;
  sleepMode = 0; audio.volume = normVol();
  const b = $('#np-timer');
  if (nx === 0){ resetSleep('Таймер выключен'); return; }
  if (nx === 'end'){ sleepMode = 'end'; b.textContent = 'Конец трека'; b.classList.add('on'); toast('Пауза в конце трека'); return; }
  sleepMode = nx;
  sleepTimerT = setTimeout(() => {
    let v = 1;
    sleepFadeI = setInterval(() => {
      v -= 1 / 30;
      if (v <= 0){ audio.volume = 0; audio.pause(); resetSleep('Таймер: остановлено 🌙'); return; }
      audio.volume = v;
    }, 1000);
  }, Math.max(0, nx * 60000 - 30000));
  b.textContent = nx + ' мин'; b.classList.add('on');
  toast('Таймер сна: ' + nx + ' мин');
});

const viz = { ctx: null, an: null, data: null, broken: false, zeroSince: 0 };
const EQ_PRESETS = {
  flat:   { low: 0, mid: 0, treble: 0 },
  bass:   { low: 8, mid: -2, treble: -3 },
  vocal:  { low: -3, mid: 5, treble: 2 },
  treble: { low: -2, mid: 0, treble: 8 }
};
const EQ_ORDER = ['flat', 'bass', 'vocal', 'treble'];
function applyEQ(name){
  const p = EQ_PRESETS[name] || EQ_PRESETS.flat;
  if (viz.eqLow) viz.eqLow.gain.value = p.low;
  if (viz.eqMid) viz.eqMid.gain.value = p.mid;
  if (viz.eqTreble) viz.eqTreble.gain.value = p.treble;
}
const knobToGain = v => Math.round(((v - 50) / 50) * 12 * 10) / 10;
const gainToKnob = g => Math.max(0, Math.min(100, Math.round(50 + g / 12 * 50)));
function applyKnobs(){
  if (viz.eqLow) viz.eqLow.gain.value = knobToGain(state.bassKnob);
  if (viz.eqTreble) viz.eqTreble.gain.value = knobToGain(state.trebleKnob);
}
function syncKnobsToPreset(name){
  const p = EQ_PRESETS[name] || EQ_PRESETS.flat;
  state.bassKnob = gainToKnob(p.low);
  state.trebleKnob = gainToKnob(p.treble);
  LS.set('bassKnob', state.bassKnob);
  LS.set('trebleKnob', state.trebleKnob);
}
function openEQPanel(){
  const active = !!(viz.ctx && !viz.broken && viz.eqLow);
  const eqLabels = {flat:'Flat',bass:'Bass',vocal:'Vocal',treble:'Treble'};
  openSheet('Эквалайзер',
    `<div class="eq-presets">${EQ_ORDER.map(k => `<button class="chip${state.eq === k ? ' on' : ''}" data-eqp="${k}">${eqLabels[k]}</button>`).join('')}</div>
    <div class="eq-knobs">
      <label class="eq-knob">Bass<input type="range" id="eq-bass" min="0" max="100" value="${state.bassKnob}" ${active ? '' : 'disabled'}></label>
      <label class="eq-knob">Treble<input type="range" id="eq-treble" min="0" max="100" value="${state.trebleKnob}" ${active ? '' : 'disabled'}></label>
    </div>
    <p class="note">${active ? 'Слайдеры меняют тембр в реальном времени. Пресеты — быстрые настройки.' : 'Включите визуализатор звука в настройках, чтобы использовать EQ-слайдеры.'}</p>`);
  const list = $('#qs-list');
  list.onclick = e => {
    const b = e.target.closest('[data-eqp]'); if (!b) return;
    state.eq = b.dataset.eqp; LS.set('eq', state.eq);
    $$('#qs-list .eq-presets .chip').forEach(c => c.classList.toggle('on', c === b));
    syncKnobsToPreset(state.eq);
    const bs = $('#eq-bass'), tr = $('#eq-treble');
    if (bs){ bs.value = state.bassKnob; bs.style.setProperty('--val', state.bassKnob + '%'); }
    if (tr){ tr.value = state.trebleKnob; tr.style.setProperty('--val', state.trebleKnob + '%'); }
    if (active) applyEQ(state.eq);
    const nb = $('#np-eq');
    nb.textContent = state.eq === 'flat' ? 'EQ' : state.eq[0].toUpperCase() + state.eq.slice(1);
    nb.classList.toggle('on', state.eq !== 'flat');
    haptic(0);
  };
  const bass = $('#eq-bass');
  if (bass){ bass.style.setProperty('--val', state.bassKnob + '%');
    bass.addEventListener('input', () => {
      state.bassKnob = +bass.value; LS.set('bassKnob', state.bassKnob);
      bass.style.setProperty('--val', state.bassKnob + '%');
      if (viz.eqLow) viz.eqLow.gain.value = knobToGain(state.bassKnob);
    });
  }
  const treble = $('#eq-treble');
  if (treble){ treble.style.setProperty('--val', state.trebleKnob + '%');
    treble.addEventListener('input', () => {
      state.trebleKnob = +treble.value; LS.set('trebleKnob', state.trebleKnob);
      treble.style.setProperty('--val', state.trebleKnob + '%');
      if (viz.eqTreble) viz.eqTreble.gain.value = knobToGain(state.trebleKnob);
    });
  }
}
function initViz(){
  if (!state.viz || viz.ctx || viz.broken) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { viz.broken = true; return; }
    viz.ctx = new AC();
    const src = viz.ctx.createMediaElementSource(audio);
    viz.an = viz.ctx.createAnalyser();
    viz.an.fftSize = 256;
    viz.an.smoothingTimeConstant = 0.82;
    viz.data = new Uint8Array(viz.an.frequencyBinCount);
    viz.eqLow = viz.ctx.createBiquadFilter(); viz.eqLow.type = 'lowshelf'; viz.eqLow.frequency.value = 220;
    viz.eqMid = viz.ctx.createBiquadFilter(); viz.eqMid.type = 'peaking'; viz.eqMid.frequency.value = 1000; viz.eqMid.Q.value = 1.0;
    viz.eqTreble = viz.ctx.createBiquadFilter(); viz.eqTreble.type = 'highshelf'; viz.eqTreble.frequency.value = 4500;
    src.connect(viz.eqLow); viz.eqLow.connect(viz.eqMid); viz.eqMid.connect(viz.eqTreble); viz.eqTreble.connect(viz.an);
    viz.an.connect(viz.ctx.destination);
    applyEQ(state.eq);
    applyKnobs();
    viz.ctx.resume().catch(()=>{});
  } catch { viz.broken = true; }
}
function resumeViz(){ if (viz.ctx && viz.ctx.state === 'suspended') viz.ctx.resume().catch(()=>{}); }
function disableVizAndReload(){
  state.viz = false; viz.broken = true;
  LS.set('viz', false);
  toast('Реальный спектр недоступен для этого потока — перезапускаю');
  setTimeout(() => location.reload(), 1400);
}
const vizCv = $('#viz'), vizCtx = vizCv.getContext('2d');
let vizPhase = 0;
let vizRAF = 0;
function drawViz(ts){
  if (!$('#np').classList.contains('open') || document.hidden){ vizRAF = 0; return; }
  vizRAF = requestAnimationFrame(drawViz);
  const w = vizCv.width, h = vizCv.height;
  vizCtx.clearRect(0, 0, w, h);
  const acc = ACCENTS[state.accent] || ACCENTS.orange;
  const N = 44;
  vizPhase += 0.045;
  let levels = null;
  const playing = !document.body.classList.contains('paused');
  if (viz.an && !viz.broken && state.viz){
    viz.an.getByteFrequencyData(viz.data);
    levels = [];
    let sum = 0;
    const usable = Math.floor(viz.data.length * 0.72);
    for (let i = 0; i < N; i++){
      const idx = Math.floor(Math.pow(i / N, 1.5) * usable);
      const v = (viz.data[idx] || 0) / 255;
      sum += v;
      levels.push(v);
    }
    if (playing && sum < 0.01){
      if (!viz.zeroSince) viz.zeroSince = ts;
      else if (ts - viz.zeroSince > 7000) { disableVizAndReload(); return; }
    } else viz.zeroSince = 0;
  }
  if (!vizCv._grad || vizCv._gradAcc !== acc[0]) {
    const g = vizCtx.createLinearGradient(0, h, 0, 0);
    g.addColorStop(0, acc[1]); g.addColorStop(1, acc[0] + '66');
    vizCv._grad = g; vizCv._gradAcc = acc[0];
  }
  const lvl = i => {
    if (levels) return levels[i];
    let lv = playing ? 0.22 + 0.2 * Math.abs(Math.sin(vizPhase + i * 0.55)) : 0.06;
    if (!playing) lv *= 0.4;
    return lv;
  };
  const vmode = state.vizMode || 0;
  if (vmode === 1){
    vizCtx.strokeStyle = vizCv._grad;
    vizCtx.lineWidth = Math.max(2, w / 240);
    vizCtx.lineJoin = 'round'; vizCtx.lineCap = 'round';
    vizCtx.beginPath();
    for (let i = 0; i < N; i++){
      const x = (i / (N - 1)) * w;
      const y = h - Math.max(3, lvl(i) * h);
      if (i) vizCtx.lineTo(x, y); else vizCtx.moveTo(x, y);
    }
    vizCtx.stroke();
    return;
  }
  if (vmode === 2){
    const cx = w / 2, cy = h / 2;
    const inner = Math.max(6, Math.min(w, h) * 0.16);
    const maxLen = Math.max(4, h * 0.42);
    vizCtx.strokeStyle = vizCv._grad;
    vizCtx.lineWidth = Math.max(2, (Math.PI * 2 * inner) / N * 0.55);
    vizCtx.lineCap = 'round';
    for (let i = 0; i < N; i++){
      const a = (i / N) * Math.PI * 2 - Math.PI / 2;
      const len = Math.max(2, lvl(i) * maxLen);
      vizCtx.beginPath();
      vizCtx.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
      vizCtx.lineTo(cx + Math.cos(a) * (inner + len), cy + Math.sin(a) * (inner + len));
      vizCtx.stroke();
    }
    return;
  }
  for (let i = 0; i < N; i++){
    let lv;
    if (levels){ lv = levels[i]; }
    else { lv = playing ? 0.22 + 0.2 * Math.abs(Math.sin(vizPhase + i * 0.55)) : 0.06; }
    if (!playing) lv *= 0.4;
    const bh = Math.max(3, lv * h);
    const x = (i + 0.25) * (w / N);
    const bw = (w / N) * 0.5;
    vizCtx.fillStyle = vizCv._grad;
    const r = Math.min(bw / 2, 3);
    vizCtx.beginPath();
    vizCtx.roundRect ? vizCtx.roundRect(x, h - bh, bw, bh, r) : vizCtx.rect(x, h - bh, bw, bh);
    vizCtx.fill();
  }
}
if (state.viz) vizRAF = requestAnimationFrame(drawViz);

function openPage(title, html){
  $('#page-title').textContent = title;
  $('#page-body').innerHTML = html;
  $('#page').classList.add('open');
}
function closePage(){ $('#page').classList.remove('open'); }
$('#page-back').addEventListener('click', closePage);

async function openArtist(uid){
  if (!uid) return;
  openPage('Артист', skeleton(7));
  try {
    const a = await getArtist(uid);
    const followed = isFollowed(uid);
    const head = `<div class="art-head">
        <img class="art-ava" decoding="async" src="${esc(a.art) || PLACEHOLDER}" onerror="this.onerror=null;this.src=PLACEHOLDER">
        <div style="min-width:0">
          <div class="art-name">${esc(a.name)}</div>
          <div class="art-sub">${a.followers ? a.followers.toLocaleString('ru') + ' подписчиков' : ''}</div>
        </div>
      </div><button class="followbtn${followed ? ' on' : ''}" id="art-follow">${followed ? '✓ Отслеживается' : '＋ Отслеживать'}</button>${a.desc ? `<p class="note" style="margin:-6px 0 14px">${esc(a.desc)}</p>` : ''}`;
    const body = $('#page-body');
    body._list = a.tracks;
    body.innerHTML = head +
      (a.tracks.length ? `<button class="playall" id="pa">▶ Слушать всё (${a.tracks.length})</button>` : '') +
      a.tracks.map((t, i) => trackRow(t, i, 0)).join('') || '';
    const pa = $('#pa');
    if (pa) pa.addEventListener('click', () => playList(a.tracks, 0, a.name));
    const fb = $('#art-follow');
    if (fb) fb.addEventListener('click', () => {
      toggleFollow({ uid, name: a.name, art: a.art });
      const on = isFollowed(uid);
      fb.classList.toggle('on', on);
      fb.textContent = on ? '✓ Отслеживается' : '＋ Отслеживать';
      renderFollowedReleases();
    });
    updatePlayingRows();
  } catch (e) {
    $('#page-body').innerHTML = emptyState('Не удалось загрузить', String(e.message || e));
  }
}
async function openSCPlaylist(pid){
  openPage('Плейлист', '<div class="sk-line"></div><div class="sk-line" style="width:70%"></div>' + skeleton(6));
  try {
    const list = await getPlaylistTracks(pid);
    const body = $('#page-body');
    body._list = list;
    const first = list[0];
    body.innerHTML = `<div class="pl-head">
        <img class="pl-cover" decoding="async" src="${esc(first ? first.art : '') || PLACEHOLDER}" onerror="this.onerror=null;this.src=PLACEHOLDER">
        <div class="pl-name">Плейлист SoundCloud</div>
        <div class="pl-sub">${list.length} треков</div>
      </div>` +
      (list.length ? `<button class="playall" id="pa">▶ Слушать (${list.length})</button>` : emptyState('Пусто', 'В плейлисте нет доступных треков', false, 'library')) +
      list.map((t, i) => trackRow(t, i, 0)).join('');
    const pa = $('#pa');
    if (pa) pa.addEventListener('click', () => playList(list, 0, 'Плейлист'));
    updatePlayingRows();
  } catch (e) {
    $('#page-body').innerHTML = emptyState('Не удалось загрузить', String(e.message || e));
  }
}
function openLocalPlaylist(pid){
  const pl = state.playlists.find(p => p.id === pid); if (!pl) return;
  const body = $('#page-body');
  body._list = pl.items;
  openPage(pl.name,
    `<div class="btnrow" style="margin-bottom:12px">
       <button class="playall" id="pa" style="flex:1">▶ Слушать (${pl.items.length})</button>
       <button class="btn" id="pl-share" style="flex:none">Поделиться</button>
     </div>` +
    (pl.items.length ? pl.items.map((t, i) => trackRow(t, i, 0)).join('') : emptyState('Пусто', 'Добавьте треки кнопкой «+ Список» в плеере', false, 'library')) +
    `<button class="btn danger" id="pl-del">Удалить плейлист</button>`);
  const pa = $('#pa');
  if (pa) pa.addEventListener('click', () => playList(pl.items.slice(), 0, pl.name));
  $('#pl-share').addEventListener('click', () => sharePlaylist(pl));
  $('#pl-del').addEventListener('click', () => {
    state.playlists = state.playlists.filter(p => p.id !== pid);
    LS.set('playlists', state.playlists);
    closePage(); renderLib(); toast('Плейлист удалён');
  });
  updatePlayingRows();
}
function b64encUtf8(str){
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
function b64decUtf8(b64){
  let bin;
  try { bin = atob(b64); } catch { return null; }
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
function sharePlaylist(pl){
  const payload = {
    name: pl.name,
    tracks: (pl.items || []).map(t => ({ id: t.id, title: t.title, artist: t.artist, art: t.art, dur: t.dur }))
  };
  let b64;
  try { b64 = b64encUtf8(JSON.stringify(payload)); }
  catch { toast('Не удалось создать ссылку'); return; }
  const url = location.origin + location.pathname + '?pl=' + encodeURIComponent(b64);
  if (navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(url).then(
      () => toast('Ссылка скопирована'),
      () => openShareSheet(url)
    );
  } else {
    openShareSheet(url);
  }
}
function openShareSheet(url){
  openSheet('Поделиться плейлистом',
    `<div class="field"><textarea id="pl-share-ta" readonly>${esc(url)}</textarea></div>
     <div class="btnrow"><button class="btn" id="pl-share-copy">Скопировать</button></div>
     ${navigator.share ? '<button class="btn" id="pl-share-native" style="margin-top:8px;width:100%">Поделиться</button>' : ''}`);
  const ta = $('#pl-share-ta'); if (ta) ta.addEventListener('focus', e => e.target.select());
  const c = $('#pl-share-copy');
  if (c) c.onclick = () => { navigator.clipboard && navigator.clipboard.writeText(url); closeSheet(); toast('Скопировано'); };
  const n = $('#pl-share-native');
  if (n) n.onclick = () => navigator.share({ title: 'Плейлист SoundWave', url }).catch(() => {});
}
async function checkSharedPlaylist(){
  const m = location.search.match(/[?&]pl=([^&]+)/);
  if (!m) return;
  let raw;
  try { raw = decodeURIComponent(m[1]); } catch { raw = m[1]; }
  const json = b64decUtf8(raw);
  if (!json) return;
  let payload;
  try { payload = JSON.parse(json); } catch { return; }
  if (!payload || !payload.name || !Array.isArray(payload.tracks)) return;
  const name = String(payload.name).slice(0, 40);
  const count = payload.tracks.length;
  openSheet('Импорт плейлиста',
    `<div class="row-t" style="pointer-events:none;background:var(--card2);margin-bottom:6px">
       <div class="t-info"><div class="t-title">${esc(name)}</div><div class="t-artist">${count} треков</div></div>
     </div>
     <p class="note">Ссылка содержит плейлист SoundWave. Импортируйте его в свою библиотеку — треки подгрузятся с SoundCloud при воспроизведении.</p>
     <div class="btnrow"><button class="btn" id="pl-import">Импортировать</button></div>`);
  $('#pl-import').onclick = () => {
    const items = payload.tracks.map(t => ({
      id: t.id, title: t.title || 'Без названия', artist: t.artist || '',
      art: t.art || '', dur: t.dur || 0, ok: true, snip: false, plays: 0
    }));
    state.playlists.unshift({ id: Date.now(), name: name, items: items });
    LS.set('playlists', state.playlists);
    closeSheet(); toast('Плейлист импортирован');
    try { history.replaceState(null, '', location.pathname); } catch {}
    if (curScreen === 'library'){ libMode = 'playlists'; $$('#lib-seg button').forEach(x => x.classList.toggle('on', x.dataset.v === 'playlists')); $('#lib-filter').hidden = true; $('#lib-sort').hidden = true; renderLib(); }
  };
}
$('#page-body').addEventListener('click', e => {
  if (e.target.closest('[data-uid]')){ openArtist(+e.target.closest('[data-uid]').dataset.uid); return; }
  if (e.target.closest('#pa') || e.target.closest('#pl-del') || e.target.closest('#pl-share') || e.target.closest('#st-share')) return;
  const h = e.target.closest('[data-like]');
  if (h){ toggleLike(+h.dataset.like); return; }
  const r = e.target.closest('.row-t'); if (!r) return;
  const list = $('#page-body')._list || [];
  const i = +r.dataset.i;
  if (list[i]) playList(list, i, $('#page-title').textContent);
});

function statsBadges(s){
  const arts = Object.keys(s.art || {});
  const daySet = new Set(Object.keys(s.day || {}));
  let streak = 0, best = 0;
  const now = Date.now();
  for (let i = 0; i < 14; i++){
    const key = new Date(now - i * 86400000).toISOString().slice(0, 10);
    if (daySet.has(key)){ streak++; if (streak > best) best = streak; }
    else { if (streak > best) best = streak; streak = 0; }
  }
  const marathon = Object.values(s.day || {}).some(v => v >= 7200);
  return [
    {n: '100 треков', ok: (s.tracks || 0) >= 100, ic: '💯'},
    {n: '50 артистов', ok: arts.length >= 50, ic: '🎤'},
    {n: '7 дней подряд', ok: best >= 7, ic: '🔥'},
    {n: 'Полночь', ok: !!s.lateNight, ic: '🌙'},
    {n: 'Марафон ≥2ч/день', ok: marathon, ic: '🏃'}
  ];
}
function genreDistribution(){
  const KW = [
    ['Чилл', /lofi|chill|chillhop|эмбиент|ambient|sleep|study|relax|calm/i],
    ['Хип-хоп', /hip.?hop|rap|phonk|трэп|trap|r&b|rnb|фанк/i],
    ['Электроника', /electronic|edm|house|techno|trance|dubstep|dnb|drum.?bass/i],
    ['Рок', /rock|рок|metal|метал|indie|инди|punk|панк/i],
    ['Поп', /popular|поп|хит|k?pop/i],
    ['Джаз/Блюз', /jazz|джаз|blues|блюз|soul|соул|swing/i]
  ];
  const src = (state.history || []).concat(state.likes || []);
  const counts = {};
  let total = 0;
  for (const t of src){
    const txt = ((t.title || '') + ' ' + (t.artist || '')).toLowerCase();
    let matched = false;
    for (const [name, re] of KW){ if (re.test(txt)){ counts[name] = (counts[name] || 0) + 1; total++; matched = true; break; } }
    if (!matched){ counts['Другое'] = (counts['Другое'] || 0) + 1; total++; }
  }
  if (!total) return [];
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([n, c]) => ({ n, c, pct: Math.round(c / total * 100) }));
}
function genreDonutHTML(){
  const dist = genreDistribution();
  if (!dist.length) return '<p class="note" style="margin-top:8px">Послушайте больше — здесь появится распределение</p>';
  const PAL = ['#ff5500', '#ff9d3d', '#30d158', '#0a84ff', '#bf5af2', '#8e8ea3'];
  let acc = 0; const stops = [];
  for (let i = 0; i < dist.length; i++){ const col = PAL[i % PAL.length]; const st = acc; acc += dist[i].pct; stops.push(col + ' ' + st + '% ' + acc + '%'); }
  if (acc < 100) stops.push('#2b2b40 ' + acc + '% 100%');
  return '<div class="donut"><div class="donut-ring" style="background:conic-gradient(' + stops.join(',') + ')"><div class="donut-hole"><b>' + dist.length + '</b><span>жанров</span></div></div><div class="donut-legend">' + dist.map((d, i) => '<div class="lg-row"><span class="lg-dot" style="background:' + PAL[i % PAL.length] + '"></span><span class="lg-n">' + esc(d.n) + '</span><span class="lg-v">' + d.pct + '%</span></div>').join('') + '</div></div>';
}
function moodAnalysis(){
  const dist = genreDistribution();
  const stats = state.stats || {};
  const topArtists = Object.keys(stats.art || {}).slice(0, 10);
  if (!dist.length && !topArtists.length) return null;
  let energetic = 0, calm = 0;
  for (const d of dist){
    const n = d.n.toLowerCase();
    if (/электрон|хип-хоп|hip/.test(n)) energetic += d.c;
    if (/чилл|джаз|блюз/.test(n)) calm += d.c;
  }
  const at = topArtists.join(' ').toLowerCase();
  if (/phonk|trap|трэп|rap|рейп|edm|dubstep|dnb|drum/.test(at)) energetic += 3;
  if (/lofi|ambient|эмбиент|sleep|chill|jazz|джаз/.test(at)) calm += 3;
  const eclectic = dist.length;
  let mood, emoji, desc;
  if (energetic > calm * 1.2 && energetic > 0){
    mood = 'Энергичное'; emoji = '⚡';
    desc = 'Вы любите ритмичную и драйвовую музыку — хип-хоп, электроника, рок.';
  } else if (calm > energetic * 1.2 && calm > 0){
    mood = 'Спокойное'; emoji = '🌙';
    desc = 'Чилл, лофи и эмбиент — ваша музыка для отдыха и концентрации.';
  } else if (eclectic >= 4){
    mood = 'Разнообразное'; emoji = '🎨';
    desc = 'Ваш вкус охватывает много жанров — от спокойного до энергичного.';
  } else {
    mood = 'Сбалансированное'; emoji = '🎵';
    desc = 'Равновесие между энергией и спокойствием в вашем плейлисте.';
  }
  return { mood, emoji, desc };
}
function yearWrappedHTML(s){
  const trks = s.trk ? Object.values(s.trk).filter(x => x && x.s).sort((a, b) => b.s - a.s) : [];
  const arts = Object.entries(s.art || {}).sort((a, b) => b[1] - a[1]);
  const dist = genreDistribution();
  const topTrack = trks[0];
  const topArtist = arts[0];
  const topGenre = dist[0];
  const totalMin = Math.round((s.sec || 0) / 60);
  const year = new Date().getFullYear();
  return `<div class="year-wrap">
    <div class="yw-bg"></div>
    <div class="yw-content">
      <div class="yw-label">Твой ${year}</div>
      <div class="yw-stats">
        <div class="yw-stat"><span class="yw-val">${Math.floor(totalMin / 60)}ч ${totalMin % 60}м</span><span class="yw-key">слушали</span></div>
        <div class="yw-stat"><span class="yw-val">${esc(topArtist ? topArtist[0] : '—')}</span><span class="yw-key">топ-артист</span></div>
        <div class="yw-stat"><span class="yw-val">${esc(topGenre ? topGenre.n : '—')}</span><span class="yw-key">топ-жанр</span></div>
      </div>
      ${topTrack ? `<div class="yw-track"><div class="yw-track-lbl">Топ-трек года</div><div class="yw-track-n">${esc(topTrack.t)}</div><div class="yw-track-a">${esc(topTrack.a)}</div></div>` : ''}
    </div>
  </div>`;
}
function openStats(){
  const s = state.stats || {sec:0, art:{}, day:{}, trk:{}};
  const mood = moodAnalysis();
  const totalSec = s.sec || 0;
  const hh = Math.floor(totalSec / 3600);
  const mm = Math.floor((totalSec % 3600) / 60);
  const now = Date.now();
  const DLAB = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
  const days = [];
  let weekSec = 0;
  for (let i = 6; i >= 0; i--){
    const d = new Date(now - i * 86400000);
    const key = d.toISOString().slice(0, 10);
    const sec = (s.day && s.day[key]) || 0;
    weekSec += sec;
    days.push({ label: DLAB[d.getDay()], sec, today: i === 0 });
  }
  const maxDay = Math.max(1, ...days.map(d => d.sec));
  const arts = Object.entries(s.art || {}).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxArt = arts.length ? arts[0][1] : 1;
  let trks = [];
  if (s.trk) trks = Object.values(s.trk).filter(x => x && x.s).sort((a, b) => b.s - a.s).slice(0, 5);
  if (!trks.length && state.history.length){
    trks = state.history.slice(0, 5).map(t => ({ t: t.title, a: t.artist, s: 0 }));
  }
  openPage('Статистика', `
    <div class="stat-grid">
      <div class="stat-card"><div class="stat-num">${hh}ч ${mm}м</div><div class="stat-lbl">всего прослушано</div></div>
      <div class="stat-card"><div class="stat-num">${Math.round(weekSec / 60)}м</div><div class="stat-lbl">за 7 дней</div></div>
      <div class="stat-card"><div class="stat-num">${s.tracks || 0}</div><div class="stat-lbl">воспроизведений</div></div>
      <div class="stat-card"><div class="stat-num">${state.likes.length}</div><div class="stat-lbl">в любимых</div></div>
    </div>
    ${yearWrappedHTML(s)}
    <div class="card mood-card">
      ${mood ? `<div class="mood-ic">${mood.emoji}</div><div class="mood-info"><div class="mood-t">Твоё настроение</div><div class="mood-n">${esc(mood.mood)}</div><div class="mood-d">${esc(mood.desc)}</div></div>` : '<p class="note" style="margin:0">Послушайте больше — настроение появится здесь</p>'}
    </div>
    <div class="card" style="margin-top:0">
      <div class="row" style="justify-content:flex-start"><b>Активность за неделю</b></div>
      <div class="stat-heat">${days.map(d => `<div class="heat-cell${d.today ? ' today' : ''}">
        <div class="heat-bar" style="height:${Math.max(6, d.sec / maxDay * 100)}%"></div>
        <div class="heat-lbl">${d.label}</div>
      </div>`).join('')}</div>
    </div>
    <div class="card">
      <div class="row" style="justify-content:flex-start"><b>Топ артистов</b></div>
      ${arts.length ? arts.map(([n, sec]) => `<div class="stat-row">
        <div class="stat-name">${esc(n)}<span>${(sec / 60).toFixed(0)}м</span></div>
        <div class="stat-bar"><div class="stat-fill" style="width:${Math.max(4, sec / maxArt * 100)}%"></div></div>
      </div>`).join('') : '<p class="note" style="margin-top:8px">Послушайте пару треков — здесь появится статистика</p>'}
    </div>
    <div class="card">
      <div class="row" style="justify-content:flex-start"><b>Топ треков</b></div>
      ${trks.length ? trks.map((t, i) => `<div class="stat-row">
        <div class="stat-name"><span class="stat-rank">${i + 1}</span>${esc(t.t)}<span>${t.s ? (t.s / 60).toFixed(0) + 'м' : '—'}</span></div>
        <div class="stat-sub">${esc(t.a)}</div>
      </div>`).join('') : '<p class="note" style="margin-top:8px">Нет данных — послушайте любимое</p>'}
    </div>
    <div class="card">
      <div class="row" style="justify-content:flex-start"><b>Достижения</b></div>
      <div class="badge-grid">${statsBadges(s).map(b => `<div class="achv${b.ok ? '' : ' locked'}"><div class="achv-ic">${b.ic}</div><div class="achv-n">${esc(b.n)}</div><div class="achv-st">${b.ok ? 'Открыто' : 'Закрыто'}</div></div>`).join('')}</div>
    </div>
    <div class="card">
      <div class="row" style="justify-content:flex-start"><b>Жанры</b></div>
      ${genreDonutHTML()}
    </div>
    <button class="btn" id="st-share" style="margin-top:4px;width:100%">📤 Поделиться статистикой</button>`);
  const stShare = $('#st-share');
  if (stShare) stShare.addEventListener('click', () => shareStatsCard());
}
$('#open-stats').addEventListener('click', openStats);

async function shareStatsCard(){
  const s = state.stats || {sec:0, art:{}, day:{}, trk:{}};
  const acc = ACCENTS[state.accent] || ACCENTS.orange;
  const W = 1080, H = 1350;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const x = cv.getContext('2d');
  try {
    x.fillStyle = state.amoled ? '#000' : '#08080d';
    x.fillRect(0, 0, W, H);
    const g = x.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, acc[0]); g.addColorStop(1, acc[1]);
    x.fillStyle = g;
    x.font = '900 92px -apple-system, sans-serif';
    x.fillText('SoundWave', 70, 170);
    x.fillStyle = '#8e8ea3';
    x.font = '600 36px -apple-system, sans-serif';
    x.fillText('Моя статистика', 70, 220);
    const totalMin = Math.round((s.sec || 0) / 60);
    const hh = Math.floor(totalMin / 60), mm = totalMin % 60;
    const arts = Object.entries(s.art || {}).sort((a, b) => b[1] - a[1]);
    const topArtist = arts[0] ? arts[0][0] : '—';
    const trks = s.trk ? Object.values(s.trk).filter(v => v && v.s).sort((a, b) => b.s - a.s) : [];
    const topTrack = trks[0];
    const tiles = [
      { v: hh + 'ч ' + mm + 'м', l: 'слушали' },
      { v: String(s.tracks || 0), l: 'воспроизведений' },
      { v: String(state.likes.length), l: 'в любимых' },
      { v: String(arts.length), l: 'артистов' }
    ];
    const tw = (W - 70 * 3) / 2, th = 200, ty = 280;
    tiles.forEach((t, i) => {
      const col = i % 2, row = Math.floor(i / 2);
      const tx = 70 + col * (tw + 70);
      const yy = ty + row * (th + 28);
      x.fillStyle = '#1d1d2b';
      roundRect(x, tx, yy, tw, th, 36); x.fill();
      x.fillStyle = g;
      x.font = '900 60px -apple-system, sans-serif';
      x.fillText(t.v, tx + 36, yy + 80);
      x.fillStyle = '#8e8ea3';
      x.font = '600 30px -apple-system, sans-serif';
      x.fillText(t.l, tx + 36, yy + 130);
    });
    let yy = ty + 2 * (th + 28) + 30;
    x.fillStyle = '#f5f5f7';
    x.font = '700 38px -apple-system, sans-serif';
    x.fillText('Топ-артист', 70, yy);
    x.fillStyle = g;
    x.font = '800 56px -apple-system, sans-serif';
    x.fillText(String(topArtist).slice(0, 22), 70, yy + 64);
    yy += 64 + 60;
    x.fillStyle = '#f5f5f7';
    x.font = '700 38px -apple-system, sans-serif';
    x.fillText('Топ-трек', 70, yy);
    if (topTrack){
      x.fillStyle = g;
      x.font = '800 50px -apple-system, sans-serif';
      const tl = String(topTrack.t).match(/.{1,24}(\s|$)/g) || [String(topTrack.t)];
      tl.slice(0, 2).forEach((l, i) => x.fillText(l.trim(), 70, yy + 58 + i * 62));
      x.fillStyle = '#8e8ea3';
      x.font = '600 36px -apple-system, sans-serif';
      x.fillText(String(topTrack.a).slice(0, 26), 70, yy + 58 + Math.min(2, tl.length) * 62 + 10);
    } else {
      x.fillStyle = '#8e8ea3';
      x.font = '600 36px -apple-system, sans-serif';
      x.fillText('Послушайте любимое — топ-трек появится здесь', 70, yy + 58);
    }
    yy = H - 130;
    x.fillStyle = '#f5f5f7';
    x.font = '700 38px -apple-system, sans-serif';
    x.fillText('Достижения', 70, yy);
    const badges = statsBadges(s);
    x.font = '900 64px -apple-system, sans-serif';
    let bx = 70;
    badges.forEach(b => {
      x.globalAlpha = b.ok ? 1 : 0.35;
      x.fillText(b.ic, bx, yy + 80);
      bx += 110;
      x.globalAlpha = 1;
    });
  } catch {}
  function roundRect(cx, px, py, w, h, r){
    cx.beginPath();
    cx.moveTo(px + r, py); cx.arcTo(px + w, py, px + w, py + h, r); cx.arcTo(px + w, py + h, px, py + h, r);
    cx.arcTo(px, py + h, px, py, r); cx.arcTo(px, py, px + w, py, r); cx.closePath();
  }
  cv.toBlob ? cv.toBlob(doShare, 'image/png') : doShareBlobFallback(cv);
  function doShare(blob){
    if (navigator.canShare && navigator.canShare({ files: [new File([blob], 'soundwave-stats.png', { type: 'image/png' })] })){
      const file = new File([blob], 'soundwave-stats.png', { type: 'image/png' });
      navigator.share({ title: 'Моя статистика SoundWave', files: [file] }).catch(() => downloadBlob(blob));
    } else {
      downloadBlob(blob);
    }
  }
  function doShareBlobFallback(cv2){ try { const url = cv2.toDataURL('image/png'); downloadDataUrl(url); } catch { toast('Не удалось создать карточку'); } }
  function downloadDataUrl(url){ const a = document.createElement('a'); a.href = url; a.download = 'soundwave-stats.png'; document.body.appendChild(a); a.click(); a.remove(); toast('Статистика сохранена'); }
  function downloadBlob(blob){ const url = URL.createObjectURL(blob); downloadDataUrl(url); setTimeout(() => URL.revokeObjectURL(url), 1500); }
}

function buildBackup(){
  return {
    v: 2, app: 'soundwave', date: new Date().toISOString(),
    likes: state.likes, playlists: state.playlists, history: state.history, stats: state.stats,
    pinned: state.pinned, followed: state.followed,
    savedSearches: state.savedSearches,
    settings: {
      accent: state.accent, theme: state.theme, amoled: state.amoled,
      autoRelated: state.autoRelated, fullOnly: state.fullOnly, viz: state.viz,
      vizMode: state.vizMode, eq: state.eq, shuffle: state.shuffle, repeat: state.repeat, abLoop: state.abLoop,
      karaoke: state.karaoke, crossfade: state.crossfade, bassKnob: state.bassKnob,
      trebleKnob: state.trebleKnob, tabs: state.tabs, normalize: state.normalize
    }
  };
}
function applySettingsUI(){
  const a = $('#opt-amoled'); if (a) a.checked = state.amoled;
  const l = $('#opt-light'); if (l) l.checked = state.theme === 'light';
  const au = $('#opt-auto'); if (au) au.checked = state.autoRelated;
  const fo = $('#opt-full'); if (fo) fo.checked = state.fullOnly;
  const vz = $('#opt-viz'); if (vz) vz.checked = state.viz;
  const nm = $('#opt-norm'); if (nm) nm.checked = state.normalize;
  $('#np-shuffle').classList.toggle('on', state.shuffle);
  syncRepeat(); syncAB();
}
$('#data-export').addEventListener('click', () => {
  const data = JSON.stringify(buildBackup(), null, 2);
  try {
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'soundwave-backup.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    toast('Резервная копия сохранена');
  } catch {
    openSheet('Экспорт данных',
      `<div class="field"><textarea id="exp-ta" readonly>${esc(data)}</textarea></div>
       <div class="btnrow"><button class="btn" id="exp-copy">Скопировать</button></div>`);
    $('#exp-ta').addEventListener('focus', e => e.target.select());
    $('#exp-copy').onclick = () => { navigator.clipboard && navigator.clipboard.writeText(data); closeSheet(); toast('Скопировано в буфер'); };
  }
});
$('#data-import').addEventListener('click', () => {
  const fi = $('#imp-file'); if (!fi) return;
  fi.value = ''; fi.click();
});
$('#imp-file').addEventListener('change', e => {
  const f = e.target.files && e.target.files[0]; if (!f) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const j = JSON.parse(reader.result);
      if (!j) throw new Error('пусто');
      if (Array.isArray(j.likes)) state.likes = j.likes;
      if (Array.isArray(j.playlists)) state.playlists = j.playlists;
      if (Array.isArray(j.history)) state.history = j.history.slice(0, 100);
      if (Array.isArray(j.pinned)) state.pinned = j.pinned;
      if (Array.isArray(j.followed)) state.followed = j.followed;
      if (Array.isArray(j.savedSearches)) state.savedSearches = j.savedSearches;
      if (j.stats) state.stats = j.stats;
      if (j.settings){
        Object.assign(state, j.settings);
        LS.set('accent', state.accent); LS.set('theme', state.theme);
        LS.set('amoled', state.amoled); LS.set('autorel', state.autoRelated);
        LS.set('fullonly', state.fullOnly); LS.set('viz', state.viz);
        LS.set('vizMode', state.vizMode); LS.set('eq', state.eq);
        LS.set('shuffle', state.shuffle); LS.set('repeat', state.repeat);
        LS.set('karaoke', state.karaoke); syncKaraokeBtn();
        LS.set('crossfade', state.crossfade); LS.set('bassKnob', state.bassKnob);
        LS.set('trebleKnob', state.trebleKnob); LS.set('tabs', state.tabs);
        LS.set('normalize', state.normalize);
        applyTheme(); applyTabsVisibility();
      }
      LS.set('likes', state.likes); LS.set('playlists', state.playlists);
      LS.set('history', state.history); LS.set('stats', state.stats);
      LS.set('pinned', state.pinned); LS.set('followed', state.followed);
      LS.set('savedSearches', state.savedSearches);
      applySettingsUI();
      if (curScreen === 'library') renderLib();
      renderRecentCaro();
      toast('Резервная копия восстановлена');
    } catch { toast('Ошибка импорта: неверный файл'); }
  };
  reader.onerror = () => toast('Не удалось прочитать файл');
  reader.readAsText(f);
});

$('#music-import').addEventListener('click', () => { const mf = $('#music-file'); if (!mf) return; mf.value = ''; mf.click(); });
$('#music-clear').addEventListener('click', () => {
  if (!state.localTracks.length){ toast('Локальная музыка уже пуста'); return; }
  for (const lt of state.localTracks){ try { URL.revokeObjectURL(lt.url); } catch {} }
  state.localTracks = [];
  if (curScreen === 'library' && libMode === 'mymusic') renderLib();
  toast('Локальная музыка очищена');
});
$('#music-file').addEventListener('change', e => {
  const files = e.target.files; if (!files || !files.length) return;
  let added = 0;
  for (const f of files){
    const url = URL.createObjectURL(f);
    state.localTracks.push({ id: 'local-' + Date.now() + '-' + (localSeq++), name: f.name, file: f.name, url: url });
    added++;
  }
  toast('Добавлено: ' + added);
  if (curScreen === 'library' && libMode === 'mymusic') renderLib();
});

const lyrCache = {};
function fmtLRC(sec){ const m = Math.floor(sec/60), s = (sec % 60); return '[' + m + ':' + String(s.toFixed(2)).padStart(5,'0') + ']'; }
function parseLRC(s){
  const out = [];
  for (const line of s.split('\n')){
    const m = line.match(/^\[(\d+):(\d+(?:\.\d+)?)\](.*)$/);
    if (!m) continue;
    const text = m[3].trim();
    if (text) out.push({ t: +m[1] * 60 + +m[2], text });
  }
  return out;
}
const cleanTitle = t => t.replace(/\(.*?\)|\[.*?\]/g, ' ').replace(/\s+/g, ' ').trim();
async function fetchLyrics(track){
  if (lyrCache[track.id]) return lyrCache[track.id];
  const edited = LS.get('lyr-edit-' + track.id, null);
  if (edited != null){
    const isLrc = /\[(\d+):(\d+(?:\.\d+)?)\]/.test(edited);
    const res = { plain: isLrc ? '' : edited, synced: isLrc ? edited : '', src: 'local-edit' };
    lyrCache[track.id] = res;
    return res;
  }
  const title = cleanTitle(track.title);
  let res = { plain: '', synced: '', src: '' };
  const withTimeout = (p, ms) => Promise.race([p, new Promise(r => setTimeout(() => r(null), ms))]);
  try {
    const r = await withTimeout(rawFetch('https://lrclib.net/api/search?track_name=' + encodeURIComponent(title) + '&artist_name=' + encodeURIComponent(track.artist)), 9000);
    if (r){
      const j = await r.json();
      if (Array.isArray(j) && j.length){
        const best = j.find(x => x.syncedLyrics) || j[0];
        res.synced = best.syncedLyrics || '';
        res.plain = best.plainLyrics || '';
        res.src = 'lrclib';
      }
    }
  } catch {}
  if (!res.synced && !res.plain){
    try {
      const r = await withTimeout(rawFetch('https://lrclib.net/api/search?q=' + encodeURIComponent(title + ' ' + track.artist)), 9000);
      if (r){
        const j = await r.json();
        if (Array.isArray(j) && j.length){
          const best = j.find(x => x.syncedLyrics) || j[0];
          res.synced = best.syncedLyrics || '';
          res.plain = best.plainLyrics || '';
          res.src = 'lrclib';
        }
      }
    } catch {}
  }
  if (!res.synced && !res.plain){
    try {
      const r = await withTimeout(rawFetch('https://api.lyrics.ovh/v1/' + encodeURIComponent(track.artist) + '/' + encodeURIComponent(title)), 9000);
      if (r && r.ok){
        const j = await r.json();
        if (j && j.lyrics && j.lyrics.trim().length > 40){
          res.plain = j.lyrics.replace(/\r\n/g, '\n').trim();
          res.src = 'lyricsovh';
        }
      }
    } catch {}
  }
  if (!res.synced && !res.plain){
    try {
      const r2 = await withTimeout(rawFetch('https://genius.com/api/search/multi?q=' + encodeURIComponent(title + ' ' + track.artist)), 9000);
      if (r2){
        const j2 = await r2.json();
        const hits = [];
        for (const sec of (j2.response && j2.response.sections) || [])
          for (const h of sec.hits || []) if (h.result && h.result.url && h.result.url.includes('/lyrics')) hits.push(h.result.url);
        if (hits.length){
          const r3 = await withTimeout(rawFetch(hits[0]), 12000);
          if (r3){
            const html = await r3.text();
            const blocks = [...html.matchAll(/<div[^>]*class="[^"]*Lyrics__Container[^"]*"[^>]*>([\s\S]*?)<\/div>/g)].map(m => m[1]).join('\n');
            if (blocks){
              const text = blocks
                .replace(/<br\s*\/?>/gi, '\n').replace(/<p[^>]*>/gi, '\n').replace(/<\/p>/gi, '\n')
                .replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#x27;|&#39;/g, "'")
                .replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\n{3,}/g, '\n\n').trim();
              if (text.length > 40){ res.plain = text; res.src = 'genius'; }
            }
          }
        }
      }
    } catch {}
  }
  lyrCache[track.id] = res;
  return res;
}
let lyrLines = [], lyrActive = -1, lyrOpenTrack = 0, lyrEditing = false;
let lyrCurrent = null, lyrTranslate = false, lyrTrLines = [], lyrTranslating = false;
const karaBtn = $('#lyr-kara');
const trBtn = $('#lyr-tr');
function resetLyrics(){
  lyrLines = []; lyrActive = -1; lyrOpenTrack = 0; lyrEditing = false;
  lyrCurrent = null; lyrTranslate = false; lyrTrLines = []; lyrTranslating = false;
  if (karaBtn){ karaBtn.hidden = true; karaBtn.classList.remove('on'); }
  if (trBtn){ trBtn.classList.remove('on'); trBtn.setAttribute('aria-pressed', 'false'); trBtn.hidden = true; }
}
function syncKaraokeBtn(){
  if (!karaBtn) return;
  karaBtn.setAttribute('aria-pressed', String(state.karaoke));
  karaBtn.classList.toggle('on', state.karaoke);
}
function buildKaraokeLine(lineEl, i){
  const words = (lyrLines[i].text || '').split(/\s+/).filter(Boolean);
  lineEl.innerHTML = words.map((w, j) => `<span class="kw-w" data-wi="${j}">${esc(w)}</span>`).join(' ');
  lineEl.dataset.kw = String(words.length);
}
function clearKaraokeLine(lineEl){
  if (lineEl && lineEl.dataset.kw){
    const li = lineEl.dataset.li;
    const tr = (lyrTranslate && lyrTrLines[+li]) ? '<div class="lyr-tr">' + esc(lyrTrLines[+li]) + '</div>' : '';
    lineEl.innerHTML = esc(lyrLines[+li] ? lyrLines[+li].text : lineEl.textContent) + tr;
    delete lineEl.dataset.kw;
  }
}
if (karaBtn){
  syncKaraokeBtn();
  karaBtn.addEventListener('click', () => {
    state.karaoke = !state.karaoke;
    LS.set('karaoke', state.karaoke);
    syncKaraokeBtn();
    if (state.karaoke && lyrTranslate){
      lyrTranslate = false; lyrTrLines = [];
      if (trBtn){ trBtn.classList.remove('on'); trBtn.setAttribute('aria-pressed', 'false'); }
      renderLyricsBody();
    }
    if (!state.karaoke){
      const lines = $('#lyr-body').children;
      for (let i = 0; i < lines.length; i++) clearKaraokeLine(lines[i]);
    } else {
      lyrActive = -1;
    }
    toast(state.karaoke ? 'Караоке: подсветка по словам' : 'Караоке выключен');
    haptic(0);
  });
}
function lyrLineTr(i){
  return (lyrTranslate && lyrTrLines[i]) ? '<div class="lyr-tr">' + esc(lyrTrLines[i]) + '</div>' : '';
}
function renderLyricsBody(){
  const body = $('#lyr-body');
  const lrc = lyrCurrent;
  if (!lrc) return;
  if (lrc.synced){
    lyrLines = parseLRC(lrc.synced);
    body.innerHTML = lyrLines.map((l, i) => `<div class="lyr-line" data-lt="${l.t}" data-li="${i}">${esc(l.text)}${lyrLineTr(i)}</div>`).join('');
    if (karaBtn){ karaBtn.hidden = false; syncKaraokeBtn(); }
    if (trBtn){ trBtn.hidden = false; }
  } else if (lrc.plain){
    lyrLines = [];
    if (karaBtn) karaBtn.hidden = true;
    if (trBtn){ trBtn.hidden = false; }
    const ls = lrc.plain.split('\n');
    body.innerHTML = ls.map((line, i) => `<div class="lyr-line${line.trim() ? '' : ' past'}" style="pointer-events:none">${esc(line) || '&nbsp;'}${lyrLineTr(i)}</div>`).join('');
  } else {
    if (karaBtn) karaBtn.hidden = true;
    if (trBtn){ trBtn.hidden = true; }
    body.innerHTML = '<div class="lyr-msg">Текст не найден.<br>База лирики покрывает не все треки — попробуйте поискать вручную или послушать что-то ещё 🎧</div>';
  }
}
$('#np-lyrics').addEventListener('click', async () => {
  const t = current(); if (!t) return;
  $('#lyr-t').textContent = t.title;
  $('#lyr-a').textContent = t.artist;
  $('#lyr-body').innerHTML = Array.from({length: 10}, () => '<div class="sk-line"></div>').join('');
  $('#lyr').classList.add('open');
  lyrOpenTrack = t.id;
  lyrCurrent = null; lyrTranslate = false; lyrTrLines = [];
  if (trBtn){ trBtn.classList.remove('on'); trBtn.setAttribute('aria-pressed', 'false'); trBtn.hidden = true; }
  const lrc = await fetchLyrics(t);
  if (lyrOpenTrack !== t.id) return;
  lyrCurrent = lrc;
  renderLyricsBody();
});
$('#lyr-x').addEventListener('click', () => $('#lyr').classList.remove('open'));
function isLikelyEnglish(text){
  const t = String(text || '');
  if (/[а-яё]/i.test(t)) return false;
  const letters = (t.match(/[a-z]/gi) || []).length;
  const alnum = (t.match(/[a-z0-9]/gi) || []).length;
  if (alnum < 12) return false;
  return letters / alnum > 0.5;
}
function collectLyricsText(){
  if (!lyrCurrent) return { text: '', lines: [] };
  if (lyrCurrent.synced){
    const arr = parseLRC(lyrCurrent.synced);
    return { text: arr.map(l => l.text).join('\n'), lines: arr.map(l => l.text) };
  }
  if (lyrCurrent.plain){
    const arr = lyrCurrent.plain.split('\n');
    return { text: arr.join('\n'), lines: arr };
  }
  return { text: '', lines: [] };
}
async function translateLyrics(text){
  const lines = text.split('\n');
  const chunks = [];
  let cur = '';
  for (const ln of lines){
    const add = (cur ? cur + '\n' : '') + ln;
    if (add.length > 450){ if (cur) chunks.push(cur); cur = ln; }
    else cur = add;
  }
  if (cur) chunks.push(cur);
  const out = [];
  for (const ch of chunks){
    const r = await rawFetch('https://api.mymemory.translated.net/get?q=' + encodeURIComponent(ch) + '&langpair=en|ru');
    if (!r.ok) throw new Error('translate HTTP ' + r.status);
    const j = await r.json();
    const t = j && j.responseData && j.responseData.translatedText;
    if (!t) throw new Error('no translation');
    out.push(t);
  }
  return out.join('\n');
}
if (trBtn){
  trBtn.addEventListener('click', async () => {
    if (!lyrCurrent){ toast('Сначала откройте текст'); return; }
    if (lyrTranslating){ toast('Переводим…'); return; }
    if (!lyrTranslate){
      const col = collectLyricsText();
      if (!col.text.trim()){ toast('Нечего переводить'); return; }
      if (!isLikelyEnglish(col.text)){ toast('Перевод доступен только для англоязычных текстов'); return; }
      if (state.karaoke){
        state.karaoke = false; LS.set('karaoke', false); syncKaraokeBtn();
      }
      lyrTranslating = true;
      trBtn.classList.add('busy');
      try {
        const translated = await translateLyrics(col.text);
        const trArr = translated.split('\n');
        lyrTrLines = trArr.length === col.lines.length ? trArr : col.lines.map((_, i) => trArr.join(' '));
        lyrTranslate = true;
        trBtn.classList.add('on');
        trBtn.setAttribute('aria-pressed', 'true');
        renderLyricsBody();
        toast('Перевод готов');
      } catch (e){
        toast('Перевод недоступен');
      } finally {
        lyrTranslating = false;
        trBtn.classList.remove('busy');
      }
    } else {
      lyrTranslate = false; lyrTrLines = [];
      trBtn.classList.remove('on');
      trBtn.setAttribute('aria-pressed', 'false');
      renderLyricsBody();
    }
    haptic(0);
  });
}
$('#lyr-body').addEventListener('click', e => {
  const ln = e.target.closest('[data-lt]'); if (!ln) return;
  audio.currentTime = +ln.dataset.lt; nativeNP();
});
function updateLyrics(){
  if (lyrEditing) return;
  if (!lyrLines.length || !$('#lyr').classList.contains('open')) return;
  const ct = audio.currentTime;
  let idx = -1;
  for (let i = 0; i < lyrLines.length; i++){ if (lyrLines[i].t <= ct) idx = i; else break; }
  const lines = $('#lyr-body').children;
  if (state.karaoke && !lyrTranslate && idx >= 0 && lines[idx]){
    const el = lines[idx];
    if (idx !== lyrActive || !el.dataset.kw) buildKaraokeLine(el, idx);
    const n = +(el.dataset.kw || 0);
    if (n > 0){
      const start = lyrLines[idx].t;
      const end = idx + 1 < lyrLines.length ? lyrLines[idx + 1].t : (audio.duration || start + 4);
      const prog = Math.min(0.999, Math.max(0, (ct - start) / Math.max(0.5, end - start)));
      const wi = Math.min(n - 1, Math.floor(prog * n));
      const ws = el.querySelectorAll('.kw-w');
      for (let j = 0; j < ws.length; j++) ws[j].classList.toggle('kw', j === wi);
    }
  }
  if (idx === lyrActive) return;
  lyrActive = idx;
  if (!state.karaoke){ for (let i = 0; i < lines.length; i++) clearKaraokeLine(lines[i]); }
  let scrollTarget = null;
  if (idx >= 0 && lines[idx]){
    const body = $('#lyr-body');
    scrollTarget = lines[idx].offsetTop - body.clientHeight / 2 + lines[idx].offsetHeight / 2;
  }
  for (let i = 0; i < lines.length; i++){
    lines[i].classList.toggle('on', i === idx);
    lines[i].classList.toggle('past', i < idx);
  }
  if (scrollTarget != null) $('#lyr-body').scrollTo({ top: scrollTarget, behavior: 'smooth' });
}
$('#lyr-edit').addEventListener('click', () => {
  const t = current(); if (!t) return;
  lyrEditing = true;
  const cached = lyrCache[t.id];
  let cur = '';
  if (cached && (cached.synced || cached.plain)) cur = cached.synced || cached.plain;
  else if (lyrLines.length) cur = lyrLines.map(l => fmtLRC(l.t) + l.text).join('\n');
  const body = $('#lyr-body');
  body.innerHTML = `<div class="lyr-edit-wrap">
    <textarea id="lyr-edit-ta" class="lyr-edit-ta" placeholder="[00:12.34] Текст строки…">${esc(cur)}</textarea>
    <div class="btnrow" style="margin-top:10px">
      <button class="btn" id="lyr-save">Сохранить</button>
      <button class="btn" id="lyr-cancel">Отмена</button>
    </div>
    <button class="btn danger" id="lyr-clear" style="margin-top:8px;width:100%">Удалить правку</button>
    <p class="note" style="margin-top:10px">Текст сохраняется только локально. Формат LRC: [mm:ss.xx] строка.</p>
  </div>`;
  const ta = $('#lyr-edit-ta');
  ta.focus();
  $('#lyr-save').onclick = () => {
    const txt = ta.value;
    LS.set('lyr-edit-' + t.id, txt);
    lyrCache[t.id] = null; lyrEditing = false;
    toast('Текст сохранён');
    $('#np-lyrics').click();
  };
  $('#lyr-cancel').onclick = () => { lyrEditing = false; $('#np-lyrics').click(); };
  $('#lyr-clear').onclick = () => {
    LS.set('lyr-edit-' + t.id, null);
    lyrCache[t.id] = null; lyrEditing = false;
    toast('Локальная правка удалена');
    $('#np-lyrics').click();
  };
});
function updateCidUI(){
  const b = $('#cid-status');
  b.textContent = cidState === 'ok' ? 'работает' : cidState === 'err' ? 'ошибка' : 'проверка…';
  b.className = 'badge ' + (cidState === 'ok' ? 'ok' : cidState === 'err' ? 'err' : 'mid');
  $('#cid-input').value = cid;
}
$('#cid-save').addEventListener('click', async () => {
  const v = $('#cid-input').value.trim();
  if (!v){ toast('Введите ключ'); return; }
  cid = v; LS.set('cid', v);
  try { await apiGet('/search/tracks', { q: 'test', limit: 1 }); cidState = 'ok'; updateCidUI(); toast('Ключ работает'); }
  catch (e){ cidState = 'err'; updateCidUI(); toast('Ключ не подошёл'); }
});
$('#cid-auto').addEventListener('click', async () => {
  toast('Ищу ключ…');
  try {
    await discoverCid();
    await apiGet('/search/tracks', { q: 'test', limit: 1 });
    cidState = 'ok'; updateCidUI(); toast('Готово, ключ обновлён');
  } catch (e){ cidState = 'err'; updateCidUI(); toast('Не удалось найти ключ'); }
});
$('#accents').innerHTML = Object.entries(ACCENTS).filter(([k]) => k !== 'custom').map(([k, v]) =>
  `<button class="chip${state.accent === k ? ' on' : ''}" data-ac="${k}" style="background:${k === state.accent ? '' : `linear-gradient(135deg,${v[0]},${v[1]})`};${k === state.accent ? '' : 'border-color:transparent'}">${({orange:'Оранж',green:'Зелёный',blue:'Синий',pink:'Розовый',purple:'Фиолет',teal:'Бирюз',sunset:'Закат',mint:'Мятн'})[k]}</button>`).join('') +
  `<button class="chip${state.accent === 'custom' ? ' on' : ''}" id="acc-custom">Своя</button><input type="color" id="acc-color" style="display:none">`;
if (state.accent === 'custom'){ const ac = $('#acc-color'); if (ac) ac.value = LS.get('accent-custom', '#ff5500'); }
$('#accents').addEventListener('click', e => {
  if (e.target.closest('#acc-custom')){ const inp = $('#acc-color'); if (inp) inp.click(); return; }
  const b = e.target.closest('[data-ac]'); if (!b) return;
  state.accent = b.dataset.ac; LS.set('accent', state.accent); applyTheme();
  $$('#accents .chip').forEach(c => {
    const k = c.dataset.ac; if (!k) return;
    const v = ACCENTS[k];
    c.classList.toggle('on', k === state.accent);
    c.style.background = k === state.accent ? '' : `linear-gradient(135deg,${v[0]},${v[1]})`;
    c.style.borderColor = k === state.accent ? '' : 'transparent';
  });
  haptic(0);
  toast('Акцент обновлён');
});
$('#acc-color').addEventListener('input', e => {
  const hex = e.target.value;
  ACCENTS.custom = buildCustomAccent(hex);
  state.accent = 'custom'; LS.set('accent', 'custom'); LS.set('accent-custom', hex);
  applyTheme();
  $$('#accents .chip').forEach(c => c.classList.toggle('on', c.id === 'acc-custom'));
  haptic(0); toast('Акцент обновлён');
});
const ICON_SETS = [['Оранж', ''], ['Синий', 'alt-blue'], ['Розовый', 'alt-pink'], ['Зелёный', 'alt-green']];
$('#iconset').innerHTML = ICON_SETS.map(([n, id], i) =>
  `<button class="chip${i === 0 ? ' on' : ''}" data-ic="${id}">${n}</button>`).join('');
$('#iconset').addEventListener('click', e => {
  const b = e.target.closest('[data-ic]'); if (!b) return;
  $$('#iconset .chip').forEach(c => c.classList.toggle('on', c === b));
  const name = b.dataset.ic;
  if (!window.__swNative){ $('#icon-note').hidden = false; return; }
  if (!nativeCmd({cmd:'seticon', name})) toast('Иконка недоступна');
});
const fontScale = LS.get('fontscale', 1);
document.documentElement.style.setProperty('--fs', fontScale);
$$('#font-seg button').forEach(b => b.classList.toggle('on', Math.abs((+b.dataset.fs) - fontScale) < 0.01));
$('#font-seg').addEventListener('click', e => {
  const b = e.target.closest('[data-fs]'); if (!b) return;
  const fs = +b.dataset.fs;
  document.documentElement.style.setProperty('--fs', fs);
  LS.set('fontscale', fs);
  $$('#font-seg button').forEach(x => x.classList.toggle('on', x === b));
  haptic(0);
});
$('#opt-wake').checked = LS.get('wake', false);
$('#opt-wake').addEventListener('change', e => {
  LS.set('wake', e.target.checked);
  nativeCmd({cmd:'keepawake', on: e.target.checked});
  toast(e.target.checked ? 'Экран будет гореть при открытом плеере' : 'Экран гаснет как обычно');
});
if (LS.get('wake', false)) nativeCmd({cmd:'keepawake', on:true});
$('#opt-amoled').checked = state.amoled;
$('#opt-amoled').addEventListener('change', e => { state.amoled = e.target.checked; LS.set('amoled', state.amoled); applyTheme(); });
$('#opt-light').checked = state.theme === 'light';
$('#opt-light').addEventListener('change', e => { state.theme = e.target.checked ? 'light' : 'dark'; LS.set('theme', state.theme); applyTheme(); });
$('#opt-auto').checked = state.autoRelated;
$('#opt-auto').addEventListener('change', e => { state.autoRelated = e.target.checked; LS.set('autorel', state.autoRelated); });
$('#opt-full').checked = state.fullOnly;
$('#opt-full').addEventListener('change', e => { state.fullOnly = e.target.checked; LS.set('fullonly', state.fullOnly); toast(e.target.checked ? 'Фрагменты скрыты' : 'Показываю все треки'); });
$('#opt-viz').checked = state.viz;
$('#opt-viz').addEventListener('change', e => {
  state.viz = e.target.checked; LS.set('viz', state.viz);
  if (state.viz){
    toast('Реальный спектр включится после перезапуска приложения');
    setTimeout(() => location.reload(), 1400);
  } else {
    toast('Спектр выключится после перезапуска приложения');
    setTimeout(() => location.reload(), 1400);
  }
});
$('#opt-norm').checked = state.normalize;
$('#opt-norm').addEventListener('change', e => {
  state.normalize = e.target.checked; LS.set('normalize', state.normalize);
  audio.volume = normVol();
  toast(e.target.checked ? 'Авто-уровень включён (85%)' : 'Авто-уровень выключен');
});
$('#clr-hist').addEventListener('click', () => { state.history = []; LS.set('history', []); if (curScreen === 'library') renderLib(); renderRecentCaro(); toast('История очищена'); });
$('#clr-likes').addEventListener('click', () => {
  if (!confirm('Удалить все любимые треки?')) return;
  state.likes = []; LS.set('likes', []);
  if (curScreen === 'library') renderLib();
  const t = current(); if (t) syncHearts(t.id);
  toast('Список очищен');
});
const crossfadeSlider = $('#opt-crossfade');
if (crossfadeSlider){
  crossfadeSlider.value = state.crossfade;
  crossfadeSlider.style.setProperty('--val', (state.crossfade / 12 * 100) + '%');
  $('#crossfade-val').textContent = state.crossfade ? state.crossfade + 'с' : 'выкл';
  crossfadeSlider.addEventListener('input', () => {
    state.crossfade = +crossfadeSlider.value; LS.set('crossfade', state.crossfade);
    crossfadeSlider.style.setProperty('--val', (state.crossfade / 12 * 100) + '%');
    $('#crossfade-val').textContent = state.crossfade ? state.crossfade + 'с' : 'выкл';
    if (!state.crossfade){ cancelCrossfade(); P.crossfading = false; P.crossfadeIn = false; audio.volume = normVol(); }
  });
}
$$('.tab-toggle').forEach(cb => {
  const s = cb.dataset.tab;
  cb.checked = state.tabs[s] !== false;
  cb.addEventListener('change', () => {
    state.tabs = state.tabs || {};
    state.tabs[s] = cb.checked;
    LS.set('tabs', state.tabs);
    const vis = visibleTabs();
    if (!vis.length){ state.tabs[s] = true; cb.checked = true; LS.set('tabs', state.tabs); toast('Нельзя скрыть все вкладки'); }
    applyTabsVisibility();
  });
});

function watchSentinel(sentSel, rootSel, cb){
  const sent = $(sentSel), root = $(rootSel);
  if (!sent || !root) return;
  new IntersectionObserver(es => { if (es[0].isIntersecting) cb(); }, { root, rootMargin: '500px' }).observe(sent);
}
watchSentinel('#search-sent', '#scr-search .scroll', () => {
  if (!searchState.loading && !searchState.done && searchState.q) runSearch(searchState.q, false);
});
watchSentinel('#chart-sent', '#discover-scroll', () => {
  if (!discoverState.loading && !discoverState.done) loadDiscover(false);
});

const PALETTE_ACTIONS = [
  { id: 'search', label: 'Поиск треков', ic: '🔍', run: () => { showScreen('search'); $('#q').focus(); } },
  { id: 'home', label: 'Главная', ic: '🏠', run: () => showScreen('discover') },
  { id: 'library', label: 'Библиотека', ic: '📚', run: () => showScreen('library') },
  { id: 'stats', label: 'Статистика', ic: '📊', run: () => openStats() },
  { id: 'activity', label: 'Активность артистов', ic: '📣', run: () => openActivity() },
  { id: 'theme', label: 'Переключить тему', ic: '🌗', run: () => {
    state.theme = state.theme === 'light' ? 'dark' : 'light';
    LS.set('theme', state.theme); applyTheme();
    const l = $('#opt-light'); if (l) l.checked = state.theme === 'light';
    toast('Тема: ' + (state.theme === 'light' ? 'светлая' : 'тёмная'));
  } },
  { id: 'amoled', label: 'Переключить AMOLED', ic: '⬛', run: () => {
    state.amoled = !state.amoled;
    LS.set('amoled', state.amoled); applyTheme();
    const a = $('#opt-amoled'); if (a) a.checked = state.amoled;
    toast('AMOLED ' + (state.amoled ? 'вкл' : 'выкл'));
  } },
  { id: 'backup', label: 'Экспорт бэкапа', ic: '💾', run: () => $('#data-export').click() },
  { id: 'next', label: 'Следующий', ic: '⏭', run: () => next() },
  { id: 'prev', label: 'Предыдущий', ic: '⏮', run: () => prev() },
  { id: 'play', label: 'Play/Pause', ic: '▶', run: () => toggle() }
];
let paletteOpen = false, paletteSel = 0, paletteFiltered = [];
function openPalette(){
  paletteOpen = true; paletteSel = 0;
  const p = $('#palette');
  p.hidden = false;
  requestAnimationFrame(() => p.classList.add('open'));
  paletteFiltered = PALETTE_ACTIONS.slice();
  renderPaletteList();
  const inp = $('#palette-input');
  inp.value = '';
  inp.focus();
}
function closePalette(){
  paletteOpen = false;
  const p = $('#palette');
  p.classList.remove('open');
  setTimeout(() => { p.hidden = true; }, 220);
}
function renderPaletteList(){
  const list = $('#palette-list');
  if (!paletteFiltered.length){ list.innerHTML = '<div class="pal-empty">Ничего не найдено</div>'; return; }
  list.innerHTML = paletteFiltered.map((a, i) => `<div class="pal-item${i === paletteSel ? ' sel' : ''}" data-pi="${i}">
    <span class="pal-ic">${a.ic}</span><span class="pal-l">${esc(a.label)}</span></div>`).join('');
}
$('#palette-input').addEventListener('input', e => {
  const q = e.target.value.trim().toLowerCase();
  paletteFiltered = q ? PALETTE_ACTIONS.filter(a => a.label.toLowerCase().includes(q)) : PALETTE_ACTIONS.slice();
  paletteSel = 0; renderPaletteList();
});
$('#palette-list').addEventListener('click', e => {
  const it = e.target.closest('[data-pi]'); if (!it) return;
  const a = paletteFiltered[+it.dataset.pi]; if (!a) return;
  closePalette(); a.run();
});
$('#palette-bd').addEventListener('click', closePalette);

let kbMuted = false, kbPrevVol = 1;
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.code === 'KeyK'){
    e.preventDefault();
    if (paletteOpen) closePalette(); else openPalette();
    return;
  }
  if (paletteOpen){
    if (e.key === 'Escape'){ e.preventDefault(); closePalette(); return; }
    if (e.key === 'ArrowDown'){ e.preventDefault(); paletteSel = Math.min(paletteFiltered.length - 1, paletteSel + 1); renderPaletteList(); return; }
    if (e.key === 'ArrowUp'){ e.preventDefault(); paletteSel = Math.max(0, paletteSel - 1); renderPaletteList(); return; }
    if (e.key === 'Enter'){ e.preventDefault(); const a = paletteFiltered[paletteSel]; if (a){ closePalette(); a.run(); } return; }
    return;
  }
  const tag = e.target.tagName;
  const inField = tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable;
  if (inField) return;
  if (e.code === 'Space'){ e.preventDefault(); toggle(); return; }
  const t = current();
  switch (e.key){
    case 'ArrowRight': if (t){ try { audio.currentTime = Math.min(audio.duration || 0, (audio.currentTime || 0) + 5); } catch {} nativeNP(); } break;
    case 'ArrowLeft':  if (t){ try { audio.currentTime = Math.max(0, (audio.currentTime || 0) - 5); } catch {} nativeNP(); } break;
    case 'ArrowUp': { e.preventDefault(); const v = Math.min(1, (audio.volume || 0) + 0.1); audio.volume = v; if (v > 0) kbMuted = false; toast('Громкость ' + Math.round(v * 100) + '%'); break; }
    case 'ArrowDown': { e.preventDefault(); const v = Math.max(0, (audio.volume || 0) - 0.1); audio.volume = v; toast('Громкость ' + Math.round(v * 100) + '%'); break; }
    case 'm': case 'M': {
      if (kbMuted){ audio.volume = kbPrevVol || 1; kbMuted = false; toast('Звук включён'); }
      else { kbPrevVol = audio.volume || 1; audio.volume = 0; kbMuted = true; toast('Звук выключен'); }
      break;
    }
    case 's': case 'S': toggleShuffle(); break;
    case 'r': case 'R': {
      state.repeat = state.repeat === 'off' ? 'all' : state.repeat === 'all' ? 'one' : 'off';
      LS.set('repeat', state.repeat); syncRepeat();
      toast(state.repeat === 'off' ? 'Повтор выключен' : state.repeat === 'all' ? 'Повтор очереди' : 'Повтор трека');
      break;
    }
    case 'n': case 'N': next(); break;
    case 'p': case 'P': prev(); break;
    case 'l': case 'L': if (t) toggleLike(t.id); break;
    case '/': e.preventDefault(); showScreen('search'); $('#q').focus(); break;
  }
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden){
    flushStats(); saveSession();
    if (viz.ctx && viz.ctx.state === 'running') viz.ctx.suspend().catch(()=>{});
  } else {
    if (viz.ctx && viz.ctx.state === 'suspended' && !document.body.classList.contains('paused'))
      viz.ctx.resume().catch(()=>{});
  }
});
setInterval(flushStats, 15000);
window.addEventListener('pagehide', saveSession);

const ONBOARD_STEPS = [
  { ic: '🔍', t: 'Поиск музыки', d: 'Откройте вкладку «Поиск» и введите исполнителя, трек или жанр.' },
  { ic: '▶', t: 'Играйте', d: 'Нажмите на любой трек — он начнёт играть. Свайните вверх по мини-плееру для полного экрана.' },
  { ic: '📚', t: 'Библиотека', d: 'Сохраняйте любимые треки сердечком и создавайте свои плейлисты.' }
];
let onboardStep = 0;
function showOnboard(){
  const o = $('#onboard'); if (!o) return;
  onboardStep = 0;
  o.hidden = false;
  requestAnimationFrame(() => o.classList.add('open'));
  renderOnboardStep();
}
function renderOnboardStep(){
  const s = ONBOARD_STEPS[onboardStep];
  $('#onboard-ic').textContent = s.ic;
  $('#onboard-t').textContent = s.t;
  $('#onboard-d').textContent = s.d;
  $('#onboard-dots').innerHTML = ONBOARD_STEPS.map((_, i) => `<span class="ob-dot${i === onboardStep ? ' on' : ''}"></span>`).join('');
  $('#onboard-next').textContent = onboardStep === ONBOARD_STEPS.length - 1 ? 'Понятно' : 'Далее';
}
function closeOnboard(){
  const o = $('#onboard'); if (!o) return;
  o.classList.remove('open');
  setTimeout(() => { o.hidden = true; }, 280);
  LS.set('onboarded', true);
}
$('#onboard-next').addEventListener('click', () => {
  if (onboardStep < ONBOARD_STEPS.length - 1){ onboardStep++; renderOnboardStep(); haptic(0); }
  else { closeOnboard(); haptic(0); }
});
$('#onboard-skip').addEventListener('click', () => { closeOnboard(); haptic(0); });

(async () => {
  $('#mini-play').innerHTML = I.play;
  $('#mini-next').innerHTML = I.next;
  $('#np-play').innerHTML = I.play;
  $('#np-prev').innerHTML = I.prev;
  $('#np-next').innerHTML = I.next;
  $('#np-shuffle').innerHTML = I.shuffle;
  $('#np-like').innerHTML = I.heart;
  $('#np-shuffle').classList.toggle('on', state.shuffle);
  syncRepeat();
  syncAB();
  $('#np-radio').classList.toggle('on', state.autoRelated);
  $('#np-vizm').textContent = VIZ_MODES[state.vizMode];
  $('#np-vizm').classList.toggle('on', state.vizMode !== 0);
  $('#np-eq').textContent = state.eq === 'flat' ? 'EQ' : state.eq[0].toUpperCase() + state.eq.slice(1);
  $('#np-eq').classList.toggle('on', state.eq !== 'flat');
  if (!LS.get('knobsInit', false)){ syncKnobsToPreset(state.eq); LS.set('knobsInit', true); }
  applyTabsVisibility();
  $$('#lib-sort .chip').forEach(c => c.classList.toggle('on', c.dataset.sort === libSort));
  applyTheme();
  updateCidUI();
  attachList($('#search-results'), 'Поиск');
  attachList($('#chart-list'), 'Обзор');
  attachList($('#lib-list'), 'Библиотека');
  await probeLocal();
  const restored = restoreSession();
  if (restored) toast('Вернул прошлую сессию — нажмите ▶');
  discoverState.loaded = true;
  loadDiscover(true);
  loadCaros();
  renderRecentCaro();
  renderDailyMixes();
  renderOnRepeat();
  renderFollowedReleases();
  checkSharedPlaylist();
  if (!LS.get('onboarded', false)) showOnboard();
  apiGet('/search/tracks', { q: 'test', limit: 1 })
    .then(() => { cidState = 'ok'; updateCidUI(); })
    .catch(() => { cidState = 'err'; updateCidUI(); });
})();
