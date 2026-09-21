// api/proxy.js  — Vercel Edge Function
export const config = { runtime: 'edge' };

const ORIGIN = process.env.BACKEND_ORIGIN || 'https://pricetrackerpro.fojadomain.fun';
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean);

// Mirror of the backend's slow-path list (webapi.py::_SLOW_PATHS)
const SLOW = ['/place', '/check-payment', '/check_payment', '/login',
              '/offer/refresh', '/cart/checkout', '/checkout/check', '/pay'];

export default async function handler(req) {
  const url = new URL(req.url);
  const path = url.searchParams.get('path') || '';
  const qs = url.searchParams.get('_') ? `?_=${url.searchParams.get('_')}` : '';

  // Same-origin only
  const origin = req.headers.get('origin') || '';
  if (ALLOWED_ORIGINS.length && !ALLOWED_ORIGINS.includes(origin)) {
    return json({ ok: false, error: 'forbidden' }, 403);
  }

  const token = req.headers.get('x-token') || '';
  if (!token || !/^\d+\.[a-f0-9]+$/i.test(token)) {
    return json({ ok: false, error: 'session' }, 401);
  }

  const isSlow = SLOW.some(s => path.includes(s));
  const timeoutMs = isSlow ? 29_000 : 19_000;

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);

  const upstream = new URL(ORIGIN);
  upstream.pathname = '/api/' + path;
  if (qs) upstream.search = qs;

  const init = {
    method: req.method,
    headers: {
      'content-type': req.headers.get('content-type') || 'application/json',
      'x-token': token,
      'accept': 'application/json',
      'user-agent': 'pricetrackerpro/2.0 (vercel-edge)'
    },
    signal: ctrl.signal
  };

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = await req.text();
  }

  try {
    const res = await fetch(upstream.toString(), init);
    clearTimeout(t);
    const text = await res.text();
    return new Response(text, {
      status: res.status,
      headers: {
        'content-type': res.headers.get('content-type') || 'application/json',
        'cache-control': 'no-store',
        'referrer-policy': 'no-referrer'
      }
    });
  } catch (e) {
    clearTimeout(t);
    const timedOut = e?.name === 'AbortError';
    return json({ ok: false, error: timedOut ? 'timeout' : 'network' }, timedOut ? 504 : 502);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
  });
}