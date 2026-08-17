const { app, BrowserWindow, ipcMain } = require('electron');
const https = require('https');
const path = require('path');

let win = null;

function fetchDirect(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
        Accept: '*/*'
      },
      timeout: 15000
    }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchDirect(res.headers.location).then(resolve, reject);
        return;
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, text: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}

ipcMain.handle('sw-fetch', async (e, url) => {
  try { return await fetchDirect(url); }
  catch (err) { return { status: 0, text: '', err: String(err.message || err) }; }
});

function createWindow() {
  win = new BrowserWindow({
    width: 420,
    height: 820,
    minWidth: 360,
    minHeight: 560,
    backgroundColor: '#08080d',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.loadFile(path.join(__dirname, '..', 'index.html'));
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
