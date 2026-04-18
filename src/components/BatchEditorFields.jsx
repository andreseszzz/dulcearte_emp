const EMPTY_ITEM = { ingredientId: "", usedQuantity: "" };

export default function BatchEditorFields({ draft, setDraft, ingredients, idPrefix = "batch" }) {
  const items = draft.items || [EMPTY_ITEM];

  const updateProducedDesserts = (value) => {
    setDraft((previous) => ({
      ...previous,
      producedDesserts: value
    }));
  };

  const updateItem = (index, field, value) => {
    setDraft((previous) => ({
      ...previous,
      items: previous.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      )
    }));
  };

  const addItem = () => {
    setDraft((previous) => ({
      ...previous,
      items: [...previous.items, { ...EMPTY_ITEM }]
    }));
  };

  const removeItem = (index) => {
    setDraft((previous) => {
      if (previous.items.length <= 1) {
        return previous;
      }

      return {
        ...previous,
        items: previous.items.filter((_, itemIndex) => itemIndex !== index)
      };
    });
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
          <button type="button" className="btn secondary" onClick={addItem}>
            + Agregar ingrediente
          </button>
        </div>

        {items.map((item, index) => (
          <div key={`${item.ingredientId}-${index}`} className="batch-item-row">
            <label htmlFor={`${idPrefix}-ingredient-${index}`}>
              Ingrediente
              <select
                id={`${idPrefix}-ingredient-${index}`}
                value={item.ingredientId}
                onChange={(event) => updateItem(index, "ingredientId", event.target.value)}
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
                min="0"
                step="0.01"
                value={item.usedQuantity}
                onChange={(event) => updateItem(index, "usedQuantity", event.target.value)}
                placeholder="0"
              />
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
        ))}
      </div>
    </div>
  );
}
