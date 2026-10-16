import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import Stripe from 'stripe';
import { createOrderStore, decryptOrderBuyer } from '../lib/orders.js';
import { readiness, products, quote as signedQuote, StoreError } from '../lib/store.js';
import { createPaymentHandler } from '../api/create-store-payment.js';
import { createStripeWebhookHandler } from '../api/stripe-webhook.js';
import { memoryLedger } from './order-memory.js';

const env = { STRIPE_SECRET_KEY: 'sk_test_NOT_A_REAL_CREDENTIAL', STRIPE_PUBLISHABLE_KEY: 'pk_test_NOT_A_REAL_CREDENTIAL',
  DAVORA_CHECKOUT_SECRET: 'test-only-secret-with-at-least-32-characters', DAVORA_CHECKOUT_ENABLED: 'true', DAVORA_SUPPLIER_APPROVED: 'true',
  DAVORA_MERCHANT_REVIEWED: 'true', DAVORA_STORE_ORIGIN: 'https://store.example', DAVORA_SHIPPING_RULES: JSON.stringify([{ cepStart: '30000000', cepEnd: '39999999', priceCents: 1250, days: 8 }]),
  DAVORA_ORDERS_ENABLED: 'true', DAVORA_ORDER_ENCRYPTION_KEY: 'a'.repeat(64), DAVORA_ORDER_NAMESPACE: 'test', BLOB_READ_WRITE_TOKEN: 'TEST_ONLY_NOT_REAL', STRIPE_WEBHOOK_SECRET: 'whsec_TEST_ONLY_NOT_REAL', DAVORA_WEBHOOK_VERIFIED: 'true' };
const reference = n => 'DAVORA-' + String(n).padStart(8, '0') + '-1234-1234-1234-123456789012';
const buyer = { name: 'Cliente Teste', cpf: '19119119100', email: 'cliente@example.com', cep: '30000001' };
const catalog = () => [{ id: 'produto', name: 'Teste', priceCents: 2000, stock: 5, supplierApproved: true, availability: 'available', stockConfirmedAt: new Date().toISOString() }];
const quote = quantity => ({ items: [{ id: 'produto', name: 'Teste', quantity, priceCents: 2000 }], subtotalCents: quantity * 2000, shippingCents: 1250, totalCents: quantity * 2000 + 1250, deliveryDays: 8 });
const payment = (n, quantity, patch = {}) => ({ id: 'cs_test_' + n, client_reference_id: reference(n), currency: 'brl', amount_total: quantity * 2000 + 1250, mode: 'payment', livemode: false, status: 'complete', payment_status: 'paid', metadata: { order_fingerprint: 'fingerprint-' + n }, ...patch });

test('reservas concorrentes nunca vendem mais unidades do que o estoque', async () => {
  const adapter = memoryLedger(), store = createOrderStore(adapter, env, catalog());
  const results = await Promise.allSettled([1, 2].map(n => store.reserve(quote(3), buyer, reference(n), 'fingerprint-' + n)));
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(Object.keys((await adapter.read()).data.orders).length, 1);
  await assert.rejects(() => store.assertStock(quote(3).items), /estoque/);
});

test('repetir o mesmo pedido não duplica reserva e os dados pessoais ficam criptografados', async () => {
  const adapter = memoryLedger(), store = createOrderStore(adapter, env, catalog());
  await Promise.all([store.reserve(quote(2), buyer, reference(1), 'fingerprint-1'), store.reserve(quote(2), buyer, reference(1), 'fingerprint-1')]);
  const snapshot = (await adapter.read()).data;
  assert.equal(Object.keys(snapshot.orders).length, 1);
  assert.ok(!JSON.stringify(snapshot).includes(buyer.cpf)); assert.ok(!JSON.stringify(snapshot).includes(buyer.email));
  assert.deepEqual(decryptOrderBuyer(snapshot.orders[reference(1)], env), buyer);
  assert.throws(() => decryptOrderBuyer({ ...snapshot.orders[reference(1)], reference: reference(2) }, env));
  await store.assertStock(quote(3).items);
});

test('expiração libera estoque; confirmação atrasada exige revisão', async () => {
  const store = createOrderStore(memoryLedger(), env, catalog());
  await store.reserve(quote(5), buyer, reference(1), 'fingerprint-1');
  await store.reconcile(payment(1, 5, { status: 'expired', payment_status: 'unpaid' }), 'evt_expired');
  await store.assertStock(quote(5).items);
  const late = await store.reconcile(payment(1, 5), 'evt_late');
  assert.equal(late.status, 'paid'); assert.equal(late.fulfillment, 'review_required');
  await assert.rejects(() => store.markDispatched(reference(1), 'ABC123BR', 'Correios'), /despacho/);
});

