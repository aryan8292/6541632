// @ts-check
import { svg } from '../lib/icons.js';
import { store } from '../core/store.js';

// --------------------------------------------------
// Detect browser mode
// --------------------------------------------------
const isBrowserMode = () => {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('web') === '1';
  } catch {
    return false;
  }
};

// --------------------------------------------------
// Telegram gate
// --------------------------------------------------
export function showOpenFromTelegram() {
  // Never show the Telegram gate in browser mode.
  if (isBrowserMode()) return;

  document.body.innerHTML = `
    <div id="gate">
      <div class="g-ic">${svg('bag')}</div>

      <h2>Open from Telegram</h2>

      <p>
        Please launch this app using the button inside the bot chat.
      </p>
    </div>
  `;
}

// --------------------------------------------------
// Session expired gate
// --------------------------------------------------
export function showSessionGate() {
  if (store.get('sessionDead')) return;

  store.set({ sessionDead: true });

  try {
    sessionStorage.removeItem('mtk');
  } catch {}

  try {
    localStorage.removeItem('mtk');
  } catch {}

  // Browser mode gets a browser-friendly message.
  if (isBrowserMode()) {
    document.body.innerHTML = `
      <div id="gate">
        <div class="g-ic">${svg('bag')}</div>

        <h2>Session unavailable</h2>

        <p>
          The application could not establish a backend session.
          Please refresh the page or sign in using the available
          browser authentication method.
        </p>

        <button
          type="button"
          onclick="location.reload()"
          style="margin-top:16px"
        >
          Refresh
        </button>
      </div>
    `;

    return;
  }

  document.body.innerHTML = `
    <div id="gate">
      <div class="g-ic">${svg('bag')}</div>

      <h2>Session expired</h2>

      <p>
        Please re-open this app from the button inside the bot chat.
      </p>
    </div>
  `;
}
