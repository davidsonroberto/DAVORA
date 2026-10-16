// Planning only. These values are never accepted as checkout prices or shipping rules.
export function calculatePricingDraft(productCostUSDCents, shippingUSDCents, policy) {
  const { brlNumerator, usdDenominator } = policy.fxReference;
  const margin = policy.targetGrossMarginBasisPoints;
  for (const value of [productCostUSDCents, shippingUSDCents, brlNumerator, usdDenominator]) {
    if (!Number.isSafeInteger(value) || value <= 0) throw new Error('Custo ou referência cambial inválidos');
  }
  if (!Number.isSafeInteger(margin) || margin < 0 || margin >= 10000) throw new Error('Margem inválida');
  const numerator = BigInt(brlNumerator), denominator = BigInt(usdDenominator);
  const shipping = (BigInt(shippingUSDCents) * numerator * 2n + denominator) / (2n * denominator);
  const cost = (BigInt(productCostUSDCents) + BigInt(shippingUSDCents)) * numerator;
  const divisor = denominator * BigInt(10000 - margin);
  const minimum = (cost * 10000n + divisor - 1n) / divisor;
  // Round upward to a retail price ending in R$ 0,90, without reducing the target margin.
  const total = minimum <= 90n ? 90n : ((minimum - 90n + 99n) / 100n) * 100n + 90n;
  if (total > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Preço fora do limite');
  return {
    status: 'draft', currency: 'BRL', scope: 'one_unit_product_country_estimate',
    totalCents: Number(total), shippingReferenceCents: Number(shipping),
    shippingIncludedInEstimate: true
  };
}
