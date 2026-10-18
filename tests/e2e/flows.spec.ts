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
