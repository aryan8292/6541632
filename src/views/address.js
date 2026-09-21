// @ts-check
import { api } from '../core/api.js';
import { rcGet, rcSet, rcFresh, rcDrop, rcGen, rcSetIf } from '../core/cache.js';
import { store } from '../core/store.js';
import { toast } from '../core/toast.js';
import { svg } from '../lib/icons.js';
import { esc } from '../lib/format.js';
import { config } from '../core/config.js';

export async function renderAddress(bg) {
  if (!bg) {
    const cached = rcGet('address', config.ttl.address);
    if (cached) {
      paint(cached);
      if (rcFresh('address', config.fresh.address)) return;
      return renderAddress(true);
    }
    skeleton();
  }
  const r = await api('/api/address');
  if (r?.ok) rcSet('address', r);
  if (bg && !(r?.ok)) return;
  paint(r);
}

function skeleton() {
  document.getElementById('pg-address').innerHTML =
    '<div class="sk-card"></div><div class="sk-card"></div>';
}

function paint(r) {
  const ad = r?.ok ? r.address : null;
  const ref = r?.ok ? r.referral : '';
  let h = `<div class="sec-title">Address & Referral<span>Delivery address used for all orders</span></div>`;
  h += `<div class="card"><div class="card-title"><div class="ct-ic">${svg('pin')}</div>Delivery Address</div>
    <div class="field"><label class="flbl">Full Name</label>
      <input class="inp" id="ad-name" value="${esc(ad?.name || '')}" placeholder="Recipient name"></div>
    <div class="frow">
      <div class="field"><label class="flbl">Mobile</label>
        <input class="inp" id="ad-mobile" inputmode="numeric" maxlength="10" oninput="window.__num(this,10)" value="${esc(ad?.mobile || '')}" placeholder="10-digit"></div>
      <div class="field"><label class="flbl">Pincode</label>
        <input class="inp" id="ad-pin" inputmode="numeric" maxlength="6" oninput="window.__num(this,6)" value="${esc(ad?.pin || '')}" placeholder="6-digit"></div>
    </div>
    <div class="frow">
      <div class="field"><label class="flbl">City</label>
        <input class="inp" id="ad-city" value="${esc(ad?.city || '')}" placeholder="City"></div>
      <div class="field"><label class="flbl">State</label>
        <input class="inp" id="ad-state" value="${esc(ad?.state || '')}" placeholder="State"></div>
    </div>
    <div class="field"><label class="flbl">Address Line 1</label>
      <input class="inp" id="ad-l1" value="${esc(ad?.line1 || '')}" placeholder="House / street"></div>
    <div class="field"><label class="flbl">Address Line 2</label>
      <input class="inp" id="ad-l2" value="${esc(ad?.line2 || '')}" placeholder="Area / landmark (required)"></div>
    <button class="btn btn-m" onclick="window.__saveAddress()">${svg('check')} Save Address</button></div>`;
  h += `<div class="card"><div class="card-title"><div class="ct-ic">${svg('link')}</div>Default Referral</div>
    <div class="field"><input class="inp" id="ad-ref" value="${esc(ref || '')}" placeholder="Referral link or code (optional)"></div>
    <button class="btn btn-m" onclick="window.__saveReferral()">${svg('check')} Save Referral</button></div>`;
  h += `<div class="card" id="rf-card">
    <div class="card-title"><div class="ct-ic">${svg('gift')}</div>Refer &amp; Earn<span class="ct-sub" id="rf-sub"></span></div>
    <div id="rf-body">${rfSkeleton()}</div></div>`;
  document.getElementById('pg-address').innerHTML = h;
  loadReferralStats();
}

function rfSkeleton() {
  const cell = '<div class="rf-stat"><div class="rf-n" style="opacity:.25">--</div><div class="rf-l">&nbsp;</div></div>';
  return `<div class="rf-grid">${cell.repeat(3)}</div><div class="rf-note">Loading your referral stats…</div>`;
}

async function loadReferralStats() {
  const gen = rcGen();
  const cached = rcGet('refstats', config.ttl.refstats);
  if (cached) {
    paintReferral(cached);
    if (rcFresh('refstats', config.fresh.refstats)) return;
  } else if (store.get('selPhone')) {
    paintReferral({ ok: true, phone: store.get('selPhone'), stats: null, _loading: true, link: '' });
  }
  let r = null;
  try { r = await api('/api/referral/stats', { phone: store.get('selPhone') || '' }); } catch {}
  if (gen !== rcGen()) return;
  if (r?.ok) rcSetIf('refstats', r, gen);
  paintReferral(r);
}

