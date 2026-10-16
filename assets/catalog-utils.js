import { hasFreshInventory } from './inventory.js';
export const money = cents => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
export const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
export function filterProducts(products, query, category) {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  return products.filter(p => (category === 'Todos' || p.category === category) && terms.every(term => normalize([p.name, p.brand, p.category, p.description, p.tag, p.size, p.compatibility].join(' ')).includes(term)));
}
export function restoreCart(raw, products) {
  let parsed;
  try { parsed = JSON.parse(raw || '{}'); } catch { return {}; }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
  return Object.fromEntries(Object.entries(parsed).filter(([id, qty]) => products.some(p => p.id === id) && Number.isSafeInteger(qty) && qty > 0 && qty <= 10));
}
export function summarizeCart(cart, products) {
  const entries = Object.entries(restoreCart(JSON.stringify(cart), products)).map(([id, quantity]) => ({ product: products.find(p => p.id === id), quantity }));
  const priced = entries.every(({ product: p }) => Number.isSafeInteger(p.priceCents) && p.priceCents > 0 && p.availability === 'available' && p.supplierApproved === true);
  return { entries, count: entries.reduce((sum, i) => sum + i.quantity, 0), subtotalCents: priced ? entries.reduce((sum, i) => sum + i.quantity * i.product.priceCents, 0) : null, purchasable: entries.length > 0 && priced && entries.every(({ product: p, quantity }) => hasFreshInventory(p, quantity)) };
}
