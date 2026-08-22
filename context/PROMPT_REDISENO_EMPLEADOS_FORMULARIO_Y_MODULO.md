# Rediseño del módulo de Empleados — formulario, listado y móvil

Objetivo: reemplazar el layout actual de `Datos personales` (tarjeta grande) + `Estado y foto` + `Acceso al sistema` (dos tarjetas en la columna derecha) por un patrón único de **secciones con índice lateral y barra de acción fija** en escritorio, y **formulario por pasos** en móvil. El listado del módulo adopta la misma retícula, tipografía y tokens.

No cambies el modelo de datos, las rutas, los nombres de campos ni el payload. `useForm` conserva exactamente las mismas claves (`first_name`, `last_name`, `document_type`, `document_number`, `phone`, `email`, `address`, `hire_date`, `photo`, `base_salary`, `payroll_mode`, `daily_salary`, `minutes_per_full_workday`, `ordinary_hours_per_day`, `is_exempt_from_overtime`, `scheduled_work_days`, `is_active`, `notes`, `bank_id`, `bank_account_number`, `bank_key`, `create_user_account`, `user_email`, `user_role_id` + `createAccessPasswordData()`), igual que `transform` / `stripAccessPasswordData`, `forceFormData: true` y el manejo de `collectUnmappedErrors` con `membership_limit`. Es un cambio de UI y de composición.

**Decisión de patrón** (si prefieres invertirla, cámbiala aquí y el resto del documento sigue válido): escritorio = una pantalla con índice; móvil = tres pasos. El mismo formulario, dos presentaciones del mismo orden de secciones.

## Archivos a tocar

| Archivo | Qué hacer |
| --- | --- |
| `resources/js/Pages/Employees/Create.tsx` | Reescribir el layout al patrón nuevo. Mantener `useForm`, `submit`, `updateAccessPassword`, `unmappedErrors` y los condicionales por `payroll_mode` tal como están. |
| `resources/js/Pages/Employees/Edit.tsx` | Mismo shell y mismas secciones que Create. Añadir los bloques «solo Edit» descritos abajo (meta de última edición, aviso de producción registrada, estado de la cuenta de acceso). |
| `resources/js/Components/Employees/EmployeeFormLayout.tsx` | **Nuevo.** Shell de tres columnas: índice `196px` (sticky) · contenido `flex: 1; min-width: 0` · `aside` `292px` (sticky). En ≤ 1024px el índice desaparece y el `aside` baja al final del flujo; en ≤ 640px el shell delega en el modo por pasos. |
| `resources/js/Components/Employees/EmployeeFormSection.tsx` | **Nuevo.** Encabezado de sección: título 15px/500, etiqueta «Obligatorio / Opcional» a la derecha, y la regla que se desvanece en los extremos. Reemplaza `<Card>` + `<CardHeader>` dentro del formulario. |
| `resources/js/Components/Employees/PayrollModeField.tsx` | **Nuevo.** Selector de modalidad: segmentado en escritorio, tres tarjetas de radio en móvil. Sustituye el `<Select label="Modalidad de nomina">`. |
| `resources/js/Components/Employees/EmployeePhotoField.tsx` | **Nuevo.** Dropzone 96×96 con arrastrar y soltar. Elimina el `<input type="file">` crudo con «Ningún archivo seleccionado». |
| `resources/js/Components/Employees/EmployeeFormSteps.tsx` | **Nuevo.** Cabecera de pasos + barra fija inferior para móvil (Identidad → Nómina y pago → Acceso). |
| `resources/js/Components/Employees/AccessPasswordFields.tsx` | Reestilizar: las dos opciones de contraseña pasan a segmentado; el aviso amarillo se convierte en caja de acento. Sin cambios en `AccessPasswordData`, `createAccessPasswordData`, `stripAccessPasswordData` ni en el contrato de `errors`. |
| `resources/js/Components/Employees/ScheduledWorkDaysField.tsx` | Reestilizar los chips a los tokens nuevos (día activo = borde acento + relleno tenue). Misma lógica ISO 1–7. |
| `resources/js/Pages/Employees/Index.tsx` | Rediseñar cabecera, filtros, tabla y tarjetas móviles según «Listado». |
| `resources/js/Pages/Employees/Show.tsx` | Alinear al mismo orden de secciones (Identidad · Contacto · Nómina · Datos para pago · Acceso) para que ver y editar se lean igual. |
| `resources/js/Components/UI/{Input,Select,Textarea,Switch,Checkbox,Card,Button}.tsx` | **No reescribir para este módulo.** Si adoptas los tokens en todo el producto, ajústalos ahí una sola vez; si no, pasa las clases desde estos formularios. |

## Estructura del formulario (escritorio)

