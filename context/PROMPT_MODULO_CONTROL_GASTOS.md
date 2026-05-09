# MÓDULO ADICIONAL — Control de gastos (empresa) + Categorías de gastos
## Prompt completo para Claude Opus — Implementación incremental sin conflictos

---

> **USO:** Pega este documento completo en Claude Opus. El proyecto **ya existe** (Laravel 12, Inertia, React, multiempresa `company_id`, Spatie Permission con matriz por empresa, overrides por usuario si aplica, Firebase u otro `ObjectStorageInterface`, roles admin/contador, etc.). Implementa **únicamente** este módulo. **No** modificar migraciones ya ejecutadas en producción salvo con **nuevas** migraciones incrementales. **No** romper rutas, nómina, producción, landing, ni super admin salvo añadir permisos al catálogo global.

---

## 0. OBJETIVO DE NEGOCIO

Permitir que **administradores de empresa** y/o **contadores** (definible por **permisos** en rol y por **excepción de usuario**) registren **gastos** con:

| Requisito | Detalle |
|-----------|---------|
| **Categoría** | Obligatoria; catálogo **por empresa** (submódulo CRUD). |
| **Monto** | Obligatorio; moneda coherente con el resto del sistema (ej. COP). |
| **Descripción / concepto** | Texto obligatorio o opcional según política (recomendado obligatorio corto). |
| **Fecha del gasto** | Campo **independiente** de `created_at`: puede ser anterior/posterior al día de registro en sistema. |
| **Comprobante** | Un archivo por gasto: **PDF** o **imagen** (jpeg, png, webp); almacenado vía **servicio de archivos unificado** ya existente (Firebase/local). |
| **Aislamiento** | Gastos y categorías **solo visibles** para la empresa del usuario (`company_id`). |

**Auditoría:** Registrar `created_by` (user_id) y timestamps de creación/actualización.

---

## 1. MODELO DE DATOS

### 1.1 Tabla `expense_categories`

```text
id
company_id (FK companies, cascade on delete o restrict según estándar del proyecto)
name (string, max 120)
slug (string nullable) — opcional para integraciones; no obligatorio en UI
description (text nullable)
is_active (boolean, default true)
sort_order (int, default 0)
created_at, updated_at

UNIQUE (company_id, name)  -- o (company_id, lower(name)) vía índice funcional en PostgreSQL; en MySQL validar en Request
INDEX (company_id, is_active)
```

### 1.2 Tabla `expenses`

```text
id
company_id (FK companies)
category_id (FK expense_categories)
amount (decimal 12,2)
description (text) — concepto del gasto
expense_date (date) — fecha real del gasto (negocio)
registered_at (datetime nullable) — opcional duplicado de created_at; puede omitirse y usar solo created_at para “fecha registro”
receipt_path (string nullable) — path/URL/prefijo coherente con storage unificado
receipt_original_name (string nullable)
receipt_mime (string nullable) — application/pdf, image/jpeg, etc.
notes (text nullable)
created_by (FK users nullable)
created_at, updated_at
deleted_at — SoftDeletes recomendado igual que otros módulos de empresa

INDEX (company_id, expense_date)
INDEX (company_id, category_id)
FOREIGN KEY (category_id) REFERENCES expense_categories(id)
```

**Regla:** `category.company_id` **debe coincidir** con `expense.company_id` (validar en Form Request / observer).

---

## 2. MODELOS ELOQUENT

- `ExpenseCategory`: `belongsTo Company`, `hasMany Expenses`, aplicar **`CompanyScope`** o equivalente global scope del proyecto; `SoftDeletes` solo si categorías se “borran” lógicamente — si se prefiere `is_active` sin soft delete, documentar. **Recomendado:** sin soft delete en categorías; `is_active = false` + validar que no haya gastos pendientes al “desactivar” **o** permitir desactivar pero no crear nuevos en esa categoría.
- `Expense`: `belongsTo Company`, `belongsTo ExpenseCategory`, `belongsTo User as creator`, `SoftDeletes`, fills y casts (`amount` decimal, `expense_date` date).

---

