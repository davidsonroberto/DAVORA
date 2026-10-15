import { readiness, quote, guard, replyError, StoreError } from '../lib/store.js';
export default function handler(req, res) {
  try {
    guard(req, res);
    if (!readiness()) throw new StoreError('As compras ainda não estão disponíveis.', 503);
    const result = quote(req.body?.items, req.body?.cep);
    return res.status(200).json(result);
  } catch (error) { return replyError(res, error); }
}