```
Cabecera propia (no el PageHeader genérico)
├── izquierda: breadcrumb · «Nuevo empleado» · «4 campos obligatorios pendientes»
└── derecha:   [Cancelar] [Guardar empleado]
────────────────────────────────────────────────────────────────
índice 196px (sticky)   │ contenido (flex: 1)          │ aside 292px (sticky)
  Identidad             │  1  Identidad                │  Empleado activo
  Contacto              │     foto 96px + nombres      │  Acceso al sistema
  Nómina                │     + documento + ingreso    │    (bloque desplegable)
  Datos para pago       │  2  Contacto                 │  Notas internas
  Acceso al sistema     │  3  Nómina                   │
  Notas                 │  4  Datos para pago          │
```

- El contenedor usa `padding: 24px 34px 34px` y `gap: 26px` entre columnas; las secciones se separan con `gap: 20px`.
- El índice marca la sección visible con `box-shadow: inset 2px 0 0 <acento>` + relleno tenue (mismo tratamiento que el ítem activo del sidebar en `AppLayout.tsx`). Al hacer clic desplaza a la sección — **sin `scrollIntoView`**: usa `window.scrollTo({ top: el.offsetTop - 80, behavior: 'smooth' })`.
- Regla de sección: `height: 1px; background: linear-gradient(to right, transparent, <borde> 48px, <borde> calc(100% - 48px), transparent)`.

### 1 — Identidad

- Foto: dropzone 96×96, radio 14px, borde `1px dashed`, icono cámara + «Arrastra la foto» y enlace «Subir archivo». Acepta arrastrar y soltar además del input nativo. `errors.photo` debajo.
- A la derecha, grid `1fr 1fr`: `Nombres*`, `Apellidos*`, `Documento*`, `Fecha de ingreso*`.
- **`Documento` es un campo compuesto**: un solo borde con el tipo (`CC`, `CE`, `TI`, `PAS`, `NIT`) como desplegable de 56px a la izquierda y el número a la derecha. Hoy son dos campos separados que ocupan una fila completa; el tipo casi nunca cambia y no merece medio ancho.
- El asterisco de obligatorio pasa de `text-rose-500` a acento: en un formulario donde casi todo es obligatorio, el rojo es ruido; el rojo queda reservado para errores reales.

### 2 — Contacto

Grid `1fr 1fr`: `Teléfono`, `Correo personal`; `Dirección` ocupa las dos columnas. Ayuda del correo: «Se propone como correo de acceso si creas la cuenta.»

### 3 — Nómina

- La modalidad es lo primero de la sección, como **segmentado de tres opciones** a ancho completo: `Por operaciones` · `Salario diario fijo` · `Por horas — legal`. La etiqueta de la sección lleva un pill con la modalidad elegida.
- Debajo, solo los campos de esa modalidad (misma lógica condicional de hoy):
  - `operations` → `Salario base` en tono opcional + nota «Su pago sale de la producción registrada.»
  - `fixed_daily` → `Salario diario*`, `Minutos jornada completa` («Ej. 480 = 8 horas»), `Días hábiles esperados`.
  - `hourly_legal` → `Salario base*` («Base mensual para el valor/hora legal»), `Jornada ordinaria diaria (horas)*`, `Exento de horas extra` (con la nota del art. 162 CST), `Días hábiles esperados`.
- Los campos condicionales aparecen con una transición de 120ms de opacidad y desplazamiento de 4px, nunca de golpe.
- Cuando la modalidad implique un costo calculable, el `aside` muestra el estimado (ver abajo).

### 4 — Datos para pago

- Encabezado con la regla «Los tres campos van juntos o ninguno» en 12px, en lugar del párrafo de dos líneas actual.
- Grid `1.2fr 1fr 1fr`: `Banco`, `Número de cuenta`, `Llave bancaria`. Los sanitizadores actuales (`replace(/\D/g,'')` y `replace(/[^0-9A-Za-z]/g,'')`) no cambian.
- Si `banks.length === 0`, el aviso ámbar se convierte en caja de acento con borde izquierdo de 2px y el enlace «Registrar banco» bajo `<Can permission="banks.index.create">`.
- Si el banco elegido tiene `is_active === false`, pill «Banco inactivo» junto al campo.

### Panel derecho (`aside`)

Tarjetas de `padding: 17px`, radio 14px, superficie un paso por encima del fondo.

