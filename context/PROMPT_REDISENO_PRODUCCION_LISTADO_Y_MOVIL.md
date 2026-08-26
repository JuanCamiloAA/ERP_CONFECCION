# Rediseño del módulo de Producción — pantalla principal, móvil y formulario de registro

Objetivo: sacar el banner de jornada del listado, convertir la tarjeta de seis selects en una barra de filtro de una línea, y rediseñar la tabla para que quepa sin scroll horizontal. Mismos tokens, retícula y tipografía que el rediseño del módulo de Empleados: los dos módulos deben leerse como un solo producto.

No cambies el modelo de datos, las rutas, los nombres de los parámetros de filtro ni el payload de registro. `ProductionsIndex` conserva sus props (`productions`, `filters`, `totals`, `employees`, `references`, `operations`, `workerMode`, `lockedEmployee`, `referencesWithOperations`, `workDayBanner`, `workDaySelectableEmployees`), su `FilterState` con las siete claves (`employee_id`, `reference_id`, `operation_id`, `date_start`, `date_end`, `shift`, `status`), su `apply()` con `router.get(route('productions.index'), params, { preserveState: true, replace: true })`, y el `ConfirmDialog` de borrado tal como están. `ProductionRegisterForm` no cambia su `useForm`, su `localStorage` de referencias recientes (`production-register-form:last-reference-id`, `…:recent-reference-ids`) ni su `SearchSheet`. Es un cambio de UI y de composición.

**Decisión de patrón**: la vista base es la **tabla plana con métricas** (opción 2a). La **agrupación por día** (2b) entra como modo de vista alterno con un conmutador `Lista | Por día` a la derecha de la barra de filtro, persistido en `localStorage` (`productions-index:view-mode`), no como pantalla aparte. Si prefieres una sola vista, elimina el conmutador y quédate con la tabla plana.

## Cambio de fondo: el banner de jornada sale del listado

Hoy `Pages/Productions/Index.tsx` renderiza `WorkDayBanner` dos veces: `variant="self"` cuando hay `workDayBanner && workerMode`, y `variant="admin"` cuando `!workerMode && workDaySelectableEmployees.length > 0`. Ese segundo bloque es el recuadro morado con el select «Empleado (salario diario)» + `Iniciar` / `Cerrar` que ocupa la primera pantalla sin decir nada del día de producción.

- **Quita el bloque `variant="admin"` de `Index.tsx`.** El control de jornada por administrador vive solo en `Pages/Productions/Create.tsx`, donde ya está montado — ahí sí es contexto de la acción que se va a ejecutar.
- **Mantén el bloque `variant="self"`** en el listado en `workerMode`: para el operario, «Mi producción» ES su jornada, y sin ese control no puede abrirla ni cerrarla. Reestilízalo (ver abajo), no lo muevas.
- El controlador puede seguir enviando `workDaySelectableEmployees` al índice (otras vistas lo usan); simplemente el índice ya no lo pinta. Si nadie más lo consume, retíralo del `ProductionController@index` en una limpieza aparte.
- En `Create.tsx`, el banner de administrador pasa a ser la primera tarjeta del formulario, con la línea «El control de jornada solo aparece aquí; el listado ya no lo muestra.» y borde izquierdo de 2px en acento.

## Archivos a tocar