## 3. PERMISOS (CATÁLOGO GLOBAL + MATRIZ)

Añadir módulo **`expenses`** en `PermissionHelper::getPermissionMatrix()`:

| Página (slug) | Acciones |
|---------------|----------|
| `categories` | `view`, `create`, `edit`, `delete` |
| `index` (listado gastos) | `view`, `create`, `edit`, `delete`, `export` (opcional v1) |

Strings ejemplo:

- `expenses.categories.view`, `expenses.categories.create`, …
- `expenses.index.view`, `expenses.index.create`, `expenses.index.edit`, `expenses.index.delete`

**Roles sugeridos en seeder (solo si no existen):** rol “Contador” con permisos de gastos; admin empresa con todos.

**Overrides por usuario:** Respetar sistema existente (`grant`/`deny`); un usuario con rol amplio puede **denegar** `expenses.index.delete` sin tocar el rol.

**Middleware de rutas:** reutilizar `permission:expenses.index.view` etc.

`super_admin`: **fuera de alcance** gestionar gastos de cada empresa desde este módulo **salvo** que el producto ya tenga impersonación; **recomendado v1:** solo usuarios con `company_id` no nulo acceden al módulo. Si `super_admin` necesita ver todo, añadir rutas opcionales con policy distinta — **marca fuera de alcance mínimo** si no es necesario.

---

## 4. VALIDACIÓN (FORM REQUESTS)

### 4.1 `StoreExpenseRequest` / `UpdateExpenseRequest`

- `category_id`: `required|exists:expense_categories,id` + regla **custom**: categoría pertenece a `auth()->user()->company_id`.
- `amount`: `required|numeric|min:0.01` (o `min:0` si permiten cero — no recomendado).
- `description`: `required|string|max:500` (ajustar).
- `expense_date`: `required|date|before_or_equal:today` **o** permitir fechas futuras si negocio lo pide — **default:** `before_or_equal:today` + `after:2000-01-01`.
- `notes`: opcional.
- `receipt`: en **store** `required` o `optional` según negocio — **recomendado obligatorio** en alta: `required|file|mimes:pdf,jpg,jpeg,png,webp|max:10240` (10MB, ajustar).
- En **update**, `sometimes` + mismo MIME.

### 4.2 Categorías

- `name`: `required|string|max:120` + único por empresa.

---

## 5. SERVICIO DE SUBIDA

- Reutilizar **`ObjectStorageInterface`** / `FirebaseStorageService` (o `LocalPublicObjectStorage` según env).
- Path sugerido: `companies/{company_id}/expenses/{expense_id or uuid}/{filename}`.
- Tras crear `Expense`, si se usa UUID temporal en path antes del id, flujo: crear registro con `receipt_path` null → subir → actualizar path; **o** generar `uuid` en servidor antes de insert.

Al **actualizar** comprobante: borrar objeto anterior si era de Firebase/local según política del proyecto.

---

## 6. CONTROLADORES Y RUTAS

### 6.1 `ExpenseCategoryController`

- Resource estándar bajo middleware `auth` + `company` + permisos por acción.
- Rutas agrupadas: `Route::resource('expense-categories', ...)` prefijo sugerido `/expense-categories` o `/expenses/categories` — **elegir una convención** y ser consistente con Ziggy.

### 6.2 `ExpenseController`

- `index` con filtros: `category_id`, rango `expense_date`, búsqueda texto en `description`, paginación.
- `create` / `store` / `edit` / `update` / `destroy` (soft delete).
- `show` opcional con URL firmada para ver/descargar PDF si bucket privado — **o** URL pública si política actual lo permite.

### 6.3 Registro en `routes/web.php`

Dentro del grupo **autenticado** y **EnsureUserBelongsToCompany** (o equivalente), **no** bajo prefijo super admin.

---

## 7. FRONTEND (INERTIA + REACT + TYPESCRIPT)

### 7.1 Layout y menú

- Entrada en sidebar: **“Gastos”** con submenú o ícono único:
  - **Listado de gastos**
  - **Categorías** (visible según `expenses.categories.view`)
- Construcción **dinámica** desde `accessible_pages` / `effective_permissions` como el resto de la app.

