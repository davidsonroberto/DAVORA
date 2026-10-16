export function ordersConfigured(env = process.env) {
  return env.DAVORA_ORDERS_ENABLED === 'true' &&
    Boolean(env.BLOB_READ_WRITE_TOKEN || (env.BLOB_STORE_ID && env.VERCEL_OIDC_TOKEN)) &&
    /^[a-f0-9]{64}$/.test(env.DAVORA_ORDER_ENCRYPTION_KEY || '') &&
    /^[a-z0-9-]{1,40}$/.test(env.DAVORA_ORDER_NAMESPACE || '');
}
