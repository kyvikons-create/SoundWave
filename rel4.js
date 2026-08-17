const { execFileSync, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const REPO = 'kyvikons-create/SoundWave';
const SHA = '4833924';
const TAG = 'v3.4';

const cred = execFileSync('C:\\Program Files\\Git\\cmd\\git.exe', ['credential', 'fill'],
  { input: 'protocol=https\nhost=github.com\n' }).toString();
const token = (cred.match(/^password=(.+)$/m) || [])[1];
const H = { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'User-Agent': 'sw' };
const api = async (url, opts = {}) => {
  const r = await fetch(url, { ...opts, headers: { ...H, ...(opts.headers || {}) } });
  if (!r.ok && r.status !== 302) throw new Error(url.split('?')[0] + ' -> ' + r.status + ' ' + (await r.text()).slice(0, 200));
  return r;
};

(async () => {
  const runs = await (await api(`https://api.github.com/repos/${REPO}/actions/runs?per_page=10`)).json();
  const run = (runs.workflow_runs || []).find(r => r.head_sha.startsWith(SHA) && r.conclusion === 'success');
  if (!run) throw new Error('нет успешной сборки ' + SHA);
  const arts = await (await api(`https://api.github.com/repos/${REPO}/actions/runs/${run.id}/artifacts`)).json();
  const art = (arts.artifacts || []).find(a => a.name === 'SoundWave-ipa' && !a.expired);
  if (!art) throw new Error('нет артефакта');

  const zipBuf = Buffer.from(await (await api(`https://api.github.com/repos/${REPO}/actions/artifacts/${art.id}/zip`)).arrayBuffer());
  const dir = path.join(__dirname, 'rel-tmp');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir);
  fs.writeFileSync(path.join(dir, 'a.zip'), zipBuf);
  execSync('tar -xf a.zip', { cwd: dir });
  const ipa = path.join(dir, 'SoundWave.ipa');
  if (!fs.existsSync(ipa)) throw new Error('нет ipa');
  console.log('ipa:', (fs.statSync(ipa).size / 1024).toFixed(0), 'КБ');

  const body = [
    '**главное в этой версии — исправлен фоновый звук:**',
    '- возвращён media session для webkit (из-за его потери музыка останавливалась при выходе из приложения)',
    '- аудиосессия переподтверждается при каждом запуске воспроизведения и при уходе из приложения',
    '- обложка на экран блокировки больше не перекачивается каждые 5 секунд',
    '',
    'плюс всё из 3.3: каре в обзоре, share-карточки, иконки на выбор, свайпы вкладок, reorder очереди, 2x лонг-тап, wake lock, вибро, поиск по своим, мой микс. десктоп-версия переехала в отдельный репозиторий [SoundWave-Desktop](https://github.com/kyvikons-create/SoundWave-Desktop) (tauri).',
    '',
    '**установка:** скачать SoundWave.ipa ниже -> [sideloadly](https://sideloadly.io) со своим apple id -> доверять профиль. старую версию удалить.'
  ].join('\n');

  let rel;
  try {
    rel = await (await api(`https://api.github.com/repos/${REPO}/releases/tags/${TAG}`)).json();
  } catch { rel = null; }
  if (!rel || !rel.id) {
    rel = await (await api(`https://api.github.com/repos/${REPO}/releases`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag_name: TAG, target_commitish: 'main', name: 'SoundWave 3.4 — фикс фонового звука', body })
    })).json();
  } else {
    for (const a of rel.assets || []) await api(`https://api.github.com/repos/${REPO}/releases/assets/${a.id}`, { method: 'DELETE' });
  }
  if (!rel.id) throw new Error('релиз не создан: ' + JSON.stringify(rel).slice(0, 150));
  console.log('релиз:', rel.html_url);

  const up = await (await api(`https://uploads.github.com/repos/${REPO}/releases/${rel.id}/assets?name=SoundWave.ipa`, {
    method: 'POST', headers: { 'Content-Type': 'application/octet-stream' },
    body: fs.readFileSync(ipa)
  })).json();
  console.log('ipa приложен:', up.browser_download_url, (up.size / 1024).toFixed(0), 'КБ');
  fs.rmSync(dir, { recursive: true, force: true });
})().catch(e => { console.error('ОШИБКА:', e.message); process.exit(1); });
