'use client';
import {Leaf,ArrowUpRight} from 'lucide-react';
import {shopping,type Plan} from '../../lib/domain';
import {pantryBalances,stockKey,type StockMovement} from '../../lib/pantry';
const format=(n:number)=>new Intl.NumberFormat('es-GT',{maximumFractionDigits:2}).format(n);
export default function WeeklyShopping({plan,movements,checkedItems,onToggle,onGoPantry}:{plan:Plan;movements:StockMovement[];checkedItems:string[];onToggle:(name:string)=>void;onGoPantry:()=>void}){
 const items=Object.entries(shopping(plan));const balances=pantryBalances(movements);
 return <section className="panel"><h2>Ingredientes del plan semanal</h2><p>Cantidades base del plan elegido, menos las existencias registradas. Esta lista es una alternativa a la proyección de carnes: no se suman. Básicos asumidos: sal, aceite y agua.</p>{items.map(([name,item])=>{
 const stock=balances.find(b=>b.key===stockKey(name,item.unit));const available=stock?.balance==null?null:Math.max(0,stock.balance);const needed=Math.max(0,item.quantity-(available??0));
 return <div className="weekly-stock-item" key={name}><label className="shopping-row"><input type="checkbox" checked={checkedItems.includes(name)} onChange={()=>onToggle(name)}/><span>{name}</span><b>{format(needed)} {item.unit}</b></label><small>Plan: {format(item.quantity)} {item.unit} · {available===null?'Despensa: sin conteo, no se descontaron existencias':`Despensa: ${format(available)} ${item.unit}${needed===0?' · Ya cubierto':''}`}</small></div>;
 })}{items.length===0&&<div className="empty"><Leaf size={28}/><p>Tu lista se genera al elegir platos.</p></div>}<button className="text-button" onClick={onGoPantry}>Actualizar despensa <ArrowUpRight size={14}/></button><p className="notice">Las casillas solo marcan tu lista. No registran compras ni alteran existencias. Registra una compra confirmada en Despensa para sumar productos.</p></section>;
}
