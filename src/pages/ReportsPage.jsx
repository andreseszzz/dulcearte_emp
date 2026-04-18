import { useEffect, useMemo, useRef, useState } from "react";
import ConfirmModal from "../components/ConfirmModal";
import { ASSIGNMENT_SELECTION_OPTIONS } from "../data/defaultData";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { formatCurrency, formatDateTime, formatPlainNumber, toNumber } from "../utils/format";

const DEFAULT_SELECTION_TYPE = "Limon";
const BATCH_DELETE_UNDO_MS = 5000;
const ASSIGNMENT_SELECTION_VALUES = new Set(
  ASSIGNMENT_SELECTION_OPTIONS.map((option) => option.value)
);

function normalizeSelectionType(selectionType, fallback = DEFAULT_SELECTION_TYPE) {
  const value = String(selectionType || "").trim();

  if (value === "Galleta") {
    return "Solo galleta";
  }

  return ASSIGNMENT_SELECTION_VALUES.has(value) ? value : fallback;
}

function mapPreferredFlavorToSelectionType(preferredFlavor) {
  const value = String(preferredFlavor || "").trim();

  if (value === "Galleta") {
    return "Solo galleta";
  }

  if (value === "Ambos") {
    return DEFAULT_SELECTION_TYPE;
  }

  return normalizeSelectionType(value, DEFAULT_SELECTION_TYPE);
}

function getSelectionLabel(selectionType) {
  const option = ASSIGNMENT_SELECTION_OPTIONS.find(
    (entry) => entry.value === normalizeSelectionType(selectionType)
  );

  return option ? option.label : selectionType;
}

function isCookieOnlySelection(selectionType) {
  return normalizeSelectionType(selectionType) === "Solo galleta";
}

function isMainDessertSelection(selectionType) {
  return !isCookieOnlySelection(selectionType);
}

function getCookieOnlyUnitCost(batch) {
  const storedCookieUnitCost = toNumber(batch.cookieUnitCost);
  if (storedCookieUnitCost > 0) {
    return storedCookieUnitCost;
  }

  const galletaCost = (batch.items || [])
    .filter(
      (item) => item.affectsCookieCost || String(item.name || "").toLowerCase().includes("galleta")
    )
    .reduce((sum, item) => sum + toNumber(item.partialCost), 0);

  const producedDesserts = toNumber(batch.producedDesserts);
  if (producedDesserts <= 0) {
    return 0;
  }

  return galletaCost / producedDesserts;
}

function calculateProfitPercentage(costPerUnit, salePricePerUnit) {
  const normalizedCost = Math.max(toNumber(costPerUnit), 0);
  const normalizedSalePrice = Math.max(toNumber(salePricePerUnit), 0);

  if (normalizedCost <= 0) {
    return 0;
  }

  return ((normalizedSalePrice - normalizedCost) / normalizedCost) * 100;
}

function resolveAssignedEntries(batch, usersById) {
  return (batch.assignedUsers || [])
    .map((entry, assignmentIndex) => ({
      ...entry,
      assignmentIndex,
      user: usersById[entry.userId],
      dessertsSelected: Math.max(Math.floor(toNumber(entry.dessertsSelected)), 0),
      selectionType: normalizeSelectionType(
        entry.selectionType,
        mapPreferredFlavorToSelectionType(usersById[entry.userId]?.preferredFlavor)
      )
    }))
    .filter((entry) => Boolean(entry.user));
}

function getAssignmentMetrics(batch, assignedEntries) {
  const producedDesserts = toNumber(batch.producedDesserts);
  const mainDessertsAssigned = assignedEntries.reduce(
    (sum, entry) =>
      isMainDessertSelection(entry.selectionType) ? sum + toNumber(entry.dessertsSelected) : sum,
    0
  );
  const cookieOnlyUnits = assignedEntries.reduce(
    (sum, entry) =>
      isCookieOnlySelection(entry.selectionType) ? sum + toNumber(entry.dessertsSelected) : sum,
    0
  );
  const totalAssignedUnits = mainDessertsAssigned + cookieOnlyUnits;
  const remainingDesserts = Math.max(producedDesserts - totalAssignedUnits, 0);

  return {
    producedDesserts,
    mainDessertsAssigned,
    cookieOnlyUnits,
    totalAssignedUnits,
    remainingDesserts,
    exceedsProduction: totalAssignedUnits > producedDesserts
  };
}

