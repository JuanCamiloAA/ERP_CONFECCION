# Prompt de implementación — Rediseño del layout: sidebar y navbar

Pégale este documento completo a tu agente de código dentro del repo `ERP_CONFECCION`.
Es la especificación del prototipo `Rediseno - Layout (sidebar y navbar).dc.html` (variantes **A · Grupos plegables** y **B · Rail + panel**).

Archivo principal a intervenir: `resources/js/Layouts/AppLayout.tsx`.
Catálogo de navegación: `app/Helpers/PermissionHelper.php`.

---

## 0. Qué cambia y por qué

El sidebar actual agrupa por tabla de base de datos y mete 20 destinos en dos bloques desiguales; el navbar de 64px va casi vacío (solo selector de empresa, tema y avatar) y no dice dónde estás.

Tres decisiones:

1. **Reordenar la navegación por flujo de trabajo**, no por modelo de datos: 6 áreas.
2. **Dar trabajo al navbar**: migas de pan + título de página, buscador global ⌘K, selector de empresa que no se comprime.
3. **Sidebar plegable por grupos** (variante A) o **rail de áreas + panel** (variante B), y **barra inferior de 5 destinos** en móvil.

---

## 1. Reordenamiento de la navegación — el cambio de fondo

`PermissionHelper::navigationCatalog()` (o el array equivalente) pasa de 2 grupos a **6 áreas**, en este orden:

| Área | Módulos |
| --- | --- |
| **Inicio** | Dashboard |
| **Taller** | Producción · Ranking · Referencias · Operaciones |
| **Nómina** | Nómina · Anticipos · Gastos · Conceptos · Parámetros legales · Festivos |
| **Personas** | Empleados · Bancos · Usuarios · Roles y permisos |
| **Análisis** | Reporte producción · Reporte nómina |
| **Administración** | Mi empresa · Empresas · Periodicidad de pagos · Planes de membresía · Landing pública · Carga masiva (CSV) · Constructor de dashboards |

Criterios que justifican el orden — respétalos si añades módulos:
- Lo que se usa **a diario** arriba (Taller), lo que se toca **una vez al mes** en medio (Nómina), lo que se configura **una vez al año** abajo (Administración).
- **Bancos** sale de Administración y entra en Personas: se usa al dar de alta un empleado, no al configurar la empresa.
- **Mi empresa** encabeza Administración (es lo más visitado del grupo); **Empresas** y **Planes de membresía** quedan después, y solo se pintan para super admin.
- Cada área expone `key`, `title`, `icon` (Heroicon 24 outline) y `badge` opcional (contador de atención: p. ej. jornadas abiertas en Taller).

Cada ítem admite `count?: string` — un número discreto a la derecha del label (empleados activos, jornadas abiertas). No lo pongas en más de dos ítems por área.

El filtrado por permisos no cambia: un área sin ítems visibles no se renderiza.

---

## 2. Estructura del layout

```
┌────────────┬──────────────────────────────────────────┐
│  sidebar   │  navbar 56px  (migas · buscador · cuenta) │
│  236px     ├──────────────────────────────────────────┤
│            │  main: max-w 1180px, padding 24px 20px    │
└────────────┴──────────────────────────────────────────┘
```

Medidas (variante A, densidad Media):
- Sidebar **236px** expandido, **56px** colapsado (solo iconos, con `title` como tooltip).
- Navbar **56px** (antes 64) — se gana altura útil sin perder aire.
- Contenido **máx. 1180px**, `padding: 24px 20px 48px`.

---

## 3. Sidebar — variante A (recomendada por defecto)

`resources/js/Components/Layout/SidebarGroups.tsx`

