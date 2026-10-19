import {test} from 'node:test';
import assert from 'node:assert/strict';
import {memoryDates,staffCalendar,thisWeek,validMemoryDate} from '../lib/staff-memory';
import {normalizeState,emptyHouseholdState} from '../lib/state';
test('staff memory recognizes explicit dates without turning ordinary notes or ambiguous dates into events',()=>{
 assert.deepEqual(memoryDates('Prefiere café sin azúcar. Uniforme entregado.'),[]);
 assert.deepEqual(memoryDates('Cumpleaños 5/6. Ingresó en enero. Cumpleaños mañana.'),[]);
 assert.deepEqual(memoryDates('Cumple el plazo el 12 de mayo.'),[]);
 const dates=memoryDates('Su cumpleaños es el 12 de mayo. Aniversario de ingreso el 3 de enero de 2020. Entrega de uniforme el 4 de abril de 2027.');
 assert.equal(dates.length,3);assert.equal(dates[0].annual,true);assert.equal(dates[1].annual,true);assert.equal(dates[2].annual,false);
 assert.deepEqual(memoryDates('Cumpleaños el 31 de febrero.'),[]);
 assert.equal(validMemoryDate({id:'x',title:'x',month:2,day:29,annual:true}),true);
});
test('calendar derives from memory with annual recurrence, date corrections, deletion, leap days and household separation',()=>{
 const staff=[{id:'s1',name:'Rosa Demo'}];
 const memories=[{id:'m1',staffId:'s1',text:'Cumpleaños el 12 de mayo.',createdAt:'2026-01-01',dates:memoryDates('Cumpleaños el 12 de mayo. Entrega el 4 de abril de 2027.')}];
 assert.equal(staffCalendar(memories,staff,'2027-05-01','2027-05-31').length,1);
 assert.equal(staffCalendar(memories,staff,'2028-04-01','2028-04-30').length,0);
 assert.equal(staffCalendar(memories,[],'2027-05-01','2027-05-31').length,0);
 assert.equal(staffCalendar([],staff,'2027-05-01','2027-05-31').length,0);
 const corrected=[{...memories[0],dates:memoryDates('Cumpleaños el 13 de mayo.')}];
 assert.equal(staffCalendar(corrected,staff,'2027-05-12','2027-05-12').length,0);
 assert.equal(staffCalendar(corrected,staff,'2027-05-13','2027-05-13').length,1);
 const leap=[{...memories[0],dates:memoryDates('Cumpleaños el 29 de febrero.')}];
 assert.equal(staffCalendar(leap,staff,'2027-02-01','2027-03-01').length,0);
 assert.equal(staffCalendar(leap,staff,'2028-02-01','2028-03-01').length,1);
});
test('weekly reminders use Guatemala Monday to Sunday and old saves preserve their notes',()=>{
 assert.deepEqual(thisWeek(new Date('2026-10-19T02:00:00Z')),{start:'2026-10-12',end:'2026-10-18'});
 assert.deepEqual(thisWeek(new Date('2026-12-31T18:00:00Z')),{start:'2026-12-28',end:'2027-01-03'});
 const old=normalizeState({staff:[{id:'s1',name:'Rosa',role:'Cocina',note:'Nota anterior'}]});
 assert.equal(old.staff[0].note,'Nota anterior');assert.deepEqual(old.staffMemories,[]);assert.deepEqual(emptyHouseholdState().staffMemories,[]);
});
