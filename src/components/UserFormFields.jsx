import { FLAVOR_OPTIONS } from "../data/defaultData";

export default function UserFormFields({ values, onChange, idPrefix = "user" }) {
  return (
    <div className="form-grid two-columns">
      <label htmlFor={`${idPrefix}-name`}>
        Nombre
        <input
          id={`${idPrefix}-name`}
          type="text"
          value={values.name}
          onChange={(event) => onChange("name", event.target.value)}
          placeholder="Nombre completo"
          required
        />
      </label>

      <label htmlFor={`${idPrefix}-contact`}>
        Contacto
        <input
          id={`${idPrefix}-contact`}
          type="text"
          value={values.contact}
          onChange={(event) => onChange("contact", event.target.value)}
          placeholder="WhatsApp o Instagram"
          required
        />
      </label>

      <label htmlFor={`${idPrefix}-flavor`}>
        Postre preferido
        <select
          id={`${idPrefix}-flavor`}
          value={values.preferredFlavor}
          onChange={(event) => onChange("preferredFlavor", event.target.value)}
        >
          {FLAVOR_OPTIONS.map((flavor) => (
            <option key={flavor} value={flavor}>
              {flavor}
            </option>
          ))}
        </select>
      </label>

      <label className="checkbox-field" htmlFor={`${idPrefix}-cookie`}>
        <input
          id={`${idPrefix}-cookie`}
          type="checkbox"
          checked={values.wantsCookie}
          onChange={(event) => onChange("wantsCookie", event.target.checked)}
        />
        Quiere capa de galleta
      </label>
    </div>
  );
}
