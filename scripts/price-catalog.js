import { readFileSync, writeFileSync } from 'node:fs';
import { calculatePricingDraft } from '../lib/pricing-draft.js';

const path = 'data/catalog.json';
const catalog = JSON.parse(readFileSync(path, 'utf8'));
const policy = {
  status: 'draft', currency: 'BRL', targetGrossMarginBasisPoints: 5000,
  basis: 'selected_variant_plus_one_unit_shipping_estimate',
  rounding: 'up_to_next_90_cents',
  fxReference: {
    source: 'European Central Bank', date: '2026-10-16',
    url: 'https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html',
    eurUSD: '1.1253', eurBRL: '5.7197', brlNumerator: 57197, usdDenominator: 11253,
    purpose: 'budget_reference_only'
  },
  excludedCosts: ['taxes_and_duties', 'payment_processing', 'fx_spread', 'advertising', 'returns', 'subscriptions'],
  note: 'Meta de margem bruta antes das despesas excluídas; não é comissão nem promessa de lucro líquido.'
};
for (const product of catalog.products) {
  const estimate = product.shippingEstimate;
  const option = estimate?.options?.find(option => option.type === 'regular');
  if (product.supplierCost?.currency !== 'USD' || !product.supplierCost.variantConfirmed ||
      estimate?.currency !== 'USD' || estimate.country !== 'BR' || !option) throw new Error('Dados incompletos: ' + product.id);
  product.pricingDraft = {
    ...calculatePricingDraft(product.supplierCost.variantCents, option.priceCents, policy),
    shippingType: option.type,
    estimatedDeliveryText: option.estimatedDeliveryText
  };
}
catalog.pricingPolicy = policy;
writeFileSync(path, JSON.stringify(catalog, null, 2) + '\n');
console.log(`Preços previstos dos ${catalog.products.length} produtos calculados; checkout e preços de cobrança não alterados.`);
