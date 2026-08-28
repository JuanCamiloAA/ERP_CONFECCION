# PROMPT — Rediseño de los módulos Roles y Permisos + Usuarios

Aplica el rediseño completo de los módulos **Roles y Permisos** y **Usuarios** al proyecto Laravel + Inertia + React (`ERP_CONFECCION`). Ambos módulos son los últimos que siguen con las primitivas viejas (`Card`, `PageHeader`, `Table`, `Badge`, `Button`, `Input`, `Select`, `Switch`); hay que pasarlos a la piel compartida `emp-*` que ya usan Empleados, Producción, Nómina, Referencias, Gastos y Anticipos.

La maqueta de referencia (interactiva, escritorio + móvil, claro + oscuro) está en `Rediseño Roles y Usuarios.dc.html` y `PermisosEditor.dc.html`. Cuando este documento y la maqueta discrepen, manda la maqueta.

---

## 0. Reglas que no se negocian

1. **Una sola hoja de tokens**: `resources/css/module-ui.css`. No se crean variables nuevas ni se escriben hex sueltos. Todo color sale de `var(--emp-*)`; los colores de rol (los que el usuario elige por rol) son la única excepción y vienen del campo `color` del rol.
2. **Importar la hoja** en cada página nueva: `import '../../../css/module-ui.css';` y envolver el contenido en `.emp-form` con el escape de padding del layout, igual que `Pages/Employees/Index.tsx`:
   `<div className="emp-form -m-4 min-h-screen px-4 pb-28 pt-5 sm:-m-6 sm:px-[34px] sm:pb-8 lg:-m-8 lg:pb-8">`
3. **Dos pesos tipográficos** (400 y 500). La jerarquía es tamaño y espacio. Nada de `font-bold`.
4. **Botones delineados**: `emp-btn`, `emp-btn-primary` (borde acento, fondo transparente), `emp-btn-ghost`, `emp-btn-danger`, `emp-btn-sm`. No se usan botones rellenos indigo.
5. **Iconos Phosphor** (`@phosphor-icons/react`), tamaño 13–17 px en interfaz. Se retiran los `@heroicons` de estas pantallas.
6. **Elevación = borde**, no sombra: `emp-card` (radio 14, `box-shadow: 0 0 0 1px var(--emp-border)`).
7. **Foco visible** siempre: lo da la hoja (`outline: 2px solid var(--emp-accent)`), no lo pises.
8. **Móvil real**: objetivos táctiles ≥ 44 px (la hoja ya sube `.emp-btn` a 48 px en `max-width:640px`), tablas → tarjetas por debajo de `lg`, barra de acción fija abajo para la acción primaria.
9. **Claro y oscuro**: no se codifica ningún color asumiendo tema oscuro.
10. **No se toca el backend** salvo lo indicado en el punto 8 de "Datos que hay que exponer".

---

## 1. Archivos a intervenir

| Archivo | Qué se hace |
| --- | --- |
| `resources/js/Pages/Roles/Index.tsx` | Reescribir: tarjetas de rol + métricas + filtros |
| `resources/js/Pages/Roles/Create.tsx` | Reescribir sobre el mismo formulario que Edit |
| `resources/js/Pages/Roles/Edit.tsx` | Reescribir: datos del rol + panel "a quién afecta" + editor de permisos + barra de cambios |
| `resources/js/Pages/Roles/Show.tsx` | Reescribir: cabecera, 4 métricas, cobertura por módulo, usuarios del rol |
| `resources/js/Pages/Users/Index.tsx` | Reescribir: métricas + tabla densa (escritorio) / tarjetas (móvil) |
| `resources/js/Pages/Users/Create.tsx` | Reescribir sobre el mismo formulario que Edit |
| `resources/js/Pages/Users/Edit.tsx` | Reescribir: identidad, contraseña, acceso, panel de permisos efectivos |
| `resources/js/Pages/Users/Show.tsx` | Reescribir: ficha, qué puede hacer, actividad, su rol |
| `resources/js/Components/Permissions/PermissionCatalogueEditor.tsx` | Ampliar (ver §3) |
| `resources/js/Components/Permissions/PermissionAssignerModal.tsx` | Rehacer cabecera/pie (ver §7) |
| `resources/js/Components/Permissions/RolePropagationDialog.tsx` | Ajustes menores (ver §8) |
| `resources/js/Components/Permissions/PermissionPresets.tsx` | Se elimina como bloque suelto; sus plantillas pasan a chips dentro del editor |
| `resources/js/Components/Roles/RoleBadge.tsx` | Se mantiene la API; se le da forma de `emp-pill` (borde del color del rol, punto de 6 px, sin relleno saturado) |

