// @ts-check
export const esc = s => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export const money = n => '₹' + Number(n || 0).toLocaleString('en-IN');

export const num = (el, max) => {
  if (!el) return;
  el.value = (el.value || '').replace(/\D/g, '').slice(0, max);
};

export function imgSize(u, px) {
  u = String(u || '');
  if (!u) return '';
  try {
    return u.replace(/_(\d{2,4})\.(jpg|jpeg|png|webp)(\?.*)?$/i,
      (m, n, ext, q) => Number(n) > px ? `_${px}.webp${q || ''}` : m);
  } catch { return u; }
}

export const sleep = ms => new Promise(r => setTimeout(r, ms));