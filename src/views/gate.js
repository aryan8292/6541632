// @ts-check
import { svg } from '../lib/icons.js';
import { store } from '../core/store.js';

export function showOpenFromTelegram() {
  document.body.innerHTML = `<div id="gate"><div class="g-ic">${svg('bag')}</div>
    <h2>Open from Telegram</h2>
    <p>Please launch this app using the button inside the bot chat.</p></div>`;
}

export function showSessionGate() {
  if (store.get('sessionDead')) return;
  store.set({ sessionDead: true });
  try { sessionStorage.removeItem('mtk'); } catch {}
  try { localStorage.removeItem('mtk'); } catch {}
  document.body.innerHTML = `<div id="gate"><div class="g-ic">${svg('bag')}</div>
    <h2>Session expired</h2>
    <p>Please re-open this app from the button inside the bot chat.</p></div>`;
}