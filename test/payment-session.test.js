import test from 'node:test';
import assert from 'node:assert/strict';
import { sign, validateBuyer } from '../lib/store.js';
import { resumePayment } from '../lib/payment-session.js';
import resumeHandler from '../api/resume-store-payment.js';
import { savePaymentRecord, restorePaymentRecord } from '../assets/payment-recovery.js';

const env = { STRIPE_SECRET_KEY: 'sk_test_NOT_A_REAL_CREDENTIAL', STRIPE_PUBLISHABLE_KEY: 'pk_test_NOT_A_REAL_CREDENTIAL', DAVORA_CHECKOUT_SECRET: 'test-only-secret-with-at-least-32-characters', DAVORA_STORE_ORIGIN: 'https://store.example' };
const reference = 'DAVORA-12345678-1234-1234-1234-123456789012';
const order = { kind: 'payment', paymentId: 'cs_test_123', reference, totalCents: 5648, live: false, expiresAt: Date.now() + 3600000 };
const token = sign(order, env.DAVORA_CHECKOUT_SECRET);
const session = { id: order.paymentId, client_reference_id: reference, mode: 'payment', currency: 'brl', amount_total: order.totalCents, livemode: false, status: 'open', payment_status: 'unpaid', client_secret: 'cs_test_123_secret_NOT_REAL' };

test('servidor recusa endereço com CEP diferente da cotação', () => {
  assert.throws(() => validateBuyer({ cep: '01000000' }, '30000001'), /CEP mudou/);
});

test('retoma a mesma sessão Stripe aberta sem criar outro pagamento', async t => {
  let calls = 0;
  t.mock.method(global, 'fetch', async (url, options) => {
    calls++; assert.equal(url, 'https://api.stripe.com/v1/checkout/sessions/cs_test_123');
    assert.equal(options.method, undefined);
    return { ok: true, json: async () => session };
  });
  const result = await resumePayment(token, env);
  assert.equal(result.status, 'pending'); assert.equal(result.reference, reference);
  assert.equal(result.clientSecret, session.client_secret); assert.equal(result.publishableKey, env.STRIPE_PUBLISHABLE_KEY);
  assert.equal(calls, 1);
});

test('sessões pagas, expiradas ou aguardando compensação não expõem formulário', async t => {
  let current;
  t.mock.method(global, 'fetch', async () => ({ ok: true, json: async () => current }));
  for (const [status, payment_status, expected] of [['complete', 'paid', 'approved'], ['expired', 'unpaid', 'cancelled'], ['complete', 'unpaid', 'pending']]) {
    current = { ...session, status, payment_status };
    const result = await resumePayment(token, env);
    assert.deepEqual(result, { status: expected, reference });
  }
});

test('retomada recusa token adulterado, expirado e de outro ambiente antes de consultar Stripe', async t => {
  let calls = 0; t.mock.method(global, 'fetch', async () => { calls++; throw new Error('Não consultar'); });
  const expired = sign({ ...order, expiresAt: Date.now() - 1 }, env.DAVORA_CHECKOUT_SECRET);
  const otherMode = sign({ ...order, live: true }, env.DAVORA_CHECKOUT_SECRET);
  for (const invalid of [token + 'x', expired, otherMode, null]) await assert.rejects(() => resumePayment(invalid, env));
  assert.equal(calls, 0);
});

test('retomada recusa valor, referência e ambiente divergentes na Stripe', async t => {
  let current;
  t.mock.method(global, 'fetch', async () => ({ ok: true, json: async () => current }));
  for (const patch of [{ amount_total: 1 }, { client_reference_id: 'DAVORA-other' }, { livemode: true }, { currency: 'usd' }]) {
    current = { ...session, ...patch };
    await assert.rejects(() => resumePayment(token, env), /confirmar/);
  }
});

test('registro na aba conserva o acompanhamento e exclui dados pessoais e segredo Stripe', () => {
  let value = null;
  const storage = { setItem(key, data) { value = data; }, getItem() { return value; }, removeItem() { value = null; } };
  const payment = { token, reference, expiresAt: order.expiresAt, selection: [{ id: 'infinito-869', quantity: 1 }], clientSecret: session.client_secret, buyer: { cpf: '19119119100', email: 'cliente@example.com' } };
  assert.equal(savePaymentRecord(storage, payment), true);
  assert.ok(!value.includes('secret_NOT_REAL')); assert.ok(!value.includes('cpf')); assert.ok(!value.includes('cliente@example.com'));
  assert.deepEqual(restorePaymentRecord(storage), { token, reference, expiresAt: order.expiresAt, selection: payment.selection });
  assert.equal(restorePaymentRecord(storage, order.expiresAt + 1), null); assert.equal(value, null);
  value = '{invalid'; assert.equal(restorePaymentRecord(storage), null);
  assert.equal(savePaymentRecord(null, payment), false); assert.equal(restorePaymentRecord(null), null);
  assert.equal(savePaymentRecord(storage, { ...payment, selection: 'invalid' }), false);
});

test('API de retomada recusa origem externa sem consultar Stripe', async t => {
  let calls = 0; t.mock.method(global, 'fetch', async () => { calls++; });
  const res = { code: 200, setHeader() {}, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  await resumeHandler({ method: 'POST', headers: { origin: 'https://external.example', 'content-type': 'application/json' }, body: { token } }, res);
  assert.equal(res.code, 403); assert.equal(calls, 0);
});
