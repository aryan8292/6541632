// @ts-check
import { api } from '../core/api.js';
import { rcGet, rcSet, rcFresh } from '../core/cache.js';
import { store } from '../core/store.js';
import { toast } from '../core/toast.js';
import { confirm } from '../core/confirm.js';
import { sheet } from '../core/sheet.js';
import { svg, ico } from '../lib/icons.js';
import { esc, money } from '../lib/format.js';
import { config } from '../core/config.js';

const ACC_PAGE = 25;
let accShown = ACC_PAGE;

export async function renderAccount() {
  const cached = rcGet('accounts', config.ttl.accounts);
  if (cached) {
    store.set({ accounts: cached });
    paint();
    if (rcFresh('accounts', config.fresh.accounts)) return;
  } else {
    skeleton();
  }
  const r = await api('/api/accounts');
  if (r?.ok && r.accounts) { store.set({ accounts: r.accounts }); rcSet('accounts', r.accounts); }
  paint();
}

function skeleton() {
  document.getElementById('pg-account').innerHTML =
    Array(3).fill('<div class="sk-row"><div class="sk sk-av"></div><div class="sk-lines"><div class="sk sk-l1"></div><div class="sk sk-l2"></div></div></div>').join('');
}

function paint() {
  const accounts = store.get('accounts');
  const selPhone = store.get('selPhone');
  const myRef = store.get('myRef');

  const visible = accounts.slice(0, accShown);
  const pinned = selPhone && !visible.some(a => a.phone === selPhone)
    ? accounts.find(a => a.phone === selPhone)
    : null;
  const list = pinned ? [pinned, ...visible] : visible;
  const rest = Math.max(0, accounts.length - accShown - (pinned ? 1 : 0));

  const html = `
    <div class="sec-title">Accounts<span>Login & manage your Meesho accounts</span></div>
    ${loginCard(myRef)}
    ${jsonImportCard()}
    <div class="acc-sec-hd">
      <span class="acc-sec-t">Saved Accounts</span>
      <button class="acc-sync" id="acc-sync" onclick="window.__refreshAllOrders(this)">
        ${svg('refresh')}<span>Check orders</span>
      </button>
      <span class="acc-sec-c">${accounts.length} total</span>
    </div>
    <div id="acc-list" style="margin:0 16px">
      ${list.map(a => accCard(a, selPhone)).join('')}
      ${rest > 0 ? `<button class="btn btn-ghost mt10" onclick="window.__accShowMore()">${svg('chevD')} Show ${Math.min(rest, ACC_PAGE)} more · ${rest} hidden</button>` : ''}
    </div>`;
  document.getElementById('pg-account').innerHTML = html;
}

function loginCard(myRef) {
  return `<div class="card"><div class="card-title"><div class="ct-ic">${svg('phone')}</div>OTP Login</div>
    <div id="login-box">
      <div class="field"><label class="flbl">Phone Number</label>
        <input class="inp" id="lg-phone" inputmode="numeric" maxlength="10" oninput="window.__onPhoneInput(this)" placeholder="10-digit mobile"></div>
      <div id="lg-numchk"></div>
      <div class="field"><label class="flbl">Your Referral Code</label>
        <input class="inp" id="lg-ref" value="${esc(myRef)}" placeholder="Your code"></div>
      <div class="field"><label class="flbl">Welcome Bonus Tier</label>
        <div class="tier-row" id="lg-tiers">
          ${[110,120,135,150,180].map(t => `<div class="tier-opt${t===180?' sel':''}" data-tier="${t}" onclick="window.__selTier(${t})">₹${t}<span class="ts">${t===110?'Fast':t===120?'Good':t===135?'Better':t===150?'High':'Max'}</span></div>`).join('')}
        </div>
      </div>
      <button class="btn btn-m" onclick="window.__loginStart()">${svg('gift')} Find Best Offer & Continue</button>
    </div></div>`;
}

