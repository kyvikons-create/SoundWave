const { execFileSync } = require('child_process');
const fs = require('fs');
const { execSync } = require('child_process');
const REPO = 'kyvikons-create/SoundWave';
const SHA = process.argv[2];
const cred = execFileSync('C:\\Program Files\\Git\\cmd\\git.exe', ['credential', 'fill'],
  { input: 'protocol=https\nhost=github.com\n' }).toString();
const token = (cred.match(/^password=(.+)$/m) || [])[1];
const H = { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'User-Agent': 'sw' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  let run = null;
  for (let i = 0; i < 36; i++) {
    const runs = await (await fetch(`https://api.github.com/repos/${REPO}/actions/runs?per_page=10`, { headers: H })).json();
    run = (runs.workflow_runs || []).find(r => r.head_sha.startsWith(SHA));
    if (run && run.status === 'completed') break;
    run = null;
    await sleep(15000);
  }
  if (!run) { console.log('RESULT: не дождались'); process.exit(1); }
  console.log('RESULT статус:', run.conclusion, run.html_url);
  const lr = await fetch(`https://api.github.com/repos/${REPO}/actions/runs/${run.id}/logs`, { headers: H });
  if (!lr.ok) process.exit(run.conclusion === 'success' ? 0 : 1);
  fs.writeFileSync('logs.zip', Buffer.from(await lr.arrayBuffer()));
  fs.rmSync('logs', { recursive: true, force: true });
  fs.mkdirSync('logs');
  try { execSync('tar -xf logs.zip -C logs'); } catch {}
  const f = 'logs/build/3_Build SoundWave.ipa.txt';
  if (fs.existsSync(f)) {
    const t = fs.readFileSync(f, 'utf8');
    console.log('widget:', t.includes('widget extension встроен') ? 'ВСТРОЕН' : (t.includes('не собрался') ? 'ПРОВАЛ' : '?'));
    console.log('bridge:', t.includes('swift bridge не собрался') ? 'ПРОВАЛ' : 'ok');
    const ipa = (t.match(/SoundWave\.ipa\s+(\d+)/) || [])[1];
    console.log('ipa байт:', ipa);
  }
  fs.rmSync('logs', { recursive: true, force: true });
  fs.unlinkSync('logs.zip');
})().catch(e => console.log('ERR', e.message));