1. **Empleado activo** — título 13px + sub 11px «Aparece en registros de producción» + switch 40×22.
2. **Acceso al sistema** — switch «Crear cuenta para esta persona». Al activarlo se despliega dentro de la misma tarjeta: `Correo de acceso*` (prellenado desde `email`, como hoy), `Rol*` (con `formatRoleSelectLabel` y la descripción del rol en 11px), `Contraseña` como segmentado `Autogenerar | Definir manual`, el valor generado en monoespaciada con ojo y botón de regenerar, la caja de acento «Se muestra una sola vez al guardar. Anótela o cópiela antes de continuar.» y la casilla «Pedir cambio de contraseña en el primer ingreso».
3. **Notas internas** — `Textarea` de 3 filas. Sale del cuerpo del formulario: es lo último que se escribe y no merece media pantalla.
4. **Costo estimado** (solo cuando `payroll_mode !== 'operations'` y hay salario) — cifra 26px/500 tabular-nums + «/ mes», y el cálculo en 12px («26 días hábiles × $72.000. Sin recargos ni extras.»).
5. **Falta para guardar** (solo Create) — ítems con ✓ o círculo punteado; de aquí sale el contador «N campos obligatorios pendientes» de la cabecera. Es la única fuente de verdad del progreso.

En Edit, en lugar de «Falta para guardar»: meta «Editado hace 3 días por Ana Cardona», estado de la cuenta (`Con acceso · Operaria` o `Sin acceso`, con acción «Restablecer contraseña») y, si el empleado tiene producción registrada, aviso con borde izquierdo de 2px: «Esta persona ya tiene producción registrada. Cambiar la modalidad afecta las liquidaciones de aquí en adelante; lo ya liquidado conserva sus valores.»

## Móvil (≤ 640px) — formulario por pasos

Una sola columna. El formulario se divide en **3 pasos** y el `aside` desaparece: su contenido se reparte entre el paso 3 (acceso, estado) y la barra fija inferior.

- Cabecera: `←` · «Nuevo empleado» 17px · «2 de 3» a la derecha; debajo, tres segmentos de 3px como progreso, y la línea «Nómina y pago» en 12px muted.
- Los pasos: **1 Identidad** (foto, nombres, documento, ingreso, teléfono, correo, dirección) · **2 Nómina y pago** (modalidad, campos de la modalidad, días hábiles, datos para pago) · **3 Acceso** (activo, crear acceso, correo, rol, contraseña, notas).
- La modalidad en móvil son **tres tarjetas de radio apiladas** (icono + nombre + una línea de explicación), no un segmentado: los rótulos no caben a 360px.
- Alturas táctiles: inputs 44px, filas de switch y casillas 48px, chips de día 44px de alto. Inputs numéricos a 16px para que iOS no haga zoom. El grid de dos columnas pasa a `minmax(0, 1fr)` con `min-width: 0` en los contenedores.
- `Documento` compuesto se mantiene, con el desplegable de tipo a 64px.
- Barra fija inferior (`position: fixed; inset-x: 0; bottom: 0; padding-bottom: env(safe-area-inset-bottom)`): a la izquierda «Atrás», a la derecha el botón principal en proporción 2:1 — «Continuar» en pasos 1–2, «Guardar empleado» en el paso 3. Encima de la barra, en 11px, lo que falta del paso actual.
- Al pasar de paso se validan solo los campos de ese paso; el error hace foco en el primer campo inválido sin sacar al usuario del paso.
- Un paso completo muestra ✓ en su segmento y se puede volver tocándolo.
- En **Edit móvil** los pasos se reemplazan por secciones colapsadas de 48px («Identidad · María Gómez ›», «Nómina · Salario diario ›», «Acceso · Operaria ›») con pill «editado» en las que cambiaron: editar un teléfono no debe obligar a recorrer el formulario completo.

## Listado (`Pages/Employees/Index.tsx`)

Escritorio:

- Cabecera: título 24px/500 + «Personas del taller, su modalidad de pago y su acceso al sistema.» y a la derecha el botón delineado «Nuevo empleado» bajo `<Can permission="employees.index.create">`.
- **Fila de cuatro métricas** (tarjetas de 17px, kicker 11px en mayúsculas + cifra 27px/500 tabular-nums): `Activos` · `Con acceso` · `Sin datos de pago` (en acento cuando > 0) · `Inactivos`. Salen de la consulta del índice; si el backend no los expone todavía, agrégalos al controlador como conteos, no los calcules sobre la página actual.
- Barra de filtros en una línea: búsqueda (`SearchInput`, 420px máx.), segmentado `Activos | Inactivos | Todos` — el mismo que hoy solo existe en móvil, reemplazando el `<select>` de escritorio —, filtro «Modalidad» y, a la derecha, el conteo en 12px.
- Tabla con las columnas `Empleado · Documento · Modalidad · Pago · Acceso · acciones`. Se retiran `Teléfono` e `Ingreso` de la vista por defecto (viven en el detalle); entran `Modalidad` (pill) y `Pago` (banco, o «Falta banco» en acento con icono de aviso cuando no hay datos bancarios completos).
- `Acceso` muestra el rol cuando existe cuenta (`Operaria`, `Aux. contable`) en vez de un badge «Con acceso» que no dice de qué: el rol es la información que se busca.
- Filas: avatar de iniciales 34px, nombre 14px + correo 12px muted; separador `1px` entre filas, sin bordes de tabla completos. Las filas inactivas van a `opacity: .62` y su acción principal pasa a «Reactivar».
- Acciones: lápiz visible + menú `⋮` con `Editar`, `Inactivar`, `Eliminar` (respetando `employees.index.edit` / `employees.index.delete` como hoy). Se retiran los tres botones sueltos por fila.
- Paginación en 12px: «Mostrando 1–5 de 42» + controles de 30px.

