# Prompt de implementación — Nóminas, Empleados, Referencias y Reportes (móvil)

Segunda tanda, después de Producción y el editor del Dashboard. Pégale esto a tu agente de código dentro del repo `ERP_CONFECCION`. Escrito contra los archivos reales (Laravel + Inertia + React 19 + TS + Tailwind v4).

**Fuera de alcance:** el módulo de acceso (`Auth/Login.tsx`, `AuthLayout.tsx`) y la landing pública quedan como están; se tratan en otra iteración.

---

## Reglas comunes (aplican a los cuatro módulos)

1. **Escritorio (`≥1024px`) no cambia.** Todo lo nuevo es la vista angosta; las `<Table>` actuales siguen siendo la vista de escritorio.
2. Ninguna tabla de más de cuatro columnas sobrevive en 390px. En móvil se reemplaza por una **fila con jerarquía**: identidad a la izquierda (semibold), cifra a la derecha (semibold, `tabular-nums`), metadatos debajo en 12px slate-500. El detalle extra se abre al tocar. Implementar con dos bloques hermanos: `<div className="sm:hidden">` / `<div className="hidden sm:block">` reutilizando los mismos datos ya paginados; **no** dupliques consultas ni props.
3. Objetivos táctiles ≥44px. Los `Button size="sm"` de 32px de las columnas de acciones se reemplazan en móvil por un menú (`Menu` de `@headlessui/react`) con botón de 44px y opciones de 44px.
4. Filtros: chips y controles segmentados en vez de `<Select>` sueltos; lo avanzado va en un `Modal`/hoja. Los filtros activos se muestran como chips con "×".
5. La acción primaria del contexto va en **barra inferior fija** en móvil (`fixed inset-x-0 bottom-0 z-30 ... lg:hidden`, alto ≥48px) y se añade `pb-24 lg:pb-0` al contenedor de la página para que no tape el contenido. En escritorio se queda en el `PageHeader`.
6. Cifras siempre con `tabular-nums`; montos con `formatCurrency`, cantidades con `formatNumber`, fechas con `formatDate` (ya existen en `@/lib/utils`).
7. Cada superficie, borde y texto nuevo lleva su variante `dark:` (`bg-white`/`dark:bg-slate-800`, `border-slate-200`/`dark:border-slate-700`, `text-slate-900`/`dark:text-slate-100`).
8. Sin cambios en rutas, controladores, validaciones, permisos (`Can`) ni contratos de datos.

---

## 1. Nóminas — `resources/js/Pages/Payrolls/Index.tsx`

Hoy: tabla de 6–7 columnas (Nómina, Periodo, Tipo, Estado, Total, Acciones) más dos `<Select>` sueltos.

En móvil:

- **Tarjeta por período** (`rounded-xl border border-slate-200 bg-white p-4`), en columna con `gap-3`:
  - título `p.name` (16px semibold) y debajo `{period_start} – {period_end} · {type} · {n} empleados` (12px slate-500);
  - `Badge` de estado arriba a la derecha (mismo `statusVariant` que ya existe);
  - **flujo de 4 pasos**: cuatro barras de 4px (`rounded-full`, `gap-1.5`) que se van llenando `borrador → calculado → aprobado → pagado`; indigo para el avance normal y emerald cuando el estado es `pagado`; las restantes `bg-slate-200 dark:bg-slate-700`;
  - pie con "TOTAL" (11px uppercase slate-500) + `formatCurrency(total_amount)` en 22px bold a la izquierda, y a la derecha **la acción del estado** en un botón de 44px: `Calcular` en borrador, `Aprobar` en calculado, `Marcar pagada` en aprobado, `Comprobantes` (outline, `PrinterIcon`) en pagado. Respeta los permisos con `Can` exactamente como en `Show.tsx`.
