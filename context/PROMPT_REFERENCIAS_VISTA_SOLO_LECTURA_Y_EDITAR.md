# Referencias: visualización de solo lectura y formulario de editar idéntico al de crear

Dos cambios que van juntos:

1. **`References/Show`** deja de ser una pantalla de trabajo y pasa a ser **solo visualización**. Todo lo que escribe — asociar operación, editar la línea, quitarla, recalcular dificultades — sale de ahí.
2. **`References/Edit`** adopta el mismo patrón ya implementado en **`References/Create`** (shell de dos columnas, secciones numeradas, captura en línea, panel de economía fijo) y **suma el detalle de operaciones**, que hoy no tiene.

El diseño de referencia está en el archivo `Referencias - Vista y Edición.dc.html` (pantallas `1a` vista escritorio, `1b` vista móvil, `1c` editar escritorio, `1d` editar móvil).

> **Regla general para no romper nada:** no cambies el modelo de datos, los nombres de campos, ni el payload de `references.store`. Todo cambio de servidor descrito aquí es aditivo y va detrás de una comprobación de presencia (`$request->has(...)`), para que ningún otro consumidor existente se vea afectado.

---

## Archivos a tocar

| Archivo | Qué hacer |
| --- | --- |
| `resources/js/Pages/References/Show.tsx` | Reescribir como vista de solo lectura sobre `ReferenceFormLayout`. Borrar estados, modal, `ConfirmDialog` de recálculo y los handlers `handleAttach`, `handleDetach`, `handleSaveLine`, `handleRecalculate`. |
| `resources/js/Pages/References/Edit.tsx` | Reescribir con el mismo layout, secciones y panel que `Create.tsx`, más las piezas propias de edición. |
| `resources/js/Components/References/ReferenceFormSection.tsx` | Hacer `step` **opcional**: sin él no se pinta el círculo numerado (lo usa la vista). |
| `resources/js/Components/References/ReferenceOperationsTable.tsx` | Añadir prop `readOnly?: boolean`: oculta la fila de captura, la columna de la papelera y el pie de ayuda, y pinta el precio como texto. Nada más cambia. |
| `resources/js/Components/References/ReferenceEconomicsPanel.tsx` | Sin cambios de API: los bloques nuevos (producción, historial) entran como `children` con `ReferenceEconomicsBlock`. |
| `resources/js/Components/References/ReferenceUnitEconomicsCard.tsx` | Queda sin consumidores; **haz `grep` antes de borrarlo**. Si algo más lo usa, déjalo. |
| `app/Http/Controllers/ReferenceController.php` | `show()`: añadir `productions_max_per_operation`. `edit()`: pasar el catálogo de operaciones. `update()`: sincronizar el detalle de operaciones. `duplicate()`: nuevo. |
| `app/Http/Requests/Reference/UpdateReferenceRequest.php` | Añadir las reglas de `operations.*` (las mismas de `StoreReferenceRequest`). |
| `routes/web.php` | Una ruta nueva: `references.duplicate`. Las de `references.operations.*` **no se borran** (el recálculo sigue usándolas y son API pública del módulo). |

---

## 1 · `Show.tsx` — visualización

### Armazón

Reutiliza `ReferenceFormLayout` tal cual (`header` + `children` + `aside` + `mobileBar`); no crees un shell nuevo. El componente ya aplica la clase `.ref-form`, que es la que trae la paleta — sin ella los tokens `var(--ref-*)` no resuelven.

No hay `<form>`: la vista no envía nada.

### Encabezado

- Izquierda: breadcrumb `Referencias / BLU-003`, título `{code} · {name}`, badge de estado y meta (`Editada el … por …` solo si el dato existe; si no hay `updated_by`, deja únicamente la fecha).
- Derecha, en este orden: **Duplicar** (`ref-btn`), **Eliminar** (`ref-btn`, texto `var(--ref-danger)`), **Editar referencia** (`ref-btn ref-btn-primary`, `Link` a `references.edit`).
- Cada acción va envuelta en `<Can>`: `references.index.create` para duplicar, `references.index.delete` para eliminar, `references.index.edit` para editar. Si el usuario no tiene ninguna, el encabezado queda solo con el título — no dejes un contenedor vacío con borde.

### Secciones (columna izquierda)

Con `ReferenceFormSection` **sin** `step`:

