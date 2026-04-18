import { useEffect, useState } from "react";

export default function ConfirmModal({
  isOpen,
  title,
  description,
  initialData,
  renderEditor,
  renderSummary,
  onConfirm,
  onCancel,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  confirmStyle = "primary",
  disableConfirm = false
}) {
  const [draft, setDraft] = useState(initialData ?? {});

  useEffect(() => {
    if (isOpen) {
      setDraft(initialData ?? {});
    }
  }, [initialData, isOpen]);

  if (!isOpen) {
    return null;
  }

  const confirmDisabled =
    typeof disableConfirm === "function" ? disableConfirm(draft) : Boolean(disableConfirm);

  return (
    <div className="modal-overlay" role="presentation" onClick={onCancel}>
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="modal-header">
          <div>
            <h3>{title}</h3>
            {description ? <p>{description}</p> : null}
          </div>
          <button type="button" className="icon-button" onClick={onCancel} aria-label="Cerrar modal">
            x
          </button>
        </header>

        <section className="modal-body">
          {renderEditor ? (
            <div className="modal-editor">{renderEditor({ draft, setDraft })}</div>
          ) : null}
          {renderSummary ? (
            <div className="modal-summary">{renderSummary(draft)}</div>
          ) : null}
        </section>

        <footer className="modal-footer">
          <button type="button" className="btn secondary" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`btn ${confirmStyle === "danger" ? "danger" : "primary"}`}
            onClick={() => onConfirm(draft)}
            disabled={confirmDisabled}
          >
            {confirmLabel}
          </button>
        </footer>
      </div>
    </div>
  );
}
