# AJUSTE — Referencias: precio de pago por unidad + comparativo costo de producción
## Prompt para Claude Opus — Implementación incremental sin romper lo ya desarrollado

---

> **USO:** El proyecto (Taller confección, Laravel 12, Inertia, React, módulo de referencias con operaciones y precios por `reference_operations` u equivalente) **ya existe**. Pega este documento completo en Claude Opus. Implementa **únicamente** lo aquí descrito. No alterar la lógica de producción por operaciones, nómina, permisos, importación CSV ni demás módulos salvo donde sea estrictamente necesario enlazar datos de referencia.

---

## 0. OBJETIVO DE NEGOCIO

1. **Nuevo dato maestro en la referencia:** un campo monetario donde se registra **el valor unitario al que le pagan la referencia** (ingreso por cada unidad vendida/producida para el cliente, según defina el negocio). En adelante: **precio de pago unitario**.

2. **Comparativo al finalizar:** tras crear (y también al visualizar/editar) una referencia, el sistema debe mostrar un **resumen comparativo** entre:
   - **Precio de pago unitario** (campo nuevo).
   - **Costo estimado de producción unitario** = **sumatoria** del valor unitario de **todas** las operaciones asociadas a esa referencia (usar el precio vigente en la relación referencia–operación: pivot `price` / `reference_operations.price`; si el modelo usa otro nombre, alinear con el código existente).

3. **Escalado por cantidad:** la misma pantalla debe permitir ingresar una **cantidad de unidades** (solo UI, no obligatorio persistir en BD salvo que ya exista un campo útil; por defecto usar **input local** en React con valor inicial `1`) y mostrar:
   - Total precio de pago = `precio_pago_unitario × cantidad`
   - Total costo producción = `costo_unitario_operaciones × cantidad`
   - Margen total = diferencia (y opcionalmente margen % sobre el pago o sobre el costo).

4. **No regresiones:** crear/editar referencias, operaciones asociadas, imágenes, permisos y listados siguen funcionando igual; solo se añaden campo, validaciones, cálculos y componentes de UI.

---

## 1. MODELO DE DATOS

### 1.1 Migración incremental

Crear migración (no editar migraciones ya desplegadas):

```php
Schema::table('references', function (Blueprint $table) {
    $table->decimal('payment_per_unit', 12, 2)->nullable()->after('name'); // ajustar posición según tabla real
});
```

**Nombre de columna:** usar `payment_per_unit` en código (inglés, convención Laravel). **Label UI español:** “Valor unitario de pago”, “Precio al que me pagan la unidad”, o texto equivalente claro para el usuario.

- `nullable` en BD para compatibilidad con referencias existentes; la validación de **obligatorio** en **crear** puede ser regla de negocio en Form Request (recomendado **obligatorio ≥ 0** al crear referencias nuevas desde la fecha del despliegue).

### 1.2 Modelo `Reference`

- Añadir `payment_per_unit` a `$fillable` y `'payment_per_unit' => 'decimal:2'` en `$casts` (o `float` según estilo del proyecto).

### 1.3 Cálculo de costo unitario por operaciones (backend)

Implementar método reutilizable en el modelo o en un service:

```php
// Pseudocódigo — ajustar nombres de relaciones reales
public function productionCostPerUnit(): string // Decimal como string o float
{
    return $this->referenceOperations()
        ->sum('price'); // o suma de pivots; si hay soft-disabled rows, filtrar is_active
}
```

Reglas:

- Si la referencia **no tiene** operaciones asociadas aún: `productionCostPerUnit()` retorna `0` y la UI muestra aviso **“Sin operaciones: agregue operaciones para calcular el costo de producción.”**
- Si una operación tiene precio `null`, tratar como `0` o bloquear guardado según política existente; **documentar** la opción elegida (recomendado: validar que no haya precios nulos al cerrar comparativo o al guardar referencia con operaciones).

---

## 2. VALIDACIÓN

### 2.1 Form Requests (`StoreReferenceRequest`, `UpdateReferenceRequest`)

- `payment_per_unit`: `required|numeric|min:0` (o `nullable` en update si se permite borrar en empresa legacy; recomendado **min:0** siempre).
- Mensajes en español.

### 2.2 Frontend (Zod + React Hook Form)

- Espejar reglas; formato moneda coherente con el resto del proyecto (COP u otra).

---

## 3. CAPA HTTP / INERTIA

### 3.1 `ReferenceController`

Tras `store` exitoso:

- **Opción A (recomendada):** redirigir a `references.show` con flash `success` y props que ya incluyan la referencia con relaciones cargadas para pintar el comparativo.
- **Opción B:** redirigir a `references.create` con modal — menos claro. **Preferir Show.**

En `show` y `edit`, calcular y enviar a Inertia (como props o atributo calculado):

