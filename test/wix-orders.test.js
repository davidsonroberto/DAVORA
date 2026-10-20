import test from 'node:test';
import assert from 'node:assert/strict';
import { createOrderStore } from '../lib/orders.js';
import { quote, normalizeItems, verifyQuote } from '../lib/store.js';
import { memoryLedger } from './order-memory.js';
import { WIX_CLIENT_ID, WIX_SITE_ID, supplierReady } from '../lib/fulfillment-config.js';
import { createWixRequester, sendPaidOrderToWix } from '../lib/wix-orders.js';
import fulfillmentConfig from '../api/fulfillment-config.js';

const productId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', variantId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const remoteId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const reference = 'DAVORA-00000001-1234-1234-1234-123456789012';
const env = { WIX_CLIENT_ID, WIX_CLIENT_SECRET: 'TEST_ONLY_NOT_A_REAL_WIX_SECRET', DAVORA_WIX_ORDERS_ENABLED: 'true',
  DAVORA_WIX_ORDERS_VERIFIED: 'true', DAVORA_WIX_ALLOW_TEST_ORDERS: 'true', DAVORA_ORDER_ENCRYPTION_KEY: 'b'.repeat(64),
  STRIPE_SECRET_KEY: 'sk_test_NOT_A_REAL_CREDENTIAL', DAVORA_CHECKOUT_SECRET: 'test-only-secret-at-least-32-characters',
  DAVORA_SHIPPING_RULES: JSON.stringify([{ cepStart: '30000000', cepEnd: '39999999', priceCents: 500, days: 8 }]) };
const buyer = { name: 'Cliente Teste', email: 'cliente@example.com', cpf: '19119119100', phone: '31999999999',
  street: 'Rua de Teste', number: '1', district: 'Centro', complement: '', city: 'Belo Horizonte', state: 'MG', cep: '30000001' };
function product() {
  return { id: 'produto', name: 'Produto de teste', priceCents: 2000, availability: 'available', supplierApproved: true,
    stock: 5, stockConfirmedAt: new Date().toISOString(), supplierPlatform: 'zendrop', supplierProductId: '123', supplierVariantId: 456, supplierSku: 'SKU-TEST-456',
    fulfillmentMapping: { provider: 'wix', siteId: WIX_SITE_ID, productId, variantId, zendropLinked: true, supplierSku: 'SKU-TEST-456', supplierVariantId: 456 } };
}
const payment = { id: 'cs_test_WixBridge', client_reference_id: reference, mode: 'payment', currency: 'brl', amount_total: 2500,
  livemode: false, status: 'complete', payment_status: 'paid', payment_intent: 'pi_TEST_ONLY', metadata: { order_fingerprint: 'fingerprint' } };
async function fixture() {
  const catalog = [product()], store = createOrderStore(memoryLedger(), env, catalog);
  await store.reserve(quote([{ id: 'produto', quantity: 1 }], buyer.cep, env, catalog), buyer, reference, 'fingerprint');
  const order = await store.reconcile(payment, 'evt_paid');
  return { store, order };
}
function fakeRequester(calls, { failPayment = false, currency = 'BRL', total = '25' } = {}) {
  return async (path, payload) => {
    calls.push({ path, payload });
    if (path === '/ecom/v1/orders') return { order: { id: remoteId, currency,
      channelInfo: { externalOrderId: reference }, priceSummary: { total: { amount: total } } } };
    if (failPayment) throw new Error('TEST_ONLY timeout after an unknown remote outcome');
    return { orderTransactions: { orderId: remoteId }, paymentsIds: ['dddddddd-dddd-dddd-dddd-dddddddddddd'] };
  };
}

