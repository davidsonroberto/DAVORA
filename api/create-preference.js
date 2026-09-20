export default async function handler(req, res) {
  const allowedOrigins = new Set([
    "https://davidsonroberto.github.io",
    "https://davora-gules.vercel.app"
  ]);
  const requestOrigin = req.headers.origin || "";
  if (allowedOrigins.has(requestOrigin)) {
    res.setHeader("Access-Control-Allow-Origin", requestOrigin);
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Vary", "Origin");
  }

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) return res.status(500).json({ error: "MP_ACCESS_TOKEN not configured" });

  try {
    const returnTo = typeof req.body?.return_to === "string" ? req.body.return_to : "";
    const origin = returnTo.startsWith("https://davidsonroberto.github.io/DAVORA")
      ? returnTo.replace(/\/+$/, "")
      : "https://davora-gules.vercel.app";

    const externalReference = "DAVORA-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);

    const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token
      },
      body: JSON.stringify({
        items: [{
          id: "davora-curriculo",
          title: "Currículo profissional Davora",
          quantity: 1,
          currency_id: "BRL",
          unit_price: 9.90
        }],
        external_reference: externalReference,

        // Mantém o checkout do Mercado Pago com os meios de pagamento
        // disponíveis para o comprador, incluindo Pix quando habilitado
        // na conta Mercado Pago.
        payment_methods: {
          installments: 1,
          default_installments: 1
        },

        back_urls: {
          success: origin + "/?payment=success&ref=" + encodeURIComponent(externalReference),
          pending: origin + "/?payment=pending&ref=" + encodeURIComponent(externalReference),
          failure: origin + "/?payment=failure&ref=" + encodeURIComponent(externalReference)
        },
        auto_return: "approved",
        notification_url: "https://davora-gules.vercel.app/api/webhook"
      })
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: data.message || "Mercado Pago error" });
    }

    return res.status(200).json({
      checkout_url: data.init_point,
      external_reference: externalReference
    });
  } catch (e) {
    return res.status(500).json({ error: "Could not create payment" });
  }
}