import { toNumber } from "./format";

export function getCompatibleUsageUnits(unit) {
  if (!unit) {
    return [];
  }

  return [unit];
}

export function convertQuantityBetweenUnits(quantity, fromUnit, toUnit) {
  if (fromUnit === toUnit) {
    return quantity;
  }

  return null;
}

function normalizeUsageEntries(draft, ingredientMap) {
  const groupedUsage = new Map();
  const usageDetails = new Map();
  const errors = new Set();

  (draft?.items || []).forEach((item) => {
    if (!item?.ingredientId) {
      return;
    }

    const ingredient = ingredientMap.get(item.ingredientId);
    if (!ingredient) {
      errors.add("Uno de los ingredientes seleccionados no existe en inventario.");
      return;
    }

    const rawQuantity = toNumber(item.usedQuantity);
    if (rawQuantity <= 0) {
      return;
    }

    const usageUnit = item.usageUnit || ingredient.unit;
    const compatibleUnits = getCompatibleUsageUnits(ingredient.unit);

    if (!compatibleUnits.includes(usageUnit)) {
      errors.add(
        `La unidad ${usageUnit} no es compatible con ${ingredient.name} (${ingredient.unit}).`
      );
      return;
    }

    const normalizedQuantity = convertQuantityBetweenUnits(
      rawQuantity,
      usageUnit,
      ingredient.unit
    );

    if (normalizedQuantity === null) {
      errors.add(
        `No se pudo convertir ${usageUnit} a ${ingredient.unit} para ${ingredient.name}.`
      );
      return;
    }

    const previous = groupedUsage.get(item.ingredientId) || 0;
    groupedUsage.set(item.ingredientId, previous + normalizedQuantity);

    const currentDetails = usageDetails.get(item.ingredientId) || [];
    currentDetails.push(`${rawQuantity} ${usageUnit}`);
    usageDetails.set(item.ingredientId, currentDetails);
  });

  return {
    groupedUsage,
    usageDetails,
    errors: [...errors]
  };
}

export function getBatchPreview(draft, ingredients) {
  const ingredientMap = new Map(
    ingredients.map((ingredient) => [ingredient.id, ingredient])
  );
  const normalizedUsage = normalizeUsageEntries(draft, ingredientMap);
  const errors = [...normalizedUsage.errors];
  const items = [];
  let totalCost = 0;
  let cookieCostTotal = 0;

  normalizedUsage.groupedUsage.forEach((usedQuantity, ingredientId) => {
    const ingredient = ingredientMap.get(ingredientId);

    if (!ingredient) {
      return;
    }

    const availableQuantity = toNumber(ingredient.quantityAvailable);
    const unitPrice = toNumber(ingredient.pricePerUnit);
    const partialCost = usedQuantity * unitPrice;
    const affectsCookieCost = Boolean(ingredient.affectsCookieCost);

    if (usedQuantity > availableQuantity) {
      errors.push(
        `Stock insuficiente para ${ingredient.name}. Disponible: ${availableQuantity} ${ingredient.unit}.`
      );
    }

    totalCost += partialCost;
    if (affectsCookieCost) {
      cookieCostTotal += partialCost;
    }

    items.push({
      ingredientId,
      name: ingredient.name,
      unit: ingredient.unit,
      usedQuantity,
      inputSummary: (normalizedUsage.usageDetails.get(ingredientId) || []).join(" + "),
      unitPrice,
      affectsCookieCost,
      availableQuantity,
      partialCost
    });
  });

  const producedDesserts = toNumber(draft?.producedDesserts);

  if (!items.length) {
    errors.push("Agrega al menos un ingrediente con cantidad usada mayor a 0.");
  }

  if (producedDesserts <= 0) {
    errors.push("La cantidad de postres producidos debe ser mayor a 0.");
  }

  const unitCost = producedDesserts > 0 ? totalCost / producedDesserts : 0;
  const cookieUnitCost = producedDesserts > 0 ? cookieCostTotal / producedDesserts : 0;

  return {
    items,
    producedDesserts,
    totalCost,
    cookieCostTotal,
    cookieUnitCost,
    unitCost,
    errors
  };
}

export function applyBatchRegistration(draft, ingredients) {
  const preview = getBatchPreview(draft, ingredients);

  if (preview.errors.length > 0) {
    throw new Error(preview.errors[0]);
  }

  const updatedIngredients = ingredients.map((ingredient) => {
    const usedEntry = preview.items.find((item) => item.ingredientId === ingredient.id);

    if (!usedEntry) return ingredient;

    const nextQuantity = toNumber(ingredient.quantityAvailable) - usedEntry.usedQuantity;

    return {
      ...ingredient,
      quantityAvailable: Number(Math.max(nextQuantity, 0).toFixed(4))
    };
  });

  return {
    updatedIngredients,
    preview
  };
}
