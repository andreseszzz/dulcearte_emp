import { useMemo, useState } from "react";
import ConfirmModal from "../components/ConfirmModal";
import IngredientFormFields from "../components/IngredientFormFields";
import { EMPTY_INGREDIENT_FORM } from "../data/defaultData";
import { formatCurrency, formatPlainNumber } from "../utils/format";

function getIngredientForm(ingredient) {
  return {
    name: ingredient.name,
    quantityAvailable: String(ingredient.quantityAvailable),
    unit: ingredient.unit,
    pricePerUnit: String(ingredient.pricePerUnit)
  };
}

function getFreshIngredientForm() {
  return { ...EMPTY_INGREDIENT_FORM };
}

export default function InventoryPage({
  ingredients,
  onCreateIngredient,
  onUpdateIngredient,
  onDeleteIngredient,
  onAdjustIngredientStock
}) {
  const [ingredientForm, setIngredientForm] = useState(getFreshIngredientForm);
  const [editingIngredientId, setEditingIngredientId] = useState("");
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [ingredientToDelete, setIngredientToDelete] = useState(null);
  const [ingredientToAdjust, setIngredientToAdjust] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");

  const sortedIngredients = useMemo(
    () => [...ingredients].sort((a, b) => a.name.localeCompare(b.name)),
    [ingredients]
  );

  const updateFormField = (field, value) => {
    setIngredientForm((previous) => ({
      ...previous,
      [field]: value
    }));
  };

  const resetForm = () => {
    setIngredientForm(getFreshIngredientForm());
    setEditingIngredientId("");
  };

  return (
    <section className="page-grid single-gap">
      <article className="card">
        <div className="section-header">
          <div>
            <h2>{editingIngredientId ? "Editar ingrediente" : "Agregar ingrediente"}</h2>
            <p>Todos los cambios se confirman en un modal antes de guardarse.</p>
          </div>
          {editingIngredientId ? (
            <button
              type="button"
              className="btn secondary"
              onClick={resetForm}
              aria-label="Cancelar edicion"
            >
              Cancelar edicion
            </button>
          ) : null}
        </div>

        <form
          className="stack"
          onSubmit={(event) => {
            event.preventDefault();
            setErrorMessage("");
            setShowSaveConfirm(true);
          }}
        >
          <IngredientFormFields values={ingredientForm} onChange={updateFormField} />

          <div className="inline-actions">
            <button type="submit" className="btn primary">
              {editingIngredientId ? "Actualizar" : "Guardar"}
            </button>
            <button type="button" className="btn secondary" onClick={resetForm}>
              Limpiar formulario
            </button>
          </div>
        </form>

        {errorMessage ? <p className="message error">{errorMessage}</p> : null}
      </article>

      <article className="card">
        <div className="section-header">
          <div>
            <h2>Inventario actual</h2>
            <p>Consulta de sobrantes y acciones de ajuste manual de stock.</p>
          </div>
        </div>

        {sortedIngredients.length === 0 ? (
          <p className="message muted">Aun no hay ingredientes registrados.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Ingrediente</th>
                  <th>Cantidad disponible</th>
                  <th>Unidad</th>
                  <th>Precio por unidad</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {sortedIngredients.map((ingredient) => (
                  <tr key={ingredient.id}>
                    <td>{ingredient.name}</td>
                    <td>{formatPlainNumber(ingredient.quantityAvailable)}</td>
                    <td>{ingredient.unit}</td>
                    <td>{formatCurrency(ingredient.pricePerUnit)}</td>
                    <td>
                      <div className="table-actions">
                        <button
                          type="button"
                          className="btn ghost"
                          onClick={() => {
                            setEditingIngredientId(ingredient.id);
                            setIngredientForm(getIngredientForm(ingredient));
                            setErrorMessage("");
                          }}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="btn ghost"
                          onClick={() => {
                            setIngredientToAdjust(ingredient);
                            setErrorMessage("");
                          }}
                        >
                          Ajustar stock
                        </button>
                        <button
                          type="button"
                          className="btn ghost danger-text"
                          onClick={() => {
                            setIngredientToDelete(ingredient);
                            setErrorMessage("");
                          }}
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>

      <ConfirmModal
        isOpen={showSaveConfirm}
        title={editingIngredientId ? "Confirmar actualizacion" : "Confirmar nuevo ingrediente"}
        description="Revisa y ajusta los datos antes de confirmar."
        initialData={ingredientForm}
        renderEditor={({ draft, setDraft }) => (
          <IngredientFormFields
            values={draft}
            onChange={(field, value) =>
              setDraft((previous) => ({
                ...previous,
                [field]: value
              }))
            }
            idPrefix="confirm-ingredient"
          />
        )}
        renderSummary={(draft) => (
          <ul className="summary-list">
            <li>
              <strong>Nombre:</strong> {draft.name || "Sin nombre"}
            </li>
            <li>
              <strong>Cantidad:</strong> {draft.quantityAvailable || "0"} {draft.unit || "g"}
            </li>
            <li>
              <strong>Precio por unidad:</strong> {formatCurrency(draft.pricePerUnit)}
            </li>
          </ul>
        )}
        disableConfirm={(draft) =>
          !draft.name?.trim() ||
          Number.isNaN(Number(draft.quantityAvailable)) ||
          Number(draft.quantityAvailable) < 0 ||
          Number.isNaN(Number(draft.pricePerUnit)) ||
          Number(draft.pricePerUnit) < 0
        }
        confirmLabel={editingIngredientId ? "Confirmar actualizacion" : "Confirmar guardado"}
        onCancel={() => setShowSaveConfirm(false)}
        onConfirm={(draft) => {
          try {
            if (editingIngredientId) {
              onUpdateIngredient(editingIngredientId, draft);
            } else {
              onCreateIngredient(draft);
            }

            setShowSaveConfirm(false);
            resetForm();
          } catch (error) {
            setErrorMessage(error.message || "No se pudo guardar el ingrediente.");
          }
        }}
      />

      <ConfirmModal
        isOpen={Boolean(ingredientToDelete)}
        title="Confirmar eliminacion"
        description="Esta accion eliminara el ingrediente del inventario."
        initialData={{}}
        renderSummary={() => (
          <p>
            Se eliminara <strong>{ingredientToDelete?.name}</strong>. Esta operacion no se puede deshacer.
          </p>
        )}
        confirmStyle="danger"
        confirmLabel="Eliminar ingrediente"
        onCancel={() => setIngredientToDelete(null)}
        onConfirm={() => {
          if (!ingredientToDelete) {
            return;
          }

          onDeleteIngredient(ingredientToDelete.id);
          setIngredientToDelete(null);

          if (editingIngredientId === ingredientToDelete.id) {
            resetForm();
          }
        }}
      />

      <ConfirmModal
        isOpen={Boolean(ingredientToAdjust)}
        title="Confirmar ajuste de stock"
        description="Puedes corregir el stock antes de aplicar el cambio."
        initialData={{
          quantityAvailable: ingredientToAdjust ? String(ingredientToAdjust.quantityAvailable) : ""
        }}
        renderEditor={({ draft, setDraft }) => (
          <label htmlFor="adjust-stock-field">
            Nuevo stock disponible ({ingredientToAdjust?.unit || "g"})
            <input
              id="adjust-stock-field"
              type="number"
              min="0"
              step="0.01"
              value={draft.quantityAvailable}
              onChange={(event) =>
                setDraft((previous) => ({
                  ...previous,
                  quantityAvailable: event.target.value
                }))
              }
            />
          </label>
        )}
        renderSummary={(draft) => (
          <ul className="summary-list">
            <li>
              <strong>Ingrediente:</strong> {ingredientToAdjust?.name}
            </li>
            <li>
              <strong>Stock actual:</strong> {ingredientToAdjust?.quantityAvailable} {ingredientToAdjust?.unit}
            </li>
            <li>
              <strong>Nuevo stock:</strong> {draft.quantityAvailable || "0"} {ingredientToAdjust?.unit}
            </li>
          </ul>
        )}
        disableConfirm={(draft) =>
          Number.isNaN(Number(draft.quantityAvailable)) || Number(draft.quantityAvailable) < 0
        }
        confirmLabel="Confirmar ajuste"
        onCancel={() => setIngredientToAdjust(null)}
        onConfirm={(draft) => {
          if (!ingredientToAdjust) {
            return;
          }

          try {
            onAdjustIngredientStock(ingredientToAdjust.id, draft.quantityAvailable);
            setIngredientToAdjust(null);
          } catch (error) {
            setErrorMessage(error.message || "No se pudo ajustar el stock.");
          }
        }}
      />
    </section>
  );
}
