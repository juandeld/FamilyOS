"use client";
import { useEffect, useRef, useState } from "react";
import {
  Home,
  Utensils,
  Users,
  Leaf,
  Package,
  Car,
  Heart,
  Calendar,
  Shield,
  Mic,
  ArrowUpRight,
  Plus,
  Check,
  ChevronRight,
  Camera,
  MessageCircle,
  X,
  BookOpen,
  ShoppingBag,
  Clock,
  Sun,
  Sparkles,
  Menu,
} from "lucide-react";
import {
  profiles,
  days,
  meals,
  recipes,
  initial,
  shopping,
  slot,
  rankedRecipes,
  type State,
  type Profile,
} from "../../lib/domain";
import Brand from "./brand";
import HomeDashboard from "./home-dashboard";
import RecipeArt from "./recipe-art";
import ThemeToggle from "./theme-toggle";
import { useWorkspace } from "./access-gate";
import { useHouseholdState } from "../../lib/supabase/use-household-state";
import { browserSupabase } from "../../lib/supabase/browser";
import { stockMode, type StockMode } from "../../lib/stock-policy";
import UserManagement, { TaskAssignee } from "./user-management";
import WeeklyShopping from "./weekly-shopping";
import Pantry from "./pantry";
import { preparationMovements } from "../../lib/pantry";
import MeatShopping from "./meat-shopping";
const navigation = [
  ["Inicio", Home],
  ["Nutrición", Utensils],
  ["Personal", Users],
  ["Casa", Leaf],
  ["Inventario", Package],
  ["Niños", Heart],
  ["Vehículos", Car],
  ["Experiencias", Sun],
  ["Documentos", Shield],
  ["Salud", Heart],
] as const;
export default function FamilyApp() {
  const workspace = useWorkspace();
  const {
    state,
    setState,
    ready,
    status,
    error: syncError,
    reload,
    retry,
    pending,
  } = useHouseholdState(workspace);
  const [page, setPage] = useState("Inicio"),
    [tab, setTab] = useState("Plan semanal"),
    [profile, setProfile] = useState<Profile>("Juan"),
    [day, setDay] = useState("Lunes"),
    [meal, setMeal] = useState("Almuerzo"),
    [modal, setModal] = useState(""),
    [text, setText] = useState(""),
    [toast, setToast] = useState(""),
    [mobile, setMobile] = useState(false),
    [photo, setPhoto] = useState("");
  const [clock, setClock] = useState<Date | null>(null);
  const drawer = useRef<HTMLElement>(null);
  useEffect(() => {
    setClock(new Date());
  }, []);
  useEffect(() => {
    if (!mobile) return;
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    const frame = requestAnimationFrame(() =>
      drawer.current?.querySelector<HTMLButtonElement>("button")?.focus(),
    );
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMobile(false);
        return;
      }
      if (event.key !== "Tab") return;
      const items = drawer.current?.querySelectorAll<HTMLElement>(
        "a[href], button:not([disabled]), select, input",
      );
      if (!items?.length) return;
      const first = items[0],
        last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus({ preventScroll: true });
    };
  }, [mobile]);
  useEffect(() => {
    if ("serviceWorker" in navigator)
      navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(""), 4500);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  const update = (patch: Partial<State>) =>
    setState((s) => ({ ...s, ...patch }));
  const go = (p: string) => {
    setPage(p);
    setMobile(false);
    window.scrollTo({ top: 0, behavior: "auto" });
  };
  const notify = (t: string) => setToast(t);
  const open = (m: string) => {
    setText("");
    setPhoto("");
    setModal(m);
  };
  const addTask = () => {
    if (!text.trim()) return;
    update({
      tasks: [
        ...state.tasks,
        {
          id: crypto.randomUUID(),
          title: text,
          owner: state.staff[0]?.name || "Sin asignar",
          frequency: "Extraordinaria",
          assigneeId: "",
          done: false,
        },
      ],
    });
    setModal("");
  };
  const confirmMeal = (key: string, id: string) => {
    const r = recipes.find((x) => x.id === id)!;
    const sourceId = crypto.randomUUID();
    const now = new Date();
    const preparation = {
      id: sourceId,
      name: r.name,
      recipeId: r.id,
      preparedAt: now.toISOString(),
      recipeSnapshot: {
        id: r.id,
        name: r.name,
        meal: r.meal,
        ingredients: r.ingredients.map((i) => ({ ...i })),
        macros: { ...r.macros },
      },
      person: key.split("|")[0],
      date: now.toLocaleString("es-GT", { timeZone: "America/Guatemala" }),
      feedback: "",
    };
    setState((s) => ({
      ...s,
      history: [preparation, ...s.history],
      stockMovements: [
        ...s.stockMovements,
        ...preparationMovements(
          sourceId,
          now.toISOString(),
          r.ingredients,
          s.stockMovements,
          s.stockPolicies,
        ),
      ],
    }));
    notify(
      workspace
        ? "Preparación pendiente de sincronizar."
        : "Preparación registrada: se descontaron los productos controlados.",
    );
  };
  const policyChange = (key: string, mode: StockMode) =>
    setState((s) => ({
      ...s,
      stockPolicies: {
        ...s.stockPolicies,
        [key]: { mode, since: new Date().toISOString() },
      },
    }));
  if (!ready)
    return (
      <div className="access-loading">
        <h1>Cargando tu casa…</h1>
        {syncError && (
          <>
            <p role="alert">{syncError}</p>
            <button className="primary" onClick={reload}>
              Reintentar
            </button>
          </>
        )}
      </div>
    );
  return (
    <div className="shell" data-page={page}>
      {mobile && (
        <button
          className="drawer-scrim"
          aria-label="Cerrar navegación"
          onClick={() => setMobile(false)}
        />
      )}
      <aside
        id="module-menu"
        ref={drawer}
        role={mobile ? "dialog" : undefined}
        aria-modal={mobile ? true : undefined}
        aria-label="Todos los módulos"
        className={mobile ? "sidebar visible" : "sidebar"}
      >
        <button
          className="drawer-close icon-button"
          aria-label="Cerrar menú"
          onClick={() => setMobile(false)}
        >
          <X size={20} />
        </button>
        <a className="brand" href="#" onClick={() => go("Inicio")}>
          <Brand />
          <span className="brand-section">
            LIVING<span>LIMA TORALLA</span>
          </span>
        </a>
        <div className="household">
          <span className="family-avatar">LT</span>
          <div>
            Lima Toralla
            <small>
              Guatemala <span className="dot" />{" "}
              {workspace ? "Casa privada" : "Demostración"}
            </small>
          </div>
        </div>
        <div className="nav-label">LA CASA, EN CALMA</div>
        <nav aria-label="Navegación principal">
          {navigation.map(([name, Icon], i) => (
            <button
              key={name}
              className={page === name ? "nav-item active" : "nav-item"}
              aria-current={page === name ? "page" : undefined}
              onClick={() => go(name)}
            >
              <Icon size={19} />
              {name}
              {i > 3 && name !== "Inventario" && (
                <span className="nav-proto">Pronto</span>
              )}
              {name === "Nutrición" && <span className="little-dot" />}
            </button>
          ))}
          {workspace && (
            <button
              className={page === "Usuarios" ? "nav-item active" : "nav-item"}
              onClick={() => go("Usuarios")}
            >
              <Shield size={19} />
              Usuarios y permisos
            </button>
          )}
        </nav>
        <div className="sidebar-bottom">
          <div className="privacy">
            <Shield size={16} /> Tu familia, tu espacio.
          </div>
          <button className="user" onClick={() => open("Sobre esta demo")}>
            <span className="avatar">
              {workspace?.membership.display_name
                .split(" ")
                .map((n) => n[0])
                .join("") || "JD"}
            </span>
            <div>
              {workspace?.membership.display_name || "Juan"}
              <small>
                {workspace ? "Administrador" : "Administrador · demo"}
              </small>
            </div>
            <ChevronRight size={16} />
          </button>
        </div>
      </aside>
      <main>
        <header>
          <button
            className="mobile-menu icon-button"
            aria-label="Abrir navegación"
            aria-expanded={mobile}
            aria-controls="module-menu"
            onClick={() => setMobile(!mobile)}
          >
            <Menu />
          </button>
          <div className="breadcrumb">
            <Brand /> <span className="breadcrumb-section">{page}</span>
          </div>
          <div className="header-right">
            <ThemeToggle />
            <span className="demo-badge">
              {workspace ? "CASA PRIVADA" : "DATOS FICTICIOS"}
            </span>
            <span className="location">
              {clock
                ? new Intl.DateTimeFormat("es-GT", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    timeZone: "America/Guatemala",
                  }).format(clock)
                : "Guatemala, GT"}
            </span>
            <span className="avatar small">
              {workspace?.membership.display_name
                .split(" ")
                .map((n) => n[0])
                .join("") || "JD"}
            </span>
          </div>
        </header>
        <div className="content">
          <div className="workspace-bar">
            <span>{status}</span>
            {workspace ? (
              <>
                <span>{workspace.membership.display_name} · Administrador</span>
                <a href="/demo">Demo separada</a>
                <button
                  className="text-button"
                  onClick={() => {
                    if (
                      !pending ||
                      window.confirm(
                        "Hay cambios sin guardar. ¿Cerrar sesión y descartarlos?",
                      )
                    )
                      browserSupabase().auth.signOut();
                  }}
                >
                  Cerrar sesión
                </button>
              </>
            ) : (
              <a href="/login">Acceso privado</a>
            )}
          </div>
          {syncError && (
            <div className="notice" role="alert">
              {syncError}
              <div>
                <button className="text-button" onClick={retry}>
                  Reintentar guardado
                </button>
                <button className="text-button" onClick={reload}>
                  Cargar cambios compartidos
                </button>
              </div>
            </div>
          )}
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                {page === "Inicio"
                  ? `BIENVENIDO, ${workspace?.membership.display_name.split(" ")[0] || "JUAN"}`
                  : "TODO EN SU LUGAR"}
              </div>
              <h1>
                {page === "Inicio"
                  ? "Hoy en casa"
                  : page === "Nutrición"
                    ? "Comer bien, vivir mejor."
                    : page === "Personal"
                      ? "Un gran equipo en casa."
                      : page === "Casa"
                        ? "Cada detalle, bajo cuidado."
                        : page}
              </h1>
              <p>
                {page === "Inicio"
                  ? "Lo importante, en orden. Tu día, más ligero."
                  : page === "Nutrición"
                    ? "Un menú para cada persona. Una cocina para todos."
                    : "Organiza lo importante con sencillez."}
              </p>
            </div>
            <span className="date-chip">
              <Calendar size={16} />{" "}
              {workspace ? "Tu planificación" : "Semana de prueba"}
            </span>
          </div>
          {page === "Inicio" && (
            <HomeDashboard
              state={state}
              go={go}
              open={open}
              onPlan={() => {
                go("Nutrición");
                setTab("Plan semanal");
              }}
              onShop={() => {
                go("Nutrición");
                setTab("Compras");
              }}
              onTask={(id, done) =>
                update({
                  tasks: state.tasks.map((t) =>
                    t.id === id ? { ...t, done } : t,
                  ),
                })
              }
            />
          )}
          {page === "Nutrición" && (
            <>
              <section className="nutrition-intro">
                <span className="nutrition-intro-icon">
                  <Utensils size={25} />
                </span>
                <div>
                  <span className="eyebrow">LA COCINA, ORGANIZADA</span>
                  <h2>Buenos platos. Mejores semanas.</h2>
                  <p>
                    {Object.keys(state.plan).length
                      ? `${Object.keys(state.plan).length} platos elegidos para la familia.`
                      : "Elige lo que les gusta. Nosotros reunimos los ingredientes."}
                  </p>
                </div>
                <button
                  onClick={() => setTab("Cocina")}
                  className="nutrition-intro-button"
                >
                  Ver en cocina <ArrowUpRight size={17} />
                </button>
              </section>
              <div className="tabs" aria-label="Secciones de nutrición">
                {[
                  "Plan semanal",
                  "Cocina",
                  "Compras",
                  "Despensa",
                  "Recetario",
                  "Historial",
                  "Perfiles",
                ].map((t) => (
                  <button
                    className={tab === t ? "selected" : ""}
                    onClick={() => setTab(t)}
                    aria-pressed={tab === t}
                    key={t}
                  >
                    {t}
                  </button>
                ))}
              </div>
              {![
                "Cocina",
                "Compras",
                "Despensa",
                "Historial",
                "Recetario",
              ].includes(tab) && (
                <div className="profile-row">
                  {profiles.map((p, i) => (
                    <button
                      className={profile === p ? "profile selected" : "profile"}
                      onClick={() => setProfile(p)}
                      aria-pressed={profile === p}
                      key={p}
                    >
                      <span className={"profile-face face-" + i}>
                        {p
                          .split(" ")
                          .map((w) => w[0])
                          .join("")}
                      </span>
                      {p}
                      <small>
                        {i < 2
                          ? "Objetivos individuales"
                          : "Modo menú · sin macros"}
                      </small>
                    </button>
                  ))}
                </div>
              )}
              {tab === "Plan semanal" && (
                <>
                  <div className="planning-heading">
                    <div>
                      <span className="eyebrow">
                        EL PLAN DE {profile.toUpperCase()}
                      </span>
                      <strong>
                        {
                          Object.keys(state.plan).filter((k) =>
                            k.startsWith(profile + "|"),
                          ).length
                        }
                        <span> / 21 comidas</span>
                      </strong>
                    </div>
                    <div
                      className="planning-progress"
                      role="progressbar"
                      aria-label={`Plan semanal de ${profile}`}
                      aria-valuenow={
                        Object.keys(state.plan).filter((k) =>
                          k.startsWith(profile + "|"),
                        ).length
                      }
                      aria-valuemin={0}
                      aria-valuemax={21}
                    >
                      <span
                        style={{
                          width: `${(Object.keys(state.plan).filter((k) => k.startsWith(profile + "|")).length / 21) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                  <div className="toolbar recipe-toolbar">
                    <div>
                      <h2>Algo delicioso para {profile}</h2>
                      <p>
                        10 propuestas por tiempo · ordenadas por gustos y
                        opiniones
                      </p>
                    </div>
                    <div className="selects">
                      <select
                        aria-label="Día"
                        value={day}
                        onChange={(e) => setDay(e.target.value)}
                      >
                        {days.map((d) => (
                          <option key={d}>{d}</option>
                        ))}
                      </select>
                      <select
                        aria-label="Tiempo de comida"
                        value={meal}
                        onChange={(e) => setMeal(e.target.value)}
                      >
                        {meals.map((m) => (
                          <option key={m}>{m}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="week-strip">
                    {days.map((d) => (
                      <button
                        key={d}
                        onClick={() => setDay(d)}
                        className={day === d ? "chosen" : ""}
                        aria-pressed={day === d}
                      >
                        <small>{d.slice(0, 3)}</small>
                        <strong>
                          {
                            Object.keys(state.plan).filter((k) =>
                              k.startsWith(`${profile}|${d}|`),
                            ).length
                          }
                          /3
                        </strong>
                        <span>
                          {recipes.find(
                            (r) => r.id === state.plan[slot(profile, d, meal)],
                          )?.name || "Elegir plato"}
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className="recipe-grid">
                    {rankedRecipes(
                      recipes.filter((r) => r.meal === meal),
                      profile,
                      state.preferences[profile],
                      state.history,
                    ).map((r, i) => (
                      <article
                        className={
                          state.plan[slot(profile, day, meal)] === r.id
                            ? "recipe is-planned"
                            : "recipe"
                        }
                        key={r.id}
                      >
                        <div className={"food-art food-" + (i % 5)}>
                          <RecipeArt variant={i} meal={meal} name={r.name} />
                          <span className="recipe-meal-tag">
                            {state.plan[slot(profile, day, meal)] === r.id ? (
                              <>
                                <Check size={12} /> En tu {day.toLowerCase()}
                              </>
                            ) : (
                              meal
                            )}
                          </span>
                          <small>ILUSTRACIÓN</small>
                        </div>
                        <div className="recipe-body">
                          <small>
                            <Clock size={12} /> {r.minutes} min · 1 porción
                          </small>
                          <h3>{r.name}</h3>
                          <p>
                            {profile === "Juan" || profile === "Pamela"
                              ? `${r.macros.kcal} kcal · ${r.macros.protein} g proteína estimada`
                              : "Menú infantil · porción a confirmar por adulto"}
                          </p>
                          <div className="recipe-actions">
                            <button
                              className="primary compact"
                              aria-pressed={
                                state.plan[slot(profile, day, meal)] === r.id
                              }
                              onClick={() => {
                                update({
                                  plan: {
                                    ...state.plan,
                                    [slot(profile, day, meal)]: r.id,
                                  },
                                });
                                notify(`${r.name}: ${day}, ${profile}`);
                              }}
                            >
                              {state.plan[slot(profile, day, meal)] === r.id ? (
                                <Check size={15} />
                              ) : (
                                <Plus size={15} />
                              )}{" "}
                              {state.plan[slot(profile, day, meal)] === r.id
                                ? "Seleccionado"
                                : "Elegir"}
                            </button>
                            <button
                              aria-label={`Guardar ${r.name}`}
                              className="icon-button"
                              onClick={() => {
                                update({
                                  favorites: state.favorites.includes(r.id)
                                    ? state.favorites.filter(
                                        (id) => id !== r.id,
                                      )
                                    : [...state.favorites, r.id],
                                });
                                notify("Recetario actualizado");
                              }}
                            >
                              <BookOpen
                                size={18}
                                fill={
                                  state.favorites.includes(r.id)
                                    ? "var(--terracota)"
                                    : "none"
                                }
                              />
                            </button>
                            <button
                              className="text-button"
                              onClick={() => open("receta:" + r.id)}
                            >
                              Ver
                            </button>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </>
              )}
              {tab === "Cocina" && (
                <section className="panel">
                  <h2>Menú operativo de cocina</h2>
                  <p>
                    Solo platos, porciones e instrucciones. Sin objetivos
                    nutricionales privados. Confirmar descuenta los ingredientes
                    de una porción base en la despensa; confirma cada porción
                    realmente preparada una sola vez.
                  </p>
                  {Object.entries(state.plan).length === 0 ? (
                    <Empty text="Elige platos en el plan semanal para preparar el menú de cocina." />
                  ) : (
                    Object.entries(state.plan).map(([key, id]) => {
                      const r = recipes.find((r) => r.id === id)!;
                      return (
                        <article className="cook-row" key={key}>
                          <small>
                            {key.split("|").join(" · ")} · 1 porción
                          </small>
                          <h3>{r.name}</h3>
                          <p>
                            {r.ingredients
                              .map((i) => `${i.quantity} ${i.unit} ${i.name}`)
                              .join(" · ")}
                            . Pesos de ingredientes crudos; rendimiento cocido
                            no calculado.
                          </p>
                          <ol>
                            {r.steps.map((s) => (
                              <li key={s}>{s}</li>
                            ))}
                          </ol>
                          <button
                            className="primary compact"
                            onClick={() => confirmMeal(key, id)}
                          >
                            <Check size={16} /> Confirmar preparación
                          </button>
                          <button
                            className="text-button"
                            onClick={() => {
                              const plan = { ...state.plan };
                              delete plan[key];
                              update({ plan });
                            }}
                          >
                            Quitar del plan
                          </button>
                        </article>
                      );
                    })
                  )}
                </section>
              )}
              {tab === "Compras" && (
                <>
                  <MeatShopping
                    policies={state.stockPolicies}
                    stockMovements={state.stockMovements}
                    history={state.history}
                    goals={state.goals}
                    period={state.purchasePeriod}
                    onPeriodChange={(purchasePeriod) =>
                      update({ purchasePeriod })
                    }
                    onGoPlan={() => setTab("Plan semanal")}
                    onGoProfiles={() => setTab("Perfiles")}
                  />
                  <WeeklyShopping
                    policies={state.stockPolicies}
                    plan={state.plan}
                    movements={state.stockMovements}
                    checkedItems={state.checkedItems}
                    onToggle={(name) =>
                      update({
                        checkedItems: state.checkedItems.includes(name)
                          ? state.checkedItems.filter((x) => x !== name)
                          : [...state.checkedItems, name],
                      })
                    }
                    onGoPantry={() => setTab("Despensa")}
                  />
                </>
              )}
              {tab === "Despensa" && (
                <Pantry
                  policies={state.stockPolicies}
                  onPolicyChange={policyChange}
                  movements={state.stockMovements}
                  onRecord={(movement) =>
                    setState((s) => ({
                      ...s,
                      stockMovements: [...s.stockMovements, movement],
                    }))
                  }
                />
              )}
              {tab === "Recetario" && (
                <section className="panel">
                  <h2>Recetario familiar</h2>
                  <p>Solo los platos que guardas expresamente.</p>
                  {state.favorites.length ? (
                    state.favorites.map((id) => {
                      const r = recipes.find((x) => x.id === id)!;
                      return (
                        <div className="list-row" key={id}>
                          <strong>{r.name}</strong>
                          <button
                            className="text-button"
                            onClick={() => open("receta:" + id)}
                          >
                            Ver receta
                          </button>
                        </div>
                      );
                    })
                  ) : (
                    <Empty text="Guarda una propuesta con el icono de recetario." />
                  )}
                </section>
              )}
              {tab === "Historial" && (
                <section className="panel">
                  <h2>Comidas preparadas</h2>
                  <p>
                    Confirmar preparación no confirma consumo ni agrega la
                    receta al recetario.
                  </p>
                  {state.history.length ? (
                    state.history.map((h) => (
                      <div className="history-row" key={h.id}>
                        <h3>{h.name}</h3>
                        <small>
                          {h.person} ·{" "}
                          {h.preparedAt
                            ? new Date(h.preparedAt).toLocaleString("es-GT", {
                                timeZone: "America/Guatemala",
                              })
                            : h.date}
                        </small>
                        <input
                          aria-label={`Opinión de ${h.person}`}
                          placeholder="Opinión: menos sal, me encantó…"
                          value={h.feedback}
                          onChange={(e) =>
                            update({
                              history: state.history.map((x) =>
                                x.id === h.id
                                  ? { ...x, feedback: e.target.value }
                                  : x,
                              ),
                            })
                          }
                        />
                      </div>
                    ))
                  ) : (
                    <Empty text="Las preparaciones confirmadas aparecerán aquí." />
                  )}
                </section>
              )}
              {tab === "Perfiles" && (
                <section className="panel">
                  <h2>Preferencias de {profile}</h2>
                  {profile === "Juan" || profile === "Pamela" ? (
                    <>
                      <p>
                        Objetivos de demostración, editables. No constituyen
                        recomendación médica. Las propuestas no se recalculan
                        automáticamente.
                      </p>
                      <div className="goals">
                        {Object.entries(state.goals[profile]).map(
                          ([key, value]) => (
                            <label key={key}>
                              {
                                (
                                  {
                                    kcal: "Calorías",
                                    protein: "Proteína (g)",
                                    carbs: "Carbohidratos (g)",
                                    fat: "Grasas (g)",
                                  } as Record<string, string>
                                )[key]
                              }
                              <input
                                type="number"
                                min="0"
                                value={value}
                                onChange={(e) =>
                                  update({
                                    goals: {
                                      ...state.goals,
                                      [profile]: {
                                        ...state.goals[profile],
                                        [key]: Math.max(
                                          0,
                                          Number(e.target.value),
                                        ),
                                      },
                                    },
                                  })
                                }
                              />
                            </label>
                          ),
                        )}
                      </div>
                    </>
                  ) : (
                    <p>
                      Modo menú infantil. No se muestran ni configuran calorías
                      o macros.
                    </p>
                  )}
                  <label>
                    Gustos y preferencias (una sola vez)
                    <textarea
                      value={state.preferences[profile]}
                      onChange={(e) =>
                        update({
                          preferences: {
                            ...state.preferences,
                            [profile]: e.target.value,
                          },
                        })
                      }
                      placeholder="Prefiere pollo, poco picante…"
                    />
                  </label>
                  <p>
                    Las propuestas se ordenan por palabras de tus gustos y
                    opiniones positivas o negativas de tu historial. Es una
                    regla local sencilla; no hay IA conectada ni ajuste
                    automático a objetivos nutricionales.
                  </p>
                </section>
              )}
            </>
          )}
          {page === "Personal" && (
            <>
              <div className="toolbar">
                <h2>Las personas que cuidan tu casa</h2>
                <button
                  className="primary compact"
                  onClick={() => open("Agregar persona")}
                >
                  <Plus size={16} /> Persona
                </button>
              </div>
              <div className="people-grid">
                {state.staff.map((s) => (
                  <section className="panel" key={s.id}>
                    <span className="profile-face">
                      {s.name
                        .split(" ")
                        .map((x) => x[0])
                        .join("")}
                    </span>
                    <h3>{s.name}</h3>
                    <p>{s.role}</p>
                    <label>
                      Memoria y notas
                      <textarea
                        value={s.note}
                        onChange={(e) =>
                          update({
                            staff: state.staff.map((x) =>
                              x.id === s.id
                                ? { ...x, note: e.target.value }
                                : x,
                            ),
                          })
                        }
                      />
                    </label>
                    <small>
                      Datos ficticios · no registrar información sensible.
                    </small>
                  </section>
                ))}
              </div>
              <Tasks
                state={state}
                update={update}
                add={() => open("Nueva tarea")}
              />
            </>
          )}
          {page === "Casa" && (
            <>
              <div className="toolbar">
                <h2>Activos de la casa</h2>
                <button
                  className="primary compact"
                  onClick={() => open("Agregar activo")}
                >
                  <Plus size={16} /> Activo
                </button>
              </div>
              <div className="people-grid">
                {state.assets.map((a) => (
                  <section className="panel" key={a.id}>
                    <span className="tile-icon lavender">
                      <Home />
                    </span>
                    <h3>{a.name}</h3>
                    <textarea
                      aria-label="Ficha del activo"
                      value={a.detail}
                      onChange={(e) =>
                        update({
                          assets: state.assets.map((x) =>
                            x.id === a.id
                              ? { ...x, detail: e.target.value }
                              : x,
                          ),
                        })
                      }
                    />
                    <small>
                      No se generan mantenimientos técnicos sin manual
                      verificado.
                    </small>
                  </section>
                ))}
              </div>
              <Tasks
                state={state}
                update={update}
                add={() => open("Nueva tarea")}
              />
            </>
          )}
          {page === "Inventario" && (
            <Pantry
              policies={state.stockPolicies}
              onPolicyChange={policyChange}
              movements={state.stockMovements}
              onRecord={(movement) =>
                setState((s) => ({
                  ...s,
                  stockMovements: [...s.stockMovements, movement],
                }))
              }
            />
          )}
          {page === "Usuarios" && workspace && <UserManagement />}
          {![
            "Inicio",
            "Nutrición",
            "Personal",
            "Casa",
            "Inventario",
            "Usuarios",
          ].includes(page) && (
            <section className="panel prototype">
              <span className="pill">PROTOTIPO · PRÓXIMAMENTE</span>
              <h2>{page}, con el mismo cuidado.</h2>
              <p>
                Este módulo aún no tiene funciones operativas ni conexiones
                externas.
              </p>
              <p>
                {page === "Salud"
                  ? "Los expedientes médicos requerirán permisos por persona, controles especiales para menores y auditoría. No se diagnostican condiciones ni se modifican tratamientos."
                  : "La primera versión se concentra en nutrición, personal y operación de la casa."}
              </p>
              <button className="primary" onClick={() => go("Nutrición")}>
                Planear la semana <ArrowUpRight size={16} />
              </button>
            </section>
          )}
          <section className="capture-bar">
            <div>
              <span className="round-icon">
                <Sparkles size={18} />
              </span>
              <div>
                <strong>Una idea, una nota, un pendiente.</strong>
                <small>
                  Captúralo en un momento · simulaciones de demostración
                </small>
              </div>
            </div>
            <div>
              <button onClick={() => open("Voz simulada")}>
                <Mic size={18} /> Voz
              </button>
              <button onClick={() => open("WhatsApp simulado")}>
                <MessageCircle size={18} /> WhatsApp
              </button>
              <button onClick={() => open("Foto simulada")}>
                <Camera size={18} /> Foto
              </button>
            </div>
          </section>
          {state.notes.length > 0 && (
            <section className="panel">
              <h3>Bandeja de notas · pendientes de clasificar</h3>
              {state.notes.map((n, i) => (
                <p key={i}>{n}</p>
              ))}
            </section>
          )}
          <footer>
            LT Living <span>Calma · Herencia · Discreción.</span>
            <small>
              {workspace
                ? "Casa privada · Supabase"
                : "Demo local · sin conexiones externas"}
            </small>
          </footer>
        </div>
      </main>
      <div
        className="mobile-bottom-nav"
        role="group"
        aria-label="Accesos rápidos"
      >
        <button
          aria-label="Ir al inicio"
          className={page === "Inicio" ? "active" : ""}
          onClick={() => go("Inicio")}
        >
          <Home size={21} />
          <span>Inicio</span>
        </button>
        <button
          aria-label="Abrir cocina"
          className={page === "Nutrición" ? "active" : ""}
          onClick={() => {
            go("Nutrición");
            setTab("Plan semanal");
          }}
        >
          <Utensils size={21} />
          <span>Cocina</span>
        </button>
        <button
          className="bottom-voice"
          aria-label="Abrir voz simulada"
          onClick={() => open("Voz simulada")}
        >
          <Mic size={24} />
          <span>Pedir algo</span>
        </button>
        <button
          aria-label="Abrir equipo de casa"
          className={page === "Personal" ? "active" : ""}
          onClick={() => go("Personal")}
        >
          <Users size={21} />
          <span>Equipo</span>
        </button>
        <button
          aria-label="Ver todos los módulos"
          aria-expanded={mobile}
          aria-controls="module-menu"
          className={
            !["Inicio", "Nutrición", "Personal"].includes(page) ? "active" : ""
          }
          onClick={() => setMobile(true)}
        >
          <Menu size={21} />
          <span>Más</span>
        </button>
      </div>
      <button
        className="desktop-voice"
        aria-label="Abrir voz simulada en escritorio"
        onClick={() => open("Voz simulada")}
      >
        <Mic size={19} /> Pedir algo
      </button>
      {toast && (
        <div className="toast" role="status">
          <Check size={18} />
          {toast}
        </div>
      )}
      {modal && (
        <div className="modal-backdrop" onClick={() => setModal("")}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={modal}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="close icon-button"
              aria-label="Cerrar"
              onClick={() => setModal("")}
            >
              <X />
            </button>
            {modal.startsWith("receta:") ? (
              (() => {
                const r = recipes.find((r) => r.id === modal.split(":")[1])!;
                return (
                  <>
                    <span className="pill">RECETA ILUSTRATIVA</span>
                    <h2>{r.name}</h2>
                    <p>1 porción · {r.minutes} minutos</p>
                    <h3>Ingredientes · peso crudo</h3>
                    {r.ingredients.map((i) => (
                      <p key={i.name}>
                        {i.quantity} {i.unit} · {i.name}
                      </p>
                    ))}
                    <ol>
                      {r.steps.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ol>
                    <p className="notice">
                      La demo usa bases genéricas. Validar cantidades, alergias,
                      cocción y adecuación nutricional antes de cocinar.
                    </p>
                  </>
                );
              })()
            ) : modal === "Sobre esta demo" ? (
              <>
                <h2>Tu espacio de prueba</h2>
                <p>
                  {workspace
                    ? "Los datos de este hogar se guardan en Supabase. Los administradores comparten cambios; los colaboradores acceden únicamente a sus permisos. Los macros del catálogo siguen siendo ilustrativos."
                    : "Los datos de esta demo se guardan únicamente en este navegador. No hay sincronización ni servicios externos. No cargues información real o sensible."}
                </p>
              </>
            ) : (
              <>
                <span className="pill">
                  {modal.includes("simulad")
                    ? "SIMULACIÓN · SIN CONEXIÓN EXTERNA"
                    : "EDICIÓN LOCAL"}
                </span>
                <h2>{modal}</h2>
                {modal === "Foto simulada" && (
                  <>
                    <p>
                      El archivo no se envía ni se analiza. Escribe lo que
                      quieres registrar; no se infieren marcas, cantidades o
                      modelos.
                    </p>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={(e) =>
                        setPhoto(e.target.files?.[0]?.name || "")
                      }
                    />
                    {photo && <p>Archivo seleccionado: {photo}</p>}
                  </>
                )}
                {modal === "Voz simulada" && (
                  <>
                    <div className="voice-orb">
                      <Mic size={32} />
                    </div>
                    <p>
                      Escribe una frase como si la hubieras dictado. No se graba
                      ni transcribe audio.
                    </p>
                    <button
                      className="suggestion"
                      onClick={() =>
                        setText("Preparar el menú del lunes para Juan")
                      }
                    >
                      “Preparar el menú del lunes para Juan”
                    </button>
                  </>
                )}
                {modal === "WhatsApp simulado" && (
                  <p>
                    Nota local de prueba. No se recibe ni envía ningún mensaje
                    por WhatsApp.
                  </p>
                )}
                <label>
                  {modal === "Agregar persona"
                    ? "Nombre de la persona"
                    : modal === "Agregar activo"
                      ? "Nombre del activo"
                      : "¿Qué quieres recordar?"}
                  <textarea
                    autoFocus
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Escribe aquí…"
                  />
                </label>
                <button
                  disabled={!text.trim()}
                  className="primary"
                  onClick={() => {
                    if (modal === "Nueva tarea") return addTask();
                    if (modal === "Agregar persona")
                      update({
                        staff: [
                          ...state.staff,
                          {
                            id: crypto.randomUUID(),
                            name: text.trim(),
                            role: "Rol por definir",
                            note: "",
                          },
                        ],
                      });
                    else if (modal === "Agregar activo")
                      update({
                        assets: [
                          ...state.assets,
                          {
                            id: crypto.randomUUID(),
                            name: text.trim(),
                            detail:
                              "Identificación y manual pendientes de verificar.",
                          },
                        ],
                      });
                    else
                      update({
                        notes: [...state.notes, `${modal}: ${text.trim()}`],
                      });
                    setModal("");
                    notify("Cambio registrado.");
                  }}
                >
                  Guardar {modal.includes("simulad") ? "nota local" : ""}
                  <Check size={16} />
                </button>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <div className="empty">
      <Leaf size={28} />
      <p>{text}</p>
    </div>
  );
}
function Tasks({
  state,
  update,
  add,
}: {
  state: State;
  update: (patch: Partial<State>) => void;
  add: () => void;
}) {
  return (
    <section className="panel tasks">
      <div className="section-title">
        <h2>Rutinas y pendientes</h2>
        <button className="text-button" onClick={add}>
          <Plus size={16} /> Agregar tarea
        </button>
      </div>
      {state.tasks.map((t) => (
        <div className="task" key={t.id}>
          <input
            type="checkbox"
            aria-label={`Completar ${t.title}`}
            checked={t.done}
            onChange={() =>
              update({
                tasks: state.tasks.map((x) =>
                  x.id === t.id ? { ...x, done: !x.done } : x,
                ),
              })
            }
          />
          <div>
            <strong className={t.done ? "completed" : ""}>{t.title}</strong>
            <small>
              <select
                aria-label={`Frecuencia de ${t.title}`}
                value={t.frequency}
                onChange={(e) =>
                  update({
                    tasks: state.tasks.map((x) =>
                      x.id === t.id ? { ...x, frequency: e.target.value } : x,
                    ),
                  })
                }
              >
                {[
                  ...new Set([
                    t.frequency,
                    "Diaria",
                    "Semanal",
                    "Mensual",
                    "Extraordinaria",
                  ]),
                ].map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>{" "}
              · confirmación manual, sin avisos automáticos
            </small>
          </div>
          <TaskAssignee
            value={t.assigneeId || ""}
            onChange={(assigneeId) =>
              update({
                tasks: state.tasks.map((x) =>
                  x.id === t.id ? { ...x, assigneeId } : x,
                ),
              })
            }
          />
          <select
            aria-label="Responsable"
            value={t.owner}
            onChange={(e) =>
              update({
                tasks: state.tasks.map((x) =>
                  x.id === t.id ? { ...x, owner: e.target.value } : x,
                ),
              })
            }
          >
            {state.staff.map((s) => (
              <option key={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      ))}
    </section>
  );
}
