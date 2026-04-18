import { useMemo, useState } from "react";
import ConfirmModal from "../components/ConfirmModal";
import { formatCurrency, formatDateTime, formatPlainNumber } from "../utils/format";

export default function ReportsPage({ batches, users, onAssociateUserToBatch }) {
  const [selectedUserByBatch, setSelectedUserByBatch] = useState({});
  const [associationDraft, setAssociationDraft] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");

  const usersById = useMemo(() => {
    return users.reduce((accumulator, user) => {
      accumulator[user.id] = user;
      return accumulator;
    }, {});
  }, [users]);

  return (
    <section className="page-grid single-gap">
      <article className="card">
        <div className="section-header">
          <div>
            <h2>Informes por tanda</h2>
            <p>Vista de consulta de costos, rendimiento y clientes asociados.</p>
          </div>
        </div>

        {batches.length === 0 ? (
          <p className="message muted">Aun no hay tandas registradas.</p>
        ) : (
          <div className="stack">
            {batches.map((batch) => {
              const assignedUsers = (batch.assignedUserIds || [])
                .map((id) => usersById[id])
                .filter(Boolean);

              return (
                <article key={batch.id} className="report-card">
                  <div className="report-header">
                    <div>
                      <h3>Tanda #{batch.id.slice(-6)}</h3>
                      <p>{formatDateTime(batch.createdAt)}</p>
                    </div>
                    <div className="report-kpis">
                      <p>
                        <strong>Postres:</strong> {formatPlainNumber(batch.producedDesserts, 0)}
                      </p>
                      <p>
                        <strong>Total:</strong> {formatCurrency(batch.totalCost)}
                      </p>
                      <p>
                        <strong>Unitario:</strong> {formatCurrency(batch.unitCost)}
                      </p>
                    </div>
                  </div>

                  <div className="table-wrap">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Ingrediente</th>
                          <th>Cantidad usada</th>
                          <th>Precio unidad</th>
                          <th>Costo parcial</th>
                        </tr>
                      </thead>
                      <tbody>
                        {batch.items.map((item) => (
                          <tr key={`${batch.id}-${item.ingredientId}`}>
                            <td>{item.name}</td>
                            <td>
                              {formatPlainNumber(item.usedQuantity)} {item.unit}
                            </td>
                            <td>{formatCurrency(item.unitPrice)}</td>
                            <td>{formatCurrency(item.partialCost)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="report-association">
                    <div>
                      <h4>Usuarios asociados</h4>
                      {assignedUsers.length === 0 ? (
                        <p className="message muted">Sin usuarios asociados.</p>
                      ) : (
                        <div className="chips-wrap">
                          {assignedUsers.map((user) => (
                            <span key={user.id} className="chip">
                              {user.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="inline-actions wrap">
                      <select
                        value={selectedUserByBatch[batch.id] || ""}
                        onChange={(event) =>
                          setSelectedUserByBatch((previous) => ({
                            ...previous,
                            [batch.id]: event.target.value
                          }))
                        }
                        disabled={users.length === 0}
                      >
                        <option value="">
                          {users.length === 0 ? "No hay usuarios" : "Selecciona usuario"}
                        </option>
                        {users.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.name}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        className="btn secondary"
                        disabled={!selectedUserByBatch[batch.id]}
                        onClick={() => {
                          setErrorMessage("");
                          setAssociationDraft({
                            batchId: batch.id,
                            userId: selectedUserByBatch[batch.id] || ""
                          });
                        }}
                      >
                        Asociar usuario a tanda
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {errorMessage ? <p className="message error">{errorMessage}</p> : null}
      </article>

      <ConfirmModal
        isOpen={Boolean(associationDraft)}
        title="Confirmar asociacion usuario-tanda"
        description="Puedes cambiar el usuario seleccionado antes de confirmar."
        initialData={associationDraft || { batchId: "", userId: "" }}
        renderEditor={({ draft, setDraft }) => (
          <label htmlFor="associate-user-select">
            Usuario a asociar
            <select
              id="associate-user-select"
              value={draft.userId}
              onChange={(event) =>
                setDraft((previous) => ({
                  ...previous,
                  userId: event.target.value
                }))
              }
            >
              <option value="">Selecciona usuario</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </label>
        )}
        renderSummary={(draft) => {
          const batch = batches.find((entry) => entry.id === draft.batchId);
          const user = users.find((entry) => entry.id === draft.userId);

          return (
            <ul className="summary-list">
              <li>
                <strong>Tanda:</strong> {batch ? `#${batch.id.slice(-6)}` : "No encontrada"}
              </li>
              <li>
                <strong>Usuario:</strong> {user ? user.name : "Sin seleccionar"}
              </li>
              <li>
                <strong>Costo tanda:</strong> {batch ? formatCurrency(batch.totalCost) : "-"}
              </li>
            </ul>
          );
        }}
        disableConfirm={(draft) => !draft.userId || !draft.batchId}
        confirmLabel="Confirmar asociacion"
        onCancel={() => setAssociationDraft(null)}
        onConfirm={(draft) => {
          try {
            onAssociateUserToBatch(draft.batchId, draft.userId);
            setAssociationDraft(null);
            setSelectedUserByBatch((previous) => ({
              ...previous,
              [draft.batchId]: ""
            }));
          } catch (error) {
            setErrorMessage(error.message || "No se pudo asociar el usuario.");
          }
        }}
      />
    </section>
  );
}