function paintReferral(r) {
  const body = document.getElementById('rf-body');
  const sub = document.getElementById('rf-sub');
  if (!body) return;
  const st = r?.ok ? r.stats : null;
  const link = r?.ok ? r.link : '';
  const via = r?.ok ? r.via : '';
  if (sub) sub.textContent = r?.ok ? r.phone : '';

  let h = '';
  if (st) {
    h += `<div class="rf-grid">
      <div class="rf-stat ok"><div class="rf-n">${st.successful | 0}</div><div class="rf-l">Successful</div></div>
      <div class="rf-stat pend"><div class="rf-n">${st.pending | 0}</div><div class="rf-l">Pending</div></div>
      <div class="rf-stat rej"><div class="rf-n">${st.rejected | 0}</div><div class="rf-l">Rejected</div></div>
    </div>`;
  }
  if (link) {
    h += `<div class="rf-link">${svg('link')}<code>${esc(link)}</code></div>
      <div class="rf-row">
        <button class="btn btn-outline btn-m" onclick="window.__copyReferral()">${svg('json')} Copy Link</button>
        <button class="btn btn-m" onclick="window.__shareReferral()">${svg('gift')} Share</button>
      </div>`;
    const code = via || ((/[?&]via=([A-Za-z0-9]+)/.exec(link) || [])[1] || '');
    if (code) h += `<div class="rf-note">This account's own code: <b>${esc(code)}</b></div>`;
  } else {
    h += `<div class="rf-note">Select an account in the Account tab to get its referral link.</div>`;
  }
  body.innerHTML = h;
}

// expose
Object.assign(window, {
  __saveAddress: async () => {
    const g = id => document.getElementById(id)?.value ?? '';
    const b = {
      name: g('ad-name').trim(), mobile: g('ad-mobile'), pin: g('ad-pin'),
      city: g('ad-city').trim(), state: g('ad-state').trim(),
      line1: g('ad-l1').trim(), line2: g('ad-l2').trim()
    };
    const fail = (m, id) => { toast(m, 'err'); document.getElementById(id)?.focus(); return false; };
    if (!b.name) return fail('Enter your name', 'ad-name');
    if (b.mobile.length !== 10) return fail('Enter a 10-digit mobile number', 'ad-mobile');
    if (b.pin.length !== 6) return fail('Pincode must be 6 digits', 'ad-pin');
    if (!b.line1) return fail('Enter your address', 'ad-l1');
    if (!b.city) return fail('Enter your city', 'ad-city');
    if (!b.state) return fail('Enter your state', 'ad-state');

    const prev = rcGet('address', 0);
    rcSet('address', { ok: true, address: b, referral: prev?.referral || '' });
    toast('Address saved!', 'suc');
    const r = await api('/api/address/save', b);
    if (!r?.ok) {
      if (prev) rcSet('address', prev); else rcDrop('address');
      toast('Failed to save', 'err');
    }
  },
  __saveReferral: async () => {
    const ref = document.getElementById('ad-ref').value.trim();
    const prev = rcGet('address', 0);
    const prevStats = rcGet('refstats', 0);
    if (prev) rcSet('address', { ...prev, referral: ref });
    rcDrop('refstats');
    toast(ref ? 'Referral saved' : 'Referral cleared', 'suc');
    const r = await api('/api/referral/save', { referral: ref });
    if (!r?.ok) {
      if (prev) rcSet('address', prev);
      if (prevStats) rcSet('refstats', prevStats);
      toast('Failed to save', 'err');
    }
  },
  __copyReferral: () => {
    const code = document.querySelector('#rf-body .rf-link code')?.textContent || '';
    if (code) navigator.clipboard.writeText(code).then(() => toast('Link copied', 'suc'));
  },
  __shareReferral: () => {
    const link = document.querySelector('#rf-body .rf-link code')?.textContent || '';
    if (!link) return toast('No referral link yet', 'err');
    const txt = 'Order on Meesho with my referral link: ' + link;
    try {
      const w = window.Telegram?.WebApp;
      if (w?.openTelegramLink) {
        w.openTelegramLink('https://t.me/share/url?url=' + encodeURIComponent(link) + '&text=' + encodeURIComponent('Order on Meesho with my referral link'));
        return;
      }
    } catch {}
    if (navigator.share) return navigator.share({ text: txt }).catch(() => {});
    navigator.clipboard.writeText(link).then(() => toast('Link copied', 'suc'));
  }
});