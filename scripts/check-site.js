import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { calculatePricingDraft } from '../lib/pricing-draft.js';
const html = readFileSync('index.html', 'utf8');
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
assert.equal(ids.length, new Set(ids).size, 'IDs HTML duplicados');
for (const path of ['assets/store.css', 'assets/store.js', 'assets/catalog-utils.js', 'assets/inventory.js', 'data/catalog.json']) assert.ok(existsSync(path), path);
const js = readFileSync('assets/store.js', 'utf8');
for (const match of js.matchAll(/\$\('([^']+)'\)/g)) assert.ok(ids.includes(match[1]), 'Elemento ausente: ' + match[1]);
const data = JSON.parse(readFileSync('data/catalog.json'));
const evidence = existsSync('data/zendrop-verification.json') ? JSON.parse(readFileSync('data/zendrop-verification.json')) : null;
if (evidence) { assert.equal(evidence.destinationCountry, 'BR'); assert.equal(evidence.products.length, data.expectedProductCount); }
assert.equal(data.currency, 'BRL'); assert.equal(data.products.length, new Set(data.products.map(p => p.id)).size);
assert.equal(data.products.length, data.expectedProductCount, 'Quantidade de produtos diferente da seleção');
for (const category of new Set(data.products.map(p => p.category))) assert.ok(html.includes(`data-category="${category}"`), 'Categoria ausente: ' + category);
for (const id of data.featuredProducts || []) assert.ok(data.products.some(p => p.id === id), 'Destaque ausente: ' + id);
for (const p of data.products) {
  const source = new URL(p.sourceUrl), sourceImage = new URL(p.sourceImageUrl);
  assert.equal(p.supplierPlatform, 'zendrop');
  assert.equal(source.origin, 'https://app.zendrop.com');
  assert.equal(source.pathname, '/product/' + p.supplierProductId);
  assert.match(p.supplierProductId, /^\d+$/);
  assert.equal(p.id, 'zendrop-' + p.supplierProductId);
  assert.equal(sourceImage.origin, 'https://file.zendrop.com');
  assert.ok(sourceImage.pathname.startsWith('/products/'));
  assert.match(p.image, new RegExp('^assets/products/' + p.id + '\\.(jpg|png|webp)$'));
  assert.ok(existsSync(p.image), 'Foto local ausente: ' + p.image);
  assert.equal(createHash('sha256').update(readFileSync(p.image)).digest('hex'), p.imageSha256, 'Foto alterada: ' + p.id);
  assert.equal(p.supplierCost.currency, 'USD');
  assert.ok(Number.isSafeInteger(p.supplierCost.fromCents) && p.supplierCost.fromCents > 0);
  assert.equal(p.supplierCost.scope, 'catalog_product_only');
  assert.ok(Number.isSafeInteger(p.supplierVariantId) && p.supplierVariantId > 0);
  assert.ok(typeof p.supplierSku === 'string' && p.supplierSku.length > 0);
  assert.ok(Number.isSafeInteger(p.supplierCost.variantCents) && p.supplierCost.variantCents > 0);
  if (!p.supplierInventory.tracked) { assert.equal(p.stock, null); assert.equal(p.supplierInventory.available, null); assert.equal(p.inventoryMode, 'supplier_availability'); }
  assert.equal(p.shippingEstimate.currency, 'USD');
  assert.equal(p.shippingEstimate.country, 'BR');
  assert.equal(p.shippingEstimate.variantConfirmed, false, 'Estimativa por produto não confirma a variante');
  for (const option of p.shippingEstimate.options) { assert.ok(Number.isSafeInteger(option.priceCents) && option.priceCents > 0); assert.ok(typeof option.estimatedDeliveryText === 'string'); }
  if (data.pricingPolicy?.status === 'draft') {
    const option = p.shippingEstimate.options.find(o => o.type === p.pricingDraft?.shippingType);
    assert.ok(option, 'Previsão sem frete de origem: ' + p.id);
    assert.deepEqual(p.pricingDraft, { ...calculatePricingDraft(p.supplierCost.variantCents, option.priceCents, data.pricingPolicy), shippingType: option.type, estimatedDeliveryText: option.estimatedDeliveryText });
    assert.equal(p.priceCents, null, 'Previsão não pode virar preço de cobrança');
    assert.equal(p.supplierApproved, false);
    assert.equal(p.availability, 'pending_launch');
  }
  if (evidence) {
    const original = evidence.products.find(source => String(source.id) === p.supplierProductId);
    assert.ok(original?.variantsComplete, 'Consulta parcial de variantes: ' + p.id);
    assert.equal(original.variants.length, original.variantsTotal);
    assert.equal(new Set(original.variants.map(v => v.variantId)).size, original.variantsTotal, 'Variantes duplicadas: ' + p.id);
    const variant = original.variants.find(v => v.variantId === p.supplierVariantId);
    assert.ok(variant?.sku, 'Variante selecionada ausente na consulta: ' + p.id);
    assert.equal(p.supplierSku, variant.sku);
    assert.equal(p.supplierCost.variantCents, Math.round(Number(variant.priceUSD) * 100));
    assert.equal(p.supplierInventory.available, variant.available);
    assert.equal(p.supplierInventory.inventoryLevel, variant.inventoryLevel);
    assert.equal(p.supplierInventory.tracked, variant.tracked);
    assert.deepEqual(p.shippingEstimate.options, original.shippingEstimate.shipping_options.map(o => ({ type: o.type, priceCents: Math.round(o.price * 100), estimatedDeliveryText: o.estimated_delivery })));
  }
  if (p.availability === 'available') assert.ok(p.supplierSku, 'SKU da variante não confirmado');
}
const csp = JSON.parse(readFileSync('vercel.json')).headers.flatMap(h => h.headers).find(h => h.key === 'Content-Security-Policy').value;
assert.ok(csp.includes("img-src 'self' data:"), 'CSP deve permitir as fotos da própria loja');
for (const dir of ['assets', 'api', 'lib', 'scripts', 'test']) for (const file of readdirSync(dir).filter(n => n.endsWith('.js'))) {
  const r = spawnSync(process.execPath, ['--check', dir + '/' + file], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
}
const trackingHtml = readFileSync('acompanhar.html', 'utf8');
const trackingIds = [...trackingHtml.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
assert.equal(trackingIds.length, new Set(trackingIds).size, 'IDs duplicados no acompanhamento');
for (const path of ['assets/tracking.css', 'assets/tracking.js']) assert.ok(existsSync(path), path);
for (const match of readFileSync('assets/tracking.js', 'utf8').matchAll(/\$\('([^']+)'\)/g)) assert.ok(trackingIds.includes(match[1]), 'Elemento de acompanhamento ausente: ' + match[1]);
assert.ok(trackingHtml.includes('noindex,nofollow'));
assert.ok(trackingHtml.includes('no-referrer'));
console.log('HTML, acompanhamento privado, catálogo BRL e sintaxe JavaScript verificados.');
