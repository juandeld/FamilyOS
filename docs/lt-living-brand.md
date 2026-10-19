# LT Living — Marca y línea gráfica

**Versión 1.0 · Octubre 2026 · Para equipos de diseño y desarrollo (humanos o agentes de código)**

LT Living es la marca del *household agent* de la familia Lima Toralla: una app privada que coordina la casa (agenda, personal, compras, mantenimiento, proveedores) con el nivel de servicio de un hotel de lujo. Este documento define cómo se ve, cómo suena y cómo se construye. Si estás implementando la app o cualquier pieza (uniformes, papelería, web), todo lo que necesitas está aquí; cuando dudes, elige la opción más silenciosa.

---

## 1. Concepto

**Posicionamiento:** modern farmhouse de alta gama — materiales naturales que envejecen bien (yeso, roble encalado, lino, barro cocido) tratados con la precisión de la hotelería de lujo contemporánea. Referencia de tono: Patina Osaka (Capella Hotel Group): calidez, poco contraste, un solo acento, nada ornamental.

**La marca en tres palabras:** Calma · Herencia · Discreción.

**Principios de diseño**

1. **El lujo está en la materia, no en el emblema.** Pocos elementos, bien proporcionados. Nunca un logo grande; nunca más de un acento por pantalla.
2. **Bordes, no sombras.** Separar con hairlines de 1px (`line`) y con cambios de superficie (`ground` → `surface` → `surface-sunken`). Sin `box-shadow`, salvo el mínimo imprescindible para un elemento flotante.
3. **Blanco sobre yeso.** El fondo es Yeso; las tarjetas son Nieve. Esa diferencia de un paso es lo que da profundidad.
4. **La terracota es un gesto.** Aparece en la T del monograma, en hairlines de acento, en el horario destacado, en el botón primario y en el delantal del staff. Nunca como fondo de pantalla, nunca en más de un elemento principal a la vez.
5. **Serif ligera para lo que se lee despacio, sans para lo que se usa.** Cormorant Garamond Light para títulos y monograma; Jost para interfaz y cuerpo.
6. **Mayúsculas espaciadas son la firma tipográfica.** Etiquetas y wordmark siempre en versalitas con tracking amplio (0.28em–0.42em).

---

## 2. Nombre y lenguaje

- **Nombre de marca:** `LT Living`. La sigla LT viene de los apellidos Lima Toralla.
- **Wordmark completo:** `LIMA TORALLA LIVING`, en mayúsculas, tracking 0.42em, con una hairline de 48px a cada lado.
- **Idioma de la interfaz:** español (es-GT). Tuteo cálido y breve. Saludos del día ("Buenos días"), nunca jerga tecnológica.
- **Vocabulario:** "casa" (no "hogar" ni "propiedad"), "pedir" (no "solicitar"), "staff" o "equipo de casa" (no "empleados"), roles por función: ama de llaves, chef, jardinero, chofer, mantenimiento.
- **Tono:** anticipa, no interrumpe. Frases cortas. Ejemplo de copy: "Todo lo que ocurre en casa, anticipado con discreción."
- **Microcopy modelo:** "Hoy en casa" (título del inicio), "Pedir algo" (sección de acciones), "Por confirmar" (estado pendiente), "Listo" (completado).

---

## 3. Logo

El logo es tipográfico. No existe un símbolo aparte: el monograma **LT** es la marca. Hasta que se vectorice, se construye en código con las reglas siguientes; no se debe aproximar con otra fuente.

### 3.1 Monograma
- `LT` en **Cormorant Garamond Light (300)**, `letter-spacing: -0.04em`, `line-height: 0.9`.
- La **L** en `ink`; la **T** en `terracota`. Es la única vez que el acento toca el logo.
- Tamaño mínimo: 22px (bordado y favicon). En tamaños ≤ 26px la T puede ir en `ink` si el terracota no se resuelve bien (p. ej. bordado monocromo).

