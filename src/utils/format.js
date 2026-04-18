export function formatCurrency(value) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0
  }).format(Number(value) || 0);
}

export function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatDateTime(dateValue) {
  const date = dateValue ? new Date(dateValue) : new Date();

  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

export function formatPlainNumber(value, maximumFractionDigits = 2) {
  return new Intl.NumberFormat("es-CO", {
    maximumFractionDigits
  }).format(toNumber(value));
}
