"""Prepare the legacy workbook offline. Output stays outside the checkout.
Usage: python scripts/prepare-maintenance-import.py INPUT.xlsx OUTPUT_DIRECTORY
Requires openpyxl; never embeds a family's workbook in app source or the public demo.
"""
import sys,json,re,hashlib,unicodedata,calendar
from pathlib import Path
from collections import defaultdict
from openpyxl import load_workbook,Workbook
from openpyxl.styles import Font,PatternFill,Alignment

def text(v): return ' '.join(str(v or '').split())
def norm(v): return ''.join(c for c in unicodedata.normalize('NFD',text(v).lower()) if not unicodedata.combining(c))
months={norm(calendar.month_name[i]):i for i in range(1,13)}
spanish=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
months.update({v:i+1 for i,v in enumerate(spanish)})
source=Path(sys.argv[1]);out=Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=True)
w=load_workbook(source,data_only=True)
if 'Tabla' not in w:raise SystemExit('Formato no reconocido: falta la hoja Tabla. No se importó nada.')
groups=defaultdict(list)
for i,row in enumerate(w['Tabla'].iter_rows(min_row=2,values_only=True),2):
 if row[2]:groups[(norm(row[0]),norm(row[2]))].append((i,row))
plans=[]
for idx,((area,key),rows) in enumerate(groups.items(),1):
 r=rows[0][1];raw_title=text(r[2]);issues=[];refs=[];scheduled=[]
 frequency={'semanal':'weekly','mensual':'monthly','menusal':'monthly','trimestral':'quarterly','semestral':'semiannual','annual':'annual','anual':'annual'}.get(norm(r[3]))
 if not frequency:raise SystemExit('Frecuencia desconocida: revisar antes de preparar la importación.')
 for rownum,rr in rows:
  m=months.get(norm(rr[6]));numeric=rr[7] if isinstance(rr[7],int) and 1<=rr[7]<=12 else None
  if m:scheduled.append(m)
  if m and numeric and m!=numeric:issues.append(f'Tabla!G{rownum} indica {text(rr[6])}, pero H{rownum} indica {numeric}. Se conserva el mes escrito, pendiente de revisión.')
  if frequency=='monthly' and norm(rr[6])=='semanal':issues.append(f'Tabla!D{rownum} dice mensual, pero G{rownum} dice semanal. Confirmar frecuencia.')
 if len(scheduled)!=len(set(scheduled)):issues.append('Hay un mes repetido en las filas fuente. Se consolidó una sola ocurrencia propuesta; no se duplicaron trabajos.')
 slot=sorted(set(scheduled))
 if frequency=='semiannual' and len(slot)==2 and (slot[1]-slot[0])!=6:issues.append('Los dos meses se separan por cinco/siete meses; puede ser estacional, pero no equivale a un intervalo exacto de seis meses.')
 if frequency=='annual' and len(slot)>1:issues.append('La frecuencia es anual, pero aparecen varios meses. Confirmar si son fases de un mismo trabajo o si sobra una fecha.')
 if frequency=='semiannual' and len(slot)<2:issues.append('La frecuencia es semestral, pero falta un segundo mes explícito.')
 if key=='pintura blanca':issues.append('Las hojas Tabla y Sheet1 no coinciden en meses ni distribución de pintura interior. Confirmar alcance y cantidades.')
 hours=[rr[8] for _,rr in rows if isinstance(rr[8],(int,float)) and rr[8]>0]
 estimate=float(hours[0]) if hours and all(h==hours[0] for h in hours) else None
 if not hours:issues.append('No hay una duración utilizable: un cero o un vacío se conserva como tiempo desconocido.')
 if hours and len(set(hours))>1:issues.append('Las horas varían entre filas; se requiere una estimación actualizada.')
 category={'exterior':'Exterior','interior':'Interior','jardin':'Jardín','limpieza profunda':'Limpieza profunda'}.get(area,text(r[0]))
 title=raw_title
 fixes={'Mantenimiento de Gabetas':'Mantenimiento de gavetas','Revison Aguas Plubiales':'Revisión de aguas pluviales','Limpiza Parte de Abajo':'Limpieza de la parte baja del jardín','Limpieza Reposaderas':'Limpieza de drenajes de piso','Porton Electrico':'Portón eléctrico'}
 for old,new in fixes.items():
  if norm(title)==norm(old):title=new
 if area=='limpieza profunda':title='Limpieza profunda · '+title
 if key.startswith('carro '):category='Vehículos';issues.append('Confirmar a qué vehículo corresponde la identificación histórica; no se infiere propietario ni modelo.')
 material_texts=list(dict.fromkeys(text(rr[5]) for _,rr in rows if rr[5]))
 materials=[]
 for value in material_texts:
  if re.search(r'^(don|doña|dona)\s|consultar|plomero',value,re.I):refs.append('Referencia histórica, sin contratación vigente: '+value)
  else:materials.append({'name':value,'quantity':'Cantidad / compatibilidad por confirmar','verified':False})
 if 'canales' in key and any('pintura' in norm(v) for v in material_texts):
  refs.extend('Insumo incongruente en la fuente: '+v for v in material_texts);materials=[]
  issues.append('Aparece pintura en una limpieza de canales: probable arrastre de otra fila. No se incluye para comprar.')
 condition= 'pintura' in key or 'voladizos' in key
 if condition:
  refs.append('Trabajo original: '+raw_title)
  if estimate is not None:refs.append('Horas históricas del trabajo original: '+str(estimate)+'. No equivalen a horas de inspección.')
  estimate=None;title='Inspeccionar acabado · '+raw_title
  issues.append('Se propone inspeccionar por condición; repintar solo si hace falta. Validar acabado, producto y cantidades antes de comprar.')
 instructions='Inspección visual y limpieza accesible. Registrar hallazgos y coordinar cualquier intervención técnica según manual o ficha del producto.'
 if 'canal' in key or 'techo' in key or 'plubial' in key or 'reposadera' in key:
  instructions='Revisar obstrucciones, fugas y escurrimiento desde zonas accesibles. El trabajo en altura o intervención de tuberías se coordina con personal capacitado. Confirmar calendario según lluvias de la zona.'
  refs.append('Mejora propuesta: revisar preparación para lluvias antes de la temporada local, sin asumir un cambio de fecha ya aprobado.')
 if 'refrigeradora' in key:
  instructions='Ordenar alimentos y limpiar superficies compatibles. No usar compresor, desmontar partes ni intervenir componentes sin comprobar el manual del equipo.'
  issues.append('La fuente menciona compresor: confirmar con el manual antes de aplicar ese procedimiento.')
 if 'fumigacion' in key:
  instructions='Coordinar con proveedor especializado. Pedir diagnóstico, producto, ficha de seguridad e indicaciones de reingreso; no se proponen dosis ni aplicaciones automáticas.'
  refs.append('Fumigación por evaluación del proveedor, sin asignación ni contratación automática.')
 if 'puerta' in key or 'gaveta' in key or 'gabeta' in key or 'porton' in key:
  refs.append('Lubricantes, grasa y pintura del archivo son referencias históricas; validar compatibilidad y manual antes de intervenir.')
 if 'deck' in key or 'concreto' in key or 'ladrillo' in key:
  refs.append('Confirmar material y acabado antes de elegir cepillo, presión o tratamiento; no se prescribe el cepillo metálico por defecto.')
 refs.extend('Objetivo histórico: '+text(rr[4]) for _,rr in rows[:1] if rr[4])
 plans.append({'id':f'legacy-plan-{idx:02d}','title':title,'area':category,'frequency':frequency,'months':slot,'estimatedHours':estimate,'materials':materials,'references':list(dict.fromkeys(refs)),'instructions':instructions,'sourceRows':[f'Tabla!C{n}:I{n}' for n,_ in rows],'review':list(dict.fromkeys(issues)),'priority':'high' if any(x in key for x in ['techo','canal','plubial','reposadera','porton']) else 'normal','conditionBased':condition,'status':'draft','nextDue':None,'anchorDay':1,'owner':'Sin asignar','assigneeId':''})
