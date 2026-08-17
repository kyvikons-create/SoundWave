const { execFileSync, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REPO = 'kyvikons-create/SoundWave';
const SHA = 'e670d11';
const TAG = 'v3.3';

const cred = execFileSync('C:\\Program Files\\Git\\cmd\\git.exe', ['credential', 'fill'],
  { input: 'protocol=https\nhost=github.com\n' }).toString();
const token = (cred.match(/^password=(.+)$/m) || [])[1];
if (!token) throw new Error('токен не получен');

const H = { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'User-Agent': 'sw-release' };
const api = async (url, opts = {}) => {
  const r = await fetch(url, { ...opts, headers: { ...H, ...(opts.headers || {}) } });
  if (!r.ok && r.status !== 302) throw new Error(url.split('?')[0] + ' -> ' + r.status);
  return r;
};
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  let run = null;
  for (let i = 0; i < 40; i++) {
    const runs = await (await api(`https://api.github.com/repos/${REPO}/actions/runs?per_page=10`)).json();
    run = (runs.workflow_runs || []).find(r => r.head_sha.startsWith(SHA));
    if (run && run.status === 'completed') break;
    run = null;
    await sleep(15000);
  }
  if (!run) throw new Error('сборка ' + SHA + ' не завершилась');
  if (run.conclusion !== 'success') throw new Error('сборка завершилась с: ' + run.conclusion);
  console.log('свежая сборка готова:', run.head_sha.slice(0, 7));

  const arts = await (await api(`https://api.github.com/repos/${REPO}/actions/runs/${run.id}/artifacts`)).json();
  const art = (arts.artifacts || []).find(a => a.name === 'SoundWave-ipa' && !a.expired);
  if (!art) throw new Error('артефакт не найден');

  const zipBuf = Buffer.from(await (await api(`https://api.github.com/repos/${REPO}/actions/artifacts/${art.id}/zip`)).arrayBuffer());
  const dir = path.join(__dirname, 'rel-tmp');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir);
  fs.writeFileSync(path.join(dir, 'a.zip'), zipBuf);
  execSync('tar -xf a.zip', { cwd: dir });
  const ipa = path.join(dir, 'SoundWave.ipa');
  if (!fs.existsSync(ipa)) throw new Error('нет ipa');
  const size = fs.statSync(ipa).size;
  console.log('новый ipa:', (size / 1024).toFixed(0), 'КБ');
  if (size < 50000) throw new Error('подозрительно маленький ipa — похоже, иконки не попали в сборку');

  const rel = await (await api(`https://api.github.com/repos/${REPO}/releases/tags/${TAG}`)).json();
  for (const a of rel.assets || []) {
    await api(`https://api.github.com/repos/${REPO}/releases/assets/${a.id}`, { method: 'DELETE' });
    console.log('старый файл удалён');
  }
  const up = await (await api(`https://uploads.github.com/repos/${REPO}/releases/${rel.id}/assets?name=SoundWave.ipa`, {
    method: 'POST', headers: { 'Content-Type': 'application/octet-stream' },
    body: fs.readFileSync(ipa)
  })).json();
  console.log('новый ipa в релизе:', up.browser_download_url, (up.size / 1024).toFixed(0), 'КБ');
  fs.rmSync(dir, { recursive: true, force: true });
})().catch(e => { console.error('ОШИБКА:', e.message); process.exit(1); });
