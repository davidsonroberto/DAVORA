import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { get, put, BlobPreconditionFailedError, BlobNotFoundError } from '@vercel/blob';
import { StoreError, products, paymentMatches, isPurchasable } from './store.js';
import { ordersConfigured } from './order-config.js';
export { ordersConfigured } from './order-config.js';

const LIMIT_BYTES = 3 * 1024 * 1024;
const REFERENCE = /^DAVORA-[a-f0-9-]{36}$/;
const empty = () => ({ version: 1, orders: {} });
export class OrderConflict extends Error {}

function encryptionKey(env) {
  if (!/^[a-f0-9]{64}$/.test(env.DAVORA_ORDER_ENCRYPTION_KEY || '')) throw new StoreError('O registro de pedidos não está configurado.', 503);
  return Buffer.from(env.DAVORA_ORDER_ENCRYPTION_KEY, 'hex');
}

function encryptBuyer(buyer, reference, env) {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', encryptionKey(env), iv);
  cipher.setAAD(Buffer.from(reference));
  const data = Buffer.concat([cipher.update(JSON.stringify(buyer)), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map(b => b.toString('base64url')).join('.');
}

export function decryptOrderBuyer(record, env = process.env) {
  const [iv, tag, data] = record.buyerEncrypted.split('.').map(s => Buffer.from(s, 'base64url'));
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(env), iv);
  decipher.setAAD(Buffer.from(record.reference)); decipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([decipher.update(data), decipher.final()]).toString());
}

export function blobLedgerAdapter(env = process.env) {
  const mode = /^(sk|rk)_live_/.test(env.STRIPE_SECRET_KEY || '') ? 'live' : 'test';
  const path = `${env.DAVORA_ORDER_NAMESPACE}/${mode}/ledger-v1.json`;
  const auth = env.BLOB_READ_WRITE_TOKEN ? { token: env.BLOB_READ_WRITE_TOKEN } : { storeId: env.BLOB_STORE_ID };
  return {
    async read() {
      let response;
      try { response = await get(path, { access: 'private', useCache: false, ...auth }); }
      catch (error) { if (error instanceof BlobNotFoundError) return null; throw error; }
      if (!response) return null;
      if (response.statusCode !== 200 || response.blob.size > LIMIT_BYTES) throw new StoreError('O registro de pedidos precisa de manutenção.', 503);
      return { data: JSON.parse(await new Response(response.stream).text()), etag: response.blob.etag };
    },
    async write(data, etag) {
      try {
        return await put(path, JSON.stringify(data), { access: 'private', contentType: 'application/json', addRandomSuffix: false,
          allowOverwrite: Boolean(etag), ...(etag ? { ifMatch: etag } : {}), ...auth });
      } catch (error) {
        if (error instanceof BlobPreconditionFailedError || (!etag && /already exists|already_exist/i.test(error.message || ''))) throw new OrderConflict();
        throw error;
      }
    }
  };
}

