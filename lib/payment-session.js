import { verify, stripeKeysMatch, paymentMatches, StoreError, stripePublishableKey } from './store.js';
import { stripeRequest } from './stripe.js';

export async function retrievePayment(token, env = process.env) {
  if (!stripeKeysMatch(env) || (env.DAVORA_CHECKOUT_SECRET || '').length < 32) throw new StoreError('Consulta temporariamente indisponível.', 503);
  const data = verify(token, env.DAVORA_CHECKOUT_SECRET, 'payment');
  const live = /^(sk|rk)_live_/.test(env.STRIPE_SECRET_KEY || '');
  if (typeof data.live !== 'boolean' || data.live !== live || !/^cs_[a-zA-Z0-9_]+$/.test(data.paymentId || '')) throw new StoreError('Não foi possível confirmar este pagamento.', 409);
  const payment = await stripeRequest('/v1/checkout/sessions/' + data.paymentId, {}, env);
  if (!paymentMatches(payment, data)) throw new StoreError('Não foi possível confirmar este pagamento.', 409);
  const paid = payment.status === 'complete' && payment.payment_status === 'paid';
  return { data, payment, status: paid ? 'approved' : payment.status === 'expired' ? 'cancelled' : 'pending' };
}

export async function resumePayment(token, env = process.env) {
  const { payment, data, status } = await retrievePayment(token, env);
  const result = { status, reference: data.reference };
  if (status === 'pending' && payment.status === 'open') {
    if (!payment.client_secret) throw new StoreError('Não foi possível retomar o formulário de pagamento.', 502);
    result.clientSecret = payment.client_secret;
    result.publishableKey = stripePublishableKey(env);
  }
  return result;
}
