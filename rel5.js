const { execFileSync, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const REPO = 'kyvikons-create/SoundWave';
const SHA = process.argv[2];
const TAG = process.argv[3] || 'v3.5';
const NAME = process.argv[4] || 'SoundWave 3.5';

const cred = execFileSync('C:\\Program Files\\Git\\cmd\\git.exe', ['credential', 'fill'],
  { input: 'protocol=https\nhost=github.com\n' }).toString();
const token = (cred.match(/^password=(.+)$/m) || [])[1];
const H = { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'User-Agent': 'sw' };
const api = async (url, opts = {}) => {
  const r = await fetch(url, { ...opts, headers: { ...H, ...(opts.headers || {}) } });
  if (!r.ok && r.status !== 302) throw new Error(url.split('?')[0] + ' -> ' + r.status);
  return r;
};
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  let run = null;
  for (let i = 0; i < 36; i++) {
    const runs = await (await api(`https://api.github.com/repos/${REPO}/actions/runs?per_page=10`)).json();
    run = (runs.workflow_runs || []).find(r => r.head_sha.startsWith(SHA));
    if (run && run.status === 'completed') break;
    run = null;
    await sleep(15000);
  }
  if (!run) throw new Error('не дождались сборки');
  console.log('статус:', run.conclusion);
  if (run.conclusion !== 'success') throw new Error('сборка упала: ' + run.html_url);

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
    '**звук теперь играет нативный avplayer — музыка в фоне работает как в обычных приложениях.**',
    '',
    'это главное изменение версии: раньше аудио жило внутри веб-просмотра и ios могла его замораживать при выходе из приложения. теперь плеер настоящий, системный: фон, экран блокировки, наушники, перемотка с островка.',
    '',
    '**установка:** удалить старую версию -> поставить SoundWave.ipa через [sideloadly](https://sideloadly.io) -> доверять профиль.',
    '',
    'неофициальный клиент soundcloud для личного использования, минимум ios 15.'
  ].join('\n');

  let rel = null;
  try { rel = await (await api(`https://api.github.com/repos/${REPO}/releases/tags/${TAG}`)).json(); } catch {}
  if (!rel || !rel.id) {
    rel = await (await api(`https://api.github.com/repos/${REPO}/releases`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag_name: TAG, target_commitish: 'main', name: NAME, body })
    })).json();
  } else {
    for (const a of rel.assets || []) await api(`https://api.github.com/repos/${REPO}/releases/assets/${a.id}`, { method: 'DELETE' });
  }
  if (!rel.id) throw new Error('релиз не создан');
  console.log('релиз:', rel.html_url);

  const up = await (await api(`https://uploads.github.com/repos/${REPO}/releases/${rel.id}/assets?name=SoundWave.ipa`, {
    method: 'POST', headers: { 'Content-Type': 'application/octet-stream' },
    body: fs.readFileSync(ipa)
  })).json();
  console.log('ipa приложен:', up.browser_download_url, (up.size / 1024).toFixed(0), 'КБ');
  fs.rmSync(dir, { recursive: true, force: true });
})().catch(e => { console.error('ОШИБКА:', e.message); process.exit(1); });
