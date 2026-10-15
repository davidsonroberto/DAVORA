import { verify, guard, replyError, StoreError, paymentMatches } from '../lib/store.js';
export default async function handler(req, res) {
  try {
    guard(req, res);
    if (!process.env.MP_ACCESS_TOKEN || (process.env.DAVORA_CHECKOUT_SECRET || '').length < 32) throw new StoreError('Consulta temporariamente indisponível.', 503);
    const data = verify(req.body?.token, process.env.DAVORA_CHECKOUT_SECRET, 'payment');
    const response = await fetch('https://api.mercadopago.com/v1/payments/' + encodeURIComponent(data.paymentId), {
      headers: { Authorization: 'Bearer ' + process.env.MP_ACCESS_TOKEN }, signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) throw new StoreError('Não foi possível consultar o pagamento.', 502);
    const payment = await response.json();
    if (!paymentMatches(payment, data)) throw new StoreError('Não foi possível confirmar este pagamento.', 409);
    return res.status(200).json({ status: payment.status, reference: data.reference });
  } catch (error) { return replyError(res, error); }
}
