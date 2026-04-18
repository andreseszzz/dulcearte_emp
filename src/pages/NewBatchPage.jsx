import { useState } from "react";
import BatchEditorFields from "../components/BatchEditorFields";
import ConfirmModal from "../components/ConfirmModal";
import { EMPTY_BATCH_DRAFT } from "../data/defaultData";
import { getBatchPreview } from "../utils/batchCalculations";
import { formatCurrency, formatPlainNumber } from "../utils/format";

function getFreshBatchDraft() {
  return {
    ...EMPTY_BATCH_DRAFT,
    items: [{ ingredientId: "", usedQuantity: "" }]
  };
}

export default function NewBatchPage({ ingredients, onRegisterBatch, latestBatch }) {
  const [batchDraft, setBatchDraft] = useState(getFreshBatchDraft);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const directPreview = getBatchPreview(batchDraft, ingredients);

  return (
    <section className="page-grid single-gap">
      <article className="card">
        <div className="section-header">
          <div>
            <h2>Registro de tanda de produccion</h2>
            <p>
              Selecciona ingredientes usados y cantidad de postres. El inventario solo se descuenta
              despues de confirmar el modal.
            </p>
          </div>
        </div>

        {ingredients.length === 0 ? (
          <p className="message warning">
            Debes registrar ingredientes en inventario antes de crear una tanda.
          </p>
        ) : null}

        <form
          className="stack"
          onSubmit={(event) => {
            event.preventDefault();
            setErrorMessage("");
            setShowConfirm(true);
          }}
        >
          <BatchEditorFields
            draft={batchDraft}
            setDraft={setBatchDraft}
            ingredients={ingredients}
            idPrefix="create-batch"
          />

          {directPreview.errors.length > 0 ? (
            <div className="message warning">
              {directPreview.errors.map((error) => (
                <p key={error}>{error}</p>
              ))}
            </div>
          ) : null}

          <div className="inline-actions">
            <button type="submit" className="btn primary" disabled={ingredients.length === 0}>
              Registrar tanda
            </button>
            <button
              type="button"
              className="btn secondary"
              onClick={() => {
                setBatchDraft(getFreshBatchDraft());
                setErrorMessage("");
              }}
            >
              Reiniciar formulario
            </button>
          </div>
        </form>

        {errorMessage ? <p className="message error">{errorMessage}</p> : null}
      </article>

      {latestBatch ? (
        <article className="card compact">
          <h3>Ultima tanda registrada</h3>
          <p>
            <strong>Postres:</strong> {latestBatch.producedDesserts}
          </p>
          <p>
            <strong>Costo total:</strong> {formatCurrency(latestBatch.totalCost)}
          </p>
          <p>
            <strong>Costo unitario:</strong> {formatCurrency(latestBatch.unitCost)}
          </p>
        </article>
      ) : null}

      <ConfirmModal
        isOpen={showConfirm}
        title="Confirmar registro de tanda"
        description="Ajusta cantidades, postres o ingredientes antes de confirmar."
        initialData={batchDraft}
        renderEditor={({ draft, setDraft }) => (
          <BatchEditorFields
            draft={draft}
            setDraft={setDraft}
            ingredients={ingredients}
            idPrefix="confirm-batch"
          />
        )}
        renderSummary={(draft) => {
          const preview = getBatchPreview(draft, ingredients);

          return (
            <div className="stack">
              {preview.errors.length > 0 ? (
                <div className="message warning">
                  {preview.errors.map((error) => (
                    <p key={error}>{error}</p>
                  ))}
                </div>
              ) : null}

              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Ingrediente</th>
                      <th>Cantidad usada</th>
                      <th>Costo parcial</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.items.map((item) => (
                      <tr key={item.ingredientId}>
                        <td>{item.name}</td>
                        <td>
                          {formatPlainNumber(item.usedQuantity)} {item.unit}
                        </td>
                        <td>{formatCurrency(item.partialCost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <ul className="summary-list">
                <li>
                  <strong>Costo total de tanda:</strong> {formatCurrency(preview.totalCost)}
                </li>
                <li>
                  <strong>Postres producidos:</strong> {formatPlainNumber(preview.producedDesserts, 0)}
                </li>
                <li>
                  <strong>Costo unitario:</strong> {formatCurrency(preview.unitCost)}
                </li>
              </ul>
            </div>
          );
        }}
        disableConfirm={(draft) => getBatchPreview(draft, ingredients).errors.length > 0}
        confirmLabel="Confirmar tanda"
        onCancel={() => setShowConfirm(false)}
        onConfirm={(draft) => {
          try {
            onRegisterBatch(draft);
            setBatchDraft(getFreshBatchDraft());
            setShowConfirm(false);
          } catch (error) {
            setErrorMessage(error.message || "No se pudo registrar la tanda.");
          }
        }}
      />
    </section>
  );
}
