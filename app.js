
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
  eq: LS.get('eq', 'flat')
};

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
    if (/[?&]client_id=/.test(url) || /(api-v2\.soundcloud\.com|lrclib\.net|api\.lyrics\.ovh|genius\.com)/.test(url)) return url;
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
function canPlayHls(){
  if (window.__swNative) return true;
  try { return !!(audio.canPlayType && audio.canPlayType('application/vnd.apple.mpegurl')); }
  catch { return false; }
}
const P = { q: [], i: -1, playing: false, loadId: 0, mediaUrl: '', viaProxy: false, mediaHls: false, restored: false };
let nowSource = 'Обзор';

const current = () => P.q[P.i] || null;

async function playList(list, i, source){
  if (source) nowSource = source;
  P.q = list.slice(); P.i = i;
  await loadTrack(true);
}
async function loadTrack(autoplay){
  const t = current(); if (!t) return;
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
});
audio.addEventListener('pause', () => { P.playing = false; syncPlayUI(); nativeNP(); flushStats(); saveSession(); });
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
    q: P.q.map(x => { const { media, ...m } = x; return m; }),
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
  state.stats.tracks = (state.stats.tracks || 0) + 1;
  LS.set('stats', state.stats);
}

const isLiked = id => state.likes.some(x => x.id === id);
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
  state.history = state.history.filter(x => x.id !== t.id);
  const { media, ...mini } = t;
  state.history.unshift(mini);
  state.history = state.history.slice(0, 100);
  LS.set('history', state.history);
  if (curScreen === 'library' && libMode === 'history') renderLib();
}

const skeleton = n => Array.from({ length: n }, () =>
  '<div class="skrow"><div class="sk" style="width:56px;height:56px;flex:none"></div><div style="flex:1"><div class="sk" style="height:14px;width:72%;margin-bottom:9px"></div><div class="sk" style="height:11px;width:42%"></div></div></div>').join('');
const emptyState = (title, text, retry) =>
  `<div class="empty">${I.note}<b>${esc(title)}</b><p>${esc(text)}</p>${retry ? '<button class="chip on" data-retry>Повторить</button>' : ''}</div>`;

