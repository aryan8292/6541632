// @ts-check
const state = {
  tab: 'account',
  accounts: [],
  selPhone: null,
  product: null,
  selVar: null,
  payMethod: 'upi',
  summary: null,
  cart: [],
  cartErr: false,
  cartRelogin: false,
  ordScope: 'acc',
  ordAll: [],
  ordNext: null,
  lastAccOrders: [],
  lastOrderAddr: null,
  myRef: '',
  sessionDead: false
};

const subs = new Set();
export const store = {
  state,
  get: k => state[k],
  set(patch) {
    Object.assign(state, patch);
    subs.forEach(fn => { try { fn(patch); } catch (e) { console.error(e); } });
  },
  sub(fn) { subs.add(fn); return () => subs.delete(fn); }
};