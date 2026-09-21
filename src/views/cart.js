// @ts-check
import { api } from '../core/api.js';
import { rcGet, rcSet, rcFresh, rcDrop } from '../core/cache.js';
import { store } from '../core/store.js';
import { toast, haptic } from '../core/toast.js';
import { confirm } from '../core/confirm.js';
import { svg, ico } from '../lib/icons.js';
import { esc, money, imgSize } from '../lib/format.js';
import { config } from '../core/config.js';

let _cartGen = 0;
let _checkoutBusy = false;

export async function renderCart() {
  const sel = store.get('selPhone');
  if (sel && store.get('accounts').length && !store.get('accounts').some(a => a.phone === sel))
    store.set({ selPhone: null });

  let h = `<div class="sec-title">Cart<span>${sel ? 'Ordering from ' + esc(sel) : 'Select an account, then add a product'}</span></div>`;
  if (!sel) {
    h += emptyBox('user', 'No account selected', 'Go to the Account tab and pick a fresh account first.') +
      `<div style="padding:0 16px"><button class="btn btn-outline" onclick="window.__switchTab('account')">${svg('user')} Choose Account</button></div>`;
    document.getElementById('pg-cart').innerHTML = h;
    return;
  }
  h += `<div class="card" id="link-card">
    <div class="card-title"><div class="ct-ic">${svg('link')}</div>Add Product<span class="ct-sub">${esc(sel)}</span></div>
    <div class="field"><input class="inp" id="pd-link" placeholder="Paste Meesho product link"></div>
    <button class="btn btn-m" onclick="window.__fetchProduct()">${svg('bag')} Fetch Product</button>
    <button class="btn btn-outline mt10" onclick="window.__importMeeshoCart()">${svg('cart')} Load my Meesho cart</button>
  </div>
  <div id="prod-view"></div>
  <div id="cart-view"></div>`;
  document.getElementById('pg-cart').innerHTML = h;
  if (store.get('product')) renderProduct();
  loadCart();
}

export async function loadCart(bg) {
  const sel = store.get('selPhone');
  if (!sel) { store.set({ cart: [], cartErr: false }); renderCartSection(); return; }
  const ck = 'cart:' + sel;
  if (!bg) {
    const cached = rcGet(ck, config.ttl.cart);
    if (cached && !store.get('summary')) {
      store.set({ cart: cached, cartErr: false, cartRelogin: false });
      renderCartSection();
      if (rcFresh(ck, config.fresh.cart)) return;
      return loadCart(true);
    }
  }
  const ph = sel;
  const r = await api('/api/cart', { phone: ph });
  if (ph !== store.get('selPhone')) return;
  if (r?.ok) rcSet(ck, r.items || []);
  if (bg && !r?.ok) return;
  if (r?.ok) store.set({ cart: r.items || [], cartErr: false, cartRelogin: false });
  else store.set({ cartErr: true, cartRelogin: r?.error === 'session_expired' || !!r?.relogin });
  renderCartSection();
}

