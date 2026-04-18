import { UNIT_OPTIONS } from "../data/defaultData";
import { normalizePriceBasis } from "../utils/ingredientPricing";

export default function IngredientFormFields({ values, onChange, idPrefix = "ingredient" }) {
  const normalizedBasis = normalizePriceBasis(values.unit, values.priceBasis);

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
          onChange={(event) => {
            const nextUnit = event.target.value;
            onChange("unit", nextUnit);
            onChange("priceBasis", normalizePriceBasis(nextUnit, values.priceBasis));
          }}
        >
          {UNIT_OPTIONS.map((unit) => (
            <option key={unit} value={unit}>
              {unit}
            </option>
          ))}
        </select>
      </label>

      <label htmlFor={`${idPrefix}-price`}>
        Precio de compra (COP)
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
        <small className="field-helper">
          {values.unit === "g"
            ? "Para gramos: costo por gramo = precio de compra / cantidad en g; luego se multiplica por los gramos usados."
            : normalizedBasis === "l"
              ? "Para ingredientes en ml, ingresa el precio por litro y se divide automaticamente por el volumen usado."
              : "El costo parcial se calcula con ese precio y la cantidad usada."}
        </small>
      </label>

      <label className="checkbox-field" htmlFor={`${idPrefix}-cookie-cost`}>
        <input
          id={`${idPrefix}-cookie-cost`}
          type="checkbox"
          checked={Boolean(values.affectsCookieCost)}
          onChange={(event) => onChange("affectsCookieCost", event.target.checked)}
        />
        Este ingrediente afecta el costo unitario de la galleta
      </label>
    </div>
  );
}
