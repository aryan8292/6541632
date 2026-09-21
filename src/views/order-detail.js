// @ts-check
import { api } from '../core/api.js';
import { rcGet, rcSet, rcFresh, rcDrop } from '../core/cache.js';
import { store } from '../core/store.js';
import { toast, haptic } from '../core/toast.js';
import { openSheet, closeSheet } from '../core/sheet.js';
import { svg, ico } from '../lib/icons.js';
import { esc, money } from '../lib/format.js';
import { config } from '../core/config.js';

const CANCEL_REASONS = [
  { id: 60, t: 'I changed my mind' },
  { id: 61, t: 'Ordered by mistake' },
  { id: 62, t: 'Found a better price elsewhere' },
  { id: 63, t: 'Delivery is taking too long' },
  { id: 64, t: 'Want to change size / product' },
  { id: 65, t: 'Other reason' }
];

let _cxOrder = null, _cxPhone = null, _cxReason = 60;
let _chgOrder = null, _chgPhone = null, _chgAddr = null;

export async function showOrderDetail(num, phone) {
  const k = 'od:' + phone + ':' + num;
  const cached = rcGet(k, config.ttl.orderDetail);
  if (cached) {
    paint(num, phone, cached);
    if (rcFresh(k, config.fresh.orderDetail)) return;
  }
  const r = await api('/api/orders/' + encodeURIComponent(num) + (phone ? '?phone=' + encodeURIComponent(phone) : ''));
  if (r?.ok) rcSet(k, r);
  if (!r?.ok) { if (cached) return; return toast('Not found', 'err'); }
  paint(num, phone, r);
}

