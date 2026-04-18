import { toNumber } from "./format";

const PRICE_BASIS_OPTIONS_BY_UNIT = {
  g: [{ value: "g", label: "Precio total para gramos (g)" }],
  ml: [
    { value: "ml", label: "Por mililitro (ml)" },
    { value: "l", label: "Por litro (1000 ml)" }
  ],
  unidades: [{ value: "unidades", label: "Por unidad" }]
};

const DEFAULT_PRICE_BASIS_BY_UNIT = {
  g: "g",
  ml: "l",
  unidades: "unidades"
};

export function getDefaultPriceBasis(unit) {
  return DEFAULT_PRICE_BASIS_BY_UNIT[unit] || unit || "unidades";
}

export function getPriceBasisOptions(unit) {
  return PRICE_BASIS_OPTIONS_BY_UNIT[unit] || [{ value: unit || "unidades", label: "Por unidad" }];
}

export function normalizePriceBasis(unit, basis) {
  const options = getPriceBasisOptions(unit);
  const fallback = getDefaultPriceBasis(unit);
  const hasBasis = options.some((option) => option.value === basis);
  if (hasBasis) {
    return basis;
  }

  if (options.some((option) => option.value === fallback)) {
    return fallback;
  }

  return options[0].value;
}

export function convertInputPriceToUnitPrice(inputPrice, unit, basis, quantityReference) {
  const safePrice = Math.max(toNumber(inputPrice), 0);
  const normalizedBasis = normalizePriceBasis(unit, basis);
  const safeReference = Math.max(toNumber(quantityReference), 0);

  if (unit === "g") {
    return safeReference > 0 ? safePrice / safeReference : 0;
  }

  if (unit === "ml" && normalizedBasis === "l") {
    return safePrice / 1000;
  }

  return safePrice;
}

export function convertUnitPriceToInputPrice(unitPrice, unit, basis, quantityReference) {
  const safeUnitPrice = Math.max(toNumber(unitPrice), 0);
  const normalizedBasis = normalizePriceBasis(unit, basis);
  const safeReference = Math.max(toNumber(quantityReference), 0);

  if (unit === "g") {
    return safeUnitPrice * safeReference;
  }

  if (unit === "ml" && normalizedBasis === "l") {
    return safeUnitPrice * 1000;
  }

  return safeUnitPrice;
}

export function getPriceBasisLabel(unit, basis) {
  const normalizedBasis = normalizePriceBasis(unit, basis);
  const option = getPriceBasisOptions(unit).find((entry) => entry.value === normalizedBasis);
  return option ? option.label : normalizedBasis;
}
