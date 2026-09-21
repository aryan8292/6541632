// @ts-check
import { api } from '../core/api.js';
import { store } from '../core/store.js';
import { toast, haptic } from '../core/toast.js';
import { confirm } from '../core/confirm.js';
import { openSheet, closeSheet } from '../core/sheet.js';
import { svg, ico } from '../lib/icons.js';
import { esc, money, imgSize } from '../lib/format.js';
import { rcDrop } from '../core/cache.js';

let _checkoutBusy = false;
let _qrPoll = null, _qrPollDelay = 5000, _qrPollJp = '';
const _QR_POLL_START = 5000, _QR_POLL_MAX = 25000;

export function renderCheckout(r) {
  const payMethod = store.get('payMethod') || 'upi';
  const hasUpi = !!(r.upi && r.upi < r.cod);
  const youPay = payMethod === 'cod' ? r.cod : (r.upi || r.cod);
  const items = (r.items && r.items.length) ? r.items : store.get('cart');
  const n = r.item_count || items.length;
  const bill = r.bill || {};
  const rows = bill.rows || [];

  let itemsHtml = items.map(i => {
    const q = i.quantity || 1;
    const orig = (i.mrp && i.mrp > (i.cod || 0)) ? i.mrp : (i.cod || 0);
    const showOrig = orig * q;
    const showDisc = (i.cod || 0) * q;
    const struck = (showDisc > 0 && showDisc < showOrig) ? `<span class="co-struck">${money(showOrig)}</span>` : '';
    return `<div class="co-item">
      <div class="co-thumb">${i.image ? `<img loading="lazy" src="${esc(imgSize(i.image, 128))}" data-full="${esc(i.image)}" onerror="window.__imgFallback(this)">` : svg('bag')}</div>
      <div class="co-info"><div class="co-name">${esc(i.name)}</div>
        <div class="co-meta">${i.variation ? esc(i.variation) : 'Free Size'}${q > 1 ? ' · Qty ' + q : ''}</div></div>
      <div class="co-line">${money(showDisc || showOrig)}${struck}</div>
    </div>`;
  }).join('');

  let billRows = '';
  if (rows.length) {
    rows.forEach(row => {
      const isDisc = row.kind === 'discount';
      const v = isDisc ? ('−' + money(Math.abs(row.value))) : money(row.value);
      billRows += `<div class="irow"><span class="k">${esc(row.label)}</span><span class="v${isDisc ? ' disc' : ''}">${v}</span></div>`;
    });
  } else {
    billRows = `<div class="irow"><span class="k">Order Total</span><span class="v">${money(r.cod)}</span></div>`;
  }

  let h = `<div class="prod">
    <div class="card"><div class="card-title"><div class="ct-ic">${svg('cart')}</div>Order Summary<span class="ct-sub">${n} item${n > 1 ? 's' : ''}</span></div>${itemsHtml}</div>
    <div class="card"><div class="card-title"><div class="ct-ic">${svg('receipt')}</div>Bill Details</div>
      ${bill.bonus_applied ? `<div class="bonus-ok">${ico('gift', 15)}<span>Welcome bonus applied — you saved <b>${money(bill.total_discount)}</b></span></div>` : (bill.is_first_order === false ? `<div class="bonus-no">${ico('alert', 15)}<span>No welcome bonus on this account.</span></div>` : '')}
      ${billRows}
      <div class="irow" style="margin-top:4px;padding-top:13px;border-top:1px solid var(--border2)"><span class="k">Cash on Delivery</span><span class="v">${money(r.cod)}</span></div>
      ${hasUpi ? `<div class="irow"><span class="k">Pay Online (UPI)</span><span class="v disc">${money(r.upi)}</span></div>` : ''}
      <div class="irow total"><span class="k">You Pay</span><span class="v" id="pay-amt2">${money(youPay)}</span></div>
      <div style="font-size:11.5px;color:var(--text3);font-weight:600;margin-top:10px;display:flex;align-items:center;gap:5px">
        ${r.free ? `<span style="color:var(--green)">${ico('gift', 13, 'var(--green)')} Free order — no slot needed</span>` :
        ((r.slots || 0) > 0 ? `${ico('ticket', 13, 'var(--m-d)')} This order uses 1 slot` :
        `<span style="color:var(--red)">${ico('alert', 13, 'var(--red)')} No slots left</span>`)}
      </div>
    </div>
    <div class="card"><div class="card-title"><div class="ct-ic">${svg('wallet')}</div>Payment Method</div>
      <div class="pay-opt ${payMethod === 'cod' ? 'sel' : ''} ${r.cod_available ? '' : 'dis'}" data-pay="cod" onclick="${r.cod_available ? "window.__setPay('cod')" : ''}">
        <div class="pay-ic">${svg('cod')}</div>
        <div class="pay-txt"><div class="pt1">Cash on Delivery</div>
          <div class="pt2">${r.cod_available ? money(r.cod) + ' · pay when it arrives' : 'Not available'}</div></div>
        <div class="pay-radio"></div>
      </div>
      <div class="pay-opt ${payMethod === 'upi' ? 'sel' : ''}" data-pay="upi" onclick="window.__setPay('upi')">
        <div class="pay-ic">${svg('upi')}</div>
        <div class="pay-txt"><div class="pt1">UPI Online${hasUpi ? ` <span class="pill pill-green" style="font-size:8.5px;padding:1px 6px;vertical-align:middle">SAVE ${money(r.cod - r.upi)}</span>` : ''}</div>
          <div class="pt2">${r.upi ? money(r.upi) + ' · scan & pay by QR' : 'Scan & pay by QR'}</div></div>
        <div class="pay-radio"></div>
      </div>
    </div>
    <div style="padding:0 16px">
      <button class="btn btn-m" id="place-btn" onclick="window.__placeOrder()">${svg('check')} Place Order · <span id="btn-amt">${money(youPay)}</span></button>
      <button class="btn btn-ghost mt10" onclick="window.__backToCart()">Back to Cart</button>
    </div>
  </div>`;

  const lc = document.getElementById('link-card'); if (lc) lc.style.display = 'none';
  const cv = document.getElementById('cart-view'); if (cv) cv.innerHTML = '';
  document.getElementById('prod-view').innerHTML = h;
}

