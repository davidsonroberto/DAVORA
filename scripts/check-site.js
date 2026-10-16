import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
const html = readFileSync('index.html', 'utf8');
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
assert.equal(ids.length, new Set(ids).size, 'IDs HTML duplicados');
for (const path of ['assets/store.css', 'assets/store.js', 'assets/catalog-utils.js', 'data/catalog.json']) assert.ok(existsSync(path), path);
const js = readFileSync('assets/store.js', 'utf8');
for (const match of js.matchAll(/\$\('([^']+)'\)/g)) assert.ok(ids.includes(match[1]), 'Elemento ausente: ' + match[1]);
const data = JSON.parse(readFileSync('data/catalog.json'));
assert.equal(data.currency, 'BRL'); assert.equal(data.products.length, new Set(data.products.map(p => p.id)).size);
for (const category of new Set(data.products.map(p => p.category))) assert.ok(html.includes(`data-category="${category}"`), 'Categoria ausente: ' + category);
for (const id of data.featuredProducts || []) assert.ok(data.products.some(p => p.id === id), 'Destaque ausente: ' + id);
for (const p of data.products) { assert.equal(new URL(p.image).protocol, 'https:'); assert.equal(new URL(p.sourceUrl).hostname, 'app.dropi.com.br'); assert.ok(p.supplierSku); }
for (const dir of ['assets', 'api', 'lib', 'scripts', 'test']) for (const file of readdirSync(dir).filter(n => n.endsWith('.js'))) {
  const r = spawnSync(process.execPath, ['--check', dir + '/' + file], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
}
console.log('HTML, referências, catálogo BRL e sintaxe JavaScript verificados.');
