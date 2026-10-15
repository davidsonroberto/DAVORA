// Endpoint do checkout anterior, sem uso na integração Stripe da DAVORA.
export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(410).json({ error: 'Endpoint antigo desativado' });
}
