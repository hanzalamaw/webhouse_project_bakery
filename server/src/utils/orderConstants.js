export const ORDER_MODULE = "Order Management";

export const ORDER_STATUSES = ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled", "returned"];
export const PAYMENT_STATUSES = ["unpaid", "partial", "paid", "refunded", "failed"];
export const FULFILLMENT_STATUSES = ["unfulfilled", "partial", "fulfilled"];
export const ORDER_SOURCES = [
  "walk-in",
  "phone",
  "whatsapp",
  "manual",
  "facebook",
  "instagram",
  "website",
  "pos",
  "csv_import",
];

export const PAYMENT_METHODS = ["cod", "card", "bank_transfer", "cash", "online", "other"];
export const PAYMENT_RECORD_STATUSES = ["pending", "paid", "partial", "failed", "refunded"];

/** Primary types; "warehouse" accepted as alias of "branch" in service validation */
export const ASSIGNMENT_TYPES = ["staff", "branch", "fulfillment", "courier", "verification"];
export const ASSIGNMENT_STATUSES = ["pending", "active", "completed", "cancelled"];

export const RETURN_STATUSES = ["requested", "approved", "received", "rejected", "completed"];
export const EXCHANGE_STATUSES = ["requested", "approved", "completed", "rejected"];
export const REFUND_STATUSES = ["pending", "processed", "failed", "cancelled"];
export const REFUND_METHODS = ["original_payment", "bank_transfer", "cash", "store_credit", "other"];

export const DELAYED_ORDER_DAYS = 3;

export const ORDER_STATUS_LABELS = {
  pending: "Pending",
  confirmed: "Confirmed",
  processing: "Processing",
  shipped: "Shipped / Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
  returned: "Returned",
};

export const PAYMENT_STATUS_LABELS = {
  unpaid: "Unpaid",
  partial: "Partial Paid",
  paid: "Paid",
  refunded: "Refunded",
  failed: "Failed",
};

export const ORDER_SOURCE_LABELS = {
  "walk-in": "Walk-in",
  phone: "Phone",
  whatsapp: "WhatsApp",
  manual: "Manual",
  facebook: "Facebook",
  instagram: "Instagram",
  website: "Website",
  pos: "Counter (POS)",
  csv_import: "CSV Import",
  other: "Other",
};

export const ASSIGNMENT_TYPE_LABELS = {
  staff: "Staff",
  branch: "Branch Team",
  warehouse: "Branch Team",
  fulfillment: "Fulfillment Team",
  courier: "Rider / Courier",
  verification: "Verification",
};