### 3.2 Lockup vertical (uso principal)
```
        LT          ← monograma, 132px en la pieza de referencia
 ——  LIMA TORALLA LIVING  ——   ← wordmark 13px, tracking 0.42em, hairlines 48×1px en terracota
```
Gap entre monograma y wordmark: `space-4` (16px) + 2px. Centrado. Sobre un bloque `surface` con cuatro esquinas de hairline en `terracota` (14×14px, 1px) como marco discreto — ese marco es opcional y solo en piezas estáticas (portadas, papelería), nunca en la app.

### 3.3 Lockup horizontal (cabeceras de app y web)
`LT` a 26px (T en terracota) alineado a la izquierda; a la derecha, la fecha o la sección en estilo `label`. Sin wordmark.

### 3.4 Versiones de color
| Fondo | L | T | Wordmark |
|---|---|---|---|
| `ground` / `surface` (claro) | `ink` | `terracota` | `terracota-ink` o `ink` |
| `ink` (oscuro) | `on-ink` | `terracota` | `on-ink` |
| `terracota-ink` (delantal, botón) | `on-terracota` | `on-terracota` | — |

### 3.5 Prohibido
Contornos, degradados, sombras, rotaciones, cambiar la fuente, pegar la T a la L, poner el monograma en tamaño gigante como fondo, acompañarlo de un icono de casa.

---

## 4. Color

Dos temas: **Día** (por defecto) y **Noche**. Todos los valores están en `tokens.json`; en CSS se exponen como `--<token>`.

| Token | Día | Noche | Uso |
|---|---|---|---|
| `ground` | `#F4F2EE` Yeso | `#2A2622` | Fondo de página y de pantallas |
| `surface` | `#FDFDFB` Nieve | `#332E29` | Tarjetas, paneles, bloque del logo |
| `surface-sunken` | `#ECE8E1` | `#1F1C19` | Filas de agenda, inputs |
| `line` | `#D6D0C6` Greige frío | `#4A443D` | Hairlines y bordes (1px) |
| `line-strong` | `#2A2622` | `#FDFDFB` | Regla bajo cabeceras |
| `ink` | `#2A2622` Carbón | `#FDFDFB` | Texto principal, monograma |
| `ink-muted` | `#6E675E` | `#B5ADA2` | Texto secundario, labels |
| `terracota` | `#A8705A` | `#C98E76` | Acento decorativo y texto ≥ 24px |
| `terracota-ink` | `#8E5A45` | `#C98E76` | Texto de acento pequeño, botón primario |
| `on-terracota` | `#FDFDFB` | `#2A2622` | Texto sobre terracota-ink |
| `on-ink` | `#FDFDFB` | `#2A2622` | Texto sobre ink |

**Reglas**
- Texto de cuerpo siempre `ink` o `ink-muted` (ambos cumplen 4.5:1 sobre `ground` y `surface`).
- `terracota` (`#A8705A`) **no** cumple 4.5:1 para texto pequeño sobre Yeso: úsalo para la T del monograma, hairlines, bordes y texto a 24px o más. Para labels y horarios destacados usa `terracota-ink`.
- Botón primario: relleno `terracota-ink`, texto `on-terracota`. Nunca relleno `terracota` con texto blanco.
- Proporción orientativa por pantalla: 70% ground, 20% surface, 8% ink/líneas, 2% terracota.
- Sin otros colores. Los estados (éxito, alerta) se expresan con texto en `ink`/`terracota-ink` y con el verbo ("Listo", "Pendiente"), no con verde/rojo.

```css
:root, [data-theme="light"] {
  --ground: #f4f2ee; --surface: #fdfdfb; --surface-sunken: #ece8e1;
  --line: #d6d0c6; --line-strong: #2a2622;
  --ink: #2a2622; --ink-muted: #6e675e;
  --terracota: #a8705a; --terracota-ink: #8e5a45;
  --on-terracota: #fdfdfb; --on-ink: #fdfdfb;
}
[data-theme="dark"] {
  --ground: #2a2622; --surface: #332e29; --surface-sunken: #1f1c19;
  --line: #4a443d; --line-strong: #fdfdfb;
  --ink: #fdfdfb; --ink-muted: #b5ada2;
  --terracota: #c98e76; --terracota-ink: #c98e76;
  --on-terracota: #2a2622; --on-ink: #2a2622;
}
```

