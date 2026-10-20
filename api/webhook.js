export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  // Do not acknowledge events without signature verification and durable
  // processing. A Stripe order webhook must be implemented before launch.
  return res.status(410).json({ error: "Este endpoint antigo está desativado." });
}