1. **Identidad** — imagen 104×104 (`ZoomableImage` dentro de un contenedor de borde 1px y radio 10px; si no hay imagen, `TagIcon` centrado sobre `var(--ref-surface)`), y a la derecha una rejilla `150px 1fr` con Código, Nombre y, a dos columnas, Descripción. Son párrafos, no `input` deshabilitados: nada con apariencia de campo. Sin descripción, muestra «Sin descripción.» en `var(--ref-subtle)`.
2. **Dinero y lote** — tres cajas (`border: 1px solid var(--ref-border)`, `background: var(--ref-surface)`, radio 8px): Valor unitario de pago, Cantidad total del lote, Estado. Cifra a 18px y una línea de ayuda de 11px. Si `payment_per_unit` es `null`, escribe «Sin definir» y no calcules margen.
3. **Operaciones** — `ReferenceOperationsTable` con `readOnly`. Resumen en el encabezado de la sección: `N líneas · X min · $ Y / u.`. Las líneas con `pivot.is_active === false` se marcan con un tag «Inactiva» junto al nombre y bajan a `var(--ref-muted)`; **no se ocultan**, porque siguen sumando al costo unitario. Pie de tabla: «Las líneas inactivas siguen sumando al costo unitario, pero no se ofrecen al registrar producción. Para cambiar precios o minutos, entra a editar.»

Los minutos siguen la misma regla de hoy (`lineMinutes`): `pivot.estimated_minutes ?? operation.estimated_minutes`, y `0` se trata como ausencia («—» / «Sin medir»). Conserva esa función tal cual está.

### Panel derecho

`ReferenceEconomicsPanel` con `paymentPerUnit`, `productionCostPerUnit`, `lote` y `currency` tomados de `comparison`, más dos bloques como `children`:

- **Producción registrada** — `{producidas} de {lote}`, barra de 5px y el porcentaje.
  **Cuidado con el dato:** `productions_sum_quantity` suma **todas** las operaciones, así que contra el lote da un porcentaje inflado (una prenda con 8 operaciones llegaría a 800%). Usa el mismo criterio que `index()`: el **máximo acumulado en una sola operación**. Añádelo en `show()`:

  ```php
  $reference->setAttribute('productions_max_per_operation', (int) Production::query()
      ->withoutGlobalScopes()
      ->where('reference_id', $reference->id)
      ->selectRaw('operation_id, SUM(quantity) as op_sum')
      ->groupBy('operation_id')
      ->pluck('op_sum')
      ->max());
  ```

  Con lote `0` o `null`, omite la barra y muestra solo la cifra.
- **Historial** — **solo si ya existe un endpoint o una tabla de auditoría.** Hoy no la hay: si no la vas a implementar en este cambio, **omite el bloque completo**; no inventes entradas ni pintes un estado vacío decorativo.

### Móvil

`mobileBar` con el margen unitario (22px), la barra apilada de 4px y `[Ver detalle] [Editar referencia]` en proporción 1:2. «Ver detalle» abre el mismo desplegable que en `Create` (pago, costo, margen del lote y peso de cada operación). Las operaciones se ven como tarjetas, que es lo que ya hace `ReferenceOperationsTable` por debajo de 640px — en `readOnly` la tarjeta pierde el botón «Quitar».

### Qué se borra de `Show.tsx`

`useState` de captura y edición, `Modal` de línea, `ConfirmDialog`, `Select`/`Input`/`Switch` de captura, `Button` «Recalcular dificultades», `router.post/put/delete`. La pantalla no debe quedar con ningún import sin usar (falla el lint).

**El recálculo de dificultades no desaparece del producto**: pásalo al encabezado de la sección «Operaciones» de `Edit`, con su `ConfirmDialog`. Como responde con `back()` y recarga las props, **deshabilítalo mientras el formulario tenga cambios sin guardar** y explícalo en el `title` del botón; si no, el recálculo se lleva por delante lo que el usuario llevaba escrito.

---

## 2 · `Edit.tsx` — idéntico a `Create` + edición

Parte de `Create.tsx` y cambia únicamente lo siguiente.

### Datos que necesita del servidor

En `edit()`:

