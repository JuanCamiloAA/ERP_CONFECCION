# AJUSTE GLOBAL — Super admin: vista consolidada + selector de empresa en navbar
## Prompt completo para Claude Opus — Sin romper módulos ni flujos existentes

---

> **USO:** Pega este documento completo en Claude Opus. El proyecto ya tiene **multiempresa** (`company_id`), **`CompanyScope`** u otro filtrado por empresa, rol **`super_admin`**, Inertia, navbar, dashboard y demás módulos. Este cambio debe ser **incremental**: los usuarios **no** super admin **no** deben verse afectados. Ningún comportamiento actual de admin de empresa debe degradarse.

---

## 0. OBJETIVO DE PRODUCTO

1. **`super_admin`** al iniciar sesión ve la aplicación en modo **global / consolidado**: dashboards e índices muestran **información agregada de todas las empresas** (totales, listas combinadas con columna “Empresa”, KPIs multi-tenant, etc.) según lo viable por módulo.

2. En la **parte superior del navbar** (área visible en todo el panel autenticado), el `super_admin` dispone de un **selector de empresa**:
   - Opción explícita **“Todas las empresas”** (vista consolidada).
   - Lista de **empresas activas** (y opcional todas, según política) para filtrar.

3. Al seleccionar **una empresa concreta**, **todo el contexto de datos** del panel pasa a comportarse como si el usuario trabajara **solo con esa empresa**: mismos módulos y rutas, pero queries y métricas **acotadas** a `company_id = seleccionada`.

4. Cambiar de empresa **solo con el selector**, sin reloguear. La elección debe **persistir** en sesión (y opcionalmente en BD por usuario) hasta que el `super_admin` cambie a otra empresa o a “Todas”.

**Fuera de alcance mínimo:** impersonar usuario de empresa; solo filtrar datos por empresa seleccionada.

---

## 1. ESTADO DE SESIÓN Y DATOS COMPARTIDOS (INERTIA)

### 1.1 Clave de sesión

Definir **una sola** clave, ejemplo:

```php
session('super_admin_active_company_id')
```

- **`null`** → modo **consolidado** (“Todas las empresas”).
- **Entero** → ID de empresa activa para filtrado.

**No** reutilizar la misma variable que `company_id` del modelo `User` del super_admin (suele ser `null`). Evitar colisión con cookies de “empresa activa” de otros roles.

### 1.2 `HandleInertiaRequests` (o middleware equivalente)

Compartir siempre con el front:

```text
activeCompanyId: number | null   // null = todas
activeCompany: { id, name } | null
companiesForSelector: { id, name, is_active }[]   // lista para el dropdown
isSuperAdmin: boolean
isConsolidatedView: boolean   // activeCompanyId === null && isSuperAdmin
```

**Política de lista:** cargar empresas que el super admin pueda gestionar (normalmente todas; filtrar `is_active` si el producto lo requiere).

### 1.3 Ruta dedicada (solo super admin)

| Método | Ruta | Acción |
|--------|------|--------|
| POST | `/super-admin/active-company` | Body: `company_id: null \| int`. Validar existencia si no null. Guardar en sesión. Redirect back o Inertia `location` reload. |

Middleware: `EnsureSuperAdmin`. CSRF + throttle ligero.

---

## 2. NAVBAR / LAYOUT

- Componente nuevo **`SuperAdminCompanySwitcher.tsx`** (nombre ajustable):
  - Visible **solo** si `isSuperAdmin`.
  - Select / Listbox (Headless UI) en la **barra superior**, alineado a la derecha o junto al logo según diseño actual **sin romper** responsive.
  - Valor actual = `activeCompanyId`; opción “Todas las empresas” = `null`.
  - Al cambiar: `router.post('/super-admin/active-company', { company_id: value })` y **`preserveScroll` false** o recargar página para refrescar props globales.

- Asegurar que el switcher aparezca en **`AppLayout`** (y **SuperAdminLayout** si existe duplicado) para que aplique a **todos** los módulos accesibles por super admin.

---

## 3. RESOLUCIÓN DE “EMPRESA EFECTIVA” EN BACKEND

Crear helper central, ejemplo:

```php
// app/Support/EffectiveCompany.php o App\Services\TenantContext
class TenantContext {
    public static function companyId(?User $user = null): ?int
    public static function isConsolidatedSuperAdmin(?User $user = null): bool
}
```

**Reglas:**

| Usuario | `session('super_admin_active_company_id')` | Empresa efectiva para queries |
|---------|--------------------------------------------|--------------------------------|
| No super admin | — | Siempre `$user->company_id` (comportamiento actual) |
| Super admin | `null` | **Consolidado** (no una sola empresa) |
| Super admin | `123` | `123` |

**Importante:** Ningún código de admin empresa debe llamar a este helper de forma que cambie su `company_id`; solo ramas `if ($user->hasRole('super_admin'))`.

---

## 4. COMPANYSCOPE Y MODELOS (SIN ROMPER NADA)

### 4.1 Opción recomendada — Scope condicional

Modificar **`CompanyScope`** (o crear `ConfigurableCompanyScope`) para que **aplique** `where('company_id', X)` cuando:

- Usuario **no** es super admin → `X = user.company_id`.
- Super admin con empresa seleccionada → `X = session(...)`.
- Super admin en **consolidado** → **no añadir** la cláusula `company_id` en el scope **O** desactivar el scope para esa petición.

**Implementación segura:** En el `Scope::apply`, si `TenantContext::isConsolidatedSuperAdmin()`, **return** sin modificar el builder (permite agregados globales). **Riesgo:** olvidos exponen datos; mitigar con **policies** en `viewAny` y revisión por módulo.