test('a cotação conserva o mapeamento Wix canônico e recusa mudar a variante vinculada', () => {
  const catalog = [product()];
  const items = normalizeItems([{ id: 'produto', quantity: 1, priceCents: 1, wixProductId: remoteId }], catalog);
  assert.equal(items.items[0].wixProductId, productId);
  assert.equal(items.items[0].wixVariantId, variantId);
  const q = quote([{ id: 'produto', quantity: 1 }], buyer.cep, env, catalog);
  assert.throws(() => verifyQuote(q.token, env, [{ ...catalog[0], fulfillmentMapping: { ...catalog[0].fulfillmentMapping, variantId: remoteId } }]), /mudou/);
  assert.equal(supplierReady(catalog[0], env), true);
  for (const patch of [{ zendropLinked: false }, { supplierSku: 'outro' }, { siteId: remoteId }]) assert.equal(supplierReady({ ...catalog[0], fulfillmentMapping: { ...catalog[0].fulfillmentMapping, ...patch } }, env), false);
  assert.equal(supplierReady(catalog[0], { ...env, DAVORA_WIX_ORDERS_VERIFIED: 'false' }), false);
});

test('a integração registra um único pedido e o pagamento existente, com BRL e endereço brasileiro', async () => {
  const { store, order } = await fixture(), calls = [], request = fakeRequester(calls);
  const sync = await sendPaidOrderToWix(store, order, payment, { env, request });
  assert.equal(sync.state, 'payment_recorded');
  await sendPaidOrderToWix(store, await store.find(reference), payment, { env, request });
  assert.equal(calls.length, 2);
  assert.equal(calls[0].payload.order.currency, 'BRL');
  assert.equal(calls[0].payload.order.buyerLanguage, 'pt');
  assert.equal(calls[0].payload.order.lineItems[0].catalogReference.options.variantId, variantId);
  assert.equal(calls[0].payload.order.lineItems[0].physicalProperties.sku, 'SKU-TEST-456');
  assert.equal(calls[0].payload.order.shippingInfo.logistics.shippingDestination.address.subdivision, 'BR-MG');
  assert.equal(calls[0].payload.order.customFields.find(f => f.title === 'CPF').value, buyer.cpf);
  assert.deepEqual(calls[0].payload.order.billingInfo.contactDetails.vatId, { type: 'CPF', id: buyer.cpf });
  assert.equal(calls[0].payload.settings.notifications.sendNotificationToBuyer, false);
  assert.equal(calls[1].payload.payments[0].regularPaymentDetails.providerTransactionId, payment.payment_intent);
  await store.reconcile(payment, 'evt_duplicate_new_id');
  assert.equal((await store.find(reference)).fulfillment, 'sent_to_wix');
});

test('webhooks concorrentes não criam dois pedidos remotos', async () => {
  const { store, order } = await fixture(), calls = [], request = fakeRequester(calls);
  const results = await Promise.allSettled([1, 2].map(() => sendPaidOrderToWix(store, order, payment, { env, request })));
  assert.ok(results.some(r => r.status === 'fulfilled'));
  assert.equal(calls.filter(c => c.path === '/ecom/v1/orders').length, 1);
  assert.equal(calls.length, 2);
});

test('resultado remoto incerto exige conferência e nunca dispara nova criação ou pagamento', async () => {
  const { store, order } = await fixture(), calls = [], request = fakeRequester(calls, { failPayment: true });
  await assert.rejects(() => sendPaidOrderToWix(store, order, payment, { env, request }), /conferência/);
  const saved = await store.find(reference);
  assert.equal(saved.fulfillment, 'review_required');
  assert.equal(saved.supplierSync.orderId, remoteId);
  await assert.rejects(() => sendPaidOrderToWix(store, saved, payment, { env, request }));
  assert.equal(calls.length, 2);
});

test('pagamento divergente, ambiente de teste não liberado ou cliente sem autorização não sai para Wix', async () => {
  const { store, order } = await fixture(), calls = [], request = fakeRequester(calls);
  for (const patch of [{ amount_total: 1 }, { currency: 'usd' }, { payment_status: 'unpaid' }, { livemode: true }, { metadata: { order_fingerprint: 'outro' } }]) await assert.rejects(() => sendPaidOrderToWix(store, order, { ...payment, ...patch }, { env, request }));
  await assert.rejects(() => sendPaidOrderToWix(store, order, payment, { env: { ...env, DAVORA_WIX_ALLOW_TEST_ORDERS: 'false' }, request }), /teste/);
  await assert.rejects(() => sendPaidOrderToWix(store, order, payment, { env: { ...env, WIX_CLIENT_SECRET: '' }, request }), /validada/);
  assert.deepEqual(await sendPaidOrderToWix(store, order, payment, { env: { ...env, DAVORA_WIX_ORDERS_ENABLED: 'false' }, request }), { state: 'disabled' });
  assert.equal(calls.length, 0);
});

