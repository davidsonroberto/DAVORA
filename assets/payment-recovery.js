// A short-lived order token is kept only in this tab. Never persist buyer data
// or a Stripe client secret in browser storage.
const STORAGE = 'davora-payment-session-v1';

export function validPaymentRecord(record, now = Date.now()) {
  return Boolean(record && typeof record.token === 'string' && record.token.length <= 16000 &&
    /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(record.token) &&
    typeof record.reference === 'string' && /^DAVORA-[a-f0-9-]{36}$/.test(record.reference) &&
    Number.isSafeInteger(record.expiresAt) && record.expiresAt > now &&
    record.expiresAt <= now + 2 * 3600000 + 5 * 60000 &&
    Array.isArray(record.selection) && record.selection.length <= 20 &&
    record.selection.every(item => item && typeof item.id === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(item.id) &&
      Number.isSafeInteger(item.quantity) && item.quantity > 0 && item.quantity <= 10));
}

export function savePaymentRecord(storage, payment, now = Date.now()) {
  const record = { token: payment.token, reference: payment.reference, expiresAt: payment.expiresAt,
    selection: Array.isArray(payment.selection) ? payment.selection.map(item => ({ id: item?.id, quantity: item?.quantity })) : null };
  if (!validPaymentRecord(record, now)) return false;
  try { storage.setItem(STORAGE, JSON.stringify(record)); return true; } catch { return false; }
}

export function restorePaymentRecord(storage, now = Date.now()) {
  try {
    const record = JSON.parse(storage.getItem(STORAGE));
    if (validPaymentRecord(record, now)) return { token: record.token, reference: record.reference, expiresAt: record.expiresAt,
      selection: record.selection.map(({ id, quantity }) => ({ id, quantity })) };
    storage.removeItem(STORAGE);
  } catch { /* The flow still works if session storage is unavailable. */ }
  return null;
}

export function clearPaymentRecord(storage) {
  try { storage.removeItem(STORAGE); } catch { /* Storage is optional. */ }
}