---

## 5. Tipografía

**Familias (Google Fonts):**
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=Jost:wght@300;400;500&display=swap" rel="stylesheet">
```
```css
--font-serif: "Cormorant Garamond", "Cormorant", Georgia, serif;
--font-sans: "Jost", "Futura", "Century Gothic", sans-serif;
```

**Escala**

| Estilo | Familia | Tamaño / interlínea | Peso | Tracking | Uso |
|---|---|---|---|---|---|
| `monogram` | serif | 132 / 0.9 | 300 | −0.04em | El logo |
| `display-xl` | serif | 96 / 0.92 | 300 | −0.03em | Portadas, bienvenida |
| `display-l` | serif | 44 / 1.05 | 300 | −0.01em | Títulos de sección (docs, web) |
| `title` | serif | 30 / 1.1 | 300 | 0 | Título de pantalla ("Hoy en casa") |
| `title-italic` | serif | 30 / 1.2 | 300 italic | 0 | Frases de marca, citas |
| `heading` | serif | 20 / 1.3 | 400 | 0 | Encabezado de tarjeta |
| `body` | sans | 15 / 24 | 300 | 0 | Cuerpo |
| `body-strong` | sans | 15 / 24 | 400 | 0 | Nombre de ítem, énfasis |
| `ui` | sans | 14 / 20 | 400 | 0 | Botones, chips, controles |
| `caption` | sans | 12 / 16 | 300 | 0 | Metadatos, horas (en `ink-muted`) |
| `label` | sans | 11 / 16 | 400 | 0.28em | Versalitas (`text-transform: uppercase`) |
| `wordmark` | sans | 13 / 16 | 400 | 0.42em | Nombre bajo el monograma, mayúsculas |

**Reglas**
- Cormorant solo en peso 300 (y 400 para `heading`). Nunca bold.
- Jost 300 para leer, 400 para accionar. Nunca 500+ salvo casos puntuales de énfasis.
- Las etiquetas (`label`, `wordmark`) siempre en mayúsculas y con tracking. Es el gesto que más identifica a la marca después del monograma.
- Nada de Inter, Roboto, Arial ni fuentes del sistema como fallback visible.

---

## 6. Espaciado, radios y líneas

**Espaciado (múltiplos de 4):** `space-1` 4 · `space-2` 8 · `space-3` 12 · `space-4` 16 · `space-6` 24 · `space-8` 32 · `space-10` 40 · `space-14` 56 · `space-16` 64.

**Radios:** `radius-0` 0px (marcos, impresos, bloque del logo) · `radius-md` 14px (filas de agenda, tarjetas pequeñas) · `radius-lg` 28px (pantallas y tarjetas grandes) · `radius-pill` 999px (chips y botones).

**Líneas:** siempre 1px. `line` para separar, `line-strong` para cerrar una cabecera, `terracota` para una hairline de acento (máximo una por pantalla, p. ej. el borde izquierdo de 2px del ítem destacado).

**Sombras:** ninguna por defecto. Si un elemento debe flotar (hoja modal), `0 12px 32px rgba(42,38,34,0.08)` y nada más.

---

## 7. Componentes de la app

Especificación de referencia; los valores apuntan a tokens.

### Pantalla (`Screen`)
- Fondo `ground`. Padding horizontal `space-6`, superior `space-8`.
- Contenido principal en una tarjeta `surface`, `radius-lg`, borde 1px `line`, padding `space-6` (28px en el prototipo).
- Ancho de referencia móvil: 390px.

### Cabecera (`Header`)
- Izquierda: lockup horizontal (LT 26px, T en `terracota`).
- Derecha: fecha en `label`, `ink-muted` ("DOM 18 OCT").
- Debajo, bloque de saludo: `label` en `terracota-ink` ("BUENOS DÍAS") + `title` en `ink` ("Hoy en casa"). Gap `space-1`.

### Fila de agenda (`AgendaItem`)
- Fondo `surface-sunken`, `radius-md`, padding `space-3` vertical / 14px horizontal.
- Izquierda: `body-strong` (nombre) sobre `caption` en `ink-muted` (lugar · responsable). Gap `space-1`.
- Derecha: hora en `caption` `ink-muted`; si está destacada, en `terracota-ink`.
- Ítem destacado (el siguiente evento): borde izquierdo 2px `terracota`.
- Separación entre filas: `space-2`. Sin iconos salvo necesidad.

### Botón (`Button`)
- Forma `radius-pill`, altura mínima 36px (44px área táctil), padding `space-2` × `space-4`, texto `ui`.
- **Primario:** relleno `terracota-ink`, texto `on-terracota`. Uno por pantalla.
- **Secundario:** borde 1px `line`, texto `ink`, sin relleno.
- **Terciario / texto:** sin borde, texto `terracota-ink`.
- Hover/pressed: oscurecer 6% el relleno o el borde; sin sombra, sin escala.

### Chip (`Chip`)
- Igual al botón secundario pero `caption`/`ui` a 12px, padding `space-2` × 14px. Seleccionado: relleno `ink`, texto `on-ink`.

### Sección de acciones ("Pedir algo")
- `label` en `ink-muted` + fila de chips con `gap: space-2`, `flex-wrap`.

### Inputs
- Fondo `surface-sunken`, borde 1px `line`, `radius-md`, texto `body`, placeholder `ink-muted`. Foco: borde `ink`, sin glow.

### Iconografía
- Trazo 1.25px, esquinas redondeadas, 20px, color `ink` o `ink-muted`. Preferir texto a icono. Nunca emoji.

### Movimiento
- Transiciones de 180–240ms, `ease-out`. Nada rebota, nada parpadea. El cambio de tema es un fundido de 240ms.

---

## 8. Uniformes del staff

Mismo sistema, en tela. Siluetas limpias, materiales naturales, acabado impecable.

| Pieza | Color | Material | Detalle |
|---|---|---|---|
| Camisa | Nieve (`surface`) | Lino | Cuello mao, manga larga arremangable |
| Pantalón / falda | Carbón (`ink`) | Sarga de algodón | Corte recto |
| Delantal | Terracota apagada (`terracota`) | Lino grueso | Monograma **LT** bordado en Nieve, 22–26px de alto, en el peto a la izquierda |
| Chaleco (servicio formal) | Carbón (`ink`) | Lana ligera | Monograma bordado tono sobre tono o en hilo terracota |

- El delantal terracota es la pieza identitaria: a distancia dice "staff de la casa" sin un logo visible.
- Sin logotipos grandes, sin nombres bordados en el frente. Etiqueta interior con el wordmark.
- Pantone de referencia para la tela (aproximados, confirmar con muestra física): Terracota ≈ Pantone 7592 C a 80%; Carbón ≈ Pantone Black 7 C; Nieve ≈ Pantone 11-0601 TCX.

---

## 9. Aplicaciones y entregables

**Pantalla de inicio (referencia):** lockup horizontal + fecha → saludo → lista de 4 ítems de agenda (el próximo destacado) → "Pedir algo" con tres chips (Café, Transporte, Mantenimiento). Es la pantalla que fija el tono de toda la app.

**Papelería y portadas:** fondo Yeso, bloque Nieve con el lockup vertical y marco de esquinas en terracota, márgenes `space-14` / `space-16`.

**Favicon / icono de app:** fondo Yeso, `LT` en Cormorant 300 centrado, T en terracota. Sin esquinas redondeadas propias (deja que el sistema las aplique).

**Checklist antes de dar algo por terminado**
- [ ] ¿Hay más de un elemento terracota compitiendo? Quita uno.
- [ ] ¿Alguna sombra? Cámbiala por un borde `line` o un cambio de superficie.
- [ ] ¿Las etiquetas están en mayúsculas con tracking?
- [ ] ¿El texto pequeño en terracota usa `terracota-ink`?
- [ ] ¿La T del monograma está en terracota y la fuente es Cormorant Garamond Light?
- [ ] ¿Funciona en tema Noche sin que nada desaparezca?

---

## 10. Materiales e imaginario

Para fotografía, moodboards e ilustración de interiores: yeso blanco, roble encalado, lino blanco, barro cocido, acero negro mate, piedra caliza. Luz natural de mañana, sombras suaves, nada saturado. Nunca renders brillantes ni dorados.


---

## Anexo A · tokens.json (fuente de verdad)

```json
{
  "name": "LT Living",
  "version": 1,
  "color": {
    "themes": [
      { "id": "light", "name": "Día" },
      { "id": "dark", "name": "Noche" }
    ],
    "tokens": [
      { "name": "ground", "value": { "light": "#f4f2ee", "dark": "#2a2622" }, "usage": "Yeso. Fondo de página y de pantallas de la app. En Noche pasa a Carbón." },
      { "name": "surface", "value": { "light": "#fdfdfb", "dark": "#332e29" }, "usage": "Nieve. Tarjetas, paneles, el bloque del logo. Siempre un paso más claro que ground." },
      { "name": "surface-sunken", "value": { "light": "#ece8e1", "dark": "#1f1c19" }, "usage": "Filas de agenda, campos de entrada, zonas hundidas dentro de una tarjeta surface." },
      { "name": "line", "value": { "light": "#d6d0c6", "dark": "#4a443d" }, "usage": "Greige frío. Hairlines, bordes de tarjeta y de chip. Nunca más de 1px." },
      { "name": "line-strong", "value": { "light": "#2a2622", "dark": "#fdfdfb" }, "usage": "Regla de 1px bajo cabeceras y para separar secciones mayores." },
      { "name": "ink", "value": { "light": "#2a2622", "dark": "#fdfdfb" }, "usage": "Carbón. Texto principal, monograma, iconos." },
      { "name": "ink-muted", "value": { "light": "#6e675e", "dark": "#b5ada2" }, "usage": "Texto secundario, etiquetas en versalitas, horarios no destacados. 4.5:1 sobre ground y surface." },
      { "name": "terracota", "value": { "light": "#a8705a", "dark": "#c98e76" }, "usage": "Terracota apagada. Acento decorativo: la T del monograma, hairlines de acento, bordes, texto a 24px o más. Para texto pequeño usar terracota-ink." },
      { "name": "terracota-ink", "value": { "light": "#8e5a45", "dark": "#c98e76" }, "usage": "Terracota profunda. Texto de acento pequeño (etiquetas, horarios destacados) y relleno del botón primario. 5:1 sobre ground." },
      { "name": "on-terracota", "value": { "light": "#fdfdfb", "dark": "#2a2622" }, "usage": "Texto y monograma sobre un relleno terracota-ink (botón primario, delantal)." },
      { "name": "on-ink", "value": { "light": "#fdfdfb", "dark": "#2a2622" }, "usage": "Texto sobre un relleno ink (chaleco, bloque oscuro)." }
    ]
  },
  "type": {
    "fonts": [],
    "families": {
      "serif": "\"Cormorant Garamond\", \"Cormorant\", Georgia, serif",
      "sans": "\"Jost\", \"Futura\", \"Century Gothic\", sans-serif"
    },
    "groups": [
      {
        "name": "Display",
        "family": "serif",
        "styles": [
          { "name": "monogram", "fontSize": "132px", "lineHeight": 0.9, "fontWeight": 300, "letterSpacing": "-0.04em", "sample": "LT", "usage": "El monograma. Solo Cormorant Garamond Light; la T en terracota." },
          { "name": "display-xl", "fontSize": "96px", "lineHeight": 0.92, "fontWeight": 300, "letterSpacing": "-0.03em", "sample": "La casa, en calma.", "usage": "Portadas, pantallas de bienvenida." },
          { "name": "display-l", "fontSize": "44px", "lineHeight": 1.05, "fontWeight": 300, "letterSpacing": "-0.01em", "sample": "Pátina sobre Yeso", "usage": "Títulos de sección en documentos y web." },
          { "name": "title", "fontSize": "30px", "lineHeight": 1.1, "fontWeight": 300, "sample": "Hoy en casa", "usage": "Título de pantalla en la app." },
          { "name": "title-italic", "fontSize": "30px", "lineHeight": 1.2, "fontWeight": 300, "fontStyle": "italic", "sample": "Calma · Herencia · Discreción", "usage": "Frases de voz de marca, citas." },
          { "name": "heading", "fontSize": "20px", "lineHeight": 1.3, "fontWeight": 400, "sample": "Compras de la semana", "usage": "Encabezado de tarjeta." }
        ]
      },
      {
        "name": "Texto",
        "family": "sans",
        "styles": [
          { "name": "body", "fontSize": "15px", "lineHeight": "24px", "fontWeight": 300, "sample": "Todo lo que ocurre en casa, anticipado con discreción.", "usage": "Cuerpo de texto. Jost Light sobre fondos claros." },
          { "name": "body-strong", "fontSize": "15px", "lineHeight": "24px", "fontWeight": 400, "sample": "Desayuno familiar", "usage": "Nombre de un ítem de agenda, énfasis dentro del cuerpo." },
          { "name": "ui", "fontSize": "14px", "lineHeight": "20px", "fontWeight": 400, "sample": "Transporte", "usage": "Texto de botones, chips y controles." },
          { "name": "caption", "fontSize": "12px", "lineHeight": "16px", "fontWeight": 300, "sample": "Comedor · Cocina", "usage": "Detalle bajo un ítem, horas, metadatos. Siempre en ink-muted." },
          { "name": "label", "fontSize": "11px", "lineHeight": "16px", "fontWeight": 400, "letterSpacing": "0.28em", "sample": "BUENOS DÍAS", "usage": "Etiquetas en versalitas (mayúsculas). Color ink-muted o terracota-ink." },
          { "name": "wordmark", "fontSize": "13px", "lineHeight": "16px", "fontWeight": 400, "letterSpacing": "0.42em", "sample": "LIMA TORALLA LIVING", "usage": "El nombre bajo el monograma, siempre en mayúsculas, con hairlines a los lados." }
        ]
      }
    ]
  },
  "spacing": {
    "tokens": [
      { "name": "space-1", "value": "4px", "usage": "Separación entre un ítem y su caption." },
      { "name": "space-2", "value": "8px", "usage": "Gap entre chips; separación entre filas de agenda." },
      { "name": "space-3", "value": "12px", "usage": "Padding vertical de filas; gap icono-texto." },
      { "name": "space-4", "value": "16px", "usage": "Padding de chips (horizontal); gap entre hairline y wordmark." },
      { "name": "space-6", "value": "24px", "usage": "Padding horizontal de una pantalla de app; gap entre bloques." },
      { "name": "space-8", "value": "32px", "usage": "Padding de tarjetas grandes." },
      { "name": "space-10", "value": "40px", "usage": "Gap entre secciones en documentos." },
      { "name": "space-14", "value": "56px", "usage": "Margen superior de página impresa / web." },
      { "name": "space-16", "value": "64px", "usage": "Margen lateral de página impresa / web." }
    ]
  },
  "radius": {
    "tokens": [
      { "name": "radius-0", "value": "0px", "usage": "Marcos con esquinas de hairline, bloques de logo, impresos." },
      { "name": "radius-md", "value": "14px", "usage": "Filas de agenda y tarjetas pequeñas dentro de la app." },
      { "name": "radius-lg", "value": "28px", "usage": "Pantallas y tarjetas grandes de la app." },
      { "name": "radius-pill", "value": "999px", "usage": "Chips y botones." }
    ]
  }
}
```
