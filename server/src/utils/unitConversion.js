// Convert quantities between units that belong to the same measurement family.
//
// Recipes let a user express an ingredient in a handy unit (e.g. "150 piece"
// of eggs) while the item itself is stocked in another unit (e.g. "dozen").
// Stock levels are always kept in the item's own unit, so recipe quantities
// must be converted before they are consumed — otherwise "150 piece" would be
// wrongly subtracted as "150 dozen".

// Each family maps its units onto a common base multiplier.
const FAMILIES = {
  weight: { g: 1, kg: 1000 },
  volume: { ml: 1, litre: 1000 },
  count: { piece: 1, dozen: 12 },
};

function normalizeUnit(unit) {
  return String(unit || "").trim().toLowerCase();
}

function familyOf(unit) {
  const u = normalizeUnit(unit);
  for (const [family, units] of Object.entries(FAMILIES)) {
    if (Object.prototype.hasOwnProperty.call(units, u)) return family;
  }
  return null;
}

/** True when a quantity in fromUnit can be expressed in toUnit. */
export function canConvertUnit(fromUnit, toUnit) {
  const from = normalizeUnit(fromUnit);
  const to = normalizeUnit(toUnit);
  if (from === to) return true;
  const familyFrom = familyOf(from);
  const familyTo = familyOf(to);
  return familyFrom != null && familyFrom === familyTo;
}

/**
 * Convert qty from fromUnit to toUnit.
 * Returns null when the units are not convertible (different families).
 */
export function convertUnit(qty, fromUnit, toUnit) {
  const value = Number(qty);
  if (!Number.isFinite(value)) return null;
  const from = normalizeUnit(fromUnit);
  const to = normalizeUnit(toUnit);
  if (!from || !to || from === to) return value;

  const family = familyOf(from);
  if (family == null || family !== familyOf(to)) return null;

  const units = FAMILIES[family];
  const inBase = value * units[from];
  return inBase / units[to];
}

/**
 * Convert a recipe-line quantity into the item's stock unit.
 * Falls back to the raw quantity when the units can't be converted
 * (preserves legacy behavior instead of throwing).
 */
export function toStockQty(qty, recipeUnit, stockUnit) {
  const converted = convertUnit(qty, recipeUnit, stockUnit);
  if (converted == null) return Number(qty);
  return converted;
}
