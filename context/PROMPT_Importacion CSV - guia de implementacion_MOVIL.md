# Especificación de implementación — Importación masiva (CSV)

Rediseño de `SuperAdmin/DataImports/Index.tsx` + modal de campos (escritorio y móvil), aterrizado en el código real de `ERP_CONFECCION`.

**Regla de oro de este documento:** está dividido en fases. Las fases 1–3 **no tocan backend** y no pueden romper nada existente. Las fases 4–7 sí tocan backend y cada una es independiente: se puede parar en cualquier fase y la pantalla sigue funcionando.

Referencia visual: diseño `Importacion CSV.dc.html` (marcos 1a escritorio, 1b modal, 1c móvil, 1d detalle de errores).

---

## 0. Estado actual (lo que ya existe y NO hay que reescribir)

| Pieza | Archivo | Qué hace hoy |
|---|---|---|
| Pantalla | `resources/js/Pages/SuperAdmin/DataImports/Index.tsx` | 6 tarjetas de carga + grilla de plantillas + historial + 2 modales |
| Detalle | `resources/js/Pages/SuperAdmin/DataImports/Show.tsx` | Detalle del lote y errores |
| Controlador | `app/Http/Controllers/SuperAdmin/DataImportController.php` | index/store/process/show/preview/destroy + plantillas y ZIP |
| Catálogo de campos | `app/Services/DataImport/ImportFieldCatalog.php` | `all()` publica `{key, required, example, help, column}` por tipo — ya alimenta el selector |
| Procesador | `app/Services/DataImport/DataImportProcessor.php` | Lee CSV, procesa fila por fila en transacción, guarda `import-errors/batch-{id}-*.json` con `[{line, message}]` |
| Modelo | `app/Models/DataImportBatch.php` | estados `pending/processing/completed/failed`, contadores `rows_total/success/failed`, `meta` (array), `error_report_path` |
| Rutas | `routes/web.php:196-206` | `super-admin.data-imports.*` |

Rutas existentes que el rediseño reutiliza tal cual: `templates`, `templates.zip`, `store`, `process`, `preview`, `file`, `errors`, `show`, `destroy`.

---

## FASE 1 — Reestructurar la pantalla a una lista única (solo frontend)

Sustituye «grilla de plantillas» + «6 tarjetas de carga» por **una fila por entidad**. No cambia ningún request: cada fila usa el mismo `POST store` con `type` y el mismo `GET templates`.

### 1.1 Estructura de la fila

Columnas: `#` · Entidad · Plantilla · Archivo · Estado · Acción.

- **#**: 1…6 en el orden obligatorio (`TYPE_KEYS` ya está en ese orden). Es la única fuente de verdad del orden; no repetir la lista en el texto de ayuda.
- **Entidad**: nombre (`types[key]`) + una línea de dependencia (`Requiere company_nit`, etc.).
- **Plantilla**: `Descargar CSV` (link a `templateHref(key)`, ya existe) + botón `Campos n/total` que abre el modal (ya existe `setFieldPickerType`).
- **Archivo**: dropzone / chip del archivo elegido + las opciones propias del tipo (`company_import_mode` en `companies`, `employee_update_existing` en `employees_users`). **Importante:** cada fila sigue siendo su propio `<form>` con `onSubmit={submitImport(key)}`; no unificar los 6 en un solo form.
- **Estado**: derivado del último lote de ese tipo (fase 4). Hasta que exista la fase 4, mostrar el estado local del formulario (`sin archivo` / `archivo listo` / `subiendo…`).
- **Acción**: `Procesar` (POST `process` del lote pendiente de ese tipo) o `Ver detalle`.

### 1.2 Dropzone (drag & drop) sin librerías

```tsx
const [dragOver, setDragOver] = useState<string | null>(null);
const [picked, setPicked] = useState<Record<string, File | null>>({});

// input file oculto por fila + label que lo dispara
const onDrop = (type: string) => (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(null);
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    if (!f.name.toLowerCase().endsWith('.csv')) { toast.error('Solo archivos .csv'); return; }
    if (f.size > 10 * 1024 * 1024) { toast.error('El archivo supera 10 MB'); return; }
    setPicked((p) => ({ ...p, [type]: f }));
};
```

