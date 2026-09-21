// @ts-check
import { config } from './config.js';
import { toast } from './toast.js';
import { showSessionGate } from '../views/gate.js';

const SLOW = ['/place','/check-payment','/check_payment','/login',
              '/offer/refresh','/cart/checkout','/checkout/check','/pay'];

let TOKEN = (() => {
  try {
    const u = new URL(location.href);
    const t = u.searchParams.get('token') || '';
    if (t) {
      sessionStorage.setItem('mtk', t);
      localStorage.setItem('mtk', t);
      u.searchParams.delete('token');
      history.replaceState(null, '', u.pathname + (u.search || ''));
      return t;
    }
  } catch {}
  try { return sessionStorage.getItem('mtk') || localStorage.getItem('mtk') || ''; }
  catch { return ''; }
})();

export const getToken = () => TOKEN;

/** @param {string} path @param {any} [body] @param {{timeout?:number,silent?:boolean,noRetry?:boolean}} [opts] */
export async function api(path, body, opts = {}) {
  const isSlow = SLOW.some(s => path.includes(s));
  const timeout = opts.timeout ?? (isSlow ? 29_000 : 19_000);
  const canRetry = !isSlow && !opts.noRetry;
  const attempts = canRetry ? 2 : 1;

  // Proxy expects /api/proxy?path=accounts/refresh&_=...
  const cleanPath = path.replace(/^\/api\//, '').replace(/^\//, '');
  const url = `${config.apiBase}/proxy?path=${encodeURIComponent(cleanPath)}&_=${Date.now()}`;

  const init = {
    method: body ? 'POST' : 'GET',
    headers: { 'x-token': TOKEN, 'accept': 'application/json' },
    signal: null
  };
  if (body) {
    init.headers['content-type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  let lastErr = null;
  for (let a = 0; a < attempts; a++) {
    const ctrl = new AbortController();
    init.signal = ctrl.signal;
    const t = setTimeout(() => ctrl.abort(), timeout);
    try {
      const r = await fetch(url, init);
      clearTimeout(t);
      const j = await r.json();
      if (j && j.ok === false && j.error === 'session') {
        showSessionGate(); return null;
      }
      return j;
    } catch (e) {
      clearTimeout(t);
      lastErr = e;
      if (a < attempts - 1) await sleep(400 * (a + 1));
    }
  }
  if (!opts.silent) toast('Network issue — try again', 'err');
  return null;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));