export const STORAGE_KEYS = {
  ingredients: "dulcearte.ingredients",
  batches: "dulcearte.batches",
  users: "dulcearte.users"
};

export function getSafeArray(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}
