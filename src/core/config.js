// @ts-check
export const config = {
  apiBase: '/api',                 // proxied via api/proxy.js
  appName: 'PriceTracker Pro',
  appTagline: 'Order Automation',
  version: '2.0.0',
  // Cache TTLs (ms) — mirrors the tuned values from the original
  ttl: {
    accounts:  60_000,
    address:   900_000,
    cart:      60_000,
    orders:    120_000,
    refstats:  600_000,
    orderDetail: 120_000
  },
  fresh: {
    accounts: 30_000,
    cart:     15_000,
    orders:   30_000,
    orderDetail: 30_000,
    refstats: 60_000,
    address:  900_000
  }
};