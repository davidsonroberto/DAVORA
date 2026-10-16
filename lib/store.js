import { createHmac, timingSafeEqual } from 'node:crypto';
import catalog from '../data/catalog.json' with { type: 'json' };
import { ordersConfigured } from './order-config.js';
import { hasFreshInventory } from '../assets/inventory.js';
import { supplierReady, hasWixMapping, WIX_SITE_ID } from './fulfillment-config.js';

export const products = catalog.products;
const MAX_ORDER_CENTS = 500000;
const MAX_QUANTITY = 10;

export class StoreError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

export function isPurchasable(product, now = Date.now()) {
  return product.availability === 'available' && product.supplierApproved === true &&
    Number.isSafeInteger(product.priceCents) && product.priceCents > 0 &&
    hasFreshInventory(product, 1, now);
}

export function readiness(env = process.env, list = products, now = Date.now()) {
  return env.DAVORA_CHECKOUT_ENABLED === 'true' &&
    env.DAVORA_SUPPLIER_APPROVED === 'true' &&
    env.DAVORA_MERCHANT_REVIEWED === 'true' &&
    ordersConfigured(env) && env.DAVORA_WEBHOOK_VERIFIED === 'true' &&
    /^whsec_.+/.test(env.STRIPE_WEBHOOK_SECRET || '') &&
    stripeKeysMatch(env) && (env.DAVORA_CHECKOUT_SECRET || '').length >= 32 &&
    validOrigin(env.DAVORA_STORE_ORIGIN) && shippingRules(env).length > 0 &&
    list.some(p => isPurchasable(p, now)) && list.filter(p => isPurchasable(p, now)).every(p => supplierReady(p, env));
}

export function stripeKeysMatch(env = process.env) {
  const secretMode = /^(?:sk|rk)_(test|live)_/.exec(env.STRIPE_SECRET_KEY || '')?.[1];
  const publicMode = /^pk_(test|live)_/.exec(stripePublishableKey(env))?.[1];
  return Boolean(secretMode && secretMode === publicMode);
}

export function stripePublishableKey(env = process.env) {
  return env.STRIPE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';
}

function validOrigin(value) {
  try { const u = new URL(value); return u.protocol === 'https:' && u.origin === value; }
  catch { return false; }
}

export function shippingRules(env = process.env) {
  try {
    const rules = JSON.parse(env.DAVORA_SHIPPING_RULES || '[]');
    if (!Array.isArray(rules) || rules.length > 100) return [];
    return rules.filter(r => typeof r.cepStart === 'string' && /^\d{8}$/.test(r.cepStart) &&
      typeof r.cepEnd === 'string' && /^\d{8}$/.test(r.cepEnd) && r.cepStart <= r.cepEnd &&
      Number.isSafeInteger(r.priceCents) && r.priceCents >= 0 && r.priceCents <= MAX_ORDER_CENTS &&
      Number.isSafeInteger(r.days) && r.days > 0 && r.days <= 90);
  } catch { return []; }
}

export function normalizeItems(items, list = products, now = Date.now()) {
  if (!Array.isArray(items) || !items.length || items.length > 20) throw new StoreError('Selecione os produtos do pedido.');
  const quantities = new Map();
  for (const item of items) {
    if (!item || typeof item.id !== 'string' || !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > MAX_QUANTITY) {
      throw new StoreError('Quantidade inválida.');
    }
    quantities.set(item.id, (quantities.get(item.id) || 0) + item.quantity);
  }
  const normalized = [...quantities].sort(([a], [b]) => a.localeCompare(b)).map(([id, quantity]) => {
    const p = list.find(p => p.id === id);
    if (!p || !isPurchasable(p, now)) throw new StoreError('Um produto ainda não está disponível para venda.', 409);
    if (quantity > MAX_QUANTITY || !hasFreshInventory(p, quantity, now)) throw new StoreError('Quantidade maior que o estoque confirmado.', 409);
    return { id, name: p.name, quantity, priceCents: p.priceCents,
      ...(p.supplierSku ? { supplierPlatform: p.supplierPlatform, supplierProductId: p.supplierProductId,
        supplierVariantId: p.supplierVariantId, supplierSku: p.supplierSku } : {}),
      ...(hasWixMapping(p) ? { wixSiteId: WIX_SITE_ID, wixProductId: p.fulfillmentMapping.productId, wixVariantId: p.fulfillmentMapping.variantId } : {}) };
  });
  const subtotalCents = normalized.reduce((sum, i) => sum + i.quantity * i.priceCents, 0);
  if (!Number.isSafeInteger(subtotalCents) || subtotalCents <= 0 || subtotalCents > MAX_ORDER_CENTS) throw new StoreError('Valor do pedido inválido.');
  return { items: normalized, subtotalCents };
}

export function sign(payload, secret) {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return data + '.' + createHmac('sha256', secret).update(data).digest('base64url');
}