| Archivo | Qué hacer |
| --- | --- |
| `resources/js/Pages/Productions/Index.tsx` | Reescribir el layout: cabecera propia, franja de métricas, barra de filtro de una línea con chips, tabla nueva, conmutador de vista. Quitar el `WorkDayBanner variant="admin"`. |
| `resources/js/Components/Productions/ProductionFilterBar.tsx` | **Nuevo.** Búsqueda + segmentado de rango + «Más filtros» + chips activos + exportar. Reemplaza la `<Card className="hidden lg:block">` con los seis selects. |
| `resources/js/Components/Productions/ProductionTable.tsx` | **Nuevo.** La tabla de escritorio con la retícula fija y la fila de totales al pie. |
| `resources/js/Components/Productions/ProductionDayGroup.tsx` | **Nuevo.** Cabecera de día con subtotal y acción «Confirmar el día» (modo `Por día`). |
| `resources/js/Components/Productions/ProductionRecordCard.tsx` | **Nuevo.** La tarjeta de registro para móvil; sustituye el bloque `sm:hidden` incrustado hoy en `Index.tsx`. |
| `resources/js/Components/Productions/WorkDayBanner.tsx` | Reestilizar ambas variantes a los tokens nuevos. Sin cambios en `TodayResponse`, en el `axios.get(route('work-day-sessions.today'))` ni en los `router.post` de start/close. |
| `resources/js/Pages/Productions/Create.tsx` | Cabecera propia, banner de jornada como primera tarjeta, formulario en una columna de 640px máx. con resumen del valor calculado. |
| `resources/js/Components/Productions/ProductionRegisterForm.tsx` | Reestilizar `PickerField`, campos y barra de acción a los tokens nuevos. Mantener lógica, `SearchSheet` y multi-línea. |
| `resources/js/Pages/Productions/{Edit,Report,Ranking}.tsx` | Alinear cabecera, filtros y tablas al mismo patrón para que el módulo no quede a dos estilos. |

## Pantalla principal (escritorio)

```
Cabecera: «Producción» 24px/500 · «Registro diario por empleado · viernes 21 de agosto»
          derecha: [Reporte] [Ranking] [+ Registrar producción]
Métricas: Valor del periodo · Unidades · Registros · Por confirmar
Filtro:   [buscar…] [Hoy|Semana|Mes|Rango…] [Más filtros ⌄ 2] ················ [Exportar]
          chips de lo aplicado + «Limpiar todo»
Tabla:    Fecha · Empleado · Referencia · Operación · Cant. · Precio · Valor · Turno · Estado · ⋮
          fila de totales al pie
```

### Métricas

Cuatro tarjetas de `padding: 17px`, kicker 11px en mayúsculas + cifra 27px/500 con `font-variant-numeric: tabular-nums`: `Valor del periodo` (de `totals.total_value`), `Unidades` (`totals.total_quantity`), `Registros` (`productions.total`) y `Por confirmar` — en acento cuando es > 0. La línea fina «Registros · 64 … Total $3.186.900» de hoy desaparece: los mismos números, pero legibles. Si el controlador no expone el conteo de pendientes, agrégalo como `totals.pending_count` — no lo calcules sobre la página actual, que solo trae 15 filas.

### Barra de filtro

- Una sola línea de 36px de alto: búsqueda libre (340px máx., busca empleado, referencia y operación), segmentado `Hoy | Semana | Mes | Rango…`, botón `Más filtros` con contador de filtros activos y, a la derecha, `Exportar`.
- El segmentado escribe `date_start` / `date_end`; `Rango…` abre los dos datepickers en el panel. Los seis selects actuales (`Empleado`, `Referencia`, `Operación`, `Desde`, `Hasta`, `Turno`/`Estado`) se conservan tal cual **dentro** del panel `Más filtros` — reutiliza el `filterFields` que ya existe, sin rehacerlo; lo que cambia es que dejan de estar desplegados siempre.
- Los chips de filtro activo, que hoy solo existen en móvil (`activeChips`), pasan a las dos anchuras: es la misma lógica, sirve igual en escritorio.
- Aplicar un filtro recarga de inmediato (como ya hace `clearFilter`); el botón `Filtrar` desaparece. Conserva `Limpiar todo` → `reset()`.

### Tabla