export function discardCheckout(hard) {
  try { api('/api/checkout/discard', { soft: !hard }); } catch {}
}

export function resumePending(p) {
  openSheet(`<div class="sheet-h"><div class="st">Finish your payment</div><button class="sheet-x" onclick="window.closeSheet()">${svg('x')}</button></div>
    <div style="padding:4px 4px 8px"><div class="empty"><div class="e-ic">${svg('clock')}</div>
    <h3>Pending UPI payment</h3>
    <p>You have an unfinished payment${p.amount ? (' of ' + money(p.amount)) : ''}. If you already paid, tap below to finalise.</p></div>
    <button class="btn btn-m" onclick="window.__checkPay('${esc(p.juspay_order_id)}',this)">${svg('check')} I've Paid — Check Status</button>
    <button class="btn btn-ghost mt10" onclick="window.__cancelPending('${esc(p.juspay_order_id)}')">Cancel this payment</button></div>`);
  if (typeof window.__startQrPoll === 'function') window.__startQrPoll(p.juspay_order_id);
}

// QR polling
function stopQrPoll() { if (_qrPoll) { clearTimeout(_qrPoll); _qrPoll = null; } _qrPollJp = ''; }
function qrTick() {
  _qrPoll = null;
  if (!store.state.sheetOpen) { stopQrPoll(); return; }
  window.__checkPay(_qrPollJp, null, true);
  if (store.state.sheetOpen && _qrPollJp) {
    _qrPollDelay = Math.min(Math.round(_qrPollDelay * 1.6), _QR_POLL_MAX);
    _qrPoll = setTimeout(qrTick, _qrPollDelay);
  }
}
function startQrPoll(jp) {
  stopQrPoll();
  _qrPollJp = jp;
  _qrPollDelay = _QR_POLL_START;
  _qrPoll = setTimeout(qrTick, _qrPollDelay);
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if (!(store.state.sheetOpen && _qrPollJp)) return;
  _qrPollDelay = _QR_POLL_START;
  if (_qrPoll) { clearTimeout(_qrPoll); _qrPoll = null; }
  window.__checkPay(_qrPollJp, null, true);
  if (store.state.sheetOpen && _qrPollJp) _qrPoll = setTimeout(qrTick, _qrPollDelay);
});