No se crean componentes nuevos salvo `RoleCard.tsx` y `PermissionSummaryBar.tsx` (§2 y §3.5).

---

## 2. Roles y Permisos — listado (`Pages/Roles/Index.tsx`)

Encabezado:
- H1 24 px `var(--emp-text)`: **"Roles y permisos"**.
- Bajada 13 px `var(--emp-muted)`: *"Cada rol es una plantilla de permisos. Editarla no cambia a nadie hasta que decides a quién se le aplica."*
- Acción derecha: `emp-btn emp-btn-primary` con `<Plus size={14} />` "Nuevo rol". En móvil desaparece de la cabecera y vive en la barra fija inferior.

Franja de métricas (4 tarjetas `emp-card`, `grid-cols-2` en móvil / `grid-cols-4` desde `sm`): cada una con `emp-kicker`, cifra de 26 px y una línea de 11,5 px de contexto.
1. **Roles** — total · *"N de sistema"*
2. **Usuarios con rol** — total · *"de N cuentas"*
3. **Con excepciones** — usuarios cuyos permisos no coinciden con su plantilla, en `var(--emp-accent-on)` · *"no coinciden con su plantilla"*
4. **Sin usuarios** — roles sin nadie asignado · nombre del rol si es uno solo

Filtros en una fila: buscador `emp-field` con lupa a la izquierda (máx. 340 px), segmentado `emp-seg` **Todos / Sistema / Propios**, y a la derecha conteo 12 px `var(--emp-subtle)`: *"5 roles · 6 usuarios asignados"*.

**Tarjetas de rol** (`RoleCard.tsx`), grid de 3 columnas (`lg`), 2 (`md`), 1 (móvil):
- `emp-card`, padding 16, `border-top: 2px solid {role.color}`.
- Fila superior: cuadro de 30 px con radio 9 y fondo `{color}22` con un icono Phosphor por rol; a la derecha nombre 15 px y, debajo, el identificador en monoespaciada 11,5 px `var(--emp-subtle)` seguido —en la misma línea, envolviendo— del pill `Sistema` con candado cuando `is_system`.
- Descripción 12,5 px `var(--emp-muted)`, `min-height: 38px` para que las tarjetas queden a la par.
- Bloque de cobertura: línea `permisos asignados de total` + porcentaje, barra de 4 px (`var(--emp-row)` de fondo, relleno del color del rol) y hasta 3 `emp-pill` con las áreas donde el rol tiene algo (módulos con al menos un permiso).
- Pie separado por `1px solid var(--emp-row)`: pila de avatares (22 px, `margin-left:-6px`, borde 1,5 px del color de la superficie) + *"N usuarios"* en `var(--emp-accent-on)` — **enlaza a `users.index?role_id=`** — y a la derecha los iconos Ver / Editar / Eliminar (32 px, `hover` con `var(--emp-accent-tint)`), respetando `Can` y `is_system`.

Variante tabla: mantener detrás de una preferencia (`?view=table`) con las columnas Rol · Permisos · Áreas · Usuarios · acciones, filas `emp-row-sep emp-hover-row`.

Vacío: `emp-card` centrado, 13 px `var(--emp-muted)`: *"Todavía no hay roles propios. Crea uno o parte de una plantilla."*

---

## 3. Editor de permisos (`PermissionCatalogueEditor.tsx`)

Es el corazón del rediseño y lo comparten la plantilla del rol y el modal por usuario. Tres problemas a resolver: **no se ve qué viene del rol y qué es excepción**, **no se ve el resumen de lo que cambié antes de guardar**, y **falta buscar y marcar en masa rápido**.

### 3.1 Props nuevas