`submitImport` ya arma el `FormData` desde el form; si el archivo viene del drop hay que inyectarlo:

```tsx
const fd = new FormData(form);
const dropped = picked[type];
if (dropped) fd.set('file', dropped);
fd.set('type', type);
```

Detalles obligatorios para no romper la validación existente (`StoreDataImportRequest`): el `<input type="file" name="file">` sigue existiendo (oculto) y **debe dejar de ser `required`** si se admite el drop, porque un archivo soltado no llena el input; en su lugar valida en JS antes del `router.post` y deshabilita el botón si no hay archivo.

### 1.3 Instrucciones

- Bloque «Formato del archivo»: chips `UTF-8`, `Separador: coma`, `snake_case`, `YYYY-MM-DD`, `Máx. 10 MB` (usar el límite real de `config('data_import.*')` / `StoreDataImportRequest`, no un número inventado).
- Bloque «Orden obligatorio»: cadena `1 Empresas → 2 Bancos → …`. Cada flecha y su chip van en el mismo contenedor `inline-flex` para que la flecha nunca quede al final de línea.
- Se elimina el acordeón con la lista numerada (la lista ahora es la propia tabla).

---

## FASE 2 — Modal de selección de campos (solo frontend)

El modal ya recibe el catálogo (`fieldCatalog`) y ya mantiene `selectedFields`. Se le agregan 5 cosas, todas de cliente:

### 2.1 Buscador

```tsx
const [query, setQuery] = useState('');
const visible = fieldsOf(type).filter(
    (f) => !query.trim() || f.key.toLowerCase().includes(query.trim().toLowerCase())
        || (f.help ?? '').toLowerCase().includes(query.trim().toLowerCase()),
);
```
Al cerrar el modal, `setQuery('')`.

### 2.2 Obligatorios fijados arriba

Franja fija (no lista de checkboxes) con los `requiredKeys` del tipo, texto «siempre incluidos». Los obligatorios **se eliminan** del listado de checkboxes deshabilitados: hoy se muestran con checkbox `disabled`, lo que confunde. Regla de negocio ya vigente en backend (`ImportFieldCatalog::selectedFields`): los obligatorios se agregan siempre, aunque no vengan en `fields`.

### 2.3 Agrupación por secciones

El catálogo del backend **no trae grupo**. Dos opciones:

- **Opción A (recomendada, sin backend):** mapa de grupos en el front, con fallback `Otros` para claves nuevas — así una columna nueva sigue apareciendo sola (la promesa del catálogo dinámico no se rompe).

```ts
const GROUPS: Record<string, string[]> = {
  'Identificación': ['company_nit','nit','name','first_name','last_name','document_type','document_number','code','reference_code','operation_name'],
  'Contacto': ['phone','email','address'],
  'Nómina': ['hire_date','base_salary','payroll_mode','daily_salary','minutes_per_full_workday','ordinary_hours_per_day','is_exempt_from_overtime'],
  'Acceso al sistema': ['create_user','user_email','user_password','role_name'],
  'Banco': ['bank_name','bank_account_number','bank_key'],
  'Costo y tiempo': ['base_price','price','estimated_minutes','difficulty_level','payment_per_unit','lot_total_quantity'],
};
const groupOf = (key: string) => Object.entries(GROUPS).find(([, ks]) => ks.includes(key))?.[0] ?? 'Otros';
```

- **Opción B (con backend):** agregar `'group' => '…'` a cada campo en `ImportFieldCatalog::fields()` (nuevo dato en el array `Campo`, más un `grupos` por tipo en `self::TIPOS`). Más limpio a largo plazo; requiere actualizar el `@phpstan-type Campo`.

