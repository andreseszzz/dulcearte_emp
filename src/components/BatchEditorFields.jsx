import { useState } from "react";
import {
  convertQuantityBetweenUnits,
  getCompatibleUsageUnits
} from "../utils/batchCalculations";
import { formatPlainNumber, toNumber } from "../utils/format";

const EMPTY_ITEM = { ingredientId: "", usedQuantity: "", usageUnit: "" };

function isBlankItem(item) {
  const safeItem = { ...EMPTY_ITEM, ...item };
  const hasIngredient = Boolean(String(safeItem.ingredientId || "").trim());
  const hasQuantity = String(safeItem.usedQuantity || "").trim() !== "";
  const hasUsageUnit = Boolean(String(safeItem.usageUnit || "").trim());

  return !hasIngredient && !hasQuantity && !hasUsageUnit;
}

function ensureTrailingBlankItem(items) {
  const normalizedItems = (items || []).map((item) => ({ ...EMPTY_ITEM, ...item }));
  const nonBlankItems = normalizedItems.filter((item) => !isBlankItem(item));

  return [...nonBlankItems, { ...EMPTY_ITEM }];
}

function getMaxAllowedForItem(items, index, ingredients) {
  const currentItem = items[index];
  if (!currentItem?.ingredientId) {
    return null;
  }

  const ingredient = ingredients.find((entry) => entry.id === currentItem.ingredientId);
  if (!ingredient) {
    return null;
  }

  const ingredientUnit = ingredient.unit;
  const targetUsageUnit = currentItem.usageUnit || ingredientUnit;
  const availableInIngredientUnit = Math.max(toNumber(ingredient.quantityAvailable), 0);

  const usedByOtherRowsInIngredientUnit = items.reduce((sum, item, itemIndex) => {
    if (itemIndex === index || item.ingredientId !== currentItem.ingredientId) {
      return sum;
    }

    const itemQuantity = toNumber(item.usedQuantity);
    if (itemQuantity <= 0) {
      return sum;
    }

    const itemUnit = item.usageUnit || ingredientUnit;
    const convertedToIngredientUnit = convertQuantityBetweenUnits(
      itemQuantity,
      itemUnit,
      ingredientUnit
    );

    if (convertedToIngredientUnit === null) {
      return sum;
    }

    return sum + convertedToIngredientUnit;
  }, 0);

  const remainingInIngredientUnit = Math.max(
    availableInIngredientUnit - usedByOtherRowsInIngredientUnit,
    0
  );
  const maxInTargetUsageUnit = convertQuantityBetweenUnits(
    remainingInIngredientUnit,
    ingredientUnit,
    targetUsageUnit
  );

  if (maxInTargetUsageUnit === null) {
    return null;
  }

  return Math.max(maxInTargetUsageUnit, 0);
}

function clampQuantityToMax(rawValue, maxAllowed) {
  if (rawValue === "") {
    return "";
  }

  const numericValue = toNumber(rawValue);
  if (maxAllowed === null || numericValue <= maxAllowed) {
    return rawValue;
  }

  return String(Number(maxAllowed.toFixed(6)));
}

