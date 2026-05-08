# AJUSTE AL SISTEMA DE TALLER — Nómina dual: por operaciones + salario diario (jornada)
## Prompt para Claude Opus — Implementación incremental sin romper lo existente

---

> **USA ESTE DOCUMENTO ASÍ:**
> 1. Ya tienes el proyecto generado según `PROMPT_TALLER_CONFECCION.md` (o equivalente).
> 2. Pega **todo este prompt** en Claude Opus en una sesión dedicada.
> 3. El modelo debe aplicar **solo los cambios descritos aquí**, preservando comportamiento actual de producción por operaciones y nómina asociada.

---

## CONTEXTO Y OBJETIVO

El negocio maneja **dos modalidades de pago de nómina**:

| Modalidad | Comportamiento actual | Acción requerida |
|-----------|------------------------|------------------|
| **Por operaciones** | Producción: referencia + operación + cantidad × precio. Nómina suma ese valor. | **No romper.** Mantener flujo, cálculos, reportes y pantallas actuales. |
| **Por salario fijo diario** | No existía de forma explícita. | **Agregar:** dato maestro en empleado, registro de jornada (inicio/fin), validación y edición de tiempo por el administrador al liquidar nómina, y cálculo según salario diario y días/tiempo laborado validado. |

**Regla de oro:** Un empleado tiene **una** modalidad (`payroll_mode`). Los empleados `operations` no generan devengo por jornada; los `fixed_daily` no generan devengo por filas de producción (pero pueden seguir teniendo permisos de pantalla de producción solo para **iniciar/cerrar jornada** si así se define).

---

## 1. MODELO DE DATOS (EXTENSIONES)

### 1.1 Tabla `employees` — nuevos campos

Añadir mediante migración incremental (no reescribir migraciones históricas ya ejecutadas en producción):

```sql
payroll_mode ENUM o string: 'operations' | 'fixed_daily'  -- default 'operations'
daily_salary DECIMAL(12,2) NULLABLE   -- salario por día laborado (COP u moneda empresa)
                                        -- obligatorio cuando payroll_mode = 'fixed_daily'
minutes_per_full_workday INT NOT NULL DEFAULT 480  -- 8h por defecto; editable por empresa en settings si ya existe patrón similar
```

**Semántica:**

- `payroll_mode = 'operations'`: usar solo la lógica actual (`productions` + precios). `daily_salary` debe ser `NULL` (o ignorado).
- `payroll_mode = 'fixed_daily'`: el devengo del período se basa en **tiempo laborado validado** × `daily_salary` según las reglas de la sección 4. **No** sumar `productions` para el cálculo de nómina de este empleado.

**Compatibilidad:** Empleados existentes: migración con `UPDATE employees SET payroll_mode = 'operations'` para todos los registros actuales.

---

### 1.2 Nueva tabla `work_day_sessions` (jornadas)

Cada fila = una jornada laboral de un empleado en una fecha concreta (empresa multi-tenant).

```sql
id
company_id (FK companies)
employee_id (FK employees)
work_date DATE NOT NULL        -- día calendario de la jornada (zona horaria app: America/Bogota)
clock_in_at DATETIME NOT NULL  -- marcas de tiempo locales o UTC consistente con el resto del proyecto
clock_out_at DATETIME NULLABLE -- NULL = jornada abierta
duration_minutes INT NULLABLE  -- calculado al cerrar; recalculable si admin edita horas
status ENUM: 'open' | 'closed' | 'adjusted'  -- adjusted = tocado por admin post cierre
source ENUM: 'employee' | 'admin'  -- quién abrió la jornada (empleado desde UI vs admin creación manual)
notes TEXT NULLABLE
created_by_user_id NULLABLE (FK users)
closed_by_user_id NULLABLE (FK users)
adjusted_by_user_id NULLABLE (FK users)
adjusted_at DATETIME NULLABLE
timestamps
softDeletes opcional: NO eliminar físicamente por defecto; preferir status o borrado lógico solo si encaja con el resto del sistema

INDEXES: (company_id, employee_id, work_date), (company_id, work_date)
UNIQUE sugerido: **UN solo `open` por empleado por `work_date`** — implementar con validación en servicio + constraint parcial si la BD lo permite; si no, índice único parcial en PostgreSQL o lógica en `WorkDaySessionService`.
```

---

### 1.3 Tabla `payroll_employees` — campos adicionales

Sin eliminar columnas existentes.

**Recomendación mínima (compatibilidad):**

- Mantener la columna existente `production_total` como **subtotal solo por operaciones** (empleados `payroll_mode = 'operations'`). Para empleados `fixed_daily`, dejar este campo en **0** al calcular nómina.
- Añadir únicamente:

```sql
daily_work_subtotal DECIMAL(12,2) NOT NULL DEFAULT 0
  -- devengo por salario diario en el período (empleados fixed_daily)

validated_work_days JSON NULLABLE
  -- snapshot / auditoría por liquidación, ej.:
  -- [{ "work_date": "...", "session_id": 12, "clock_in_at": "...", "clock_out_at": "...",
  --     "duration_minutes": 510, "daily_salary_applied": 50000, "day_earnings": 53125 }, ...]
```

