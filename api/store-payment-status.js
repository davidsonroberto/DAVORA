import { guard, replyError } from '../lib/store.js';
import { retrievePayment } from '../lib/payment-session.js';
export default async function handler(req, res) {
  try {
    guard(req, res);
    const { data, status } = await retrievePayment(req.body?.token);
    return res.status(200).json({ status, reference: data.reference });
  } catch (error) { return replyError(res, error); }
}
