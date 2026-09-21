// @ts-check
import { api } from '../core/api.js';
import { store } from '../core/store.js';
import { toast, haptic } from '../core/toast.js';
import { openSheet, closeSheet } from '../core/sheet.js';
import { svg, ico } from '../lib/icons.js';
import { esc, money, imgSize } from '../lib/format.js';

let _timer = null;
let _srchQ = '', _srchCursor = null, _srchOffset = 0, _srchSsid = null, _srchMore = false, _srchLoading = false;
let _sheetProd = null, _sheetVar = null, _sheetQty = 1;

export async function renderSearch() {
  const sel = store.get('selPhone');
  let h = `<div class="sec-title">Search<span>${sel ? 'Ordering from ' + esc(sel) : 'Pick an account to search & add'}</span></div>`;
  if (!sel) {
    h += emptyBox('search', 'No account selected', 'Go to the Account tab and pick a fresh account first.') +
      `<div style="padding:0 16px"><button class="btn btn-outline" onclick="window.__switchTab('account')">${svg('user')} Choose Account</button></div>`;
    document.getElementById('pg-search').innerHTML = h;
    return;
  }
  h += `<div style="padding:0 16px 6px">
    <div class="srch-bar">
      <span class="srch-bar-ic">${svg('search')}</span>
      <input class="srch-input" id="sr-q" placeholder="Search e.g. oats, dry fruit, kurti" autocomplete="off"
        oninput="window.__onSearchInput()"
        onkeydown="if(event.key==='Enter'){window.__closeSugg();window.__doSearch()}">
      <button class="srch-go" onclick="window.__closeSugg();window.__doSearch()">${svg('chevR')}</button>
    </div>
    <div id="sr-sugg" class="search-sugg"></div>
  </div>
  <div id="sr-results"></div>`;
  document.getElementById('pg-search').innerHTML = h;
  document.getElementById('sr-results').innerHTML =
    emptyBox('search', 'Search Meesho', 'Type a product name above and tap search.');
}

function emptyBox(ic, t, p) {
  return `<div class="empty"><div class="e-ic">${svg(ic)}</div><h3>${esc(t)}</h3><p>${esc(p)}</p></div>`;
}

async function doSearch() {
  const q = document.getElementById('sr-q')?.value.trim();
  if (!q) return toast('Type something to search', 'err');
  const res = document.getElementById('sr-results');
  if (res) res.innerHTML = '<div class="srch-grid" style="padding:12px 16px"><div class="sk sk-card"></div><div class="sk sk-card"></div><div class="sk sk-card"></div><div class="sk sk-card"></div></div>';
  _srchQ = q; _srchCursor = null; _srchOffset = 0; _srchSsid = null;

  const r = await api('/api/search', { phone: store.get('selPhone'), q });
  if (!r?.ok) { if (res) res.innerHTML = ''; return toast('Search failed', 'err'); }
  const items = r.items || [];
  _srchCursor = r.cursor || null;
  _srchOffset = r.next_offset || 0;
  _srchSsid = r.search_session_id || null;
  _srchMore = !!r.cursor;

  if (!items.length) {
    if (res) res.innerHTML = emptyBox('search', 'No results', 'Try a different word.');
    return;
  }
  renderResults(items, r.corrected, q);
  store.state._searchItems = items;
}

function renderResults(items, corrected, q) {
  const res = document.getElementById('sr-results');
  if (!res) return;
  const corr = (corrected && corrected !== q)
    ? `<div class="hint" style="margin:0 16px 8px">Showing results for <b>${esc(corrected)}</b></div>` : '';
  const grid = '<div class="srch-grid">' + items.map((it, i) => {
    const upi = it.upi != null ? ('₹' + it.upi) : ('₹' + (it.price || '?'));
    const off = it.discount_text ? `<span class="srch-off">${esc(it.discount_text)}</span>` : '';
    return `<div class="srch-card">
      <div class="srch-img" onclick="window.__openAddSheet('${it.pid}',${i})">
        ${it.mall ? '<span class="srch-mall">MALL</span>' : ''}
        <img loading="lazy" decoding="async" src="${esc(imgSize(it.image, 256))}" data-full="${esc(it.image || '')}" onerror="window.__imgFallback(this)" alt="">
      </div>
      <div class="srch-name" onclick="window.__openAddSheet('${it.pid}',${i})">${esc(it.name || 'Product')}</div>
      <div class="srch-price"><b>${upi}</b>${it.mrp ? ` <s>₹${it.mrp}</s>` : ''}</div>
      ${it.rating ? `<div class="srch-rate">${ico('star', 10)} ${(+it.rating).toFixed(1)}</div>` : ''}
      ${off}
      <button class="srch-addbtn" id="sadd-${i}" onclick="window.__openAddSheet('${it.pid}',${i})">${svg('plus')} Add</button>
    </div>`;
  }).join('') + '</div>';
  const more = _srchMore
    ? `<div style="padding:4px 16px 16px"><button class="btn btn-outline" id="sr-more" onclick="window.__loadMoreSearch()">${svg('chevD')} Load More</button></div>`
    : '';
  res.innerHTML = corr + grid + more;
}

