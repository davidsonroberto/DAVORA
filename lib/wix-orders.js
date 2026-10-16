import { createHash } from 'node:crypto';
import { StoreError, paymentMatches, cpfValid } from './store.js';
import { decryptOrderBuyer } from './orders.js';
import { WIX_CLIENT_ID, WIX_SITE_ID, isGuid, wixCredentialsConfigured, wixOrdersEnabled } from './fulfillment-config.js';

const WIX_ORIGIN = 'https://www.wixapis.com';
const STORES_APP_ID = '215238eb-22a5-4c36-9e7b-e7c08025e04e';
const amount = cents => {
  if (!Number.isSafeInteger(cents) || cents < 0) throw new StoreError('Valor do pedido inválido.', 409);
  return { amount: (cents / 100).toFixed(2) };
};
function sameAmount(value, cents) {
  if (typeof value !== 'string' || !/^\d+(\.\d{1,2})?$/.test(value)) return false;
  const [whole, fractional = ''] = value.split('.');
  return BigInt(whole) * 100n + BigInt(fractional.padEnd(2, '0')) === BigInt(cents);
}

// Auth and all administrative calls stay on the server. Never accept a URL,
// client ID, site ID, token, SKU, or price from an incoming webhook body.
export function createWixRequester(env = process.env, fetcher = fetch) {
  let token = null, expiresAt = 0;
  async function accessToken() {
    if (!wixCredentialsConfigured(env)) throw new StoreError('A integração de pedidos aguarda autorização privada.', 503);
    if (token && expiresAt > Date.now()) return token;
    const response = await fetcher(WIX_ORIGIN + '/oauth2/token', {
      method: 'POST', signal: AbortSignal.timeout(15000),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grant_type: 'client_credentials', client_id: WIX_CLIENT_ID, client_secret: env.WIX_CLIENT_SECRET })
    });
    const data = await response.json();
    if (!response.ok || typeof data.access_token !== 'string' || !data.access_token) throw new StoreError('Não foi possível autorizar a integração de pedidos.', 503);
    token = data.access_token;
    expiresAt = Date.now() + Math.max(0, Math.min(Number(data.expires_in) || 0, 14400) - 60) * 1000;
    return token;
  }
  return async function request(path, body) {
    if (path !== '/ecom/v1/orders' && !/^\/ecom\/v1\/payments\/orders\/[a-f0-9-]{36}\/add-payment$/i.test(path)) throw new StoreError('Operação de integração inválida.');
    const credential = await accessToken();
    const response = await fetcher(WIX_ORIGIN + path, {
      method: 'POST', signal: AbortSignal.timeout(20000),
      headers: { Authorization: credential, 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    const data = await response.json();
    if (!response.ok) throw new StoreError('Não foi possível confirmar o registro na integração. O pedido precisa de conferência.', 503);
    return data;
  };
}

export function wixOrderPayload(order, buyer) {
  if (!order.items?.length || !cpfValid(buyer.cpf || '') || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyer.email || '') ||
      !buyer.name || !buyer.street || !buyer.number || !buyer.city || !/^\d{10,11}$/.test(buyer.phone || '') || !/^[A-Z]{2}$/.test(buyer.state || '') || !/^\d{8}$/.test(buyer.cep || '')) throw new StoreError('Dados de entrega incompletos para o fornecedor.', 409);
  const subtotal = order.items.reduce((sum, item) => sum + item.priceCents * item.quantity, 0);
  if (subtotal !== order.subtotalCents || subtotal + order.shippingCents !== order.totalCents || order.totalCents <= 0) throw new StoreError('O total do pedido precisa de conferência.', 409);
  const names = buyer.name.trim().split(/\s+/);
  const firstName = names.shift(), lastName = names.join(' ');
  const addressLine2 = [buyer.district, buyer.complement].filter(Boolean).join(' · ');
  if (firstName.length > 100 || lastName.length > 100 || buyer.city.length > 50 || addressLine2.length > 100) throw new StoreError('O endereço precisa de conferência antes do envio ao fornecedor.', 409);
  const contact = { firstName, lastName, phone: '+55' + buyer.phone, vatId: { type: 'CPF', id: buyer.cpf } };
  const destination = { address: { country: 'BR', subdivision: 'BR-' + buyer.state, city: buyer.city,
    postalCode: buyer.cep, addressLine: buyer.street + ', ' + buyer.number,
    addressLine2 }, contactDetails: contact };
  return {
    order: {
      buyerInfo: { email: buyer.email }, currency: 'BRL', buyerLanguage: 'pt',
      channelInfo: { type: 'OTHER_PLATFORM', externalOrderId: order.reference },
      billingInfo: destination,
      shippingInfo: { title: 'Entrega no Brasil — DAVORA', logistics: { shippingDestination: destination },
        cost: { price: amount(order.shippingCents), totalPriceBeforeTax: amount(order.shippingCents), totalPriceAfterTax: amount(order.shippingCents) } },
      customFields: [{ title: 'CPF', value: buyer.cpf }, { title: 'Canal', value: 'DAVORA Brasil' }],
      buyerNote: 'DAVORA Brasil · ' + order.reference,
      lineItems: order.items.map(item => {
        if (item.wixSiteId !== WIX_SITE_ID || !isGuid(item.wixProductId) || !isGuid(item.wixVariantId) || !item.supplierSku || !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 10 || !Number.isSafeInteger(item.priceCents) || item.priceCents <= 0) throw new StoreError('Um modelo ainda não foi vinculado ao fornecedor.', 409);
        return { productName: { original: item.name }, quantity: item.quantity,
          catalogReference: { appId: STORES_APP_ID, catalogItemId: item.wixProductId, options: { variantId: item.wixVariantId } },
          physicalProperties: { sku: item.supplierSku, shippable: true }, itemType: { preset: 'PHYSICAL' },
          price: amount(item.priceCents), taxDetails: { taxRate: '0', totalTax: amount(0) },
          totalPriceBeforeTax: amount(item.priceCents * item.quantity), totalPriceAfterTax: amount(item.priceCents * item.quantity), paymentOption: 'FULL_PAYMENT_ONLINE' };
      }),
      priceSummary: { subtotal: amount(order.subtotalCents), shipping: amount(order.shippingCents), tax: amount(0), discount: amount(0), total: amount(order.totalCents) }
    },
    settings: { orderApprovalStrategy: 'PAYMENT_RECEIVED', notifications: { sendNotificationToBuyer: false, sendNotificationsToBusiness: false } }
  };
}

export async function sendPaidOrderToWix(store, order, payment, { env = process.env, request = createWixRequester(env) } = {}) {
  if (env.DAVORA_WIX_ORDERS_ENABLED !== 'true') return { state: 'disabled' };
  if (!wixOrdersEnabled(env) || env.DAVORA_WIX_ORDERS_VERIFIED !== 'true') throw new StoreError('A integração de pedidos ainda não foi validada.', 503);
  if (order.status !== 'paid' || order.fulfillment === 'review_required' || payment.status !== 'complete' || payment.payment_status !== 'paid' ||
      !paymentMatches(payment, { paymentId: order.sessionId, reference: order.reference, totalCents: order.totalCents, live: order.live }) || payment.metadata?.order_fingerprint !== order.fingerprint) throw new StoreError('A integração exige um pagamento confirmado para este pedido.', 409);
  if (!order.live && env.DAVORA_WIX_ALLOW_TEST_ORDERS !== 'true') throw new StoreError('Pedidos de teste não são enviados à loja real.', 409);
  const payload = wixOrderPayload(order, decryptOrderBuyer(order, env));
  const claimId = createHash('sha256').update(order.reference + '\0' + payment.id).digest('hex');
  const claim = await store.claimWixSync(order.reference, claimId);
  if (!claim.shouldSend) return claim.sync;
  try {
    const created = await request('/ecom/v1/orders', payload);
    const remote = created.order;
    if (!isGuid(remote?.id) || remote.currency !== 'BRL' || remote.channelInfo?.externalOrderId !== order.reference ||
        !sameAmount(remote.priceSummary?.total?.amount, order.totalCents)) throw new StoreError('O pedido recebido pela integração precisa de conferência.', 503);
    await store.recordWixOrder(order.reference, claimId, remote.id);
    const providerTransactionId = typeof payment.payment_intent === 'string' ? payment.payment_intent : payment.id;
    const recorded = await request('/ecom/v1/payments/orders/' + remote.id + '/add-payment', {
      payments: [{ amount: amount(order.totalCents), status: 'APPROVED', refundDisabled: true,
        regularPaymentDetails: { providerTransactionId, offlinePayment: false, paymentMethodName: { buyerLanguageName: 'Stripe — DAVORA Brasil' } } }]
    });
    if (!Array.isArray(recorded.paymentsIds) || !recorded.paymentsIds.length || recorded.orderTransactions?.orderId !== remote.id) throw new StoreError('O pagamento na integração precisa de conferência.', 503);
    return await store.completeWixSync(order.reference, claimId);
  } catch {
    // A timeout may happen after Wix accepted the write. Never create a second
    // order or payment automatically when its outcome is uncertain.
    await store.reviewWixSync(order.reference, claimId);
    throw new StoreError('O pagamento foi recebido; o registro no fornecedor precisa de conferência.', 503);
  }
}
