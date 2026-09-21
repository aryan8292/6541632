// @ts-check
import { svg, ico } from '../lib/icons.js';
import { esc } from '../lib/format.js';

export function confirm(o = {}) {
  return new Promise(res => {
    const dlg = document.getElementById('cdlg');
    const slot = o.slot
      ? `<div class="cdlg-slot">${ico('ticket', 14, 'var(--m-d)')} Uses 1 order slot</div>` : '';
    dlg.innerHTML = `<div class="cdlg-ic ${o.danger ? 'danger' : ''}">${svg(o.icon || (o.danger ? 'trash' : 'check'))}</div>
      <div class="cdlg-h">${esc(o.title || 'Are you sure?')}</div>
      ${o.body ? `<div class="cdlg-b">${esc(o.body)}</div>` : ''}
      ${slot}
      <div class="cdlg-btns">
        <button class="btn cbtn-cancel" id="cno">${esc(o.cancel || 'Cancel')}</button>
        <button class="btn ${o.danger ? 'btn-danger' : 'btn-m'}" id="cyes">${esc(o.ok || 'Confirm')}</button>
      </div>`;
    const mask = document.getElementById('cmask');
    const done = v => { mask.classList.remove('show'); setTimeout(() => res(v), 0); };
    mask.classList.add('show');
    document.getElementById('cyes').onclick = () => done(true);
    document.getElementById('cno').onclick = () => done(false);
    mask.onclick = e => { if (e.target === mask) done(false); };
    try { window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light'); } catch {}
  });
}