function showQr(r) {
  const html = `<div class="qr-wrap">
    <div class="qr-amt">${money(r.amount)}</div>
    <div class="qr-vpa">Pay to ${esc(r.vpa)}</div>
    <div class="qr-img"><img src="${esc(r.qr_url)}" alt="QR" data-intent="${esc(r.intent || '')}" onerror="window.__qrImgFail(this)"></div>
    <div class="qr-status wait" id="qr-st">${ico('clock', 13)} Awaiting payment</div>
    <button class="btn btn-m" id="qr-act" onclick="window.__checkPay('${esc(r.juspay_order_id)}',this)">${svg('refresh')} I've Paid — Check Status</button>
    <div class="hint tc">Scan with any UPI app, pay <b>${money(r.amount)}</b>, then tap <b>I've Paid</b>.</div>
  </div>`;
  openSheet(`<div class="sheet-h"><div class="st">UPI Payment</div><button class="sheet-x" onclick="window.__stopQrPoll();window.closeSheet()">${svg('x')}</button></div>` + html);
  startQrPoll(r.juspay_order_id);
}

function orderSuccess(r) {
  rcDrop('orders:' + (store.get('selPhone') || ''));
  rcDrop('cart:' + (store.get('selPhone') || ''));
  const onPhone = store.get('selPhone') || '';
  const summary = store.get('summary');
  const cart = store.get('cart');
  let what = '';
  const src = (summary?.items?.length) ? summary.items : cart;
  if (src?.length) {
    what = src[0].name || src[0].product || '';
    if (src.length > 1) what += ' +' + (src.length - 1) + ' more';
  }
  store.set({ product: null, selVar: null, summary: null, cart: [] });
  if (store.get('tab') !== 'cart') window.__switchTab('cart', true);
  const card = `<div class="prod"><div class="card tc" style="padding:26px 20px">
    <div class="success-anim">${svg('check')}</div>
    <div style="font-size:18px;font-weight:800">Order Placed!</div>
    <div style="font-size:13px;color:var(--text2);margin-top:4px">Order #${esc(r.order_num)}</div>
    ${what ? `<div style="font-size:13px;font-weight:600;margin-top:10px;padding:0 6px">${esc(what)}</div>` : ''}
    <div class="irow" style="margin-top:16px;text-align:left"><span class="k">Amount</span><span class="v">${money(r.amount)}</span></div>
    ${onPhone ? `<div class="irow" style="text-align:left"><span class="k">Account</span><span class="v">${esc(onPhone)}</span></div>` : ''}
    <div class="irow" style="text-align:left"><span class="k">Status</span><span class="v"><span class="pill pill-green">${esc(r.status || 'Confirmed')}</span></span></div>
    <button class="btn btn-m mt14" onclick="window.__switchTab('orders')">${svg('box')} View Orders</button>
    <button class="btn btn-ghost mt10" onclick="window.__switchTab('account')">Order More</button>
  </div></div>`;
  const pv = document.getElementById('prod-view');
  if (pv) pv.innerHTML = card; else window.__switchTab('orders', true);
  haptic('medium');
  toast('Order placed successfully!', 'suc');
}

