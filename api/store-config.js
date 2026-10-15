import { readiness, stripePublishableKey } from '../lib/store.js';
export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido.' });
  const enabled = readiness();
  const publishableKey = enabled ? stripePublishableKey() : null;
  return res.status(200).json({ checkoutEnabled: enabled, currency: 'BRL', provider: 'stripe', publishableKey, testMode: enabled && !publishableKey.startsWith('pk_live_') });
}