// A small-store ledger: order and inventory changes share one conditional
// write. On conflict, read the latest version and repeat the whole operation.
export function createOrderStore(adapter, env = process.env, catalog = products) {
  async function transaction(change) {
    for (let attempt = 0; attempt < 8; attempt++) {
      const snapshot = await adapter.read();
      const data = snapshot ? structuredClone(snapshot.data) : empty();
      if (data.version !== 1 || !data.orders || Array.isArray(data.orders) || typeof data.orders !== 'object') throw new StoreError('O registro de pedidos precisa de manutenção.', 503);
      const result = change(data);
      if (!result.changed) return structuredClone(result.value);
      if (Buffer.byteLength(JSON.stringify(data)) > LIMIT_BYTES) throw new StoreError('O registro de pedidos precisa de manutenção.', 503);
      try { await adapter.write(data, snapshot?.etag); return structuredClone(result.value); }
      catch (error) { if (!(error instanceof OrderConflict)) throw error; }
    }
    throw new StoreError('O estoque está sendo atualizado. Tente novamente.', 409);
  }

  function checkStock(data, items) {
    for (const item of items) {
      const product = catalog.find(p => p.id === item.id);
      if (!product || !isPurchasable(product)) throw new StoreError('Um produto não está disponível.', 409);
      // Supplier availability has no unit count to reserve. Preserve null;
      // the ledger still records the order, never a supplier stock reservation.
      if (product.inventoryMode === 'supplier_availability') continue;
      const held = Object.values(data.orders).filter(o => ['reserved', 'open', 'processing', 'paid', 'dispatched'].includes(o.status) &&
        !(o.status === 'dispatched' && Date.parse(product.stockConfirmedAt) > o.dispatchedAt))
        .reduce((sum, o) => sum + (o.items.find(i => i.id === item.id)?.quantity || 0), 0);
      if (held + item.quantity > product.stock) throw new StoreError('O estoque deste produto acabou de mudar. Revise sua seleção.', 409);
    }
  }

  return {
    async health() { const snapshot = await adapter.read(); return { storageReachable: true, initialized: Boolean(snapshot) }; },
    async reserve(quote, buyer, reference, fingerprint) {
      if (!REFERENCE.test(reference)) throw new StoreError('Pedido inválido.');
      const buyerEncrypted = encryptBuyer(buyer, reference, env);
      return transaction(data => {
        const existing = data.orders[reference];
        if (existing) {
          if (existing.fingerprint !== fingerprint || existing.totalCents !== quote.totalCents) throw new StoreError('Este pedido mudou. Recomece a confirmação.', 409);
          if (!['reserved', 'open'].includes(existing.status)) throw new StoreError('Este pedido já foi processado. Confira o pagamento.', 409);
          return { changed: false, value: existing };
        }
        if (Object.keys(data.orders).length >= 1000) throw new StoreError('O registro de pedidos precisa de manutenção.', 503);
        checkStock(data, quote.items);
        const record = { reference, fingerprint, status: 'reserved', fulfillment: 'not_paid', sessionId: null,
          live: /^(sk|rk)_live_/.test(env.STRIPE_SECRET_KEY || ''), createdAt: Date.now(), updatedAt: Date.now(),
          items: quote.items, subtotalCents: quote.subtotalCents, shippingCents: quote.shippingCents,
          totalCents: quote.totalCents, deliveryDays: quote.deliveryDays, buyerEncrypted, events: [] };
        data.orders[reference] = record;
        // Leave room for payment events and tracking on existing orders.
        if (Buffer.byteLength(JSON.stringify(data)) > 2 * 1024 * 1024) throw new StoreError('O registro de pedidos precisa de manutenção.', 503);
        return { changed: true, value: record };
      });
    },
    async assertStock(items) { return transaction(data => { checkStock(data, items); return { changed: false, value: true }; }); },
    async reconcile(payment, eventId) {
      const reference = payment.client_reference_id;
      return transaction(data => {
        const order = data.orders[reference];
        if (!order) throw new StoreError('Pedido não encontrado no registro.', 409);
        if (eventId && order.events.includes(eventId)) return { changed: false, value: order };
        if (!paymentMatches(payment, { paymentId: order.sessionId || payment.id, reference, totalCents: order.totalCents, live: order.live }) ||
          payment.metadata?.order_fingerprint !== order.fingerprint) throw new StoreError('O pagamento não corresponde ao pedido.', 409);
        const paid = payment.status === 'complete' && payment.payment_status === 'paid';
        if (['paid', 'dispatched'].includes(order.status) && !paid) return { changed: false, value: order };
        if (['expired', 'failed'].includes(order.status) && !paid) return { changed: false, value: order };
        order.sessionId = payment.id;
        if (paid) {
          // A late confirmation for a previously released reservation needs
          // manual review rather than an automatic promise of delivery.
          if (['expired', 'failed'].includes(order.status)) order.fulfillment = 'review_required';
          else if (order.status !== 'dispatched' && order.supplierSync?.provider !== 'wix') order.fulfillment = 'pending_supplier';
          if (order.status !== 'dispatched') order.status = 'paid';
        } else if (payment.status === 'expired') order.status = 'expired';
        else if (payment.status === 'complete') order.status = 'processing';
        else order.status = 'open';
        order.updatedAt = Date.now();
        if (eventId) order.events = [...order.events.slice(-9), eventId];
        return { changed: true, value: order };
      });
    },
    async failPayment(payment, eventId) {
      // This method is only used after a verified async failure event and an
      // authoritative Stripe read confirms the payment is still unpaid.
      if (payment.payment_status === 'paid') return this.reconcile(payment, eventId);
      return transaction(data => {
        const order = data.orders[payment.client_reference_id];
        if (!order || !paymentMatches(payment, { paymentId: order.sessionId || payment.id, reference: order.reference, totalCents: order.totalCents, live: order.live }) || payment.metadata?.order_fingerprint !== order.fingerprint) throw new StoreError('O pagamento não corresponde ao pedido.', 409);
        if (['paid', 'dispatched'].includes(order.status) || order.events.includes(eventId)) return { changed: false, value: order };
        order.status = 'failed'; order.updatedAt = Date.now(); order.events = [...order.events.slice(-9), eventId];
        return { changed: true, value: order };
      });
    },
    async find(reference) { return transaction(data => ({ changed: false, value: data.orders[reference] || null })); },
    async claimWixSync(reference, claimId) {
      return transaction(data => {
        const order = data.orders[reference];
        if (!order || order.status !== 'paid' || order.fulfillment === 'review_required') throw new StoreError('Pedido indisponível para integração.', 409);
        if (order.supplierSync?.state === 'payment_recorded') return { changed: false, value: { shouldSend: false, sync: order.supplierSync } };
        if (order.supplierSync) throw new StoreError('O registro no fornecedor precisa de conferência antes de repetir.', 503);
        order.supplierSync = { provider: 'wix', state: 'creating', claimId, startedAt: Date.now() };
        return { changed: true, value: { shouldSend: true, sync: order.supplierSync } };
      });
    },
    async recordWixOrder(reference, claimId, orderId) {
      return transaction(data => {
        const order = data.orders[reference], sync = order?.supplierSync;
        if (order?.status !== 'paid' || sync?.state !== 'creating' || sync.claimId !== claimId || !/^[a-f0-9-]{36}$/i.test(orderId)) throw new StoreError('Registro da integração divergente.', 409);
        Object.assign(sync, { state: 'order_created', orderId, updatedAt: Date.now() });
        order.fulfillment = 'wix_payment_pending';
        return { changed: true, value: sync };
      });
    },
    async completeWixSync(reference, claimId) {
      return transaction(data => {
        const order = data.orders[reference], sync = order?.supplierSync;
        if (order?.status !== 'paid' || sync?.state !== 'order_created' || sync.claimId !== claimId) throw new StoreError('Registro da integração divergente.', 409);
        Object.assign(sync, { state: 'payment_recorded', updatedAt: Date.now() }); order.fulfillment = 'sent_to_wix';
        return { changed: true, value: sync };
      });
    },
    async reviewWixSync(reference, claimId) {
      return transaction(data => {
        const order = data.orders[reference], sync = order?.supplierSync;
        if (!sync || sync.claimId !== claimId || sync.state === 'payment_recorded') return { changed: false, value: sync || null };
        sync.state = 'review_required'; sync.updatedAt = Date.now(); order.fulfillment = 'review_required';
        return { changed: true, value: sync };
      });
    },
    async markDispatched(reference, tracking, carrier) {
      if (typeof tracking !== 'string' || !/^[A-Za-z0-9-]{5,60}$/.test(tracking) || typeof carrier !== 'string' || carrier.length < 2 || carrier.length > 60) throw new StoreError('Confira o rastreio.');
      return transaction(data => {
        const order = data.orders[reference];
        if (!order || order.status !== 'paid' || order.fulfillment === 'review_required') throw new StoreError('O pedido não está pronto para despacho.', 409);
        Object.assign(order, { status: 'dispatched', fulfillment: 'dispatched', tracking, carrier, dispatchedAt: Date.now(), updatedAt: Date.now() });
        return { changed: true, value: order };
      });
    }
  };
}

export function getOrderStore(env = process.env) {
  if (!ordersConfigured(env)) throw new StoreError('O registro de pedidos não está disponível.', 503);
  return createOrderStore(blobLedgerAdapter(env), env);
}
