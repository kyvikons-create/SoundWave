const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('__swNativeFetch', async url => {
  const r = await ipcRenderer.invoke('sw-fetch', url);
  return { status: r.status, text: r.text, err: r.err };
});
