export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  // Do not acknowledge events without signature verification and durable
  // processing. A Stripe order webhook must be implemented before launch.
  return res.status(410).json({ error: "Este endpoint antigo está desativado." });
}