**Detalle de implementación que evita un bug real:** el control «Añadir grupo / Quitar grupo» debe ocultarse cuando el grupo no tiene campos opcionales (p. ej. «Identificación» de Bancos es 100% obligatoria) — si no, queda un botón que no hace nada.

### 2.4 Presets

- `Mínimo` = solo obligatorios (ya existe como «Solo obligatorios»).
- `Recomendado` = subconjunto por tipo, definido en el front:

```ts
const RECOMMENDED: Record<string, string[]> = {
  companies: ['name','nit','email','is_active'],
  banks: ['company_nit','name','code'],
  operations: ['company_nit','name','base_price','estimated_minutes'],
  references: ['company_nit','code','name','payment_per_unit','lot_total_quantity'],
  reference_operations: ['company_nit','reference_code','operation_name','price','estimated_minutes'],
  employees_users: ['company_nit','first_name','last_name','document_type','document_number','phone','hire_date','base_salary','payroll_mode','is_active'],
};
```
Filtrar contra el catálogo (`.filter(k => fieldsOf(type).some(f => f.key === k))`) para que una columna eliminada no rompa el preset.
- `Completo` = todos.
- `Guardados por el usuario`: fase 1 en `localStorage` (clave `data-imports:presets:v1`, `{[type]: {name, keys}[]}`), sin backend y sin riesgo. Si se quieren compartir entre usuarios, ver **fase 7**.
- Al tocar cualquier checkbox el preset activo pasa a `Personalizado`.

### 2.5 Contador

Cabecera: `n de total campos seleccionados · m obligatorios fijos`. Botón de descarga: `Descargar plantilla · n campos`. Con esto el usuario ve el efecto antes de descargar.

**Sin cambios en la URL de descarga:** `fieldsParam()` sigue mandando la lista solo si se recortó algo, y el ZIP sigue usando `fields[tipo]=a,b,c`.

---

## FASE 3 — Móvil: bottom sheet (solo frontend)

El `Modal` actual (`Components/UI/Modal.tsx`, Headless UI) centra siempre el panel. **No lo reescribas**: agrégale una variante.

```tsx
// Modal.tsx — nuevas props, ambas opcionales (retrocompatible)
interface ModalProps { /* … */ sheetOnMobile?: boolean; }

// contenedor
<div className={cn('flex min-h-full justify-center p-4',
    sheetOnMobile ? 'items-end p-0 sm:items-center sm:p-4' : 'items-center')}>

// panel: transición y radios distintos en móvil
<DialogPanel className={cn(
    'w-full transform bg-white shadow-xl transition-all dark:bg-slate-800',
    sheetOnMobile
      ? 'max-h-[90vh] rounded-t-2xl sm:max-h-none sm:rounded-xl'
      : 'overflow-hidden rounded-xl',
    sizes[size])}>
```

Y en el `TransitionChild` del panel, cuando `sheetOnMobile`: `enterFrom="opacity-0 translate-y-8"` / `enterTo="opacity-100 translate-y-0"` (sin `scale`, que en un sheet se ve mal).

Requisitos del sheet de campos en móvil:
- Cabecera fija: título, contador, buscador, presets en fila con scroll horizontal.
- Cuerpo con `overflow-y-auto` y `overscroll-contain`.
- Pie fijo: `Descargar plantilla · n campos` a ancho completo + `Guardar preset`.
- Objetivos táctiles ≥ 44px (checkbox 20px con fila de 44px de alto; botón de cerrar 44×44).
- Barrita de arrastre decorativa arriba (40×4, `rounded-full`).
- El resto de la pantalla en móvil: las filas de la tabla colapsan a tarjetas (ya hay patrón `responsive-table` con `data-label` en el proyecto — reutilizarlo en el historial; para la lista de entidades usar tarjetas propias como en el marco 1c).

### 3.1 Anatomía exacta de la tarjeta en móvil (lo que faltaba especificar)

La lista de entidades en móvil **no es la fila de escritorio apilada**. Es una tarjeta por entidad que muestra **solo lo que aplica a su estado actual**. Comparación con lo implementado hoy:

