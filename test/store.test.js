import test from 'node:test';
import assert from 'node:assert/strict';
import { readiness, isPurchasable, normalizeItems, quote, verifyQuote, sign, verify, cpfValid, paymentMatches, products, stripeKeysMatch, stripePublishableKey } from '../lib/store.js';
import { restoreCart, filterProducts, summarizeCart } from '../assets/catalog-utils.js';
import createPayment from '../api/create-store-payment.js';
import paymentStatus from '../api/store-payment-status.js';
import storeConfig from '../api/store-config.js';
import legacyWebhook from '../api/webhook.js';
import { sessionPayload } from '../lib/stripe.js';

const now = Date.now();
const fixture = [{ id: 'verified-test-product', name: 'Produto de teste', priceCents: 2199, stock: 5, stockConfirmedAt: new Date(now).toISOString(), availability: 'available', supplierApproved: true, brand: 'Teste', category: 'Cabos e carga', description: 'Teste' }];
const env = {
  DAVORA_CHECKOUT_ENABLED: 'true', DAVORA_SUPPLIER_APPROVED: 'true', DAVORA_MERCHANT_REVIEWED: 'true',
  STRIPE_SECRET_KEY: 'sk_test_NOT_A_REAL_CREDENTIAL', STRIPE_PUBLISHABLE_KEY: 'pk_test_NOT_A_REAL_CREDENTIAL', DAVORA_CHECKOUT_SECRET: 'test-only-secret-with-at-least-32-characters',
  DAVORA_STORE_ORIGIN: 'https://store.example', DAVORA_SHIPPING_RULES: JSON.stringify([{ cepStart: '30000000', cepEnd: '39999999', priceCents: 1250, days: 8 }])
};
const items = [{ id: fixture[0].id, quantity: 2, priceCents: 1 }];
function response() { return { code: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(v) { this.code = v; return this; }, json(v) { this.body = v; return this; } }; }
const request = body => ({ method: 'POST', headers: { origin: env.DAVORA_STORE_ORIGIN, 'content-type': 'application/json' }, body });

test('checkout fechado sem configuração, fornecedor aprovado e estoque recente', () => {
  assert.equal(readiness({}), false);
  assert.equal(readiness(env, products, now), false);
  assert.equal(readiness(env, fixture, now), true);
  for (const key of Object.keys(env)) assert.equal(readiness({ ...env, [key]: '' }, fixture, now), false, key);
  assert.equal(isPurchasable({ ...fixture[0], stockConfirmedAt: new Date(now - 86400001).toISOString() }, now), false);
  assert.equal(isPurchasable({ ...fixture[0], stockConfirmedAt: new Date(now + 1000).toISOString() }, now), false);
});
test('o servidor ignora preços enviados pelo navegador e soma em centavos', () => {
  assert.equal(normalizeItems(items, fixture, now).subtotalCents, 4398);
  const q = quote(items, '30000001', env, fixture, now);
  assert.equal(q.shippingCents, 1250); assert.equal(q.totalCents, 5648);
});
test('quantidades duplicadas não ultrapassam o estoque', () => {
  assert.throws(() => normalizeItems([{ id: fixture[0].id, quantity: 3 }, { id: fixture[0].id, quantity: 3 }], fixture, now), /estoque/);
  for (const quantity of [0, -1, 1.5, '2', 99, NaN]) assert.throws(() => normalizeItems([{ id: fixture[0].id, quantity }], fixture, now));
  assert.throws(() => normalizeItems([{ id: 'inexistente', quantity: 1 }], fixture, now));
});
test('produtos pendentes não viram cobrança mesmo com preço adulterado', () => {
  assert.throws(() => normalizeItems([{ id: products[0].id, quantity: 1, priceCents: 500 }], products, now), /disponível/);
  assert.equal(summarizeCart({ [products[0].id]: 1 }, products).purchasable, false);
  assert.equal(summarizeCart({ [products[0].id]: 1 }, products).subtotalCents, null);
});
test('frete inexistente ou com faixas conflitantes impede pagamento', () => {
  assert.throws(() => quote(items, '01000000', env, fixture, now), /frete/);
  assert.throws(() => quote(items, '30000', env, fixture, now), /CEP/);
  const rules = JSON.parse(env.DAVORA_SHIPPING_RULES);
  assert.throws(() => quote(items, '30000001', { ...env, DAVORA_SHIPPING_RULES: JSON.stringify([...rules, ...rules]) }, fixture, now), /frete/);
});
test('cotação assinada rejeita adulteração, expiração e mudança no catálogo', () => {
  const q = quote(items, '30000001', env, fixture, now);
  assert.equal(verifyQuote(q.token, env, fixture, now).totalCents, 5648);
  const [data, sig] = q.token.split('.');
  const forged = JSON.parse(Buffer.from(data, 'base64url')); forged.totalCents = 1;
  assert.throws(() => verifyQuote(Buffer.from(JSON.stringify(forged)).toString('base64url') + '.' + sig, env, fixture, now));
  assert.throws(() => verifyQuote(q.token, env, fixture, now + 16 * 60000), /expirada/);
  assert.throws(() => verifyQuote(q.token, env, [{ ...fixture[0], priceCents: 3000 }], now), /mudou/);
});
test('tipo de token e identificação do pagamento são conferidos', () => {
  const data = { kind: 'payment', paymentId: '123', reference: 'DAVORA-test', totalCents: 5648, expiresAt: now + 60000 };
  assert.throws(() => verify(sign(data, env.DAVORA_CHECKOUT_SECRET), env.DAVORA_CHECKOUT_SECRET, 'quote', now));
  const p = { id: 123, client_reference_id: data.reference, mode: 'payment', currency: 'brl', amount_total: 5648 };
  assert.equal(paymentMatches(p, data), true);
  for (const patch of [{ id: 124 }, { currency: 'usd' }, { amount_total: 1 }, { client_reference_id: 'other' }, { mode: 'subscription' }]) assert.equal(paymentMatches({ ...p, ...patch }, data), false);
  assert.equal(cpfValid('11111111111'), false); assert.equal(cpfValid('19119119100'), true);
});
test('seleção resiste a dados corrompidos e busca ignora acentos', () => {
  assert.deepEqual(restoreCart('{invalid', products), {});
  assert.deepEqual(restoreCart('null', products), {});
  assert.deepEqual(restoreCart('[]', products), {});
  assert.deepEqual(restoreCart(JSON.stringify({ missing: 2, [products[0].id]: -1 }), products), {});
  assert.ok(filterProducts(products, 'protecao', 'Todos').length > 0);
  assert.equal(filterProducts(products, 'zzzinexistente', 'Todos').length, 0);
  const filtered = filterProducts(products, 'iphone', 'Capinhas e proteção');
  assert.ok(filtered.length > 0);
  assert.ok(filtered.every(p => p.category === 'Capinhas e proteção'));
});
test('fluxo API recusa origens externas e catálogo pendente sem chamar o provedor', async () => {
  const prior = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]));
  const oldFetch = global.fetch; let calls = 0;
  Object.assign(process.env, env); global.fetch = async () => { calls++; throw new Error('Não chamar'); };
  try {
    const disabled = response(); await createPayment(request({}), disabled); assert.equal(disabled.code, 503);
    const foreign = request({}); foreign.headers.origin = 'https://other.example';
    const denied = response(); await createPayment(foreign, denied); assert.equal(denied.code, 403); assert.equal(calls, 0);
  } finally {
    global.fetch = oldFetch;
    for (const [key, value] of Object.entries(prior)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});
