import { readiness } from '../lib/store.js';
export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido.' });
  return res.status(200).json({ checkoutEnabled: readiness(), currency: 'BRL', paymentMethod: 'pix' });
}