fingerprint=hashlib.sha256(source.read_bytes()).hexdigest()
analysis=[f'{len(w.sheetnames)} hojas revisadas; {sum(len(v) for v in groups.values())} filas de programación consolidadas en {len(plans)} rutinas.',f'{sum(bool(p["review"]) for p in plans)} rutinas requieren aclaración antes de activar.', 'No se importaron trabajos realizados: el archivo no prueba fechas de ejecución ni contiene un historial confirmado.','Los meses son referencias sin año ni día. Las fechas nuevas se generan solo al activar, desde la fecha elegida.','Las pinturas pasan a inspección por condición; no se compra ni repinta automáticamente.','Los insumos históricos quedan por validar; proveedores y personas se separan de los materiales.','La suma de horas de filas antiguas no es una carga anual: las recurrencias semanales y mensuales no estaban expandidas.']
payload={'version':1,'sourceId':'legacy-'+fingerprint[:20],'sourceName':source.name,'importedAt':None,'analysis':analysis,'plans':plans,'history':[]}
(out/'maintenance-import.json').write_text(json.dumps(payload,ensure_ascii=False,indent=2))
labels={'weekly':'Semanal','monthly':'Mensual','quarterly':'Trimestral','semiannual':'Semestral','annual':'Anual'}
b=Workbook();s=b.active;s.title='Rutinas'
s.append(['ID','Área','Rutina propuesta','Frecuencia','Meses de referencia','Horas estimadas','Prioridad','Estado','Responsable','Próxima fecha','Referencias de origen','Instrucciones'])
for p in plans:s.append([p['id'],p['area'],p['title'],labels[p['frequency']],', '.join(spanish[m-1].title() for m in p['months']),p['estimatedHours'],'Alta' if p['priority']=='high' else 'Normal','Por revisar' if p['review'] else 'Borrador','Sin asignar',None,'; '.join(p['sourceRows']),p['instructions']])
s=b.create_sheet('Por revisar');s.append(['ID','Rutina','Observación','Resolución actual'])
for p in plans:
 for issue in p['review']:s.append([p['id'],p['title'],issue,'Pendiente de confirmar'])
