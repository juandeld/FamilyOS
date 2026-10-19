import {test} from 'node:test';
import assert from 'node:assert/strict';
import {forecastMeat,portionScale,type Preparation,type RecipeSnapshot} from '../lib/meat-shopping';
import {initial,recipes} from '../lib/domain';
const goals={Juan:{kcal:1000,protein:100,carbs:100,fat:100},Pamela:{kcal:2000,protein:200,carbs:200,fat:200}};
const recipe:RecipeSnapshot={id:'fixture',name:'Receta de prueba',meal:'Almuerzo',ingredients:[{name:'Pollo',quantity:100,unit:'g'}],macros:{kcal:400,protein:40,carbs:40,fat:40}};
const event=(person:string,snapshot:RecipeSnapshot=recipe,id=person):Preparation=>({id,person,name:snapshot.name,date:'fecha heredada',feedback:'',recipeSnapshot:snapshot});
const near=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
test('adult portions fit all macros; independent targets and children stay at base portions',()=>{
 near(portionScale(recipe.macros,goals.Juan,.4)!,1);near(portionScale(recipe.macros,goals.Pamela,.4)!,2);
 assert.notEqual(portionScale(recipe.macros,{...goals.Juan,fat:50},.4),1);
 const forecast=forecastMeat([event('Juan'),event('Pamela'),event('Manuela')],goals,10);
 near(forecast.items[0].baseGrams,4000);near(forecast.items[0].safetyGrams,600);assert.equal(forecast.items[0].purchaseGrams,4600);
 near(forecast.items[0].people.Manuela!,1000);assert.equal(forecast.partial,true);
});
test('10, 15 and 30 days scale linearly and apply 15% once',()=>{for(const days of [10,15,30] as const){const item=forecastMeat([event('Juan')],goals,days).items[0];near(item.baseGrams,100*days);assert.equal(item.purchaseGrams,115*days);}});
test('recipe frequency includes vegetarian preparations and preserves distinct meat categories',()=>{
 const vegetable={...recipe,id:'veg',name:'Vegetariano',ingredients:[{name:'Arroz',quantity:100,unit:'g'}]};
 const fish={...recipe,id:'fish',name:'Pescado',ingredients:[{name:'Pescado',quantity:200,unit:'g'}]};
 const result=forecastMeat([event('Juan'),event('Juan',vegetable,'veg'),event('Juan',fish,'fish')],goals,15);
 near(result.items.find(i=>i.name==='Pollo')!.baseGrams,500);near(result.items.find(i=>i.name==='Pescado')!.baseGrams,1000);
 assert.equal(result.items.length,2);assert.equal(forecastMeat([event('Juan',vegetable)],goals,10).items.length,0);
});
test('unknown history and missing goals do not create quantities; legacy records match exactly',()=>{
 assert.equal(forecastMeat([],goals,10).items.length,0);
 const unknown={id:'x',person:'Juan',name:'No existe',date:'sin fecha',feedback:''};assert.equal(forecastMeat([unknown],goals,10).usableEvents,0);
 assert.equal(forecastMeat([event('Juan')],{...goals,Juan:{...goals.Juan,protein:0}},10).items.length,0);
 assert.equal(portionScale({...recipe.macros,protein:NaN},goals.Juan,.4),null);
 const legacy={...unknown,name:'Pollo al limón'};assert.equal(forecastMeat([legacy],initial.goals,10).legacyEvents,1);
 assert.equal(forecastMeat([{...unknown,name:'Pollo al limon'}],goals,10).items.length,0);
});
test('snapshots preserve old recipe amounts and canned tuna is not treated as raw fish',()=>{
 const original={...recipes.find(r=>r.name==='Pollo al limón')!,ingredients:[{name:'Pollo',quantity:50,unit:'g'}],macros:recipe.macros};
 near(forecastMeat([event('Juan',original)],goals,10).items[0].baseGrams,500);
 const tuna={...recipe,ingredients:[{name:'Atún escurrido',quantity:100,unit:'g'}]};const item=forecastMeat([event('Juan',tuna)],goals,10).items[0];assert.equal(item.name,'Atún en conserva');assert.match(item.basis,/escurrido/);
});
