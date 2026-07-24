// Shared constants for the unified bakery stock model.

export const STOCK_MODULE = "Stock & Purchasing";
export const PRODUCTION_MODULE = "Production";

export const ITEM_TYPES = ["ingredient", "finished", "packaging"];

export const STATUS_VALUES = ["active", "inactive"];

// Units a bakery commonly uses (weight / volume / count).
export const UNITS = [
  "kg",
  "g",
  "litre",
  "ml",
  "piece",
  "dozen",
  "packet",
  "box",
  "tray",
  "bag",
];

export const MOVEMENT_TYPES = [
  "purchase_in",
  "production_in",
  "production_consume",
  "sale_out",
  "transfer_in",
  "transfer_out",
  "wastage",
  "adjustment",
  "return_in",
  "opening",
];

export const TRANSFER_STATUSES = ["pending", "in_transit", "received", "cancelled"];

export const PO_STATUSES = ["draft", "ordered", "partial", "received", "cancelled"];

export const WASTAGE_REASONS = ["expired", "damaged", "spoiled", "other"];

export const BATCH_SOURCE_TYPES = ["purchase", "production", "transfer", "opening", "adjustment"];

export function isValidItemType(value) {
  return ITEM_TYPES.includes(value);
}
