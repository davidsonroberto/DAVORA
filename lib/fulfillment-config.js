// This client belongs to the owner's existing Wix site. No credentials are public.
export const WIX_SITE_ID = 'd8b1d97c-b1cf-4548-8dae-3c9f70ec2baa';
export const WIX_CLIENT_ID = 'b71b81f1-6b07-4c93-a555-63200812560f';
export const isGuid = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
export function wixCredentialsConfigured(env = process.env) {
  return env.WIX_CLIENT_ID === WIX_CLIENT_ID && typeof env.WIX_CLIENT_SECRET === 'string' && env.WIX_CLIENT_SECRET.length >= 16;
}
export function wixOrdersEnabled(env = process.env) {
  return env.DAVORA_WIX_ORDERS_ENABLED === 'true' && wixCredentialsConfigured(env);
}
export function hasWixMapping(product) {
  const mapping = product.fulfillmentMapping;
  return mapping?.provider === 'wix' && mapping.siteId === WIX_SITE_ID &&
    isGuid(mapping.productId) && isGuid(mapping.variantId) && mapping.zendropLinked === true &&
    mapping.supplierSku === product.supplierSku && mapping.supplierVariantId === product.supplierVariantId;
}
export function supplierReady(product, env = process.env) {
  if (product.supplierPlatform !== 'zendrop') return true;
  return wixOrdersEnabled(env) && env.DAVORA_WIX_ORDERS_VERIFIED === 'true' && hasWixMapping(product);
}