```ts
interface Props {
  catalogue: PermissionModule[];
  value: string[];
  onChange: (next: string[]) => void;
  readonly?: boolean;
  /** 'role' = plantilla; 'user' = permisos de una persona */
  variant?: 'role' | 'user';
  /** Permisos de la plantilla del rol; obligatorio si variant==='user' */
  template?: string[];
  /** Lo guardado hoy; con esto se calcula el resumen de cambios */
  baseline?: string[];
  onApplyTemplate?: () => void;
}
```

### 3.2 Barra de herramientas (una fila, envuelve)
- Buscador `emp-field` con lupa (placeholder *"Buscar módulo, página o permiso"*). Busca en módulo, grupo, etiqueta y nombre técnico. Con texto, todos los módulos se abren.
- `emp-btn emp-btn-sm` **Marcar lo visible** / **Quitar lo visible** — actúan sobre exactamente lo que el filtro + búsqueda dejan a la vista.
- `emp-btn emp-btn-sm` **Expandir todo / Contraer todo**.
- A la derecha, 12 px `var(--emp-subtle)`: *"27 de 81 permisos"*.

### 3.3 Atajos (solo `variant='role'`)
Bloque `background: var(--emp-field-alt)`, radio 10, padding 10/12, con dos grupos de chips (26 px, radio 999, borde `var(--emp-border)`; activo = borde acento + `var(--emp-accent-fill)` + `var(--emp-accent-on)`):
- **Por verbo**: Ver · Crear · Editar · Eliminar · Exportar, cada uno con su conteo `12/15`. Click = marca/desmarca ese verbo en todos los módulos.
- **Plantilla base**: Solo lectura · Operario · Supervisor · Administrador (las de `PermissionPresets`, con la descripción en `title`). Reemplazan la selección completa.

### 3.4 Origen del permiso (solo `variant='user'`)
- Segmentado `emp-seg` **Todos / Del rol / Excepciones**.
- `emp-btn emp-btn-sm` con `<Sparkle />` **Volver a la plantilla del rol**.
- Leyenda de 11 px: cuadro relleno acento = *Del rol*; cuadro con borde punteado `var(--emp-accent-line)` = *Extra de esta persona*; cuadro con borde `var(--emp-danger)` = *Quitado del rol*.
- Cada pastilla de permiso se pinta según su origen:
  - **del rol y marcado** → borde `var(--emp-accent)`, fondo `var(--emp-accent-fill)`, texto `var(--emp-accent-on)`;
  - **extra de la persona** → igual pero **borde punteado** `var(--emp-accent-line)` y sufijo `extra` en 10 px;
  - **está en el rol y aquí se quitó** → borde `var(--emp-danger)`, texto `var(--emp-danger)`, sufijo `quitado`;
  - **ni rol ni asignado** → borde `var(--emp-border)`, texto `var(--emp-muted)`.
  - El `title` explica el origen en palabras además del nombre técnico.

### 3.5 Resumen de cambios (`PermissionSummaryBar.tsx`)
Barra al pie del editor (en la página del rol va `position: sticky; bottom: 0` sobre `var(--emp-bar)`; en el modal es el pie del diálogo):
- Icono + texto: *"Sin cambios desde lo guardado"* o *"N cambio(s) sin guardar"*.
- `emp-btn emp-btn-sm` **Descartar** (vuelve a `baseline`) y **Ver detalle / Ocultar detalle**.
- Al abrir, dos columnas (una en móvil): *Se agregan (N)* con `emp-pill emp-pill-accent` y *Se quitan (N)* con `emp-pill emp-pill-warn`, etiquetadas como `Módulo · Etiqueta`, con `max-height: 96px; overflow:auto`.

### 3.6 Comportamiento que se conserva
- Casillas de tres estados en módulo y grupo (`TriBox`), con `role="checkbox"` y `aria-checked="mixed"`.
- Conceder una acción arrastra el `*.index.view` del módulo y el `*.<pagina>.view` de la página (`withImpliedViews`).
- Acordeón por módulo con contador `n / total` y pill `Solo super admin` cuando aplica.
- Módulo con cambios pendientes: pill `emp-pill emp-pill-accent` con *"N cambiado(s)"* en la cabecera del acordeón.
- Sin resultados: *"Ningún permiso coincide con «término»."*