| Implementación actual (incorrecta) | Debe ser |
|---|---|
| Todas las tarjetas expandidas con dropzone + `Descargar CSV` + `Campos` + selects visibles | Solo la tarjeta **accionable** muestra controles; las importadas se colapsan a una línea de resultado |
| Dropzone visible incluso en entidades ya importadas o bloqueadas | Dropzone solo si el estado es «sin archivo» y la entidad está disponible |
| `Descargar CSV` + `Campos n/n` repetidos en las 6 tarjetas | Plantillas fuera de la lista: un único acceso arriba (`Plantillas` → hoja con los 6 tipos y su selector de campos) |
| Guion `—` suelto y `Sin archivo` como chip bajo el dropzone | Nada: la ausencia de archivo ya la comunica el dropzone |
| `Si el NIT ya existe` + select siempre desplegado | Ese select aparece **solo** cuando ya hay archivo elegido para Empresas (igual con el checkbox de Empleados) |
| Separadores/hairlines entre tarjetas + tarjetas a ancho completo sin radio | Tarjetas con `--radius-md`, fondo `--color-surface`, separadas por 10px de espacio, sin líneas divisorias |
| Encabezado «Entidades» + botón ZIP dominando la pantalla | Encabezado = título de pantalla + una línea de ayuda («Sigue el orden: cada paso necesita el anterior»); el ZIP va en la hoja de plantillas |

**Estructura de la tarjeta (ver imagen «como debe verse»):**

1. **Fila superior** (`flex`, `justify-between`, `align-center`):
   - Círculo de 22px con el número de paso. Color por estado: verde tenue si importado, `--color-accent-800` si es el paso accionable, `--color-neutral-800` si está pendiente/bloqueado.
   - Nombre de la entidad, 15px, `--font-heading`.
   - A la derecha, **un solo** indicador de estado: `12 OK` / `Listo` / `2 errores` / `Sin archivo` / `Tras el paso 4`.
2. **Línea de contexto**, 12px, texto al 50-55%: `empresas.csv · importado 10:04` o `186 filas importadas · 2 rechazadas`. Una sola línea, sin repetir el estado.
3. **Chip de archivo** (solo si hay archivo sin procesar): `bancos.csv  8 filas`, fondo `--color-neutral-900`, 6px de radio.
4. **Acciones**: máximo dos botones, en fila, `min-height:44px`. La acción primaria ocupa el espacio flexible; la secundaria se ajusta a su contenido.
   - importado → sin botones (toda la tarjeta es tappable → detalle).
   - archivo listo → `Procesar` (primario) + `Campos n/n` (secundario).
   - con errores → `Ver errores` (secundario, ancho completo).
   - sin archivo → `Subir CSV` (secundario, flexible) + `Campos` (ghost).
   - bloqueado por dependencia → sin botones, tarjeta al 55% de opacidad.
5. **Padding** 12px; **gap interno** 9-10px; **gap entre tarjetas** 10px; márgenes laterales de pantalla 16px.

**Reglas de comportamiento en móvil:**
- La entidad accionable siguiente queda visualmente destacada (círculo con acento); las demás son inertes visualmente. Nunca dos tarjetas compitiendo.
- El selector de campos y la descarga de plantilla **no viven en la tarjeta**: se abren como bottom sheet (§3) desde `Campos` o desde el acceso `Plantillas` del encabezado.
- Las opciones de importación (`company_import_mode`, `employee_update_existing`) se muestran dentro de la tarjeta **solo** cuando ya hay archivo pendiente de procesar, como una fila compacta de 12px con control segmentado o checkbox de 44px de alto.
- Historial: no se lista completo en móvil; un enlace `Ver historial` al final abre la vista propia (`Show`/índice filtrado). En móvil el historial usa tarjetas, no tabla.
- Sin scroll horizontal en ningún punto: nada de tablas ni chips que se salgan de los 390px.

---

