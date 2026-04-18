import { UNIT_OPTIONS } from "../data/defaultData";

export default function IngredientFormFields({ values, onChange, idPrefix = "ingredient" }) {
  return (
    <div className="form-grid two-columns">
      <label htmlFor={`${idPrefix}-name`}>
        Nombre
        <input
          id={`${idPrefix}-name`}
          type="text"
          value={values.name}
          onChange={(event) => onChange("name", event.target.value)}
          placeholder="Ej: Base sabor limon"
          required
        />
      </label>

      <label htmlFor={`${idPrefix}-quantity`}>
        Cantidad disponible
        <input
          id={`${idPrefix}-quantity`}
          type="number"
          min="0"
          step="0.01"
          value={values.quantityAvailable}
          onChange={(event) => onChange("quantityAvailable", event.target.value)}
          placeholder="0"
          required
        />
      </label>

      <label htmlFor={`${idPrefix}-unit`}>
        Unidad
        <select
          id={`${idPrefix}-unit`}
          value={values.unit}
          onChange={(event) => onChange("unit", event.target.value)}
        >
          {UNIT_OPTIONS.map((unit) => (
            <option key={unit} value={unit}>
              {unit}
            </option>
          ))}
        </select>
      </label>

      <label htmlFor={`${idPrefix}-price`}>
        Precio por unidad (COP)
        <input
          id={`${idPrefix}-price`}
          type="number"
          min="0"
          step="0.01"
          value={values.pricePerUnit}
          onChange={(event) => onChange("pricePerUnit", event.target.value)}
          placeholder="0"
          required
        />
      </label>
    </div>
  );
}
