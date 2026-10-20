import test from 'node:test';
import assert from 'node:assert/strict';
import { quote, sign } from '../lib/store.js';
import { createOrderStore } from '../lib/orders.js';
import { trackingPath, trackingStatus } from '../lib/tracking.js';
import { createTrackingHandler } from '../api/order-tracking.js';
import { memoryLedger } from './order-memory.js';

const env = { STRIPE_SECRET_KEY: 'sk_test_NOT_A_REAL_CREDENTIAL', DAVORA_CHECKOUT_SECRET: 'TEST_ONLY_TRACKING_SECRET_AT_LEAST_32_CHARACTERS',
  DAVORA_ORDER_ENCRYPTION_KEY: 'c'.repeat(64), DAVORA_SHIPPING_RULES: JSON.stringify([{ cepStart: '30000000', cepEnd: '39999999', priceCents: 500, days: 8 }]) };
const reference = 'DAVORA-12345678-1234-1234-1234-123456789012';
const paymentData = { reference, paymentId: 'cs_test_tracking123', live: false, totalCents: 3000 };
const payment = { id: paymentData.paymentId, client_reference_id: reference, mode: 'payment', currency: 'brl', amount_total: 3000,
  livemode: false, status: 'complete', payment_status: 'paid', metadata: { order_fingerprint: 'tracking-test-fingerprint' } };
const tokenFrom = path => new URL(path, 'https://store.example').searchParams.get('token');
async function fixture() {
  const products = [{ id: 'tracking-test-product', name: 'Produto de teste', priceCents: 2500, stock: 2,
    stockConfirmedAt: new Date().toISOString(), availability: 'available', supplierApproved: true }];
  const store = createOrderStore(memoryLedger(), env, products);
  const order = quote([{ id: products[0].id, quantity: 1 }], '30000001', env, products);
  await store.reserve(order, { name: 'Cliente Teste', email: 'cliente@example.com', cpf: '19119119100', street: 'Rua privada' }, reference, 'tracking-test-fingerprint');
  await store.reconcile(payment, 'evt_trackingtest');
  return store;
}

test('acompanhamento mostra preparo e só apresenta rastreio após despacho registrado', async () => {
  const store = await fixture(), path = trackingPath(paymentData, env), token = tokenFrom(path);
  const preparing = await trackingStatus(token, store, env);
  assert.equal(preparing.status, 'processing'); assert.equal(preparing.tracking, null);
  const remote = await store.find(reference); remote.fulfillment = 'sent_to_wix';
  // A supplier order or payment is not itself proof of shipment.
  const acknowledgementOnly = await trackingStatus(token, { find: async () => remote }, env);
  assert.equal(acknowledgementOnly.status, 'processing'); assert.equal(acknowledgementOnly.tracking, null);
  await store.markDispatched(reference, 'BR123456789XX', 'Transportadora de teste');
  const shipped = await trackingStatus(token, store, env);
  assert.equal(shipped.status, 'dispatched'); assert.equal(shipped.tracking, 'BR123456789XX');
  assert.equal(shipped.carrier, 'Transportadora de teste');
  const serialized = JSON.stringify(shipped);
  for (const privateValue of ['cliente@example.com', '19119119100', 'Rua privada', 'buyerEncrypted', 'fingerprint', 'supplierSku']) assert.ok(!serialized.includes(privateValue));
});

test('acompanhamento recusa link adulterado, expirado, de outro pedido e de outro ambiente', async () => {
  const store = await fixture(), now = Date.now(), token = tokenFrom(trackingPath(paymentData, env, now));
  await assert.rejects(() => trackingStatus(token + 'x', store, env, now), /inválido/);
  await assert.rejects(() => trackingStatus(token, store, env, now + 91 * 86400000), /expirou/);
  await assert.rejects(() => trackingStatus(token, store, { ...env, STRIPE_SECRET_KEY: 'sk_live_NOT_A_REAL_CREDENTIAL' }, now), /inválido/);
  const wrong = tokenFrom(trackingPath({ ...paymentData, paymentId: 'cs_test_other' }, env, now));
  await assert.rejects(() => trackingStatus(wrong, store, env, now), /não encontrado/);
  const wrongValue = tokenFrom(trackingPath({ ...paymentData, totalCents: 1 }, env, now));
  await assert.rejects(() => trackingStatus(wrongValue, store, env, now), /não encontrado/);
  const wrongKind = sign({ ...paymentData, kind: 'payment', expiresAt: now + 60000 }, env.DAVORA_CHECKOUT_SECRET);
  await assert.rejects(() => trackingStatus(wrongKind, store, env, now), /inválido/);
});

test('API de acompanhamento exige link privado e devolve somente status sem cache ou indexação', async () => {
  const store = await fixture(), handler = createTrackingHandler({ orders: () => store, env });
  const response = () => ({ code: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });
  const token = tokenFrom(trackingPath(paymentData, env));
  const res = response(); await handler({ method: 'GET', query: { token } }, res);
  assert.equal(res.code, 200); assert.equal(res.body.status, 'processing');
  assert.equal(res.headers['Cache-Control'], 'no-store'); assert.equal(res.headers['Referrer-Policy'], 'no-referrer');
  assert.equal(res.headers['X-Robots-Tag'], 'noindex, nofollow');
  const denied = response(); await handler({ method: 'GET', query: { reference } }, denied); assert.equal(denied.code, 400);
  const wrongMethod = response(); await handler({ method: 'POST', query: { token } }, wrongMethod); assert.equal(wrongMethod.code, 405);
});

test('consulta de rastreio conserva estado do pagamento quando a transportadora está indisponível', async () => {
  const store = await fixture(), token = tokenFrom(trackingPath(paymentData, env));
  const result = await trackingStatus(token, store, env, Date.now(), { readShipments: async () => { throw new Error('TEST_ONLY supplier timeout'); } });
  assert.equal(result.status, 'processing'); assert.equal(result.trackingRefreshPending, true); assert.deepEqual(result.shipments, []);
});
