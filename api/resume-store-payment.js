import { guard, replyError } from '../lib/store.js';
import { resumePayment } from '../lib/payment-session.js';

export default async function handler(req, res) {
  try {
    guard(req, res);
    return res.status(200).json(await resumePayment(req.body?.token));
  } catch (error) { return replyError(res, error); }
}