function jsonImportCard() {
  return `<div class="acc-wrap" id="acc-json">
    <div class="acc-hd" onclick="this.parentNode.classList.toggle('open')"><div class="ah-ic">${svg('json')}</div>Import via JSON<div class="chev">${svg('chevD')}</div></div>
    <div class="acc-bd"><div class="field"><textarea class="inp" id="js-in" placeholder='{"phone":"+91...","user_id":"...","xo_token":"..."}'></textarea></div>
    <button class="btn btn-outline" onclick="window.__importJson()">${svg('check')} Import Account</button></div></div>`;
}

function accCard(a, selPhone) {
  const used = a.placed;
  const sel = selPhone === a.phone;
  const canExport = used || a.export_unlocked;
  const stage = a.order_status || '';
  const sk = (a.stage_key || '').toLowerCase();
  let status;
  if (sk === 'delivered' || /deliver/i.test(stage))
    status = `<span class="pill pill-green">${ico('check', 11)} ${esc(stage || 'Delivered')}</span>`;
  else if (sk === 'shipped' || /ship|transit/i.test(stage))
    status = `<span class="pill pill-blue">${ico('truck', 11)} ${esc(stage || 'Shipped')}</span>`;
  else if (sk === 'cancelled' || /cancel/i.test(stage))
    status = `<span class="pill pill-red">${ico('x', 11)} ${esc(stage || 'Cancelled')}</span>`;
  else if (used)
    status = `<span class="pill pill-green">${ico('check', 11)} ${esc(stage || 'Ordered')}</span>`;
  else
    status = `<span class="pill pill-m">${ico('check', 11)} Ready</span>`;

  const sub = a.stage_detail || '';
  return `<div class="acc-card ${used?'used':''} ${sel?'sel':''}" onclick="window.__selectAccount('${esc(a.phone)}')">
    <div class="acc-av">${ico('user', 20, used ? 'var(--green)' : 'var(--m-d)')}</div>
    <div class="acc-info"><div class="acc-ph">${esc(a.phone)}</div>
      <div class="acc-meta">${status}${sel ? `<span class="pill pill-sel">${ico('check', 10)} Selected</span>` : ''}</div>
      ${sub ? `<div class="acc-sub">${esc(sub)}</div>` : ''}</div>
    <div class="acc-actions">
      <button class="acc-act ${canExport?'':'acc-act-lock'}" onclick="event.stopPropagation();window.__copyAccount('${esc(a.phone)}',this)">${svg(canExport ? 'json' : 'lock')}</button>
      <button class="acc-act" onclick="event.stopPropagation();window.__refreshAccount('${esc(a.phone)}',this)">${svg('refresh')}</button>
      <button class="acc-del" onclick="event.stopPropagation();window.__delAccount('${esc(a.phone)}')">${svg('trash')}</button>
    </div></div>`;
}

// Handlers exposed to window (replace with event delegation later if desired)
Object.assign(window, {
  __accShowMore: () => { accShown += ACC_PAGE; paint(); },
  __selectAccount: async (phone) => {
    const changed = store.get('selPhone') !== phone;
    if (changed) { /* reset order flow */ }
    store.set({ selPhone: phone, tab: 'cart' });
    if (changed) try { await api('/api/account/select', { phone }); } catch {}
    window.__switchTab('cart', true);
    paint();
  },
  __delAccount: async (phone) => {
    const ok = await confirm({ title: 'Delete Account?', body: `${phone} will be removed.`, ok: 'Delete', danger: true, icon: 'trash' });
    if (!ok) return;
    const r = await api('/api/account/delete', { phone });
    if (r?.ok) { toast('Deleted', 'suc'); renderAccount(); }
  },
  __refreshAccount: async (phone, btn) => {
    btn?.classList.add('busy');
    const r = await api('/api/account/refresh', { phone });
    btn?.classList.remove('busy');
    if (r?.ok) toast('Session refreshed', 'suc');
    else toast(friendly(r?.error) || 'Refresh failed', 'err');
  },
  __copyAccount: async (phone, btn) => {
    const r = await api(`/api/export?phone=${encodeURIComponent(phone)}`);
    if (r?.ok && r.export) {
      await navigator.clipboard.writeText(JSON.stringify(r.export, null, 2));
      toast('Account JSON copied', 'suc');
    } else toast('Export failed', 'err');
  }
});