- Filtros: chip de año (`2026 ▾`) y chip de estado (`Todos los estados ▾`) de 36px que abren un `Modal` con los `<Select>` actuales; al cambiar, se aplica igual que hoy (`router.get` con `preserveState`).
- Barra inferior fija: `Nueva nómina` (solo si no es vista consolidada y con `Can permission="payrolls.index.create"`).
- Toda la tarjeta es enlace a `payrolls.show` (respetando `payrolls.show.view`).

## 2. Detalle de nómina — `resources/js/Pages/Payrolls/Show.tsx`

Hoy: 7 tarjetas de resumen y una tabla de 11 columnas con filas expandibles, edición de minutos de jornada, ajustes por concepto, anticipos y ausencias. **Toda esa lógica se conserva**; solo cambia la presentación en móvil.

- **Resumen** (reemplaza los 7 `StatCard` en `<lg`): una sola tarjeta con `Badge` de estado + periodo arriba, luego filas `etiqueta / valor`: Bruto producido, Jornada y recargos, Ajustes manuales, Anticipos (en `text-rose-600` con signo `–`), Deducciones (idem); separador; **Neto a pagar** en 22px bold indigo. Los valores salen tal cual de `payrollEmployeeTotals` y `payroll.total_amount`.
- **Detalle por empleado** en móvil: una fila por empleado con nombre (semibold), `módulo · {formatNumber(unidades)}` debajo, y a la derecha el **neto** en semibold con `bruto {formatCurrency(rowGross(row))}` en 11px slate-400. Chevron a la derecha; el mismo `expanded: Set<number>` de hoy controla la apertura.
- Al expandir (fondo `bg-slate-50 dark:bg-slate-900/40`): filas `Producido`, `Jornada · recargos`, `Ajustes manuales`, `Anticipos`, `Ausencias · deducciones`, y dos botones de 40px: `Ajuste` (abre el `adjModal` actual) y `Jornadas` (los campos de minutos y motivo que ya existen). Se muestran solo con los permisos actuales (`canManageConceptAdjustments`, `canAdjustBeforeCalc`).
- Los modales de ajuste, los campos de anticipos y las confirmaciones de ausencia siguen igual, pero sus inputs pasan a 44px de alto en móvil y el modal ocupa el ancho completo con acciones apiladas.
- **Barra inferior fija** con la acción del estado (`Calcular` / `Aprobar` / `Marcar pagada`, con su color actual: la de aprobar y pagar usan `variant="success"`) y, a su izquierda, un botón cuadrado de 48px para imprimir (`PrinterIcon`, enlaza a `payrolls.export`). En escritorio, la fila de botones del `PageHeader` no cambia.
- Añade `Buscar` sobre el detalle (input de 44px o chip que abre uno) filtrando por nombre en cliente sobre `payrollEmployees.data`: con 28+ empleados paginados es lo que evita el scroll infinito.

## 3. Empleados — `resources/js/Pages/Employees/Index.tsx`

Hoy: tabla de 8–9 columnas, `SearchInput` + un `<select>` nativo suelto.

- **Cabecera de filtro pegajosa** bajo el header (`sticky top-16 z-10 bg-white dark:bg-slate-800 border-b`): `SearchInput` de 44px y debajo un **segmentado** `Activos / Inactivos / Todos` (mismo estado `status`, mismos `updateFilters`). Elimina el `<select>` nativo sin estilos del sistema.
- Contador: `28 empleados activos` (12px slate-500) sobre la lista.
- **Fila** de 44px de avatar + nombre completo semibold + `{document_type} {document_number} · ingresó {MM/AAAA}` + chips: `Con acceso` (emerald) / `Sin acceso` (neutral), banco (neutral) y `Banco inactivo` (amber) cuando `bank.is_active === false`. A la derecha, menú de 44px con Editar / Inactivar / Eliminar según permisos (los mismos `Can` y `ConfirmDialog` de hoy).
- Barra inferior fija: `Nuevo empleado`.