```php
$reference->load(['operations', 'company']);
$reference->loadCount('productions');

return Inertia::render('References/Edit', [
    'reference' => $reference,
    'operations' => Operation::active()->orderBy('name')
        ->get(['id', 'name', 'base_price', 'estimated_minutes', 'difficulty_level']),
    'comparison' => $this->buildEconomicsComparison($reference),
    'producedMax' => /* mismo cálculo que en show() */,
]);
```

El estado inicial de `refOperations` sale de `reference.operations`, mapeado al tipo `RefOperation`:

```ts
reference.operations.map((op) => ({
    operation_id: op.id,
    name: op.name,
    price: Number(op.pivot.price),
    estimated_minutes: Number(op.pivot.estimated_minutes ?? 0),
}))
```

### Envío

Hoy `Edit` usa `router.post(...)` suelto y por eso `errors` y `processing` nunca se llenan: un guardado rechazado se queda mudo. **Cámbialo al mismo patrón de `Create`**: `useForm` + `transform` + `post(route('references.update', id))` con `_method: 'put'` y `forceFormData: true`.

```ts
transform((datos) => ({
    ...datos,
    _method: 'put',
    operations: refOperations.map((o) => ({
        operation_id: o.operation_id,
        price: o.price,
        estimated_minutes: o.estimated_minutes > 0 ? o.estimated_minutes : null,
    })),
}));
```

Deja que Inertia arme el `FormData` (convierte los booleanos a `'1'/'0'`, que es lo que acepta la regla `boolean`); no lo construyas a mano.

`bloquearEnvioConEnter` se copia igual que en `Create`.

### Diferencias respecto a `Create`

- **Encabezado**: breadcrumb con tres niveles, título con el nombre, badge de estado; a la derecha `n cambios sin guardar` (de `isDirty` + comparación del detalle de operaciones), **Descartar** y **Guardar**. No hay checklist ni contador «n de 4».
- **Código bloqueado con producción registrada** (`producedMax > 0`): `readOnly`, borde `dashed`, fondo un paso más oscuro, candado a la derecha y ayuda «Con producción registrada no se cambia.» Mándalo igual en el payload — la regla `unique` lo ignora a sí mismo, así que no falla.
- **Ayuda del lote**: «No puede bajar de **N** ya producidas» con la misma cifra que valida `UpdateReferenceRequest` (máximo por una sola operación). Si el usuario baja de ahí, el error del servidor cae en `errors.lot_total_quantity` y se pinta bajo el campo.
- **Aviso de producción** debajo de la fila de dinero, con borde izquierdo de 2px acento: «Esta referencia ya tiene **N unidades producidas**. Cambiar precios de operaciones altera el costo de aquí en adelante; lo ya registrado conserva el precio con el que se pagó.» Solo cuando `producedMax > 0`.
- **Precio editable en línea**: pasa `onPrecio` a `ReferenceOperationsTable` (la prop ya existe) actualizando `refOperations` en estado; no dispares peticiones por tecla.
- **Panel**: Margen unitario (con la línea «Antes de tus cambios: $ X · −$ Y» comparando contra `comparison`), Lote, Producción registrada y, en lugar del checklist, **Cambios sin guardar** listados en texto. Si decidiste no implementar historial, aquí tampoco va.
- **Móvil**: las secciones arrancan colapsadas como filas de 48px con pill «editado» en las que cambiaron; la barra fija lleva `[Ver detalle] [Guardar]`.

### Servidor: guardar el detalle de operaciones

`UpdateReferenceRequest`, añadir (idénticas a las de `StoreReferenceRequest`):

```php
'operations' => ['sometimes', 'array'],
'operations.*.operation_id' => ['required', 'integer', 'exists:operations,id'],
'operations.*.price' => ['required', 'numeric', 'min:0'],
'operations.*.estimated_minutes' => ['nullable', 'numeric', 'min:0.01', 'max:9999.99'],
```

En `update()`, **dentro de una transacción** y **solo si la clave viene**:

```php
$data = $request->validated();
$operations = $data['operations'] ?? null;
unset($data['operations'], $data['image']);
```

