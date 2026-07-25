/** sessionStorage helpers for mid-flow create (save form → create related → return). */

export function saveFormDraft(key, data) {
  try {
    sessionStorage.setItem(key, JSON.stringify(data));
  } catch {
    /* ignore quota / private mode */
  }
}

export function loadFormDraft(key) {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearFormDraft(key) {
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function consumeFormDraft(key) {
  const data = loadFormDraft(key);
  if (data != null) clearFormDraft(key);
  return data;
}

const INVENTORY_CREATE_ITEM = "/app/m/stock-purchasing/items/create";

/** Build inventory Create Item URL that returns to a production form afterward. */
export function buildCreateItemReturnUrl({ returnTo, itemType, selectFor }) {
  const params = new URLSearchParams();
  if (returnTo) params.set("returnTo", returnTo);
  if (itemType) params.set("item_type", itemType);
  if (selectFor) params.set("selectFor", selectFor);
  const q = params.toString();
  return q ? `${INVENTORY_CREATE_ITEM}?${q}` : INVENTORY_CREATE_ITEM;
}

/** Append resume + created item id onto the return path after Create Item succeeds. */
export function appendCreatedItemReturn(returnTo, itemId, selectFor) {
  const url = new URL(returnTo || "/", window.location.origin);
  url.searchParams.set("resumed", "1");
  if (itemId != null && itemId !== "") {
    url.searchParams.set("createdItemId", String(itemId));
  }
  if (selectFor) url.searchParams.set("selectFor", selectFor);
  return `${url.pathname}${url.search}`;
}

/** Clean path for returnTo (strip prior resume/create params). */
export function currentReturnPath(pathname = window.location.pathname) {
  return pathname;
}
