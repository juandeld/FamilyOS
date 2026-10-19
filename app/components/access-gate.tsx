"use client";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import {
  browserSupabase,
  supabaseConfigured,
} from "../../lib/supabase/browser";
import type { Membership } from "../../lib/supabase/access";
import AuthScreen from "./auth-screen";
import CollaboratorWorkspace from "./collaborator-workspace";
export type Workspace = {
  membership: Membership;
  session: Session;
  refresh: () => Promise<void>;
};
const WorkspaceContext = createContext<Workspace | null>(null);
export function useWorkspace() {
  return useContext(WorkspaceContext);
}
export default function AccessGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null),
    [membership, setMembership] = useState<Membership | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const currentUser = useRef<string | null>(null);
  async function refresh() {
    try {
      const db = browserSupabase();
      const {
        data: { user },
        error: authError,
      } = await db.auth.getUser();
      if (authError) {
        if (authError.status === 401 || authError.status === 403)
          setMembership(null);
        throw authError;
      }
      if (!user) {
        setMembership(null);
        return;
      }
      const { error: inviteError } = await db.rpc("accept_my_invitations");
      if (inviteError) throw inviteError;
      const { data, error: e } = await db
        .from("household_members")
        .select("*")
        .eq("user_id", user.id)
        .eq("active", true)
        .order("household_id")
        .limit(1);
      if (e) throw e;
      setMembership(data?.[0] ?? null);
      setError("");
    } catch {
      setError(
        "No se pudo verificar el acceso al hogar. Revisa tu conexión o pide a un administrador que verifique el acceso.",
      );
    }
  }
  useEffect(() => {
    if (!supabaseConfigured) {
      setLoading(false);
      return;
    }
    const db = browserSupabase();
    let mounted = true;
    const {
      data: { subscription },
    } = db.auth.onAuthStateChange((_event, next) => {
      if (!mounted) return;
      setSession(next);
      if (!next) {
        currentUser.current = null;
        setMembership(null);
        setLoading(false);
      } else {
        if (currentUser.current !== next.user.id) setLoading(true);
        currentUser.current = next.user.id;
        setTimeout(() => {
          if (mounted)
            refresh().finally(() => {
              if (mounted) setLoading(false);
            });
        }, 0);
      }
    });
    const timer = setInterval(() => {
      if (mounted) refresh();
    }, 15000);
    return () => {
      mounted = false;
      subscription.unsubscribe();
      clearInterval(timer);
    };
  }, []);
  // With no external configuration the published first demo keeps working.
  if (!supabaseConfigured)
    return (
      <WorkspaceContext.Provider value={null}>
        {children}
      </WorkspaceContext.Provider>
    );
  if (loading)
    return (
      <div className="access-loading">LT Living · Verificando tu casa…</div>
    );
  if (!session) return <AuthScreen />;
  if (!membership)
    return (
      <div className="access-loading">
        <h1>Tu cuenta necesita una invitación.</h1>
        <p>
          {error ||
            "No tienes acceso activo a una casa. Pide a un administrador que te invite."}
        </p>
        <button className="primary" onClick={() => refresh()}>
          Volver a verificar
        </button>
        <button
          className="text-button"
          onClick={() => browserSupabase().auth.signOut({ scope: "local" })}
        >
          Cerrar sesión
        </button>
        <a href="/demo">Probar con datos ficticios</a>
      </div>
    );
  const workspace = { membership, session, refresh };
  return (
    <WorkspaceContext.Provider value={workspace}>
      {membership.role === "admin" ? (
        <div key={membership.household_id + session.user.id}>{children}</div>
      ) : (
        <CollaboratorWorkspace />
      )}
    </WorkspaceContext.Provider>
  );
}