function trackRow(t, i, rank){
  const liked = isLiked(t.id);
  return `<div class="row-t" data-i="${i}" data-tid="${esc(t.id)}">
    <div class="thumb"><img loading="lazy" decoding="async" src="${esc(t.art) || PLACEHOLDER}" onerror="this.onerror=null;this.src=PLACEHOLDER"></div>
    <div class="t-info">
      <div class="t-title">${esc(t.title)}</div>
      <div class="t-artist"${t.uid ? ` data-uid="${esc(t.uid)}"` : ''}>${esc(t.artist)}${t.snip ? ' · фрагмент' : ''}</div>
    </div>
    <div class="t-side">
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

function renderList(cont, list, opts = {}){
  const base = opts.append ? (cont._list || []).length : 0;
  const html = list.map((t, i) => trackRow(t, i + base, opts.rank ? base + i + 1 : 0)).join('');
  if (opts.append){ cont._list = (cont._list || []).concat(list); cont.insertAdjacentHTML('beforeend', html); }
  else { cont._list = list; cont.innerHTML = html; }
  updatePlayingRows();
}
function attachList(cont, source){
  cont.addEventListener('click', e => {
    if (e.target.closest('[data-retry]')){ cont._retry && cont._retry(); return; }
    const ua = e.target.closest('[data-uid]');
    if (ua){ openArtist(+ua.dataset.uid); return; }
    const h = e.target.closest('[data-like]');
    if (h){ toggleLike(+h.dataset.like); return; }
    const r = e.target.closest('.row-t'); if (!r) return;
    const list = cont._list || []; const i = +r.dataset.i;
    if (list[i]) playList(list, i, source);
  });
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
      if (reset){ renderPlRows(c, pl); if (!pl.length) c.innerHTML = emptyState('Ничего не найдено', 'Попробуйте другой запрос'); }
      else if (pl.length){ renderPlRows(c, pl, true); }
      searchState.offset += pl.length;
      searchState.done = pl.length < 20;
    } else {
      const list = await searchTracks(q, searchState.offset);
      if (searchState.q !== q) return;
      if (reset){ searchState.list = list; renderList(c, list); if (!list.length) c.innerHTML = emptyState('Ничего не найдено', 'Попробуйте другой запрос или проверьте ключ в настройках'); else pushSearchHistory(q); }
      else if (list.length){ renderList(c, list, { append: true }); searchState.list = c._list; }
      searchState.offset += list.length;
      searchState.done = list.length < 30;
    }
  } catch (e) {
    if (reset){ c.innerHTML = emptyState('Не удалось загрузить', String(e.message || e), true); c._retry = () => runSearch(q, true); }
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
  $('#hist').innerHTML = h.map(s => `<button class="chip on" data-sq="${esc(s)}">${esc(s)}</button>`).join('');
}
$('#hist').addEventListener('click', e => {
  const b = e.target.closest('[data-sq]'); if (!b) return;
  $('#q').value = b.dataset.sq; $('#qclear').hidden = false;
  runSearch(b.dataset.sq, true);
});
function pushSearchHistory(q){
  let h = LS.get('shistory', []).filter(x => x !== q);
  h.unshift(q);
  LS.set('shistory', h.slice(0, 8));
  renderSearchHistory();
}
renderSearchHistory();

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
      if (!list.length) c.innerHTML = emptyState('Пусто', 'Попробуйте другой жанр');
    } else if (list.length){
      renderList(c, list, { append: true, rank: true });
      discoverState.list = c._list;
    }
    discoverState.offset += list.length;
    discoverState.done = list.length < 30;
  } catch (e) {
    if (reset){
      c.innerHTML = emptyState('Не удалось загрузить', 'Проверьте подключение или API-ключ в настройках', true);
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
$('#lib-seg').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  libMode = b.dataset.v;
  $$('#lib-seg button').forEach(x => x.classList.toggle('on', x === b));
  $('#lib-filter').hidden = libMode === 'playlists';
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
function renderLib(){
  const c = $('#lib-list');
  if (libMode === 'playlists'){
    const pls = state.playlists;
    let html = pls.map(p => `<div class="row-t" data-pll="${esc(p.id)}">
      <div class="thumb" style="border-radius:14px;background:var(--grad);display:grid;place-items:center;color:#fff">
        <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
      </div>
      <div class="t-info"><div class="t-title">${esc(p.name)}</div><div class="t-artist">${p.items.length} тр.</div></div>
    </div>`).join('');
    c.innerHTML = '<button class="chip on" id="newpl" style="margin:0 0 12px">＋ Новый плейлист</button>' + html +
      (pls.length ? '' : emptyState('Пока пусто', 'Создайте плейлист и добавляйте треки кнопкой «+ Список» в плеере'));
    c._list = [];
    return;
  }
  const list = libFiltered((libMode === 'likes' ? state.likes : state.history).slice());
  renderList(c, list);
  if (!list.length && libFilterQ) c.innerHTML = emptyState('Ничего', 'По запросу «' + libFilterQ + '» в списке нет совпадений');
  if (!list.length && !libFilterQ){
    c.innerHTML = emptyState(
      libMode === 'likes' ? 'Пока пусто' : 'История пуста',
      libMode === 'likes' ? 'Нажимайте на сердечко у треков — они появятся здесь' : 'Здесь появятся треки, которые вы слушали');
  }
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
function showScreen(s){
  curScreen = s;
  $$('.screen').forEach(el => el.classList.toggle('active', el.id === 'scr-' + s));
  $$('.tab').forEach(b => b.classList.toggle('on', b.dataset.s === s));
  if (s === 'discover' && !discoverState.loaded){ discoverState.loaded = true; loadDiscover(true); }
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
    const i = TABS.indexOf(curScreen);
    if (i < 0) return;
    const ni = Math.max(0, Math.min(TABS.length - 1, i + (dx < 0 ? 1 : -1)));
    if (ni !== i){ haptic(0); showScreen(TABS[ni]); }
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
$('#np-radio').addEventListener('click', () => {
  state.autoRelated = !state.autoRelated;
  LS.set('autorel', state.autoRelated);
  $('#np-radio').classList.toggle('on', state.autoRelated);
  const opt = $('#opt-auto'); if (opt) opt.checked = state.autoRelated;
  toast(state.autoRelated ? 'Радио: похожие будут играть автоматически' : 'Радио выключено');
});
$('#np-shuffle').addEventListener('click', () => {
  state.shuffle = !state.shuffle; LS.set('shuffle', state.shuffle);
  $('#np-shuffle').classList.toggle('on', state.shuffle);
  toast(state.shuffle ? 'Перемешивание включено' : 'Перемешивание выключено');
});
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
  if (!P.q.length){ c.innerHTML = '<div class="empty"><b>Очередь пуста</b><p>Выберите трек в поиске или обзоре</p></div>'; return; }
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
$('#np-queue').addEventListener('click', () => openSheet('Очередь'));
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
$('#np-eq').addEventListener('click', () => {
  const i = (EQ_ORDER.indexOf(state.eq) + 1) % EQ_ORDER.length;
  state.eq = EQ_ORDER[i];
  LS.set('eq', state.eq);
  const b = $('#np-eq');
  b.textContent = state.eq === 'flat' ? 'EQ' : state.eq[0].toUpperCase() + state.eq.slice(1);
  b.classList.toggle('on', state.eq !== 'flat');
  if (viz.ctx && !viz.broken && viz.eqLow){ applyEQ(state.eq); toast('EQ: ' + ({flat:'Flat',bass:'Bass',vocal:'Vocal',treble:'Treble'})[state.eq]); }
  else toast('EQ работает при включённом визуализаторе');
});

let sleepMode = 0, sleepTimerT = null, sleepFadeI = null;
function resetSleep(msg){
  clearTimeout(sleepTimerT); clearInterval(sleepFadeI);
  sleepTimerT = null; sleepFadeI = null; sleepMode = 0;
  audio.volume = 1;
  const b = $('#np-timer');
  b.textContent = 'Таймер'; b.classList.remove('on');
  if (msg) toast(msg);
}
$('#np-timer').addEventListener('click', () => {
  const steps = [0, 15, 30, 60, 'end'];
  const cur = steps.indexOf(sleepMode);
  const nx = steps[(cur + 1) % steps.length];
  clearTimeout(sleepTimerT); clearInterval(sleepFadeI); sleepTimerT = null; sleepFadeI = null;
  sleepMode = 0; audio.volume = 1;
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
    const head = `<div class="art-head">
        <img class="art-ava" decoding="async" src="${esc(a.art) || PLACEHOLDER}" onerror="this.onerror=null;this.src=PLACEHOLDER">
        <div style="min-width:0">
          <div class="art-name">${esc(a.name)}</div>
          <div class="art-sub">${a.followers ? a.followers.toLocaleString('ru') + ' подписчиков' : ''}</div>
        </div>
      </div>${a.desc ? `<p class="note" style="margin:-6px 0 14px">${esc(a.desc)}</p>` : ''}`;
    const body = $('#page-body');
    body._list = a.tracks;
    body.innerHTML = head +
      (a.tracks.length ? `<button class="playall" id="pa">▶ Слушать всё (${a.tracks.length})</button>` : '') +
      a.tracks.map((t, i) => trackRow(t, i, 0)).join('') || '';
    const pa = $('#pa');
    if (pa) pa.addEventListener('click', () => playList(a.tracks, 0, a.name));
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
      (list.length ? `<button class="playall" id="pa">▶ Слушать (${list.length})</button>` : emptyState('Пусто', 'В плейлисте нет доступных треков')) +
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
    `<button class="playall" id="pa">▶ Слушать (${pl.items.length})</button>` +
    (pl.items.length ? pl.items.map((t, i) => trackRow(t, i, 0)).join('') : emptyState('Пусто', 'Добавьте треки кнопкой «+ Список» в плеере')) +
    `<button class="btn danger" id="pl-del">Удалить плейлист</button>`);
  const pa = $('#pa');
  if (pa) pa.addEventListener('click', () => playList(pl.items.slice(), 0, pl.name));
  $('#pl-del').addEventListener('click', () => {
    state.playlists = state.playlists.filter(p => p.id !== pid);
    LS.set('playlists', state.playlists);
    closePage(); renderLib(); toast('Плейлист удалён');
  });
  updatePlayingRows();
}
$('#page-body').addEventListener('click', e => {
  if (e.target.closest('[data-uid]')){ openArtist(+e.target.closest('[data-uid]').dataset.uid); return; }
  if (e.target.closest('#pa') || e.target.closest('#pl-del')) return;
  const h = e.target.closest('[data-like]');
  if (h){ toggleLike(+h.dataset.like); return; }
  const r = e.target.closest('.row-t'); if (!r) return;
  const list = $('#page-body')._list || [];
  const i = +r.dataset.i;
  if (list[i]) playList(list, i, $('#page-title').textContent);
});

function openStats(){
  const s = state.stats || {sec:0, art:{}, day:{}};
  const hours = (s.sec || 0) / 3600;
  const now = Date.now();
  let week = 0;
  for (let i = 0; i < 7; i++){
    const d = new Date(now - i * 86400000).toISOString().slice(0, 10);
    week += (s.day && s.day[d]) || 0;
  }
  const arts = Object.entries(s.art || {}).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const max = arts.length ? arts[0][1] : 1;
  openPage('Статистика', `
    <div class="stat-grid">
      <div class="stat-card"><div class="stat-num">${hours < 100 ? hours.toFixed(1) : Math.round(hours)} ч</div><div class="stat-lbl">всего прослушано</div></div>
      <div class="stat-card"><div class="stat-num">${(week / 3600).toFixed(1)} ч</div><div class="stat-lbl">за последние 7 дней</div></div>
      <div class="stat-card"><div class="stat-num">${s.tracks || 0}</div><div class="stat-lbl">треков проиграно</div></div>
      <div class="stat-card"><div class="stat-num">${state.likes.length}</div><div class="stat-lbl">в любимых</div></div>
    </div>
    <div class="card" style="margin-top:0">
      <div class="row" style="justify-content:flex-start"><b>Топ артистов</b></div>
      ${arts.length ? arts.map(([n, sec]) => `<div class="stat-row">
        <div class="stat-name">${esc(n)}<span>${(sec / 3600).toFixed(1)} ч</span></div>
        <div class="stat-bar"><div class="stat-fill" style="width:${Math.max(4, sec / max * 100)}%"></div></div>
      </div>`).join('') : '<p class="note" style="margin-top:8px">Послушайте пару треков — здесь появится статистика</p>'}
    </div>`);
}
$('#open-stats').addEventListener('click', openStats);

$('#data-export').addEventListener('click', () => {
  const data = JSON.stringify({v:1, likes: state.likes, playlists: state.playlists, history: state.history,
    stats: state.stats, settings: {accent: state.accent, amoled: state.amoled, autoRelated: state.autoRelated, fullOnly: state.fullOnly}});
  openSheet('Экспорт данных',
    `<div class="field"><textarea id="exp-ta" readonly>${esc(data)}</textarea></div>
     <div class="btnrow"><button class="btn" id="exp-copy">Скопировать</button><button class="btn" id="exp-share">Поделиться</button></div>`);
  $('#exp-ta').addEventListener('focus', e => e.target.select());
  $('#exp-copy').onclick = () => { navigator.clipboard && navigator.clipboard.writeText(data); closeSheet(); toast('Скопировано в буфер'); };
  $('#exp-share').onclick = () => { navigator.share ? navigator.share({text: data}).catch(()=>{}) : toast('Копирование недоступно'); };
});
$('#data-import').addEventListener('click', () => {
  openSheet('Импорт данных',
    `<div class="field"><textarea id="imp-ta" placeholder="Вставьте сюда строку экспорта"></textarea></div>
     <div class="btnrow"><button class="btn" id="imp-go">Импортировать</button></div>`);
  $('#imp-go').onclick = () => {
    try {
      const j = JSON.parse($('#imp-ta').value);
      if (!j || !Array.isArray(j.likes)) throw new Error('неверный формат');
      const ids = new Set(state.likes.map(x => x.id));
      state.likes = j.likes.filter(x => x && x.id && !ids.has(x.id)).concat(state.likes);
      if (Array.isArray(j.playlists)) state.playlists = j.playlists.concat(state.playlists);
      if (Array.isArray(j.history)) state.history = j.history.concat(state.history.filter(h => !j.history.some(x => x.id === h.id))).slice(0, 100);
      if (j.stats) state.stats = j.stats;
      if (j.settings){ Object.assign(state, j.settings); LS.set('accent', state.accent); LS.set('amoled', state.amoled); applyTheme(); }
      LS.set('likes', state.likes); LS.set('playlists', state.playlists); LS.set('history', state.history); LS.set('stats', state.stats);
      closeSheet(); toast('Импортировано'); renderLib();
    } catch (e) { toast('Ошибка импорта: неверные данные'); }
  };
});

const lyrCache = {};
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
let lyrLines = [], lyrActive = -1, lyrOpenTrack = 0;
function resetLyrics(){ lyrLines = []; lyrActive = -1; lyrOpenTrack = 0; }
$('#np-lyrics').addEventListener('click', async () => {
  const t = current(); if (!t) return;
  $('#lyr-t').textContent = t.title;
  $('#lyr-a').textContent = t.artist;
  $('#lyr-body').innerHTML = Array.from({length: 10}, () => '<div class="sk-line"></div>').join('');
  $('#lyr').classList.add('open');
  lyrOpenTrack = t.id;
  const lrc = await fetchLyrics(t);
  if (lyrOpenTrack !== t.id) return;
  const body = $('#lyr-body');
  if (lrc.synced){
    lyrLines = parseLRC(lrc.synced);
    body.innerHTML = lyrLines.map((l, i) => `<div class="lyr-line" data-lt="${l.t}" data-li="${i}">${esc(l.text)}</div>`).join('');
  } else if (lrc.plain){
    lyrLines = [];
    body.innerHTML = lrc.plain.split('\n').map(line => `<div class="lyr-line${line.trim() ? '' : ' past'}" style="pointer-events:none">${esc(line) || '&nbsp;'}</div>`).join('');
  } else {
    body.innerHTML = '<div class="lyr-msg">Текст не найден.<br>База лирики покрывает не все треки — попробуйте поискать вручную или послушать что-то ещё 🎧</div>';
  }
});
$('#lyr-x').addEventListener('click', () => $('#lyr').classList.remove('open'));
$('#lyr-body').addEventListener('click', e => {
  const ln = e.target.closest('[data-lt]'); if (!ln) return;
  audio.currentTime = +ln.dataset.lt; nativeNP();
});
function updateLyrics(){
  if (!lyrLines.length || !$('#lyr').classList.contains('open')) return;
  const ct = audio.currentTime;
  let idx = -1;
  for (let i = 0; i < lyrLines.length; i++){ if (lyrLines[i].t <= ct) idx = i; else break; }
  if (idx === lyrActive) return;
  lyrActive = idx;
  const lines = $('#lyr-body').children;
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
$('#accents').innerHTML = Object.entries(ACCENTS).map(([k, v]) =>
  `<button class="chip${state.accent === k ? ' on' : ''}" data-ac="${k}" style="background:${k === state.accent ? '' : `linear-gradient(135deg,${v[0]},${v[1]})`};${k === state.accent ? '' : 'border-color:transparent'}">${({orange:'Оранж',green:'Зелёный',blue:'Синий',pink:'Розовый',purple:'Фиолет',teal:'Бирюз',sunset:'Закат',mint:'Мятн'})[k]}</button>`).join('');
$('#accents').addEventListener('click', e => {
  const b = e.target.closest('[data-ac]'); if (!b) return;
  state.accent = b.dataset.ac; LS.set('accent', state.accent); applyTheme();
  $$('#accents .chip').forEach(c => {
    const k = c.dataset.ac, v = ACCENTS[k];
    c.classList.toggle('on', k === state.accent);
    c.style.background = k === state.accent ? '' : `linear-gradient(135deg,${v[0]},${v[1]})`;
    c.style.borderColor = k === state.accent ? '' : 'transparent';
  });
  haptic(0);
  toast('Акцент обновлён');
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
$('#clr-hist').addEventListener('click', () => { state.history = []; LS.set('history', []); if (curScreen === 'library') renderLib(); toast('История очищена'); });
$('#clr-likes').addEventListener('click', () => {
  if (!confirm('Удалить все любимые треки?')) return;
  state.likes = []; LS.set('likes', []);
  if (curScreen === 'library') renderLib();
  const t = current(); if (t) syncHearts(t.id);
  toast('Список очищен');
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

document.addEventListener('keydown', e => {
  if (e.code === 'Space' && !e.target.closest('input, textarea')){ e.preventDefault(); toggle(); }
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
  $('#np-radio').classList.toggle('on', state.autoRelated);
  $('#np-vizm').textContent = VIZ_MODES[state.vizMode];
  $('#np-vizm').classList.toggle('on', state.vizMode !== 0);
  $('#np-eq').textContent = state.eq === 'flat' ? 'EQ' : state.eq[0].toUpperCase() + state.eq.slice(1);
  $('#np-eq').classList.toggle('on', state.eq !== 'flat');
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
  apiGet('/search/tracks', { q: 'test', limit: 1 })
    .then(() => { cidState = 'ok'; updateCidUI(); })
    .catch(() => { cidState = 'err'; updateCidUI(); });
})();
