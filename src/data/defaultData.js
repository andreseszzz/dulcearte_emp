export const DEFAULT_INGREDIENTS = [
  {
    id: "ing-base-limon",
    name: "Base sabor limon",
    quantityAvailable: 5000,
    unit: "g",
    priceBasis: "g",
    pricePerUnit: 35,
    affectsCookieCost: false
  },
  {
    id: "ing-base-maracuya",
    name: "Base sabor maracuya",
    quantityAvailable: 5000,
    unit: "g",
    priceBasis: "g",
    pricePerUnit: 37,
    affectsCookieCost: false
  },
  {
    id: "ing-galleta",
    name: "Galleta triturada",
    quantityAvailable: 3000,
    unit: "g",
    priceBasis: "g",
    pricePerUnit: 22,
    affectsCookieCost: true
  },
  {
    id: "ing-crema",
    name: "Crema de leche",
    quantityAvailable: 2500,
    unit: "ml",
    priceBasis: "ml",
    pricePerUnit: 12,
    affectsCookieCost: false
  }
];

export const DEFAULT_USERS = [];
export const DEFAULT_BATCHES = [];

export const FLAVOR_OPTIONS = ["Limon", "Maracuya", "Galleta", "Ambos"];
export const ASSIGNMENT_SELECTION_OPTIONS = [
  { value: "Limon", label: "Postre de limon" },
  { value: "Maracuya", label: "Postre de maracuya" },
  { value: "Solo galleta", label: "Galleta" }
];
export const UNIT_OPTIONS = ["g", "ml", "unidades"];

export const EMPTY_INGREDIENT_FORM = {
  name: "",
  quantityAvailable: "",
  unit: "g",
  priceBasis: "g",
  pricePerUnit: "",
  affectsCookieCost: false
};

export const EMPTY_BATCH_DRAFT = {
  producedDesserts: "",
  items: [{ ingredientId: "", usedQuantity: "", usageUnit: "" }]
};

export const EMPTY_USER_FORM = {
  name: "",
  contact: "",
  preferredFlavor: "Limon"
};
