import { toNumber } from "./format";
import { normalizePriceBasis } from "./ingredientPricing";

export const STORAGE_KEYS = {
  ingredients: "dulcearte.ingredients",
  batches: "dulcearte.batches",
  users: "dulcearte.users",
  dataMigrationVersion: "dulcearte.dataMigrationVersion"
};

export function getSafeArray(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

const ASSIGNED_SELECTION_VALUES = new Set(["Limon", "Maracuya", "Solo galleta"]);
const USER_PREFERRED_FLAVOR_VALUES = new Set(["Limon", "Maracuya", "Galleta", "Ambos"]);

function normalizeAssignedSelectionType(value) {
  const safeValue = String(value || "").trim();
  if (safeValue === "Galleta") {
    return "Solo galleta";
  }
  return ASSIGNED_SELECTION_VALUES.has(safeValue) ? safeValue : "Limon";
}

function inferCookieCostFromName(name) {
  const lowerName = String(name || "").toLowerCase();
  return lowerName.includes("galleta");
}

function roundNumber(value, fractionDigits = 4) {
  return Number(toNumber(value).toFixed(fractionDigits));
}

function normalizeUnit(rawUnit) {
  const unit = String(rawUnit || "").trim().toLowerCase();

  const unitMap = {
    g: "g",
    gr: "g",
    gramo: "g",
    gramos: "g",
    kg: "kg",
    kilo: "kg",
    kilos: "kg",
    kilogramo: "kg",
    kilogramos: "kg",
    ml: "ml",
    mililitro: "ml",
    mililitros: "ml",
    unidad: "unidades",
    unidades: "unidades",
    und: "unidades",
    uds: "unidades",
    ud: "unidades",
    u: "unidades"
  };

  return unitMap[unit] || unit || "unidades";
}

function normalizeMassScale(quantity, pricePerUnit, unit) {
  const safeQuantity = Math.max(toNumber(quantity), 0);
  const safePricePerUnit = Math.max(toNumber(pricePerUnit), 0);

  // Solo sanea numeros y unidad; no altera escala ni magnitud del precio.
  return {
    quantity: roundNumber(safeQuantity),
    pricePerUnit: roundNumber(safePricePerUnit, 6),
    unit
  };
}

function convertKgScaleToG(quantity, pricePerUnit, unit) {
  if (unit !== "kg") {
    return {
      quantity,
      pricePerUnit,
      unit
    };
  }

  return {
    quantity: quantity * 1000,
    pricePerUnit: pricePerUnit / 1000,
    unit: "g"
  };
}

function normalizeStoredPrice(ingredient, normalizedUnit) {
  const rawPrice = Math.max(toNumber(ingredient?.pricePerUnit), 0);
  const hasStoredBasis = typeof ingredient?.priceBasis === "string" && ingredient.priceBasis.trim() !== "";

  if (hasStoredBasis) {
    return {
      priceBasis: normalizePriceBasis(normalizedUnit, ingredient.priceBasis),
      pricePerUnit: roundNumber(rawPrice, 6)
    };
  }

  return {
    priceBasis: normalizePriceBasis(normalizedUnit, normalizedUnit),
    pricePerUnit: roundNumber(rawPrice, 6)
  };
}

export function normalizeIngredientsData(ingredients, fallback = []) {
  const source = getSafeArray(ingredients, fallback);
  const usedIds = new Set();

  return source.map((ingredient, index) => {
    const sourceUnit = normalizeUnit(ingredient?.unit);
    const sourceQuantity = Math.max(toNumber(ingredient?.quantityAvailable), 0);
    const sourcePricePerUnit = Math.max(toNumber(ingredient?.pricePerUnit), 0);
    const convertedScale = convertKgScaleToG(sourceQuantity, sourcePricePerUnit, sourceUnit);
    const normalizedPrice = normalizeStoredPrice(ingredient, convertedScale.unit);
    const scaled = normalizeMassScale(
      convertedScale.quantity,
      normalizedPrice.pricePerUnit,
      convertedScale.unit
    );

    let id = String(ingredient?.id || "").trim();
    if (!id || usedIds.has(id)) {
      id = `ing-migrated-${index + 1}`;
    }
    usedIds.add(id);

    const name = String(ingredient?.name || "").trim() || `Ingrediente ${index + 1}`;

    return {
      id,
      name,
      quantityAvailable: scaled.quantity,
      unit: scaled.unit,
      priceBasis: normalizedPrice.priceBasis,
      pricePerUnit: scaled.pricePerUnit,
      affectsCookieCost:
        typeof ingredient?.affectsCookieCost === "boolean"
          ? ingredient.affectsCookieCost
          : inferCookieCostFromName(name)
    };
  });
}

function normalizeBatchItem(item, index) {
  const sourceUnit = normalizeUnit(item?.unit);
  const sourceQuantity = Math.max(toNumber(item?.usedQuantity), 0);
  const sourcePricePerUnit = Math.max(toNumber(item?.unitPrice), 0);
  const convertedScale = convertKgScaleToG(sourceQuantity, sourcePricePerUnit, sourceUnit);
  const scaled = normalizeMassScale(
    convertedScale.quantity,
    convertedScale.pricePerUnit,
    convertedScale.unit
  );

  const safeIngredientId = String(item?.ingredientId || "").trim() || `ing-unknown-${index + 1}`;
  const safeName = String(item?.name || "").trim() || `Ingrediente ${index + 1}`;
  const partialCost = roundNumber(scaled.quantity * scaled.pricePerUnit, 6);

  return {
    ingredientId: safeIngredientId,
    name: safeName,
    unit: scaled.unit,
    usedQuantity: scaled.quantity,
    inputSummary:
      String(item?.inputSummary || "").trim() || `${roundNumber(scaled.quantity)} ${scaled.unit}`,
    unitPrice: scaled.pricePerUnit,
    affectsCookieCost:
      typeof item?.affectsCookieCost === "boolean"
        ? item.affectsCookieCost
        : inferCookieCostFromName(safeName),
    partialCost
  };
}

function normalizeAssignedUsers(batch) {
  const rawAssignedUsers = getSafeArray(batch?.assignedUsers);

  if (rawAssignedUsers.length > 0) {
    const grouped = new Map();

    rawAssignedUsers.forEach((entry) => {
      const userId = String(entry?.userId || "").trim();
      if (!userId) return;

      const dessertsSelected = Math.max(Math.floor(toNumber(entry?.dessertsSelected)), 1);
      const selectionType = normalizeAssignedSelectionType(entry?.selectionType);
      const groupKey = `${userId}::${selectionType}`;
      const current = grouped.get(groupKey) || {
        userId,
        dessertsSelected: 0,
        selectionType
      };

      grouped.set(groupKey, {
        userId,
        dessertsSelected: current.dessertsSelected + dessertsSelected,
        selectionType
      });
    });

    return Array.from(grouped.values()).map((data) => ({
      userId: data.userId,
      dessertsSelected: data.dessertsSelected,
      selectionType: data.selectionType
    }));
  }

  const legacyAssignedUserIds = Array.from(
    new Set(
      getSafeArray(batch?.assignedUserIds)
        .map((value) => String(value).trim())
        .filter(Boolean)
    )
  );

  return legacyAssignedUserIds.map((userId) => ({
    userId,
    dessertsSelected: 1,
    selectionType: "Limon"
  }));
}

export function normalizeBatchesData(batches, fallback = []) {
  const source = getSafeArray(batches, fallback);

  return source.map((batch, index) => {
    const normalizedItems = getSafeArray(batch?.items).map(normalizeBatchItem);
    const totalCost = roundNumber(
      normalizedItems.reduce((sum, item) => sum + toNumber(item.partialCost), 0),
      6
    );
    const cookieCostTotal = roundNumber(
      normalizedItems
        .filter((item) => item.affectsCookieCost)
        .reduce((sum, item) => sum + toNumber(item.partialCost), 0),
      6
    );
    const producedDesserts = Math.max(toNumber(batch?.producedDesserts), 0);
    const unitCost = producedDesserts > 0 ? roundNumber(totalCost / producedDesserts, 6) : 0;
    const cookieUnitCost =
      producedDesserts > 0 ? roundNumber(cookieCostTotal / producedDesserts, 6) : 0;

    const parsedDate = new Date(batch?.createdAt || "");
    const createdAt = Number.isNaN(parsedDate.getTime())
      ? new Date().toISOString()
      : parsedDate.toISOString();

    const assignedUsers = normalizeAssignedUsers(batch);

    const id = String(batch?.id || "").trim() || `batch-migrated-${index + 1}`;

    return {
      id,
      createdAt,
      producedDesserts,
      totalCost,
      cookieCostTotal,
      cookieUnitCost,
      unitCost,
      items: normalizedItems,
      assignedUsers
    };
  });
}

export function normalizeUsersData(users, fallback = []) {
  const source = getSafeArray(users, fallback);
  const usedIds = new Set();

  return source.map((user, index) => {
    let id = String(user?.id || "").trim();
    if (!id || usedIds.has(id)) {
      id = `usr-migrated-${index + 1}`;
    }
    usedIds.add(id);

    const preferredFlavorRaw = String(user?.preferredFlavor || "Limon").trim();
    const preferredFlavor = USER_PREFERRED_FLAVOR_VALUES.has(preferredFlavorRaw)
      ? preferredFlavorRaw
      : "Limon";

    return {
      id,
      name: String(user?.name || "").trim(),
      contact: String(user?.contact || "").trim(),
      preferredFlavor
    };
  });
}