export function renderCartSection() {
  const el = document.getElementById('cart-view');
  if (!el) return;
  if (store.get('summary')) { el.innerHTML = ''; return; }
  const cart = store.get('cart');
  if (store.get('cartErr') && store.get('cartRelogin')) {
    el.innerHTML = emptyBox('user', 'Session expired', 'Re-login this number once in the Account tab.') +
      `<div style="padding:0 16px"><button class="btn btn-outline" onclick="window.__switchTab('account')">${svg('user')} Go to Account</button></div>`;
    return;
  }
  if (store.get('cartErr')) {
    el.innerHTML = emptyBox('cart', "Couldn't load your cart", 'Connection issue — please try again.') +
      `<div style="padding:0 16px"><button class="btn btn-outline" onclick="window.__loadCart()">${svg('refresh')} Retry</button></div>`;
    return;
  }
  if (!cart.length) {
    el.innerHTML = emptyBox('cart', 'Your cart is empty', 'Paste a product link above to add items.');
    return;
  }
  const n = cart.length;
  const total = cart.reduce((s, i) => s + (i.cod || 0) * (i.quantity || 1), 0);
  let h = `<div class="card"><div class="card-title"><div class="ct-ic">${svg('cart')}</div>Your Cart<span class="ct-sub">${n} item${n > 1 ? 's' : ''}</span></div>`;
  h += cart.map(i => {
    const q = i.quantity || 1;
    const mx = i.max_quantity || 0;
    const atMax = mx > 0 && q >= mx;
    return `<div class="cart-row">
      <div class="cart-thumb">${i.image ? `<img loading="lazy" src="${esc(imgSize(i.image, 128))}" data-full="${esc(i.image)}" onerror="window.__imgFallback(this)">` : svg('bag')}</div>
      <div class="cart-info"><div class="cart-nm">${esc(i.name)}</div>
        <div class="cart-mt">${i.variation ? esc(i.variation) : 'Free Size'} · ${money(i.cod)}</div>
        <div class="qty-step">
          <button class="qty-btn" onclick="window.__changeQty('${esc(i.id)}',-1)">${q <= 1 ? ico('trash', 13, 'var(--red)') : ico('minus', 14, 'var(--m-d)')}</button>
          <span class="qty-val">${q}</span>
          <button class="qty-btn ${atMax ? 'dis' : ''}" ${atMax ? 'disabled' : ''} onclick="window.__changeQty('${esc(i.id)}',1)">${ico('plus', 14, 'var(--m-d)')}</button>
        </div>
      </div>
      <div class="cart-price">${money((i.cod || 0) * q)}</div>
    </div>`;
  }).join('');
  h += `<div class="cart-total-bar"><span class="ctb-l">Total</span><span class="ctb-r">${money(total)}</span></div>`;
  h += `<button class="btn btn-m mt14" onclick="window.__cartCheckout()">${svg('chevR')} Proceed to Checkout</button></div>`;
  el.innerHTML = h;
}

function renderProduct() {
  const p = store.get('product');
  if (!p) return;
  const off = p.mrp && p.cod ? Math.round((1 - p.cod / p.mrp) * 100) : 0;
  const vars = p.variations || [];
  const imgList = (p.images || []).filter(Boolean);
  let imgs = imgList.map(u => `<img loading="lazy" src="${esc(u)}" onerror="this.style.display='none'">`).join('')
    || `<div style="height:210px;display:flex;align-items:center;justify-content:center;color:var(--text4)">${svg('bag')}</div>`;
  let h = `<div class="prod"><div class="prod-card">
    <div class="prod-hero"><div class="prod-imgs" id="prod-imgs">${imgs}</div>
      ${p.fod_value ? `<div class="prod-fod">${ico('gift', 12, '#fff')} ₹${p.fod_value} OFF</div>` : ''}</div>
    <div class="prod-body">
      ${p.brand ? `<div class="prod-brand">${esc(p.brand)}</div>` : ''}
      <div class="prod-name">${esc(p.name)}</div>
      <div class="prod-price">
        <span class="pp">${money(p.cod)}</span>
        ${p.mrp ? `<span class="pm">${money(p.mrp)}</span>` : ''}
        ${off > 0 ? `<span class="po">${off}% off</span>` : ''}
      </div>
      ${p.upi ? `<div class="prod-upi">${ico('upi', 12)} <b>${money(p.upi)}</b> on UPI</div>` : ''}
      <div class="prod-meta">
        ${p.rating ? `<span class="ok">${ico('star', 11)} ${(+p.rating).toFixed(1)}</span>` : ''}
        ${p.mall ? '<span class="mall-badge">MALL</span>' : ''}
        <span class="${p.in_stock !== false ? 'ok' : 'no'}">${ico(p.in_stock !== false ? 'check' : 'x', 11)} ${p.in_stock !== false ? 'In stock' : 'Out of stock'}</span>
      </div>`;
  if (vars.length) {
    h += `<div class="var-title">Select Size / Variation</div><div class="var-grid" id="var-grid">`;
    vars.forEach((v, i) => {
      const price = v.upi || v.cod;
      h += `<div class="var-chip ${v.in_stock !== false ? '' : 'oos'}" data-i="${i}" onclick="${v.in_stock !== false ? `window.__selectVar(${i})` : ''}">${esc(v.name)}${price ? `<small>${money(price)}</small>` : ''}</div>`;
    });
    h += `</div>`;
  }
  h += `</div></div>
    <div style="padding:0 16px"><button class="btn btn-m" onclick="window.__addToCart()">${svg('cart')} Add to Cart</button></div></div>`;
  const lc = document.getElementById('link-card');
  if (lc) lc.style.display = '';
  document.getElementById('prod-view').innerHTML = h;
  if (vars.length === 1) window.__selectVar(0);
}

