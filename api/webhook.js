export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // Mercado Pago sends the event notification here.
  // The frontend verifies the authoritative payment status through /api/payment-status.
  return res.status(200).json({ received: true });
}
