# MEJORA INTEGRAL — Dashboard por rol (Super Admin · Admin empresa · Empleado)
## Prompt completo para Claude Opus — Implementación incremental sin romper módulos existentes

---

> **USO:** Pega este documento completo en Claude Opus. El proyecto es **MiTallerPro** (multiempresa, `company_id`, `super_admin`, administrador de empresa, empleado-usuario, producción por operaciones y/o salario diario, nómina con estados `borrador` / `calculado` / `aprobado` / `pagado`, anticipos, membresías por empresa `membership_plan_id` + `membership_ends_at` o equivalente, selector de empresa para super admin si ya existe, `EffectivePermission`/roles, **Recharts** u otra lib ya en proyecto). Este prompt **solo** define la **lógica y UI del dashboard**; no eliminar otros módulos.

---

## 0. OBJETIVO GENERAL

Implementar **tres dashboards** (o **un solo** componente adaptativo por rol) optimizados así:

| Rol principal | Información principal | Restrictions |
|---------------|-----------------------|--------------|
| **Super Admin** | Visión **operativa/general** global: métricas de **cantidades** y **membresías**. **Sin** exponer montos financieros por empresa ni P&amp;L. | Consolidado y/o filtrado por empresa según selector de sesión (si existe). |
| **Admin de empresa** | Operación propia de la empresa selecionada: producción pendiente de pago, nómina en estados relevantes, número de empleados, **gráficos de productividad por empleado**. | Solo `company_id` del usuario. |
| **Empleado** (usuario vinculado a `employee_id`) | Unidades producidas pendientes de pago, anticipos pendientes de descontar, **gráfico histórico de nóminas pagadas**. | Solo datos propios; respeta filtros backend existentes. |

**Reglas transversales**

- Todas las cifras y series deben resolverse en **servidor** (`DashboardStatsService` o similar) para evitar inconsistencias y fugas entre empresas.
- **Caching** opcional (`Cache::remember` 60–300 s por clave `dashboard.{role}.{company_id?}.{user_id?}`).

---

## 1. SUPER ADMIN — DEFINICIÓN DE DATOS (“SIN FINANZAS DETALLADAS”)

### 1.1 Métricas obligatorias (tarjetas / KPI cards)

Cuando vista **todas las empresas** (consolidado):

1. **`companies_active_count`** — empresas con `is_active = true`.
2. **`companies_total_count`** — total registros empresa (opcional segunda tarjeta o tooltip).
3. **`employees_active_count`** — suma empleados `is_active` **de todas las empresas** (respecto scopes).
4. **`users_staff_count`** — usuarios aplicación tipo **staff** (excluir `employee_id` no nulo si esa es la convención del proyecto) **global** — o desglose opcional solo si no viola política “sin financiero”.
5. **`users_linked_employee_count`** (opcional) — solo conteo, ayuda soporte **sin montos**.

**Explicitamente prohibido en dashboard super admin:** totales monetarios consolidados (`$ producido global`, `$ nómina global`), lista de montos por empresa en tarjetas. Si se muestra tabla por empresa que sea solo: nombre, estado, **fechas membresía**, conteos opcionales (empleados usuarios ya es agregado fino pero permitido).

### 1.2 Membresías — próximos vencimientos

Lista o tabla “**Empresas y membresía**” con columnas:

- Nombre empresa, NIT (opcional)
- **Plan actual** (`membership_plans.name`)
- **`membership_ends_at`** (o fecha fin suscripción definida en el proyecto).
- Badge: **Crítico** (<7 días), **Advertencia** (&lt;30 días), **OK**.
- Estado `is_active` empresa.

Sin importes de factura en vista por defecto (si existe `price_monthly` en plan puede mostrarse solo como texto informativo, no obligatorio).

### 1.3 Si existe **selector empresa** en navbar (sesión super admin)

- **Modo empresa seleccionada:** las mismas KPIs pueden **opcionalmente** repetir vista “mini” empresa (empleados usuarios esa empresa solamente). **Opcional v2.** Lo mínimo es que las tarjetas principales cambien cuando filtras; documentar comportamiento único recomendado: **solo tablas/memership list se filtran**; KPI globales pueden permanecer o cambiar según UX — **implementar opción más clara:** En consolidado muestra KPI global; en empresa muestra KPI de esa empresa (conteos) **still without dollar totals** si política fuerte; permite mostrar métricas no monetarias empresa (ej: empleados de esa empresa).

