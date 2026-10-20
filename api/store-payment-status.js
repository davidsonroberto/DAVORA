import { guard, replyError } from '../lib/store.js';
import { retrievePayment } from '../lib/payment-session.js';
import { trackingPath } from '../lib/tracking.js';
export default async function handler(req, res) {
  try {
    guard(req, res);
    const { data, status } = await retrievePayment(req.body?.token);
    return res.status(200).json({ status, reference: data.reference,
      ...(status === 'approved' ? { trackingPath: trackingPath(data) } : {}) });
  } catch (error) { return replyError(res, error); }
}
