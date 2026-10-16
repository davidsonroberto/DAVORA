"""Build a standalone, non-transactional preview. No credentials or buyer data."""
import base64
import concurrent.futures
import json
import sys
import urllib.request
from pathlib import Path

root = Path(__file__).resolve().parent.parent
data = json.loads((root / 'data/catalog.json').read_text())

def embed(product):
    with urllib.request.urlopen(product['image'], timeout=25) as response:
        mime = response.headers.get_content_type()
        image = response.read(5 * 1024 * 1024)
    if mime not in ('image/png', 'image/jpeg', 'image/webp'):
        raise ValueError('Unsupported product image')
    return {**product, 'image': 'data:' + mime + ';base64,' + base64.b64encode(image).decode()}

with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    data['products'] = list(pool.map(embed, data['products']))

utils = (root / 'assets/catalog-utils.js').read_text().replace('export ', '')
recovery = (root / 'assets/payment-recovery.js').read_text().replace('export ', '').replace("const STORAGE = 'davora-payment-session-v1';", "const PAYMENT_STORAGE = 'davora-payment-session-v1';").replace('storage.setItem(STORAGE', 'storage.setItem(PAYMENT_STORAGE').replace('storage.getItem(STORAGE', 'storage.getItem(PAYMENT_STORAGE').replace('storage.removeItem(STORAGE', 'storage.removeItem(PAYMENT_STORAGE')
app = (root / 'assets/store.js').read_text()
app = app.replace("import { money, filterProducts, restoreCart, summarizeCart } from './catalog-utils.js';", '')
app = app.replace("import { validPaymentRecord, savePaymentRecord, restorePaymentRecord, clearPaymentRecord } from './payment-recovery.js';", '')
app = app.replace("const response = await fetch('data/catalog.json', { cache: 'no-store' }); if (!response.ok) throw new Error();", 'const response = { ok: true, json: async () => DAVORA_PREVIEW_CATALOG };')
app = app.replace("const config = await api('store-config').catch(() => ({ checkoutEnabled: false }));", 'const config = { checkoutEnabled: false };')
code = 'const DAVORA_PREVIEW_CATALOG = ' + json.dumps(data, ensure_ascii=False) + ';\n' + utils + '\n' + recovery + '\n' + app
assert 'fetch(\'data/catalog.json\'' not in code
html = (root / 'index.html').read_text()
html = html.replace('<link rel="stylesheet" href="assets/store.css">', '<style>' + (root / 'assets/store.css').read_text() + '</style>')
html = html.replace('<script type="module" src="assets/store.js"></script>', '<script type="module">' + code.replace('</script', '<\\/script') + '</script>')
destination = Path(sys.argv[1]).resolve()
destination.write_text(html)
print(json.dumps({'file': str(destination), 'bytes': destination.stat().st_size, 'products': len(data['products']), 'checkoutEnabled': False}))