function getBatchFinancialSummary(batch, metrics, saleDraft) {
  const dessertSalePrice = Math.max(toNumber(saleDraft?.dessertSalePrice), 0);
  const cookieSalePrice = Math.max(toNumber(saleDraft?.cookieSalePrice), 0);
  const dessertUnitCost = Math.max(toNumber(batch?.unitCost), 0);
  const cookieUnitCost = Math.max(toNumber(getCookieOnlyUnitCost(batch)), 0);
  const dessertProfitPerUnit = dessertSalePrice - dessertUnitCost;
  const cookieProfitPerUnit = cookieSalePrice - cookieUnitCost;
  const dessertProfitPct = calculateProfitPercentage(dessertUnitCost, dessertSalePrice);
  const cookieProfitPct = calculateProfitPercentage(cookieUnitCost, cookieSalePrice);
  const estimatedRevenue =
    dessertSalePrice * toNumber(metrics?.mainDessertsAssigned) +
    cookieSalePrice * toNumber(metrics?.cookieOnlyUnits);
  const estimatedCost =
    dessertUnitCost * toNumber(metrics?.mainDessertsAssigned) +
    cookieUnitCost * toNumber(metrics?.cookieOnlyUnits);
  const estimatedProfit = estimatedRevenue - estimatedCost;
  const estimatedProfitPct = estimatedCost > 0 ? (estimatedProfit / estimatedCost) * 100 : 0;

  return {
    dessertSalePrice,
    cookieSalePrice,
    dessertUnitCost,
    cookieUnitCost,
    dessertProfitPerUnit,
    cookieProfitPerUnit,
    dessertProfitPct,
    cookieProfitPct,
    estimatedRevenue,
    estimatedCost,
    estimatedProfit,
    estimatedProfitPct
  };
}