test('eventos repetidos ou fora de ordem não duplicam confirmação nem devolvem estoque pago', async () => {
  const store = createOrderStore(memoryLedger(), env, catalog());
  await store.reserve(quote(3), buyer, reference(1), 'fingerprint-1');
  await store.reconcile(payment(1, 3), 'evt_paid'); await store.reconcile(payment(1, 3), 'evt_paid');
  await store.reconcile(payment(1, 3, { status: 'expired', payment_status: 'unpaid' }), 'evt_expired');
  await store.failPayment(payment(1, 3, { payment_status: 'unpaid' }), 'evt_failed');
  const order = await store.find(reference(1));
  assert.equal(order.status, 'paid'); assert.equal(order.events.filter(id => id === 'evt_paid').length, 1);
  await assert.rejects(() => store.assertStock(quote(3).items), /estoque/);
});

test('registro recusa pagamento divergente e despacho sem pagamento', async () => {
  const store = createOrderStore(memoryLedger(), env, catalog());
  await store.reserve(quote(1), buyer, reference(1), 'fingerprint-1');
  for (const patch of [{ amount_total: 1 }, { currency: 'usd' }, { livemode: true }, { metadata: { order_fingerprint: 'other' } }]) await assert.rejects(() => store.reconcile(payment(1, 1, patch), 'evt_bad'), /corresponde/);
  await assert.rejects(() => store.markDispatched(reference(1), 'ABC123BR', 'Correios'), /despacho/);
});

test('checkout exige registro durável e webhook verificado antes de vender', () => {
  assert.equal(readiness(env, catalog()), true);
  for (const key of ['DAVORA_WEBHOOK_VERIFIED', 'STRIPE_WEBHOOK_SECRET', 'DAVORA_ORDER_ENCRYPTION_KEY', 'BLOB_READ_WRITE_TOKEN']) assert.equal(readiness({ ...env, [key]: '' }, catalog()), false);
});

test('falha ao salvar o pedido impede a criação de cobrança na Stripe', async t => {
  const prior = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]])), original = products.slice();
  Object.assign(process.env, env); products.splice(0, products.length, ...catalog());
  t.after(() => { products.splice(0, products.length, ...original); for (const [key, value] of Object.entries(prior)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });
  let calls = 0; t.mock.method(global, 'fetch', async () => { calls++; throw new Error('Não cobrar'); });
  const handler = createPaymentHandler({ orders: () => ({ reserve: async () => { throw new StoreError('Armazenamento indisponível.', 503); } }) });
  const q = signedQuote([{ id: 'produto', quantity: 1 }], '30000001', env, products);
  const req = { method: 'POST', headers: { origin: env.DAVORA_STORE_ORIGIN, 'content-type': 'application/json' }, body: {
    attempt: '12345678-1234-1234-1234-123456789012', quoteToken: q.token,
    buyer: { ...buyer, phone: '31999999999', street: 'Rua Teste', number: '10', district: 'Centro', city: 'Cidade Teste', state: 'MG' } } };
  const res = { code: 200, setHeader() {}, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  await handler(req, res); assert.equal(res.code, 503); assert.equal(calls, 0);
});

test('webhook verifica assinatura e confirma apenas o pagamento atual da Stripe', async t => {
  const prior = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]));
  Object.assign(process.env, env);
  t.after(() => { for (const [key, value] of Object.entries(prior)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });
  const store = createOrderStore(memoryLedger(), env, catalog());
  await store.reserve(quote(1), buyer, reference(1), 'fingerprint-1');
  let reads = 0, current = payment(1, 1, { payment_status: 'unpaid' });
  const handler = createStripeWebhookHandler({ orders: () => store, retrieve: async () => { reads++; return current; } });
  const event = { id: 'evt_test1', type: 'checkout.session.completed', livemode: false, data: { object: payment(1, 1) } };
  const raw = JSON.stringify(event);
  const stripe = new Stripe(env.STRIPE_SECRET_KEY);
  const request = (body, signature) => Object.assign(Readable.from([Buffer.from(body)]), { method: 'POST', headers: { 'stripe-signature': signature } });
  const response = () => ({ code: 200, setHeader() {}, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });
  const signature = stripe.webhooks.generateTestHeaderString({ payload: raw, secret: env.STRIPE_WEBHOOK_SECRET });
  const bad = response(); await handler(request(raw + ' ', signature), bad);
  assert.equal(bad.code, 400); assert.equal(reads, 0);
  const valid = response(); await handler(request(raw, signature), valid);
  assert.equal(valid.code, 200); assert.equal((await store.find(reference(1))).status, 'processing');
  current = payment(1, 1);
  const paidRaw = JSON.stringify({ ...event, id: 'evt_test2', type: 'checkout.session.async_payment_succeeded' });
  const paidSig = stripe.webhooks.generateTestHeaderString({ payload: paidRaw, secret: env.STRIPE_WEBHOOK_SECRET });
  const paid = response(); await handler(request(paidRaw, paidSig), paid);
  assert.equal(paid.code, 200); assert.equal((await store.find(reference(1))).fulfillment, 'pending_supplier');
});