function paint(num, phone, r) {
  const d = r.detail || {};
  const pr = d.product || {};
  const ad = d.address || {};
  const pay = d.payment || {};
  store.set({ lastOrderAddr: ad });

  let tl = (d.timeline || []).map(m =>
    `<div class="tl-item ${m.active ? 'now' : m.completed ? 'done' : ''}"><div class="tl-dot"></div><div class="tl-line"></div>
      <div class="tl-st">${esc(m.status)}${m.note ? ` · <span style="color:var(--m-d)">${esc(m.note)}</span>` : ''}</div>
      ${m.date ? `<div class="tl-dt">${esc(m.date)}</div>` : ''}</div>`).join('');

  let h = `<div class="od-hd"><button class="od-back" onclick="window.__switchTab('orders',true)">${svg('chevL')}</button><div class="od-title">ORDER #${esc(d.order_num || num)}</div></div>
    <div class="od-body">
    <div class="card od-hero">
      ${pr.image ? `<img class="od-hero-img" src="${esc(pr.image)}" onerror="this.style.display='none'">` : `<div class="od-hero-img" style="display:flex;align-items:center;justify-content:center">${ico('bag', 24, 'var(--m-d)')}</div>`}
      <div style="flex:1;min-width:0"><div class="od-hero-nm">${esc(pr.name || 'Product')}</div>
        <div class="od-hero-sub">${[pr.size ? 'Size ' + esc(pr.size) : '', pr.quantity ? 'Qty ' + esc(pr.quantity) : '', pr.price ? '₹' + esc(pr.price) : ''].filter(Boolean).join('  ·  ')}</div>
      </div>
    </div>`;

  const st = (d.status_title || '').toLowerCase();
  let sIco = 'clock', sCol = 'var(--m-d)', sBg = 'var(--m-bg)';
  if (st.includes('deliver')) { sIco = 'check'; sCol = 'var(--green)'; sBg = 'var(--green-bg)'; }
  else if (st.includes('ship') || st.includes('way')) { sIco = 'truck'; sCol = 'var(--m-d)'; sBg = 'var(--m-bg)'; }
  else if (st.includes('cancel')) { sIco = 'x'; sCol = 'var(--red)'; sBg = 'var(--red-bg)'; }
  h += `<div class="card od-status"><div class="od-status-ic" style="background:${sBg}">${ico(sIco, 19, sCol)}</div>
    <div class="od-status-tx"><div class="od-status-t" style="color:${sCol}">${esc(d.status_title || 'Placed')}</div>
    ${(d.eta || d.status_sub) ? `<div class="od-status-s">${d.eta ? 'Delivery by ' + esc(d.eta) : esc(d.status_sub) + ' ' + esc(d.status_date || '')}</div>` : ''}</div></div>`;

  if (d.tracking_id || d.courier || d.tracking_url) {
    h += `<div class="card" style="margin:0 0 10px"><div class="card-title" style="margin-bottom:10px"><div class="ct-ic">${svg('truck')}</div>Tracking</div>`;
    if (d.courier) h += `<div class="irow"><span class="k">Carrier</span><span class="v">${esc(d.courier)}</span></div>`;
    if (d.tracking_id) h += `<div class="irow"><span class="k">Tracking ID</span><span class="v" style="user-select:all">${esc(d.tracking_id)}</span></div>`;
    if (d.tracking_url) h += `<div style="margin-top:10px"><button class="btn btn-outline" style="width:100%" onclick="window.open('${esc(d.tracking_url)}','_blank')">${svg('truck')} Track Live</button></div>`;
    h += `</div>`;
  }

  if (tl) h += `<div class="card" style="margin:0 0 10px"><div class="card-title" style="margin-bottom:12px"><div class="ct-ic">${svg('truck')}</div>Timeline</div><div class="tl">${tl}</div></div>`;

  if ((d.scans || []).length) {
    const scans = d.scans.map(s => `<div class="tl-item ${s.active ? 'done' : ''}"><div class="tl-dot"></div><div class="tl-line"></div>
      <div class="tl-st">${esc(s.status)}</div><div class="tl-dt">${esc(s.date)}${s.time ? ' · ' + esc(s.time) : ''}</div></div>`).join('');
    h += `<div class="card" style="margin:0 0 10px"><div class="card-title" style="margin-bottom:6px;cursor:pointer;justify-content:space-between" onclick="this.parentNode.querySelector('.scanwrap').classList.toggle('open')">
      <span style="display:flex;align-items:center;gap:8px"><div class="ct-ic">${svg('truck')}</div>Shipment Updates (${d.scans.length})</span>${svg('chevD')}</div>
      <div class="scanwrap" style="max-height:0;overflow:hidden;transition:max-height .25s"><div class="tl" style="padding-top:8px">${scans}</div></div></div>`;
  }

  if (pay.mode || pay.amount) {
    h += `<div class="card" style="margin:0 0 10px"><div class="card-title" style="margin-bottom:10px"><div class="ct-ic">${svg('gift')}</div>Payment</div>
      ${pay.mode ? `<div class="irow"><span class="k">Mode</span><span class="v">${esc(pay.mode)}</span></div>` : ''}
      ${pay.amount ? `<div class="irow"><span class="k">Amount</span><span class="v">₹${esc(pay.amount)}</span></div>` : ''}</div>`;
  }

  if (d.seller) h += `<div class="card" style="margin:0 0 10px"><div class="irow"><span class="k">Seller</span><span class="v">${esc(d.seller)}</span></div></div>`;

  if (ad.name) {
    const lines = [ad.line1, ad.line2, ad.landmark].filter(Boolean).map(esc).join('<br>');
    const cityState = [ad.city, ad.state].filter(Boolean).map(esc).join(', ');
    const cityLine = [cityState, ad.pin ? '- ' + esc(ad.pin) : ''].filter(Boolean).join(' ');
    h += `<div class="card" style="margin:0 0 10px"><div class="card-title" style="margin-bottom:10px"><div class="ct-ic">${svg('pin')}</div>Delivery Address</div>
      <div style="font-size:13.5px;font-weight:800">${esc(ad.name)}</div>
      <div class="addr-body">${lines ? lines + '<br>' : ''}${cityLine}</div>
      ${ad.mobile ? `<div class="addr-phone">${ico('phone', 13)} ${esc(ad.mobile)}</div>` : ''}</div>`;
  }

  const oNum = esc(d.order_num || num), oPh = esc(phone || store.get('selPhone') || '');
  if (d.can_change_address || d.can_cancel) {
    h += `<div class="od-actions">`;
    if (d.can_change_address) h += `<button class="btn btn-outline" onclick="window.__openChangeAddr('${oNum}','${oPh}')">${svg('pin')} Change Address</button>`;
    if (d.can_cancel) h += `<button class="btn btn-danger" onclick="window.__openCancelOrder('${oNum}','${oPh}')">${svg('x')} Cancel Order</button>`;
    h += `</div>`;
  }
  h += `</div>`;

  const el = document.getElementById('pg-order-detail');
  const wasOn = store.get('tab') === 'order-detail';
  const scroll = wasOn ? el.scrollTop : 0;
  el.innerHTML = h;
  store.set({ tab: 'order-detail' });
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('nav-orders')?.classList.add('active');
  try { el.scrollTop = wasOn ? scroll : 0; } catch {}
}

