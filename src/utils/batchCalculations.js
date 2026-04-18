import { toNumber } from "./format";

function mapUsageFromDraft(draft) {
  const usage = new Map();

  (draft?.items || []).forEach((item) => {
    if (!item?.ingredientId) return;

    const usedQuantity = toNumber(item.usedQuantity);
    if (usedQuantity <= 0) return;

    const previous = usage.get(item.ingredientId) || 0;
    usage.set(item.ingredientId, previous + usedQuantity);
  });

  return usage;
}

export function getBatchPreview(draft, ingredients) {
  const ingredientMap = new Map(
    ingredients.map((ingredient) => [ingredient.id, ingredient])
  );
  const usage = mapUsageFromDraft(draft);
  const errors = [];
  const items = [];
  let totalCost = 0;

  usage.forEach((usedQuantity, ingredientId) => {
    const ingredient = ingredientMap.get(ingredientId);

    if (!ingredient) {
      errors.push("Uno de los ingredientes seleccionados no existe en inventario.");
      return;
    }

    const availableQuantity = toNumber(ingredient.quantityAvailable);
    const unitPrice = toNumber(ingredient.pricePerUnit);
    const partialCost = usedQuantity * unitPrice;

    if (usedQuantity > availableQuantity) {
      errors.push(
        `Stock insuficiente para ${ingredient.name}. Disponible: ${availableQuantity} ${ingredient.unit}.`
      );
    }

    totalCost += partialCost;

    items.push({
      ingredientId,
      name: ingredient.name,
      unit: ingredient.unit,
      usedQuantity,
      unitPrice,
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

  return {
    items,
    producedDesserts,
    totalCost,
    unitCost,
    errors
  };
}

export function applyBatchRegistration(draft, ingredients) {
  const preview = getBatchPreview(draft, ingredients);

  if (preview.errors.length > 0) {
    throw new Error(preview.errors[0]);
  }

  const usage = mapUsageFromDraft(draft);

  const updatedIngredients = ingredients.map((ingredient) => {
    const used = usage.get(ingredient.id);

    if (!used) return ingredient;

    return {
      ...ingredient,
      quantityAvailable: toNumber(ingredient.quantityAvailable) - used
    };
  });

  return {
    updatedIngredients,
    preview
  };
}
