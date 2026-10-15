import { money, filterProducts, restoreCart, summarizeCart } from './catalog-utils.js';

const $ = id => document.getElementById(id);
const safe = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
let products = [], cart = {}, activeCategory = 'Todos', checkoutEnabled = false, shippingQuote = null, attempt = null, paymentToken = null, toastTimer, stripeController = null, stripeScriptPromise = null;
const STORAGE = 'davora-brasil-selection-v1';
const api = async (name, body) => {
  const response = await fetch(new URL('api/' + name, document.baseURI), body === undefined ? { cache: 'no-store' } : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Não foi possível concluir. Tente novamente.');
  return data;
};
function showToast(text) {
  $('toast').textContent = text; $('toast').classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('show'), 2800);
}
function modal(id) { if (!$(id).open) $(id).showModal(); }
function renderProducts() {
  const list = filterProducts(products, $('searchInput').value, activeCategory);
  $('productGrid').innerHTML = list.map(p => `
    <article class="card">
      <button class="img-wrap image-button" data-detail="${safe(p.id)}" aria-label="Ver detalhes de ${safe(p.name)}"><img src="${safe(p.image)}" alt="${safe(p.name)} — ${safe(p.brand)}" loading="lazy" decoding="async" referrerpolicy="no-referrer"><span class="badge">${safe(p.brand)}</span></button>
      <div class="card-body"><span class="cat-label">${safe(p.category)}</span><h3>${safe(p.name)}</h3><div class="micro">${safe(p.size)}</div><div class="${p.priceCents ? 'price' : 'pending-price'}">${p.priceCents ? money(p.priceCents) : 'Preço em confirmação'}</div><div class="availability">${p.availability === 'available' ? 'Confira frete e disponibilidade no pedido' : 'Em breve · venda ainda não liberada'}</div><div class="card-actions"><button class="buy" data-detail="${safe(p.id)}">Ver detalhes</button><button class="add" data-add="${safe(p.id)}" aria-label="Adicionar ${safe(p.name)} à seleção">+</button></div></div>
    </article>`).join('');
  $('productGrid').setAttribute('aria-busy', 'false');
  $('resultCount').textContent = list.length + (list.length === 1 ? ' produto' : ' produtos');
  $('emptyState').style.display = list.length ? 'none' : 'block';
}
function showDetail(id) {
  const p = products.find(p => p.id === id); if (!p) return;
  $('productDetail').innerHTML = `<div class="detail-image"><img src="${safe(p.image)}" alt="${safe(p.name)}" referrerpolicy="no-referrer"></div><div class="detail-copy"><span class="cat-label">${safe(p.brand)}</span><h2 id="detailTitle">${safe(p.name)}</h2><p>${safe(p.description)}</p><p class="detail-size">${safe(p.size)}</p><strong class="${p.priceCents ? 'price' : 'pending-price'}">${p.priceCents ? money(p.priceCents) : 'Preço em confirmação'}</strong><p class="availability">${p.availability === 'available' ? 'Consulte o frete antes de pagar.' : 'A compra deste produto ainda não foi liberada.'}</p><button class="primary" data-add="${safe(p.id)}">Adicionar à seleção</button><small>Confira sempre o rótulo, a composição e as orientações de uso do fabricante.</small></div>`;
  modal('productDialog');
}
function invalidateQuote() { shippingQuote = null; attempt = null; $('payButton').disabled = true; $('quoteSummary').textContent = 'Calcule o frete para conferir o total antes do pagamento.'; }
function persist() {
  try { localStorage.setItem(STORAGE, JSON.stringify(cart)); } catch { /* Selection works without persistent storage. */ }
  invalidateQuote(); renderCart();
}
function add(id) {
  if (!products.some(p => p.id === id)) return;
  if ((cart[id] || 0) >= 10) return showToast('Limite de 10 unidades por produto.');
  cart[id] = (cart[id] || 0) + 1; persist(); showToast('Produto adicionado à sua seleção.');
}
function renderCart() {
  const { entries, count, subtotalCents, purchasable } = summarizeCart(cart, products);
  $('cartCount').textContent = count;
  $('openCart').setAttribute('aria-label', `Abrir sua seleção, ${count} ${count === 1 ? 'item' : 'itens'}`);
  $('cartTotal').textContent = count ? (subtotalCents === null ? 'A confirmar' : money(subtotalCents)) : money(0);
  $('checkoutBtn').disabled = !checkoutEnabled || !purchasable;
  $('checkoutBtn').textContent = checkoutEnabled ? 'Continuar para pagamento' : 'Pagamento ainda indisponível';
  $('cartNote').textContent = checkoutEnabled ? 'O frete e o total serão conferidos antes de gerar o pagamento.' : 'Compras ainda indisponíveis. Nenhum pagamento é recebido nesta etapa.';
  $('clearCart').disabled = !count;
  $('cartItems').innerHTML = entries.length ? entries.map(({ product: p, quantity }) => `<div class="cart-item"><img src="${safe(p.image)}" alt="${safe(p.name)}" referrerpolicy="no-referrer"><div><h3>${safe(p.name)}</h3><small>${p.priceCents ? money(p.priceCents) : 'Preço em confirmação'}</small><div class="qty"><button data-quantity="${safe(p.id)}" data-delta="-1" aria-label="Diminuir quantidade de ${safe(p.name)}">−</button><span>${quantity}</span><button data-quantity="${safe(p.id)}" data-delta="1" aria-label="Aumentar quantidade de ${safe(p.name)}" ${quantity >= 10 ? 'disabled' : ''}>+</button></div></div><button class="remove" data-remove="${safe(p.id)}" aria-label="Remover ${safe(p.name)}">Remover</button></div>`).join('') : '<div class="cart-empty"><h3>Sua seleção está vazia.</h3><p>Explore os produtos e escolha seus favoritos.</p><button class="primary" data-close="cartDialog">Explorar produtos</button></div>';
}
document.addEventListener('click', event => {
  const button = event.target.closest('button'); if (!button || button.disabled) return;
  if (button.dataset.close) $(button.dataset.close).close();
  if (button.dataset.detail) showDetail(button.dataset.detail);
  if (button.dataset.add) add(button.dataset.add);
  if (button.dataset.remove) { delete cart[button.dataset.remove]; persist(); }
  if (button.dataset.quantity) { const id = button.dataset.quantity; if (!cart[id]) return; cart[id] = Math.min(10, cart[id] + Number(button.dataset.delta)); if (cart[id] <= 0) delete cart[id]; persist(); }
  if (button.dataset.category) { activeCategory = button.dataset.category; document.querySelectorAll('[data-category]').forEach(b => { b.classList.toggle('active', b === button); b.setAttribute('aria-pressed', String(b === button)); }); renderProducts(); }
  if (button.dataset.info) showInfo(button.dataset.info);
});
document.addEventListener('error', event => { if (event.target.tagName === 'IMG') { event.target.classList.add('image-unavailable'); event.target.alt = 'Foto temporariamente indisponível'; } }, true);
$('searchForm').addEventListener('submit', e => { e.preventDefault(); renderProducts(); $('produtos').scrollIntoView(); });
$('searchInput').addEventListener('input', renderProducts);
$('resetFilters').addEventListener('click', () => { $('searchInput').value = ''; document.querySelector('[data-category="Todos"]').click(); });
$('openCart').addEventListener('click', () => modal('cartDialog'));
$('clearCart').addEventListener('click', () => { cart = {}; persist(); });
$('checkoutBtn').addEventListener('click', () => {
  if (!checkoutEnabled || !summarizeCart(cart, products).purchasable) return;
  $('cartDialog').close(); $('checkoutForm').hidden = false; $('stripePanel').hidden = true; if (stripeController) { stripeController.destroy(); stripeController = null; } invalidateQuote(); modal('checkoutDialog');
});
$('checkoutForm').elements.cep.addEventListener('input', invalidateQuote);
for (const key of ['cpf', 'phone', 'cep']) $('checkoutForm').elements[key].addEventListener('input', event => { event.target.value = event.target.value.replace(/\D/g, ''); });
$('checkoutForm').elements.state.addEventListener('input', event => { event.target.value = event.target.value.toUpperCase().replace(/[^A-Z]/g, ''); });
$('quoteShipping').addEventListener('click', async () => {
  const cep = $('checkoutForm').elements.cep.value;
  if (!/^\d{8}$/.test(cep)) { $('checkoutMessage').textContent = 'Informe um CEP com 8 números.'; return; }
  $('quoteShipping').disabled = true; $('checkoutMessage').textContent = 'Conferindo o frete…'; invalidateQuote();
  try {
    shippingQuote = await api('shipping-quote', { items: Object.entries(cart).map(([id, quantity]) => ({ id, quantity })), cep }); attempt = crypto.randomUUID();
    $('quoteSummary').textContent = `Produtos: ${money(shippingQuote.subtotalCents)} · Frete: ${money(shippingQuote.shippingCents)} · Total: ${money(shippingQuote.totalCents)} · Prazo: até ${shippingQuote.deliveryDays} dias úteis após confirmação.`;
    $('payButton').textContent = 'Continuar: ' + money(shippingQuote.totalCents); $('payButton').disabled = false; $('checkoutMessage').textContent = '';
  } catch (error) { $('checkoutMessage').textContent = error.message; }
  finally { $('quoteShipping').disabled = false; }
});
async function loadStripeScript() {
  if (window.Stripe) return;
  if (!stripeScriptPromise) stripeScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://js.stripe.com/endive/stripe.js'; script.async = true;
    const timeout = setTimeout(() => { script.remove(); stripeScriptPromise = null; reject(new Error('O formulário não carregou. Tente novamente.')); }, 20000);
    script.onload = () => { clearTimeout(timeout); resolve(); };
    script.onerror = () => { clearTimeout(timeout); script.remove(); stripeScriptPromise = null; reject(new Error('Não foi possível carregar o pagamento.')); };
    document.head.appendChild(script);
  });
  return stripeScriptPromise;
}
$('checkoutForm').addEventListener('submit', async event => {
  event.preventDefault(); if (!shippingQuote || !attempt || !checkoutEnabled) return;
  if (shippingQuote.expiresAt <= Date.now()) { invalidateQuote(); $('checkoutMessage').textContent = 'Recalcule o frete antes de continuar.'; return; }
  if (!$('checkoutForm').reportValidity()) return;
  $('payButton').disabled = true; $('checkoutMessage').textContent = 'Preparando o pagamento…';
  try {
    await loadStripeScript();
    const buyer = Object.fromEntries(new FormData($('checkoutForm'))); delete buyer.consent;
    const payment = await api('create-store-payment', { quoteToken: shippingQuote.token, buyer, attempt }); paymentToken = payment.token;
    const stripe = window.Stripe(payment.publishableKey, { locale: 'pt-BR' });
    if (stripeController) stripeController.destroy();
    stripeController = await stripe.createEmbeddedCheckoutPage({ fetchClientSecret: async () => payment.clientSecret });
    $('paymentReference').textContent = 'Pedido ' + payment.reference;
    $('stripePanel').hidden = false; stripeController.mount('#stripeCheckout');
    $('checkoutForm').reset(); $('checkoutForm').hidden = true;
    $('paymentMessage').textContent = 'Conclua o pagamento no formulário. Depois, confira a confirmação do pedido.';
  } catch (error) { $('checkoutMessage').textContent = error.message; $('payButton').disabled = false; }
});
$('checkPayment').addEventListener('click', async () => {
  if (!paymentToken) return; $('checkPayment').disabled = true;
  try {
    const payment = await api('store-payment-status', { token: paymentToken });
    const messages = { approved: 'Pagamento confirmado. Seu pedido foi recebido para processamento.', pending: 'O pagamento ainda não foi confirmado. Confira novamente em instantes.', cancelled: 'Sessão de pagamento expirada. Entre em contato com a DAVORA se já pagou.' };
    $('paymentMessage').textContent = messages[payment.status] || 'O pagamento ainda não foi confirmado.';
    if (payment.status === 'approved') { cart = {}; persist(); if (stripeController) { stripeController.destroy(); stripeController = null; } }
  } catch (error) { $('paymentMessage').textContent = error.message; }
  finally { $('checkPayment').disabled = false; }
});
function showInfo(kind) {
  $('infoTitle').textContent = kind === 'privacy' ? 'Privacidade' : 'Entrega e disponibilidade';
  $('infoContent').innerHTML = kind === 'privacy' ? '<p>Sua seleção de produtos é guardada apenas neste navegador para facilitar sua próxima visita. Você pode apagá-la pelo botão “Limpar seleção” ou pelas configurações do navegador.</p><p>Na etapa atual, as compras não estão disponíveis e nenhum dado de pagamento é solicitado. Quando as vendas forem liberadas, os dados de contato e entrega informados no pedido serão compartilhados com o processador de pagamento e com o responsável pelo envio, para atender à compra.</p><p>As fotos são carregadas do catálogo público do fornecedor, cujo servidor recebe os dados técnicos necessários ao carregamento. Ao abrir o WhatsApp, você acessa um serviço externo com suas próprias condições de privacidade.</p><p>Para solicitar atendimento sobre seus dados, fale com a DAVORA pelo WhatsApp indicado no rodapé.</p>' : '<p>Estamos preparando o catálogo para vendas no Brasil. Preços, disponibilidade, frete e prazos ainda dependem de confirmação. Nenhum pagamento é recebido nesta etapa.</p><p>Antes da abertura das vendas, publicaremos as condições de entrega, troca e devolução aplicáveis aos produtos.</p>';
  modal('infoDialog');
}
async function init() {
  $('year').textContent = new Date().getFullYear();
  try {
    const response = await fetch('data/catalog.json', { cache: 'no-store' }); if (!response.ok) throw new Error();
    const data = await response.json(); products = data.products;
    try { cart = restoreCart(localStorage.getItem(STORAGE), products); } catch { cart = {}; }
    renderProducts(); renderCart();
    $('heroBack').src = products.find(p => p.id === 'bitarra-7908496403905').image; $('heroFront').src = products.find(p => p.id === 'vitamedica-3146').image;
    const config = await api('store-config').catch(() => ({ checkoutEnabled: false })); checkoutEnabled = config.checkoutEnabled === true;
    if (checkoutEnabled) { $('storeNotice').textContent = config.testMode ? 'AMBIENTE DE TESTE · Pagamentos de teste, sem venda real' : 'DAVORA Store · Beleza e autocuidado para o Brasil'; $('purchaseInfo').textContent = 'Escolha os produtos disponíveis, confira o frete e faça o pagamento pela Stripe na DAVORA. Consulte o total e o prazo antes de pagar.'; $('footerStatus').textContent = 'Valores em reais. Frete calculado antes do pagamento.'; }
    renderCart();
  } catch { $('productGrid').setAttribute('aria-busy', 'false'); $('productGrid').innerHTML = '<div class="catalog-error"><h3>O catálogo não carregou.</h3><p>Recarregue a página ou fale com a DAVORA pelo WhatsApp.</p></div>'; }
}
init();