## 4. Referencias — `resources/js/Pages/References/Index.tsx`

Hoy: tabla de 8 columnas donde "Lote (máx. op. / total)", "Pago u." y "Costo op." son ilegibles en móvil.

- **Tarjeta por referencia**: miniatura de 52px (imagen o `TagIcon` sobre `bg-indigo-50`), `code` en 16px semibold, `name` debajo, `Badge` Activa/Inactiva a la derecha.
- **Avance del lote**: etiqueta `Lote · operación más avanzada` + `{productions_max_per_operation} / {lot_total_quantity}` en semibold, y barra de progreso de 6px (`bg-slate-200`, relleno indigo con el porcentaje). Si `lot_total_quantity` es nulo, no se dibuja la barra y se muestra `Sin lote definido`.
- **Dos cifras** lado a lado en cajas `bg-slate-50 dark:bg-slate-900/40 rounded-lg p-2.5`: `Pago por unidad` (`payment_per_unit`) y `Costo operativo` (`operational_cost_per_unit_fixed`), con `—` cuando falten.
- **Operaciones dentro de la tarjeta**: encabezado `{operations_count} operaciones` y hasta 3 filas `nombre / precio` (`tabular-nums`), más el enlace `Ver referencia` a `references.show`. Los precios salen del pivot que ya usa `ReferenceUnitEconomicsCard` / `ProductionRegisterForm`; si la lista no viene en el índice, cárgala con el mismo `with()` que ya usa producción o deja solo el contador (no dispares una consulta por fila).
- Barra inferior fija: `Nueva referencia`.

## 5. Reporte de producción — `resources/js/Pages/Productions/Report.tsx` (lo consume `Pages/Reports/Production.tsx`)

Hoy: dos inputs de fecha + botón, 4 `StatCard`, un `BarChart` y **tres tablas apiladas** (empleado, referencia, operación) cada una con su paginación.

- **Rango con atajos**: chips `Hoy / Semana / Mes / Rango`, donde los tres primeros fijan `start`/`end` y aplican de una; `Rango` abre un `Modal` con los dos `Input type="date"` actuales. Mantén el `router.get` y los nombres de parámetros existentes.
- **KPIs 2×2** en móvil (cifra 22px, etiqueta 12px, sin el cuadro de icono de 48px, que queda para `sm:`).
- Gráfico diario: alto 96–140px en móvil, `XAxis` con etiquetas cortas (`lun`, `mar`…), sin `YAxis` (los valores viven en el tooltip). Destaca la barra del día máximo en indigo 600 y el resto en indigo 200.
- **Pestañas** `Empleado / Referencia / Operación` (patrón de `Components/UI/Tabs.tsx`) en vez de las tres tablas apiladas; solo se renderiza la activa, cada una conserva **su** `Pagination`.
- Cada fila del ranking: nombre a la izquierda, valor a la derecha y debajo una **barra de participación** de 5px, ancho = `total_value / max(total_value del bloque)`.
- El botón de exportar del `PageHeader` pasa a icono de 44px en el header móvil.

---

## Criterios de aceptación

- A 390px no hay scroll horizontal en Nóminas (listado y detalle), Empleados, Referencias ni Reporte.
- En nómina se puede leer el neto y aprobar sin hacer scroll horizontal ni abrir el escritorio.
- Ningún objetivo táctil bajo 44px; los menús de acciones son alcanzables con el pulgar.
- Modo claro y oscuro correctos en todo lo nuevo.
- El escritorio (`lg:`) se ve exactamente igual que antes del cambio en los cuatro módulos.
- Sin cambios de rutas, permisos ni payloads; las paginaciones siguen siendo del servidor.

## Referencia visual

Las pantallas aprobadas son 3a (nóminas), 3b (detalle de nómina), 3c (empleados), 3d (referencias) y 3e (reporte) del documento de diseño. El módulo de acceso y la landing se abordan aparte.