---

## 4. Rol — crear / editar (`Pages/Roles/Edit.tsx`, `Create.tsx`)

Migas 12 px (`Roles › Nombre`). H1 con punto de 10 px del color del rol. Bajada: *"Plantilla · N usuarios la usan hoy"*. Acciones: `emp-btn` **Cancelar** y `emp-btn emp-btn-primary` **Guardar plantilla** (en crear: **Crear rol**).

Rejilla `minmax(0,1.55fr) minmax(0,1fr)` (una columna en móvil):

**Izquierda — `emp-card` "Datos del rol"**
- `emp-label` + `emp-field` para *Nombre visible* (obligatorio, `emp-req`) e *Identificador interno* (monoespaciada, `emp-help`: *"Se genera del nombre; cámbialo solo si sabes lo que hace."*).
- Textarea *Para qué sirve este rol* con `emp-help`: *"Se lee en el selector de rol al crear un usuario."*
- *Color de la etiqueta*: los 8 presets actuales como círculos de 26 px; el elegido lleva `border: 2px solid var(--emp-accent-line)`. Se retira el `<input type="color">` suelto.

**Derecha — `emp-card` "A quién afecta"**
- Lista de usuarios con el rol: avatar 26 px, nombre 13 px, meta 11 px (*"35 permisos · activo"*), y `emp-pill emp-pill-accent` con *"+N extra"* cuando la persona tiene excepciones. Cada fila enlaza a la ficha del usuario. Enlace "Ver usuarios" arriba a la derecha.
- `emp-note` al pie: *"Al guardar eliges usuario por usuario quién recibe el cambio. Las excepciones de cada persona no se pisan."*

**Debajo — `emp-card` "Permisos de la plantilla"** con el editor de §3 (`variant='role'`) y la barra de resumen pegada abajo.

Al guardar, si hay diferencia y hay usuarios con el rol, se abre el diálogo de propagación (§8) tal como hoy.

---

## 5. Rol — detalle (`Pages/Roles/Show.tsx`)

- Cabecera igual a la de edición, en solo lectura, con **Volver** y **Editar plantilla** (oculto si `is_system`; en su lugar, `emp-note` con el aviso de rol de sistema).
- Cuatro `emp-card` de 15/16 px: *Permisos* (`34 de 118`), *Usuarios*, *Tipo*, *Identificador* (este último en `var(--emp-muted)`).
- **Qué permite, por módulo**: una fila por módulo con icono, nombre, barra de 4 px (112 px de ancho; 54 px en móvil) y `n / total` alineado a la derecha con `tabular-nums`, separadas por `emp-row-sep`.
- **Usuarios con este rol**: filas pulsables (`emp-hover-row emp-row-sep`) que llevan a la ficha, con chevron a la derecha; enlace "Ver en Usuarios" arriba y `emp-note` al pie cuando hay personas con excepciones.
- El catálogo completo en modo lectura sigue disponible, pero por debajo y colapsado por defecto.

---

## 6. Usuarios — listado (`Pages/Users/Index.tsx`)

Encabezado: H1 **"Usuarios"**, bajada *"Quién entra al sistema, con qué rol y con qué excepciones."*, acción `emp-btn emp-btn-primary` **Nuevo usuario**.

Métricas (4): **Activos** (*pueden iniciar sesión*), **Inactivos** (*acceso bloqueado*), **Con excepciones** en `var(--emp-accent-on)` (*permisos fuera del rol*), **Sin entrar aún** (*creado, nunca usado*).

Filtros: buscador `emp-field`, segmentado **Todos / Activos / Inactivos**, `select.emp-field` **Todos los roles** (nuevo filtro por rol; es el enlace cruzado desde el listado de roles vía `?role_id=`), conteo a la derecha. Se conserva la franja de "filtrando por empresa" del super admin, repintada como `emp-note`.

**Escritorio (`lg+`)** — tabla sin caja, cabecera `emp-kicker` con `border-bottom: 1px solid var(--emp-border)`, filas `emp-row-sep emp-hover-row`, celdas 11 px verticales (7 px con la preferencia "filas densas"):