1. Guarda la referencia como hoy (imagen incluida).
2. Si `$operations !== null`:
   - Arma el `sync` como en `store()`, recalculando `difficulty_level` con `OperationDifficulty::levelFromMinutes` y los `thresholds` de la empresa.
   - **Conserva `is_active` de las líneas que ya existían** (léelas antes del sync); las nuevas entran en `true`. Si no lo haces, cualquier línea inactivada se reactiva sola al guardar.
   - **No permitas quitar una línea con producción registrada.** Antes de sincronizar, compara las que desaparecen contra `Production::where('reference_id', …)->whereIn('operation_id', $quitadas)->exists()` y, si hay, devuelve un error de validación en `operations` con el nombre de la operación. Sin esta guarda quedan producciones apuntando a una línea que ya no existe.
3. `$reference->refreshOperationalCost();`
4. `ReferenceLotCompletion::sync((int) $reference->id);` — ya está y debe seguir ejecutándose **después** del recálculo del costo.
5. Redirige a `references.show` con el flash de siempre.

Si `operations` no viene (cualquier otro consumidor del endpoint), el detalle no se toca: el comportamiento actual queda intacto.

---

## 3 · Duplicar referencia

Ruta nueva, dentro del grupo de `permission:references.index.view` existente:

```php
Route::post('/references/{reference}/duplicate', [ReferenceController::class, 'duplicate'])
    ->name('references.duplicate');
```

Controlador (`authorize` con `references.index.create`), en transacción:

- Copia `name`, `payment_per_unit`, `description`, `lot_total_quantity`, `is_active`.
- `code`: `{code}-COPIA`, y si ya existe, `-COPIA-2`, `-COPIA-3`… hasta encontrar libre dentro de la empresa (la restricción es `unique(code, company_id)`).
- **`image` en `null`.** No copies la ruta del archivo: dos referencias apuntando al mismo objeto hacen que borrar una deje a la otra sin imagen.
- Copia el pivote de operaciones con `price`, `estimated_minutes`, `difficulty_level`, `is_active`.
- **No copies producciones.**
- `refreshOperationalCost()` y redirección a `references.edit` de la copia con «Referencia duplicada. Revisa el código.»

En la vista, el botón abre un `ConfirmDialog` antes de disparar el `router.post`.

## 4 · Eliminar referencia

`destroy()` ya existe. Añade en la vista un `ConfirmDialog` («Se elimina la referencia y su detalle de operaciones. Esta acción no se puede deshacer.») y, en el servidor, **bloquea el borrado si tiene producciones registradas**: `back()->with('error', 'No puedes eliminar una referencia con producción registrada.')`. Hoy el borrado depende de lo que haga la FK; mejor un mensaje que un error 500.

---

## Criterios de aceptación

1. En `Show` no queda ningún control que escriba: ni asociar, ni editar línea, ni quitar, ni recalcular. Solo Duplicar, Eliminar y Editar, cada uno tras su permiso.
2. `Show` y los formularios comparten shell, encabezados de sección, tabla y panel; la vista se distingue por no tener campos ni números de paso.
3. `Edit` muestra y permite modificar el detalle de operaciones, y al guardar el costo unitario resultante coincide con la suma de precios del detalle.
4. Un guardado rechazado por el servidor muestra los errores junto a cada campo (hoy no lo hace).
5. Inactivar una línea, guardar la referencia desde `Edit` y volver a entrar: la línea sigue inactiva.
6. Intentar quitar una línea con producción registrada muestra un error claro y no borra nada.
7. `productions_max_per_operation` es la cifra de «Producción registrada»; el porcentaje nunca pasa de 100%.
8. El margen unitario está visible sin hacer scroll en escritorio y en móvil, en las tres pantallas.
9. En 390px ningún campo se desborda y los objetivos táctiles miden ≥ 44px.
10. El payload de `references.store` es idéntico al actual; `references.update` solo cambia por la clave opcional `operations`.
11. `npm run build` y `php artisan test` pasan; no quedan imports ni props sin usar.

## Comprobaciones manuales antes de dar por cerrado

- Referencia sin operaciones, sin imagen y sin `payment_per_unit`: las tres pantallas se ven bien y no aparece `NaN` ni `$ 0` engañoso.
- Referencia con 20+ operaciones: la tabla no desborda el panel y el sticky del `aside` sigue funcionando.
- Referencia con producción: código bloqueado, aviso visible, lote no se puede bajar.
- Modo claro y modo oscuro (los tokens de `.ref-form` cubren ambos; no escribas colores fijos fuera de esas variables).
- Usuario sin `references.index.edit`: la vista se abre y no muestra acciones de escritura por ningún lado.