- Retícula fija: `68px | 1.6fr | 1.8fr | 64px | 72px | 100px | 72px | 92px | 44px` con `gap: 10px` y `padding: 12px 17px` por fila. Sin `overflow-x` — a 1440px las columnas de empleado y operación quedan por encima de 150px y 200px, que es lo que piden los nombres reales («duby felienrh ramirez londoño», «PEGAR SESGO VIVO CUELLO POLO»).
- **Referencia y operación comparten una columna**: la operación en 13px como línea principal, y `6314150 · blusa cuello vivo-sisa` en 12px muted debajo. Son un solo dato compuesto y hoy gastan dos columnas anchas.
- `Fecha` en formato corto (`21 ago`); el año solo cuando el filtro cruza años.
- `Empresa` sale de la vista por defecto y solo se inserta cuando `isConsolidatedView` es verdadero — y en ese caso como línea secundaria bajo el nombre del empleado, no como columna propia.
- El nombre del empleado se muestra en `text-transform: capitalize` (la base los tiene en minúscula y en mayúscula sostenida indistintamente).
- Estado como punto + texto, no badge: `Pendiente` (punto acento + texto `#d2cefd`), `Confirmado` (check acento tenue + texto muted), `Pagado` (check en círculo tenue + texto muted). Los tres badges de color de hoy compiten con las cifras.
- Cifras (`Cant.`, `Precio`, `Valor`) alineadas a la derecha con `tabular-nums`; `Valor` en el color de texto principal, `Precio` en muted.
- Acciones: menú `⋮` por fila con `Editar`, `Confirmar`, `Eliminar`, respetando `productions.index.edit` / `productions.index.delete` con `<Can>` como hoy. Los dos botones sueltos por fila desaparecen; el lápiz puede quedarse visible si prefieres el atajo.
- Fila de totales al pie de la tarjeta, sobre `#1c1e2b`: rótulo «Totales del filtro» en 11px en mayúsculas + unidades y valor en tabulares.
- Hover de fila: `background: rgba(145,132,217,.05)` y los iconos de acción a `#b5abfc`.
- Estado vacío: dentro de la tarjeta, «No hay registros con este filtro» + «Limpiar filtros» como enlace de acento.

### Modo `Por día` (conmutador)

- Un grupo por fecha: cabecera sobre `#1c1e2b` con «Viernes 21 de agosto», la línea «6 registros · 2.600 unidades · 4 empleados», el subtotal del día en 15px tabulares y, a la derecha, `Confirmar el día` (borde de acento) cuando el día tiene pendientes, o «Día confirmado» en muted cuando no.
- Las filas pierden la columna `Fecha` y ganan avatar de iniciales de 26px: la retícula pasa a `1.5fr | 1.9fr | 64px | 72px | 100px | 68px | 88px | 44px`.
- `Confirmar el día` confirma en lote los pendientes de esa fecha (y del empleado filtrado, si hay uno). Si el backend aún no tiene el endpoint, deja el botón detrás de la acción individual y ábrelo en un `ConfirmDialog` que enumere cuántos registros va a confirmar — no lo pintes sin conectar.
- La paginación se reemplaza por «Cargar días anteriores»; el pie mantiene «64 registros en el filtro».

## Móvil

Listado:

- Cabecera de 44px táctil: búsqueda de 44px, y una fila deslizable de chips `Hoy · Semana · Filtros`.
- Tres pastillas de métrica antes de la lista (`Valor`, `Unidades`, `Pend.`), en tarjetas de 12px de radio.
- Las tarjetas de registro se agrupan bajo una línea de día en 11px mayúsculas con el subtotal: `VIERNES 21 DE AGOSTO · $305.000`. Cada tarjeta lleva empleado (14px), operación (13px), `6314150 · 500 und × $200` (12px muted) y, a la derecha, el valor en 15px tabulares con el estado debajo.
- Las acciones salen de la tarjeta: toque abre el detalle, deslizar o `⋮` da `Editar` / `Eliminar`. Hoy cada tarjeta muestra dos botones de 44px que ocupan una franja entera.
- Barra fija inferior de 48px con `Registrar producción` (se conserva la actual, con el estilo delineado nuevo y `env(safe-area-inset-bottom)`).
- En `workerMode`, la tarjeta de jornada («Jornada de hoy», entrada, `Iniciar` / `Cerrar`) va **arriba de todo**, antes de las métricas: es la primera acción del día del operario.