test('total ou moeda divergente no retorno Wix não recebe registro de pagamento', async () => {
  for (const options of [{ total: '0.01' }, { currency: 'USD' }]) {
    const { store, order } = await fixture(), calls = [], request = fakeRequester(calls, options);
    await assert.rejects(() => sendPaidOrderToWix(store, order, payment, { env, request }), /conferência/);
    assert.equal(calls.length, 1);
  }
});

test('cliente Wix usa credenciais só no servidor, reutiliza token e recusa destinos externos', async () => {
  const calls = [], requester = createWixRequester(env, async (url, options) => {
    calls.push({ url, options });
    return { ok: true, json: async () => url.endsWith('/oauth2/token') ? { access_token: 'TEST_ONLY_WIX_TOKEN', expires_in: 14400 } : { order: {} } };
  });
  await requester('/ecom/v1/orders', { order: {} });
  await requester('/ecom/v1/orders', { order: {} });
  assert.equal(calls.length, 3);
  assert.equal(JSON.parse(calls[0].options.body).client_secret, env.WIX_CLIENT_SECRET);
  assert.equal(calls[1].options.headers.Authorization, 'TEST_ONLY_WIX_TOKEN');
  await assert.rejects(() => requester('https://example.com/receive', {}));
  assert.equal(calls.length, 3);
});

test('status público da integração não expõe a chave privada', () => {
  const before = process.env.WIX_CLIENT_SECRET;
  process.env.WIX_CLIENT_SECRET = env.WIX_CLIENT_SECRET;
  try {
    const res = { setHeader() {}, status() { return this; }, json(data) { this.data = data; return this; } };
    fulfillmentConfig({ method: 'GET', headers: {} }, res);
    assert.equal(res.data.mappedProducts, 0);
    assert.ok(!JSON.stringify(res.data).includes(env.WIX_CLIENT_SECRET));
  } finally { if (before === undefined) delete process.env.WIX_CLIENT_SECRET; else process.env.WIX_CLIENT_SECRET = before; }
});

test('rastreio Wix consulta apenas o pedido pago vinculado e não transforma etiqueta em despacho', async () => {
  const { readWixShipments } = await import('../lib/wix-orders.js');
  const order = { status: 'paid', live: false, supplierSync: { provider: 'wix', state: 'payment_recorded', orderId: remoteId } };
  let calls = 0;
  const request = async path => { calls++; assert.equal(path, '/ecom/v1/fulfillments/orders/' + remoteId); return {
    orderWithFulfillments: { orderId: remoteId, fulfillments: [
      { status: 'Ready', trackingInfo: { trackingNumber: 'BR123456789XX', shippingProvider: 'Transportadora teste', trackingLink: 'https://external.invalid/' } },
      { trackingInfo: { trackingNumber: 'BR123456789XX', shippingProvider: 'Transportadora teste' } },
      { customInfo: { fieldsData: { email: 'private@example.com' } } }
    ] }
  }; };
  assert.deepEqual(await readWixShipments(order, { env, request }), [{ tracking: 'BR123456789XX', carrier: 'Transportadora teste' }]);
  for (const patch of [{ status: 'open' }, { supplierSync: null }]) assert.deepEqual(await readWixShipments({ ...order, ...patch }, { env, request }), []);
  assert.deepEqual(await readWixShipments(order, { env: { ...env, DAVORA_WIX_ALLOW_TEST_ORDERS: 'false' }, request }), []);
  assert.equal(calls, 1); assert.equal(order.status, 'paid');
  await assert.rejects(() => readWixShipments(order, { env, request: async () => ({ orderWithFulfillments: { orderId: productId, fulfillments: [] } }) }));
});