// expose
Object.assign(window, {
  __showOrderDetail: showOrderDetail,
  __openCancelOrder: (orderNum, phone) => {
    _cxOrder = orderNum; _cxPhone = phone; _cxReason = CANCEL_REASONS[0].id;
    const html = `<div class="sheet-h"><div class="st">Cancel Order</div><button class="sheet-x" onclick="window.closeSheet()">${svg('x')}</button></div>
      <div style="padding:0 2px">
        <div class="hint" style="margin:0 0 12px">This cancels order <b>#${esc(orderNum)}</b>. Pick a reason:</div>
        <div id="cx-reasons" class="cx-reasons">${CANCEL_REASONS.map((r, i) =>
          `<div class="cx-opt ${i === 0 ? 'sel' : ''}" data-id="${r.id}" onclick="window.__selCancelReason(${r.id})">${esc(r.t)}</div>`).join('')}</div>
        <div class="field mt10"><textarea class="inp" id="cx-comments" placeholder="Comments (optional)" style="min-height:56px"></textarea></div>
      </div>
      <div class="as-foot"><button class="btn btn-danger" id="cx-go" onclick="window.__doCancelOrder()">${svg('x')} Confirm Cancel</button></div>`;
    openSheet(html);
  },
  __selCancelReason: id => {
    _cxReason = id;
    document.querySelectorAll('#cx-reasons .cx-opt').forEach(o => o.classList.toggle('sel', +o.dataset.id === id));
    haptic('light');
  },
  __doCancelOrder: async () => {
    const btn = document.getElementById('cx-go');
    if (btn) { btn.disabled = true; btn.innerHTML = 'Cancelling…'; }
    const comments = document.getElementById('cx-comments')?.value?.trim() || '';
    const r = await api('/api/order/cancel', { phone: _cxPhone, order_num: _cxOrder, reason_id: _cxReason, comments });
    if (r?.ok) {
      haptic('heavy'); toast(r.message || 'Order cancelled', 'suc'); closeSheet();
      rcDrop('od:' + _cxPhone + ':' + _cxOrder);
      rcDrop('orders:' + (_cxPhone || store.get('selPhone') || ''));
      window.__switchTab('orders', true);
    } else {
      toast('Could not cancel', 'err');
      if (btn) { btn.disabled = false; btn.innerHTML = svg('x') + ' Confirm Cancel'; }
    }
  },
  __openChangeAddr: (orderNum, phone) => {
    _chgOrder = orderNum; _chgPhone = phone;
    _chgAddr = store.get('lastOrderAddr') || {};
    const a = _chgAddr;
    const F = (id, label, val, ph, extra) => `<div class="field"><label class="flbl">${label}</label>
      <input class="inp" id="${id}" value="${esc(val || '')}" placeholder="${ph || ''}" ${extra || ''}></div>`;
    const html = `<div class="sheet-h"><div class="st">Change Address</div><button class="sheet-x" onclick="window.closeSheet()">${svg('x')}</button></div>
      <div style="padding:0 2px">
        <div class="hint" style="margin:0 0 10px">Update the delivery address (only before it ships).</div>
        ${F('ca-name', 'Full Name', a.name, 'Name')}
        ${F('ca-mobile', 'Mobile', a.mobile, '10-digit mobile', 'inputmode="numeric" maxlength="10" oninput="window.__num(this,10)"')}
        ${F('ca-pin', 'Pincode', a.pin, '6-digit', 'inputmode="numeric" maxlength="6" oninput="window.__num(this,6)"')}
        ${F('ca-line1', 'Address (House / Street)', a.line1, 'Flat, building, street')}
        ${F('ca-line2', 'Area / Locality (optional)', a.line2, 'Area, colony')}
        ${F('ca-landmark', 'Landmark (optional)', a.landmark, 'Near…')}
        <div class="frow"><div style="flex:1">${F('ca-city', 'City', a.city, 'City')}</div><div style="flex:1">${F('ca-state', 'State', a.state, 'State')}</div></div>
      </div>
      <div class="as-foot"><button class="btn btn-m" id="ca-save" onclick="window.__saveChangeAddr()">${svg('check')} Update Address</button></div>`;
    openSheet(html);
  },
  __saveChangeAddr: async () => {
    const g = id => document.getElementById(id)?.value.trim() || '';
    const payload = {
      phone: _chgPhone, order_num: _chgOrder,
      name: g('ca-name'), mobile: g('ca-mobile'), pin: g('ca-pin'),
      line1: g('ca-line1'), line2: g('ca-line2'), landmark: g('ca-landmark'),
      city: g('ca-city'), state: g('ca-state')
    };
    if (!payload.name || !payload.mobile || !payload.pin || !payload.city || !payload.state || !payload.line1)
      return toast('Fill name, mobile, pin, city, state and address', 'err');
    if (payload.pin.length !== 6) return toast('Pincode must be 6 digits', 'err');
    const btn = document.getElementById('ca-save');
    if (btn) { btn.disabled = true; btn.innerHTML = 'Updating…'; }
    const r = await api('/api/order/address', payload);
    if (r?.ok) {
      haptic('light'); toast(r.message || 'Address updated', 'suc'); closeSheet();
      if (_chgOrder) { rcDrop('od:' + _chgPhone + ':' + _chgOrder); showOrderDetail(_chgOrder, _chgPhone); }
    } else {
      toast('Could not change address', 'err');
      if (btn) { btn.disabled = false; btn.innerHTML = svg('check') + ' Update Address'; }
    }
  },
  __num: (el, max) => { if (el) el.value = (el.value || '').replace(/\D/g, '').slice(0, max); }
});