## FASE 4 — Estado por entidad en la pantalla (backend pequeño y seguro)

La fila «Estado» necesita saber el último lote de cada tipo. Hoy `index()` solo manda el historial paginado.

```php
// DataImportController::index()
'latestByType' => DataImportBatch::query()
    ->select('id','type','status','rows_total','rows_success','rows_failed','original_filename','created_at','error_report_path')
    ->whereIn('id', function ($q) {
        $q->selectRaw('MAX(id)')->from('data_import_batches')->groupBy('type');
    })
    ->get()
    ->keyBy('type'),
```

- No cambia nada existente: es una prop nueva; si el front no la usa, no pasa nada.
- Rendimiento: una consulta con subconsulta agrupada; añadir índice si no existe:
  `$table->index(['type','id']);` en una migración nueva sobre `data_import_batches`.
- El front mapea: `completed && rows_failed === 0` → «Importado»; `completed && rows_failed > 0` → «Importado con n errores»; `pending` → «Listo para procesar»; `processing` → «Procesando»; `failed` → «Fallido» + `meta.fatal_error`.
- Botón `Procesar` de la fila: solo si el último lote de ese tipo está `pending` o `failed` (`canBeProcessed()` ya existe en el modelo).
- Bloqueo por dependencias (filas 5 y 6 «en espera del paso 4»): **puramente informativo en el front**, nunca deshabilites el envío por esto — hay lotes válidos donde las empresas ya existían en BD. Mostrar aviso, no candado.

---

## FASE 5 — Errores con campo y valor (backend)

Hoy el reporte es `[{line, message}]`. El diseño 1d muestra `fila · campo · valor recibido · motivo`. Cambio compatible hacia atrás:

### 5.1 `RowImportException` acepta contexto

```php
class RowImportException extends RuntimeException
{
    public function __construct(
        string $message,
        public readonly int $lineNumber = 0,
        public readonly ?string $field = null,
        public readonly mixed $value = null,
    ) { parent::__construct($message); }
}
```
Los `throw new RowImportException('Falta company_nit.', $lineNumber)` existentes siguen compilando (parámetros nuevos con default). Ir agregando `field`/`value` estrategia por estrategia; empezar por las de mayor volumen: `company_nit` no encontrado y precios no numéricos.

### 5.2 El procesador guarda el contexto

```php
} catch (RowImportException $e) {
    $failed++;
    $errors[] = array_filter([
        'line' => $e->lineNumber ?: $lineNumber,
        'message' => $e->getMessage(),
        'field' => $e->field,
        'value' => is_scalar($e->value) ? (string) $e->value : null,
    ], fn ($v) => $v !== null);
}
```

El front debe leer `field`/`value` **como opcionales** (`error.field ?? '—'`): los reportes viejos en disco no los tienen.

### 5.3 Descargar solo las filas con error (ruta nueva)

```php
// routes/web.php (junto a las demás)
Route::get('data-imports/{batch}/errors.csv', [DataImportController::class, 'downloadErrorRows'])
    ->name('data-imports.errors.csv');
```

```php
public function downloadErrorRows(DataImportBatch $batch)
{
    $contents = DataImportStorage::readCsvContents($batch);
    if (! $contents || ! $batch->error_report_path) {
        return back()->with('warning', 'No hay filas con error para descargar.');
    }

    $report = json_decode((string) Storage::disk(DataImportStorage::diskName())->get($batch->error_report_path), true) ?: [];
    // El procesador cuenta la cabecera como linea 1: linea 2 = primera fila de datos.
    $lineas = collect($report)->pluck('line')->filter()->unique()->values()->all();
    $motivos = collect($report)->keyBy('line');

    $reader = \League\Csv\Reader::createFromString(preg_replace('/^\xEF\xBB\xBF/u', '', $contents) ?? $contents);
    $reader->setHeaderOffset(0);

    $salida = fopen('php://temp', 'r+');
    fputcsv($salida, [...$reader->getHeader(), '_motivo_error']);
    $n = 1;
    foreach ($reader->getRecords() as $record) {
        $n++;
        if (! in_array($n, $lineas, true)) continue;
        fputcsv($salida, [...array_values($record), (string) ($motivos[$n]['message'] ?? '')]);
    }
    rewind($salida);
    $csv = stream_get_contents($salida);
    fclose($salida);

    return response($csv, 200, [
        'Content-Type' => 'text/csv; charset=UTF-8',
        'Content-Disposition' => 'attachment; filename="errores_lote_'.$batch->id.'.csv"',
    ]);
}
```

