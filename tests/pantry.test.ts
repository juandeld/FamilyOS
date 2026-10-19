import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pantryBalances,preparationMovements,purchaseNeeded,stockKey,type StockMovement} from '../lib/pantry';
const movement=(id:string,kind:StockMovement['kind'],quantity:number,name='Pollo',unit='g'):StockMovement=>({id,kind,quantity,name,unit,occurredAt:'2026-10-19T12:00:00Z'});
test('first inventory + purchases - actual preparations = stock, while purchase history remains separate',()=>{
 const rows=[movement('a','opening',1000),movement('b','purchase',500),...preparationMovements('c','2026-10-19T12:00:00Z',[{name:'Pollo',quantity:180,unit:'g'}],[])];
 const item=pantryBalances(rows)[0];assert.equal(item.balance,1320);assert.equal(item.purchases,500);assert.equal(item.used,180);assert.equal(item.movements.length,3);
 assert.equal(preparationMovements('c','later',[{name:'Pollo',quantity:180,unit:'g'}],rows).length,0);
 assert.equal(pantryBalances([...rows,rows[2]])[0].balance,1320);
});
test('no initial count means unknown, not zero; opening excludes previous meals already reflected in count',()=>{
 const previous=movement('a','preparation',-180);assert.equal(pantryBalances([previous])[0].balance,null);
 const item=pantryBalances([previous,movement('b','opening',1000),movement('c','preparation',-100)])[0];assert.equal(item.balance,900);assert.equal(item.used,100);
 assert.equal(pantryBalances([movement('zero','opening',0)])[0].balance,0);
});
test('negative stock is visible; physical count correction reconciles without erasing purchase history',()=>{
 const rows=[movement('a','opening',100),movement('b','purchase',50),movement('c','preparation',-180)];assert.equal(pantryBalances(rows)[0].balance,-30);
 const corrected=pantryBalances([...rows,movement('d','correction',80)])[0];assert.equal(corrected.balance,50);assert.equal(corrected.purchases,50);assert.equal(corrected.used,180);
});
test('purchase forecast deducts only matching known stock after safety, never below zero',()=>{
 assert.deepEqual(purchaseNeeded(1150,'Pollo',[]),{available:null,needed:1150,deficit:false});
 assert.equal(purchaseNeeded(1150,'Pollo',[movement('a','opening',400)]).needed,750);
 assert.equal(purchaseNeeded(1150,'Pollo',[movement('a','opening',2000)]).needed,0);
 assert.equal(purchaseNeeded(1150,'Pollo',[movement('a','opening',0),movement('b','preparation',-50)]).deficit,true);
 assert.equal(purchaseNeeded(1150,'Pollo',[movement('a','opening',1000,'Pollo cocido')]).available,null);
 assert.equal(purchaseNeeded(1150,'Pollo',[movement('a','opening',1,'Pollo','kg')]).available,null);
 assert.notEqual(stockKey('Frijoles cocidos','g'),stockKey('Frijoles secos','g'));
 assert.equal(stockKey('Huevos','unidad'),stockKey('huevos','unidades'));
});
