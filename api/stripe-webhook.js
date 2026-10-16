import Stripe from 'stripe';
import { getOrderStore, ordersConfigured } from '../lib/orders.js';
import { stripeRequest, STRIPE_API_VERSION } from '../lib/stripe.js';
import { StoreError, replyError } from '../lib/store.js';

export const config = { api: { bodyParser: false } };
const TYPES = new Set(['checkout.session.completed', 'checkout.session.async_payment_succeeded', 'checkout.session.async_payment_failed', 'checkout.session.expired']);

export function createStripeWebhookHandler({ orders = getOrderStore, retrieve = stripeRequest } = {}) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    try {
      if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); throw new StoreError('Método não permitido.', 405); }
      if (!ordersConfigured() || !process.env.STRIPE_WEBHOOK_SECRET) throw new StoreError('Confirmação de pedidos indisponível.', 503);
      const chunks = []; let size = 0;
      for await (const chunk of req) { size += chunk.length; if (size > 1024 * 1024) throw new StoreError('Evento muito grande.', 413); chunks.push(Buffer.from(chunk)); }
      const signature = req.headers['stripe-signature'];
      if (typeof signature !== 'string' || signature.length > 8192) throw new StoreError('Assinatura inválida.');
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: STRIPE_API_VERSION });
      let event;
      try { event = stripe.webhooks.constructEvent(Buffer.concat(chunks), signature, process.env.STRIPE_WEBHOOK_SECRET); }
      catch { throw new StoreError('Assinatura inválida.'); }
      const live = /^(sk|rk)_live_/.test(process.env.STRIPE_SECRET_KEY || '');
      if (event.livemode !== live) throw new StoreError('Ambiente inválido.');
      if (!TYPES.has(event.type) || !String(event.data?.object?.client_reference_id || '').startsWith('DAVORA-')) return res.status(200).json({ received: true, ignored: true });
      if (!/^evt_[a-zA-Z0-9]+$/.test(event.id || '') || !/^cs_[a-zA-Z0-9_]+$/.test(event.data.object.id || '')) throw new StoreError('Evento inválido.');
      const payment = await retrieve('/v1/checkout/sessions/' + event.data.object.id);
      const store = orders();
      if (event.type === 'checkout.session.async_payment_failed') await store.failPayment(payment, event.id);
      else await store.reconcile(payment, event.id);
      return res.status(200).json({ received: true });
    } catch (error) { return replyError(res, error); }
  };
}
export default createStripeWebhookHandler();
