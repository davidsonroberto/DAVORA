import { readiness } from '../lib/store.js';
export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido.' });
  const enabled = readiness();
  return res.status(200).json({ checkoutEnabled: enabled, currency: 'BRL', provider: 'stripe', publishableKey: enabled ? process.env.STRIPE_PUBLISHABLE_KEY : null, testMode: enabled && !process.env.STRIPE_PUBLISHABLE_KEY.startsWith('pk_live_') });
}
