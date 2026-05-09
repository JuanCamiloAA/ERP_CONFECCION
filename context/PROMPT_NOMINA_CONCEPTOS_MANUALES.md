# AJUSTE — Nómina: conceptos parametrizables + ajustes manuales (suma al devengado)
## Prompt completo para Claude Opus — Implementación incremental sin romper lo existente

---

> **USO:** Pega este documento completo en Claude Opus. El proyecto ya implementa nómina con estados (`borrador` / `calculado` / `aprobado` / `pagado` o equivalente), `payroll_employees` con `production_total`, `daily_work_subtotal`, deducciones, anticipos, **empleados por operaciones** y **por salario diario/jornada**. Implementa **solo** lo descrito aquí. **Nuevas migraciones** únicamente; no reescribir migraciones históricas.

---

## 0. OBJETIVO DE NEGOCIO

Cuando una nómina está en estado **`calculado`** (y **solo** en estados que permitan edición previo a **aprobado/pagado**), el administrador debe poder **agregar líneas de ajuste** por cada empleado en la liquidación, con:

1. **Concepto** — elegido de un catálogo **parametrizable por empresa** (submódulo “Conceptos de nómina” o “Conceptos de ajuste”).
2. **Valor** — monto numérico que se **suma** al total devengado generado por el sistema (producción por operaciones **y/o** salario diario / jornada según corresponda al empleado).

**Regla financiera v1:** cada ajuste es una **adición** al devengado bruto antes de aplicar deducciones y anticipos reales (recomendado) **o** al campo ya llamado “Producido” en UI si ese número representa bruto operativo — **documentar en código**. Fórmula sugerida:

```text
gross_employee = production_total + daily_work_subtotal + sum(ajustes_positivos)
net_employee   = gross_employee - total_deducciones - total_anticipos_descontados
```

Si hoy `net_payment` se calcula distinto, **integrar** `adjustments_total` sin romper redondeos (2 decimales COP).

**Alcance:** Aplica **igual** para empleado **por operaciones** y **por salario fijo diario**.

**Fuera de v1:** ajustes negativos como concepto separado; si se desea, añadir campo `adjustment_type: addition|deduction` en BD — ver §2.

---

## 1. SUBMÓDULO — CATÁLOGO DE CONCEPTOS (POR EMPRESA)

### 1.1 Tabla `payroll_concepts` (nombre ajustable si hay conflicto)

```text
id
company_id (FK companies)
name (string, 150) — ej. “Bonificación puntualidad”, “Ajuste manual”, “Prima extranjera”
code (string, 50, nullable) — opcional para reportes / export
description (text nullable)
sort_order (int, default 0)
is_active (bool, default true)
created_at, updated_at

UNIQUE(company_id, name) — case insensitive vía validación en Request si DB no soporta índice funcional
INDEX(company_id, is_active)
```

**Aislamiento:** mismo `CompanyScope` / reglas que el resto de tablas de empresa.

### 1.2 CRUD

- Rutas ejemplo: `GET/POST/PUT/DELETE /payroll-concepts` o anidadas bajo `settings`.
- Permisos nuevos en matriz (si el sistema es dinámico): `payroll_concepts.index.view`, `create`, `edit`, `delete` **solo** admin empresa (`company_id`); `super_admin` según política actual.
- UI: `PayrollConcepts/Index|Create|Edit.tsx` — lista simple, sin SoftDeletes (usar `is_active = false`).

---

## 2. TABLA DE APLICACIÓN POR EMPLEADO EN UNA NÓMINA

### 2.1 Tabla `payroll_employee_adjustments`

```text
id
company_id (FK companies) — redundante pero útil para queries y seguridad
payroll_employee_id (FK payroll_employees, cascade on delete)
payroll_concept_id (FK payroll_concepts)
amount (decimal 12,2) — **siempre >= 0 en v1**; conceptos “resta” como futuro
notes (text nullable)
created_by (FK users nullable)
created_at, updated_at

INDEX(payroll_employee_id)
CHECK(amount >= 0) — si la BD lo permite; si no, validar en Request
```

**Validación cruzada:** `payroll_employees.payroll_id` → `payrolls.company_id` debe coincidir con `payroll_concepts.company_id` y `company_id` de la fila.

### 2.2 Extender modelo `PayrollEmployee`

- Relación `hasMany` adjustments.
- Campo calculado **`adjustments_total`** (accessor o `withSum`): `SUM(amount)`.
- Al **recalcular** línea de nómina (servicio existente), incluir:

```text
gross_with_adjustments = base_gross + adjustments_total
```

donde `base_gross = production_total + daily_work_subtotal` (nombres según columnas reales del proyecto).

- Persistir en columnas existentes **o** nueva columna **`adjustments_subtotal`** en `payroll_employees` para auditoría y UI rápida — **recomendado** añadir:

```php
// migración
$table->decimal('adjustments_subtotal', 12, 2)->default(0)->after('daily_work_subtotal');
```

y actualizarla cada vez que se agrega/edita/elimina un ajuste **o** recalcular con query al vuelo.