El **bruto** del empleado antes de deducciones debe ser: `production_total + daily_work_subtotal` (uno de los dos será 0 según `payroll_mode`).

---

### 1.4 Tabla `payrolls` (opcional)

Si se desea trazabilidad por tipo de nómina mixta en un mismo documento:

```sql
payroll_compensation_scope ENUM: 'mixed' | 'operations_only' | 'daily_only' NULLABLE default 'mixed'
```

Opcional: puede quedarse en `mixed` siempre: el cálculo por empleado depende de `employee.payroll_mode`.

---

## 2. REGLAS DE NEGOCIO — Jornada (empleado)

### 2.1 Inicio y cierre de jornada

- Solo empleados con `payroll_mode = 'fixed_daily'` pueden iniciar/cerrar jornada (validación backend **obligatoria**).
- **Punto de entrada UI solicitado:** en la pantalla **Producción → crear registro** (`productions/create` o equivalente), añadir un bloque fijo arriba del formulario:
  - Título: **“Jornada laboral de hoy”**
  - Si el usuario logueado es empleado vinculado: mostrar su propio estado.
  - Si quien carga la página es admin/supervisor: selector de empleado (solo empleados `fixed_daily` de la empresa) para operar en nombre del operario **solo si el permiso lo permite** (nuevo permiso recomendado: `productions.create.start_session_others` o reutilizar `productions.create` con sub-acción).
- Botones:
  - **Iniciar jornada:** crea `work_day_sessions` con `work_date = hoy (local)`, `clock_in_at = now`, `status = open`, `source = employee` o `admin`.
  - **Cerrar jornada:** actualiza el registro abierto del día: `clock_out_at = now`, calcula `duration_minutes`, `status = closed`.
- No permitir dos jornadas **abiertas** el mismo día para el mismo empleado.
- No permitir **iniciar** si ya existe una jornada **cerrada** ese día (salvo que negocio pida “reapertura”: fuera de alcance; admin puede usar ajuste en nómina).

### 2.2 Empleados `operations`

- El bloque de jornada **no aparece** o aparece deshabilitado con mensaje: “Tu modalidad de pago es por operaciones”.
- El formulario de producción sigue **idéntico** al actual.

---

## 3. BACKEND — CAPA DE SERVICIOS Y CONTROLADORES

### 3.1 `WorkDaySessionService`

Métodos sugeridos (implementación completa, con transacciones):

- `startSession(Company $company, Employee $employee, ?User $actor): WorkDaySession`
- `closeSession(WorkDaySession $session, ?User $actor): WorkDaySession`
- `getTodayOpenSession(Employee $employee): ?WorkDaySession`
- `calculateDurationMinutes(Carbon $in, Carbon $out): int`

Validaciones:

- Empleado activo y `payroll_mode === 'fixed_daily'`.
- `clock_out > clock_in`.
- Opcional: alerta si `duration_minutes > 720` (12h) — no bloquear, solo flag en UI.

### 3.2 Extender `PayrollCalculationService` (o el servicio que ya exista)

**Sin eliminar** la rama actual para operaciones.

Pseudología obligatoria:

```
foreach empleado en empresa para el período de la nómina:
  if empleado.payroll_mode == 'operations':
    production_total = sum(productions en período)   # comportamiento actual
    daily_work_subtotal = 0
    validated_work_days = null o []

  if empleado.payroll_mode == 'fixed_daily':
    production_total = 0   # o mantener producción en BD pero excluir del gross
    sessions = work_day_sessions donde work_date entre period_start y period_end
              y status in ('closed','adjusted')
    Por cada día: day_earnings = daily_salary * (duration_minutes / minutes_per_full_workday)
    daily_work_subtotal = sum(day_earnings)
    validated_work_days = arreglo detalle (ver JSON arriba)
```

**Tope de día:** si `duration_minutes >= minutes_per_full_workday`, considerar día completo = `daily_salary` (evitar pagar >1 día por un solo día calendario). Documentar en código.

**Redondeo:** usar `round()` a 2 decimales al final por línea de día o al subtotal — documentar y ser consistente.

**Anticipos / deducciones / additions:** aplicar **después** de obtener `gross` empleado:

`gross = production_total + daily_work_subtotal` (para empleados mixed en futuro, hoy solo uno de los dos es >0).

### 3.3 Endpoints / acciones nuevas (web + Inertia)

- `POST /work-day-sessions/start` — body: `employee_id` (opcional si es el propio empleado)
- `POST /work-day-sessions/{session}/close`
- `GET /work-day-sessions/today` — estado para el banner en producción
- En `PayrollController@calculate` y/o método dedicado: aceptar payload opcional con **ajustes admin** antes de grabar:

```json
{
  "employee_adjustments": [
    {
      "employee_id": 1,
      "sessions": [
        { "session_id": 12, "clock_in_at": "...","clock_out_at": "...","duration_minutes": 300, "reason": "..." }
      ]
    }
  ]
}
```

Al guardar liquidación:

