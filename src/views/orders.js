// @ts-check
import { api } from '../core/api.js';
import { rcGet, rcSet, rcFresh, rcDrop, rcGen, rcSetIf } from '../core/cache.js';
import { store } from '../core/store.js';
import { toast } from '../core/toast.js';
import { svg, ico } from '../lib/icons.js';
import { esc, money, imgSize } from '../lib/format.js';
import { config } from '../core/config.js';

export async function renderOrders(bg) {
  const all = store.get('ordScope') === 'all';
  const ck = all ? 'orders:ALL' : 'orders:' + (store.get('selPhone') || '');
  if (!bg) {
    const cached = rcGet(ck, config.ttl.orders);
    if (cached) {
      paintOrders(cached);
      if (rcFresh(ck, config.fresh.orders)) return;
      return renderOrders(true);
    }
    skeleton();
  }
  const ph = store.get('selPhone');
  const sc = store.get('ordScope');
  const r = await api(all ? '/api/orders/all' : ('/api/orders' + (ph ? '?phone=' + encodeURIComponent(ph) : '')));
  if (sc !== store.get('ordScope')) return;
  if (!all && ph !== store.get('selPhone')) return;
  if (r?.ok) rcSet(ck, r);
  if (bg && !r?.ok) return;
  paintOrders(r);
}

function skeleton() {
  document.getElementById('pg-orders').innerHTML =
    Array(3).fill('<div class="sk-row"><div class="sk sk-av"></div><div class="sk-lines"><div class="sk sk-l1"></div><div class="sk sk-l2"></div></div></div>').join('');
}

function ordTabs(r) {
  const all = store.get('ordScope') === 'all';
  const n = r?.ok && Array.isArray(r.orders) ? r.orders.length : null;
  const cAll = all && n !== null ? ` <span class="ot-n">${n}</span>` : '';
  const cAcc = !all && n !== null ? ` <span class="ot-n">${n}</span>` : '';
  const sync = all ? `<button class="acc-sync ord-sync" onclick="window.__refreshAllOrders(this)">${svg('refresh')}<span>Update</span></button>` : '';
  return `<div class="ord-tabs">
    <button class="ord-tab${all ? '' : ' on'}" onclick="window.__setOrdScope('acc')">This account${cAcc}</button>
    <button class="ord-tab${all ? ' on' : ''}" onclick="window.__setOrdScope('all')">All orders${cAll}</button>
  </div>${sync ? `<div class="ord-sync-row">${sync}</div>` : ''}`;
}

function paintOrders(r) {
  const all = store.get('ordScope') === 'all';
  if (all && r?.ok && Array.isArray(r.orders)) {
    store.set({ ordAll: r.orders.slice(), ordNext: r.next_offset ?? null });
  }
  const who = all
    ? (r?.accounts ? `Across ${r.accounts} account${r.accounts === 1 ? '' : 's'}` : 'Every account')
    : (store.get('selPhone') ? 'Orders for ' + store.get('selPhone') : 'Select an account to view its orders');
  let h = `<div class="sec-title">My Orders<span>${who}</span></div>` + ordTabs(r);
  if (!r?.ok) { document.getElementById('pg-orders').innerHTML = h + errBox(); return; }
  if (r.need_account && !all) {
    document.getElementById('pg-orders').innerHTML = h + empty('user', 'No account selected', 'Pick an account to see its orders.') +
      `<div style="padding:0 16px"><button class="btn btn-outline" onclick="window.__switchTab('account')">${svg('user')} Choose Account</button></div>`;
    return;
  }
  const orders = all ? store.get('ordAll') : (r.orders || []);
  if (!all) store.set({ lastAccOrders: orders });
  if (!orders.length) {
    document.getElementById('pg-orders').innerHTML = h + empty('box', 'No orders yet', all ? 'Orders from every account will appear here.' : 'Orders placed on this account will appear here.');
    return;
  }
  store.state._ordHead = h;
  renderOrderList();
}

export function renderOrderList() {
  const all = store.get('ordScope') === 'all';
  const orders = all ? store.get('ordAll') : store.get('lastAccOrders');
  let h = store.state._ordHead;
  h += '<div style="padding:0 16px">' + orders.map(o => {
    const pill = statusPill(o.status);
    const thumb = o.image ? `<img loading="lazy" src="${esc(imgSize(o.image, 128))}" onerror="this.remove()">` : svg('box');
    const bits = [o.amount ? money(o.amount) : ''];
    if (all && o.phone) bits.unshift(esc(o.phone));
    const sub = bits.filter(Boolean).join(' · ') || esc(o.phone || '');
    return `<div class="ord-card" onclick="window.__showOrderDetail('${esc(o.order_num)}','${esc(o.phone || '')}')">
      <div class="ord-ic">${thumb}</div>
      <div class="ord-info">
        <div class="ord-num">${o.product ? esc(String(o.product)) : '#' + esc(o.order_num)}</div>
        <div class="ord-meta">${sub}</div>
      </div>
      <div>${pill}</div>
      <div class="ord-chev">${svg('chevR')}</div>
    </div>`;
  }).join('') + '</div>';
  if (all && store.get('ordNext') != null) {
    h += `<div style="padding:8px 16px 20px"><button class="btn btn-outline" style="width:100%" onclick="window.__loadMoreOrders(this)">Load more</button></div>`;
  }
  document.getElementById('pg-orders').innerHTML = h;

  // Prefetch top 3 details
  setTimeout(() => {
    if (document.visibilityState === 'hidden') return;
    orders.slice(0, 3).forEach(o => {
      if (!o?.order_num) return;
      const ph = o.phone || store.get('selPhone') || '';
      const k = 'od:' + ph + ':' + o.order_num;
      if (rcGet(k, 120000)) return;
      api('/api/orders/' + encodeURIComponent(o.order_num) + (ph ? '?phone=' + encodeURIComponent(ph) : ''))
        .then(d => { if (d?.ok) rcSet(k, d); }).catch(() => {});
    });
  }, 200);
}

