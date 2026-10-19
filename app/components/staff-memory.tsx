"use client";
import {useState} from 'react';
import type {State} from '../../lib/domain';
import {guatemalaDay,memoryDates,staffCalendar,thisWeek,validMemoryDate,type StaffMemory,type MemoryDate} from '../../lib/staff-memory';

type Props={state:State;update:(patch:Partial<State>)=>void};
export function StaffWeek({state,onOpen}:{state:State;onOpen:()=>void}) {
 const range=thisWeek();const events=staffCalendar(state.staffMemories??[],state.staff,range.start,range.end);
 if(!events.length)return null;
 return <section className="panel staff-week"><span className="eyebrow">PARA TENER PRESENTE</span><h3>Esta semana, con tu equipo</h3>{events.map(e=><p key={e.id}><strong>{e.person}</strong> · {e.title}<br/><small>{displayDate(e.date)}</small></p>)}<button className="secondary" onClick={onOpen}>Ver memoria y calendario</button></section>;
}
function displayDate(date:string) {return new Intl.DateTimeFormat('es-GT',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(`${date}T12:00:00Z`));}
export default function StaffMemoryPanel({state,update}:Props) {
 const [person,setPerson]=useState(state.staff[0]?.id??'');const [text,setText]=useState('');const [editing,setEditing]=useState<string|null>(null);
 const [legacyId,setLegacyId]=useState<string|null>(null);
 const [dates,setDates]=useState<MemoryDate[]>([]);const [manual,setManual]=useState('');const [annual,setAnnual]=useState(true);const [error,setError]=useState('');
 const [month,setMonth]=useState(guatemalaDay().slice(0,7));const [query,setQuery]=useState('');
 const memories=state.staffMemories??[];
 const end=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7)),0)).toISOString().slice(0,10);
 const events=staffCalendar(memories,state.staff,`${month}-01`,end);
 function reset(){setText('');setDates([]);setManual('');setEditing(null);setLegacyId(null);setError('');}
 function save(){
  if(!state.staff.some(s=>s.id===person)||!text.trim()){setError('Elige una persona y escribe lo que quieres recordar.');return;}
  if(dates.some(d=>!validMemoryDate(d))){setError('Revisa las fechas antes de guardar.');return;}
  if(memories.some(m=>m.id!==editing&&m.staffId===person&&m.text.trim()===text.trim())){setError('Este recuerdo ya está guardado.');return;}
  const memory:StaffMemory={id:editing??crypto.randomUUID(),staffId:person,text:text.trim(),createdAt:memories.find(m=>m.id===editing)?.createdAt??new Date().toISOString(),dates};
  update({staffMemories:editing?memories.map(m=>m.id===editing?memory:m):[...memories,memory],...(legacyId?{staff:state.staff.map(s=>s.id===legacyId?{...s,note:''}:s)}:{})});reset();
 }
 function addDate(){if(!manual){setError('Selecciona la fecha exacta.');return;}const [year,m,d]=manual.split('-').map(Number);const entry:MemoryDate={id:crypto.randomUUID(),title:text.trim()||'Fecha importante',year,month:m,day:d,annual};if(!validMemoryDate(entry)){setError('La fecha no es válida.');return;}setDates([...dates,entry]);setManual('');setError('');}
 return <section className="panel staff-memory-panel" aria-label="Memoria del equipo">
  <span className="eyebrow">CONOCERLOS. RECORDAR LO IMPORTANTE.</span><h2>La memoria de tu equipo</h2><p>Cuéntalo una vez. Guarda preferencias, acuerdos y detalles para consultarlos después. Solo las fechas van al calendario.</p>
  <div className="staff-memory-columns"><div>
   <label>Persona del recuerdo<select value={person} onChange={e=>{setPerson(e.target.value);reset();}}><option value="">Seleccionar persona</option>{state.staff.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
   <label>¿Qué quieres recordar?<textarea value={text} maxLength={4000} placeholder="A Rosa le gusta recibir el menú la tarde anterior. Su cumpleaños es el 12 de mayo." onChange={e=>{setText(e.target.value);setDates([...memoryDates(e.target.value),...dates.filter(d=>!d.id.startsWith("date-"))]);setError('');}}/></label>
   <small>Se reconocen fechas explícitas, como «cumpleaños el 12 de mayo». Si falta el día o es ambiguo, agrega la fecha exacta abajo.</small>
   {dates.length>0&&<div className="memory-date-preview"><strong>Se guardará en el calendario</strong>{dates.map(d=><div key={d.id}><span>{d.title} · {d.day}/{d.month}{d.annual?' · cada año':`/${d.year}`}</span><button className="secondary compact" onClick={()=>setDates(dates.filter(x=>x.id!==d.id))} aria-label={`Quitar fecha ${d.day}/${d.month}`}>Quitar fecha</button></div>)}</div>}
   <details><summary>Agregar o aclarar una fecha</summary><label>Fecha del recuerdo<input type="date" value={manual} onChange={e=>setManual(e.target.value)}/></label><label className="memory-check"><input type="checkbox" checked={annual} onChange={e=>setAnnual(e.target.checked)}/> Se repite cada año (cumpleaños o aniversario)</label><button className="secondary" onClick={addDate}>Agregar al recuerdo</button></details>
   {error&&<p role="alert">{error}</p>}
   <div className="toolbar"><button className="primary compact" onClick={save}>{editing?'Guardar cambios del recuerdo':'Guardar recuerdo'}</button>{(editing||legacyId)&&<button className="secondary" onClick={reset}>Cancelar edición</button>}</div>
   <small>Memoria privada de administradores. No hay IA ni avisos externos conectados.</small>
  </div><div>
   <label>Buscar en la memoria<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Preferencias, acuerdos, nombres…"/></label>
   {state.staff.filter(s=>!person||s.id===person).map(s=><div key={s.id}><h3>{s.name}</h3>{s.note&&(!query||s.note.toLocaleLowerCase().includes(query.toLocaleLowerCase()))&&<div className="memory-entry"><small>Memoria anterior · conservada</small><p style={{whiteSpace:'pre-wrap'}}>{s.note}</p><button className="secondary compact" onClick={()=>{setPerson(s.id);setText(s.note);setDates(memoryDates(s.note));setLegacyId(s.id);setEditing(null);setError('');}}>Editar memoria anterior</button></div>}{memories.filter(m=>m.staffId===s.id&&(!query||m.text.toLocaleLowerCase().includes(query.toLocaleLowerCase()))).map(m=><article className="memory-entry" key={m.id}><p style={{whiteSpace:'pre-wrap'}}>{m.text}</p><small>{m.dates.length?`${m.dates.length} fecha(s) en calendario`:'Solo memoria · sin recordatorio'}</small><div className="toolbar"><button className="secondary compact" onClick={()=>{setLegacyId(null);setPerson(m.staffId);setText(m.text);setDates(m.dates);setEditing(m.id);setError('');}}>Editar recuerdo</button><button className="secondary compact" onClick={()=>{if(window.confirm('¿Eliminar este recuerdo y sus fechas del calendario?')){update({staffMemories:memories.filter(x=>x.id!==m.id)});if(editing===m.id)reset();}}}>Eliminar recuerdo</button></div></article>)}</div>)}
  </div></div>
  <div className="memory-calendar"><div className="toolbar"><h3>Calendario del equipo</h3><label>Mes del calendario<input type="month" value={month} min="1900-01" max="2200-12" onChange={e=>{if(/^\d{4}-\d{2}$/.test(e.target.value))setMonth(e.target.value);}}/></label></div>{events.length?events.map(e=><article className="memory-entry" key={e.id}><small>{displayDate(e.date)}</small><p><strong>{e.person}</strong> · {e.title}</p></article>):<p>No hay fechas guardadas para este mes.</p>}<small>Los cumpleaños y aniversarios reaparecen cada año. Las demás fechas se muestran una sola vez. Los recordatorios de esta semana aparecen también en Inicio.</small></div>
 </section>;
}