### 2.3 Cuándo se puede editar

- Solo si `payroll.status` ∈ **`['calculado', 'borrador']`** — **ajustar enum** al valor real del código (si solo `calculado` permite edición después de calcular, limitar a ese).
- **Prohibido** si `aprobado` o `pagado` (retornar 403).
- Policies: `PayrollPolicy@addAdjustment`, `updateAdjustment`, `deleteAdjustment`.

---

## 3. BACKEND — SERVICIO

Extender **`PayrollCalculationService`** (o equivalente):

- Tras calcular producción/jornada, dejar `adjustments_subtotal` en **0** o recalcular desde tabla hija.
- Método **`recalculatePayrollEmployeeTotals(PayrollEmployee $pe): void`** que:
  1. Suma ajustes.
  2. Recalcula `net_payment` coherente con deducciones JSON / anticipos existentes.

**Idempotencia:** volver a pulsar “Recalcular nómina” **no** debe borrar ajustes manuales salvo comando explícito “Recalcular y limpiar ajustes” (no implementar en v1).

---

## 4. API / CONTROLADOR

Rutas bajo grupo autenticado + permiso `payrolls.show.edit` o permiso específico `payrolls.adjustments.manage`:

| Método | Ruta | Acción |
|--------|------|--------|
| GET | `/payrolls/{payroll}/employees/{payrollEmployee}/adjustments` | Listar JSON o partial (Inertia puede incluir en show) |
| POST | `/payrolls/{payroll}/employees/{payrollEmployee}/adjustments` | Crear: `payroll_concept_id`, `amount`, `notes` |
| PUT | `/payrolls/.../adjustments/{adjustment}` | Editar monto/nota |
| DELETE | `/payrolls/.../adjustments/{adjustment}` | Eliminar |

Tras cada mutación: `recalculatePayrollEmployeeTotals` + actualizar totales cabecera nómina `payrolls.total_amount` si aplica.

**Validación:**

- `amount`: `required|numeric|min:0.01`
- `payroll_concept_id`: exists + misma company
- Estado payroll según §2.3

---

## 5. FRONTEND — `Payrolls/Show.tsx` (O EQUIVALENTE)

### 5.1 Fila expandida del empleado

Dentro del acordeón **“Producción por operaciones…”** / detalle jornada:

- Bloque nuevo **“Ajustes y conceptos manuales”** visible cuando `payroll.status` permite edición.
- Listado de ajustes: concepto, valor, nota, botón eliminar, botón editar (modal o inline).
- Botón **“Agregar concepto”** → modal con `<Select>` de conceptos activos de la empresa + input monto + nota opcional.
- Mostrar **subtotal ajustes** y actualizar columnas superiores **Producido / bruto** y **Pago neto** tras guardar (refetch Inertia `only` o reload parcial).

### 5.2 UX

- Tooltips: *“Los conceptos se configuran en Configuración → Conceptos de nómina.”*
- Mensaje pie existente sobre producciones confirmadas/pendientes **se mantiene**.

### 5.3 Empleados por salario

- Misma UI en la sección de detalle de **jornada / salario diario**; no condicionar solo a “Por operaciones”.

---

## 6. PERMISOS

Añadir a `PermissionHelper` si aplica:

- `payroll_concepts.index.*`
- `payrolls.show.manage_adjustments` (o reusar `payrolls.show.edit`)

Seed: rol admin empresa con acceso; contador opcional sin delete.

---

## 7. SEED Y FACTORIES

- `PayrollConceptSeeder` para empresa demo: 3–5 conceptos ejemplo.
- Factories para tests.

---

## 8. NO REGRESIONES (CHECKLIST)

- [ ] Nómina **sin** ajustes: totales idénticos a comportamiento previo (`adjustments_subtotal = 0`).
- [ ] Aprobar / pagar bloquea crear/editar ajustes.
- [ ] Multiempresa: conceptos y ajustes no cruzan `company_id`.
- [ ] Empleado mixto (si existe): solo un tipo de devengo activo + ajustes suman igual.
- [ ] `npm run build` y migraciones OK.

---

## 9. ORDEN DE IMPLEMENTACIÓN

1. Migración `payroll_concepts`, `payroll_employee_adjustments`, columna `adjustments_subtotal` si se adopta.
2. Modelos + relaciones + CompanyScope.
3. CRUD conceptos + políticas.
4. Servicio recálculo + endpoints ajustes.
5. UI Show nómina + modal + lista.
6. Seeder demo + pruebas manuales.

---

## 10. INSTRUCCIÓN FINAL PARA CLAUDE OPUS

Implementar **completo** sin `TODO`. Si los enums de estado difieren (`calculated` vs `calculado`), **alinear** al español o inglés del código existente. Si `PayrollEmployee` no tiene aún `daily_work_subtotal`, la fórmula de `base_gross` debe usar solo las columnas que existan.

```bash
php artisan migrate
npm run build
```

---

*Documento: Nómina — conceptos empresa + ajustes manuales en estado calculado — Mayo 2026*