async function loadMoreSearch() {
  if (_srchLoading || !_srchMore) return;
  _srchLoading = true;
  const btn = document.getElementById('sr-more');
  if (btn) { btn.disabled = true; btn.innerHTML = 'Loading…'; }
  try {
    const r = await api('/api/search', {
      phone: store.get('selPhone'), q: _srchQ, offset: _srchOffset,
      cursor: _srchCursor, search_session_id: _srchSsid
    });
    if (r?.ok && (r.items || []).length) {
      const seen = new Set(store.state._searchItems?.map(x => String(x.pid)) || []);
      const fresh = (r.items || []).filter(x => !seen.has(String(x.pid)));
      store.state._searchItems = (store.state._searchItems || []).concat(fresh);
      _srchCursor = r.cursor || null;
      _srchOffset = r.next_offset || _srchOffset;
      _srchSsid = r.search_session_id || _srchSsid;
      _srchMore = !!r.cursor && fresh.length > 0;
      renderResults(store.state._searchItems, '', _srchQ);
    } else { _srchMore = false; renderResults(store.state._searchItems, '', _srchQ); }
  } finally {
    _srchLoading = false;
    if (btn) { btn.disabled = false; btn.innerHTML = 'Load more'; }
  }
}

async function openAddSheet(pid, i) {
  const btn = document.getElementById('sadd-' + i);
  if (btn) { btn.disabled = true; btn.innerHTML = '…'; }
  haptic('light');

  const pre = store.state._searchItems?.[i];
  if (pre) {
    openSheet(`<div class="sheet-h"><div class="st">Add to Cart</div><button class="sheet-x" onclick="window.closeSheet()">${svg('x')}</button></div>
      <div class="as-top">
        <div class="as-img" style="background-image:url('${esc(imgSize(pre.image, 256))}')"></div>
        <div class="as-info"><div class="as-name">${esc(pre.name || 'Product')}</div>
          <div class="as-upi">${pre.upi != null ? '₹' + esc(pre.upi) : ''}</div></div>
      </div>
      <div style="padding:10px 4px 16px"><div class="sk sk-card"></div></div>`);
  }
  const r = await api('/api/search/product', { phone: store.get('selPhone'), pid });
  if (btn) { btn.disabled = false; btn.innerHTML = svg('plus') + ' Add'; }
  if (!r?.ok || !r.product) return toast('Product not found', 'err');
  _sheetProd = r.product; _sheetVar = null; _sheetQty = 1;
  const p = _sheetProd;
  const vars = p.variations || [];
  const off = p.mrp && p.cod ? Math.round((1 - p.cod / p.mrp) * 100) : 0;
  const img = (p.images || []).filter(Boolean)[0] || '';

  let h = `<div class="sheet-h"><div class="st">Add to Cart</div><button class="sheet-x" onclick="window.closeSheet()">${svg('x')}</button></div>
    <div class="as-scroll">
    <div class="as-top">
      <div class="as-img" style="background-image:url('${esc(img)}')"></div>
      <div class="as-info">
        <div class="as-name">${esc(p.name || 'Product')}</div>
        <div class="as-price"><b>${money(p.cod)}</b>${p.mrp ? ` <s>${money(p.mrp)}</s>` : ''}${off > 0 ? ` <span class="as-off">${off}% off</span>` : ''}</div>
        ${p.upi ? `<div class="as-upi">${ico('upi', 11)} ${money(p.upi)} on UPI${p.cod > p.upi ? ` · save ${money(p.cod - p.upi)}` : ''}</div>` : ''}
        <div class="as-meta">
          ${p.rating ? `<span class="ok">${ico('star', 10)} ${(+p.rating).toFixed(1)}</span>` : ''}
          ${p.mall ? '<span class="mall-badge">MALL</span>' : ''}
          ${p.delivery ? `<span>${ico('truck', 10)} ${esc(p.delivery)}</span>` : ''}
        </div>
        <div class="as-stock ${p.in_stock !== false ? 'ok' : 'no'}">${ico(p.in_stock !== false ? 'check' : 'x', 11)} ${p.in_stock !== false ? 'In stock' : 'Out of stock'}</div>
      </div>
    </div>`;
  if (vars.length) {
    h += `<div class="as-vtitle">Select Size / Variation</div><div class="as-vgrid" id="as-vgrid">`;
    vars.forEach((v, vi) => {
      const price = v.upi || v.cod;
      h += `<div class="var-chip ${v.in_stock !== false ? '' : 'oos'}" data-i="${vi}" onclick="${v.in_stock !== false ? `window.__selSheetVar(${vi})` : ''}">${esc(v.name)}${price ? `<small>${money(price)}</small>` : ''}</div>`;
    });
    h += `</div>`;
  }
  h += `</div>
    <div class="as-foot">
      <div class="as-qtyrow"><span class="as-qtylbl">Quantity</span>
        <div class="as-qty">
          <button class="qty-btn" onclick="window.__sheetQty(-1)">${ico('minus', 14, 'var(--m-d)')}</button>
          <span class="as-qtyv" id="as-qtyv">1</span>
          <button class="qty-btn" onclick="window.__sheetQty(1)">${ico('plus', 14, 'var(--m-d)')}</button>
        </div>
      </div>
      <button class="btn btn-m" id="as-add" onclick="window.__sheetAddToCart()">${svg('cart')} Add to Cart</button>
    </div>`;
  openSheet(h);
  if (vars.length === 1) window.__selSheetVar(0);
}

