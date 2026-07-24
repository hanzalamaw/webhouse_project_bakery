import {
  CUSTOMER_TYPES,
  CUSTOMER_STATUSES,
  ADDRESS_TYPES,
  CUSTOMER_TYPE_LABELS,
  ADDRESS_TYPE_LABELS,
} from "./crmConstants.js";

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

function buildLabelIndex(labels) {
  const index = new Map();
  for (const [key, label] of Object.entries(labels)) {
    index.set(key.toLowerCase(), key);
    index.set(slugify(key), key);
    index.set(String(label).toLowerCase(), key);
    index.set(slugify(label), key);
  }
  return index;
}

const TYPE_INDEX = buildLabelIndex(CUSTOMER_TYPE_LABELS);
const ADDRESS_INDEX = buildLabelIndex(ADDRESS_TYPE_LABELS);

const ADDRESS_LEGACY = {
  billing: "office",
  shipping: "office",
  default: "office",
};

const CUSTOMER_PRESETS = CUSTOMER_TYPES.filter((t) => t !== "other");
const ADDRESS_PRESETS = ADDRESS_TYPES.filter((t) => t !== "other");

export function normalizeCustomerType(value, fallback = "retailer") {
  const raw = String(value || "").trim();
  if (!raw) return fallback;
  const key = TYPE_INDEX.get(raw.toLowerCase()) || TYPE_INDEX.get(slugify(raw));
  if (key && CUSTOMER_PRESETS.includes(key)) return key;
  if (CUSTOMER_PRESETS.includes(slugify(raw))) return slugify(raw);
  if (raw.length > 45) throw new Error("Customer type must be 45 characters or less");
  return raw;
}

export function normalizeAddressType(value, fallback = "office") {
  const raw = String(value || "").trim();
  if (!raw) return fallback;
  const slug = slugify(raw);
  if (ADDRESS_LEGACY[slug]) return ADDRESS_LEGACY[slug];
  const key = ADDRESS_INDEX.get(raw.toLowerCase()) || ADDRESS_INDEX.get(slug);
  if (key && ADDRESS_PRESETS.includes(key)) return key;
  if (ADDRESS_PRESETS.includes(slug)) return slug;
  if (raw.length > 45) throw new Error("Address type must be 45 characters or less");
  return raw;
}

export function normalizeCustomerStatus(value, fallback = "active") {
  const raw = String(value || "").trim();
  if (!raw) return fallback;
  const s = slugify(raw);
  if (CUSTOMER_STATUSES.includes(s)) return s;
  throw new Error(`Invalid customer status "${raw}". Use: ${CUSTOMER_STATUSES.join(", ")}`);
}