export default function ReportsPage({
  batches,
  users,
  onAssociateUserToBatch,
  onUpdateBatchAssignment,
  onDeleteBatchAssignment,
  onDeleteBatch,
  onRestoreBatch
}) {
  const [selectedUserByBatch, setSelectedUserByBatch] = useState({});
  const [selectedDessertsByBatch, setSelectedDessertsByBatch] = useState({});
  const [selectedSelectionByBatch, setSelectedSelectionByBatch] = useState({});
  const [salePricesByBatch, setSalePricesByBatch] = useLocalStorage(
    "dulcearte.salePricesByBatch",
    {}
  );
  const [assignmentToEdit, setAssignmentToEdit] = useState(null);
  const [assignmentToDelete, setAssignmentToDelete] = useState(null);
  const [batchToDelete, setBatchToDelete] = useState(null);
  const [deletedBatchUndo, setDeletedBatchUndo] = useState(null);
  const [associationDraft, setAssociationDraft] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const undoTimeoutRef = useRef(null);

  const clearUndoTimer = () => {
    if (!undoTimeoutRef.current) {
      return;
    }

    clearTimeout(undoTimeoutRef.current);
    undoTimeoutRef.current = null;
  };

  useEffect(() => {
    return () => {
      clearUndoTimer();
    };
  }, []);

  useEffect(() => {
    setSalePricesByBatch((previous) => {
      const safePrevious = previous && typeof previous === "object" ? previous : {};
      const validBatchIds = new Set((batches || []).map((batch) => batch.id));
      let changed = false;
      const next = {};

      Object.entries(safePrevious).forEach(([batchId, values]) => {
        if (validBatchIds.has(batchId)) {
          next[batchId] = values;
          return;
        }

        changed = true;
      });

      return changed ? next : safePrevious;
    });
  }, [batches, setSalePricesByBatch]);

  const updateBatchSalePrice = (batchId, field, value) => {
    setSalePricesByBatch((previous) => ({
      ...(previous || {}),
      [batchId]: {
        ...((previous || {})[batchId] || {}),
        [field]: value
      }
    }));
  };

  const clearBatchSalePrices = (batchId) => {
    setSalePricesByBatch((previous) => {
      const safePrevious = previous && typeof previous === "object" ? previous : {};
      if (!Object.prototype.hasOwnProperty.call(safePrevious, batchId)) {
        return safePrevious;
      }

      const next = { ...safePrevious };
      delete next[batchId];
      return next;
    });
  };

  const usersById = useMemo(() => {
    return users.reduce((accumulator, user) => {
      accumulator[user.id] = user;
      return accumulator;
    }, {});
  }, [users]);

  const handleExportPdf = async (targetBatches, fileNameSuffix) => {
    setErrorMessage("");

    if (!targetBatches || targetBatches.length === 0) {
      setErrorMessage("No hay tandas para exportar en PDF.");
      return;
    }

    try {
      const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable")
      ]);

      const pdf = new jsPDF({ unit: "pt", format: "a4" });

      targetBatches.forEach((batch, batchIndex) => {
        if (batchIndex > 0) {
          pdf.addPage();
        }

        const assignedEntries = resolveAssignedEntries(batch, usersById);
        const metrics = getAssignmentMetrics(batch, assignedEntries);
        const saleDraft = salePricesByBatch[batch.id] || {};
        const financial = getBatchFinancialSummary(batch, metrics, saleDraft);
        const marginX = 40;

        pdf.setFontSize(16);
        pdf.text(`Informe Tanda #${String(batch.id).slice(-6)}`, marginX, 42);

        pdf.setFontSize(10);
        pdf.text(`Fecha: ${formatDateTime(batch.createdAt)}`, marginX, 62);
        pdf.text(
          `Postres: ${formatPlainNumber(batch.producedDesserts, 0)} | Costo total: ${formatCurrency(batch.totalCost)} | Costo unitario postre main: ${formatCurrency(batch.unitCost)} | Costo unitario galleta: ${formatCurrency(financial.cookieUnitCost)}`,
          marginX,
          78
        );

        autoTable(pdf, {
          startY: 96,
          head: [["Ingrediente", "Cantidad", "Precio unidad", "Costo parcial"]],
          body: (batch.items || []).map((item) => {
            const appliedQuantity = `${formatPlainNumber(item.usedQuantity)} ${item.unit}`;
            const inputSummary = item.inputSummary || appliedQuantity;

            return [
              item.name,
              inputSummary === appliedQuantity
                ? appliedQuantity
                : `${inputSummary} (Aplicado: ${appliedQuantity})`,
              formatCurrency(item.unitPrice),
              formatCurrency(item.partialCost)
            ];
          }),
          styles: { fontSize: 9 },
          headStyles: { fillColor: [47, 150, 143] },
          margin: { left: marginX, right: marginX }
        });

        const afterIngredientsY = (pdf.lastAutoTable?.finalY || 120) + 18;

        pdf.setFontSize(11);
        pdf.text("Asignacion de postres por usuario", marginX, afterIngredientsY);

        autoTable(pdf, {
          startY: afterIngredientsY + 8,
          head: [["Usuario", "Eleccion", "Postres elegidos"]],
          body:
            assignedEntries.length > 0
              ? assignedEntries.map((entry) => [
                  entry.user.name,
                  getSelectionLabel(entry.selectionType),
                  formatPlainNumber(entry.dessertsSelected, 0)
                ])
              : [["Sin usuarios asociados", "-", "0"]],
          styles: { fontSize: 9 },
          headStyles: { fillColor: [85, 201, 192] },
          margin: { left: marginX, right: marginX }
        });

        const afterUsersY = (pdf.lastAutoTable?.finalY || afterIngredientsY + 24) + 18;
        pdf.setFontSize(10);
        pdf.text(
          `Asignados totales: ${formatPlainNumber(metrics.totalAssignedUnits, 0)} / ${formatPlainNumber(metrics.producedDesserts, 0)} | Postre main: ${formatPlainNumber(metrics.mainDessertsAssigned, 0)} | Galleta: ${formatPlainNumber(metrics.cookieOnlyUnits, 0)} | Disponibles: ${formatPlainNumber(metrics.remainingDesserts, 0)}`,
          marginX,
          afterUsersY
        );
        pdf.text(
          `Venta postre: ${formatCurrency(financial.dessertSalePrice)} (${formatPlainNumber(financial.dessertProfitPct, 2)}%) | Venta galleta: ${formatCurrency(financial.cookieSalePrice)} (${formatPlainNumber(financial.cookieProfitPct, 2)}%)`,
          marginX,
          afterUsersY + 14
        );
        pdf.text(
          `Ganancia total estimada: ${formatCurrency(financial.estimatedProfit)} (${formatPlainNumber(financial.estimatedProfitPct, 2)}%)`,
          marginX,
          afterUsersY + 28
        );
      });

      const exportDate = new Date().toISOString().slice(0, 10);
      const safeSuffix = String(fileNameSuffix || "informes").replace(/\s+/g, "-").toLowerCase();
      pdf.save(`dulcearte-${safeSuffix}-${exportDate}.pdf`);
    } catch (error) {
      setErrorMessage("No se pudo generar el PDF de informes.");
    }
  };

  return (
    <section className="page-grid single-gap">
      <article className="card">
        <div className="section-header">
          <div>
            <h2>Informes por tanda</h2>
            <p>Vista de consulta de costos, rendimiento y clientes asociados.</p>
          </div>
          <div className="inline-actions">
            <button
              type="button"
              className="btn secondary"
              onClick={() => handleExportPdf(batches, "informes")}
              disabled={batches.length === 0}
            >
              Exportar todos los informes a PDF
            </button>
          </div>
        </div>

        {batches.length === 0 ? (
          <p className="message muted">Aun no hay tandas registradas.</p>
        ) : (
          <div className="stack">
            {batches.map((batch, batchIndex) => {
              const assignedEntries = resolveAssignedEntries(batch, usersById);
              const metrics = getAssignmentMetrics(batch, assignedEntries);
              const saleDraft = salePricesByBatch[batch.id] || {};
              const financial = getBatchFinancialSummary(batch, metrics, saleDraft);

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
                        <strong>Unitario postre main:</strong> {formatCurrency(batch.unitCost)}
                      </p>
                      <p>
                        <strong>Unitario galleta:</strong> {formatCurrency(financial.cookieUnitCost)}
                      </p>
                    </div>
                    <div className="inline-actions">
                      <button
                        type="button"
                        className="btn secondary"
                        onClick={() => handleExportPdf([batch], `informe-tanda-${batch.id.slice(-6)}`)}
                      >
                        Exportar esta tanda a PDF
                      </button>
                      <button
                        type="button"
                        className="btn ghost danger-text"
                        onClick={() => {
                          setErrorMessage("");
                          setBatchToDelete({
                            batch,
                            batchIndex,
                            saleDraft
                          });
                        }}
                      >
                        Eliminar tanda
                      </button>
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
                        {batch.items.map((item) => {
                          const appliedQuantity = `${formatPlainNumber(item.usedQuantity)} ${item.unit}`;
                          const inputSummary = item.inputSummary || appliedQuantity;
                          const showsConversion = inputSummary !== appliedQuantity;

                          return (
                            <tr key={`${batch.id}-${item.ingredientId}`}>
                              <td>{item.name}</td>
                              <td>
                                <div className="stacked-cell">
                                  <span>{inputSummary}</span>
                                  {showsConversion ? (
                                    <small className="cell-note">Aplicado: {appliedQuantity}</small>
                                  ) : null}
                                </div>
                              </td>
                              <td>{formatCurrency(item.unitPrice)}</td>
                              <td>{formatCurrency(item.partialCost)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="report-association">
                    <div>
                      <h4>Usuarios asociados</h4>
                      {assignedEntries.length === 0 ? (
                        <p className="message muted">Sin usuarios asociados.</p>
                      ) : (
                        <div className="chips-wrap">
                          {assignedEntries.map((entry, index) => (
                            <span key={`${entry.userId}-${entry.selectionType}-${index}`} className="chip">
                              {entry.user.name}: {formatPlainNumber(entry.dessertsSelected, 0)}
                              {" "}
                              ({getSelectionLabel(entry.selectionType)})
                            </span>
                          ))}
                        </div>
                      )}
                      {assignedEntries.length > 0 ? (
                        <div className="table-wrap">
                          <table className="table compact-table">
                            <thead>
                              <tr>
                                <th>Usuario</th>
                                <th>Eleccion</th>
                                <th>Postres elegidos</th>
                                <th>Acciones</th>
                              </tr>
                            </thead>
                            <tbody>
                              {assignedEntries.map((entry, index) => (
                                <tr key={`${batch.id}-${entry.userId}-${entry.selectionType}-${index}-cost`}>
                                  <td>{entry.user.name}</td>
                                  <td>{getSelectionLabel(entry.selectionType)}</td>
                                  <td>{formatPlainNumber(entry.dessertsSelected, 0)}</td>
                                  <td>
                                    <div className="table-actions">
                                      <button
                                        type="button"
                                        className="btn ghost"
                                        onClick={() => {
                                          setErrorMessage("");
                                          setAssignmentToEdit({
                                            batchId: batch.id,
                                            assignmentIndex: entry.assignmentIndex,
                                            userId: entry.userId,
                                            userName: entry.user.name,
                                            dessertsSelected: String(entry.dessertsSelected),
                                            selectionType: entry.selectionType
                                          });
                                        }}
                                      >
                                        Editar
                                      </button>
                                      <button
                                        type="button"
                                        className="btn ghost danger-text"
                                        onClick={() => {
                                          setErrorMessage("");
                                          setAssignmentToDelete({
                                            batchId: batch.id,
                                            assignmentIndex: entry.assignmentIndex,
                                            userName: entry.user.name,
                                            dessertsSelected: entry.dessertsSelected,
                                            selectionType: entry.selectionType
                                          });
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
                      ) : null}
                      <p className="message muted">
                        Asignados totales (postre + galleta): {formatPlainNumber(metrics.totalAssignedUnits, 0)} / Produccion:
                        {" "}
                        {formatPlainNumber(batch.producedDesserts, 0)}
                        {" "}
                        (Disponibles: {formatPlainNumber(metrics.remainingDesserts, 0)})
                      </p>
                      <p className="message muted">
                        Postre main: {formatPlainNumber(metrics.mainDessertsAssigned, 0)} | Galleta: {formatPlainNumber(metrics.cookieOnlyUnits, 0)}
                      </p>
                      {metrics.exceedsProduction ? (
                        <p className="message warning">
                          La asignacion actual supera los postres producidos de esta tanda.
                        </p>
                      ) : null}

                      <div className="form-grid two-columns">
                        <label htmlFor={`${batch.id}-dessert-sale-price`}>
                          Precio de venta postre (unidad)
                          <input
                            id={`${batch.id}-dessert-sale-price`}
                            type="number"
                            min="0"
                            step="0.01"
                            value={saleDraft.dessertSalePrice || ""}
                            onChange={(event) =>
                              updateBatchSalePrice(batch.id, "dessertSalePrice", event.target.value)
                            }
                            placeholder="0"
                          />
                        </label>

                        <label htmlFor={`${batch.id}-cookie-sale-price`}>
                          Precio de venta galleta (unidad)
                          <input
                            id={`${batch.id}-cookie-sale-price`}
                            type="number"
                            min="0"
                            step="0.01"
                            value={saleDraft.cookieSalePrice || ""}
                            onChange={(event) =>
                              updateBatchSalePrice(batch.id, "cookieSalePrice", event.target.value)
                            }
                            placeholder="0"
                          />
                        </label>
                      </div>

                      <div className="inline-actions">
                        <button
                          type="button"
                          className="btn ghost"
                          onClick={() => clearBatchSalePrices(batch.id)}
                          disabled={!saleDraft.dessertSalePrice && !saleDraft.cookieSalePrice}
                        >
                          Limpiar precios de venta
                        </button>
                      </div>

                      <ul className="summary-list">
                        <li>
                          <strong>Ganancia por unidad postre:</strong>
                          {" "}
                          {formatCurrency(financial.dessertProfitPerUnit)}
                          {" "}
                          ({formatPlainNumber(financial.dessertProfitPct, 2)}%)
                        </li>
                        <li>
                          <strong>Ganancia por unidad galleta:</strong>
                          {" "}
                          {formatCurrency(financial.cookieProfitPerUnit)}
                          {" "}
                          ({formatPlainNumber(financial.cookieProfitPct, 2)}%)
                        </li>
                        <li>
                          <strong>Ganancia total estimada:</strong>
                          {" "}
                          {formatCurrency(financial.estimatedProfit)}
                          {" "}
                          ({formatPlainNumber(financial.estimatedProfitPct, 2)}%)
                        </li>
                      </ul>
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

                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={selectedDessertsByBatch[batch.id] || "1"}
                        onChange={(event) =>
                          setSelectedDessertsByBatch((previous) => ({
                            ...previous,
                            [batch.id]: event.target.value
                          }))
                        }
                        placeholder="Postres"
                        disabled={users.length === 0}
                      />

                      <select
                        value={selectedSelectionByBatch[batch.id] || DEFAULT_SELECTION_TYPE}
                        onChange={(event) =>
                          setSelectedSelectionByBatch((previous) => ({
                            ...previous,
                            [batch.id]: event.target.value
                          }))
                        }
                        disabled={users.length === 0}
                      >
                        {ASSIGNMENT_SELECTION_OPTIONS.map((option) => (
                          <option key={`${batch.id}-${option.value}`} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        className="btn secondary"
                        disabled={!selectedUserByBatch[batch.id]}
                        onClick={() => {
                          setErrorMessage("");
                          const selectedUserId = selectedUserByBatch[batch.id] || "";

                          setAssociationDraft({
                            batchId: batch.id,
                            userId: selectedUserId,
                            dessertsSelected: selectedDessertsByBatch[batch.id] || "1",
                            selectionType:
                              selectedSelectionByBatch[batch.id] ||
                              mapPreferredFlavorToSelectionType(usersById[selectedUserId]?.preferredFlavor)
                          });
                        }}
                      >
                        Agregar seleccion para usuario
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {errorMessage ? <p className="message error">{errorMessage}</p> : null}

        {deletedBatchUndo ? (
          <div className="undo-toast" role="status" aria-live="polite">
            <div className="undo-toast-content">
              <strong>Tanda eliminada</strong>
              <p>
                Se eliminó la tanda #{deletedBatchUndo.batch.id.slice(-6)}. Puedes deshacer en 5
                segundos.
              </p>
            </div>
            <div className="undo-toast-actions">
              <button
                type="button"
                className="btn secondary"
                onClick={() => {
                  try {
                    onRestoreBatch(deletedBatchUndo.batch, deletedBatchUndo.batchIndex);

                    if (deletedBatchUndo.saleDraft) {
                      setSalePricesByBatch((previous) => ({
                        ...(previous || {}),
                        [deletedBatchUndo.batch.id]: deletedBatchUndo.saleDraft
                      }));
                    }

                    clearUndoTimer();
                    setDeletedBatchUndo(null);
                    setErrorMessage("");
                  } catch (error) {
                    setErrorMessage(error.message || "No se pudo restaurar la tanda eliminada.");
                  }
                }}
              >
                Deshacer
              </button>
            </div>
            <span key={deletedBatchUndo.toastId} className="undo-toast-progress" />
          </div>
        ) : null}
      </article>

      <ConfirmModal
        isOpen={Boolean(batchToDelete)}
        title="Eliminar tanda"
        description="Esta accion eliminara permanentemente la tanda seleccionada."
        initialData={{}}
        renderSummary={() => (
          <ul className="summary-list">
            <li>
              <strong>Tanda:</strong>
              {" "}
              {batchToDelete?.batch ? `#${batchToDelete.batch.id.slice(-6)}` : "-"}
            </li>
            <li>
              <strong>Fecha:</strong>
              {" "}
              {batchToDelete?.batch ? formatDateTime(batchToDelete.batch.createdAt) : "-"}
            </li>
            <li>
              <strong>Postres producidos:</strong>
              {" "}
              {formatPlainNumber(batchToDelete?.batch?.producedDesserts || 0, 0)}
            </li>
            <li>
              <strong>Costo total:</strong> {formatCurrency(batchToDelete?.batch?.totalCost || 0)}
            </li>
          </ul>
        )}
        confirmStyle="danger"
        confirmLabel="Eliminar tanda"
        onCancel={() => setBatchToDelete(null)}
        onConfirm={() => {
          if (!batchToDelete?.batch) {
            return;
          }

          try {
            const deletedSnapshot = {
              toastId: `${Date.now()}-${batchToDelete.batch.id}`,
              batch: batchToDelete.batch,
              batchIndex: batchToDelete.batchIndex,
              saleDraft: batchToDelete.saleDraft
            };

            onDeleteBatch(batchToDelete.batch.id);
            clearUndoTimer();
            undoTimeoutRef.current = setTimeout(() => {
              setDeletedBatchUndo(null);
              undoTimeoutRef.current = null;
            }, BATCH_DELETE_UNDO_MS);
            setDeletedBatchUndo(deletedSnapshot);
            setErrorMessage("");
            setBatchToDelete(null);
          } catch (error) {
            setErrorMessage(error.message || "No se pudo eliminar la tanda.");
          }
        }}
      />

      <ConfirmModal
        isOpen={Boolean(assignmentToEdit)}
        title="Editar asignacion de usuario"
        description="Ajusta cantidad o eleccion antes de confirmar."
        initialData={
          assignmentToEdit || {
            batchId: "",
            assignmentIndex: -1,
            userId: "",
            userName: "",
            dessertsSelected: "1",
            selectionType: DEFAULT_SELECTION_TYPE
          }
        }
        renderEditor={({ draft, setDraft }) => (
          <div className="form-grid two-columns">
            <label>
              Usuario
              <input type="text" value={draft.userName || ""} readOnly />
            </label>

            <label htmlFor="edit-assignment-desserts">
              Cantidad asignada
              <input
                id="edit-assignment-desserts"
                type="number"
                min="1"
                step="1"
                value={draft.dessertsSelected}
                onChange={(event) =>
                  setDraft((previous) => ({
                    ...previous,
                    dessertsSelected: event.target.value
                  }))
                }
              />
            </label>

            <label htmlFor="edit-assignment-selection">
              Eleccion
              <select
                id="edit-assignment-selection"
                value={draft.selectionType || DEFAULT_SELECTION_TYPE}
                onChange={(event) =>
                  setDraft((previous) => ({
                    ...previous,
                    selectionType: event.target.value
                  }))
                }
              >
                {ASSIGNMENT_SELECTION_OPTIONS.map((option) => (
                  <option key={`edit-${option.value}`} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
        renderSummary={(draft) => {
          const batch = batches.find((entry) => entry.id === draft.batchId);
          const desiredDesserts = Math.max(Math.floor(toNumber(draft.dessertsSelected)), 0);
          const currentAssigned = batch?.assignedUsers || [];
          const projectedAssigned =
            currentAssigned.reduce((sum, entry, index) => {
              if (index === Math.floor(toNumber(draft.assignmentIndex))) {
                return sum;
              }

              return sum + toNumber(entry.dessertsSelected);
            }, 0) + desiredDesserts;
          const producedDesserts = toNumber(batch?.producedDesserts);
          const projectedRemaining = Math.max(producedDesserts - projectedAssigned, 0);
          const exceedsProduction = projectedAssigned > producedDesserts;

          return (
            <ul className="summary-list">
              <li>
                <strong>Usuario:</strong> {draft.userName || "Sin usuario"}
              </li>
              <li>
                <strong>Eleccion:</strong> {getSelectionLabel(draft.selectionType)}
              </li>
              <li>
                <strong>Cantidad:</strong> {formatPlainNumber(desiredDesserts, 0)}
              </li>
              <li>
                <strong>Unidades asignadas tras editar:</strong>
                {" "}
                {formatPlainNumber(projectedAssigned, 0)} / {formatPlainNumber(producedDesserts, 0)}
              </li>
              <li>
                <strong>Disponibles tras editar:</strong> {formatPlainNumber(projectedRemaining, 0)}
              </li>
              {exceedsProduction ? (
                <li>
                  <strong>Advertencia:</strong> La asignacion supera la produccion disponible.
                </li>
              ) : null}
            </ul>
          );
        }}
        disableConfirm={(draft) => {
          const batch = batches.find((entry) => entry.id === draft.batchId);
          const desiredDesserts = Math.max(Math.floor(toNumber(draft.dessertsSelected)), 0);
          const normalizedSelectionType = normalizeSelectionType(draft.selectionType, "");

          if (!batch || desiredDesserts <= 0 || !normalizedSelectionType) {
            return true;
          }

          const projectedAssigned =
            (batch.assignedUsers || []).reduce((sum, entry, index) => {
              if (index === Math.floor(toNumber(draft.assignmentIndex))) {
                return sum;
              }

              return sum + toNumber(entry.dessertsSelected);
            }, 0) + desiredDesserts;

          return projectedAssigned > toNumber(batch.producedDesserts);
        }}
        confirmLabel="Guardar cambios"
        onCancel={() => setAssignmentToEdit(null)}
        onConfirm={(draft) => {
          try {
            onUpdateBatchAssignment(
              draft.batchId,
              draft.assignmentIndex,
              draft.dessertsSelected,
              normalizeSelectionType(draft.selectionType)
            );
            setErrorMessage("");
            setAssignmentToEdit(null);
          } catch (error) {
            setErrorMessage(error.message || "No se pudo actualizar la asignacion.");
          }
        }}
      />

      <ConfirmModal
        isOpen={Boolean(assignmentToDelete)}
        title="Eliminar asignacion"
        description="Esta accion quitara la asignacion seleccionada de la tanda."
        initialData={{}}
        renderSummary={() => (
          <ul className="summary-list">
            <li>
              <strong>Usuario:</strong> {assignmentToDelete?.userName || "Sin usuario"}
            </li>
            <li>
              <strong>Eleccion:</strong> {getSelectionLabel(assignmentToDelete?.selectionType)}
            </li>
            <li>
              <strong>Cantidad:</strong> {formatPlainNumber(assignmentToDelete?.dessertsSelected || 0, 0)}
            </li>
          </ul>
        )}
        confirmStyle="danger"
        confirmLabel="Eliminar asignacion"
        onCancel={() => setAssignmentToDelete(null)}
        onConfirm={() => {
          if (!assignmentToDelete) {
            return;
          }

          try {
            onDeleteBatchAssignment(
              assignmentToDelete.batchId,
              assignmentToDelete.assignmentIndex
            );
            setErrorMessage("");
            setAssignmentToDelete(null);
          } catch (error) {
            setErrorMessage(error.message || "No se pudo eliminar la asignacion.");
          }
        }}
      />

      <ConfirmModal
        isOpen={Boolean(associationDraft)}
        title="Confirmar seleccion para usuario"
        description="Puedes agregar varias selecciones del mismo usuario en la misma tanda."
        initialData={
          associationDraft || {
            batchId: "",
            userId: "",
            dessertsSelected: "1",
            selectionType: DEFAULT_SELECTION_TYPE
          }
        }
        renderEditor={({ draft, setDraft }) => (
          <div className="form-grid two-columns">
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

            <label htmlFor="associate-user-desserts">
              Cantidad de postres elegidos
              <input
                id="associate-user-desserts"
                type="number"
                min="1"
                step="1"
                value={draft.dessertsSelected}
                onChange={(event) =>
                  setDraft((previous) => ({
                    ...previous,
                    dessertsSelected: event.target.value
                  }))
                }
              />
            </label>

            <label htmlFor="associate-user-selection-type">
              Eleccion del usuario
              <select
                id="associate-user-selection-type"
                value={draft.selectionType || DEFAULT_SELECTION_TYPE}
                onChange={(event) =>
                  setDraft((previous) => ({
                    ...previous,
                    selectionType: event.target.value
                  }))
                }
              >
                {ASSIGNMENT_SELECTION_OPTIONS.map((option) => (
                  <option key={`modal-${option.value}`} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
        renderSummary={(draft) => {
          const batch = batches.find((entry) => entry.id === draft.batchId);
          const user = users.find((entry) => entry.id === draft.userId);
          const desiredDesserts = Math.max(Math.floor(toNumber(draft.dessertsSelected)), 0);
          const selectionType = normalizeSelectionType(draft.selectionType);
          const currentAssigned = batch?.assignedUsers || [];
          const assignedUnitsCurrent = currentAssigned.reduce(
            (sum, entry) => sum + toNumber(entry.dessertsSelected),
            0
          );

          const projectedAssigned = assignedUnitsCurrent + desiredDesserts;
          const projectedRemaining = Math.max(
            toNumber(batch?.producedDesserts) - projectedAssigned,
            0
          );
          const exceedsProduction = projectedAssigned > toNumber(batch?.producedDesserts);

          return (
            <ul className="summary-list">
              <li>
                <strong>Tanda:</strong> {batch ? `#${batch.id.slice(-6)}` : "No encontrada"}
              </li>
              <li>
                <strong>Usuario:</strong> {user ? user.name : "Sin seleccionar"}
              </li>
              <li>
                <strong>Eleccion:</strong> {getSelectionLabel(selectionType)}
              </li>
              <li>
                <strong>Postres elegidos:</strong> {formatPlainNumber(desiredDesserts, 0)}
              </li>
              <li>
                <strong>Unidades asignadas tras agregar:</strong>
                {" "}
                {formatPlainNumber(projectedAssigned, 0)} / {formatPlainNumber(batch?.producedDesserts || 0, 0)}
              </li>
              <li>
                <strong>Disponibles tras agregar:</strong> {formatPlainNumber(projectedRemaining, 0)}
              </li>
              <li>
                <strong>Costo tanda:</strong> {batch ? formatCurrency(batch.totalCost) : "-"}
              </li>
              {exceedsProduction ? (
                <li>
                  <strong>Advertencia:</strong> La cantidad elegida supera los postres producidos.
                </li>
              ) : null}
            </ul>
          );
        }}
        disableConfirm={(draft) => {
          const batch = batches.find((entry) => entry.id === draft.batchId);
          const desiredDesserts = Math.max(Math.floor(toNumber(draft.dessertsSelected)), 0);
          const selectionType = normalizeSelectionType(draft.selectionType, "");

          if (!draft.userId || !draft.batchId || desiredDesserts <= 0 || !batch || !selectionType) {
            return true;
          }

          const assignedUnitsCurrent = (batch.assignedUsers || []).reduce(
            (sum, entry) => sum + toNumber(entry.dessertsSelected),
            0
          );

          const projectedAssigned = assignedUnitsCurrent + desiredDesserts;

          return projectedAssigned > toNumber(batch.producedDesserts);
        }}
        confirmLabel="Agregar seleccion"
        onCancel={() => setAssociationDraft(null)}
        onConfirm={(draft) => {
          try {
            onAssociateUserToBatch(
              draft.batchId,
              draft.userId,
              draft.dessertsSelected,
              normalizeSelectionType(draft.selectionType)
            );
            setErrorMessage("");
            setAssociationDraft(null);
            setSelectedDessertsByBatch((previous) => ({
              ...previous,
              [draft.batchId]: "1"
            }));
          } catch (error) {
            setErrorMessage(error.message || "No se pudo asociar el usuario.");
          }
        }}
      />
    </section>
  );
}
