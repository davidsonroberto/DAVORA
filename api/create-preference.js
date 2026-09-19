export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) return res.status(500).json({ error: "MP_ACCESS_TOKEN not configured" });

  try {
    const host = req.headers["x-forwarded-host"] || req.headers.host;
    const proto = req.headers["x-forwarded-proto"] || "https";
    const origin = proto + "://" + host;
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

        // Pix is a bank-transfer payment in Brazil.
        // Do not set Pix as default_payment_method_id: Checkout Pro rejects that value.
        // Remove other payment types so the checkout can offer Pix when enabled
        // for the Mercado Pago account behind MP_ACCESS_TOKEN.
        payment_methods: {
          excluded_payment_types: [
            { id: "credit_card" },
            { id: "debit_card" },
            { id: "prepaid_card" },
            { id: "ticket" }
          ]
        },

        back_urls: {
          success: origin + "/?payment=success&ref=" + encodeURIComponent(externalReference),
          pending: origin + "/?payment=pending&ref=" + encodeURIComponent(externalReference),
          failure: origin + "/?payment=failure&ref=" + encodeURIComponent(externalReference)
        },
        auto_return: "approved",
        notification_url: origin + "/api/webhook"
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data.message || "Mercado Pago error"
      });
    }

    return res.status(200).json({
      checkout_url: data.init_point,
      external_reference: externalReference
    });
  } catch (error) {
    return res.status(500).json({ error: "Could not create payment" });
  }
}