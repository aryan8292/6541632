// @ts-check
import { svg } from '../lib/icons.js';
import { store } from '../core/store.js';
import { renderAccount } from './account.js';
import { renderAddress } from './address.js';
import { renderSearch } from './search.js';
import { renderCart } from './cart.js';
import { renderOrders } from './orders.js';

const TABS = [
  { id: 'account', label: 'Account', icon: 'user' },
  { id: 'address', label: 'Address', icon: 'pin' },
  { id: 'search',  label: 'Search',  icon: 'search' },
  { id: 'cart',    label: 'Cart',    icon: 'cart' },
  { id: 'orders',  label: 'Orders',  icon: 'box' }
];

export function renderNav() {
  const el = document.getElementById('nav');
  el.innerHTML = TABS.map(t =>
    `<button class="nav-btn${t.id==='account'?' active':''}" id="nav-${t.id}" onclick="window.__switchTab('${t.id}')">
      ${svg(t.icon)}<span>${t.label}</span>
    </button>`).join('');
}

const RENDER = {
  account: renderAccount,
  address: renderAddress,
  search: renderSearch,
  cart: renderCart,
  orders: renderOrders
};

export function switchTab(t, force) {
  const state = store.state;
  const same = state.tab === t;
  if (state.tab === 'cart' && t !== 'cart' && state.summary) {
    import('./checkout.js').then(m => m.discardCheckout());
  }
  store.set({ tab: t });
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('pg-' + t)?.classList.add('active');
  document.getElementById('nav-' + t)?.classList.add('active');

  const fn = RENDER[t];
  if (!fn) return;
  if (force || !same || !document.getElementById('pg-' + t)?.innerHTML.trim()) fn();
}

// expose
window.__switchTab = switchTab;