s=b.create_sheet('Insumos y referencias');s.append(['ID','Rutina','Tipo','Detalle','Cantidad','Validado'])
for p in plans:
 for m in p['materials']:s.append([p['id'],p['title'],'Material propuesto',m['name'],m['quantity'],'No'])
 for ref in p['references']:s.append([p['id'],p['title'],'Referencia histórica',ref,None,None])
s=b.create_sheet('Historial confirmado');s.append(['Fecha realizada','Rutina','Responsable','Resultado','Costo real','Nota / evidencia'])
s=b.create_sheet('Criterios');s.append(['Análisis y mejoras']);[s.append([line]) for line in analysis]
for s in b:
 s.freeze_panes='A2';s.auto_filter.ref=s.dimensions
 for c in s[1]:c.font=Font(name='Calibri',bold=True,color='FFFFFF');c.fill=PatternFill('solid',fgColor='8E5A45');c.alignment=Alignment(wrap_text=True)
 for col in s.columns:
  letter=col[0].column_letter;s.column_dimensions[letter].width=min(65,max(16,max(len(str(c.value or '')) for c in col)*.6))
 for row in list(s.rows)[1:]:
  for c in row:c.alignment=Alignment(vertical='top',wrap_text=True)
b.save(out/'Plan de mantenimiento mejorado.xlsx')
report='# Análisis del plan de mantenimiento\n\n'+'\n'.join('- '+line for line in analysis)+'\n\n## Aclaraciones por rutina\n\n'
for p in plans:
 if p['review']:report+='### '+p['title']+'\n\n'+'\n'.join('- '+line for line in p['review'])+'\n\n'
report+='## Referencias de pintura\n\nSe conservan dentro de los insumos históricos del archivo mejorado; no constituyen una orden de compra ni una especificación técnica actual verificada.\n'
(out/'Analisis de mantenimiento.md').write_text(report)
print(json.dumps({'routines':len(plans),'needs_review':sum(bool(p['review']) for p in plans),'source_rows':sum(len(v) for v in groups.values()),'outputs':['maintenance-import.json','Plan de mantenimiento mejorado.xlsx','Analisis de mantenimiento.md']}))
