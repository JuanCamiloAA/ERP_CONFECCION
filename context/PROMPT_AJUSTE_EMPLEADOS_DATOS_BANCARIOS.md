# AJUSTE — Empleados: datos de pago bancario + módulo de Bancos
## Prompt para Claude Opus — Implementación incremental sin afectar lo ya desarrollado

---

> **USO:** Pega este documento completo en Claude Opus, indicando que el proyecto (Taller Confección / stack Laravel 12 + Inertia + React) **ya existe** y que solo debes aplicar las modificaciones descritas aquí. **No** eliminar ni romper módulos previos (producción, nómina dual, roles, etc.).

---

## 0. OBJETIVO

Ampliar el **módulo de Empleados** para registrar, por cada empleado, datos bancarios requeridos para pagos:

| Campo | Tipo | Reglas |
|-------|------|--------|
| **Banco** | Relación a catálogo | Lista desplegable dependiente del **módulo de Bancos** (no hardcodear lista en el formulario). |
| **Número de cuenta bancaria** | Texto / string | Longitud máxima razonable (ej. 30–34 caracteres); solo dígitos o alfanumérico según política (ej. solo dígitos para número de cuenta). |
| **Llave bancaria** | Alfanumérico | Permitir letras y números; normalizar trim; longitud max (ej. 100). Obligatoriedad igual que los demás campos de pago (ver sección 3). |

Implementar antes (o en paralelo) un **módulo de Bancos** gestionable por la empresa, de donde se alimenta el `<select>` del empleado.

---

## 1. MÓDULO DE BANCOS (NUEVO)

### 1.1 Alcance funcional

- CRUD de bancos **por empresa** (`company_id`) para respetar el modelo multiempresa existente.
- Campos mínimos sugeridos:
  - `id`
  - `company_id` (FK `companies`, cascade / restrict según patrón del proyecto)
  - `code` (string corto, opcional — ej. abreviatura interna)
  - `name` (nombre visible en lista desplegable)
  - `is_active` (boolean, default true) — empleados solo pueden elegir bancos activos
  - `timestamps`, `softDeletes` si el resto del proyecto usa soft delete en catálogos similares

- **Unicidad:** `(company_id, name)` o `(company_id, code)` si `code` es obligatorio — definir una sola regla y validar en Form Request.

### 1.2 Rutas (convención web + Inertia)

- Agrupar bajo prefijo autenticado y middleware de empresa, por ejemplo:
  - `GET/POST   /banks` — index, store
  - `GET        /banks/create`
  - `GET/PUT/DELETE /banks/{bank}` — show (opcional), edit, update, destroy

- Autorización: **PermissionHelper** / Spatie — añadir permisos nuevos (ver sección 7).

### 1.3 Controlador y capa de aplicación

- `BankController` (o nombre que siga el proyecto): `index`, `create`, `store`, `edit`, `update`, `destroy`.
- `StoreBankRequest` / `UpdateBankRequest` con `authorize()` y `rules()`.
- **Soft delete:** al “eliminar” banco, si existen empleados con `bank_id` apuntando a él, **no permitir eliminación física**; opciones:
  - **Recomendado:** `deactivate` (`is_active = false`) y evitar borrar; o
  - Forzar `bank_id` null en empleados con confirmación explícita — menos recomendable.
  Documentar la opción elegida en código.

### 1.4 Frontend — páginas React

- `resources/js/Pages/Banks/Index.tsx` — tabla con búsqueda, estado, acciones.
- `resources/js/Pages/Banks/Create.tsx` — formulario.
- `resources/js/Pages/Banks/Edit.tsx` — formulario.
- Tipos TypeScript: `Bank` en `types/index.d.ts` o equivalente.
- Integrar en **sidebar** según `accessible_pages` / permisos (módulo `banks`).

### 1.5 Seed (datos iniciales)

- `BankSeeder` o extensión de `DemoDataSeeder`: insertar 8–15 bancos ejemplo **solo para la empresa demo** (nombres realistas del país que use el negocio, ej. Colombia).
- **Super admin:** si aplica, al crear empresa nueva puede arrancar sin bancos; el admin de la empresa los crea.

