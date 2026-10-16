import { guard, replyError, readiness } from '../lib/store.js';
import { getOrderStore } from '../lib/orders.js';
export default async function handler(req, res) {
  try {
    guard(req, res, 'GET');
    const health = await getOrderStore().health();
    return res.status(200).json({ ...health, checkoutEnabled: readiness() });
  } catch (error) { return replyError(res, error); }
}