// expose
Object.assign(window, {
  __setPay: m => {
    store.set({ payMethod: m });
    document.querySelectorAll('.pay-opt').forEach(o => o.classList.toggle('sel', o.dataset.pay === m));
    const s = store.get('summary');
    if (s) {
      const amt = money(m === 'cod' ? s.cod : (s.upi || s.cod));
      ['pay-amt2', 'btn-amt'].forEach(id => { const e = document.getElementById(id); if (e) e.textContent = amt; });
    }
    haptic('light');
  },
  __backToCart: () => {
    if (store.get('summary')) discardCheckout();
    store.set({ summary: null });
    const pv = document.getElementById('prod-view'); if (pv) pv.innerHTML = '';
    const lc = document.getElementById('link-card'); if (lc) lc.style.display = '';
    import('./cart.js').then(m => m.renderCartSection());
  },
  __placeOrder: async () => {
    const s = store.get('summary');
    if (!s?.free && (s?.slots || 0) <= 0) return toast('No slots left — buy slots in the bot chat.', 'err');
    const btn = document.getElementById('place-btn');
    const method = store.get('payMethod') || 'upi';

    if (method === 'cod') {
      const cod = Number(s?.cod);
      if (!(cod > 0)) return toast('Reopen checkout to confirm the amount', 'err');
      const ok = await confirm({ title: 'Place COD Order?', body: 'Cash on Delivery · pay ' + money(cod) + ' when it arrives.', ok: 'Place Order', icon: 'cod', slot: true });
      if (!ok) return;
      if (btn) { btn.disabled = true; btn.classList.add('loading'); }
      try {
        const r = await api('/api/checkout/cod', {});
        if (r?.ok) orderSuccess(r);
        else if (r?.error === 'no_slots') toast('No slots left', 'err');
        else if (!r) toast("Couldn't confirm the order — check My Orders before trying again.", 'err');
        else toast('Order failed', 'err');
      } finally { if (btn) { btn.disabled = false; btn.classList.remove('loading'); } }
    } else {
      if (btn) { btn.disabled = true; btn.classList.add('loading'); }
      try {
        const r = await api('/api/checkout/upi', {});
        if (r?.error === 'no_slots') return toast('No slots left', 'err');
        if (!r) return toast("Couldn't confirm — reopen the app to resume the payment.", 'err');
        if (!r.ok) return toast('UPI setup failed', 'err');
        showQr(r);
      } finally { if (btn) { btn.disabled = false; btn.classList.remove('loading'); } }
    }
  },
  __checkPay: async (jp, btn, silent) => {
    if (!silent && _qrPollJp) {
      _qrPollDelay = _QR_POLL_START;
      if (_qrPoll) { clearTimeout(_qrPoll); _qrPoll = setTimeout(qrTick, _qrPollDelay); }
    }
    const st = document.getElementById('qr-st');
    if (st && !silent) { st.className = 'qr-status wait'; st.innerHTML = ico('clock', 13) + ' Checking…'; }
    const r = await api('/api/checkout/check', { juspay_order_id: jp }, { silent: !!silent });
    if (!store.state.sheetOpen) return;
    if (silent && _qrPollJp && jp !== _qrPollJp) return;
    if (r?.ok && r.status === 'success') {
      stopQrPoll();
      if (st) { st.className = 'qr-status ok'; st.innerHTML = ico('check', 13) + ' Payment received'; }
      setTimeout(() => { if (store.state.sheetOpen) { closeSheet(); orderSuccess({ order_num: r.order_num, amount: r.amount, status: 'Confirmed' }); } }, 700);
    } else if (r?.ok && r.status === 'failed') {
      stopQrPoll();
      if (st) { st.className = 'qr-status no'; st.innerHTML = ico('x', 13) + ' ' + esc(r.message || 'Payment failed'); }
    } else if (r?.ok && r.status === 'paid_unplaced') {
      if (st) { st.className = 'qr-status wait'; st.innerHTML = ico('clock', 13) + ' ' + esc(r.message || 'Finalising…'); }
    } else if (!silent && st) {
      st.className = 'qr-status no'; st.innerHTML = ico('x', 13) + ' Not received yet';
    }
  },
  __stopQrPoll: stopQrPoll,
  __startQrPoll: startQrPoll,
  __qrImgFail: img => {
    img.onerror = null;
    const intent = img.getAttribute('data-intent') || '';
    const d = document.createElement('div');
    d.style.cssText = 'font-size:12px;color:var(--text3);text-align:center;padding:24px 8px';
    if (intent) {
      const a = document.createElement('a');
      a.setAttribute('href', intent);
      a.style.cssText = 'color:var(--m-d);font-weight:700';
      a.textContent = 'Tap to pay in your UPI app';
      d.appendChild(a);
    } else { d.textContent = 'QR unavailable — try COD instead.'; }
    img.replaceWith(d);
  },
  __cancelPending: async jp => {
    const ok = await confirm({ title: 'Cancel this payment?', body: 'If you already paid, tap "I have Paid" instead.', ok: 'Cancel payment', danger: true, icon: 'x' });
    if (!ok) return;
    const r = await api('/api/checkout/cancel', { juspay_order_id: jp });
    if (r?.ok) { toast('Payment cancelled', 'info'); closeSheet(); window.__switchTab('account', true); }
    else toast('Could not cancel', 'err');
  }
});