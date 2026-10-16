const MAX_INVENTORY_AGE = 86400000;

export function hasFreshInventory(product, quantity = 1, now = Date.now()) {
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 10) return false;
  const untracked = product.inventoryMode === 'supplier_availability';
  const confirmed = Date.parse(untracked ? product.supplierInventory?.verifiedAt : product.stockConfirmedAt);
  if (!Number.isFinite(confirmed) || confirmed > now || now - confirmed >= MAX_INVENTORY_AGE) return false;
  if (!untracked) return Number.isSafeInteger(product.stock) && product.stock >= quantity;
  const inventory = product.supplierInventory;
  return inventory?.tracked === false && inventory.available === null && inventory.inventoryLevel === 'In stock' &&
    typeof product.supplierSku === 'string' && product.supplierSku.length > 0 && Number.isSafeInteger(product.supplierVariantId) && product.supplierVariantId > 0;
}