Formulario de registro:

- Una columna. Primera tarjeta: jornada (reloj, «Jornada de hoy», `21/08/2026 · abierta 7:02 a. m.`, botón `Cerrar`) con la nota de 11px en borde izquierdo de acento.
- Campos de 44px: `Empleado*`, `Referencia*`, `Operación*` (los `PickerField` que abren `SearchSheet`, con el precio de la operación como ayuda de 11px), y una fila de dos con `Cantidad*` (16px, tabular) y `Turno`.
- Resumen antes de la barra de acción: kicker «Valor del registro», el desglose `500 und × $200` en 12px y la cifra en 24px/500 tabulares.
- Barra fija inferior: `Cancelar` (96px, texto muted) + `Guardar registro` (delineado de acento) en proporción 1:3, altura 48px.
- Conserva el registro multi-línea y la lógica de cantidad por operación que ya trae el componente; solo cambia la piel.

## Estilo

Los mismos tokens del prompt de Empleados, sin excepción.

| Uso | Valor |
| --- | --- |
| Fondo de página | `#161826` |
| Superficie de tarjeta / tabla | `#232532` |
| Cabecera de grupo, fila de totales, campo sobre fondo | `#1c1e2b` |
| Sidebar / barras fijas | `#1a1c29` |
| Borde | `#3f424d` · separador de fila `#2f313d` |
| Texto | `#e9e9ed` · muted `#9397ab` · sutil `#75798c` · tenue `#595d6c` |
| Acento | `#9184d9` · texto sobre relleno `#d2cefd` · icono/línea `#b5abfc` · relleno `rgba(145,132,217,.13)` · hover de fila `rgba(145,132,217,.05)` |
| Radio | 8px campos y controles · 12px tarjetas móviles · 14px tarjetas y contenedores |
| Elevación | `box-shadow: 0 0 0 1px #3f424d` |

- Botones principales **delineados**: `1px solid #9184d9`, fondo transparente, texto `#d2cefd`. El `bg-indigo-600` relleno sale del módulo.
- Máximo dos pesos: 400 y 500. Sin `font-bold` en títulos ni en la fila de totales.
- Toda cifra de dinero, cantidad y minutos con `font-variant-numeric: tabular-nums` y `formatCurrency` / `formatNumber`.
- Iconos Phosphor a 15–19px (17px en el sidebar). No mezclar con Heroicons en las pantallas rediseñadas.
- Foco de teclado: `outline: 2px solid #9184d9; outline-offset: 2px`.
- Sin emoji, sin gradientes saturados, sin badges de color por estado.

## Criterios de aceptación

1. El listado ya no muestra el selector «Empleado (salario diario)» ni los botones `Iniciar` / `Cerrar` para administradores; sí siguen apareciendo en el formulario de registro y, en `workerMode`, la jornada propia sigue arriba del listado.
2. A 1440px la tabla no tiene scroll horizontal y ningún nombre de empleado ni de operación queda cortado con los datos reales del taller.
3. El valor total, las unidades, el conteo de registros y los pendientes se ven sin desplazarse, y corresponden al filtro aplicado (no a la página).
4. Los seis filtros siguen disponibles y componibles; los que están activos se ven como chips y se quitan de uno en uno sin recargar la página completa.
5. Cambiar entre `Lista` y `Por día` no pierde filtros ni posición, y la elección se recuerda entre visitas.
6. En móvil se lee día por día con subtotal, y registrar producción no exige zoom ni scroll horizontal.
7. Los parámetros que viajan a `productions.index` y el payload de `productions.store` son idénticos a los actuales.
