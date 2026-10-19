export type MemoryDate = { id: string; title: string; month: number; day: number; year?: number; annual: boolean };
export type StaffMemory = { id: string; staffId: string; text: string; createdAt: string; dates: MemoryDate[] };
const months = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
export function validMemoryDate(d: MemoryDate) {
  const y = d.year ?? 2000;
  const date = new Date(Date.UTC(y,d.month-1,d.day));
  return Number.isInteger(y) && y>=1900 && y<=2200 && date.getUTCMonth()===d.month-1 && date.getUTCDate()===d.day;
}
// Only explicit Spanish dates are extracted; numeric and relative dates need confirmation.
export function memoryDates(text: string): MemoryDate[] {
  const result: MemoryDate[]=[];
  for(const sentence of text.split(/[.!?;\n]+/)) {
    const annual = /cumplea[ñn]os|cumple\s+a[ñn]os|cumple\s+(?:el\s+)?\d|aniversario/i.test(sentence);
    const re = /(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)(?:\s+(?:de\s+)?(\d{4}))?/gi;
    for(const match of sentence.matchAll(re)) {
      const year=match[3]?Number(match[3]):undefined;
      if(!annual && !year) continue;
      const d:MemoryDate={id:`date-${result.length}`,title:sentence.trim(),month:months.indexOf(match[2].toLowerCase())+1,day:Number(match[1]),annual,...(year?{year}:{})};
      if(validMemoryDate(d)) result.push(d);
    }
  }
  return result;
}
export function guatemalaDay(now=new Date()) {
  return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Guatemala',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
}
export function staffCalendar(memories: StaffMemory[], staff: {id:string;name:string}[], start: string, end: string) {
  const events: {id:string;staffId:string;person:string;title:string;date:string}[]=[];
  for(const m of memories) {
    const person=staff.find(s=>s.id===m.staffId); if(!person) continue;
    for(const d of m.dates) {
      for(let y=Number(start.slice(0,4));y<=Number(end.slice(0,4));y++) {
        if(!d.annual && d.year!==y) continue;
        // February 29 stays on its real date; no invented birthday on February 28.
        if(!validMemoryDate({...d,year:y})) continue;
        const date=`${y}-${String(d.month).padStart(2,'0')}-${String(d.day).padStart(2,'0')}`;
        if(date>=start && date<=end) events.push({id:`${m.id}:${d.id}:${y}`,staffId:m.staffId,person:person.name,title:d.title,date});
      }
    }
  }
  return events.sort((a,b)=>a.date.localeCompare(b.date));
}
export function thisWeek(now=new Date()) {
  const date=new Date(`${guatemalaDay(now)}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate()-((date.getUTCDay()+6)%7));
  const start=date.toISOString().slice(0,10);date.setUTCDate(date.getUTCDate()+6);
  return {start,end:date.toISOString().slice(0,10)};
}