```php
'comparison' => [
    'payment_per_unit' => (float) $reference->payment_per_unit,
    'production_cost_per_unit' => (float) $reference->productionCostPerUnit(),
    'margin_per_unit' => ...,
    // opcional: flags
    'has_operations' => $reference->referenceOperations()->exists(),
],
```

**Margen unitario:** `payment_per_unit - production_cost_per_unit` (redondeo a 2 decimales consistente con moneda).

---

## 4. FRONTEND (REACT)

### 4.1 `References/Create.tsx` (y `Edit.tsx`)

- Añadir campo **numérico** / input con máscara monetaria para `payment_per_unit`.
- Ayuda bajo el campo: texto corto explicando que es lo que **reciben** por unidad, distinto del costo interno de operaciones.

### 4.2 Nuevo componente reutilizable

`resources/js/Components/References/ReferenceUnitEconomicsCard.tsx` (nombre ajustable)

**Props sugeridas:**

- `paymentPerUnit: number`
- `productionCostPerUnit: number`
- `currency?: string` (prop opcional; usar la misma convención que en otros módulos)

**Contenido:**

1. **Tabla o grid comparativo (desktop)** / apilado (móvil):
   - Fila/columna: “Precio de pago (unitario)” vs “Costo producción (unitario)” vs “Margen unitario” (con color: verde si ≥ 0, rojo/ámbar si < 0 según diseño existente).
2. **Bloque cantidad:**
   - `Label:` “Cantidad de unidades”
   - `Input` tipo number, `min={1}`, `step={1}`, estado local `quantity`.
   - Mostrar:
     - **Total pago** = `paymentPerUnit * quantity`
     - **Total costo** = `productionCostPerUnit * quantity`
     - **Margen total** = diferencia
   - Formatear con helper existente `formatCurrency`.

3. Si `!hasOperations`: mostrar `Alert` o `EmptyState` indicando agregar operaciones; ocultar o mostrar en gris los costos en cero con leyenda.

### 4.3 `References/Show.tsx`

- Incluir `ReferenceUnitEconomicsCard` debajo de datos principales o en columna lateral.
- Mostrar también **listado de operaciones** con precio unitario (si ya existía, no duplicar; integrar el card arriba o debajo del listado).

### 4.4 Post-creación

- Tras redirect a `Show`, el usuario ve inmediatamente el comparativo; si aún no hay operaciones, mensaje claro.

### 4.5 `References/Index.tsx` (opcional, mejora)

- Columna opcional “Pago unit.” y “Costo op.” o solo ícono de tendencia si hay espacio; **no obligatorio** para el alcance mínimo.

---

## 5. REPORTES Y PRODUCCIÓN

- **No cambiar** el cálculo de `productions.total_value` (cantidad × precio operación) salvo requisito explícito futuro.
- Si existe reporte de referencias, se puede añadir columna opcional `payment_per_unit` en export — **fuera de alcance mínimo** si no existe patrón; mencionar como opcional en comentario al final de implementación.

---

## 6. PERMISOS

- No nuevos permisos obligatorios si `references.show.view` ya cubre el comparativo.
- Si el comparativo incluye datos sensibles, reutilizar el mismo permiso que la ficha de referencia.

---

## 7. PRUEBAS MANUALES (CHECKLIST)

- [ ] Crear referencia con `payment_per_unit` y operaciones con precios: comparativo correcto unitario y con cantidad > 1.
- [ ] Referencia sin operaciones: mensaje adecuado, sin errores JS/PHP.
- [ ] Editar `payment_per_unit` y operaciones: valores actualizados en Show.
- [ ] Referencias antiguas (`payment_per_unit` null): migración no rompe; UI muestra  o **0** con invitación a completar dato según política (recomendado badge “Incompleto” en Edit).
- [ ] `npm run build` y `php artisan migrate` sin errores.

---

## 8. ORDEN DE IMPLEMENTACIÓN

1. Migración + modelo + casts.
2. Método `productionCostPerUnit()` + tests unitarios si el proyecto los usa.
3. Form Requests + Controller `store/show/edit/update` props.
4. Create/Edit field + `ReferenceUnitEconomicsCard` + Show.
5. Revisar factories/seeders demo: rellenar `payment_per_unit` en referencias de prueba.

---

## 9. INSTRUCCIÓN FINAL PARA CLAUDE OPUS

Implementa de forma **incremental**. Si la relación pivot no se llama `reference_operations` o el campo de precio difiere (`unit_price`, etc.), **ajusta los nombres** manteniendo la semántica: suma de precios unitarios de operaciones ligadas a la referencia.

Al terminar, entrega **lista de archivos modificados/creados** y:

```bash
php artisan migrate
npm run build
```

---

*Documento: Referencias — payment_per_unit y comparativo costo operaciones — Mayo 2026*
