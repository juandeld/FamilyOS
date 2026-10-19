"use client";
import {useEffect,useRef,useState} from "react";
import {browserSupabase,supabaseConfigured} from "../../../lib/supabase/browser";
export default function GoogleCallback() {
 const started=useRef(false); const [error,setError]=useState("");
 useEffect(()=>{
  if(started.current)return;started.current=true;
  async function complete(){
   if(!supabaseConfigured)throw new Error();
   const db=browserSupabase();
   const {data:{session},error:sessionError}=await db.auth.getSession();
   window.history.replaceState({},"",window.location.pathname);
   if(sessionError||!session)throw new Error();
   const claim=await db.rpc("claim_google_principal");
   if(claim.error)throw new Error();
   const {data:members,error:memberError}=await db.from("household_members").select("household_id,role").eq("user_id",session.user.id).eq("active",true).eq("role","admin").limit(1);
   if(memberError||!members?.length)throw new Error();
   const permitted=await db.rpc("is_household_admin",{hid:members[0].household_id});
   if(permitted.error||!permitted.data)throw new Error();
   window.location.replace("/");
  }
  complete().catch(()=>{
   window.history.replaceState({},"",window.location.pathname);
   setError("No se pudo confirmar un acceso administrativo con esta cuenta de Google. Usa la cuenta autorizada para tu hogar.");
  });
 },[]);
 return <main className="auth-page"><section className="auth-card"><span className="eyebrow">TU ACCESO PRIVADO</span><h1>Abriendo tu casa con Google…</h1>{error&&<p role="alert">{error}</p>}<a href="/login">Volver al inicio de sesión</a></section></main>;
}