test('Stripe embutida usa valores oficiais, chave idempotente e confirmação autoritativa', async () => {
  const oldProducts = products.slice(), oldFetch = global.fetch;
  const prior = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]));
  Object.assign(process.env, env); products.splice(0, products.length, ...fixture);
  let captured = [], storedPayment;
  global.fetch = async (url, options) => {
    if (options.method === 'POST') {
      const body = new URLSearchParams(options.body); captured.push({ body, key: options.headers['Idempotency-Key'], version: options.headers['Stripe-Version'] });
      const subtotal = Number(body.get('line_items[0][price_data][unit_amount]')) * Number(body.get('line_items[0][quantity]'));
      storedPayment = { id: 'cs_test_123', client_secret: 'cs_test_123_secret_NOT_REAL', mode: 'payment', status: 'open', payment_status: 'unpaid', livemode: false, client_reference_id: body.get('client_reference_id'), currency: 'brl', amount_total: subtotal + Number(body.get('shipping_options[0][shipping_rate_data][fixed_amount][amount]')), metadata: { order_fingerprint: body.get('metadata[order_fingerprint]') } };
    }
    return { ok: true, json: async () => storedPayment };
  };
  try {
    const q = quote(items, '30000001', env, fixture, Date.now());
    const body = { attempt: '12345678-1234-1234-1234-123456789012', quoteToken: q.token, transaction_amount: 0.01, buyer: { name: 'Cliente Teste', email: 'cliente@example.com', cpf: '19119119100', phone: '31999999999', street: 'Rua Teste', number: '10', district: 'Centro', city: 'Cidade Teste', state: 'MG' } };
    const res = response(); await createPayment(request(body), res); assert.equal(res.code, 200); assert.ok(res.body.token);
    const cfg = response(); storeConfig({ method: 'GET' }, cfg); assert.equal(cfg.body.provider, 'stripe'); assert.equal(cfg.body.testMode, true); assert.ok(!JSON.stringify(cfg.body).includes(env.STRIPE_SECRET_KEY));
    assert.equal(storedPayment.amount_total, 5648); assert.equal(captured[0].body.get('ui_mode'), 'embedded_page');
    assert.equal(captured[0].body.get('redirect_on_completion'), 'never'); assert.equal(captured[0].body.get('allowed_payment_method_types[0]'), 'card');
    assert.equal(captured[0].body.has('allowed_payment_method_types[1]'), false); assert.equal(captured[0].version, '2026-09-30.endive');
    assert.ok(res.body.clientSecret); assert.equal(res.body.publishableKey, env.STRIPE_PUBLISHABLE_KEY);
    const retry = response(); await createPayment(request(body), retry); assert.equal(captured[1].key, captured[0].key);
    storedPayment.status = 'complete';
    const waiting = response(); await paymentStatus(request({ token: res.body.token }), waiting); assert.equal(waiting.body.status, 'pending');
    storedPayment.payment_status = 'paid';
    const status = response(); await paymentStatus(request({ token: res.body.token }), status); assert.equal(status.body.status, 'approved');
    storedPayment.amount_total = 1;
    const wrong = response(); await paymentStatus(request({ token: res.body.token }), wrong); assert.equal(wrong.code, 409);
  } finally {
    products.splice(0, products.length, ...oldProducts); global.fetch = oldFetch;
    for (const [key, value] of Object.entries(prior)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});

