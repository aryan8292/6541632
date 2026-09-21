// @ts-check
import { store } from './store.js';

export function openSheet(html) {
  store.state.sheetOpen = true;
  document.getElementById('sheet-body').innerHTML = html;
  document.getElementById('mask').classList.add('show');
  requestAnimationFrame(() => document.getElementById('sheet').classList.add('show'));
}

export function closeSheet() {
  store.state.sheetOpen = false;
  if (typeof window.stopQrPoll === 'function') window.stopQrPoll();
  document.getElementById('sheet').classList.remove('show');
  document.getElementById('mask').classList.remove('show');
}

window.closeSheet = closeSheet;