- Cabecera de 56px: marca (logo de la empresa o el icono genérico) + nombre de la empresa + plan en `text-[10px] uppercase tracking-wider`.
- Un `<button>` por área que despliega/pliega su lista, con caret (`ChevronDownIcon` abierto / `ChevronRightIcon` cerrado), título en `text-[10px] font-medium uppercase tracking-[0.11em]` y badge opcional.
- **Solo el área de la página actual arranca abierta**; el resto plegadas. El estado abierto se guarda en `localStorage` (`erp.sidebar.groups`), fusionado con el área activa para que la ruta actual siempre esté visible. Nunca borres otras claves.
- Ítems: icono 17px + label + `count` opcional. Alto de fila según densidad (§6).
- Colapsado (56px): desaparecen las cabeceras de grupo, se sustituyen por un divisor de 1px, y los iconos se centran. `title` en cada enlace hace de tooltip.
- Pie: botón **Contraer** con `ChevronLeftIcon`. El estado colapsado persiste en `localStorage` (`erp.sidebar.collapsed`).

### Marcado del ítem activo

Es la decisión visual del menú; expón las tres opciones como constante y elige una (por defecto **Barra**):

| Modo | Regla |
| --- | --- |
| Barra | `bg-slate-800` + `box-shadow: inset 2px 0 0` en el acento |
| Píldora | `rounded-full` + fondo acento tenue + texto acento claro |
| Solo texto | sin fondo, solo el texto en color acento |

---

## 4. Sidebar — variante B (rail + panel)

Para pantallas anchas y usuarios que viven en un área:

- **Rail de 62px**: un botón por área (solo icono, 40×44px, `title` obligatorio), punto de aviso arriba a la derecha si el área tiene badge. Al pie, botón de ayuda.
- **Panel de 214px**: cabecera con el nombre del área y lista plana de sus módulos (sin iconos: el área ya está identificada por el rail). Pie con empresa y plan.
- Cambiar de área en el rail cambia el panel **sin navegar**; la navegación ocurre al pulsar un módulo del panel.
- Colapsado en esta variante = ocultar el panel y dejar solo el rail.

Implementa ambas detrás de una constante de configuración (`SIDEBAR_VARIANT`), no de un toggle de usuario — el conmutador del prototipo existe solo para que elijas.

---

## 5. Navbar (56px)

Tres bloques, y su **prioridad de compresión es parte de la especificación** (fue el origen de varios defectos):

| Bloque | Contenido | Comportamiento flex |
| --- | --- | --- |
| Izquierda | Migas `Área › Módulo` en 11px + título del módulo en 15px | `flex: 0 0 auto; max-width: 260px; overflow: hidden` — **no se comprime** |
| Centro | Buscador global con lupa, placeholder y chip `⌘K` | `flex: 1 1 240px; min-width: 0; overflow: hidden` — **absorbe todo el sobrante** |
| Derecha | Selector de empresa · tema · notificaciones · avatar | `flex-shrink: 0` en el selector de empresa; el grupo con `min-width: 0` |

Reglas duras, en este orden:
1. **El buscador es el único que cede espacio.** Su envoltorio lleva `overflow:hidden` para que jamás se pinte encima de sus vecinos.
2. **El nombre de la empresa nunca se trunca** (`flex: 0 0 auto; white-space: nowrap`): en un ERP multiempresa es el dato de más jerarquía del header — saber en qué cliente estás.
3. **El nombre del usuario no se muestra**: basta el avatar con iniciales, que ya lo identifica. Fue lo primero en sacrificarse para que quepa lo demás.
4. Ningún `min-width` fijo sobre un hijo centrado: desborda simétricamente sobre los hermanos en vez de empujarlos.

Contenido de cada pieza:
- **Migas**: `Taller › Producción`. El área no es un enlace (no tiene página propia); el módulo, sí.
- **Buscador**: abre un modal de comandos con ⌘K / Ctrl+K. Busca empleados, referencias y nóminas. Registra el atajo con `useEffect` y quítalo al desmontar.
- **Selector de empresa**: punto acento + nombre + caret; abre el menú de cambio de empresa (solo super admin). Con `title="Cambiar de empresa"`.
- **Tema** y **notificaciones**: botones de icono 30×30 con punto de aviso.
- **Avatar**: 26px circular con iniciales, abre el menú de cuenta (perfil, cerrar sesión).

---

## 6. Densidad y tratamiento del marco

Tres escalas, aplicadas como **variables CSS en `:root`** (no como clases repartidas), para que un solo cambio reajuste todo el marco a la vez:

