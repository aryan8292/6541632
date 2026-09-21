// @ts-check
const _rc = {};
let _gen = 0;

export function rcGet(key, maxAgeMs) {
  const e = _rc[key];
  if (!e) return null;
  if (maxAgeMs && Date.now() - e.t > maxAgeMs) return null;
  return e.v;
}
export function rcSet(key, v) { _rc[key] = { v, t: Date.now() }; }
export function rcFresh(key, freshMs) {
  const e = _rc[key];
  return !!(e && Date.now() - e.t < freshMs);
}
export function rcGen() { return _gen; }
export function rcSetIf(key, v, gen, phone) {
  if (gen !== _gen) return false;
  if (phone !== undefined && phone !== _selPhone) return false;
  rcSet(key, v); return true;
}
export function rcDrop(key) {
  _gen++;
  if (key) delete _rc[key];
  else for (const k in _rc) delete _rc[k];
}
export function rcDropAccount() {
  _gen++;
  for (const k in _rc) {
    if (k.startsWith('cart:') || k.startsWith('orders:') || k === 'refstats') delete _rc[k];
  }
}

// Imported lazily to avoid a cycle
let _selPhone = null;
export const _setCachePhone = p => { _selPhone = p; };