### 7.2 Páginas

| Archivo | Contenido |
|---------|-----------|
| `Expenses/Categories/Index.tsx` | Tabla, buscar, activo/inactivo, acciones |
| `Expenses/Categories/Create.tsx` | Formulario simple |
| `Expenses/Categories/Edit.tsx` | Ídem |
| `Expenses/Index.tsx` | Tabla: fecha gasto, fecha registro, categoría, monto, descripción, comprobante (badge / link), acciones |
| `Expenses/Create.tsx` | Form: categoría (select empresa), monto, descripción, **expense_date** datepicker, **receipt** file input drag-drop, notas |
| `Expenses/Edit.tsx` | Ídem + mostrar comprobante actual + “Reemplazar archivo” |
| `Expenses/Show.tsx` (opcional) | Detalle + vista previa imagen / enlace PDF |

### 7.3 Componentes

- Reutilizar `Input`, `Select`, `Button`, `Can` / `usePermissions`.
- Mostrar montos con `formatCurrency`.
- **Etiquetas claras:** “Fecha del gasto” vs “Registrado el” (`created_at`).

### 7.4 UX

- Toast al guardar error de validación de archivo.
- Confirmación antes de eliminar gasto o categoría con gastos asociados: **bloquear delete** de categoría si `expenses()->exists()` — devolver error con mensaje **o** soft cascade (no recomendado).

---

## 8. POLÍTICAS (POLICIES)

- `ExpensePolicy` / `ExpenseCategoryPolicy`: `viewAny`, `view`, `create`, `update`, `delete` delegando en `hasEffectivePermission` del proyecto.
- Comprobar `model->company_id === user->company_id` en cada acción.

---

## 9. FACTORIES / SEED (OPCIONAL)

- `ExpenseCategoryFactory`, `ExpenseFactory` para tests.
- `DemoDataSeeder`: 4–6 categorías y algunos gastos de ejemplo **solo empresa demo** — no romper si seed se ejecuta varias veces (idempotente).

---

## 10. INFORMES (FUERA DE ALCANCE MÍNIMO)

- Export Excel/PDF de gastos: **opcional v2**; si se añade permiso `expenses.index.export`, usar patrón existente del proyecto.

---

## 11. CHECKLIST ANTI-CONFLICTOS

- [ ] Todas las queries usan scope de empresa; **nunca** filtrar solo por `id` sin `company_id`.
- [ ] No reutilizar nombres de tabla/clase existentes (`expenses` puede chocar si ya existe — si el proyecto tiene otra tabla `expenses`, renombrar a `company_expenses` / `operational_expenses`). **Opus debe verificar con grep antes de migrar.**
- [ ] Rutas sin colisión con `Route::resource` existente.
- [ ] Upload solo MIME permitidos; escaneo de tamaño.
- [ ] Permisos añadidos al seeder `RolesPermissionsSeeder` sin borrar permisos previos.
- [ ] `npm run build` y `php artisan migrate` OK.

---

## 12. ORDEN DE IMPLEMENTACIÓN SUGERIDO

1. Verificar nombre de tablas en proyecto → elegir `expense_categories` + `company_expenses` si `expenses` está ocupado.
2. Migraciones + modelos + scopes + relaciones.
3. Permisos en `PermissionHelper` + seeder de rol Contador (opcional).
4. Policies + Requests + `ExpenseCategoryController` + `ExpenseController`.
5. Rutas + menú sidebar.
6. Páginas React + integración storage.
7. Pruebas manuales checklist + demo seed.

---

## 13. INSTRUCCIÓN FINAL PARA CLAUDE OPUS

Implementación **completa**, sin `TODO`. Si detectas tabla `expenses` ya usada para otra cosa, **renombra** este módulo a `company_expenses` (o nombre acordado) y actualiza todo el código de forma consistente.

Al cerrar, lista **archivos creados/modificados** y:

```bash
php artisan migrate
php artisan db:seed   # si aplica demo
npm run build
```

---

*Documento: Módulo control de gastos + categorías — Multiempresa — Mayo 2026*