export function verify(token, secret, kind, now = Date.now()) {
  if (typeof token !== 'string' || token.length > 16000) throw new StoreError('Confirmação inválida.');
  const parts = token.split('.');
  if (parts.length !== 2) throw new StoreError('Confirmação inválida.');
  const expected = createHmac('sha256', secret).update(parts[0]).digest();
  const actual = Buffer.from(parts[1], 'base64url');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new StoreError('Confirmação inválida.');
  let payload;
  try { payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString()); }
  catch { throw new StoreError('Confirmação inválida.'); }
  if (payload.kind !== kind || !Number.isFinite(payload.expiresAt) || payload.expiresAt <= now) throw new StoreError('Confirmação expirada. Recalcule o frete.', 409);
  return payload;
}

export function quote(items, cep, env = process.env, list = products, now = Date.now()) {
  if (typeof cep !== 'string' || !/^\d{8}$/.test(cep)) throw new StoreError('Informe um CEP com 8 números.');
  const cart = normalizeItems(items, list, now);
  const rules = shippingRules(env).filter(r => cep >= r.cepStart && cep <= r.cepEnd);
  // Rules are per complete order. Overlapping ranges need explicit correction rather than guessing.
  if (rules.length !== 1) throw new StoreError('Não foi possível confirmar o frete para este CEP.', 409);
  const rule = rules[0];
  const totalCents = cart.subtotalCents + rule.priceCents;
  if (!Number.isSafeInteger(totalCents) || totalCents > MAX_ORDER_CENTS) throw new StoreError('Valor do pedido inválido.');
  const data = { kind: 'quote', ...cart, cep, shippingCents: rule.priceCents, deliveryDays: rule.days, totalCents, expiresAt: now + 15 * 60000 };
  return { ...data, token: sign(data, env.DAVORA_CHECKOUT_SECRET) };
}

export function verifyQuote(token, env = process.env, list = products, now = Date.now()) {
  const data = verify(token, env.DAVORA_CHECKOUT_SECRET, 'quote', now);
  const current = quote(data.items, data.cep, env, list, now);
  if (JSON.stringify(current.items) !== JSON.stringify(data.items) || current.totalCents !== data.totalCents || current.deliveryDays !== data.deliveryDays) {
    throw new StoreError('O pedido mudou. Recalcule o frete.', 409);
  }
  return data;
}

export function cpfValid(value) {
  if (!/^\d{11}$/.test(value) || /^(\d)\1{10}$/.test(value)) return false;
  for (let size = 9; size <= 10; size++) {
    let sum = 0;
    for (let i = 0; i < size; i++) sum += Number(value[i]) * (size + 1 - i);
    const digit = (sum * 10) % 11 % 10;
    if (digit !== Number(value[size])) return false;
  }
  return true;
}

export function validateBuyer(buyer, cep) {
  if (buyer?.cep !== undefined && buyer.cep !== cep) throw new StoreError('O CEP mudou. Recalcule o frete.', 409);
  const text = (key, min = 1, max = 120) => {
    const value = typeof buyer?.[key] === 'string' ? buyer[key].trim() : '';
    if (value.length < min || value.length > max || /[<>\x00-\x1f]/.test(value)) throw new StoreError('Confira seus dados de entrega.');
    return value;
  };
  const name = text('name', 3), email = text('email', 5, 150), cpf = text('cpf', 11, 11);
  const street = text('street', 3), number = text('number', 1, 8), district = text('district', 2), city = text('city', 2), state = text('state', 2, 2);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !cpfValid(cpf) || !/^\d{1,8}$/.test(number) || !/^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$/.test(state)) throw new StoreError('Confira e-mail, CPF e endereço.');
  const complement = typeof buyer.complement === 'string' ? buyer.complement.trim().slice(0, 120) : '';
  const phone = text('phone', 10, 11);
  if (!/^\d{10,11}$/.test(phone)) throw new StoreError('Informe um telefone válido.');
  return { name, email, cpf, street, number, district, city, state, complement, phone, cep };
}

export function guard(req, res, method = 'POST', env = process.env) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== method) { res.setHeader('Allow', method); throw new StoreError('Método não permitido.', 405); }
  if (method === 'POST') {
    if (!validOrigin(env.DAVORA_STORE_ORIGIN) || req.headers.origin !== env.DAVORA_STORE_ORIGIN) throw new StoreError('Origem não autorizada.', 403);
    if (!String(req.headers['content-type'] || '').startsWith('application/json')) throw new StoreError('Formato inválido.', 415);
    if (JSON.stringify(req.body || {}).length > 20000) throw new StoreError('Pedido muito grande.', 413);
  }
}

export function replyError(res, error) {
  return res.status(error instanceof StoreError ? error.status : 500).json({ error: error instanceof StoreError ? error.message : 'Não foi possível concluir. Tente novamente em instantes.' });
}

export function paymentMatches(payment, data) {
  return String(payment.id) === String(data.paymentId) && payment.client_reference_id === data.reference &&
    payment.mode === 'payment' && payment.currency === 'brl' && payment.amount_total === data.totalCents &&
    (data.live === undefined || payment.livemode === data.live);
}
