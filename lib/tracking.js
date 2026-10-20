import { StoreError, sign, verify } from './store.js';
import { readWixShipments } from './wix-orders.js';

const LIFETIME = 90 * 86400000;
const REFERENCE = /^DAVORA-[a-f0-9-]{36}$/;
const SESSION = /^cs_[a-zA-Z0-9_]+$/;

export function trackingPath(payment, env = process.env, now = Date.now()) {
  if (!REFERENCE.test(payment.reference || '') || !SESSION.test(payment.paymentId || '') ||
      typeof payment.live !== 'boolean' || !Number.isSafeInteger(payment.totalCents) || payment.totalCents <= 0 ||
      (env.DAVORA_CHECKOUT_SECRET || '').length < 32) throw new StoreError('Não foi possível preparar o acompanhamento.', 503);
  const token = sign({ kind: 'tracking', reference: payment.reference, paymentId: payment.paymentId,
    live: payment.live, totalCents: payment.totalCents, expiresAt: now + LIFETIME }, env.DAVORA_CHECKOUT_SECRET);
  return '/acompanhar?token=' + encodeURIComponent(token);
}

export async function trackingStatus(token, orders, env = process.env, now = Date.now(), { readShipments = readWixShipments } = {}) {
  if ((env.DAVORA_CHECKOUT_SECRET || '').length < 32) throw new StoreError('Acompanhamento temporariamente indisponível.', 503);
  let data;
  try { data = verify(token, env.DAVORA_CHECKOUT_SECRET, 'tracking', now); }
  catch (error) { throw new StoreError(error.status === 409 ? 'Este link de acompanhamento expirou. Fale com a DAVORA.' : 'Link de acompanhamento inválido.', error.status === 409 ? 409 : 400); }
  const live = /^(?:sk|rk)_live_/.test(env.STRIPE_SECRET_KEY || '');
  if (!REFERENCE.test(data.reference || '') || !SESSION.test(data.paymentId || '') || typeof data.live !== 'boolean' || data.live !== live) throw new StoreError('Link de acompanhamento inválido.', 400);
  const order = await orders.find(data.reference);
  if (!order || order.sessionId !== data.paymentId || order.live !== data.live || order.totalCents !== data.totalCents) throw new StoreError('Pedido não encontrado para este link.', 404);
  // A supplier acknowledgement is not a shipment. Only a recorded dispatch
  // exposes a tracking code; no customer, address or supplier data is returned.
  const dispatched = order.status === 'dispatched' && order.fulfillment === 'dispatched' && Boolean(order.tracking);
  let shipments = [], trackingRefreshPending = false;
  if (!dispatched && order.status === 'paid' && order.fulfillment !== 'review_required') {
    try { shipments = await readShipments(order, { env }); }
    catch { trackingRefreshPending = true; }
  }
  return { reference: order.reference, status: dispatched ? 'dispatched' : order.status === 'paid' ?
    order.fulfillment === 'review_required' ? 'review_required' : shipments.length ? 'tracking_available' : 'processing' : 'payment_pending',
    updatedAt: order.updatedAt, tracking: dispatched ? order.tracking : null, carrier: dispatched ? order.carrier : null,
    shipments, trackingRefreshPending };
}