- Persistir cambios en `work_day_sessions` marcando `status = adjusted`, `adjusted_by`, `adjusted_at`, o bien guardar solo el snapshot en `validated_work_days` sin mutar sesiones (elegir **una** estrategia y documentarla; recomendado: **mutar sesiones** + snapshot en payroll_employee para auditoría).

### 3.4 Autorización

- Empleado: solo start/close **propias** jornadas.
- Admin: listar todas las jornadas del período, editar tiempos en UI de nómina.
- Policies: `WorkDaySessionPolicy` (view, create, update).

---

## 4. FRONTEND — CAMBIOS DE UI

### 4.1 `Productions/Create.tsx` (y Edit si aplica)

- Componente nuevo: `WorkDayBanner.tsx` o sección inline.
- Estados: sin jornada hoy / jornada abierta / jornada cerrada (mostrar horas).
- Toast al iniciar/cerrar.
- Errores del servidor mapeados a mensajes en español.

### 4.2 `Employees/Create` y `Edit`

- Campo **Modalidad de nómina:** radio o select: “Por operaciones” / “Salario diario”.
- Si “Salario diario”: mostrar `daily_salary` (requerido), ayuda contextual.
- Validación Zod coherente con backend.

### 4.3 `Payrolls/Show.tsx`

Para cada empleado `fixed_daily`, expandible:

- Tabla de días del período: fecha, entrada, salida, horas, valor día, subtotal.
- Celdas **editables** (time inputs) para admin antes de **Recalcular** / **Guardar ajustes**.
- Botón “Recalcular fila” o recálculo global del empleado.
- Resumen: `daily_work_subtotal` + resto de deducciones = neto.

Para empleados `operations`: mantener la tabla actual de producción / desglose **sin cambios visuales obligatorios** salvo mostrar badge “Por operaciones”.

### 4.4 Reportes

- Nuevo reporte opcional: **Horas / jornadas por empleado** (rango de fechas).
- No eliminar reportes existentes.

---

## 5. PERMISOS (PermissionHelper / seed)

Añadir al generador de matriz:

- `productions.create.workday_start` — iniciar jornada propia  
- `productions.create.workday_close` — cerrar jornada propia  
- `payrolls.show.edit_time` — editar tiempos validados en liquidación (o reutilizar `payrolls.show.edit` si existe acción genérica)

Actualizar roles demo “Operario de Producción” para incluir start/close si corresponde.

---

## 6. SEEDERS Y FACTORIES

- `EmployeeFactory`: mezcla ~70% `operations`, ~30% `fixed_daily` con `daily_salary`.
- Crear `WorkDaySessionFactory` para tests / demo.
- `DemoDataSeeder`: para 3–4 empleados `fixed_daily`, generar jornadas cerradas en el mes actual.

---

## 7. PRUEBAS MANUALES (CHECKLIST QUE OPUS DEBE DEJAR VERIFICADO)

- [ ] Empleado `operations`: nómina **igual** que antes (mismos totales con mismos datos de producción).
- [ ] Empleado `fixed_daily` sin jornadas: subtotal diario 0 o excluido con mensaje claro en UI.
- [ ] Empleado `fixed_daily` con jornada abierta al calcular: politica definida (bloquear cálculo o asumir 0 hasta cerrar — **recomendado: advertencia + excluir día abierto** hasta cerrado o ajuste admin).
- [ ] Iniciar/cerrar desde formulario producción solo para `fixed_daily`.
- [ ] Admin edita tiempos en nómina y el neto cambia de forma reproducible.
- [ ] Multiempresa: no cruzar sesiones entre companies.
- [ ] `npm run build` y `php artisan test` (si hay tests) sin errores.

---

## 8. ORDEN DE IMPLEMENTACIÓN OBLIGATORIO (PARA NO ROMPER NADA)

1. Migraciones nuevas (employees + work_day_sessions + payroll_employees columns).
2. Modelos + relaciones + factories.
3. `WorkDaySessionService` + policies + rutas + controlador.
4. `PayrollCalculationService` — extensión por rama `payroll_mode`.
5. Frontend: empleados (modalidad + salario diario).
6. Frontend: banner jornada en producción.
7. Frontend: payroll show edición tiempos + recál API.
8. Reportes opcionales.
9. Seeders actualizados.
10. Revisar exportación impresión de nómina: incluir bloque “Salario diario” cuando aplique.

---

## 9. INSTRUCCIÓN FINAL PARA CLAUDE OPUS

Implementa los cambios anteriores sobre el código existente del proyecto **Taller Confección**.  
**No** elimines funcionalidad de producción por operaciones ni renombres rutas públicas sin migración de frontend.  
**No** dejes `TODO` ni código incompleto.  
Si encuentras conflicto de nombres con el código ya generado, **adapta este spec al patrón existente** manteniendo el comportamiento descrito.

Al terminar, entrega un **resumen de archivos tocados** y los comandos:

```bash
php artisan migrate
php artisan db:seed --class=DemoDataSeeder   # si aplica
npm run build
```

---

*Documento: Ajuste nómina salario diario + jornada — Mayo 2026 — Compatible con PROMPT_TALLER_CONFECCION.md*