Cuidado: el archivo devuelto lleva la columna extra `_motivo_error`; al corregir y volver a subir, **hay que quitarla** o el importador la ignorará (hoy `attributesFromRow` descarta claves desconocidas, así que no rompe, pero conviene decirlo en la UI: «quita la columna `_motivo_error` antes de volver a subir»).

`Reprocesar corregidas` del diseño = subir el archivo corregido como un lote nuevo del mismo tipo. **No implementar reintento parcial sobre el mismo lote**: el procesador exige estado `pending`/`failed` y volvería a procesar todo, duplicando lo ya importado en los tipos que crean registros.

---

## FASE 6 — Progreso real (opcional; leer las advertencias)

Hoy `process()` es **sincrónico**: el POST no responde hasta terminar. Por eso:

- **Mínimo viable, sin backend:** estado «Procesando…» indeterminado (barra animada, sin porcentaje) mientras el POST está en vuelo. Es lo que se debe hacer si no se quiere tocar el procesador. En el diseño 1a la barra al 45% ilustra el caso con progreso; si se queda en indeterminado, usar barra animada sin cifra.
- **Con porcentaje** hacen falta tres cosas:
  1. `DataImportProcessor`: cada N filas (p. ej. 25) `DB::table('data_import_batches')->where('id',$batch->id)->update(['rows_success'=>$success,'rows_failed'=>$failed,'rows_total'=>$leidas])`. Usar el query builder, no `$batch->update()`, para no disparar eventos ni recargar el modelo dentro del bucle.
  2. Total de filas conocido antes de empezar (ver 6.1) para poder dividir.
  3. Un endpoint de sondeo `GET data-imports/{batch}/progress` que devuelva `{status, rows_total, rows_success, rows_failed}`. **Advertencia de sesión:** si la ruta usa el middleware `web`, el bloqueo de sesión de Laravel hará que el sondeo espere a que termine el POST y el porcentaje nunca avance. Solución: en esa ruta añadir `->withoutMiddleware([\Illuminate\Session\Middleware\StartSession::class])` no sirve (se pierde la autenticación); lo correcto es mover el procesamiento a cola (`ShouldQueue`) o marcar la sesión como solo lectura en ese endpoint. **Recomendación:** dejar el progreso para cuando la importación pase a cola; hasta entonces, indeterminado.

### 6.1 Filas y encabezados conocidos al subir (útil y barato)

En `store()`, después de guardar el archivo, leer solo la cabecera y contar líneas para poblar `meta`:

```php
$meta['rows_detected'] = max(0, substr_count($contenido, "\n") - 1);
$meta['headers'] = $cabecera;                    // list<string>
$meta['headers_unknown'] = array_values(array_diff($cabecera, $clavesDelCatalogo));
```
Con eso la fila muestra «188 filas · 26 KB» y puede advertir **antes de procesar**: «la columna `precio_base` no existe en la plantilla; se ignorará». Es la mejora de feedback con mejor relación costo/beneficio de toda la lista. Sin bloquear el envío: solo aviso.

---

## FASE 7 — Presets compartidos (opcional, solo si se piden)

