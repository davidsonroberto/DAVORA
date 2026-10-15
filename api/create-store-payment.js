import { createHmac } from 'node:crypto';
import { readiness, verifyQuote, validateBuyer, sign, guard, replyError, StoreError, paymentMatches } from '../lib/store.js';

export default async function handler(req, res) {
  try {
    guard(req, res);
    if (!readiness()) throw new StoreError('As compras ainda não estão disponíveis.', 503);
    const attempt = req.body?.attempt;
    if (typeof attempt !== 'string' || !/^[a-f0-9-]{36}$/.test(attempt)) throw new StoreError('Pedido inválido.');
    const order = verifyQuote(req.body?.quoteToken);
    const buyer = validateBuyer(req.body?.buyer, order.cep);
    const reference = 'DAVORA-' + attempt;
    const key = createHmac('sha256', process.env.DAVORA_CHECKOUT_SECRET).update(attempt).digest('hex');
    const fingerprint = createHmac('sha256', process.env.DAVORA_CHECKOUT_SECRET).update(JSON.stringify({ items: order.items, totalCents: order.totalCents, buyer })).digest('hex');
    const [firstName, ...lastName] = buyer.name.split(/\s+/);
    const response = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST', signal: AbortSignal.timeout(15000),
      headers: { Authorization: 'Bearer ' + process.env.MP_ACCESS_TOKEN, 'Content-Type': 'application/json', 'X-Idempotency-Key': key },
      body: JSON.stringify({
        transaction_amount: order.totalCents / 100,
        description: 'Pedido DAVORA Store',
        payment_method_id: 'pix',
        external_reference: reference,
        date_of_expiration: new Date(Date.now() + 60 * 60000).toISOString(),
        payer: { email: buyer.email, first_name: firstName, last_name: lastName.join(' '), identification: { type: 'CPF', number: buyer.cpf } },
        additional_info: {
          items: order.items.map(i => ({ id: i.id, title: i.name, quantity: i.quantity, unit_price: i.priceCents / 100 })),
          payer: { first_name: firstName, last_name: lastName.join(' '), phone: { area_code: buyer.phone.slice(0, 2), number: buyer.phone.slice(2) } },
          shipments: { receiver_address: { zip_code: buyer.cep, street_name: buyer.street, street_number: Number(buyer.number), city_name: buyer.city, state_name: buyer.state, apartment: buyer.complement } }
        },
        metadata: { order_reference: reference, order_fingerprint: fingerprint, shipping_cents: order.shippingCents, delivery_days: order.deliveryDays, district: buyer.district, fulfillment: 'manual_supplier_confirmation' }
      })
    });
    const payment = await response.json();
    if (!response.ok) throw new StoreError('Não foi possível gerar o Pix. Confira seus dados ou tente novamente.', 502);
    if (!paymentMatches(payment, { paymentId: payment.id, reference, totalCents: order.totalCents }) || payment.metadata?.order_fingerprint !== fingerprint) throw new StoreError('Este pedido mudou. Recomece a confirmação antes de pagar.', 409);
    const pix = payment.point_of_interaction?.transaction_data;
    if (!payment.id || !pix?.qr_code || !pix?.qr_code_base64) throw new StoreError('O meio de pagamento não está disponível neste momento.', 502);
    const token = sign({ kind: 'payment', paymentId: String(payment.id), reference, totalCents: order.totalCents, expiresAt: Date.now() + 2 * 3600000 }, process.env.DAVORA_CHECKOUT_SECRET);
    return res.status(200).json({ reference, token, qrCode: pix.qr_code, qrImage: pix.qr_code_base64, expiresAt: payment.date_of_expiration });
  } catch (error) { return replyError(res, error); }
}