Móvil (mantiene y reestiliza lo que ya existe):

- Cabecera de filtro pegajosa bajo el header: búsqueda de 44px + segmentado de estado de 44px.
- Tarjetas de empleado: avatar 40px, nombre, `CC 1.098.442.331 · ingresó 03/2025`, y una fila de pills — modalidad, banco o «Falta banco», rol o «Sin acceso», «Inactivo».
- Las métricas se vuelven una fila deslizable horizontal de cuatro pastillas antes del listado.
- El botón fijo inferior «Nuevo empleado» de 48px se conserva, con el estilo delineado nuevo.

## Estilo

Tokens del tema oscuro; en claro usa los pares equivalentes de la escala. Tipografía Inter, ya presente en `resources/css/app.css`.

| Uso | Valor |
| --- | --- |
| Fondo de página | `#161826` |
| Superficie de tarjeta / panel | `#232532` |
| Superficie de campo | `#161826` (dentro de tarjeta) · `#1c1e2b` (sobre fondo) |
| Sidebar / barras fijas | `#1a1c29` |
| Borde | `#3f424d` · separador de fila `#2f313d` |
| Texto | `#e9e9ed` · muted `#9397ab` · sutil `#75798c` · tenue `#595d6c` |
| Acento | `#9184d9` · texto sobre relleno `#d2cefd` · icono/línea `#b5abfc` · relleno `rgba(145,132,217,.13)` |
| Radio | 8px campos y controles · 14px tarjetas y contenedores |
| Elevación | `box-shadow: 0 0 0 1px #3f424d` — borde y oscuridad ambiental, nunca sombras apiladas |

- **Los botones principales son delineados, no rellenos**: `1px solid #9184d9` + fondo transparente + texto `#d2cefd`. El `bg-indigo-600` relleno actual desaparece de este módulo. Si decides adoptarlo en todo el producto, cambia la variante `primary` de `Components/UI/Button.tsx` una sola vez.
- Etiquetas de campo: 12px/500 en `#9397ab` (hoy son 14px en `slate-300`); el valor debe pesar más que su rótulo.
- Máximo dos pesos tipográficos: 400 y 500. Nada de `font-bold` en títulos — la jerarquía es tamaño y espacio.
- Foco de teclado: `outline: 2px solid #9184d9; outline-offset: 2px`. Nunca el anillo azul del navegador.
- Estados de hover y presionado desde la rampa del acento (`#b5abfc` un paso, `rgba(145,132,217,.09)` como tinte).
- Iconos: Phosphor (`@phosphor-icons/react`) en 15–19px. No mezclar con Heroicons dentro de las pantallas rediseñadas; si el resto del producto sigue en Heroicons, migra el módulo completo, no media pantalla.
- Toda cifra de dinero, minutos y días con `font-variant-numeric: tabular-nums` y `formatCurrency` / `Intl.NumberFormat('es-CO')`.
- Sin emoji, sin gradientes de color saturado, sin tarjetas con barra de acento a la izquierda salvo los dos avisos indicados.

## Criterios de aceptación

1. Crear y editar comparten shell, orden de secciones y panel; la única diferencia son los bloques «solo Edit» y el checklist «solo Create».
2. Ningún campo obligatorio queda debajo del pliegue sin que el contador de la cabecera lo anuncie; el contador y el checklist salen del mismo cálculo.
3. Cambiar la modalidad de nómina revela y oculta sus campos sin recargar ni perder lo escrito, y el `aside` refleja el costo estimado al instante.
4. En móvil se puede crear un empleado completo con acceso al sistema sin hacer zoom ni scroll horizontal, y la barra inferior siempre muestra la acción siguiente.
5. La contraseña autogenerada se puede ver, regenerar y copiar antes de guardar, con el aviso de «se muestra una sola vez» visible sin scroll.
6. El listado responde «¿a quién le falta banco?» y «¿quién tiene acceso y con qué rol?» sin abrir ningún detalle.
7. El payload enviado a `employees.store` / `employees.update` es idéntico al actual, incluido el `stripAccessPasswordData` cuando `create_user_account` es falso.