```php
Schema::create('data_import_field_presets', function (Blueprint $table) {
    $table->id();
    $table->foreignId('user_id')->constrained()->cascadeOnDelete();
    $table->string('type', 40);                 // DataImportBatch::types()
    $table->string('name', 60);
    $table->json('fields');                     // list<string>
    $table->boolean('is_shared')->default(false);
    $table->timestamps();
    $table->unique(['user_id','type','name']);
});
```
Controlador nuevo `DataImportPresetController` con `store`/`destroy`, validando `type` contra `DataImportBatch::types()` y `fields` contra `ImportFieldCatalog::fields($type)` (descartar claves inexistentes en vez de fallar). Se manda a la pantalla como prop `fieldPresets`. Mientras no exista, `localStorage` cubre el caso.

---

## Filtros del historial (frontend + backend mínimo)

El diseño añade buscador y filtro `Todos / Con errores / Pendientes`.

```php
$batches = DataImportBatch::query()
    ->with('user:id,name,last_name')
    ->when($request->filled('q'), fn ($q) => $q->where(function ($w) use ($request) {
        $t = '%'.$request->string('q').'%';
        $w->where('original_filename', 'like', $t)
          ->orWhereHas('user', fn ($u) => $u->where('name','like',$t)->orWhere('last_name','like',$t));
    }))
    ->when($request->input('estado') === 'errores', fn ($q) => $q->where('rows_failed','>',0))
    ->when($request->input('estado') === 'pendientes', fn ($q) => $q->whereIn('status',['pending','processing']))
    ->when($request->filled('tipo'), fn ($q) => $q->where('type', $request->string('tipo')))
    ->latest()->paginate(20)->withQueryString();
```
En el front, `router.get(route('super-admin.data-imports.index'), filtros, { preserveState: true, preserveScroll: true, replace: true, only: ['batches'] })` con debounce de 300 ms en el buscador. `withQueryString()` ya está, así que la paginación conserva los filtros.

---

## Checklist de «no romper nada»

- [ ] `TYPE_KEYS` sigue siendo la única fuente del orden; no duplicar la lista en textos.
- [ ] Cada fila mantiene su `<form>` propio y su `submitImport(type)`; `uploadingType` sigue bloqueando envíos simultáneos.
- [ ] Si se admite drag & drop, quitar `required` del input file **y** validar en JS (extensión, tamaño) antes del POST.
- [ ] `fieldsParam()` intacto: solo manda `fields` cuando la selección es parcial (así el backend sigue devolviendo la plantilla completa por defecto).
- [ ] Los obligatorios nunca son desmarcables; el backend ya los reinyecta (`selectedFields`), la UI solo lo refleja.
- [ ] Presets filtrados contra el catálogo vivo: una columna eliminada no debe romper la descarga.
- [ ] Errores viejos sin `field`/`value`: leer con `??`.
- [ ] `Modal` con `sheetOnMobile` **opcional** — los demás usos del componente en el proyecto no cambian de aspecto.
- [ ] No mostrar porcentaje de progreso mientras el procesamiento siga siendo sincrónico.
- [ ] No implementar reintento parcial de un lote ya procesado.
- [ ] `latestByType` es prop nueva: si falta, la UI cae al estado local sin errores (`?? null`).
- [ ] Al cerrar el modal de campos: limpiar buscador, no la selección.

## Pruebas manuales antes de dar por cerrado

1. Descargar plantilla de cada tipo con selección completa y parcial; verificar que los obligatorios están siempre.
2. ZIP con dos tipos recortados y cuatro completos.
3. Subir CSV por drag & drop y por selector; con extensión inválida y con >10 MB.
4. Procesar un lote con 2 filas malas: contadores, estado «Importado con 2 errores», detalle con campo y valor, descarga de `errores_lote_{id}.csv`.
5. Corregir ese CSV (quitando `_motivo_error`), subir de nuevo y procesar: 0 errores, sin duplicados.
6. Historial: buscar por archivo y por usuario, filtro «Con errores», paginar y comprobar que el filtro se conserva.
7. Móvil (390px): sheet de campos con buscador, presets, scroll interno y pie fijo; objetivos táctiles ≥44px; tabla del historial en tarjetas.
8. Teclado: `Tab` recorre la fila completa; foco visible; `Esc` cierra modal y sheet.
