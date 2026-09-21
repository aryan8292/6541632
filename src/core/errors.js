// @ts-check
const MAP = {
  hunt_retry: 'Best offer not found yet — tap "Send OTP" again. You will always get the full discount.',
  timeout: 'That took too long — please try again.',
  server_error: 'Something went wrong on our side — please try again.',
  relogin_needed: 'This account needs to be logged in again (Account tab).',
  already_ordered: 'This account has already placed an order — the welcome bonus is used up.',
  search_failed: 'Search failed — please try again.',
  rate_limited: 'Too many requests — please wait a few minutes and try again.',
  session: 'Session expired — please re-open the app from the bot chat.',
  session_expired: 'This account has expired — re-login it once in the Account tab.',
  no_slots: 'You have no order slots left — buy more in the bot chat.',
  no_ox: "This account can't be refreshed — please re-login it in the Account tab.",
  already_registered: 'This number is already registered on Meesho. The welcome bonus only works on a NEW number, so please use a fresh number.',
  'Invalid referral': 'That referral link or code is invalid — leave it blank to skip.',
  otp_send_failed: "Couldn't send the OTP — please try again in a moment.",
  otp_verify_failed: "Couldn't verify the OTP — please request a new code and try again.",
  'Invalid Meesho product link': 'That doesn’t look like a valid Meesho product link.',
  product_fetch_failed: "Couldn't load that product — check the link and try again.",
  'Product not found': 'That product could not be found — it may be out of stock or removed.',
  'Invalid variation': 'Please pick a valid size / variation.',
  'This item is out of stock': 'This item is out of stock on Meesho.',
  'Your Meesho cart is empty (nothing added in the Meesho app)': 'Your Meesho cart is empty — add a product first.',
  'Set your delivery address first': 'Please set your delivery address first (Address tab).',
  'Pincode must be 6 digits': 'Pincode must be exactly 6 digits.',
  'Order data expired, start over': 'Your order details expired — please start the order again.',
  network: 'Network issue — please try again.',
  processing: 'Your order is being placed — please wait.'
};

export function friendly(e) {
  if (!e) return 'Something went wrong — please try again.';
  const s = String(e).trim();
  if (MAP[s]) return MAP[s];
  const lc = s.toLowerCase();
  for (const k in MAP) if (k.toLowerCase() === lc) return MAP[k];
  if (/[{}\[\]]|Traceback|Exception|Error:|HTTP\s?\d|Proxy failed|status\s?\d/i.test(s))
    return 'Something went wrong — please try again.';
  if (s.length > 240) return 'Something went wrong — please try again.';
  if (/^[a-z0-9_]+$/.test(s)) return 'Something went wrong — please try again.';
  return s;
}