function statusPill(s) {
  const k = (s || '').toLowerCase();
  let c = 'pill-gray';
  if (k.includes('deliver')) c = 'pill-green';
  else if (k.includes('ship') || k.includes('dispatch')) c = 'pill-m';
  else if (k.includes('cancel')) c = 'pill-red';
  else if (k.includes('order') || k.includes('confirm')) c = 'pill-green';
  const label = (s || 'Placed').replace(/\b\w/g, ch => ch.toUpperCase());
  return `<span class="pill ${c}" style="text-transform:uppercase;letter-spacing:.4px;font-size:10px">${esc(label)}</span>`;
}

function empty(ic, t, p) { return `<div class="empty"><div class="e-ic">${svg(ic)}</div><h3>${esc(t)}</h3><p>${esc(p)}</p></div>`; }
function errBox() {
  return `<div class="empty"><div class="e-ic">${svg('refresh')}</div><h3>Couldn't load</h3><p>Check your connection and try again.</p>
    <div style="margin-top:14px"><button class="btn btn-outline" style="width:auto;padding:0 20px;margin:0 auto" onclick="window.__renderOrders()">${svg('refresh')} Retry</button></div></div>`;
}

// expose
Object.assign(window, {
  __renderOrders: () => renderOrders(),
  __setOrdScope: sc => { store.set({ ordScope: sc }); renderOrders(); },
  __loadMoreOrders: async btn => {
    if (store.state._ordMoreBusy || store.get('ordNext') == null) return;
    store.state._ordMoreBusy = true;
    if (btn) { btn.disabled = true; btn.innerHTML = 'Loading…'; }
    try {
      const r = await api('/api/orders/all?offset=' + store.get('ordNext'));
      if (store.get('ordScope') !== 'all') return;
      if (r?.ok && Array.isArray(r.orders)) {
        store.set({ ordAll: store.get('ordAll').concat(r.orders), ordNext: r.next_offset ?? null });
        renderOrderList();
      }
    } finally {
      store.state._ordMoreBusy = false;
      if (btn) { btn.disabled = false; btn.innerHTML = 'Load more'; }
    }
  },
  __refreshAllOrders: async btn => {
    if (store.state._ordSync) return;
    store.state._ordSync = true;
    store.state._ordSyncStop = false;
    const lbl = btn?.querySelector('span');
    const old = lbl?.textContent || '';
    if (btn) { btn.classList.add('busy'); btn.disabled = true; }
    const n = store.get('accounts').length;
    if (lbl) lbl.textContent = n > 25 ? `Checking 0/${n}…` : 'Checking…';
    let off = 0, tot = 0, live = 0, checked = 0, guard = 0;
    try {
      while (true) {
        if (++guard > 60) break;
        const r = await api('/api/accounts/refresh', { offset: off }, { timeout: 60000 });
        if (!(r?.ok && Array.isArray(r.accounts))) {
          if (checked === 0) return toast('Could not check orders', 'err');
          break;
        }
        tot = r.total || tot; checked += r.checked || 0; live += r.live || 0;
        const by = {};
        r.accounts.forEach(x => { if (x?.phone) by[x.phone] = x; });
        store.get('accounts').forEach(a => {
          const x = by[a.phone];
          if (!x || !x.ok) return;
          a.order_status = x.stage || '';
          a.stage_key = x.stage_key || '';
          a.stage_detail = x.detail || '';
          a.placed = (x.orders || 0) > 0;
        });
        rcSet('accounts', store.get('accounts'));
        const { renderAccount } = await import('./account.js');
        // repaint account list from store
        import('./account.js');
        if (lbl && tot > 25) lbl.textContent = `Checking ${Math.min(checked, tot)}/${tot}…`;
        off = r.next_offset || (off + (r.checked || 0));
        if (r.done || !r.checked) break;
        if (store.state._ordSyncStop) break;
      }
      rcDrop('orders:ALL');
      if (store.get('tab') === 'orders' && store.get('ordScope') === 'all') renderOrders();
      toast(live === checked ? `Checked ${checked} account${checked === 1 ? '' : 's'}` : `Checked ${live} of ${checked}`, live ? 'suc' : 'err');
    } catch {
      if (checked > 0) { rcDrop('orders:ALL'); if (store.get('tab') === 'orders') renderOrders(); toast(`Checked ${checked} of ${tot || checked}`, 'err'); }
      else toast('Could not check orders', 'err');
    } finally {
      store.state._ordSync = false;
      if (btn) { btn.classList.remove('busy'); btn.disabled = false; }
      if (lbl) lbl.textContent = old || 'Check orders';
    }
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') store.state._ordSyncStop = true;
});