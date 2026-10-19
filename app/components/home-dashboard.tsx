import {
  ArrowUpRight,
  ArrowRight,
  Mic,
  ChevronRight,
  Utensils,
  Users,
  Leaf,
  ShoppingBag,
  Camera,
  MessageCircle,
  Check,
  Plus,
  CalendarDays,
} from "lucide-react";
import type { State } from "../../lib/domain";
import { recipes, days, profiles } from "../../lib/domain";
import RecipeArt from "./recipe-art";
type Props = {
  state: State;
  go: (page: string) => void;
  open: (modal: string) => void;
  onPlan: () => void;
  onShop: () => void;
  onTask: (id: string, done: boolean) => void;
};
export default function HomeDashboard({
  state,
  go,
  open,
  onPlan,
  onShop,
  onTask,
}: Props) {
  const total = Object.keys(state.plan).length;
  const tasks = state.tasks.filter((t) => !t.done);
  const visibleTasks = state.tasks.slice(0, 3);
  const first = Object.entries(state.plan)[0];
  const dish = first && recipes.find((r) => r.id === first[1]);
  return (
    <div className="home-layout">
      <div className="home-primary">
        <section className="living-feature">
          <div className="feature-photo" aria-hidden="true" />
          <div className="feature-shade" />
          <div className="feature-content">
            <span className="feature-label">
              <span /> TU CASA. TU RITMO.
            </span>
            <h2>
              Menos pendientes.
              <br />
              <em>Más vida.</em>
            </h2>
            <p>
              Lo importante, a tiempo.
              <br />
              Los tuyos, más cerca.
            </p>
            <button className="feature-link" onClick={onPlan}>
              Organicemos la semana <ArrowUpRight size={18} />
            </button>
          </div>
          <span className="feature-footnote">Un espacio para vivir mejor</span>
        </section>
        <section className="voice-dock" aria-label="Pedir algo a LT Living">
          <button className="voice-main" onClick={() => open("Voz simulada")}>
            <span className="voice-icon">
              <Mic size={23} />
            </span>
            <span>
              ¿Qué necesitas hoy?
              <small>Cuéntamelo. Lo organizamos juntos.</small>
            </span>
            <span className="voice-wave" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
              <i />
            </span>
          </button>
          <div className="voice-quick">
            <span>Voz de prueba · sin grabación</span>
            <button
              aria-label="Registrar foto de prueba"
              onClick={() => open("Foto simulada")}
            >
              <Camera size={17} />
            </button>
            <button
              aria-label="Abrir notas de WhatsApp de prueba"
              onClick={() => open("WhatsApp simulado")}
            >
              <MessageCircle size={17} />
            </button>
          </div>
        </section>
        <div className="section-title dashboard-section-title">
          <div>
            <span className="eyebrow">A TU MANERA</span>
            <h2>Una casa que funciona.</h2>
          </div>
          <span>Sin complicarte.</span>
        </div>
        <div className="quick-spaces">
          <button className="space-card space-kitchen" onClick={onPlan}>
            <span className="space-icon">
              <Utensils size={23} />
            </span>
            <ArrowUpRight className="space-arrow" size={18} />
            <span className="space-title">La cocina</span>
            <small>
              {total
                ? `${total} platos planificados`
                : "Algo rico empieza aquí"}
            </small>
          </button>
          <button className="space-card" onClick={() => go("Personal")}>
            <span className="space-icon">
              <Users size={23} />
            </span>
            <ArrowUpRight className="space-arrow" size={18} />
            <span className="space-title">Tu equipo</span>
            <small>{tasks.length} por confirmar</small>
          </button>
          <button className="space-card" onClick={() => go("Casa")}>
            <span className="space-icon">
              <Leaf size={23} />
            </span>
            <ArrowUpRight className="space-arrow" size={18} />
            <span className="space-title">La casa</span>
            <small>
              {state.assets.length}{" "}
              {state.assets.length === 1
                ? "equipo registrado"
                : "equipos registrados"}
            </small>
          </button>
        </div>
        <section className="today-tasks">
          <div className="section-title">
            <div>
              <span className="eyebrow">CADA QUIEN, CON CLARIDAD</span>
              <h2>En manos de tu equipo</h2>
            </div>
            <button className="text-button" onClick={() => go("Personal")}>
              Ver todo <ArrowUpRight size={16} />
            </button>
          </div>
          {visibleTasks.length ? (
            visibleTasks.map((t) => (
              <label
                className={t.done ? "home-task is-done" : "home-task"}
                key={t.id}
              >
                <input
                  type="checkbox"
                  aria-label={`Marcar tarea ${t.title}`}
                  checked={t.done}
                  disabled={!!t.maintenance && t.done}
                  onChange={(e) => onTask(t.id, e.target.checked)}
                />
                <span className="task-check" aria-hidden="true">
                  <Check size={13} />
                </span>
                <span>
                  <strong>{t.title}</strong>
                  <small>
                    {t.owner} ·{" "}
                    {t.done
                      ? t.maintenance
                        ? "Listo · guardado en historial"
                        : "Listo · toca para deshacer"
                      : t.frequency}
                  </small>
                </span>
                <ChevronRight size={17} />
              </label>
            ))
          ) : (
            <div className="tasks-clear">
              <Check size={20} />
              <span>
                {state.tasks.length
                  ? "Todo listo. Disfruta el día."
                  : "Agrega al equipo y comparte sus primeros pendientes."}
              </span>
            </div>
          )}
          <button className="add-home-task" onClick={() => open("Nueva tarea")}>
            <Plus size={16} /> Agregar un pendiente
          </button>
        </section>
      </div>
      <aside className="home-aside">
        <section className="menu-spotlight">
          <div className="spotlight-heading">
            <span className="eyebrow">DE LA COCINA A LA MESA</span>
            <Utensils size={17} />
          </div>
          <div className="spotlight-art">
            <RecipeArt
              variant={2}
              name={dish?.name || "Pollo al limón"}
              meal={dish?.meal || "Almuerzo"}
            />
            <span>Ilustración</span>
          </div>
          <div className="spotlight-copy">
            <span className="small-tag">
              {dish ? "EN TU PLAN" : "TU MENÚ FAMILIAR"}
            </span>
            <h2>{dish ? dish.name : "Comer bien también se planea."}</h2>
            <p>
              {dish
                ? `${first[0].split("|").join(" · ")}. Consulta la receta y las porciones.`
                : "Un plato para cada gusto. Una sola cocina para todos."}
            </p>
            <button className="primary" onClick={onPlan}>
              {dish ? "Abrir mi plan" : "Planear mi menú"}
              <ArrowRight size={17} />
            </button>
          </div>
        </section>
        <section className="week-preview">
          <div className="section-title">
            <h2>Tu semana, de un vistazo</h2>
            <CalendarDays size={18} />
          </div>
          <div className="week-progress">
            <span>
              {total}
              <small>platos elegidos</small>
            </span>
            <div
              className="family-stack"
              aria-label="Cuatro perfiles familiares"
            >
              {profiles.map((p, i) => (
                <span key={p} className={`family-bubble family-bubble-${i}`}>
                  {p === "Juan de Dios" ? "JD" : p[0]}
                </span>
              ))}
            </div>
          </div>
          <div className="mini-week">
            {days.map((d) => (
              <button key={d} onClick={onPlan} aria-label={`Planear ${d}`}>
                <span>{d.slice(0, 1)}</span>
                <i
                  className={
                    Object.keys(state.plan).some((k) => k.split("|")[1] === d)
                      ? "filled"
                      : ""
                  }
                />
              </button>
            ))}
          </div>
          <button className="week-open" onClick={onPlan}>
            Continuar mi planificación <ArrowRight size={16} />
          </button>
        </section>
        <button className="shopping-shortcut" onClick={onShop}>
          <span className="shopping-shortcut-icon">
            <ShoppingBag size={23} />
          </span>
          <span>
            <strong>Tu próxima compra</strong>
            <small>Carnes para 10, 15 o 30 días</small>
          </span>
          <ArrowUpRight size={19} />
        </button>
        <div className="home-signature">
          <span>LT LIVING</span>
          <p>
            La casa se cuida.
            <br />
            <em>La vida se disfruta.</em>
          </p>
        </div>
      </aside>
    </div>
  );
}