// Expose
Object.assign(window, {
  __onSearchInput: () => {
    const q = document.getElementById('sr-q')?.value || '';
    clearTimeout(_timer);
    if (q.trim().length < 2) return window.__closeSugg();
    _timer = setTimeout(async () => {
      const r = await api('/api/search/suggest', { phone: store.get('selPhone'), q: q.trim() });
      const el = document.getElementById('sr-sugg');
      if (!el) return;
      const sg = (r?.ok && r.suggestions) || [];
      el.innerHTML = sg.slice(0, 6).map(s =>
        `<div class="sugg-item" data-q="${esc(s)}" onclick="window.__pickSuggest(this.dataset.q)">${svg('search')}<span>${esc(s)}</span></div>`
      ).join('');
    }, 350);
  },
  __pickSuggest: s => { const i = document.getElementById('sr-q'); if (i) i.value = s; window.__closeSugg(); doSearch(); },
  __closeSugg: () => { const s = document.getElementById('sr-sugg'); if (s) s.innerHTML = ''; },
  __doSearch: doSearch,
  __loadMoreSearch: loadMoreSearch,
  __openAddSheet: openAddSheet,
  __selSheetVar: i => {
    _sheetVar = i;
    document.querySelectorAll('#as-vgrid .var-chip').forEach(c => c.classList.toggle('sel', +c.dataset.i === i));
    haptic('light');
  },
  __sheetQty: d => {
    const n = Math.max(1, Math.min(10, _sheetQty + d));
    if (n === _sheetQty) return;
    _sheetQty = n;
    const el = document.getElementById('as-qtyv');
    if (el) el.textContent = String(n);
    haptic('light');
  },
  __sheetAddToCart: async () => {
    haptic('light');
    const p = _sheetProd;
    if (!p) return;
    const vars = p.variations || [];
    if (vars.length > 1 && _sheetVar === null) return toast('Select a size first', 'err');
    let pick = _sheetVar;
    if (pick === null && vars.length) {
      pick = vars.findIndex(v => v.in_stock !== false);
      if (pick < 0) pick = 0;
    }
    const vi = vars.length ? pick : 'default';
    const ph = store.get('selPhone');
    const n = _sheetQty;
    closeSheet();
    toast(n > 1 ? `Added ${n} to cart` : 'Added to cart', 'suc');

    const r = await api('/api/cart/add', { phone: ph, variation: vi, quantity: n });
    if (ph !== store.get('selPhone')) return;
    if (r?.ok) {
      store.set({ cart: r.items || [], cartErr: false });
      const { rcSet } = await import('../core/cache.js');
      rcSet('cart:' + ph, r.items || []);
      const { renderCartSection } = await import('./cart.js');
      renderCartSection();
    } else {
      toast('Could not add', 'err');
      const { loadCart } = await import('./cart.js');
      loadCart();
    }
  },
  __imgFallback: el => {
    const full = el.getAttribute('data-full') || '';
    if (full && !el.dataset.retried) { el.dataset.retried = '1'; el.src = full; return; }
    el.style.display = 'none';
  }
});