---

## 2. ADMIN EMPRESA — DEFINICIÓN DE DATOS

Contexto siempre **`auth()->user()->company_id`** (no super admin sin selección empresa salvo impersonación fuera alcance).

### 2.1 Tarjetas (StatCards)

1. **“Producido pendiente de pago”**  
   - Definición operativa (**documentar en comentarios PHP** una sola línea fuente de verdad):  
     - Producciones (**por operaciones**) en el período “abierto” o **no incluidas aún en nómina `pagado`** hasta la fecha efectiva más reciente cerrada — **implementación recomendada:**  
       - Sumar líneas `productions` donde el empleado tenga período pendiente OR  
       - Mejor: **sumatorio de `total_value`** de producciones cuya liquidación está en nómina **solo hasta `calculado`/`aprobado`/borrador pendiente**, excluir las ya contenidas en nómina `pagado`.  
     - Para empleados **solo salario diario:** producido monetario puede ser **0** o suma de valor jornadas no cerradas — alinear negocio: si solo operaciones llevan `$` directo aquí; jornadas ya suman en nómina. **Opción práctica:** “Pendiente de pago” = producción agrupada excluye filas incluidas en `payrolls` con `status in (pagado)` para ese empleado o global empresa. Implementar método `OutstandingProductionSummary::forCompany`.

2. **“Nómina en calculado”**  
   - Conteo de nóminas `status = calculado` (y opcional lista mini con nombre período).

3. **“Nómina en aprobada”**  
   - Conteo de nóminas `status = aprobado`.

4. **“Empleados activos”**  
   - Conteo emppleados activos empresa.

 Opcional segunda fila:

5. Pendiente número de **`payrolls` pendientes de pago** (solo conteo si no es “finanza sensible” empresa — aquí sí es admin empresa, **se pueden** opcional montos en subdetalle pero **solo para admin**, no repetir esa info en tarjeta inicial si molesta UX; mínimos es conteos + link a módulo nómina).

### 2.2 Gráfico — Productividad por empleado

- **Tipo:** BarChart horizontal o vertical (Recharts).
- **Eje:** empleado (nombre corto).
- **Eje valor:** **`sum(quantity)`** de producciones en período configurable **últimos 30 días** (default).
- Tooltip: también `sum(total_value)` opcional (**admin empresa puede ver dinero**) — establecer en código.
- Filtros UI: período rápido 7/30/90 días ; botón aplicar.

### 2.3 Tablas compactas opcionales

- Últimas 5 producciones registradas.
- Últimas 5 nóminas con estado.

---

## 3. EMPLEADO — DEFINICIÓN DE DATOS

Usuario debe tener `employee_id` y filtros aplicados como ya exige código.

### 3.1 Tarjetas

1. **“Unidades producidas pendientes por pagar”**  
   - Suma **`quantity`** donde la producción aún **no** esté contemplada en una nómina con estado **`pagado`** (misma definición granular que punto 2.1 pero filtro `employee_id = auth`).
   - Mostrar también **valor estimado opcional** (admin ve en otro lado; empleado: negocio decide — **prompt recomienda** mostrar solo **unidades** en KPI principal para paridad salarial con operaciones-only; valor abajo texto pequeño o tooltip).

2. **“Anticipos pendientes por descontar”**  
   - Desde modelo `Advance` campo `status = pendiente`, sum **`amount`** pendiente para `employee_id` y **lista max 5** próximos.
   - Texto aclaratorio: *“Por cobrar/descontar en próxima nómina”* según copy existente.

### 3.2 Gráfico — Historial de nóminas **pagadas** al empleado

- **Tipo:** línea o barra (preferencia línea tiempo).
- **Eje X:** fecha fin período (`payrolls.period_end`) o fecha `paid_at`.
- **Eje Y:** **`net_payment`** del renglon `payroll_employees` de ese empleado don de `payroll.status == pagado` y `payrollEmployee.is_paid` según modelo real.
- Rango últimos **12 períodos** o 6 meses.
- Si no hay histórico, empty state elegante.

### 3.3 Seguridad

