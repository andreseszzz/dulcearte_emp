export const DEFAULT_INGREDIENTS = [
  {
    id: "ing-base-limon",
    name: "Base sabor limon",
    quantityAvailable: 5000,
    unit: "g",
    pricePerUnit: 35
  },
  {
    id: "ing-base-maracuya",
    name: "Base sabor maracuya",
    quantityAvailable: 5000,
    unit: "g",
    pricePerUnit: 37
  },
  {
    id: "ing-galleta",
    name: "Galleta triturada",
    quantityAvailable: 3000,
    unit: "g",
    pricePerUnit: 22
  },
  {
    id: "ing-crema",
    name: "Crema de leche",
    quantityAvailable: 2500,
    unit: "ml",
    pricePerUnit: 12
  }
];

export const DEFAULT_USERS = [];
export const DEFAULT_BATCHES = [];

export const FLAVOR_OPTIONS = ["Limon", "Maracuya"];
export const UNIT_OPTIONS = ["g", "ml", "kg"];

export const EMPTY_INGREDIENT_FORM = {
  name: "",
  quantityAvailable: "",
  unit: "g",
  pricePerUnit: ""
};

export const EMPTY_BATCH_DRAFT = {
  producedDesserts: "",
  items: [{ ingredientId: "", usedQuantity: "" }]
};

export const EMPTY_USER_FORM = {
  name: "",
  contact: "",
  preferredFlavor: "Limon",
  wantsCookie: true
};
