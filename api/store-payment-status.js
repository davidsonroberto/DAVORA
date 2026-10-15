import { verify, guard, replyError, StoreError, paymentMatches, stripeKeysMatch } from '../lib/store.js';
import { stripeRequest } from '../lib/stripe.js';
export default async function handler(req, res) {
  try {
    guard(req, res);
    if (!stripeKeysMatch() || (process.env.DAVORA_CHECKOUT_SECRET || '').length < 32) throw new StoreError('Consulta temporariamente indisponível.', 503);
    const data = verify(req.body?.token, process.env.DAVORA_CHECKOUT_SECRET, 'payment');
    const payment = await stripeRequest('/v1/checkout/sessions/' + data.paymentId);
    if (!paymentMatches(payment, data)) throw new StoreError('Não foi possível confirmar este pagamento.', 409);
    const paid = payment.status === 'complete' && payment.payment_status === 'paid';
    return res.status(200).json({ status: paid ? 'approved' : payment.status === 'expired' ? 'cancelled' : 'pending', reference: data.reference });
  } catch (error) { return replyError(res, error); }
}
