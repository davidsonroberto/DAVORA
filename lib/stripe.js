import { createHmac } from 'node:crypto';
import { StoreError } from './store.js';

export const STRIPE_API_VERSION = '2026-09-30.endive';

export function sessionPayload(order, buyer, attempt, env = process.env) {
  const reference = 'DAVORA-' + attempt;
  const key = createHmac('sha256', env.DAVORA_CHECKOUT_SECRET).update(attempt).digest('hex');
  const fingerprint = createHmac('sha256', env.DAVORA_CHECKOUT_SECRET).update(JSON.stringify({ items: order.items, totalCents: order.totalCents, buyer })).digest('hex');
  const body = new URLSearchParams({
    mode: 'payment', ui_mode: 'embedded_page', redirect_on_completion: 'never', locale: 'pt-BR',
    client_reference_id: reference, customer_email: buyer.email,
    expires_at: String(Math.floor(Date.now() / 1000) + 31 * 60),
    'metadata[order_fingerprint]': fingerprint,
    'metadata[fulfillment]': 'manual_supplier_confirmation',
    'payment_intent_data[metadata][order_reference]': reference,
    'payment_intent_data[shipping][name]': buyer.name,
    'payment_intent_data[shipping][phone]': '+55' + buyer.phone,
    'payment_intent_data[shipping][address][line1]': buyer.street + ', ' + buyer.number,
    'payment_intent_data[shipping][address][line2]': [buyer.district, buyer.complement].filter(Boolean).join(' · '),
    'payment_intent_data[shipping][address][city]': buyer.city,
    'payment_intent_data[shipping][address][state]': buyer.state,
    'payment_intent_data[shipping][address][postal_code]': buyer.cep,
    'payment_intent_data[shipping][address][country]': 'BR',
    'allowed_payment_method_types[0]': 'card',
    'shipping_options[0][shipping_rate_data][type]': 'fixed_amount',
    'shipping_options[0][shipping_rate_data][display_name]': 'Entrega no Brasil',
    'shipping_options[0][shipping_rate_data][fixed_amount][amount]': String(order.shippingCents),
    'shipping_options[0][shipping_rate_data][fixed_amount][currency]': 'brl',
    'shipping_options[0][shipping_rate_data][delivery_estimate][maximum][unit]': 'business_day',
    'shipping_options[0][shipping_rate_data][delivery_estimate][maximum][value]': String(order.deliveryDays)
  });
  if (env.STRIPE_PIX_ENABLED === 'true') body.set('allowed_payment_method_types[1]', 'pix');
  order.items.forEach((item, index) => {
    body.set(`line_items[${index}][price_data][currency]`, 'brl');
    body.set(`line_items[${index}][price_data][product_data][name]`, item.name);
    body.set(`line_items[${index}][price_data][unit_amount]`, String(item.priceCents));
    body.set(`line_items[${index}][quantity]`, String(item.quantity));
  });
  return { body, reference, key, fingerprint };
}

export async function stripeRequest(path, options = {}, env = process.env) {
  if (!/^\/v1\/checkout\/sessions(?:\/cs_[a-zA-Z0-9_]+)?$/.test(path)) throw new StoreError('Pedido inválido.');
  const response = await fetch('https://api.stripe.com' + path, {
    ...options, signal: AbortSignal.timeout(20000),
    headers: {
      Authorization: 'Bearer ' + env.STRIPE_SECRET_KEY,
      'Stripe-Version': STRIPE_API_VERSION,
      ...(options.body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
      ...options.headers
    }
  });
  const result = await response.json();
  if (!response.ok) throw new StoreError('Não foi possível acessar o pagamento. Tente novamente em instantes.', 502);
  return result;
}
