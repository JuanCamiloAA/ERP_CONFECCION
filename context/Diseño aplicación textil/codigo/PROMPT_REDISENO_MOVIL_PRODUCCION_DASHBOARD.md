# Prompt de implementación — Producción móvil + Editor de dashboard

Pégale esto a tu agente de código dentro del repo `ERP_CONFECCION`. Está escrito contra los archivos reales del proyecto (Laravel 11 + Inertia + React 19 + TS + Tailwind v4).

---

## Contexto del proyecto

- Layout: `resources/js/Layouts/AppLayout.tsx` (sidebar por secciones `main / production / payroll / admin`, header de 64px, dark mode con `useDarkMode`).
- Primitivas: `resources/js/Components/UI/` (`Button`, `Input`, `Select`, `Card`, `Table`, `Badge`, `Modal`, `PageHeader`).
- Paleta: slate + indigo (`--color-brand-*` en `resources/css/app.css`), radios `rounded-lg / rounded-xl`, tarjetas `border-slate-200 bg-white shadow-sm` y `dark:border-slate-700 dark:bg-slate-800`.
- Ya existe `.responsive-table` en `resources/css/app.css` (tabla → tarjetas bajo 640px). **No la reemplaces**, respétala.
- Iconos: `@heroicons/react/24/outline`. No agregues otra librería de iconos.

**Regla general del cambio: es limpieza visual y de ergonomía móvil. No cambies rutas, controladores, validaciones, permisos (`Can`), nombres de campos ni la forma de los payloads.**

Objetivo transversal: la app se usa sobre todo en **móvil y tablet**. Objetivos táctiles mínimos de 44px (hoy los `Button size="sm"` miden 32px), acción primaria al alcance del pulgar, y nada que desborde horizontalmente en 390px.

---

## 1. Módulo de producción

### 1.1 Nuevo componente `resources/js/Components/UI/SearchSheet.tsx`

Hoja inferior (bottom sheet) reutilizable para elegir **un** ítem entre muchos.

- Usa `Dialog` / `DialogPanel` / `Transition` de `@headlessui/react` (ya es dependencia).
- Móvil: panel anclado abajo, `h-[85vh]`, `rounded-t-2xl`, entra con `translate-y-full → translate-y-0`. Escritorio (`sm:`): centrado, `rounded-2xl`, `h-[70vh]`.
- Estructura: tirador (`h-1 w-11 rounded-full bg-slate-200`, solo móvil) → título + subtítulo opcional + botón cerrar de 40px → campo de búsqueda de 48px con `MagnifyingGlassIcon` y `XCircleIcon` para limpiar → contador (`"7 de 264 referencias activas"`) → lista desplazable con `scrollbar-thin`.
- Filtrado en cliente, insensible a mayúsculas **y a acentos** (`normalize('NFD').replace(/[\u0300-\u036f]/g,'')`), sobre `title + subtitle + keywords`.
- Sección **Recientes** arriba (máx. 3, solo cuando la búsqueda está vacía), luego el resto.
- Cada fila: alto ≥ 56px, `leading` opcional (miniatura 44px), título de 15px semibold truncado, subtítulo de 12px, `trailing` opcional alineado a la derecha con `tabular-nums`, y `CheckIcon` indigo en el seleccionado. Al tocar: selecciona y cierra.
- Autofocus del input al abrir (`afterEnter`); limpiar la búsqueda cada vez que se abre.

API:

```ts
interface SearchSheetItem {
  id: number | string;
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
  leading?: ReactNode;
  keywords?: string;
  disabled?: boolean;
}

interface SearchSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  items: SearchSheetItem[];
  selectedId?: number | string | null;
  onSelect: (id: number | string) => void;
  recentIds?: (number | string)[];
  searchPlaceholder?: string;
  emptyMessage?: string;
  countLabel?: (shown: number, total: number) => string;
}
```

### 1.2 `resources/js/Components/Productions/ProductionRegisterForm.tsx`

Mantén intacta toda la lógica actual: `useForm` con los mismos campos, `lotCapInfo` (tope del lote por operación), el auto-precio al elegir operación, el cacheo de la última referencia en `localStorage`, y el `onSuccess` que limpia dejando la referencia puesta.

