import { readiness, quote, guard, replyError, StoreError } from '../lib/store.js';
import { getOrderStore } from '../lib/orders.js';
export default async function handler(req, res) {
  try {
    guard(req, res);
    if (!readiness()) throw new StoreError('As compras ainda não estão disponíveis.', 503);
    const result = quote(req.body?.items, req.body?.cep);
    await getOrderStore().assertStock(result.items);
    return res.status(200).json(result);
  } catch (error) { return replyError(res, error); }
}