```css
--rail-w  --panel-w  --bar-h
--item-pad  --item-font  --item-gap  --group-gap  --item-radius
--main-pad  --stack  --title
--side-bg  --rail-bg  --bar-bg  --edge
--on-bg  --on-fg  --on-mark
```

| Densidad | rail | navbar | padding de ítem | contenido |
| --- | --- | --- | --- | --- |
| Compacta | 212px | 48px | 5px 9px | `18px 16px 40px` |
| Media (por defecto) | 236px | 56px | 7px 10px | `24px 20px 48px` |
| Amplia | 272px | 68px | 10px 12px | `34px 28px 60px` |

**Marco** — cuánto se separa la navegación del contenido:
- *Panel oscuro* (por defecto): sidebar más oscuro que el contenido, borde `slate-700`.
- *Sin costuras*: sidebar y contenido al mismo tono, separados solo por un filete.
- *Acento*: sidebar teñido de índigo profundo.

En Tailwind, exponlo como un atributo en `<html>` (`data-density`, `data-chrome`) y define las variables en `app.css`; los componentes leen `var(--*)`. Así el usuario puede cambiar densidad desde Mi empresa sin recompilar clases.

---

## 7. Móvil (< 768px)

El sidebar desaparece por completo.

- **Navbar móvil**: marca 34px + `Área` en 10px mayúsculas sobre el `Módulo` en 14px + botón de búsqueda + avatar.
- **Barra inferior fija** de 5 destinos, `min-height: 48px` cada uno, icono 20px + label 10px: **Inicio · Taller · Nómina · Personas · Más**.
- **"Más"** abre una hoja inferior (`role="dialog"`, cierre por arrastre y por backdrop) con el resto de módulos agrupados por área, en rejilla de 2 columnas.
  - La rejilla **debe** ser `grid-template-columns: repeat(2, minmax(0,1fr))` y cada chip llevar `min-width: 0`: con `1fr` (= `minmax(auto,1fr)`) las etiquetas `nowrap` ensanchan las pistas y la hoja desborda.
- Los 5 destinos de la barra se derivan de las áreas permitidas del usuario: si no tiene Taller, ese hueco lo ocupa la siguiente área con permisos.

---

## 8. Accesibilidad

- `<nav aria-label="Principal">` en el sidebar; `aria-current="page"` en el ítem activo (no confíes solo en el color).
- Los botones de grupo llevan `aria-expanded` y `aria-controls`.
- En el rail de la variante B, cada botón necesita `aria-label` además del `title` (solo hay icono).
- Enlace **Saltar al contenido** oculto, visible al enfocar con teclado, apuntando a `#main`.
- Foco visible en todo control: `focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1`.
- La hoja "Más" atrapa el foco y se cierra con `Escape`.
- **No usar `scrollIntoView`** en ninguna parte del layout.

---

## 9. Criterios de aceptación

- [ ] La navegación está agrupada en las 6 áreas del §1, en ese orden, y Bancos vive en Personas.
- [ ] Solo el área de la página actual arranca desplegada; el estado plegado y el colapsado persisten entre recargas.
- [ ] El navbar muestra migas `Área › Módulo` y el título del módulo, y **las migas no se cortan a media palabra** a ningún ancho ≥ 900px.
- [ ] A 900px de viewport, ningún bloque del navbar se solapa con otro (comprobar las cajas con `getBoundingClientRect`).
- [ ] El nombre de la empresa se lee entero en todos los anchos de escritorio; el buscador es lo único que se estrecha.
- [ ] ⌘K / Ctrl+K abre el buscador desde cualquier página, y el atajo se retira al desmontar.
- [ ] Colapsado a 56px: solo iconos, con tooltip, y el ítem activo sigue distinguiéndose.
- [ ] En móvil hay barra inferior de 5 destinos con hit target ≥ 48px, y la hoja "Más" **no desborda horizontalmente**.
- [ ] Cambiar `data-density` reajusta a la vez rail, navbar, filas, márgenes y título — sin tocar los componentes.
- [ ] `aria-current`, `aria-expanded` y el enlace de salto al contenido están presentes; foco visible en todo control.
- [ ] Un usuario sin permisos de un área no ve esa área, ni en el sidebar ni en la barra inferior.
