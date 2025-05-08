import clipboardListener from 'clipboard-event';
import { win, hideApp, focusAppToTop } from "./mainWindow.ts";

export function initClipboard() {
  clipboardListener.startListening();
  console.log('clipboardListener started');
  clipboardListener.on('change', (e) => {
    console.log(e);
    win?.webContents.send('clipboard-change', e.text);
  })
}