- Ningún query admite otros `employee_id`.
- Producción combinada modo operaciones vs diario sólo muestra lo aplicable (`payroll_mode`).

---

## 4. IMPLEMENTACIÓN BACKEND

### 4.1 Servicio `DashboardService` (central)

Métodos sugeridos:

```php
getSuperAdminStats(?int $focusedCompanyId = null): array
getCompanyAdminStats(Company $company): array  
getEmployeeStats(Employee $employee): array  
```

Delegar helpers privados (`countActiveCompanies`, …) en el mismo archivo o clases específicas bajo `app/Services/Dashboard/`.

### 4.2 Controlador único conservando ruta `/dashboard`

- `DashboardController@index`:
  ```php
  if ($user->hasRole('super_admin')) {
     $focused = session('super_admin_active_company_id');
     return Inertia::render('Dashboard/Index', [
        'variant' => 'super_admin',
        'stats' => $service->getSuperAdminStats($focused),
     ]);
  }
  if ($user->employee_id) {
     ...
  }
  // default company admin
  ```

### 4.3 Coherencia con **selector empresa** super admin

- Si `$focusedCompanyId` no null **y super admin**, bloque empresa puede cargar segunda columna KPI **solo empresa** opcional manteniendo sección membresías **global siempre visible** debajo vs filtrando lista — recomendado UI: **filtro tabla membresías** por empresa cuando hay foco.

### 4.4 Consultas eficientes

- Usar `selectRaw/count/sum/subqueryExists` donde haga falta; evitar cargar colecciones completas sin `take()`.
- Para “producido pendiente pago”: considerar tabla intermedia payroll_production pivots si el proyecto relaciona líneas prod↔liquidación — **implementar compatibilidad** con modelo actual revisando modelo `Production`/`Payroll`; si no existe vínculo, **definición v1 pragmática:**  
  Producción “pendiente” = creada en fechas después del último período cerrado pagado globalempresa … **solo si** no hay mejor regla → Opus debe leer codebase y usar la definición más fiable disponible (**documentada en comentario**).

---

## 5. IMPLEMENTACIÓN FRONTEND (`resources/js/Pages/Dashboard/Index.tsx`)

- Patrón: `switch (variant)` renderiza **`SuperAdminOverview`**, **`CompanyAdminOverview`**, **`EmployeeOverview`**.
- Reutilizar `StatCard` existente si hay.
- Skeleton loading mientras carga.
- Responsive móvil: gráficas `ResponsiveContainer`.

### Copy en español

- Todos los titulos etiquetas en español coherente con app.

---

## 6. PERMISOS

- Sin nuevos si `dashboard.view` existe; rutas igual.
- Empleados con rol muy restringido: **aseguran** tener acceso `/dashboard`; si antes redirige a producción sólo verificar rutas después del cambio no rompan.

---

## 7. SEMILLAS / TEST VISUAL

- Datos demo con producciones, nóminas en varios estados, anticipos pendientes y líneas pagadas en nómina de empleados para validar gráficos.

---

## 8. REGRESIONES A EVITAR

- [ ] Usuario empresa común jamás ve KPI otra empresa  
- [ ] Super admin no debe ver totales financieros sensibles consolidados globales inadvertidamente fuera del alcance político anterior  
- [ ] Empleado sin `employee_id` cae en vista admin empresa o vista vacía bien manejado  
- [ ] build front sin erro TS

---

## 9. ORDEN DE IMPLEMENTACIÓN

1. Definir en código una **única función** (“producción no liquidada como pagada”) alineada con tablas existentes (`productions`, `payrolls`, `payroll_employees`).
2. Implementar métodos del `DashboardService` con pruebas manuales sobre datos demo.
3. Ramificar `DashboardController@index` por rol y variante Inertia.
4. Componentes React por variante + gráficas Recharts.
5. Pulir tabla membresías + badges para super admin.
6. Opcional: caches con invalidación tras eventos pesados (fuera de alcance si no hay eventos/listeners previos).

---

## 10. INSTRUCCIÓN FINAL PARA CLAUDE OPUS

Implementación **completa**, sin `TODO`. Lista **archivos modificados** al cerrar.

```bash
php artisan route:clear
php artisan config:clear
npm run build
```

---

*Documento: Dashboard por rol — Super Admin · Admin empresa · Empleado — Mayo 2026*