test('chaves Stripe de ambientes diferentes são recusadas', () => {
  assert.equal(stripeKeysMatch(env), true);
  assert.equal(stripeKeysMatch({ ...env, STRIPE_PUBLISHABLE_KEY: 'pk_live_NOT_A_REAL_CREDENTIAL' }), false);
  assert.equal(readiness({ ...env, STRIPE_PUBLISHABLE_KEY: 'pk_live_NOT_A_REAL_CREDENTIAL' }, fixture, now), false);
});

test('chave publicável gerenciada pela Vercel funciona e respeita o ambiente', () => {
  const managed = { ...env, STRIPE_PUBLISHABLE_KEY: '', NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: env.STRIPE_PUBLISHABLE_KEY };
  assert.equal(stripePublishableKey(managed), env.STRIPE_PUBLISHABLE_KEY);
  assert.equal(readiness(managed, fixture, now), true);
  assert.equal(readiness({ ...managed, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_live_NOT_A_REAL_CREDENTIAL' }, fixture, now), false);
  assert.equal(stripePublishableKey({ ...managed, STRIPE_PUBLISHABLE_KEY: 'pk_test_EXPLICIT_NOT_REAL' }), 'pk_test_EXPLICIT_NOT_REAL');
});
test('Pix só entra na sessão depois de habilitação explícita', () => {
  const q = quote(items, '30000001', env, fixture, now);
  const buyer = { email: 'cliente@example.com', name: 'Cliente Teste', phone: '31999999999', street: 'Rua Teste', number: '10', district: 'Centro', city: 'Cidade Teste', state: 'MG', cep: '30000001' };
  const normal = sessionPayload(q, buyer, '12345678-1234-1234-1234-123456789012', env);
  const pix = sessionPayload(q, buyer, '12345678-1234-1234-1234-123456789012', { ...env, STRIPE_PIX_ENABLED: 'true' });
  assert.equal(normal.body.get('allowed_payment_method_types[1]'), null);
  assert.equal(pix.body.get('allowed_payment_method_types[1]'), 'pix');
  assert.equal(pix.body.get('payment_intent_data[shipping][address][country]'), 'BR');
});

test('repetição após atraso mantém todos os parâmetros da sessão idênticos', t => {
  const clock = t.mock.method(Date, 'now', () => now);
  const q = quote(items, '30000001', env, fixture, now);
  const buyer = { email: 'cliente@example.com', name: 'Cliente Teste', phone: '31999999999', street: 'Rua Teste', number: '10', district: 'Centro', city: 'Cidade Teste', state: 'MG', cep: '30000001' };
  const attempt = '12345678-1234-1234-1234-123456789012';
  const first = sessionPayload(q, buyer, attempt, env);
  clock.mock.mockImplementation(() => now + 5 * 60000);
  const retry = sessionPayload(q, buyer, attempt, env);
  assert.equal(retry.key, first.key);
  assert.equal(retry.body.toString(), first.body.toString());
  assert.match(first.body.get('integration_identifier'), /^davora_embedded_[a-z]{8}$/);
  const expiresAt = Number(first.body.get('expires_at')) * 1000;
  assert.ok(expiresAt - q.expiresAt > 30 * 60000);
  assert.ok(expiresAt - now < 24 * 3600000);
});

test('webhook antigo não confirma o recebimento de eventos sem processá-los', async () => {
  const res = response();
  await legacyWebhook({ method: 'POST', body: { type: 'checkout.session.completed' } }, res);
  assert.equal(res.code, 410);
  assert.equal(res.body.received, undefined);
});