### 1.6 API auxiliar (opcional, recomendada para UX)

- Endpoint liviano `GET /api/banks/active` o `GET /banks/options` que devuelva `{ id, name }[]` filtrado por `company_id` y `is_active = true`, usado por el formulario de empleado para evitar cargar toda la página de banks. Si el proyecto ya usa Inertia props al abrir Create/Edit empleado, puede bastar con pasar `banks: Bank[]` en el mismo controller — elegir **un** patrón y ser consistente.

---

## 2. MÓDULO DE EMPLEADOS — CAMBIOS EN MODELO Y BD

### 2.1 Migración incremental

**No** reescribir migraciones antiguas ya aplicadas. Crear nueva migración, por ejemplo:

```php
// add_bank_fields_to_employees_table
Schema::table('employees', function (Blueprint $table) {
    $table->foreignId('bank_id')->nullable()->constrained('banks')->nullOnDelete();
    $table->string('bank_account_number', 34)->nullable();
    $table->string('bank_key', 100)->nullable();
});
```

Ajustar `constrained('banks')` solo si la tabla `banks` se crea **en una migración con fecha anterior** a esta migración de empleados; de lo contrario, ordenar correctamente:

1. `create_banks_table`
2. `add_bank_fields_to_employees_table`

### 2.2 Reglas de consistencia

- Si se define que los tres campos son grupo de pago obligatorio cuando el empleado está “completo para nómina”, usar Form Request con `required_with` o reglas condicionales; ver sección 3.
- Índice opcional: `bank_id` ya indexado por FK.

### 2.3 Modelo `Employee`

- `fillable` / `casts` actualizados.
- Relación `belongsTo(Bank::class)` como `bank()`.
- Incluir en serialización Inertia cuando se muestre ficha empleado: `bank: { id, name }` o lazy load.

### 2.4 Modelo `Bank`

- `hasMany(Employee::class)` como `employees()` (opcional, para contador en Index de bancos).

---

## 3. VALIDACIÓN (BACKEND Y FRONTEND)

### 3.1 Reglas sugeridas (ajustar a convención del proyecto)

**Store/Update Employee:**

- `bank_id`: `nullable|exists:banks,id` + regla custom **scoped**: el `bank` debe pertenecer a `company_id` del empleado y `is_active = true`. Implementar `Rule::exists(...)->where(...)`.
- `bank_account_number`: `nullable|string|max:34` + regex opcional solo dígitos `regex:/^[0-9]+$/` si negocio lo exige; si cuentas pueden llevar guiones, permitir: `regex:/^[0-9A-Za-z\-]+$/`.
- `bank_key`: `nullable|string|max:100|regex:/^[0-9A-Za-z]+$/` (alfanumérico sin espacios; si negocio permite guión, documentar cambio).

**Regla de grupo “todos o ninguno” (recomendado para evitar datos incompletos):**

- Si se informa cualquiera de `bank_id`, `bank_account_number`, `bank_key`, entonces **los tres** son `required` en la misma petición (usar `required_with` en cadena).

Alternativa: si el product owner quiere **siempre obligatorios** desde el alta, marcar los tres como `required` sin `nullable` en BD (preferir valores por defecto null en migración y volver obligatorios solo por validación cuando el empleado esté activo — eligir una política y documentar en el Form Request).

### 3.2 Frontend (Zod + React Hook Form)

- Espejar las mismas reglas en esquema Zod del formulario Create/Edit empleado.
- Select de banco:
  - `options` desde props Inertia `banks`.
  - Placeholder: “Seleccione un banco”.
  - Si lista vacía, mostrar enlace o mensaje: “Debe registrar al menos un banco en Configuración → Bancos” con permiso a quien pueda crear bancos.

---

## 4. FRONTEND — PANTALLAS DE EMPLEADO

### 4.1 `Employees/Create.tsx` y `Employees/Edit.tsx`