| Columna | Contenido |
| --- | --- |
| Usuario | Avatar 32 px con iniciales sobre `{roleColor}22`, nombre 13,5 px (enlaza a la ficha), correo 11,5 px |
| Rol | `emp-pill` con borde y texto del color del rol y punto de 6 px |
| Permisos | Cifra efectiva + `emp-pill emp-pill-accent` *"+N extra"* + `emp-pill emp-pill-warn` *"−N"* (con `title` explicando cada uno) |
| Empresa | 13 px `var(--emp-muted)` |
| Último acceso | 13 px `var(--emp-muted)`; *"sin entrar aún"* cuando es nulo |
| Acciones | Escudo (abre el modal de permisos), lápiz (editar), menú `DotsThreeVertical` con Restablecer contraseña / Activar-Inactivar / Eliminar |

**Móvil** — tarjetas `emp-card`: avatar 34 px, nombre, correo, y una fila de pills (rol · *N permisos* · *+N extra*); a la derecha el botón de escudo. Barra fija inferior con **Nuevo usuario**.

Paginación como en Empleados: *"Mostrando X–Y de Z"* + botones de 30 px con `emp-seg-on` en la página activa.

---

## 7. Usuario — crear / editar (`Pages/Users/Edit.tsx`, `Create.tsx`) y modal de permisos

Cabecera con avatar de 38 px, nombre y meta (*"correo · último acceso hace 3 días"*), `emp-btn` Cancelar y `emp-btn emp-btn-primary` Guardar cambios.

Rejilla `minmax(0,1.55fr) minmax(0,1fr)`:

**Columna izquierda, tres `emp-card`:**
1. **Identidad** — Nombre*, Apellido, Correo*, Teléfono en `emp-field`.
2. **Contraseña** — botón `emp-btn emp-btn-sm` **Generar** en la cabecera; dos campos con placeholders *"Deja en blanco para no cambiarla"* / *"Repite la contraseña"*. En crear son obligatorios.
3. **Acceso** — interruptor propio (42×24, pista `var(--emp-accent-fill)`, borde `var(--emp-accent)`, perilla `var(--emp-accent-line)`) con etiqueta *"Puede iniciar sesión"* y ayuda *"Al apagarlo la cuenta queda bloqueada sin perder historial."*; debajo, selects de **Rol** (con `emp-help`: *"El rol precarga permisos; después puedes ajustarlos persona por persona."*) y **Empresa**.

**Columna derecha — `emp-card` "Permisos efectivos"**
- Cifra grande (35 permisos) y `emp-btn emp-btn-sm emp-btn-primary` **Ajustar** que abre el modal.
- Tres filas de origen con cuadro de color: *Vienen del rol* (`--emp-accent`), *Extra de esta persona* (`--emp-accent-line`), *Quitados del rol* (`--emp-danger`).
- **Excepciones de esta persona**: pills `+ Módulo · Permiso` (acento) y `− Módulo · Permiso` (warn), con `emp-help`: *"Se guardan aparte de los datos del usuario: cambiar su rol no las borra."*
- El bloque solo aparece con `can_manage_permission_overrides` y si el objetivo no es super admin (se mantiene el mensaje actual en ese caso).

**Modal (`PermissionAssignerModal.tsx`)**
- Ancho 860 px en escritorio; en móvil es una hoja anclada abajo, a pantalla completa.
- Cabecera: `<ShieldCheck />` + *"Permisos de {nombre}"*, subtítulo *"Lo que quede marcado es exactamente lo que esta persona puede hacer."*, botón de cerrar.
- Cuerpo: el editor de §3 con `variant='user'`, `template` = permisos del rol y `baseline` = lo guardado. El scroll vive en el cuerpo, no en la página.
- Pie sobre `var(--emp-bar)`: a la izquierda *"Se guarda aparte de los datos del usuario: cambiar su rol no borra estas excepciones."*, a la derecha **Cancelar** y **Guardar permisos**; encima, el resumen de cambios de §3.5.

