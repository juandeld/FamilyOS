"use client";
import { useState } from "react";
import { Package, Plus, Check, ShoppingBag } from "lucide-react";
import { recipes } from "../../lib/domain";
import {
  pantryBalances,
  stockKey,
  type StockMovement,
  type StockKind,
} from "../../lib/pantry";
import {
  stockMode,
  controlledMovements,
  isMeat,
  toGrams,
  imperial,
  type StockPolicies,
  type StockMode,
} from "../../lib/stock-policy";
const ingredients = [
  ...new Map(
    recipes
      .flatMap((r) => r.ingredients)
      .map((i) => [stockKey(i.name, i.unit), i]),
  ).values(),
].sort((a, b) => a.name.localeCompare(b.name, "es-GT"));
const format = (n: number) =>
  new Intl.NumberFormat("es-GT", { maximumFractionDigits: 2 }).format(n);
const kinds: Record<StockKind, string> = {
  opening: "Inventario inicial",
  purchase: "Compra confirmada",
  preparation: "Receta preparada",
  correction: "Corrección por conteo",
};
export default function Pantry({
  movements,
  policies = {},
  onPolicyChange,
  onRecord,
  readOnly = false,
}: {
  movements: StockMovement[];
  policies?: StockPolicies;
  onPolicyChange?: (key: string, mode: StockMode) => void;
  onRecord: (movement: StockMovement) => void;
  readOnly?: boolean;
}) {
  const [kind, setKind] = useState<"opening" | "purchase" | "correction">(
      "opening",
    ),
    [selected, setSelected] = useState(stockKey("Pollo", "g")),
    [quantity, setQuantity] = useState(""),
    [note, setNote] = useState(""),
    [message, setMessage] = useState(""),
    [customName, setCustomName] = useState(""),
    [customUnit, setCustomUnit] = useState("g"),
    [inputUnit, setInputUnit] = useState<"g" | "lb" | "oz">("lb");
  const balances = pantryBalances(controlledMovements(movements, policies));
  const products = [
    ...new Map(
      [...ingredients, ...movements].map((i) => [stockKey(i.name, i.unit), i]),
    ).values(),
  ].sort((a, b) => a.name.localeCompare(b.name, "es-GT"));
  const ingredient =
    selected === "__new__"
      ? { name: customName.trim(), unit: customUnit }
      : products.find((i) => stockKey(i.name, i.unit) === selected)!;
  const key = stockKey(ingredient.name, ingredient.unit),
    mode = stockMode(ingredient.name, ingredient.unit, policies),
    existing = balances.find((i) => i.key === key);
  const captureUnit = ingredient.unit === "g" ? inputUnit : ingredient.unit;
  const amount =
    ingredient.unit === "g"
      ? toGrams(Number(quantity), inputUnit)
      : Number(quantity);
  const valid =
    !readOnly &&
    mode === "tracked" &&
    ingredient.name.length > 0 &&
    quantity.trim() !== "" &&
    Number.isFinite(amount) &&
    amount >= 0 &&
    (kind !== "purchase" || amount > 0) &&
    (kind !== "opening" || existing?.opening == null) &&
    (kind === "opening" || existing?.balance != null);
  function save() {
    if (!valid) return;
    onRecord({
      id: crypto.randomUUID(),
      name: ingredient.name,
      unit: ingredient.unit,
      quantity: kind === "correction" ? amount - existing!.balance! : amount,
      countedQuantity: kind === "correction" ? amount : undefined,
      kind,
      occurredAt: new Date().toISOString(),
      note: note.trim() || undefined,
    });
    if (selected === "__new__") setSelected(key);
    setQuantity("");
    setNote("");
    setMessage(`${kinds[kind]} registrado para ${ingredient.name}.`);
  }
  return (
    <section className="pantry" aria-labelledby="pantry-heading">
      <div className="meat-heading">
        <div>
          <span className="eyebrow">CONTROLA SOLO LO QUE IMPORTA</span>
          <h2 id="pantry-heading">Carnes primero. Lo demás, tú eliges.</h2>
          <p>
            Las carnes se llevan en libras y onzas. Los básicos, como el
            aguacate, se asumen disponibles.
          </p>
        </div>
        <span className="tile-icon sage">
          <Package size={22} />
        </span>
      </div>
      <div className="panel pantry-entry">
        <label>
          Producto
          <select
            value={selected}
            onChange={(e) => {
              const item = products.find(
                (i) => stockKey(i.name, i.unit) === e.target.value,
              );
              setSelected(e.target.value);
              setInputUnit(item && isMeat(item.name) ? "lb" : "g");
              setQuantity("");
              setMessage("");
            }}
          >
            {products.map((i) => (
              <option
                key={stockKey(i.name, i.unit)}
                value={stockKey(i.name, i.unit)}
              >
                {i.name} ·{" "}
                {i.unit === "g" && isMeat(i.name) ? "lb / oz" : i.unit}
              </option>
            ))}
            {!readOnly && <option value="__new__">+ Otro producto</option>}
          </select>
        </label>
        {selected === "__new__" && (
          <div className="pantry-form">
            <label>
              Nombre del producto
              <input
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Ej. Carne de cerdo"
              />
            </label>
            <label>
              Unidad
              <select
                value={customUnit}
                onChange={(e) => setCustomUnit(e.target.value)}
              >
                <option value="g">Peso · libras, onzas o gramos</option>
                <option value="ml">Mililitros</option>
                <option value="unidades">Unidades</option>
              </select>
            </label>
          </div>
        )}
        <label>
          Modo de inventario
          <select
            aria-label="Modo de inventario"
            disabled={!onPolicyChange || !ingredient.name}
            value={mode}
            onChange={(e) => {
              onPolicyChange?.(key, e.target.value as StockMode);
              setQuantity("");
              setMessage("");
            }}
          >
            <option value="tracked">Llevar control</option>
            <option value="always_available">
              Siempre hay · sin conteo ni compra automática
            </option>
            <option value="untracked">
              Sin conteo · incluir en lista cuando la receta lo pida
            </option>
          </select>
        </label>
        {mode !== "tracked" ? (
          <p className="notice">
            {mode === "always_available"
              ? "Se asume disponible. No necesitas contarlo y las recetas no lo descontarán ni lo agregarán automáticamente al supermercado."
              : "No llevamos existencias de este producto. Se puede incluir en la lista de ingredientes, sin pedirte un conteo."}
          </p>
        ) : (
          <>
            {!readOnly && (
              <>
                <div
                  className="period-options"
                  role="group"
                  aria-label="Tipo de movimiento de despensa"
                >
                  {(["opening", "purchase", "correction"] as const).map((k) => (
                    <button
                      key={k}
                      aria-pressed={kind === k}
                      className={kind === k ? "chosen" : ""}
                      onClick={() => {
                        setKind(k);
                        setQuantity("");
                        setMessage("");
                      }}
                    >
                      {k === "opening"
                        ? "Primer inventario"
                        : k === "purchase"
                          ? "Registrar compra"
                          : "Corregir conteo"}
                    </button>
                  ))}
                </div>
                <div className="pantry-form">
                  {ingredient.unit === "g" && (
                    <label>
                      Unidad de captura
                      <select
                        value={inputUnit}
                        onChange={(e) => {
                          setInputUnit(e.target.value as "g" | "lb" | "oz");
                          setQuantity("");
                        }}
                      >
                        <option value="lb">Libras</option>
                        <option value="oz">Onzas</option>
                        <option value="g">Gramos</option>
                      </select>
                    </label>
                  )}
                  <label>
                    {kind === "correction"
                      ? "Cantidad que hay ahora"
                      : kind === "purchase"
                        ? "Cantidad comprada"
                        : "Cantidad inicial"}{" "}
                    ({captureUnit})
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="any"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      placeholder="Sin contar"
                    />
                  </label>
                </div>
                <label>
                  Nota opcional
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Ej. pechuga cruda, compra del supermercado…"
                  />
                </label>
                {kind === "opening" && existing?.opening != null && (
                  <p className="notice">
                    Este producto ya tiene inventario inicial. Usa Corregir
                    conteo para registrar una diferencia sin borrar el
                    historial.
                  </p>
                )}
                {kind !== "opening" && existing?.opening == null && (
                  <p className="notice">
                    Primero registra el conteo de este producto. No asumimos que
                    había cero.
                  </p>
                )}
                <button className="primary" disabled={!valid} onClick={save}>
                  {kind === "purchase" ? (
                    <ShoppingBag size={16} />
                  ) : (
                    <Plus size={16} />
                  )}
                  Guardar{" "}
                  {kind === "purchase"
                    ? "compra"
                    : kind === "opening"
                      ? "inventario inicial"
                      : "corrección"}
                </button>
              </>
            )}
            <p className="pantry-hint">
              {existing?.balance == null
                ? "Pendiente del primer conteo."
                : `Disponible: ${ingredient.unit === "g" ? imperial(existing.balance) : `${format(existing.balance)} ${ingredient.unit}`}`}
              . Un conteo inicial basta; recetas y compras mantienen el saldo.
              Al volver a activar el control después de una pausa, se necesita
              un nuevo conteo.
            </p>
          </>
        )}
        {message && (
          <p className="pantry-success" role="status">
            <Check size={15} />
            {message}
          </p>
        )}
      </div>
      <div className="panel">
        <h3>Existencias que elegiste controlar</h3>
        {balances.length === 0 ? (
          <p>
            Empieza por contar tus carnes. No hace falta inventariar todos los
            ingredientes.
          </p>
        ) : (
          balances.map((item) => (
            <div className="pantry-row" key={item.key}>
              <div>
                <strong>{item.name}</strong>
                <small>
                  {item.opening == null
                    ? "Sin inventario inicial"
                    : `Inicial ${format(item.opening)} + compras ${format(item.purchases)} − recetas ${format(item.used)}${item.corrections ? ` + ajustes (${format(item.corrections)})` : ""} ${item.unit}`}
                </small>
              </div>
              <b
                className={
                  item.balance != null && item.balance < 0
                    ? "stock-deficit"
                    : ""
                }
              >
                {item.balance == null
                  ? "Sin conteo"
                  : item.unit === "g"
                    ? imperial(item.balance)
                    : `${format(item.balance)} ${item.unit}`}
              </b>
              {item.balance != null && item.balance < 0 && (
                <p className="stock-deficit">
                  Saldo negativo: falta registrar una compra o corregir el
                  conteo.
                </p>
              )}
            </div>
          ))
        )}
      </div>
      <details className="panel pantry-history">
        <summary>
          Historial de compras y movimientos · {movements.length}
        </summary>
        {[...movements].reverse().map((m) => (
          <div className="pantry-movement" key={m.id}>
            <strong>
              {kinds[m.kind]} · {m.name}
            </strong>
            <span>
              {m.unit === "g"
                ? imperial(m.quantity)
                : `${m.quantity > 0 ? "+" : ""}${format(m.quantity)} ${m.unit}`}
            </span>
            <small>
              {new Date(m.occurredAt).toLocaleString("es-GT", {
                timeZone: "America/Guatemala",
              })}
              {m.note ? ` · ${m.note}` : ""}
            </small>
          </div>
        ))}
      </details>
      <p className="notice">
        Los movimientos no se borran al dejar de controlar un producto. No se
        convierten pesos crudos a cocidos ni peso escurrido a latas. Una
        preparación confirmada descuenta solo los productos controlados.
      </p>
    </section>
  );
}