**Alternativa más segura:** No usar scope global en modo consolidado para modelos sensibles; en cada controlador:

```php
if (TenantContext::isConsolidatedSuperAdmin()) {
    $query = Model::query()->withoutGlobalScope(CompanyScope::class);
} else {
    $query = Model::query();
}
```

Opus debe **elegir una estrategia** y aplicarla **de forma uniforme** en `BaseController` o traits `HandlesTenantQueries`.

### 4.2 Registros nuevos (store)

- **Super admin consolidado:** **no permitir** crear gastos, empleados, producción, etc. sin empresa → respuesta **422** con mensaje: *“Seleccione una empresa en la parte superior para registrar datos.”*
- **Super admin con empresa elegida:** forzar `company_id = activeCompanyId` en `fill`/merge del request **aunque** el cliente envíe otro valor (ignorar input malicioso).

---

## 5. COMPORTAMIENTO POR TIPO DE PANTALLA

### 5.1 Dashboard

- **Consolidado:** tarjetas con totales globales (empresas activas, empleados total, producción mes sumada, nóminas pendientes sumadas, etc.) y/o gráfica multi-serie por empresa.
- **Empresa seleccionada:** **reutilizar** el mismo componente de dashboard que usa el admin de empresa con props ya filtradas — ideal para no duplicar UI.

### 5.2 Listados (index): empleados, producción, referencias, gastos, usuarios staff, etc.

- **Consolidado:** tabla con columna **Empresa** (nombre), filtros extra opcionales por `company_id`, paginación correcta — queries con `withoutGlobalScope` + `when($request->company_id, ...)`.
- **Empresa seleccionada:** idéntico al listado actual de admin empresa (sin columna redundante o con badge fijo).

### 5.3 Informes y exportaciones

- Misma lógica: consolidado = agregados o series múltiples; empresa = filtro único.

### 5.4 Módulos solo super admin (CSV import, landing, membership plans)

- **No** requieren selector para funcionar salvo que el prompt original dijera “empresa para seed” — mantener como están.
- Si algún flujo necesita `company_id`, usar **empresa seleccionada** o selector propio del formulario, documentado.

---

## 6. AUTORIZACIÓN (POLICIES)

- Donde hoy se comprueba `$user->company_id === $model->company_id`, añadir rama:

```php
if ($user->hasRole('super_admin')) {
    if (TenantContext::isConsolidatedSuperAdmin()) {
        return true; // o según acción: solo view en consolidado
    }
    return $model->company_id === TenantContext::companyId($user);
}
```

- **Eliminar** o **restringir** destroy/update en consolidado si cruza empresas — definir: en consolidado, **solo lectura** para recursos operativos **recomendado**; altas/bajas solo con empresa seleccionada. Documentar en UI (deshabilitar botones “Crear” si `isConsolidatedView`).

---

## 7. FRONTEND — PERMISOS Y `usePermissions`

- No cambiar catálogo de permisos.
- Componente `<Can>` sigue igual; añadir props opcionales `disabled={isConsolidatedView && !allowInConsolidated}` solo donde aplique, **sin** romper admin empresa (`isConsolidatedView` false para ellos).

---

## 8. EDGE CASES

1. **Super admin pierde sesión / expira:** al reloguear, restablecer `active_company_id` a `null` (consolidado) **o** persistir en tabla `user_preferences` — elegir y documentar.
2. **Empresa desactivada** mientras está seleccionada: al cargar layout, si ID inválido o inactivo → reset a `null` + flash warning.
3. **Rutas API** si existen: mismas reglas de `TenantContext`.
4. **Jobs en cola:** pasar `company_id` en payload; jobs no deben depender solo de sesión. Fuera de alcance si no hay jobs multi-tenant críticos.

---

## 9. PRUEBAS MANUALES (CHECKLIST)

- [ ] Admin empresa: sin selector, datos solo de su empresa (sin cambios).
- [ ] Super admin: default consolidado; dashboard muestra totales multi-empresa.
- [ ] Super admin: elige empresa A → listados solo A; crear registro asigna `company_id` A.
- [ ] Super admin: vuelve a “Todas” → listados consolidados de nuevo.
- [ ] No filtrar datos de empresa B cuando está seleccionada A (prueba manual en 2 registros).
- [ ] `npm run build` y test de regresión en login admin empresa.

---

## 10. ORDEN DE IMPLEMENTACIÓN SUGERIDO

1. `TenantContext` + ruta POST `active-company` + sesión.
2. Compartir props en `HandleInertiaRequests`.
3. `SuperAdminCompanySwitcher` en layout(s).
4. Refactor `CompanyScope` **o** trait de queries + revisión **módulo por módulo** (dashboard primero).
5. Ajustar policies + disable create en consolidado donde proceda.
6. Pruebas checklist.

---

## 11. INSTRUCCIÓN FINAL PARA CLAUDE OPUS

- **No** eliminar `CompanyScope` sin reemplazo; **no** exponer datos cruzados por error.
- **No** cambiar `company_id` en la fila del `User` del super_admin.
- Priorizar **claridad** en listados consolidados (columna empresa siempre visible).
- Si un módulo es demasiado complejo para vista consolidada en v1, mostrar mensaje amable *“Seleccione una empresa para ver este módulo en detalle”* y enlace al selector — solo como último recurso.

Al cerrar, entregar **lista de archivos modificados** y comandos:

```bash
php artisan migrate   # solo si añades user_preferences para persistir selector
npm run build
```

---

*Documento: Super admin — selector empresa + vista consolidada — Mayo 2026*
