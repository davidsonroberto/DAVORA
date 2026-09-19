export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const requestOrigin = req.headers.origin || "";
  if (requestOrigin === "https://davidsonroberto.github.io") {
    res.setHeader("Access-Control-Allow-Origin", requestOrigin);
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }

  const token = process.env.MP_ACCESS_TOKEN;
  const ref = req.query?.ref;
  if (!token || !ref) return res.status(400).json({ error: "Missing configuration or reference" });

  try {
    const response = await fetch(
      "https://api.mercadopago.com/v1/payments/search?external_reference=" + encodeURIComponent(ref) + "&sort=date_created&criteria=desc",
      { headers: { "Authorization": "Bearer " + token } }
    );
    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: data.message || "Mercado Pago error" });

    const payment = data.results?.[0];
    return res.status(200).json({
      status: payment?.status || "pending",
      payment_id: payment?.id || null
    });
  } catch {
    return res.status(500).json({ error: "Could not check payment" });
  }
}
