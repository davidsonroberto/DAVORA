import test from 'node:test';
import assert from 'node:assert/strict';
import { calculatePricingDraft } from '../lib/pricing-draft.js';
import { displayPrice, summarizeCart } from '../assets/catalog-utils.js';
import { products, normalizeItems } from '../lib/store.js';

const policy = { fxReference: { brlNumerator: 5, usdDenominator: 1 }, targetGrossMarginBasisPoints: 5000 };

test('a previsão cobre produto e frete com margem bruta de pelo menos 50%', () => {
  const draft = calculatePricingDraft(500, 500, policy);
  assert.equal(draft.totalCents, 10090);
  assert.equal(draft.shippingReferenceCents, 2500);
  assert.equal(draft.shippingIncludedInEstimate, true);
  assert.ok((draft.totalCents - 5000) / draft.totalCents >= 0.5);
  // An exact .90 boundary must not add another real.
  assert.equal(calculatePricingDraft(509, 500, policy).totalCents, 10090);
});

test('referências inválidas não geram preço de vitrine', () => {
  for (const value of [-1, 0, NaN, Infinity, 1.2, '100']) assert.throws(() => calculatePricingDraft(value, 500, policy));
  for (const value of [0, -1, 1.5]) assert.throws(() => calculatePricingDraft(500, 500, { ...policy, fxReference: { ...policy.fxReference, usdDenominator: value } }));
  for (const margin of [-1, 10000, 20000]) assert.throws(() => calculatePricingDraft(500, 500, { ...policy, targetGrossMarginBasisPoints: margin }));
});

test('os 30 preços previstos aparecem na seleção, mas nunca viram preço de cobrança', () => {
  assert.equal(products.length, 30);
  for (const product of products) {
    const value = displayPrice(product);
    assert.ok(value?.draft);
    assert.equal(value.cents, product.pricingDraft.totalCents);
    assert.equal(product.priceCents, null);
    const cart = summarizeCart({ [product.id]: 2 }, products);
    assert.equal(cart.referenceTotalCents, value.cents * 2);
    assert.equal(cart.subtotalCents, null);
    assert.equal(cart.purchasable, false);
    assert.throws(() => normalizeItems([{ id: product.id, quantity: 1, priceCents: value.cents }], products), /disponível/);
  }
});

test('a vitrine recusa previsão corrompida e prioriza o preço final quando existir', () => {
  for (const totalCents of [-1, 0, 1.5, '100', NaN]) assert.equal(displayPrice({ pricingDraft: { status: 'draft', currency: 'BRL', totalCents } }), null);
  assert.deepEqual(displayPrice({ priceCents: 12990, pricingDraft: { status: 'draft', currency: 'BRL', totalCents: 15990 } }), { cents: 12990, draft: false });
});
