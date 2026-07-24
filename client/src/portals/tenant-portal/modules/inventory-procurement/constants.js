export const MODULE_SLUG = "stock-purchasing";
export const MODULE_BASE = `/app/m/${MODULE_SLUG}`;

export const ITEM_STATUS = ["active", "inactive"];
export const ITEM_TYPES = ["ingredient", "finished", "packaging"];
export const ITEM_TYPE_LABELS = {
  ingredient: "Ingredient (Masala / Raw)",
  finished: "Finished (Tayyar Cheez)",
  packaging: "Packaging (Packing)",
};

export const ITEM_UNITS = [
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

export const MOVEMENT_LABELS = {
  purchase_in: "Stock In (Purchase)",
  production_in: "Production In",
  production_consume: "Used in Production",
  sale_out: "Sale Out",
  transfer_in: "Transfer In",
  transfer_out: "Transfer Out",
  wastage: "Wastage (Barbaadi)",
  adjustment: "Stock Out / Adjustment",
  return_in: "Return In",
  opening: "Opening Stock",
};

export const TRANSFER_STATUSES = ["pending", "in_transit", "received", "cancelled"];
export const PO_STATUSES = ["draft", "ordered", "partial", "received", "cancelled"];
export const WASTAGE_REASONS = ["expired", "damaged", "spoiled", "other"];
export const WASTAGE_REASON_LABELS = {
  expired: "Expired (Expire ho gaya)",
  damaged: "Damaged (Kharab)",
  spoiled: "Spoiled (Sarr gaya)",
  other: "Other",
};

/** @deprecated use ITEM_STATUS */
export const PRODUCT_STATUS = ITEM_STATUS;
/** @deprecated use ITEM_UNITS */
export const PRODUCT_UNITS = ITEM_UNITS;
