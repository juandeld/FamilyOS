"use client";
import { useRef, useState } from "react";
import {
  CalendarDays,
  Check,
  ChevronRight,
  Clock,
  FileCheck2,
  History,
  Pause,
  Play,
  Plus,
  ShieldCheck,
  SlidersHorizontal,
  Upload,
  Wrench,
  X,
} from "lucide-react";
import type { State } from "../../lib/domain";
import {
  activateMaintenance,
  completeMaintenance,
  demoMaintenance,
  frequencyNames,
  localDate,
  maintenanceMaterials,
  monthNames,
  syncMaintenanceTasks,
  validDate,
  type MaintenanceData,
  type MaintenancePlan,
} from "../../lib/maintenance";
import { parseMaintenanceImport } from "../../lib/maintenance-import";
import { useWorkspace } from "./access-gate";
import { TaskAssignee } from "./user-management";
type Props = {
  state: State;
  onChange: (change: (s: State) => State) => void;
  pending: boolean;
};
function dateLabel(date: string) {
  return new Intl.DateTimeFormat("es-GT", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(date + "T12:00:00Z"));
}
export default function MaintenanceManager({
  state,
  onChange,
  pending,
}: Props) {
  const workspace = useWorkspace(),
    data = state.maintenance;
  const [tab, setTab] = useState("Agenda"),
    [month, setMonth] = useState(localDate().slice(0, 7)),
    [start, setStart] = useState(localDate()),
    [area, setArea] = useState("Todas"),
    [message, setMessage] = useState(""),
    [edit, setEdit] = useState<MaintenancePlan | null>(null),
    [reviewed, setReviewed] = useState(false),
    [confirm, setConfirm] = useState<string | null>(null),
    [note, setNote] = useState(""),
    [cost, setCost] = useState(""),
    [preview, setPreview] = useState<MaintenanceData | null>(null);
  const file = useRef<HTMLInputElement>(null),
    today = localDate();
  const active = data.plans.filter((p) => p.status === "active"),
    drafts = data.plans.filter((p) => p.status === "draft"),
    issues = data.plans.filter((p) => p.review.length),
    end = new Date(
      Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0),
    )
      .toISOString()
      .slice(0, 10);
  const agenda = active
    .filter(
      (p) =>
        p.nextDue && p.nextDue <= end && (area === "Todas" || p.area === area),
    )
    .sort((a, b) => a.nextDue!.localeCompare(b.nextDue!));
  const materials = maintenanceMaterials(data, end).filter(
    (m) =>
      area === "Todas" ||
      data.plans.find((p) => p.title === m.plan)?.area === area,
  );
  const history = data.history.filter(e => e.completedOn.startsWith(month) && (area === "Todas" || e.area === area));
  const run = (fn: (s: State) => State) => {
    try {
      onChange(fn);
      setMessage("Cambio registrado.");
    } catch (e) {
      setMessage((e as Error).message);
    }
  };
  function savePlan() {
    if (
      !edit ||
      !edit.title.trim() ||
      (edit.status !== "draft" && (!edit.nextDue || !validDate(edit.nextDue)))
    ) {
      setMessage("Revisa el nombre y la próxima fecha.");
      return;
    }
    if (edit.review.length && !reviewed) {
      setMessage("Confirma que revisaste las observaciones antes de guardar.");
      return;
    }
    if (
      edit.frequency !== "weekly" &&
      edit.months.length !==
        { monthly: 12, quarterly: 4, semiannual: 2, annual: 1 }[edit.frequency]
    ) {
      setMessage(
        "Los meses no coinciden con la frecuencia elegida. Ajusta el calendario.",
      );
      return;
    }
    if (
      edit.estimatedHours !== null &&
      (!Number.isFinite(edit.estimatedHours) || edit.estimatedHours <= 0)
    ) {
      setMessage("Indica horas positivas o deja el campo vacío.");
      return;
    }
    const updated = {
      ...edit,
      title: edit.title.trim(),
      review: reviewed ? [] : edit.review,
      references: reviewed
        ? [
            ...edit.references,
            ...edit.review.map(
              (r) => "Observación revisada por administrador: " + r,
            ),
          ]
        : edit.references,
    };
    run((s) =>
      syncMaintenanceTasks({
        ...s,
        maintenance: {
          ...s.maintenance,
          plans: s.maintenance.plans.some((p) => p.id === updated.id)
            ? s.maintenance.plans.map((p) =>
                p.id === updated.id ? updated : p,
              )
            : [...s.maintenance.plans, updated],
        },
      }),
    );
    setEdit(null);
  }
  function newPlan() {
    setReviewed(false);
    setMessage("");
    setEdit({
      id: crypto.randomUUID(),
      title: "Nueva rutina",
      area: "Casa",
      frequency: "monthly",
      months: Array.from({ length: 12 }, (_, i) => i + 1),
      estimatedHours: null,
      materials: [],
      references: [],
      instructions: "",
      sourceRows: [],
      review: [],
      priority: "normal",
      conditionBased: false,
      status: "draft",
      nextDue: null,
      anchorDay: Number(today.slice(8)),
      owner: "Sin asignar",
      assigneeId: "",
    });
  }

  async function readImport(selected: File) {
    setMessage("");
    if (!workspace) {
      setMessage("La demo pública solo admite ejemplos ficticios.");
      return;
    }
    if (data.plans.length) {
      setMessage("Ya tienes un plan. No se reemplazan rutinas existentes.");
      return;
    }
    if (selected.size > 1024 * 1024) {
      setMessage("El archivo excede 1 MB. No se importó nada.");
      return;
    }
    try {
      setPreview(parseMaintenanceImport(JSON.parse(await selected.text())));
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  return (
    <section className="maintenance-manager" aria-label="Plan de mantenimiento">
      <section className="maintenance-hero">
        <span className="maintenance-hero-icon">
          <Wrench size={26} />
        </span>
        <div>
          <span className="eyebrow">CUIDAR HOY, EVITAR IMPREVISTOS</span>
          <h2>La casa, bien cuidada.</h2>
          <p>
            {data.plans.length
              ? `${active.length} rutinas activas · ${drafts.length} por activar · ${data.history.length} trabajos confirmados`
              : "Un plan que recuerda, prepara y conserva lo que sí se hizo."}
          </p>
        </div>
        <span className="maintenance-source">
          <ShieldCheck size={16} />
          {workspace ? "Plan privado" : "Ejemplo de demostración"}
        </span>
      </section>
      {!data.plans.length ? (
        <section className="maintenance-welcome panel">
          <FileCheck2 size={30} />
          <h3>Tu plan, una sola vez.</h3>
          <p>
            Reúne rutinas, meses de referencia e insumos. Las próximas fechas
            empiezan cuando tú activas el plan; el historial comienza vacío.
          </p>
          {workspace ? (
            <>
              <input
                ref={file}
                type="file"
                accept=".json,application/json"
                aria-label="Archivo de mantenimiento preparado"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) readImport(f);
                }}
              />
              <button
                className="primary"
                onClick={() => file.current?.click()}
                disabled={pending}
              >
                <Upload size={16} /> Importar plan preparado
              </button>
              <p className="maintenance-caption">
                El archivo se lee en tu dispositivo y se guarda en el espacio
                privado de tu casa al confirmar.
              </p>
            </>
          ) : (
            <>
              <button
                className="primary"
                onClick={() => {
                  run((s) => ({ ...s, maintenance: demoMaintenance() }));
                  setTab("Plan base");
                }}
              >
                Probar plan de ejemplo <ChevronRight size={16} />
              </button>
              <p className="maintenance-caption">
                Los datos de tu archivo familiar no se publican en esta demo.
              </p>
            </>
          )}
          <button className="text-button" onClick={newPlan}>
            <Plus size={16} /> Crear una rutina
          </button>
        </section>
      ) : (
        <>
          <div className="maintenance-metrics">
            <div>
              <span>PRÓXIMOS / PENDIENTES</span>
              <strong>{agenda.length}</strong>
              <small>Hasta el mes elegido</small>
            </div>
            <div>
              <span>POR REVISAR</span>
              <strong>{issues.length}</strong>
              <small>Calendario o alcance</small>
            </div>
            <div>
              <span>HORAS ESTIMADAS</span>
              <strong>
                {agenda
                  .reduce((n, p) => n + (p.estimatedHours ?? 0), 0)
                  .toLocaleString("es-GT")}
              </strong>
              <small>
                {agenda.filter((p) => p.estimatedHours === null).length} sin
                estimación · no horas reales
              </small>
            </div>
          </div>
          <div className="tabs maintenance-tabs">
            {["Agenda", "Plan base", "Materiales", "Historial"].map((t) => (
              <button
                key={t}
                className={tab === t ? "selected" : ""}
                aria-pressed={tab === t}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="maintenance-toolbar">
            <label>
              Mes de consulta
              <input
                type="month"
                aria-label="Mes de mantenimiento"
                value={month}
                onChange={(e) => {
                  if (/^\d{4}-\d{2}$/.test(e.target.value))
                    setMonth(e.target.value);
                }}
              />
            </label>
            <label>
              Área
              <select
                aria-label="Área de mantenimiento"
                value={area}
                onChange={(e) => setArea(e.target.value)}
              >
                <option>Todas</option>
                {[...new Set(data.plans.map((p) => p.area))].sort().map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </select>
            </label>
            <button className="text-button" onClick={newPlan}>
              <Plus size={16} /> Nueva rutina
            </button>
          </div>
          {drafts.some((p) => !p.review.length) && (
            <section className="maintenance-activation">
              <div>
                <strong>Empezar sin arrastrar fechas antiguas</strong>
                <small>
                  Solo se activan borradores sin observaciones pendientes.
                </small>
              </div>
              <label>
                Fecha de inicio
                <input
                  type="date"
                  aria-label="Inicio del plan"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
              </label>
              <button
                className="primary"
                onClick={() => {
                  run((s) => activateMaintenance(s, start));
                  setTab("Agenda");
                }}
              >
                Activar rutinas listas
              </button>
            </section>
          )}
          {tab === "Agenda" && (
            <div className="maintenance-plan-list">
              {!agenda.length ? (
                <div className="maintenance-empty">
                  <CalendarDays size={26} />
                  <h3>No hay trabajos programados en este mes.</h3>
                  <p>
                    {drafts.length
                      ? "Activa las rutinas listas o revisa los borradores del plan base."
                      : "Puedes consultar otro mes o crear una rutina."}
                  </p>
                </div>
              ) : (
                agenda.map((p) => (
                  <article className="maintenance-card" key={p.id}>
                    <div className="maintenance-card-top">
                      <span
                        className={`maintenance-priority ${p.priority === "high" ? "high" : ""}`}
                      >
                        {p.nextDue! < today
                          ? "Fecha pendiente"
                          : p.nextDue === today
                            ? "Para hoy"
                            : "Próximo"}{" "}
                        · {p.area}
                      </span>
                      <span>{dateLabel(p.nextDue!)}</span>
                    </div>
                    <h3>{p.title}</h3>
                    <p>
                      {p.owner} · {frequencyNames[p.frequency]}
                      {p.conditionBased ? " · inspección por condición" : ""}
                    </p>
                    <div className="maintenance-card-meta">
                      <Clock size={13} />
                      {p.estimatedHours === null
                        ? "Tiempo por estimar"
                        : `${p.estimatedHours} h estimadas`}
                      <span>
                        {p.materials.filter((m) => !m.verified).length} insumos
                        por validar
                      </span>
                    </div>
                    <div className="maintenance-card-actions">
                      <button
                        className="primary compact"
                        disabled={p.nextDue! > today}
                        onClick={() => {
                          setConfirm(p.id);
                          setNote("");
                          setCost("");
                        }}
                      >
                        <Check size={15} /> Confirmar trabajo
                      </button>
                      <button
                        className="text-button"
                        onClick={() => {
                          setEdit(structuredClone(p));
                          setReviewed(false);
                          setMessage("");
                        }}
                      >
                        <SlidersHorizontal size={14} /> Ajustar
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
          )}
          {tab === "Plan base" && (
            <>
              <details className="maintenance-analysis panel">
                <summary>Lo que se conservó y lo que mejoramos</summary>
                <p>{data.sourceName}</p>
                {data.analysis.map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </details>
              <div className="maintenance-plan-list">
                {data.plans
                  .filter((p) => area === "Todas" || p.area === area)
                  .map((p) => (
                    <article className="maintenance-card" key={p.id}>
                      <div className="maintenance-card-top">
                        <span className="maintenance-priority">{p.area}</span>
                        <span>
                          {p.status === "draft"
                            ? "Borrador"
                            : p.status === "paused"
                              ? "En pausa"
                              : "Activa"}
                        </span>
                      </div>
                      <h3>{p.title}</h3>
                      <p>
                        {frequencyNames[p.frequency]} ·{" "}
                        {p.months.length
                          ? p.months
                              .map((m) => monthNames[m - 1].slice(0, 3))
                              .join(" / ")
                          : "Meses al activar"}{" "}
                        · {p.owner}
                      </p>
                      {p.review.length > 0 && (
                        <div className="maintenance-review">
                          {p.review.length}{" "}
                          {p.review.length === 1
                            ? "observación por revisar"
                            : "observaciones por revisar"}
                        </div>
                      )}
                      <div className="maintenance-card-actions">
                        <button
                          className="text-button"
                          onClick={() => {
                            setEdit(structuredClone(p));
                            setReviewed(false);
                          }}
                        >
                          <SlidersHorizontal size={14} /> Revisar rutina
                        </button>
                        {p.status !== "draft" && (
                          <button
                            className="text-button"
                            onClick={() =>
                              run((s) =>
                                syncMaintenanceTasks({
                                  ...s,
                                  maintenance: {
                                    ...s.maintenance,
                                    plans: s.maintenance.plans.map((x) =>
                                      x.id === p.id
                                        ? {
                                            ...x,
                                            status:
                                              p.status === "paused"
                                                ? "active"
                                                : "paused",
                                          }
                                        : x,
                                    ),
                                  },
                                }),
                              )
                            }
                          >
                            {p.status === "paused" ? (
                              <Play size={14} />
                            ) : (
                              <Pause size={14} />
                            )}{" "}
                            {p.status === "paused" ? "Reanudar" : "Pausar"}
                          </button>
                        )}
                      </div>
                    </article>
                  ))}
              </div>
            </>
          )}
          {tab === "Materiales" && (
            <section className="panel maintenance-materials">
              <h3>Preparar antes de empezar</h3>
              <p>
                Insumos de rutinas activas hasta el mes elegido. Las cantidades
                del archivo son referencias por validar, no existencias ni
                compras realizadas.
              </p>
              {materials.length ? (
                materials.map((m, i) => (
                  <div className="maintenance-material" key={i}>
                    <span className={m.verified ? "material-ready" : ""}>
                      {m.verified ? <Check size={15} /> : <Clock size={15} />}
                    </span>
                    <div>
                      <strong>{m.name}</strong>
                      <small>
                        {m.quantity} · {m.plan}
                      </small>
                      <small>
                        {dateLabel(m.due)} ·{" "}
                        {m.verified
                          ? "Validado para preparar"
                          : "Validar antes de comprar o utilizar"}
                      </small>
                    </div>
                  </div>
                ))
              ) : (
                <div className="maintenance-empty">
                  No hay insumos asociados a las rutinas de este período.
                </div>
              )}
            </section>
          )}
          {tab === "Historial" && (
            <section className="panel maintenance-history">
              <h3>Trabajos realmente confirmados</h3>
              <p>
                Programar una tarea no la agrega al historial. Cada confirmación
                conserva la fecha prevista, la fecha realizada y el costo real
                si se informó.
              </p>
              {history.length ? (
                history.map((e) => (
                  <article className="maintenance-history-row" key={e.id}>
                    <span>
                      <History size={16} />
                      {dateLabel(e.completedOn)}
                    </span>
                    <h4>{e.title}</h4>
                    <p>
                      Previsto: {dateLabel(e.dueOn)} · Confirmado por {e.by}
                    </p>
                    {e.note && <p>{e.note}</p>}
                    <small>
                      {e.cost === null
                        ? "Costo no informado"
                        : new Intl.NumberFormat("es-GT", {
                            style: "currency",
                            currency: "GTQ",
                          }).format(e.cost)}
                    </small>
                  </article>
                ))
              ) : (
                <div className="maintenance-empty">
                  <History size={26} />
                  <p>No hay trabajos confirmados en este período.</p>
                </div>
              )}
            </section>
          )}
        </>
      )}
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      {preview && (
        <div className="modal-backdrop">
          <section
            className="modal maintenance-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Revisar importación"
          >
            <button
              className="close icon-button"
              aria-label="Cerrar importación"
              onClick={() => setPreview(null)}
            >
              <X />
            </button>
            <h2>Tu plan está preparado.</h2>
            <p>
              {preview.sourceName} · {preview.plans.length} rutinas ·{" "}
              {preview.plans.filter((p) => p.review.length).length} por revisar
            </p>
            <p>
              Se importan borradores e insumos por validar. No se crean
              ejecuciones antiguas, compras ni responsables vigentes.
            </p>
            <button
              className="primary"
              disabled={pending}
              onClick={() => {
                run((s) => {
                  if (s.maintenance.plans.length)
                    throw new Error(
                      "El plan cambió. No se reemplazó información.",
                    );
                  return { ...s, maintenance: preview };
                });
                setPreview(null);
                setTab("Plan base");
              }}
            >
              Confirmar importación privada
            </button>
          </section>
        </div>
      )}
      {edit && (
        <div className="modal-backdrop">
          <section
            className="modal maintenance-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Editar rutina"
          >
            <button
              className="close icon-button"
              aria-label="Cerrar rutina"
              onClick={() => setEdit(null)}
            >
              <X />
            </button>
            <span className="eyebrow">CONFIGURAR UNA VEZ</span>
            <h2>Una rutina clara.</h2>
            <label>
              Nombre de la rutina
              <input
                aria-label="Nombre de rutina"
                value={edit.title}
                onChange={(e) => setEdit({ ...edit, title: e.target.value })}
              />
            </label>
            <div className="maintenance-form-grid">
              <label>
                Área
                <input
                  value={edit.area}
                  onChange={(e) => setEdit({ ...edit, area: e.target.value })}
                />
              </label>
              <label>
                Frecuencia
                <select
                  aria-label="Frecuencia de mantenimiento"
                  value={edit.frequency}
                  onChange={(e) => {
                    const f = e.target.value as MaintenancePlan["frequency"];
                    const interval = {
                      monthly: 1,
                      quarterly: 3,
                      semiannual: 6,
                      annual: 12,
                    };
                    const phase = Number((edit.nextDue || today).slice(5, 7));
                    setEdit({
                      ...edit,
                      frequency: f,
                      months:
                        f === "weekly"
                          ? []
                          : Array.from(
                              { length: 12 / interval[f] },
                              (_, i) =>
                                ((phase - 1 + i * interval[f]) % 12) + 1,
                            ).sort((a, b) => a - b),
                    });
                  }}
                >
                  {Object.entries(frequencyNames).map(([v, t]) => (
                    <option value={v} key={v}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {edit.frequency !== "weekly" && (
              <fieldset className="maintenance-months">
                <legend>Meses de referencia</legend>
                {monthNames.map((m, i) => (
                  <button
                    type="button"
                    key={m}
                    aria-pressed={edit.months.includes(i + 1)}
                    onClick={() =>
                      setEdit({
                        ...edit,
                        months: edit.months.includes(i + 1)
                          ? edit.months.filter((n) => n !== i + 1)
                          : [...edit.months, i + 1].sort((a, b) => a - b),
                      })
                    }
                  >
                    {m.slice(0, 3)}
                  </button>
                ))}
              </fieldset>
            )}
            {edit.status !== "draft" && (
              <label>
                Próxima fecha
                <input
                  type="date"
                  aria-label="Próxima fecha de mantenimiento"
                  value={edit.nextDue || ""}
                  onChange={(e) =>
                    setEdit({
                      ...edit,
                      nextDue: e.target.value,
                      anchorDay: Number(e.target.value.slice(8)) || 1,
                    })
                  }
                />
              </label>
            )}
            <div className="maintenance-form-grid">
              <label>
                Responsable
                <select
                  aria-label="Responsable de mantenimiento"
                  value={edit.owner}
                  onChange={(e) => setEdit({ ...edit, owner: e.target.value })}
                >
                  <option>Sin asignar</option>
                  {state.staff.map((s) => (
                    <option key={s.id}>{s.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Horas estimadas
                <input
                  type="number"
                  min="0.25"
                  step="0.25"
                  aria-label="Horas de mantenimiento"
                  value={edit.estimatedHours ?? ""}
                  onChange={(e) =>
                    setEdit({
                      ...edit,
                      estimatedHours: e.target.value
                        ? Number(e.target.value)
                        : null,
                    })
                  }
                />
              </label>
            </div>
            <TaskAssignee
              value={edit.assigneeId}
              onChange={(assigneeId) => setEdit({ ...edit, assigneeId })}
            />
            <label>
              Instrucciones
              <textarea
                value={edit.instructions}
                onChange={(e) =>
                  setEdit({ ...edit, instructions: e.target.value })
                }
              />
            </label>
            <label className="maintenance-check">
              <input
                type="checkbox"
                checked={edit.conditionBased}
                onChange={(e) =>
                  setEdit({ ...edit, conditionBased: e.target.checked })
                }
              />{" "}
              Inspeccionar; intervenir solo si hace falta
            </label>
            <h3>Insumos</h3>
            {edit.materials.map((m, i) => (
              <div className="maintenance-edit-material" key={i}>
                <input
                  aria-label={`Material ${i + 1}`}
                  value={m.name}
                  onChange={(e) =>
                    setEdit({
                      ...edit,
                      materials: edit.materials.map((v, j) =>
                        j === i ? { ...v, name: e.target.value } : v,
                      ),
                    })
                  }
                />
                <input
                  aria-label={`Cantidad de material ${i + 1}`}
                  value={m.quantity}
                  onChange={(e) =>
                    setEdit({
                      ...edit,
                      materials: edit.materials.map((v, j) =>
                        j === i ? { ...v, quantity: e.target.value } : v,
                      ),
                    })
                  }
                />
                <label className="maintenance-check">
                  <input
                    type="checkbox"
                    checked={m.verified}
                    onChange={(e) =>
                      setEdit({
                        ...edit,
                        materials: edit.materials.map((v, j) =>
                          j === i ? { ...v, verified: e.target.checked } : v,
                        ),
                      })
                    }
                  />{" "}
                  Compatibilidad y cantidad validadas
                </label>
              </div>
            ))}
            <button
              className="text-button"
              onClick={() =>
                setEdit({
                  ...edit,
                  materials: [
                    ...edit.materials,
                    {
                      name: "Nuevo insumo",
                      quantity: "Por confirmar",
                      verified: false,
                    },
                  ],
                })
              }
            >
              <Plus size={15} /> Agregar insumo
            </button>
            {edit.review.length > 0 && (
              <div className="maintenance-review">
                <strong>Antes de activar</strong>
                {edit.review.map((r, i) => (
                  <p key={i}>{r}</p>
                ))}
                <label className="maintenance-check">
                  <input
                    type="checkbox"
                    aria-label="Observaciones revisadas"
                    checked={reviewed}
                    onChange={(e) => setReviewed(e.target.checked)}
                  />{" "}
                  Revisé las observaciones y confirmé esta configuración.
                </label>
              </div>
            )}
            {edit.references.length > 0 && (
              <details className="maintenance-source-details">
                <summary>Referencias del archivo</summary>
                {edit.references.map((r, i) => (
                  <p key={i}>{r}</p>
                ))}
                <small>{edit.sourceRows.join(" · ")}</small>
              </details>
            )}
            {message && <p className="notice" role="alert">{message}</p>}
            <button className="primary" onClick={savePlan}>
              Guardar rutina
            </button>
          </section>
        </div>
      )}
      {confirm && (
        <div className="modal-backdrop">
          <section
            className="modal maintenance-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Confirmar mantenimiento"
          >
            <button
              className="close icon-button"
              aria-label="Cerrar confirmación"
              onClick={() => setConfirm(null)}
            >
              <X />
            </button>
            <span className="eyebrow">SOLO LO QUE SÍ SE HIZO</span>
            <h2>¿Trabajo realizado?</h2>
            <p>{data.plans.find((p) => p.id === confirm)?.title}</p>
            <p>
              Se registrará hoy, {dateLabel(today)}. La próxima fecha se calcula
              automáticamente; los períodos omitidos no se marcan como
              realizados.
            </p>
            <label>
              Nota o hallazgo (opcional)
              <textarea
                aria-label="Nota del mantenimiento"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
            <label>
              Costo real en quetzales (opcional)
              <input
                type="number"
                min="0"
                step="0.01"
                aria-label="Costo real del mantenimiento"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
              />
            </label>
            <button
              className="primary"
              onClick={() => {
                run((s) =>
                  completeMaintenance(
                    s,
                    confirm,
                    new Date(),
                    workspace?.membership.display_name ||
                      "Administrador · demo",
                    note,
                    cost === "" ? null : Number(cost),
                  ),
                );
                setConfirm(null);
              }}
            >
              Sí, registrar trabajo <Check size={16} />
            </button>
          </section>
        </div>
      )}
    </section>
  );
}
