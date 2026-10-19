import {test,expect} from '@playwright/test';
async function navigate(page:any,name:string){await page.getByRole('button',{name:'Abrir navegación'}).click();await page.getByRole('navigation').getByRole('button',{name,exact:true}).click();}
test('weekly planning, separate profiles, shopping, recipe and prepared history persist',async({page})=>{
 await page.goto('/demo');await expect(page.getByRole('heading',{name:'Hoy en casa'})).toBeVisible();
 await navigate(page,'Nutrición');await expect(page.getByRole('button',{name:'Elegir',exact:true})).toHaveCount(10);
 await page.getByRole('button',{name:'Elegir',exact:true}).first().click();
 await page.getByRole('button',{name:'Pamela Objetivos individuales'}).click();await page.getByRole('button',{name:'Elegir',exact:true}).nth(1).click();
 await page.getByRole('button',{name:'Guardar Pollo al limón',exact:true}).click();
 await page.getByRole('button',{name:'Compras',exact:true}).click();await expect(page.locator('.shopping-row').filter({hasText:'Pollo'})).toBeVisible();await expect(page.getByText('0 lb 12.7 oz',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Cocina',exact:true}).click();await expect(page.getByText('Juan · Lunes · Almuerzo')).toBeVisible();await expect(page.getByText('Pamela · Lunes · Almuerzo')).toBeVisible();
 await page.getByRole('button',{name:'Confirmar preparación',exact:true}).first().click();await page.getByRole('button',{name:'Historial',exact:true}).click();await expect(page.getByRole('heading',{name:'Pollo al limón',exact:true})).toBeVisible();await page.getByRole('textbox',{name:'Opinión de Juan'}).fill('Me encantó, menos sal');
 await page.reload();await navigate(page,'Nutrición');await page.getByRole('button',{name:'Historial',exact:true}).click();await expect(page.getByRole('textbox',{name:'Opinión de Juan'})).toHaveValue('Me encantó, menos sal');
 await page.getByRole('button',{name:'Recetario',exact:true}).click();await expect(page.getByText('Pollo al limón',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Perfiles',exact:true}).click();await page.getByRole('button',{name:'Manuela Modo menú · sin macros'}).click();await expect(page.getByText('Modo menú infantil.',{exact:false})).toBeVisible();await expect(page.getByRole('spinbutton')).toHaveCount(0);
});
test('staff notes, routines, assets and simulated capture',async({page})=>{
 await page.goto('/demo');await navigate(page,'Personal');await page.getByRole('button',{name:'Persona',exact:true}).click();await page.getByRole('dialog').getByRole('textbox').fill('Ana Demo');await page.getByRole('button',{name:'Guardar',exact:true}).click();await expect(page.getByRole('heading',{name:'Ana Demo'})).toBeVisible();
 await page.getByRole('button',{name:'Agregar tarea'}).click();await page.getByRole('dialog').getByRole('textbox').fill('Regar plantas del patio');await page.getByRole('button',{name:'Guardar',exact:true}).click();await page.getByRole('checkbox',{name:'Completar Regar plantas del patio'}).check();await expect(page.getByRole('checkbox',{name:'Completar Regar plantas del patio'})).toBeChecked();
 await navigate(page,'Casa');await page.getByRole('button',{name:'Activo',exact:true}).click();await page.getByRole('dialog').getByRole('textbox').fill('Chapeadora demo');await page.getByRole('button',{name:'Guardar',exact:true}).click();await expect(page.getByRole('heading',{name:'Chapeadora demo'})).toBeVisible();
 await page.getByRole('button',{name:'WhatsApp',exact:true}).click();await page.getByRole('dialog').getByRole('textbox').fill('Hace falta jabón');await page.getByRole('button',{name:'Guardar nota local'}).click();await expect(page.getByText('WhatsApp simulado: Hace falta jabón')).toBeVisible();
 await page.screenshot({path:'/tmp/familyos-mobile.png',fullPage:true});
});
test('desktop home and no horizontal mobile overflow',async({page})=>{await page.goto('/demo');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBeTruthy();await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:'/tmp/familyos-desktop.png',fullPage:true});await expect(page.getByRole('heading',{name:'Hoy en casa'})).toBeVisible();});
test('pantry tracks initial count, purchase and a confirmed recipe without deducting a plan',async({page})=>{
 await page.goto('/demo');await navigate(page,'Inventario');
 await page.getByRole('combobox',{name:'Producto',exact:true}).selectOption('pollo|g');
 await page.getByRole('combobox',{name:'Unidad de captura',exact:true}).selectOption('g');await page.getByLabel('Cantidad inicial (g)').fill('1000');await page.getByRole('button',{name:'Guardar inventario inicial'}).click();
 const chicken=page.locator('.pantry-row').filter({hasText:'Pollo'});await expect(chicken).toContainText('2 lb 3.3 oz');
 await page.getByRole('button',{name:'Registrar compra',exact:true}).click();await page.getByLabel('Cantidad comprada (g)').fill('500');await page.getByRole('button',{name:'Guardar compra',exact:true}).click();await expect(chicken).toContainText('3 lb 4.9 oz');
 await navigate(page,'Nutrición');await page.getByRole('button',{name:'Elegir',exact:true}).first().click();await page.getByRole('button',{name:'Despensa',exact:true}).click();await expect(page.locator('.pantry-row').filter({hasText:'Pollo'})).toContainText('3 lb 4.9 oz');
 await page.getByRole('button',{name:'Cocina',exact:true}).click();await page.getByRole('button',{name:'Confirmar preparación',exact:true}).click();await page.getByRole('button',{name:'Despensa',exact:true}).click();await expect(page.locator('.pantry-row').filter({hasText:'Pollo'})).toContainText('2 lb 14.6 oz');
 await expect(page.locator('.pantry-row').filter({hasText:'Arroz'})).toHaveCount(0);
 await page.reload();await navigate(page,'Inventario');await expect(page.locator('.pantry-row').filter({hasText:'Pollo'})).toContainText('2 lb 14.6 oz');
 await page.getByRole('button',{name:'Corregir conteo',exact:true}).click();await page.getByRole('combobox',{name:'Producto',exact:true}).selectOption('pollo|g');await page.getByRole('combobox',{name:'Unidad de captura',exact:true}).selectOption('g');await page.getByLabel('Cantidad que hay ahora (g)').fill('1200');await page.getByRole('button',{name:'Guardar corrección'}).click();await expect(page.locator('.pantry-row').filter({hasText:'Pollo'})).toContainText('2 lb 10.3 oz');
 await page.getByRole('combobox',{name:'Producto',exact:true}).selectOption('__new__');await page.getByLabel('Nombre del producto',{exact:true}).fill('Aceite de oliva');await page.getByRole('combobox',{name:'Unidad',exact:true}).selectOption('ml');await page.getByRole('combobox',{name:'Modo de inventario',exact:true}).selectOption('tracked');await page.getByRole('button',{name:'Primer inventario',exact:true}).click();await page.getByLabel('Cantidad inicial (ml)').fill('750');await page.getByRole('button',{name:'Guardar inventario inicial'}).click();await expect(page.locator('.pantry-row').filter({hasText:'Aceite de oliva'})).toContainText('750 ml');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBeTruthy();await page.screenshot({path:'/tmp/familyos-pantry.png',fullPage:true});
});
test('meat forecast periods, margin, known stock, partial coverage and settings persist',async({page})=>{
 await page.addInitScript(()=>{if(!localStorage.getItem('familyos-v1'))localStorage.setItem('familyos-v1',JSON.stringify({history:[{id:'fixture',name:'Pollo de prueba',person:'Juan',date:'Demo',feedback:'',recipeSnapshot:{id:'fixture',name:'Pollo de prueba',meal:'Almuerzo',ingredients:[{name:'Pollo',quantity:100,unit:'g'}],macros:{kcal:400,protein:40,carbs:40,fat:40}}}],goals:{Juan:{kcal:1000,protein:100,carbs:100,fat:100},Pamela:{kcal:1000,protein:100,carbs:100,fat:100}},stockMovements:[{id:'stock',kind:'opening',name:'Pollo',quantity:400,unit:'g',occurredAt:'2026-10-19T12:00:00Z'}]}));});
 await page.goto('/demo');await navigate(page,'Nutrición');await page.getByRole('button',{name:'Compras',exact:true}).click();await expect(page.getByRole('heading',{name:'Carnes, con un poco de margen.'})).toBeVisible();
 const card=page.locator('.meat-card');await expect(card.locator('.meat-amount')).toHaveText('1 lb 10.5 oz');await expect(page.getByText('Estimación parcial',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'15 días',exact:true}).click();await expect(card.locator('.meat-amount')).toHaveText('2 lb 14.7 oz');
 await page.getByRole('button',{name:'Un mes 30 días',exact:true}).click();await expect(card.locator('.meat-amount')).toHaveText('6 lb 11.6 oz');
 await page.getByText('Ver por persona y receta').click();await expect(card).toContainText('Juan · Pollo de prueba');await expect(card).toContainText('factor de porción 1×');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBeTruthy();await page.screenshot({path:'/tmp/familyos-meat.png',fullPage:true});
 await page.reload();await navigate(page,'Nutrición');await page.getByRole('button',{name:'Compras',exact:true}).click();await expect(page.getByRole('button',{name:'Un mes 30 días',exact:true})).toHaveAttribute('aria-pressed','true');await expect(page.locator('.meat-card .meat-amount')).toHaveText('6 lb 11.6 oz');
});

test('only selected products are tracked; avocado is always available and meat starts in pounds',async({page})=>{
 await page.goto('/demo');await navigate(page,'Inventario');await expect(page.getByLabel('Cantidad inicial (lb)')).toBeVisible();await page.getByRole('combobox',{name:'Producto',exact:true}).selectOption('aguacate|g');await expect(page.getByRole('combobox',{name:'Modo de inventario',exact:true})).toHaveValue('always_available');await expect(page.getByText('Se asume disponible.',{exact:false})).toBeVisible();
 await page.getByRole('combobox',{name:'Modo de inventario',exact:true}).selectOption('tracked');await page.getByLabel('Cantidad inicial (g)').fill('100');await page.getByRole('button',{name:'Guardar inventario inicial'}).click();await expect(page.locator('.pantry-row').filter({hasText:'Aguacate'})).toContainText('0 lb 3.5 oz');await page.getByRole('combobox',{name:'Modo de inventario',exact:true}).selectOption('always_available');
 await navigate(page,'Nutrición');await page.getByRole('combobox',{name:'Tiempo de comida',exact:true}).selectOption('Desayuno');await page.getByRole('button',{name:'Elegir',exact:true}).nth(2).click();await page.getByRole('button',{name:'Cocina',exact:true}).click();await page.getByRole('button',{name:'Confirmar preparación',exact:true}).click();const avocadoEvents=await page.evaluate(()=>JSON.parse(localStorage.getItem('familyos-v1')!).stockMovements.filter((m:{name:string})=>m.name==='Aguacate'));expect(avocadoEvents).toHaveLength(1);
 await navigate(page,'Inventario');await page.getByRole('combobox',{name:'Producto',exact:true}).selectOption('aguacate|g');await page.getByRole('combobox',{name:'Modo de inventario',exact:true}).selectOption('tracked');await page.getByLabel('Cantidad inicial (g)').fill('50');await page.getByRole('button',{name:'Guardar inventario inicial'}).click();await expect(page.locator('.pantry-row').filter({hasText:'Aguacate'})).toContainText('0 lb 1.8 oz');
});

test('authentication links use a no-referrer policy',async({request})=>{const response=await request.get('/auth/confirm');expect(response.headers()['referrer-policy']).toBe('no-referrer');});

test('LT Living temporary code opens only the demo and theme persists across navigation', async ({ page }) => {
 let authRequests = 0;
 page.on('request', request => { if (/supabase\..*\/auth\/v1\//.test(request.url())) authRequests++; });
 await page.goto('/prueba');
 await expect(page).toHaveTitle('LT Living · La casa, en calma');
 await page.getByLabel('Clave de demostración').fill('1234');
 await page.getByRole('button', { name: 'Entrar a la demostración' }).click();
 await expect(page.getByRole('status')).toContainText('La clave temporal es 0000');
 await expect(page).toHaveURL(/\/prueba$/);
 await page.getByRole('button', { name: 'Cambiar a tema Noche' }).click();
 await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
 await page.reload();
 await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
 await page.getByLabel('Clave de demostración').fill('0000');
 await page.getByRole('button', { name: 'Entrar a la demostración' }).click();
 await expect(page).toHaveURL(/\/demo$/);
 await expect(page.getByRole('heading', { name: 'Hoy en casa', exact: true })).toBeVisible();
 await expect(page.getByText('DATOS FICTICIOS', { exact: true })).toBeVisible();
 await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
 expect(authRequests).toBe(0);
 await page.evaluate(() => document.fonts.ready);
 expect(await page.evaluate(() => document.fonts.check('300 26px "Cormorant Garamond"'))).toBeTruthy();
 expect(await page.evaluate(() => document.fonts.check('300 15px Jost'))).toBeTruthy();
 expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
 await page.screenshot({ path: '/tmp/lt-living-mobile-night.png', fullPage: true });
 await navigate(page, 'Nutrición');
 await expect(page.getByRole('button', { name: 'Elegir', exact: true })).toHaveCount(10);
 expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
 await page.screenshot({ path: '/tmp/lt-living-nutrition-night.png', fullPage: true });
 await page.getByRole('button', { name: 'Cambiar a tema Día' }).click();
 await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
 await page.screenshot({ path: '/tmp/lt-living-nutrition-day.png', fullPage: true, animations: 'disabled' });
 for (const width of [320, 375, 768, 1024]) {
   await page.setViewportSize({ width, height: 844 });
   expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
 }
});

test('mobile shortcuts share the same plan and tasks, and the full drawer remains accessible', async ({ page }) => {
 await page.goto('/demo');
 await page.getByRole('checkbox', { name: 'Marcar tarea Preparar almuerzo familiar', exact: true }).check();
 await expect(page.getByRole('checkbox', { name: 'Marcar tarea Preparar almuerzo familiar', exact: true })).toBeChecked();
 await page.getByRole('button', { name: 'Abrir equipo de casa', exact: true }).click();
 await expect(page.getByRole('checkbox', { name: 'Completar Preparar almuerzo familiar', exact: true })).toBeChecked();
 await page.getByRole('button', { name: 'Abrir cocina', exact: true }).click();
 await expect(page.getByRole('button', { name: 'Elegir', exact: true })).toHaveCount(10);
 await page.getByRole('button', { name: 'Elegir', exact: true }).first().click();
 await expect(page.getByRole('progressbar', { name: 'Plan semanal de Juan' })).toHaveAttribute('aria-valuenow', '1');
 await page.getByRole('button', { name: 'Ir al inicio', exact: true }).click();
 await expect(page.locator('.week-progress')).toContainText('1');
 await expect(page.locator('.spotlight-copy')).toContainText('Pollo al limón');
 await page.getByRole('button', { name: 'Tu próxima compra Carnes para 10, 15 o 30 días' }).click();
 await expect(page.getByRole('heading', { name: 'Carnes, con un poco de margen.' })).toBeVisible();
 await page.getByRole('button', { name: 'Ver todos los módulos', exact: true }).click();
 await expect(page.getByRole('navigation', { name: 'Navegación principal' })).toBeVisible();
 await page.getByRole('button', { name: 'Cerrar menú', exact: true }).click();
 await expect(page.getByRole('navigation', { name: 'Navegación principal' })).toBeHidden();
 await page.getByRole('button', { name: 'Abrir voz simulada', exact: true }).click();
 await expect(page.getByRole('dialog')).toContainText('No se graba ni transcribe audio.');
 await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
 for (const width of [320, 390, 768, 1024, 1440]) {
   await page.setViewportSize({ width, height: 844 });
   expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
 }
});
