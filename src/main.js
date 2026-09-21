// @ts-check
import { api, getToken } from './core/api.js';
import { rcSet } from './core/cache.js';
import { store } from './core/store.js';
import { renderNav, switchTab } from './views/nav.js';
import { renderAccount } from './views/account.js';
import { showOpenFromTelegram } from './views/gate.js';
import { resumePending } from './views/checkout.js';
import './views/address.js';
import './views/search.js';
import './views/cart.js';
import './views/orders.js';
import './views/order-detail.js';

// --------------------------------------------------
// Browser mode
// Open the website with:
// https://YOUR-DOMAIN.vercel.app/?web=1
// --------------------------------------------------
const urlParams = new URLSearchParams(window.location.search);
const BROWSER_MODE = urlParams.get('web') === '1';

// Make it available to other frontend code if needed.
window.__BROWSER_MODE = BROWSER_MODE;

// --------------------------------------------------
// Service worker
// --------------------------------------------------
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

// --------------------------------------------------
// Startup
// --------------------------------------------------
// Normal Telegram mode still requires a token.
// Browser mode skips the Telegram token gate.
if (BROWSER_MODE || getToken()) {
  boot();
} else {
  showOpenFromTelegram();
}

// --------------------------------------------------
// Main application boot
// --------------------------------------------------
async function boot() {
  initTelegram();

  renderNav();

  // Load address.
  const addrP = api('/api/address')
    .then(r => {
      if (r?.ok) {
        rcSet('address', r);
      }
      return r;
    })
    .catch(() => null);

  // Load session and pending checkout.
  const [s, pr] = await Promise.all([
    api('/api/session'),
    api('/api/pending').catch(() => null)
  ]);

  if (s?.ok) {
    setChip(s.accounts);

    if (typeof s.my_referral === 'string') {
      store.set({ myRef: s.my_referral });
    }

    if (s.last_phone) {
      store.set({ selPhone: s.last_phone });
    }
  }

  if (pr?.ok && pr.pending?.length) {
    await renderAccount();
    resumePending(pr.pending[0]);
    return;
  }

  if (s?.ok && s.cart_count > 0 && s.cart_phone) {
    store.set({ selPhone: s.cart_phone });
    switchTab('cart', true);
    return;
  }

  renderAccount();
}

// --------------------------------------------------
// Telegram initialization
// --------------------------------------------------
function initTelegram() {
  try {
    const w = window.Telegram?.WebApp;

    // In normal browser mode Telegram does not exist.
    // That's okay.
    if (!w) return;

    w.ready();
    w.expand();
    w.setHeaderColor?.('#C21876');
  } catch {}
}

// --------------------------------------------------
// Header account chip
// --------------------------------------------------
function setChip(n) {
  const c = document.getElementById('hdr-chip');

  if (!c) return;

  if ((n || 0) <= 0) {
    c.classList.add('hide');
    return;
  }

  c.classList.remove('hide');
  c.textContent = String(n);
}

// --------------------------------------------------
// Global helpers used by onclick handlers
// --------------------------------------------------
import('./lib/format.js').then(m => {
  window.__num = m.num;
  window.__money = m.money;
  window.__esc = m.esc;
});
