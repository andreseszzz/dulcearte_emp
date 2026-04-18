import { useMemo, useState } from "react";
import ConfirmModal from "../components/ConfirmModal";
import UserFormFields from "../components/UserFormFields";
import { EMPTY_USER_FORM } from "../data/defaultData";

function getFreshUserForm() {
  return { ...EMPTY_USER_FORM };
}

export default function UsersPage({ users, onCreateUser, onDeleteUser }) {
  const [userForm, setUserForm] = useState(getFreshUserForm);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");

  const sortedUsers = useMemo(
    () => [...users].sort((a, b) => a.name.localeCompare(b.name)),
    [users]
  );

  const updateField = (field, value) => {
    setUserForm((previous) => ({
      ...previous,
      [field]: value
    }));
  };

  return (
    <section className="page-grid single-gap">
      <article className="card">
        <div className="section-header">
          <div>
            <h2>Agregar usuario interesado</h2>
            <p>El alta se confirma en modal con edicion previa.</p>
          </div>
        </div>

        <form
          className="stack"
          onSubmit={(event) => {
            event.preventDefault();
            setErrorMessage("");
            setShowSaveConfirm(true);
          }}
        >
          <UserFormFields values={userForm} onChange={updateField} />

          <div className="inline-actions">
            <button type="submit" className="btn primary">
              Agregar
            </button>
            <button
              type="button"
              className="btn secondary"
              onClick={() => setUserForm(getFreshUserForm())}
            >
              Limpiar formulario
            </button>
          </div>
        </form>

        {errorMessage ? <p className="message error">{errorMessage}</p> : null}
      </article>

      <article className="card">
        <div className="section-header">
          <div>
            <h2>Lista de usuarios interesados</h2>
            <p>Gestiona contactos y preferencias.</p>
          </div>
        </div>

        {sortedUsers.length === 0 ? (
          <p className="message muted">Aun no hay usuarios registrados.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Contacto</th>
                  <th>Postre preferido</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {sortedUsers.map((user) => (
                  <tr key={user.id}>
                    <td>{user.name}</td>
                    <td>{user.contact}</td>
                    <td>{user.preferredFlavor}</td>
                    <td>
                      <button
                        type="button"
                        className="btn ghost danger-text"
                        onClick={() => {
                          setUserToDelete(user);
                          setErrorMessage("");
                        }}
                      >
                        Eliminar
                      </button>
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
        title="Confirmar nuevo usuario"
        description="Revisa y ajusta los datos antes de confirmar el alta."
        initialData={userForm}
        renderEditor={({ draft, setDraft }) => (
          <UserFormFields
            values={draft}
            onChange={(field, value) =>
              setDraft((previous) => ({
                ...previous,
                [field]: value
              }))
            }
            idPrefix="confirm-user"
          />
        )}
        renderSummary={(draft) => (
          <ul className="summary-list">
            <li>
              <strong>Nombre:</strong> {draft.name || "Sin nombre"}
            </li>
            <li>
              <strong>Contacto:</strong> {draft.contact || "Sin contacto"}
            </li>
            <li>
              <strong>Postre preferido:</strong> {draft.preferredFlavor || "Sin preferencia"}
            </li>
          </ul>
        )}
        disableConfirm={(draft) => !draft.name?.trim() || !draft.contact?.trim()}
        confirmLabel="Confirmar alta"
        onCancel={() => setShowSaveConfirm(false)}
        onConfirm={(draft) => {
          try {
            onCreateUser(draft);
            setShowSaveConfirm(false);
            setUserForm(getFreshUserForm());
          } catch (error) {
            setErrorMessage(error.message || "No se pudo crear el usuario.");
          }
        }}
      />

      <ConfirmModal
        isOpen={Boolean(userToDelete)}
        title="Confirmar eliminacion de usuario"
        description="Tambien se removera su asociacion de cualquier tanda existente."
        initialData={{}}
        renderSummary={() => (
          <p>
            Se eliminara el usuario <strong>{userToDelete?.name}</strong>.
          </p>
        )}
        confirmStyle="danger"
        confirmLabel="Eliminar usuario"
        onCancel={() => setUserToDelete(null)}
        onConfirm={() => {
          if (!userToDelete) {
            return;
          }

          onDeleteUser(userToDelete.id);
          setUserToDelete(null);
        }}
      />
    </section>
  );
}
