import { OrderConflict } from '../lib/orders.js';
export function memoryLedger() {
  let data = null, version = 0;
  return {
    async read() { return data ? { data: structuredClone(data), etag: String(version) } : null; },
    async write(next, etag) {
      if ((data && etag !== String(version)) || (!data && etag)) throw new OrderConflict();
      data = structuredClone(next); version++; return { etag: String(version) };
    }
  };
}
