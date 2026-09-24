// O checkout de currículos foi encerrado quando a DAVORA passou a ser uma loja de produtos.
// Não crie pagamentos até haver produtos, preços, frete e fornecedor confirmados.
export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(410).json({ error: 'Checkout antigo desativado' });
}