- Nueva sección **“Datos para pago”** o **“Datos bancarios”** (texto en español), después de datos personales o antes de “Acceso al sistema”:
  - **Banco:** `<select>` dependiente de `banks` cargados para la empresa activa.
  - **Número de cuenta:** `<input>` texto.
  - **Llave bancaria:** `<input>` texto; indicación visual “Solo letras y números” según regex.
- En **Edit**, precargar valores; mostrar nombre del banco si viene relación.

### 4.2 `Employees/Show.tsx` y `Employees/Index.tsx`

- **Show:** card o fila con banco (nombre), número enmascarado **opcional** (ej. últimos 4 dígitos) si política de seguridad lo pide; si no, mostrar completo solo a roles con permiso `employees.show.view_bank` o reutilizar `employees.show.view`.
- **Index:** columna opcional “Banco” (solo nombre) para no saturar; o solo en Show.

### 4.3 Export / PDF / nómina

- Si existe exportación de datos de empleados o reportes de pago, incluir estos campos solo donde tenga sentido legal y de permisos — no expandir alcance salvo que ya exista patrón de export.

---

## 5. REPORTES Y NÓMINA (INTEGRACIÓN LIGERA)

- **No** cambiar fórmulas de nómina existentes.
- Si la vista impresa de nómina o exportación lista datos bancarios por empleado, añadir columnas **solo si** el permiso y el diseño actual lo permiten; si no existe, **omitir** (fuera de alcance mínimo).

---

## 6. ORDEN DE IMPLEMENTACIÓN RECOMENDADO

1. Migración `create_banks_table`.
2. Modelo `Bank`, policy, requests, `BankController`, rutas.
3. Páginas React `Banks/*`, enlace en menú y permisos en matriz.
4. Seeder de bancos demo.
5. Migración `add_bank_fields_to_employees_table`.
6. Actualizar `Employee` model + `StoreEmployeeRequest` / `UpdateEmployeeRequest` + `EmployeeController` (props `banks`).
7. Actualizar formularios y Show de empleados.
8. Factories / tests si el proyecto los usa.
9. `npm run build` y `php artisan migrate` sin errores.

---

## 7. PERMISOS DINÁMICOS (PermissionHelper + SEED)

Extender la matriz de permisos del sistema existente con:

- Módulo `banks`:
  - Páginas: `index`, `create`, `edit`
  - Acciones: `view`, `create`, `edit`, `delete` (o `deactivate`)

Ejemplos de strings:

- `banks.index.view`, `banks.create.create`, `banks.edit.edit`, `banks.index.delete`

Incluir en seeders de roles **admin** acceso completo a `banks`; **operario** sin acceso salvo excepción explícita.

---

## 8. CHECKLIST DE VERIFICACIÓN (OPUS DEBE CONFIRMAR)

- [ ] Crear/editar empleado guarda `bank_id`, `bank_account_number`, `bank_key` correctamente.
- [ ] Select de banco solo muestra bancos de la empresa activa y con `is_active = true`.
- [ ] Validación `exists` no permite elegir banco de otra empresa (prueba manual o test).
- [ ] Desactivar banco no lo muestra en nuevos formularios; empleados ya asignados siguen mostrando nombre (histórico) o mensaje de “banco inactivo” — documentar comportamiento elegido.
- [ ] Empleados y nómina por operaciones / salario diario **siguen funcionando** igual que antes del cambio.
- [ ] Sin errores TypeScript ni errores de compilación Vite.

---

## 9. INSTRUCCIÓN FINAL PARA CLAUDE OPUS

Aplica únicamente las modificaciones anteriores sobre el código existente. **Mantén intactos** el diseño de permisos parametrizables, módulos de producción, nómina dual, jornadas y vínculo empleado–usuario salvo donde sea necesario importar el modelo `Bank` en respuestas Inertia.

No dejes código incompleto. Al finalizar, lista **archivos creados/modificados** y los comandos:

```bash
php artisan migrate
npm run build
```

---

*Documento: Ajuste empleados — datos bancarios + catálogo Bancos — Mayo 2026*
