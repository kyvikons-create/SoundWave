const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO = 'kyvikons-create/SoundWave';
const TAG = process.argv[2] || 'v3.3';
const NAME = process.argv[3] || 'SoundWave 3.3';

const cred = execFileSync('C:\\Program Files\\Git\\cmd\\git.exe', ['credential', 'fill'],
  { input: 'protocol=https\nhost=github.com\n' }).toString();
const token = (cred.match(/^password=(.+)$/m) || [])[1];
if (!token) throw new Error('токен не получен');

const H = { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'User-Agent': 'sw-release' };
const api = async (url, opts = {}) => {
  const r = await fetch(url, { ...opts, headers: { ...H, ...(opts.headers || {}) } });
  if (!r.ok) throw new Error(url.split('?')[0] + ' -> ' + r.status + ' ' + (await r.text()).slice(0, 300));
  return r;
};

(async () => {
  await new Promise(r => setTimeout(r, 20000));
  const runs = await (await api(`https://api.github.com/repos/${REPO}/actions/runs?per_page=15`)).json();
  let ok = (runs.workflow_runs || []).find(r => r.conclusion === 'success' && r.head_sha.startsWith('e670d11'));
  if (!ok) ok = (runs.workflow_runs || []).find(r => r.conclusion === 'success' && r.head_branch === 'main');
  if (!ok) throw new Error('нет успешной сборки от свежего коммита');
  console.log('сборка:', ok.head_sha.slice(0, 7), new Date(ok.updated_at).toLocaleString('ru'));

  const arts = await (await api(`https://api.github.com/repos/${REPO}/actions/runs/${ok.id}/artifacts`)).json();
  const art = (arts.artifacts || []).find(a => a.name === 'SoundWave-ipa');
  if (!art || art.expired) throw new Error('артефакт не найден/истёк');

  const zipBuf = Buffer.from(await (await api(`https://api.github.com/repos/${REPO}/actions/artifacts/${art.id}/zip`)).arrayBuffer());
  const dir = path.join(__dirname, 'rel-tmp');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir);
  fs.writeFileSync(path.join(dir, 'a.zip'), zipBuf);
  execSync('tar -xf a.zip', { cwd: dir });
  const ipa = path.join(dir, 'SoundWave.ipa');
  if (!fs.existsSync(ipa)) throw new Error('нет ipa в архиве');
  console.log('ipa готов:', (fs.statSync(ipa).size / 1024).toFixed(0), 'КБ');

  const body = [
    'музыкальный плеер для soundcloud под ios.',
    '',
    '**новое в 3.3:**',
    '- каре-карусели в обзоре',
    '- share-карточка трека (картинка с обложкой, сохраняется в Фото)',
    '- альтернативные иконки приложения: синяя, розовая, зелёная',
    '- свайпы между вкладками',
    '- перетаскивание треков в очереди (зажать строку)',
    '- ускорение 2x долгим удержанием кнопки play',
    '- опция «не гасить экран» при открытом плеере',
    '- вибро-отклик на действия',
    '- поиск по любимым и истории',
    '- «мой микс» — радио из любимых треков',
    '- заготовка десктоп-версии в папке desktop (electron)',
    '',
    '**как ставить:**',
    '1. скачать SoundWave.ipa ниже',
    '2. установить через [sideloadly](https://sideloadly.io) со своим apple id (бесплатный — переподпись раз в 7 дней)',
    '3. настройки -> основные -> vpn и управление устройствами -> доверять профилю',
    '',
    'минимум ios 15, тестировалось на ios 18. неофициальный клиент для личного использования.'
  ].join('\n');

  const rel = await (await api(`https://api.github.com/repos/${REPO}/releases`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tag_name: TAG, target_commitish: 'main', name: NAME, body })
  })).json();
  console.log('релиз:', rel.html_url);

  const up = await (await api(`https://uploads.github.com/repos/${REPO}/releases/${rel.id}/assets?name=SoundWave.ipa`, {
    method: 'POST', headers: { 'Content-Type': 'application/octet-stream' },
    body: fs.readFileSync(ipa)
  })).json();
  console.log('ipa приложен:', upj_safe(up));
  function upj_safe(u){ return u.browser_download_url || JSON.stringify(u).slice(0,200); }
  fs.rmSync(dir, { recursive: true, force: true });
})().catch(e => { console.error('ОШИБКА:', e.message); process.exit(1); });
