import {test,expect} from '@playwright/test';
async function navigate(page:any,name:string){await page.getByRole('button',{name:'Abrir navegación'}).click();await page.getByRole('navigation').getByRole('button',{name,exact:true}).click();}
test('weekly planning, separate profiles, shopping, recipe and prepared history persist',async({page})=>{
 await page.goto('/');await expect(page.getByRole('heading',{name:'Todo en casa, en armonía.'})).toBeVisible();
 await navigate(page,'Nutrición');await expect(page.getByRole('button',{name:'Elegir',exact:true})).toHaveCount(10);
 await page.getByRole('button',{name:'Elegir',exact:true}).first().click();
 await page.getByRole('button',{name:'Pamela Objetivos individuales'}).click();await page.getByRole('button',{name:'Elegir',exact:true}).nth(1).click();
 await page.getByRole('button',{name:'Guardar Pollo al limón',exact:true}).click();
 await page.getByRole('button',{name:'Compras',exact:true}).click();await expect(page.locator('.shopping-row').filter({hasText:'Arroz'})).toBeVisible();await expect(page.getByText('140 g',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Cocina',exact:true}).click();await expect(page.getByText('Juan · Lunes · Almuerzo')).toBeVisible();await expect(page.getByText('Pamela · Lunes · Almuerzo')).toBeVisible();
 await page.getByRole('button',{name:'Confirmar preparación',exact:true}).first().click();await page.getByRole('button',{name:'Historial',exact:true}).click();await expect(page.getByRole('heading',{name:'Pollo al limón',exact:true})).toBeVisible();await page.getByRole('textbox',{name:'Opinión de Juan'}).fill('Me encantó, menos sal');
 await page.reload();await navigate(page,'Nutrición');await page.getByRole('button',{name:'Historial',exact:true}).click();await expect(page.getByRole('textbox',{name:'Opinión de Juan'})).toHaveValue('Me encantó, menos sal');
 await page.getByRole('button',{name:'Recetario',exact:true}).click();await expect(page.getByText('Pollo al limón',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Perfiles',exact:true}).click();await page.getByRole('button',{name:'Manuela Modo menú · sin macros'}).click();await expect(page.getByText('Modo menú infantil.',{exact:false})).toBeVisible();await expect(page.getByRole('spinbutton')).toHaveCount(0);
});
test('staff notes, routines, assets and simulated capture',async({page})=>{
 await page.goto('/');await navigate(page,'Personal');await page.getByRole('button',{name:'Persona',exact:true}).click();await page.getByRole('dialog').getByRole('textbox').fill('Ana Demo');await page.getByRole('button',{name:'Guardar',exact:true}).click();await expect(page.getByRole('heading',{name:'Ana Demo'})).toBeVisible();
 await page.getByRole('button',{name:'Agregar tarea'}).click();await page.getByRole('dialog').getByRole('textbox').fill('Regar plantas del patio');await page.getByRole('button',{name:'Guardar',exact:true}).click();await page.getByRole('checkbox',{name:'Completar Regar plantas del patio'}).check();await expect(page.getByRole('checkbox',{name:'Completar Regar plantas del patio'})).toBeChecked();
 await navigate(page,'Casa');await page.getByRole('button',{name:'Activo',exact:true}).click();await page.getByRole('dialog').getByRole('textbox').fill('Chapeadora demo');await page.getByRole('button',{name:'Guardar',exact:true}).click();await expect(page.getByRole('heading',{name:'Chapeadora demo'})).toBeVisible();
 await page.getByRole('button',{name:'WhatsApp',exact:true}).click();await page.getByRole('dialog').getByRole('textbox').fill('Hace falta jabón');await page.getByRole('button',{name:'Guardar nota local'}).click();await expect(page.getByText('WhatsApp simulado: Hace falta jabón')).toBeVisible();
 await page.screenshot({path:'/tmp/familyos-mobile.png',fullPage:true});
});
test('desktop home and no horizontal mobile overflow',async({page})=>{await page.goto('/');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBeTruthy();await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:'/tmp/familyos-desktop.png',fullPage:true});await expect(page.getByRole('heading',{name:'Todo en casa, en armonía.'})).toBeVisible();});
test('pantry tracks initial count, purchase and a confirmed recipe without deducting a plan',async({page})=>{
 await page.goto('/');await navigate(page,'Inventario');
 await page.getByRole('combobox',{name:'Producto',exact:true}).selectOption({label:'Pollo · g'});
 await page.getByLabel('Cantidad inicial (g)').fill('1000');await page.getByRole('button',{name:'Guardar inventario inicial'}).click();
 const chicken=page.locator('.pantry-row').filter({hasText:'Pollo'});await expect(chicken).toContainText('1,000 g');
 await page.getByRole('button',{name:'Registrar compra',exact:true}).click();await page.getByLabel('Cantidad comprada (g)').fill('500');await page.getByRole('button',{name:'Guardar compra',exact:true}).click();await expect(chicken).toContainText('1,500 g');
 await navigate(page,'Nutrición');await page.getByRole('button',{name:'Elegir',exact:true}).first().click();await page.getByRole('button',{name:'Despensa',exact:true}).click();await expect(page.locator('.pantry-row').filter({hasText:'Pollo'})).toContainText('1,500 g');
 await page.getByRole('button',{name:'Cocina',exact:true}).click();await page.getByRole('button',{name:'Confirmar preparación',exact:true}).click();await page.getByRole('button',{name:'Despensa',exact:true}).click();await expect(page.locator('.pantry-row').filter({hasText:'Pollo'})).toContainText('1,320 g');
 await expect(page.locator('.pantry-row').filter({hasText:'Arroz'})).toContainText('Sin conteo');
 await page.reload();await navigate(page,'Inventario');await expect(page.locator('.pantry-row').filter({hasText:'Pollo'})).toContainText('1,320 g');
 await page.getByRole('button',{name:'Corregir conteo',exact:true}).click();await page.getByRole('combobox',{name:'Producto',exact:true}).selectOption({label:'Pollo · g'});await page.getByLabel('Cantidad que hay ahora (g)').fill('1200');await page.getByRole('button',{name:'Guardar corrección'}).click();await expect(page.locator('.pantry-row').filter({hasText:'Pollo'})).toContainText('1,200 g');
 await page.getByRole('button',{name:'Primer inventario',exact:true}).click();await page.getByRole('combobox',{name:'Producto',exact:true}).selectOption('__new__');await page.getByLabel('Nombre del producto',{exact:true}).fill('Aceite de oliva');await page.getByRole('combobox',{name:'Unidad',exact:true}).selectOption('ml');await page.getByLabel('Cantidad inicial (ml)').fill('750');await page.getByRole('button',{name:'Guardar inventario inicial'}).click();await expect(page.locator('.pantry-row').filter({hasText:'Aceite de oliva'})).toContainText('750 ml');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBeTruthy();await page.screenshot({path:'/tmp/familyos-pantry.png',fullPage:true});
});
test('meat forecast periods, margin, known stock, partial coverage and settings persist',async({page})=>{
 await page.addInitScript(()=>{if(!localStorage.getItem('familyos-v1'))localStorage.setItem('familyos-v1',JSON.stringify({history:[{id:'fixture',name:'Pollo de prueba',person:'Juan',date:'Demo',feedback:'',recipeSnapshot:{id:'fixture',name:'Pollo de prueba',meal:'Almuerzo',ingredients:[{name:'Pollo',quantity:100,unit:'g'}],macros:{kcal:400,protein:40,carbs:40,fat:40}}}],goals:{Juan:{kcal:1000,protein:100,carbs:100,fat:100},Pamela:{kcal:1000,protein:100,carbs:100,fat:100}},stockMovements:[{id:'stock',kind:'opening',name:'Pollo',quantity:400,unit:'g',occurredAt:'2026-10-19T12:00:00Z'}]}));});
 await page.goto('/');await navigate(page,'Nutrición');await page.getByRole('button',{name:'Compras',exact:true}).click();await expect(page.getByRole('heading',{name:'Carnes, con un poco de margen.'})).toBeVisible();
 const card=page.locator('.meat-card');await expect(card).toContainText('750 g por comprar');await expect(page.getByText('Estimación parcial',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'15 días',exact:true}).click();await expect(card).toContainText('1,325 g por comprar');
 await page.getByRole('button',{name:'Un mes 30 días',exact:true}).click();await expect(card).toContainText('3,050 g por comprar');
 await page.getByText('Ver por persona y receta').click();await expect(card).toContainText('Juan · Pollo de prueba');await expect(card).toContainText('factor de porción 1×');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBeTruthy();await page.screenshot({path:'/tmp/familyos-meat.png',fullPage:true});
 await page.reload();await navigate(page,'Nutrición');await page.getByRole('button',{name:'Compras',exact:true}).click();await expect(page.getByRole('button',{name:'Un mes 30 días',exact:true})).toHaveAttribute('aria-pressed','true');await expect(page.locator('.meat-card')).toContainText('3,050 g por comprar');
});