**Usuario — detalle (`Pages/Users/Show.tsx`)**
- Cabecera con avatar 44 px y pills (rol con su color · estado · empresa); acciones **Permisos** y **Editar**.
- **Qué puede hacer**: filas por módulo con icono, nombre, pills de excepción (`+N extra`, `−N`) y `n / total`.
- **Actividad reciente**: filas con `emp-pill` de acción, descripción truncada y tiempo relativo (los `accessLogs` actuales).
- Aparte: **Ficha** (correo, teléfono, empresa, creado, último acceso con IP) y **Su rol** con enlace a la plantilla, resumen en prosa (*"N permisos en la plantilla. Esta persona tiene X extra y Y quitados"*) y `emp-btn emp-btn-sm` **Comparar con la plantilla** (abre el modal con el filtro *Excepciones* activo).
- Se elimina la nube de nombres técnicos en monoespaciada.

---

## 8. Diálogo de propagación (`RolePropagationDialog.tsx`)

Se conserva la lógica; se ajusta la forma:
- Título *"Plantilla guardada. ¿A quién se le aplica?"* y subtítulo *"«{rol}» cambió. Nadie pierde ni gana permisos hasta que lo confirmes aquí."*
- Diff en dos columnas (*Se agregan (N)* / *Se quitan (N)*) con pills acento/warn.
- Segmentado **Solo este cambio / Reemplazar por la plantilla** con la ayuda de una línea que ya existe.
- Lista de usuarios: casilla `TriBox` de 17 px, avatar 28 px, nombre + meta (*"correo · N permisos hoy"*), y a la derecha `+N` / `−N` o *"sin cambios"* en `var(--emp-faint)`.
- Acciones rápidas **Todos / Solo a quienes cambia / Ninguno**; pie con *"N de M usuarios seleccionados"*, **Ahora no** y **Aplicar a los seleccionados**.

---

## 9. Datos que hay que exponer

1. `RoleController@index`: por cada rol, `permissions_count`, `users_count`, hasta 3 usuarios (`id`, iniciales, color del rol) para la pila de avatares, y `modules` (claves de módulo con al menos un permiso) para las pills de área.
2. `RoleController@index`: métricas de la franja (`roles_total`, `system_total`, `users_with_role`, `users_with_overrides`, `roles_without_users`).
3. `RoleController@show`: cobertura por módulo (`{ module, display, count, total }`).
4. `UserController@index`: por cada usuario, `permissions_count`, `extra_count` (asignados que no están en la plantilla) y `missing_count` (de la plantilla que le fueron quitados); filtro `role_id`; métricas de la franja.
5. `UserController@edit`: `role_permissions` (ya existe) y el desglose de origen para la tarjeta de permisos efectivos.
6. `UserController@show`: cobertura por módulo con `extra` / `missing` por módulo.
7. El catálogo (`PermissionHelper::catalogue`) se mantiene tal cual: módulo → grupos → permisos con su etiqueta legible.
8. Los conteos se calculan en el servidor, nunca recorriendo el catálogo en el cliente para pintar el listado.

---

## 10. Criterios de aceptación

- [ ] Ninguna de las ocho pantallas importa `Card`, `PageHeader`, `Table`, `Badge`, `Button`, `Input`, `Select` ni `Switch` de `Components/UI`.
- [ ] No queda ningún color literal en JSX salvo el `color` propio del rol.
- [ ] Claro y oscuro se ven correctos en las ocho pantallas (probar con el conmutador del header).
- [ ] Por debajo de `lg` no hay scroll horizontal en ninguna pantalla; los listados son tarjetas y la acción primaria vive en la barra fija inferior.
- [ ] En el modal de un usuario con excepciones se distingue a simple vista qué viene del rol, qué es extra y qué se le quitó.
- [ ] Escribir en el buscador y pulsar "Marcar lo visible" solo afecta a lo que está a la vista con el filtro activo.
- [ ] La barra de resumen muestra el número correcto de cambios y "Descartar" vuelve exactamente al estado guardado.
- [ ] Guardar una plantilla con diferencias abre el diálogo de propagación, y "Ahora no" no altera a ningún usuario.
- [ ] Cada casilla de módulo/grupo expone `aria-checked` con `mixed` en el estado parcial, y todo control tiene su anillo de foco del acento.
- [ ] Los permisos (`Can`, `is_system`, super admin) siguen escondiendo exactamente las mismas acciones que hoy.