Cambios:

1. **Referencia y operación dejan de ser `<Select>`** (y **no** deben ser tarjetas/grilla de fichas: pueden ser cientos y desbordan). Se reemplazan por un campo de una línea `PickerField` que abre el `SearchSheet`:
   - alto mínimo 56px, borde `border-slate-300`, hover `border-indigo-400`, `ChevronUpDownIcon` a la derecha;
   - muestra la selección en dos líneas (`REF-1042 · Camisa Oxford MC` / `Lote 1.200 · disponibles 440`) o el placeholder si no hay nada;
   - miniatura de la referencia a la izquierda cuando existe `image`, si no un cuadro `bg-indigo-50` con `PhotoIcon`;
   - el de operación queda deshabilitado hasta que haya referencia, con placeholder `Primero elige referencia`;
   - propaga `errors.reference_id` / `errors.operation_id` igual que antes.
2. Ítems de las hojas:
   - referencias → `title: "{code} · {name}"`, `subtitle: "{n} operaciones · disponibles {saldo}"`, `keywords: code`, miniatura; `recentIds` desde una nueva clave `production-register-form:recent-reference-ids` (últimas 3, se actualiza al seleccionar);
   - operaciones → solo las de la referencia elegida, `subtitle: "registradas {n}"` con `productions_quantity_by_operation`, `trailing` con `formatCurrency(pivot.price)`.
   - Al elegir referencia: limpia `operation_id` y `unit_price` (igual que hoy).
3. **Cantidad** pasa a stepper: botones `−` / `+` de 56px, el input al centro (`h-14 text-center text-2xl font-bold`), y una fila de atajos `+10 / +50 / +100 / Todo` (píldoras de 40px). Respeta `lotCapInfo.remaining` como máximo y deshabilita todo si el saldo es 0.
4. **Turno** pasa de `<Select>` a control segmentado de tres opciones (`h-11`, activo `bg-indigo-600 text-white`).
5. **Barra inferior fija solo en móvil** (`fixed inset-x-0 bottom-0 z-30 ... lg:hidden`): "Valor a pagar" + el total vivo en indigo, y el botón de guardar a todo el ancho con alto ≥ 52px usando `form="production-register-form"`. Añade `pb-28 lg:pb-0` al `<form>` para que no tape el último campo. En escritorio (`lg:`) se conserva la tarjeta "Resumen" y el botón al pie de la tarjeta.
6. Elimina el bloque duplicado de "Referencia seleccionada" con imagen de 80px: esa información ya vive en el `PickerField`.

### 1.3 `resources/js/Pages/Productions/Index.tsx`

- **Filtros colapsados en móvil**: en lugar de la grilla de 6 `<Select>` siempre visible, muestra un botón `Filtros` (píldora de 36–40px con `AdjustmentsHorizontalIcon`) y **chips de los filtros activos** con "×" para quitarlos uno a uno. Al tocar `Filtros` abre los campos actuales en un `Modal`/hoja; en `lg:` mantén la tarjeta de filtros como está hoy.
- **Lista con jerarquía en móvil**: en vez de repetir "etiqueta: valor" por cada columna, cada fila muestra `empleado` (semibold), `REF · operación` (13px slate-500), `fecha · turno · cantidad` (12px slate-400) y a la derecha el **valor** en semibold sobre el `Badge` de estado. En `sm:` y arriba sigue siendo la `<Table>` actual. Puedes lograrlo con dos bloques (`sm:hidden` / `hidden sm:block`) reutilizando los mismos datos.
- Encima de la lista, una barra fina: `Registros · 38` a la izquierda y `Total $ 781.200` en indigo a la derecha (usa el `totals` que ya llega).
- La acción primaria `Registrar` va a una **barra inferior fija** en móvil (`lg:hidden`), con alto 48px; en escritorio se queda en el `PageHeader`.
- Los botones de acción por fila (`editar` / `eliminar`) deben medir 44px en móvil.

---

## 2. Editor del dashboard