function emptyBox(ic, t, p) {
  return `<div class="empty"><div class="e-ic">${svg(ic)}</div><h3>${esc(t)}</h3><p>${esc(p)}</p></div>`;
}

// Expose
Object.assign(window, {
  __loadCart: () => loadCart(),
  __fetchProduct: async () => {
    const link = document.getElementById('pd-link')?.value.trim();
    if (!link) return toast('Paste a product link', 'err');
    const r = await api('/api/product', { phone: store.get('selPhone'), link });
    if (!r?.ok || !r.product) return toast('Product not found', 'err');
    store.set({ product: r.product, selVar: null, summary: null });
    renderProduct();
  },
  __importMeeshoCart: async () => {
    const r = await api('/api/cart/import', { phone: store.get('selPhone') });
    if (!r?.ok) return toast(r?.error === 'cart_empty' ? 'Your Meesho cart is empty' : 'Nothing to import', 'err');
    store.set({ summary: null, cartErr: false, cart: r.items || [] });
    renderCartSection();
    toast(r.added > 0 ? `Loaded ${r.added} item${r.added > 1 ? 's' : ''}` : 'Already in cart', 'suc');
  },
  __selectVar: i => {
    store.set({ selVar: i });
    document.querySelectorAll('#var-grid .var-chip').forEach(c => c.classList.toggle('sel', +c.dataset.i === i));
    haptic('light');
  },
  __addToCart: async () => {
    haptic('light');
    const p = store.get('product');
    if (!p) return toast('Reopen the product and try again', 'err');
    const vars = p.variations || [];
    let sel = store.get('selVar');
    if (vars.length > 1 && sel === null) return toast('Select a size first', 'err');
    if (sel === null && vars.length) {
      sel = vars.findIndex(v => v.in_stock !== false);
      if (sel < 0) sel = 0;
    }
    const vi = vars.length ? sel : 'default';
    const ph = store.get('selPhone');
    store.set({ product: null, selVar: null });
    const pv = document.getElementById('prod-view'); if (pv) pv.innerHTML = '';
    const link = document.getElementById('pd-link'); if (link) link.value = '';
    toast('Added to cart', 'suc');
    const r = await api('/api/cart/add', { phone: ph, variation: vi });
    if (ph !== store.get('selPhone')) return;
    if (r?.ok) {
      store.set({ cart: r.items || [], cartErr: false });
      rcSet('cart:' + ph, r.items || []);
      renderCartSection();
    } else {
      toast('Could not add', 'err');
      loadCart();
    }
  },
  __changeQty: async (id, delta) => {
    const gen = ++_cartGen;
    const prev = store.get('cart').map(x => ({ ...x }));
    const it = prev.find(x => String(x.id) === String(id));
    if (delta < 0 && it && (it.quantity || 1) <= 1) {
      const ok = await confirm({ title: 'Remove item?', body: esc(it.name || 'This item') + ' will be removed from your cart.', ok: 'Remove', danger: true, icon: 'trash' });
      if (!ok) return;
    }
    const cart = store.get('cart').map(x => ({ ...x }));
    const item = cart.find(x => String(x.id) === String(id));
    if (item) {
      item.quantity = Math.max(0, (item.quantity || 1) + delta);
      if (item.quantity <= 0) {
        store.set({ cart: cart.filter(x => String(x.id) !== String(id)) });
      } else {
        store.set({ cart });
      }
      renderCartSection();
      haptic('light');
    }
    const ph = store.get('selPhone');
    const r = await api('/api/cart/qty', { phone: ph, id, delta });
    if (ph !== store.get('selPhone')) return;
    if (r?.ok) {
      store.set({ cart: r.items || [] });
      renderCartSection();
      rcSet('cart:' + ph, r.items || []);
    } else {
      if (gen === _cartGen) { store.set({ cart: prev }); renderCartSection(); }
      toast('Could not update quantity', 'err');
    }
  },
  __cartCheckout: async () => {
    if (_checkoutBusy) return;
    _checkoutBusy = true;
    try {
      const r = await api('/api/cart/checkout', {});
      if (r?.error === 'no_slots') return toast('No slots left — buy slots in the bot chat.', 'err');
      if (!r?.ok) return toast('Checkout failed', 'err');
      if (r.skipped?.length) toast('Skipped: ' + r.skipped.join(', '), 'err');
      store.set({ summary: r });
      const { renderCheckout } = await import('./checkout.js');
      renderCheckout(r);
    } finally { _checkoutBusy = false; }
  }
});