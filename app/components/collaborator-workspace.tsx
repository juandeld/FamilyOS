"use client";
import { useEffect, useState } from "react";
import { Home, LogOut, Check } from "lucide-react";
import { browserSupabase } from "../../lib/supabase/browser";
import { useWorkspace } from "./access-gate";
import Pantry from "./pantry";
import type { StockMovement } from "../../lib/pantry";
import type { StockPolicies } from "../../lib/stock-policy";
type Data = {
  revision: number;
  plan?: {
    slot: string;
    recipeId: string;
    name: string;
    person: string;
    day: string;
    meal: string;
    portions: number;
    ingredients: { name: string; quantity: number; unit: string }[];
    instructions: string[];
  }[];
  tasks?: { id: string; title: string; frequency: string; done: boolean }[];
  assets?: { id: string; name: string; detail: string }[];
  stockMovements?: StockMovement[];
  stockPolicies?: StockPolicies;
};
export default function CollaboratorWorkspace() {
  const workspace = useWorkspace()!;
  const [data, setData] = useState<Data | null>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const can = (p: string) =>
    workspace.membership.permissions.includes(p as never);
  async function load() {
    const { data, error } = await browserSupabase().rpc(
      "get_collaborator_workspace",
      { hid: workspace.membership.household_id },
    );
    if (error) {
      setData(null);
      setMessage(
        "No se pudo cargar tu espacio. Revisa tu conexión o pide que verifiquen tu acceso.",
      );
      return;
    }
    setData(data);
  }
  useEffect(() => {
    load();
    const timer = setInterval(() => {
      if (!document.hidden) load();
    }, 4000);
    return () => clearInterval(timer);
  }, [
    workspace.membership.household_id,
    workspace.membership.permissions.join(","),
  ]);
  async function action(name: string, args: Record<string, unknown>) {
    setBusy(true);
    const { error } = await browserSupabase().rpc(name, {
      hid: workspace.membership.household_id,
      ...args,
    });
    setMessage(
      error
        ? "No se pudo confirmar el guardado. Actualiza y revisa el estado antes de repetir."
        : "Cambio guardado en el hogar.",
    );
    setBusy(false);
    await load();
  }
  return (
    <main className="collaborator-page">
      <header>
        <a href="/" className="brand">
          <Home size={23} />
          FamilyOS
        </a>
        <button
          className="text-button"
          onClick={() => browserSupabase().auth.signOut()}
        >
          <LogOut size={16} />
          Cerrar sesión
        </button>
      </header>
      <div className="content">
        <div className="eyebrow">TU ESPACIO DE TRABAJO</div>
        <h1>Hola, {workspace.membership.display_name}.</h1>
        <p>Lo que necesitas para cuidar el hogar.</p>
        {message && (
          <p role="status" className="notice">
            {message}
          </p>
        )}
        {!data && <p>Cargando tus pendientes…</p>}
        {data?.plan && (
          <section className="panel">
            <h2>Menú de cocina</h2>
            <p>
              Porciones e instrucciones. Sin objetivos nutricionales ni datos
              médicos.
            </p>
            {data.plan.length === 0 && <p>No hay platos asignados.</p>}
            {data.plan.map((p) => (
              <article className="cook-row" key={p.slot}>
                <small>
                  {p.person} · {p.day} · {p.meal} · {p.portions} porción base
                </small>
                <h3>{p.name}</h3>
                <p>
                  {p.ingredients
                    .map((i) => `${i.quantity} ${i.unit} ${i.name}`)
                    .join(" · ")}
                </p>
                <ol>
                  {p.instructions.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ol>
                {can("kitchen.confirm") && (
                  <button
                    disabled={busy}
                    className="primary compact"
                    onClick={() =>
                      action("confirm_kitchen_preparation", {
                        slot_key: p.slot,
                        recipe_id: p.recipeId,
                        event_id: crypto.randomUUID(),
                      })
                    }
                  >
                    <Check size={15} />
                    Confirmar una preparación
                  </button>
                )}
              </article>
            ))}
          </section>
        )}
        {data?.tasks && (
          <section className="panel">
            <h2>Tus pendientes</h2>
            {data.tasks.length === 0 && <p>No tienes tareas asignadas.</p>}
            {data.tasks.map((t) => (
              <label className="task" key={t.id}>
                <input
                  type="checkbox"
                  checked={t.done}
                  disabled={busy || !can("tasks.update")}
                  onChange={() =>
                    action("set_my_task_done", {
                      task_id: t.id,
                      new_done: !t.done,
                    })
                  }
                />
                <span>
                  {t.title}
                  <small>{t.frequency}</small>
                </span>
              </label>
            ))}
          </section>
        )}
        {data?.assets && (
          <section className="panel">
            <h2>Activos del hogar</h2>
            {data.assets.map((a) => (
              <Asset
                key={a.id}
                asset={a}
                editable={can("assets.write")}
                busy={busy}
                save={(name, detail) =>
                  action("save_operational_asset", {
                    asset_id: a.id,
                    asset_name: name,
                    asset_detail: detail,
                  })
                }
              />
            ))}
          </section>
        )}
        {data?.stockMovements && (
          <Pantry
            movements={data.stockMovements}
            policies={data.stockPolicies || {}}
            readOnly={!can("inventory.write")}
            onRecord={(m) =>
              action("record_stock_movement", {
                event_id: m.id,
                product: m.name,
                stock_unit: m.unit,
                movement_kind: m.kind,
                amount:
                  m.kind === "correction" ? m.countedQuantity : m.quantity,
              })
            }
          />
        )}
        <a className="demo-link" href="/demo">
          Abrir demo separada con datos ficticios
        </a>
      </div>
    </main>
  );
}
function Asset({
  asset,
  editable,
  busy,
  save,
}: {
  asset: { name: string; detail: string };
  editable: boolean;
  busy: boolean;
  save: (name: string, detail: string) => void;
}) {
  const [detail, setDetail] = useState(asset.detail);
  return (
    <article className="member-card">
      <h3>{asset.name}</h3>
      {editable ? (
        <>
          <textarea
            aria-label={`Ficha de ${asset.name}`}
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
          />
          <button
            className="primary compact"
            disabled={busy}
            onClick={() => save(asset.name, detail)}
          >
            Guardar ficha
          </button>
        </>
      ) : (
        <p>{asset.detail}</p>
      )}
    </article>
  );
}