`resources/js/Components/Dashboard/DashboardGrid.tsx`. El dashboard es personalizable por usuario (`react-grid-layout`, layout persistido en `dashboard.layout.update`) y ese carácter debe verse — no lo conviertas en un diseño fijo.

1. **Escritorio (`≥1024px`): sin cambios.** Se conserva `GridLayoutWithWidth`, `draggableHandle=".panel-drag-handle"`, `compactType="vertical"`, el guardado con debounce de 600ms y el toast de error.
2. **Móvil / tablet angosta (`<1024px`)**: el grid de 12 columnas no cabe. Renderiza una lista de una o dos columnas donde cada panel ocupa **media pantalla** (`col-span-1`) o **pantalla completa** (`col-span-2`), en el orden que el usuario definió.
3. **Modo edición** (botón `Editar tablero` arriba a la derecha): reemplaza el arrastre por controles táctiles. Header indigo pegajoso (`sticky top-16 h-14 bg-indigo-600`) con cerrar y `Guardar`. Cada panel se muestra como una fila con borde `border-dashed border-indigo-300`, icono, nombre, tipo + ancho actual, y cuatro botones de 40px: cambiar ancho (`ArrowsPointingIn/Out`), subir, bajar, ocultar (`EyeSlashIcon`). Debajo, sección **Ocultos** con botón `Mostrar`. Al pie, botón outline `Agregar panel` que lleva al constructor de widgets.
4. **Persistencia**: reusa el mismo endpoint `dashboard.layout.update` con la variante sufijada `` `${variant}:mobile` `` para no pisar el layout de escritorio. Codificación: `y` = orden, `w` = `6` (media) o `12` (completa), `h` = `0` cuando el panel está oculto, `1` cuando es visible. Guarda con el mismo debounce de 600ms.
5. Extiende `DashboardPanel` con `label?: string` y `kind?: string` ("KPI", "Gráfico", "Tabla") para que el editor muestre nombres legibles, y pásalos desde `CompanyAdminOverview.tsx`, `EmployeeOverview.tsx` y `SuperAdminOverview.tsx` (para los widgets a medida, usa el nombre del widget).
6. Los KPI de `StatCard` en móvil deben caber **dos por fila**: cifra 22px, etiqueta 12px, y **sin** el cuadro de icono de 48px (que se muestre solo en `sm:`).
7. Nada de scroll horizontal: el gráfico de productividad en móvil se dibuja como barras horizontales con el nombre a la izquierda y la cifra a la derecha (ya es `layout="vertical"` en Recharts, solo ajusta `width` del `YAxis` y el alto por fila).

Si el backend valida la variante contra una lista blanca, agrega las variantes `:mobile` en `config/dashboard_builder.php` / el controlador correspondiente.

---

## 3. Criterios de aceptación

- A 390px de ancho no hay scroll horizontal en Producción (listado y registro) ni en el Dashboard.
- Con 264 referencias y 40 operaciones, elegirlas toma máximo dos toques y un texto de búsqueda; ninguna lista desborda.
- El total a pagar es visible sin hacer scroll mientras se llena el registro.
- Reordenar y ocultar paneles en móvil sobrevive a recargar la página, y no altera el layout de escritorio del mismo usuario.
- Ningún objetivo táctil bajo 44px en móvil.
- Modo claro y oscuro correctos en todo lo nuevo (`dark:` en cada superficie, borde y texto).
- No hay cambios en rutas, permisos ni contratos de datos.

---

## 4. Archivos de referencia ya escritos

En este mismo paquete van implementaciones completas y listas para copiar:

- `resources/js/Components/UI/SearchSheet.tsx` (nuevo)
- `resources/js/Components/Productions/ProductionRegisterForm.tsx` (reemplaza el actual)
- `resources/js/Components/Dashboard/DashboardGrid.tsx` (reemplaza el actual)

Falta por hacer con este prompt: `Pages/Productions/Index.tsx` (filtros colapsados + lista con jerarquía + barra inferior), los `label` / `kind` en los tres overviews del dashboard, y el ajuste de `StatCard` en móvil.
