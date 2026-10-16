import { guard, replyError, products } from '../lib/store.js';
import { wixCredentialsConfigured, wixOrdersEnabled, hasWixMapping } from '../lib/fulfillment-config.js';
export default function handler(req, res) {
  try {
    guard(req, res, 'GET');
    return res.status(200).json({ provider: 'wix_zendrop', credentialsConfigured: wixCredentialsConfigured(),
      enabled: wixOrdersEnabled(), verified: process.env.DAVORA_WIX_ORDERS_VERIFIED === 'true',
      mappedProducts: products.filter(hasWixMapping).length, expectedProducts: products.length });
  } catch (error) { return replyError(res, error); }
}
