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

    const methods = Array.isArray(data) ? data : [];

    return res.status(200).json({
      ok: true,
      total: methods.length,
      methods: methods.map(method => ({
        id: method.id,
        name: method.name,
        payment_type_id: method.payment_type_id,
        status: method.status
      }))
    });
  } catch {
    return res.status(500).json({ ok: false, error: "Could not check payment methods" });
  }
}