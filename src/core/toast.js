// @ts-check
import { IC } from '../lib/icons.js';

let _t = null;

export function toast(msg, type = 'inf') {
  const el = document.getElementById('toast');
  if (!el) return;
  el.className = '';
  el.classList.add(type, 'show');
  const ic = type === 'err' ? IC.x : type === 'suc' ? IC.check : IC.refresh;
  el.querySelector('.t-ic').innerHTML =
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">${ic}</svg>`;
  el.querySelector('.t-msg').textContent = msg;
  const bar = el.querySelector('.t-bar');
  bar.style.transition = 'none';
  bar.style.width = '100%';
  requestAnimationFrame(() => {
    bar.style.transition = 'width 3s linear';
    bar.style.width = '0%';
  });
  clearTimeout(_t);
  _t = setTimeout(() => el.classList.remove('show'), 3000);
  haptic(type === 'err' ? 'medium' : 'light');
}

export function haptic(t) {
  try { window.Telegram?.WebApp?.HapticFeedback?.impactOccurred(t || 'light'); } catch {}
}
