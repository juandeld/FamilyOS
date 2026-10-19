"use client";
import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { initial, type State } from "../domain";
import {
  normalizeState,
  emptyHouseholdState,
  mergeStateChanges,
} from "../state";
import { browserSupabase } from "./browser";
import type { Workspace } from "../../app/components/access-gate";
export function useHouseholdState(workspace: Workspace | null) {
  const [state, render] = useState<State>(
    workspace ? emptyHouseholdState() : structuredClone(initial),
  );
  const [status, setStatus] = useState("Cargando…"),
    [error, setError] = useState(""),
    [ready, setReady] = useState(false);
  const current = useRef(state),
    baseline = useRef(state),
    revision = useRef(0),
    dirty = useRef(false),
    saving = useRef(false),
    mounted = useRef(true),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null),
    conflicted = useRef(false);
  const refreshRef = useRef<() => Promise<void>>(async () => {}),
    saveRef = useRef<() => Promise<void>>(async () => {});
  function apply(next: State) {
    current.current = next;
    render(next);
  }
  async function fetchRemote() {
    if (!workspace || saving.current) return;
    const { data, error: e } = await browserSupabase()
      .from("household_state")
      .select("data,revision")
      .eq("household_id", workspace.membership.household_id)
      .single();
    if (e || !data)
      throw new Error(
        "No se pudo leer el hogar. Revisa la conexión y tu acceso.",
      );
    if (
      !mounted.current ||
      saving.current ||
      Number(data.revision) < revision.current
    )
      return;
    const remote = normalizeState({ ...emptyHouseholdState(), ...data.data });
    if (dirty.current) {
      try {
        apply(mergeStateChanges(baseline.current, current.current, remote));
      } catch (e) {
        conflicted.current = true;
        setError((e as Error).message);
        return;
      }
    } else apply(remote);
    baseline.current = remote;
    revision.current = Number(data.revision);
    setStatus(dirty.current ? "Cambios pendientes" : "Sincronizado");
    if (!dirty.current) setError("");
  }
  refreshRef.current = fetchRemote;
  async function save() {
    if (!workspace || !dirty.current || saving.current || conflicted.current)
      return;
    saving.current = true;
    setStatus("Guardando…");
    const proposed = structuredClone(current.current);
    const { data, error: e } = await browserSupabase().rpc(
      "save_household_state",
      {
        hid: workspace.membership.household_id,
        expected_revision: revision.current,
        new_data: proposed,
      },
    );
    saving.current = false;
    if (!mounted.current) return;
    if (e) {
      if (e.code === "PT409" || e.code === "40001") {
        try {
          await fetchRemote();
          if (!conflicted.current)
            timer.current = setTimeout(() => saveRef.current(), 300);
        } catch (err) {
          setError((err as Error).message);
        }
      } else {
        setError(
          "Cambios sin guardar. Revisa la conexión o tu acceso; no cierres esta pantalla.",
        );
        setStatus("Sin guardar");
      }
      return;
    }
    baseline.current = proposed;
    revision.current = Number(data);
    dirty.current =
      JSON.stringify(current.current) !== JSON.stringify(proposed);
    setStatus(dirty.current ? "Cambios pendientes" : "Sincronizado");
    setError("");
    if (dirty.current) timer.current = setTimeout(() => saveRef.current(), 300);
  }
  saveRef.current = save;
  const setState: Dispatch<SetStateAction<State>> = (action) => {
    if (workspace && !ready) return;
    const next =
      typeof action === "function" ? action(current.current) : action;
    apply(next);
    if (!workspace) {
      try {
        localStorage.setItem("familyos-v1", JSON.stringify(next));
        setStatus("Demo · guardado en este navegador");
      } catch {
        setError("No se pudo guardar la demo en este navegador.");
      }
      return;
    }
    dirty.current = true;
    setStatus("Cambios pendientes");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => saveRef.current(), 500);
  };
  useEffect(() => {
    mounted.current = true;
    let poll: ReturnType<typeof setInterval> | undefined;
    if (!workspace) {
      try {
        const value = localStorage.getItem("familyos-v1");
        if (value) apply(normalizeState(JSON.parse(value)));
        setStatus("Demo · guardado en este navegador");
      } catch {
        setError("No se pudo recuperar la demo guardada.");
      }
      setReady(true);
      return;
    }
    fetchRemote()
      .then(() => {
        if (mounted.current) setReady(true);
      })
      .catch((e) => setError(e.message));
    poll = setInterval(() => {
      if (!document.hidden)
        fetchRemote()
          .then(() => {
            if (dirty.current && !conflicted.current) saveRef.current();
          })
          .catch((e) => {
            if (mounted.current) setError(e.message);
          });
    }, 4000);
    const onOnline = () => {
      refreshRef
        .current()
        .then(() => saveRef.current())
        .catch(() => setError("No se pudo recuperar la conexión."));
    };
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (dirty.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
      if (poll) clearInterval(poll);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("beforeunload", beforeUnload);
    };
  }, [workspace?.membership.household_id, workspace?.session.user.id]);
  async function reload() {
    if (
      dirty.current &&
      !window.confirm(
        "Hay cambios locales sin guardar. ¿Descartarlos y cargar los cambios compartidos?",
      )
    )
      return;
    dirty.current = false;
    conflicted.current = false;
    setError("");
    try {
      await fetchRemote();
      setReady(true);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return {
    state,
    setState,
    ready,
    status,
    error,
    reload,
    retry: () => saveRef.current(),
    pending: dirty.current,
  };
}
