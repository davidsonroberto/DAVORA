export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) return res.status(500).json({ error: "MP_ACCESS_TOKEN not configured" });

  try {
    const response = await fetch("https://api.mercadopago.com/v1/payment_methods", {
      headers: { "Authorization": "Bearer " + token }
    });
    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        ok: false,
        error: data.message || "Mercado Pago error"
      });
    }

    const pix = Array.isArray(data)
      ? data.find(method => method.id === "pix" || method.payment_type_id === "bank_transfer")
      : null;

    return res.status(200).json({
      ok: true,
      pix: pix ? {
        id: pix.id,
        name: pix.name,
        payment_type_id: pix.payment_type_id,
        status: pix.status
      } : null
    });
  } catch {
    return res.status(500).json({ ok: false, error: "Could not check payment methods" });
  }
}