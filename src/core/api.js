// @ts-check
import { config } from './config.js';
import { toast } from './toast.js';
import { showSessionGate } from '../views/gate.js';

// --------------------------------------------------
// Slow API endpoints
// --------------------------------------------------
const SLOW = [
  '/place',
  '/check-payment',
  '/check_payment',
  '/login',
  '/offer/refresh',
  '/cart/checkout',
  '/checkout/check',
  '/pay'
];

// --------------------------------------------------
// Detect browser mode
// URL:
// https://YOUR-DOMAIN.vercel.app/?web=1
// --------------------------------------------------
const BROWSER_MODE = (() => {
  try {
    return new URLSearchParams(window.location.search).get('web') === '1';
  } catch {
    return false;
  }
})();

// --------------------------------------------------
// Token handling
// --------------------------------------------------
let TOKEN = (() => {
  // Browser mode does not require a token from the URL.
  if (BROWSER_MODE) {
    try {
      return (
        sessionStorage.getItem('mtk') ||
        localStorage.getItem('mtk') ||
        ''
      );
    } catch {
      return '';
    }
  }

  // Normal Telegram mode can receive a token from the URL.
  try {
    const u = new URL(location.href);
    const t = u.searchParams.get('token') || '';

    if (t) {
      sessionStorage.setItem('mtk', t);
      localStorage.setItem('mtk', t);

      u.searchParams.delete('token');

      history.replaceState(
        null,
        '',
        u.pathname + (u.search || '')
      );

      return t;
    }
  } catch {}

  try {
    return (
      sessionStorage.getItem('mtk') ||
      localStorage.getItem('mtk') ||
      ''
    );
  } catch {
    return '';
  }
})();

export const getToken = () => TOKEN;

// --------------------------------------------------
// API request
// --------------------------------------------------

/**
 * @param {string} path
 * @param {any} [body]
 * @param {{timeout?:number,silent?:boolean,noRetry?:boolean}} [opts]
 */
export async function api(path, body, opts = {}) {
  const isSlow = SLOW.some(s => path.includes(s));

  const timeout =
    opts.timeout ??
    (isSlow ? 29_000 : 19_000);

  const canRetry =
    !isSlow &&
    !opts.noRetry;

  const attempts =
    canRetry ? 2 : 1;

  // Convert:
  // /api/session
  // into:
  // session
  const cleanPath = path
    .replace(/^\/api\//, '')
    .replace(/^\//, '');

  const url =
    `${config.apiBase}/proxy?path=` +
    `${encodeURIComponent(cleanPath)}` +
    `&_=${Date.now()}`;

  // ------------------------------------------------
  // Request headers
  // ------------------------------------------------
  const headers = {
    'accept': 'application/json'
  };

  // Only send x-token when one actually exists.
  // Browser mode can therefore make requests without
  // inventing/faking a Telegram token.
  if (TOKEN) {
    headers['x-token'] = TOKEN;
  }

  const init = {
    method: body ? 'POST' : 'GET',
    headers,
    signal: null
  };

  if (body) {
    init.headers['content-type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  // ------------------------------------------------
  // Request / retry
  // ------------------------------------------------
  let lastErr = null;

  for (let a = 0; a < attempts; a++) {
    const ctrl = new AbortController();

    init.signal = ctrl.signal;

    const t = setTimeout(
      () => ctrl.abort(),
      timeout
    );

    try {
      const r = await fetch(url, init);

      clearTimeout(t);

      let j;

      try {
        j = await r.json();
      } catch {
        j = null;
      }

      // Backend says Telegram/session is required.
      if (
        j &&
        j.ok === false &&
        j.error === 'session'
      ) {
        // In browser mode, don't pretend the Telegram
        // session exists. Show a browser-compatible
        // message instead.
        showSessionGate();

        return null;
      }

      return j;

    } catch (e) {
      clearTimeout(t);

      lastErr = e;

      if (a < attempts - 1) {
        await sleep(400 * (a + 1));
      }
    }
  }

  if (!opts.silent) {
    toast(
      'Network issue — try again',
      'err'
    );
  }

  return null;
}

// --------------------------------------------------
// Sleep helper
// --------------------------------------------------
const sleep = ms =>
  new Promise(resolve => setTimeout(resolve, ms));
