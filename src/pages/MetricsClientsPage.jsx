import { useMemo, useState } from "react";
import { ASSIGNMENT_SELECTION_OPTIONS } from "../data/defaultData";
import { formatDateTime, formatPlainNumber, toNumber } from "../utils/format";

const DEFAULT_SELECTION_TYPE = "Limon";
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

function isCookieOnlySelection(selectionType) {
  return normalizeSelectionType(selectionType) === "Solo galleta";
}

function toDateInputValue(date) {
  const safeDate = new Date(date);
  if (Number.isNaN(safeDate.getTime())) {
    return "";
  }

  const year = safeDate.getFullYear();
  const month = String(safeDate.getMonth() + 1).padStart(2, "0");
  const day = String(safeDate.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateBoundary(inputValue, endOfDay = false) {
  if (!inputValue) {
    return null;
  }

  const parsed = new Date(`${inputValue}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  if (endOfDay) {
    parsed.setHours(23, 59, 59, 999);
  }

  return parsed;
}

function resolveAssignedEntries(batch, usersById) {
  return (batch.assignedUsers || [])
    .map((entry) => ({
      ...entry,
      user: usersById[entry.userId],
      dessertsSelected: Math.max(Math.floor(toNumber(entry.dessertsSelected)), 0),
      selectionType: normalizeSelectionType(
        entry.selectionType,
        mapPreferredFlavorToSelectionType(usersById[entry.userId]?.preferredFlavor)
      )
    }))
    .filter((entry) => Boolean(entry.user));
}

function buildMetrics(filteredBatches, usersById) {
  const metricsByUser = new Map();

  filteredBatches.forEach((batch) => {
    const assignedEntries = resolveAssignedEntries(batch, usersById);
    const usersSeenInBatch = new Set();

    assignedEntries.forEach((entry) => {
      const current = metricsByUser.get(entry.userId) || {
        userId: entry.userId,
        userName: entry.user.name,
        batchesCount: 0,
        purchaseRecords: 0,
        mainUnits: 0,
        cookieUnits: 0,
        totalUnits: 0
      };

      const selectedUnits = Math.max(toNumber(entry.dessertsSelected), 0);
      current.purchaseRecords += 1;
      current.totalUnits += selectedUnits;

      if (isCookieOnlySelection(entry.selectionType)) {
        current.cookieUnits += selectedUnits;
      } else {
        current.mainUnits += selectedUnits;
      }

      if (!usersSeenInBatch.has(entry.userId)) {
        current.batchesCount += 1;
        usersSeenInBatch.add(entry.userId);
      }

      metricsByUser.set(entry.userId, current);
    });
  });

  const allCustomers = Array.from(metricsByUser.values());

  const topByFrequency = [...allCustomers]
    .sort((a, b) => {
      if (b.batchesCount !== a.batchesCount) {
        return b.batchesCount - a.batchesCount;
      }

      if (b.purchaseRecords !== a.purchaseRecords) {
        return b.purchaseRecords - a.purchaseRecords;
      }

      return b.totalUnits - a.totalUnits;
    })
    .slice(0, 5);

  const topByMainUnits = [...allCustomers].sort((a, b) => b.mainUnits - a.mainUnits).slice(0, 5);
  const topByCookieUnits = [...allCustomers]
    .sort((a, b) => b.cookieUnits - a.cookieUnits)
    .slice(0, 5);

  const totals = allCustomers.reduce(
    (accumulator, current) => ({
      customers: accumulator.customers + 1,
      purchaseRecords: accumulator.purchaseRecords + current.purchaseRecords,
      totalUnits: accumulator.totalUnits + current.totalUnits,
      mainUnits: accumulator.mainUnits + current.mainUnits,
      cookieUnits: accumulator.cookieUnits + current.cookieUnits
    }),
    {
      customers: 0,
      purchaseRecords: 0,
      totalUnits: 0,
      mainUnits: 0,
      cookieUnits: 0
    }
  );

  return {
    allCustomers,
    topByFrequency,
    topByMainUnits,
    topByCookieUnits,
    totals
  };
}

export default function MetricsClientsPage({ batches, users }) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const usersById = useMemo(() => {
    return users.reduce((accumulator, user) => {
      accumulator[user.id] = user;
      return accumulator;
    }, {});
  }, [users]);

  const hasInvalidRange = Boolean(startDate && endDate && startDate > endDate);

  const filteredBatches = useMemo(() => {
    const startBoundary = parseDateBoundary(startDate, false);
    const endBoundary = parseDateBoundary(endDate, true);

    return batches.filter((batch) => {
      const createdAt = new Date(batch.createdAt);
      if (Number.isNaN(createdAt.getTime())) {
        return false;
      }

      if (startBoundary && createdAt < startBoundary) {
        return false;
      }

      if (endBoundary && createdAt > endBoundary) {
        return false;
      }

      return true;
    });
  }, [batches, startDate, endDate]);

  const metrics = useMemo(
    () => (hasInvalidRange ? buildMetrics([], usersById) : buildMetrics(filteredBatches, usersById)),
    [filteredBatches, hasInvalidRange, usersById]
  );

  const filteredDateRange = useMemo(() => {
    if (filteredBatches.length === 0) {
      return { first: "", last: "" };
    }

    let first = "";
    let last = "";

    filteredBatches.forEach((batch) => {
      const createdAt = new Date(batch.createdAt);
      if (Number.isNaN(createdAt.getTime())) {
        return;
      }

      if (!first || createdAt < new Date(first)) {
        first = batch.createdAt;
      }

      if (!last || createdAt > new Date(last)) {
        last = batch.createdAt;
      }
    });

    return { first, last };
  }, [filteredBatches]);

  const handleLast30Days = () => {
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - 29);

    setStartDate(toDateInputValue(start));
    setEndDate(toDateInputValue(today));
  };

  const handleCurrentMonth = () => {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), 1);

    setStartDate(toDateInputValue(start));
    setEndDate(toDateInputValue(today));
  };

  const handleClearFilters = () => {
    setStartDate("");
    setEndDate("");
  };

  return (
    <section className="page-grid single-gap">
      <article className="card">
        <div className="section-header">
          <div>
            <h2>Metricas de clientes</h2>
            <p>Frecuencia y volumen de compra de postres y galletas por cliente.</p>
          </div>
        </div>

        <div className="report-card">
          <div className="section-header">
            <div>
              <h3>Filtros de fechas</h3>
              <p>Puedes usar atajos o definir un rango personalizado.</p>
            </div>
          </div>

          <div className="inline-actions wrap">
            <button type="button" className="btn secondary" onClick={handleLast30Days}>
              Ultimos 30 dias
            </button>
            <button type="button" className="btn secondary" onClick={handleCurrentMonth}>
              Mes actual
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={handleClearFilters}
              disabled={!startDate && !endDate}
            >
              Limpiar filtros
            </button>
          </div>

          <div className="form-grid two-columns">
            <label htmlFor="metrics-start-date">
              Fecha inicio
              <input
                id="metrics-start-date"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </label>

            <label htmlFor="metrics-end-date">
              Fecha fin
              <input
                id="metrics-end-date"
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </label>
          </div>

          {hasInvalidRange ? (
            <p className="message warning">La fecha inicio no puede ser mayor que la fecha fin.</p>
          ) : (
            <p className="message muted">
              Tandas consideradas: {formatPlainNumber(filteredBatches.length, 0)}
              {filteredDateRange.first && filteredDateRange.last
                ? ` (Desde ${formatDateTime(filteredDateRange.first)} hasta ${formatDateTime(filteredDateRange.last)})`
                : ""}
            </p>
          )}
        </div>

        <div className="report-card">
          <div className="chips-wrap">
            <span className="chip">
              Clientes con compras: {formatPlainNumber(metrics.totals.customers, 0)}
            </span>
            <span className="chip">
              Registros de compra: {formatPlainNumber(metrics.totals.purchaseRecords, 0)}
            </span>
            <span className="chip">Unidades totales: {formatPlainNumber(metrics.totals.totalUnits, 0)}</span>
            <span className="chip">Postres: {formatPlainNumber(metrics.totals.mainUnits, 0)}</span>
            <span className="chip">Galletas: {formatPlainNumber(metrics.totals.cookieUnits, 0)}</span>
          </div>

          <div className="table-wrap">
            <table className="table compact-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Tandas compradas</th>
                  <th>Registros</th>
                  <th>Postres</th>
                  <th>Galletas</th>
                  <th>Unidades totales</th>
                </tr>
              </thead>
              <tbody>
                {metrics.topByFrequency.length > 0 ? (
                  metrics.topByFrequency.map((customer) => (
                    <tr key={`freq-${customer.userId}`}>
                      <td>{customer.userName}</td>
                      <td>{formatPlainNumber(customer.batchesCount, 0)}</td>
                      <td>{formatPlainNumber(customer.purchaseRecords, 0)}</td>
                      <td>{formatPlainNumber(customer.mainUnits, 0)}</td>
                      <td>{formatPlainNumber(customer.cookieUnits, 0)}</td>
                      <td>{formatPlainNumber(customer.totalUnits, 0)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6">Sin compras registradas para el rango seleccionado.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="form-grid two-columns">
            <div className="table-wrap">
              <table className="table compact-table">
                <thead>
                  <tr>
                    <th>Top compradores de postres</th>
                    <th>Unidades</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.topByMainUnits.length > 0 ? (
                    metrics.topByMainUnits.map((customer) => (
                      <tr key={`main-${customer.userId}`}>
                        <td>{customer.userName}</td>
                        <td>{formatPlainNumber(customer.mainUnits, 0)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="2">Sin compras de postres.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="table-wrap">
              <table className="table compact-table">
                <thead>
                  <tr>
                    <th>Top compradores de galletas</th>
                    <th>Unidades</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.topByCookieUnits.length > 0 ? (
                    metrics.topByCookieUnits.map((customer) => (
                      <tr key={`cookie-${customer.userId}`}>
                        <td>{customer.userName}</td>
                        <td>{formatPlainNumber(customer.cookieUnits, 0)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="2">Sin compras de galletas.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <p className="message muted">
            Tipos de eleccion analizados:
            {" "}
            {ASSIGNMENT_SELECTION_OPTIONS.map((option) => option.label).join(", ")}.
          </p>
        </div>
      </article>
    </section>
  );
}
