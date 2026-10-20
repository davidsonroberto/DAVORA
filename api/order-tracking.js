import { replyError, StoreError } from '../lib/store.js';
import { getOrderStore } from '../lib/orders.js';
import { trackingStatus } from '../lib/tracking.js';

export function createTrackingHandler({ orders = getOrderStore, env = process.env } = {}) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.setHeader('Referrer-Policy', 'no-referrer');
    try {
      if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); throw new StoreError('Método não permitido.', 405); }
      const token = req.query?.token;
      if (typeof token !== 'string') throw new StoreError('Abra o link de acompanhamento fornecido após o pagamento.');
      return res.status(200).json(await trackingStatus(token, orders(), env));
    } catch (error) { return replyError(res, error); }
  };
}
export default createTrackingHandler();