export default function BatchEditorFields({ draft, setDraft, ingredients, idPrefix = "batch" }) {
  const [overLimitByRow, setOverLimitByRow] = useState({});

  const items = ensureTrailingBlankItem(draft.items);

  const updateProducedDesserts = (value) => {
    setDraft((previous) => ({
      ...previous,
      producedDesserts: value
    }));
  };

  const updateUsedQuantity = (index, rawValue) => {
    setDraft((previous) => {
      const nextItems = ensureTrailingBlankItem(previous.items);

      nextItems[index] = {
        ...nextItems[index],
        usedQuantity: rawValue
      };

      const maxAllowed = getMaxAllowedForItem(nextItems, index, ingredients);
      const rawNumber = toNumber(rawValue);
      const attemptedOverLimit =
        rawValue !== "" && maxAllowed !== null && rawNumber > maxAllowed + 1e-9;

      setOverLimitByRow((previous) => ({
        ...previous,
        [index]: attemptedOverLimit
      }));

      nextItems[index].usedQuantity = clampQuantityToMax(rawValue, maxAllowed);

      return {
        ...previous,
        items: ensureTrailingBlankItem(nextItems)
      };
    });
  };

  const updateUsageUnit = (index, unit) => {
    setDraft((previous) => {
      const nextItems = ensureTrailingBlankItem(previous.items);

      nextItems[index] = {
        ...nextItems[index],
        usageUnit: unit
      };

      setOverLimitByRow((previous) => ({
        ...previous,
        [index]: false
      }));

      const maxAllowed = getMaxAllowedForItem(nextItems, index, ingredients);
      nextItems[index].usedQuantity = clampQuantityToMax(
        nextItems[index].usedQuantity,
        maxAllowed
      );

      return {
        ...previous,
        items: ensureTrailingBlankItem(nextItems)
      };
    });
  };

  const updateIngredientSelection = (index, ingredientId) => {
    const ingredient = ingredients.find((entry) => entry.id === ingredientId);

    setDraft((previous) => {
      const nextItems = ensureTrailingBlankItem(previous.items).map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              ingredientId,
              usageUnit: ingredient ? ingredient.unit : ""
            }
          : item
      );

      return {
        ...previous,
        items: ensureTrailingBlankItem(nextItems)
      };
    });

    setOverLimitByRow((previous) => ({
      ...previous,
      [index]: false
    }));
  };

  const removeItem = (index) => {
    setDraft((previous) => {
      const nextItems = ensureTrailingBlankItem(previous.items).filter(
        (_, itemIndex) => itemIndex !== index
      );

      if (nextItems.length <= 0) {
        return previous;
      }

      return {
        ...previous,
        items: ensureTrailingBlankItem(nextItems)
      };
    });

    setOverLimitByRow({});
  };

  return (
    <div className="batch-editor">
      <label htmlFor={`${idPrefix}-produced`}>
        Cantidad de postres producidos
        <input
          id={`${idPrefix}-produced`}
          type="number"
          min="1"
          step="1"
          value={draft.producedDesserts}
          onChange={(event) => updateProducedDesserts(event.target.value)}
          placeholder="Ej: 40"
        />
      </label>

      <div className="batch-items">
        <div className="batch-items-header">
          <h4>Ingredientes usados</h4>
        </div>

        {items.map((item, index) => {
          const selectedIngredient = ingredients.find(
            (ingredient) => ingredient.id === item.ingredientId
          );
          const usageUnits = selectedIngredient
            ? getCompatibleUsageUnits(selectedIngredient.unit)
            : [];
          const maxAllowed = getMaxAllowedForItem(items, index, ingredients);
          const currentUsageUnit = item.usageUnit || selectedIngredient?.unit || "";
          const availableLabel = selectedIngredient
            ? `${formatPlainNumber(selectedIngredient.quantityAvailable)} ${selectedIngredient.unit}`
            : "";
          const remainingLabel =
            selectedIngredient && currentUsageUnit && maxAllowed !== null
              ? `${formatPlainNumber(maxAllowed)} ${currentUsageUnit}`
              : "";
          const showOverLimit = Boolean(overLimitByRow[index]);

          return (
            <div key={`${item.ingredientId}-${index}`} className="batch-item-row">
            <label htmlFor={`${idPrefix}-ingredient-${index}`}>
              Ingrediente
              <select
                id={`${idPrefix}-ingredient-${index}`}
                value={item.ingredientId}
                onChange={(event) => updateIngredientSelection(index, event.target.value)}
              >
                <option value="">Selecciona un ingrediente</option>
                {ingredients.map((ingredient) => (
                  <option key={ingredient.id} value={ingredient.id}>
                    {ingredient.name}
                  </option>
                ))}
              </select>
            </label>

            <label htmlFor={`${idPrefix}-quantity-${index}`}>
              Cantidad usada
              <input
                id={`${idPrefix}-quantity-${index}`}
                type="number"
                className={showOverLimit ? "input-over-limit" : ""}
                min="0"
                step="0.01"
                value={item.usedQuantity}
                max={maxAllowed !== null ? Number(maxAllowed.toFixed(6)) : undefined}
                onChange={(event) => updateUsedQuantity(index, event.target.value)}
                placeholder="0"
              />
              {selectedIngredient ? (
                <small className="field-helper">Stock total: {availableLabel}</small>
              ) : null}
              {remainingLabel ? (
                <small className="field-helper">Disponible para esta fila: {remainingLabel}</small>
              ) : null}
              {showOverLimit ? (
                <small className="field-helper error">
                  Superaba el stock disponible y se ajusto automaticamente al maximo permitido.
                </small>
              ) : null}
            </label>

            <label htmlFor={`${idPrefix}-unit-${index}`}>
              Unidad usada
              <select
                id={`${idPrefix}-unit-${index}`}
                value={item.usageUnit || selectedIngredient?.unit || ""}
                onChange={(event) => updateUsageUnit(index, event.target.value)}
                disabled={!selectedIngredient}
              >
                <option value="">Selecciona unidad</option>
                {usageUnits.map((unit) => (
                  <option key={`${item.ingredientId}-${unit}`} value={unit}>
                    {unit}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              className="btn ghost"
              onClick={() => removeItem(index)}
              disabled={items.length <= 1}
            >
              Quitar
            </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
