import { readiness, verifyQuote, validateBuyer, sign, guard, replyError, StoreError, paymentMatches, stripePublishableKey } from '../lib/store.js';
import { sessionPayload, stripeRequest } from '../lib/stripe.js';

export default async function handler(req, res) {
  try {
    guard(req, res);
    if (!readiness()) throw new StoreError('As compras ainda não estão disponíveis.', 503);
    const attempt = req.body?.attempt;
    if (typeof attempt !== 'string' || !/^[a-f0-9-]{36}$/.test(attempt)) throw new StoreError('Pedido inválido.');
    const order = verifyQuote(req.body?.quoteToken);
    const buyer = validateBuyer(req.body?.buyer, order.cep);
    const { body, reference, key, fingerprint } = sessionPayload(order, buyer, attempt);
    const payment = await stripeRequest('/v1/checkout/sessions', { method: 'POST', headers: { 'Idempotency-Key': key }, body });
    const live = /^(sk|rk)_live_/.test(process.env.STRIPE_SECRET_KEY);
    if (!paymentMatches(payment, { paymentId: payment.id, reference, totalCents: order.totalCents, live }) || payment.metadata?.order_fingerprint !== fingerprint) throw new StoreError('Este pedido mudou. Recomece a confirmação antes de pagar.', 409);
    if (!/^cs_/.test(payment.id || '') || !payment.client_secret || payment.status !== 'open') throw new StoreError('Esta sessão de pagamento não está disponível. Confira o estado do pedido.', 409);
    const token = sign({ kind: 'payment', paymentId: payment.id, reference, totalCents: order.totalCents, live, expiresAt: Date.now() + 2 * 3600000 }, process.env.DAVORA_CHECKOUT_SECRET);
    return res.status(200).json({ provider: 'stripe', reference, token, clientSecret: payment.client_secret, publishableKey: stripePublishableKey() });
  } catch (error) { return replyError(res, error); }
}
