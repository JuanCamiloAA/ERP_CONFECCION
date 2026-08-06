# AJUSTE AL SISTEMA DE TALLER — Nómina por horas con liquidación legal colombiana (jornada, recargos y horas extra)
## Tercera modalidad de nómina — Prompt completo para Claude Opus — Implementación incremental sin romper lo existente

---

> **USA ESTE DOCUMENTO ASÍ:**
> 1. Requiere que ya estén aplicados `PROMPT_TALLER_CONFECCION.md`, `PROMPT_AJUSTE_NOMINA_SALARIO_DIARIO.md` (tabla `work_day_sessions`, campo `payroll_mode`) y `PROMPT_NOMINA_CONCEPTOS_MANUALES.md` (tabla `payroll_employee_adjustments`). El código actual de `PayrollCalculationService`, `Employee`, `WorkDaySession`, `Payroll` y `PayrollEmployee` ya fue revisado para escribir este prompt y las referencias de campos/columnas de abajo son reales, no hipotéticas.
> 2. Pega **todo este documento** en Claude Opus en una sesión dedicada.
> 3. El modelo debe aplicar **solo** los cambios descritos aquí, agregando una **tercera modalidad** de nómina (`payroll_mode = 'hourly_legal'`) sin alterar el comportamiento de `operations` ni `fixed_daily`.

> ⚠️ **DISCLAIMER OBLIGATORIO — LEE ANTES DE IMPLEMENTAR:** Este documento construye la **infraestructura técnica** (modelo de datos parametrizado + algoritmo de liquidación) para que el sistema pueda cumplir la ley laboral colombiana vigente en horas, jornada, recargos y horas extra. **No sustituye asesoría legal ni contable.** Las cifras aquí citadas (porcentajes, horarios, fechas de vigencia) fueron verificadas contra fuentes públicas al **05 de agosto de 2026** (ver §12 "Fuentes"). Esta materia **ha cambiado dos veces en los últimos 13 meses** (Ley 2466 de 2025) y **volverá a cambiar** (el recargo dominical/festivo sube de nuevo el 1-jul-2027). Por eso la regla de oro de este prompt es: **ningún porcentaje, horario u hora límite se escribe fijo (hardcoded) en PHP o TypeScript.** Todo vive en la tabla parametrizada `payroll_legal_parameters` (§2.2), editable ahora también por el **admin de cada empresa** (§4.6), no solo por `super_admin`. Esto incluye el nuevo parámetro de **descuento por inasistencia sin marcar** (§3.9): viene **desactivado por defecto** porque el porcentaje correcto a descontar tiene matices legales genuinos (no confundir con el tope del 20% que aplica a multas disciplinarias del art. 113 CST, un concepto distinto) — actívalo solo con acompañamiento legal/contable. Antes de liquidar nómina real, un contador o abogado laboral de la empresa debe validar todos los parámetros cargados.

---

## 0. MARCO LEGAL VIGENTE (referencia para poblar los parámetros — NO hardcodear estos números en código)

Base normativa: Código Sustantivo del Trabajo (CST) arts. 158 a 172 (jornada, trabajo suplementario, recargos) y 179-180 (dominical y festivo), modificados sucesivamente por la **Ley 2101 de 2021** (reducción gradual de jornada) y la **Ley 2466 de 2025** — reforma laboral sancionada el 25-jun-2025 (arts. 10 y 13 en particular).

### 0.1 Jornada semanal máxima y divisor mensual de horas

| Vigencia | Jornada semanal máx. | Divisor mensual de horas |
|---|---|---|
| Hasta 14-jul-2023 | 48 h | 240 |
| 15-jul-2023 – 14-jul-2024 | 47 h | 235 |
| 15-jul-2024 – 14-jul-2025 | 46 h | 230 |
| 15-jul-2025 – 14-jul-2026 | 44 h | 220 |
| **Desde 15-jul-2026 (VIGENTE HOY)** | **42 h** | **210** |

El divisor mensual sigue la fórmula `divisor = jornada_semanal_legal × 5` (equivalencia usada por la doctrina/calculadoras de nómina colombianas tras la Ley 2101; reemplaza el antiguo divisor fijo de 240 que ya **no** aplica). El salario **no se reduce** con la jornada: al bajar el divisor, el valor/hora sube automáticamente (~4,76% en el último tramo).

### 0.2 Franja diurna / nocturna

| Vigencia | Diurna | Nocturna | Base legal |
|---|---|---|---|
| Hasta 24-dic-2025 | 6:00 a.m. – 9:00 p.m. | 9:00 p.m. – 6:00 a.m. | Ley 2101/2021 art. 3 (verificar fecha exacta de tránsito 2021-2023 si se recalcula nómina histórica anterior a 2025) |
| **Desde 25-dic-2025 (VIGENTE HOY)** | **6:00 a.m. – 7:00 p.m.** | **7:00 p.m. – 6:00 a.m.** | Ley 2466/2025 art. 10 (rige 6 meses después de sanción) |

### 0.3 Recargos y horas extra (porcentaje sobre el valor/hora ordinaria)

| Concepto | % vigente hoy | ¿Cambió con la reforma? |
|---|---|---|
| Recargo nocturno (hora ordinaria trabajada en franja nocturna) | **35%** | No — solo cambió el horario de inicio (§0.2) |
| Hora extra diurna | **25%** | No |
| Hora extra nocturna | **75%** | No |
| Tope horas extra | **máx. 2 h/día y 12 h/semana** | Ratificado por art. 13 Ley 2466/2025; requiere en principio autorización del Ministerio del Trabajo |

### 0.4 Recargo dominical y festivo (trabajo dentro de la jornada pactada, en domingo o festivo)

| Vigencia | Recargo dominical/festivo |
|---|---|
| Hasta 30-jun-2025 | 75% |
| 01-jul-2025 – 30-jun-2026 | 80% |
| **01-jul-2026 – 30-jun-2027 (VIGENTE HOY)** | **90%** |
| Desde 01-jul-2027 | 100% |

La ley distingue **ocasional** (el empleado trabaja hasta 2 domingos/festivos en el mes calendario) de **habitual** (3 o más en el mes calendario): en ambos casos aplica el recargo; el trabajo habitual además da derecho a descanso compensatorio remunerado (la programación de ese descanso queda fuera de alcance de este prompt — ver §8).

### 0.5 Combinación de factores (fórmula genérica, se recalcula sola si cambian los % en §2.2)

```
factor_sobre_valor_hora = 1
                         + (recargo_nocturno_% si la hora cae en franja nocturna Y NO es extra)
                         + (extra_diurna_% si la hora es extra Y cae en franja diurna)
                         + (extra_nocturna_% si la hora es extra Y cae en franja nocturna)
                         + (recargo_dominical_festivo_% si el work_date es domingo u festivo)
```

Con los porcentajes vigentes hoy (35% / 25% / 75% / 90%), la tabla resultante:

| Tipo de hora | Factor |
|---|---|
| Ordinaria diurna (ya cubierta por el salario base, sin línea adicional) | 1.00 |
| Recargo nocturno | 1.35 |
| Extra diurna | 1.25 |
| Extra nocturna | 1.75 |
| Recargo dominical/festivo diurno | 1.90 |
| Recargo dominical/festivo nocturno | 2.25 |
| Extra dominical/festivo diurna | 2.15 |
| Extra dominical/festivo nocturna | 2.65 |

### 0.6 Exclusiones legales (CST art. 162)

Empleados en cargos de **dirección, confianza y manejo** (y algunas otras categorías del art. 162 CST) están excluidos del régimen de jornada máxima/horas extra. El modelo de datos debe permitir marcar esto por empleado (§2.1, `is_exempt_from_overtime`).

### 0.7 Valores de referencia 2026 (informativos, van en `Setting`/`Company`, no en este módulo)

SMMLV 2026: **$1.750.905 COP** (Decreto 1469/2025, ratificado por Decreto 0159 del 19-feb-2026). Auxilio de transporte 2026: **$249.095 COP** para quienes devengan hasta 2 SMMLV. Estos dos valores **no** son objeto directo de este prompt (van en prestaciones/deducciones generales, no en horas/jornada) pero se listan porque probablemente ya existan o deban existir como `Setting` de empresa.

---

## 1. CONTEXTO Y OBJETIVO

El sistema hoy maneja **dos modalidades** de nómina por empleado (`employees.payroll_mode`): `operations` (producción × precio) y `fixed_daily` (salario diario prorrateado por minutos trabajados, **sin distinguir** horas extra, nocturnas ni dominicales/festivas — es una proporción simple `daily_salary * (minutos/minutos_jornada_completa)`).

**Objetivo de este prompt:** agregar una **tercera modalidad**, `hourly_legal`, para empleados cuyo pago debe reflejar **con exactitud legal** la jornada trabajada: horas ordinarias, recargo nocturno, recargo dominical/festivo, horas extra (diurna/nocturna/dominical-festiva) y los topes legales, todo basado en los parámetros vigentes de §0/§2.2.

**Regla de oro (igual que en los prompts anteriores):** un empleado tiene **una** modalidad. `hourly_legal` **reutiliza** la infraestructura de jornada ya construida (`work_day_sessions`, inicio/cierre de jornada, banner en producción) — **no** se crea un nuevo mecanismo de fichaje. La diferencia con `fixed_daily` está **solo** en cómo `PayrollCalculationService` convierte esas sesiones en dinero.

| Modalidad | Cómo se captura el tiempo | Cómo se paga |
|---|---|---|
| `operations` | No aplica (producción) | `producción × precio` |
| `fixed_daily` | `work_day_sessions` | Prorrateo simple día completo/parcial, **sin** recargos ni extras |
| `hourly_legal` (**nueva**) | `work_day_sessions` (mismo mecanismo) | Salario base + recargo nocturno + recargo dominical/festivo + horas extra, **según ley vigente** |

No se elimina ni se modifica el comportamiento de `operations` ni `fixed_daily`. Un empleado `fixed_daily` existente sigue funcionando idéntico.

---

## 2. MODELO DE DATOS

### 2.1 Tabla `employees` — nuevos campos (migración incremental, no reescribir migraciones históricas)

```sql
-- ampliar el enum/string payroll_mode existente con el valor 'hourly_legal'
-- y agregar en app/Models/Employee.php: public const PAYROLL_MODE_HOURLY_LEGAL = 'hourly_legal';
-- (mismo patrón que PAYROLL_MODE_OPERATIONS / PAYROLL_MODE_FIXED_DAILY ya existentes)

ordinary_hours_per_day DECIMAL(4,2) NOT NULL DEFAULT 8.00
  -- jornada ordinaria diaria pactada; minutos que excedan esto en un work_date
  -- son candidatos a hora extra (sujeto también al tope semanal, ver §3.3)

is_exempt_from_overtime BOOLEAN NOT NULL DEFAULT false
  -- true = cargos de dirección/confianza/manejo u otra excepción del art. 162 CST;
  -- sus horas nunca generan "extra" (solo recargo nocturno/dominical si aplica), aunque excedan jornada

legal_monthly_salary DECIMAL(12,2) NULLABLE
  -- salario mensual base para empleados hourly_legal, usado para derivar el valor/hora.
  -- ANTES DE CREAR ESTA COLUMNA: verificar si `employees.base_salary` (ya existe, confirmado
  -- que HOY NO participa en ningún cálculo de PayrollCalculationService) puede reutilizarse
  -- directamente. Si al revisar el código actual `base_salary` sigue sin uso en nómina,
  -- REUTILIZARLO y no crear `legal_monthly_salary`. Si ya cumple otro propósito de negocio
  -- (ej. reportes, alguna pantalla que dependa de que no cambie de significado), crear el
  -- campo nuevo siguiendo el mismo patrón que `daily_salary` para `fixed_daily`. Documentar
  -- la decisión tomada en el resumen final de archivos tocados.

scheduled_work_days JSON NOT NULL DEFAULT '[1,2,3,4,5,6]'
  -- días ISO de la semana (1=lunes...7=domingo) en que se ESPERA que el empleado marque
  -- jornada. Default lunes-sábado (domingo como descanso semanal estándar). Aplica a
  -- CUALQUIER empleado que use work_day_sessions, es decir fixed_daily Y hourly_legal
  -- (§2.5, usesWorkDaySessions()) — NUNCA a operations. Es la base para detectar
  -- "día hábil sin marcación" en §3.9.
```

**Semántica:** `payroll_mode = 'hourly_legal'` → el devengo del período sale de `work_day_sessions` procesadas con el algoritmo de §3. `production_total` y `daily_work_subtotal` quedan en 0 para este empleado (igual convención que ya usan `operations`/`fixed_daily` entre sí).

**Compatibilidad:** empleados existentes no se tocan; `ordinary_hours_per_day` default 8.00, `is_exempt_from_overtime` default `false` y `scheduled_work_days` default lunes-sábado no afectan a nadie que no sea `fixed_daily`/`hourly_legal` en el caso de `scheduled_work_days`, ni a nadie que no sea `hourly_legal` en el caso de los otros dos.

### 2.2 Nueva tabla `payroll_legal_parameters` — el corazón de "que se acoja a todas las leyes actuales"

Esta tabla es la razón de ser del diseño: cuando el Congreso vuelva a cambiar un porcentaje (ya pasó dos veces en 13 meses, va a pasar de nuevo el 01-jul-2027 con el recargo dominical al 100%), **se agrega una fila nueva, no se toca código.**

```sql
id
company_id NULLABLE (FK companies)      -- NULL = parámetro global de sistema (default para todas las empresas)
effective_from DATE NOT NULL
effective_to   DATE NULLABLE            -- NULL = vigente hasta que se cree la siguiente fila
weekly_legal_hours DECIMAL(5,2) NOT NULL             -- ej. 42.00
monthly_hours_divisor DECIMAL(6,2) NOT NULL          -- ej. 210.00 (explícito, no derivado en runtime)
night_start_time TIME NOT NULL                       -- ej. 19:00:00
night_end_time   TIME NOT NULL                       -- ej. 06:00:00
night_surcharge_percent DECIMAL(5,2) NOT NULL        -- 35.00
overtime_day_percent DECIMAL(5,2) NOT NULL           -- 25.00
overtime_night_percent DECIMAL(5,2) NOT NULL         -- 75.00
sunday_holiday_surcharge_percent DECIMAL(5,2) NOT NULL -- 90.00
max_overtime_hours_per_day DECIMAL(4,2) NOT NULL     -- 2.00
max_overtime_hours_per_week DECIMAL(5,2) NOT NULL    -- 12.00
discount_unexcused_absences BOOLEAN NOT NULL DEFAULT false  -- "parámetro variable" pedido: activar/desactivar
                                                             -- el descuento por día hábil sin marcación (§3.9)
absence_discount_percent DECIMAL(5,2) NOT NULL DEFAULT 100.00  -- % del valor del día que se descuenta
                                                                -- por inasistencia sin marcar (ver caveat legal en §3.9)
legal_reference VARCHAR(255) NULLABLE                -- ej. "Ley 2466 de 2025, tramo jul-2026/jun-2027"
timestamps

INDEX(company_id, effective_from, effective_to)
```

**Resolución de vigencia** (usar en el servicio, no en el frontend): para una `company_id` y una fecha `d`, buscar la fila con `effective_from <= d <= COALESCE(effective_to, '9999-12-31')`; preferir fila con `company_id` específico sobre la fila global (`company_id IS NULL`) si ambas cubren `d`. Si no hay ninguna fila global ni de empresa que cubra `d`, **fallar explícitamente** (lanzar excepción de dominio) — nunca asumir valores por defecto silenciosos en un cálculo de nómina.

**Este es "el módulo" pedido para parametrizar por el empleador:** las mismas filas de esta tabla — jornada, horarios, recargos, topes **y ahora también** el descuento por inasistencia — se editan desde la única pantalla `PayrollLegalParameters/Index.tsx` (§5.3). La fila global (`company_id = null`) trae los valores legales de §0 sembrados por defecto con `discount_unexcused_absences = false` (nadie descuenta nada hasta que una empresa lo active); cada empresa puede crear su propia fila (`company_id` = la suya) que sobrescribe cualquier campo, incluido activar el descuento, sin afectar a otras empresas. Ver §4.6 para quién puede editar cada nivel.

### 2.3 Nueva tabla `holidays` (festivos colombianos)

```sql
id
country_code VARCHAR(2) NOT NULL DEFAULT 'CO'
date DATE NOT NULL
name VARCHAR(150) NOT NULL
is_emiliani_shifted BOOLEAN NOT NULL DEFAULT false   -- true si se corrió al lunes siguiente (Ley 51/1983)
source ENUM('calculated','manual') NOT NULL DEFAULT 'calculated'
timestamps

UNIQUE(country_code, date)
INDEX(country_code, date)
```

Un `work_date` es "dominical o festivo" (para efectos de §0.4) si su día de la semana es domingo **o** existe una fila en `holidays` con esa fecha.

**Cómo poblarla:** implementar el algoritmo determinístico de Colombia (fecha de Pascua vía Meeus/Jones/Butcher + las reglas de la Ley 51 de 1983 "Ley Emiliani": los festivos que caen entre semana se trasladan al lunes siguiente, **excepto** 1-ene, 1-may, 20-jul, 7-ago, 8-dic y 25-dic que **no** se trasladan). Generar por comando Artisan (`php artisan holidays:sync {year}`) para un rango de años razonable (ej. 2023-2028).

**Importante — por qué no es solo un algoritmo:** en 2026 se sancionó la **Ley 2578 de 2026**, que añadió un festivo nuevo (9 de julio, Virgen de Chiquinquirá) fuera del patrón habitual — Colombia pasó de 18 a **19 festivos** ese año. Esto demuestra en la práctica que el calendario de festivos también puede cambiar por ley puntual. Por eso la tabla debe ser **editable desde UI** (agregar/quitar filas manuales con `source = 'manual'`) además de sembrarse por algoritmo, y el equipo de implementación debe **verificar la lista generada contra el calendario oficial publicado por el Ministerio del Trabajo/Función Pública** antes de liquidar nómina real, especialmente para el año en curso.

### 2.4 Tabla `payroll_employees` — columnas adicionales (sin eliminar nada existente)

```sql
legal_hourly_subtotal DECIMAL(12,2) NOT NULL DEFAULT 0
  -- devengo total de la modalidad hourly_legal en el período: salario base proporcional
  -- + recargos + horas extra. Sigue la misma convención que production_total/daily_work_subtotal:
  -- en 0 para empleados que no son hourly_legal.

legal_hours_breakdown JSON NULLABLE
  -- snapshot de auditoría por liquidación, ej.:
  -- {
  --   "base_salary_earned": 850000,
  --   "ordinary_day_minutes": 9600, "ordinary_night_minutes": 0,
  --   "sunday_holiday_day_minutes": 480, "sunday_holiday_night_minutes": 0,
  --   "overtime_day_minutes": 120, "overtime_night_minutes": 0,
  --   "overtime_sunday_holiday_day_minutes": 0, "overtime_sunday_holiday_night_minutes": 0,
  --   "hourly_rate_applied": 4048,
  --   "night_surcharge_amount": 0, "sunday_holiday_surcharge_amount": 91080,
  --   "overtime_amount": 20240,
  --   "legal_parameters_snapshot": { "weekly_legal_hours": 42, "monthly_hours_divisor": 210, ... },
  --   "overtime_limit_alerts": ["2026-08-03: 2.5h extra (excede tope diario de 2h)"]
  -- }

overtime_limit_alerts JSON NULLABLE
  -- lista de advertencias de topes legales excedidos en el período (no bloquea el cálculo por
  -- defecto; ver §3.5 para la bandera de bloqueo configurable).

absence_discount_total DECIMAL(12,2) NOT NULL DEFAULT 0
  -- monto descontado por inasistencia sin marcar (§3.9), ya confirmado por el admin.
  -- Aplica a fixed_daily y hourly_legal; en fixed_daily normalmente queda en 0 (ver §3.9.4).

absence_discount_detail JSON NULLABLE
  -- snapshot de auditoría, ej.:
  -- [{ "work_date": "2026-08-03", "reason": "sin marcación", "amount": 58363,
  --     "confirmed_by_user_id": 7 }, ...]
  -- también puede incluir las fechas candidatas que el admin desmarcó/justificó, con su nota.
```

El **bruto** del empleado se extiende (compatible con lo ya implementado en `PROMPT_NOMINA_CONCEPTOS_MANUALES.md`):

```text
gross = production_total + daily_work_subtotal + legal_hourly_subtotal + adjustments_subtotal
```

### 2.5 Sincronización obligatoria con el botón de inicio/fin de jornada YA IMPLEMENTADO

**Principio: no se crea ningún mecanismo de fichaje nuevo.** El proyecto ya tiene, funcionando hoy, el botón "Iniciar jornada" / "Cerrar jornada" (`WorkDayBanner.tsx`, dentro de `Productions/Create.tsx` e `Productions/Index.tsx`), respaldado por `WorkDaySessionService`, `WorkDaySessionController` y las rutas `work-day-sessions.today|start|close`. `hourly_legal` **debe usar exactamente ese mismo botón y esas mismas filas de `work_day_sessions`** — la única diferencia con `fixed_daily` es cómo `PayrollCalculationService` convierte esas sesiones en dinero (§3), no cómo se capturan.

**Hallazgo del código actual (verificado línea por línea antes de escribir esto):** hoy ese flujo está **codificado exclusivamente para `fixed_daily`** en varios puntos concretos, vía `Employee::isPayrollFixedDaily()` o comparaciones directas contra `PAYROLL_MODE_FIXED_DAILY`. Si `hourly_legal` no amplía **cada uno** de estos puntos, el botón de jornada seguirá sin aparecerle a estos empleados y no se podrá calcular nada. Esta es la lista real (no hipotética) de lo que hay que tocar:

| Archivo | Línea (referencia) | Qué hace hoy | Cambio requerido |
|---|---|---|---|
| `app/Models/Employee.php` | `isPayrollFixedDaily()` (~102) | Solo compara contra `fixed_daily` | **No tocar este método.** Agregar uno nuevo, ej. `usesWorkDaySessions(): bool`, que retorne `true` para `fixed_daily` **y** `hourly_legal`. Usar este nuevo método en todos los puntos de la tabla, no repetir el array en cada archivo. |
| `app/Services/WorkDaySessionService.php:23` | `startSession()` | `if (! $employee->isPayrollFixedDaily())` bloquea el inicio de jornada | Cambiar a `if (! $employee->usesWorkDaySessions())` |
| `app/Http/Controllers/WorkDaySessionController.php:42` | `today()` | `if (! $employee->isPayrollFixedDaily())` → responde `applicable: false` | Cambiar a `usesWorkDaySessions()` |
| `app/Http/Controllers/WorkDaySessionController.php:53` | `today()` | Hardcodea `'payroll_mode' => 'fixed_daily'` en el JSON de respuesta | Devolver `$employee->payroll_mode` real (el frontend no necesita el valor exacto hoy, pero no debe mentir) |
| `app/Http/Controllers/ProductionController.php:100` | construcción de `initialSelf` para el banner | `if ($emp?->isPayrollFixedDaily())` | Cambiar a `usesWorkDaySessions()` |
| `app/Http/Controllers/ProductionController.php:111,143` | lista `selectableEmployees` (selector admin del banner) | `->where('payroll_mode', Employee::PAYROLL_MODE_FIXED_DAILY)` | `->whereIn('payroll_mode', [Employee::PAYROLL_MODE_FIXED_DAILY, Employee::PAYROLL_MODE_HOURLY_LEGAL])` |
| `app/Services/PayrollCalculationService.php:191` | `applyWorkSessionAdjustments()` (ajustes de horario que hace el admin **al momento de calcular la nómina**, antes de liquidar) | `if (! $employee || ! $employee->isPayrollFixedDaily())` | Cambiar a `usesWorkDaySessions()` — **si no se cambia aquí, el admin no podrá corregir horas de un empleado `hourly_legal` antes de calcular, que es justo el punto que se pidió** |
| `app/Http/Requests/Employee/StoreEmployeeRequest.php:84-85`, `UpdateEmployeeRequest.php:84-85` | `Rule::in([OPERATIONS, FIXED_DAILY])` | Rechaza `hourly_legal` como valor inválido | Agregar `Employee::PAYROLL_MODE_HOURLY_LEGAL` al `Rule::in(...)`, y agregar validación `required_if` para `legal_monthly_salary`/`ordinary_hours_per_day` |
| `app/Http/Controllers/EmployeeController.php:118,223` | arma `daily_salary` según el modo | Solo conoce `operations`/`fixed_daily` | Agregar la rama `hourly_legal` para persistir sus campos propios |
| `app/Services/DataImport/EmployeeUserImportStrategy.php:47,52,165` | importación masiva de empleados por CSV | Valida `payroll_mode` contra `[OPERATIONS, FIXED_DAILY]` únicamente | Ampliar a `hourly_legal`; si no se hace, **la importación CSV rechazará o corromperá silenciosamente estos empleados** |
| `app/Services/DataImport/TemplateGeneratorService.php` | genera la plantilla CSV descargable | No incluye columnas de `hourly_legal` | Agregar columnas `legal_monthly_salary`, `ordinary_hours_per_day`, `is_exempt_from_overtime` a la plantilla cuando el modo lo requiera |

**Lo que NO hay que tocar (confirmado al leer el código):**

- `WorkDayBanner.tsx` — el componente es agnóstico al `payroll_mode` exacto (solo pinta "Jornada de hoy" + botones Iniciar/Cerrar/estado). **Cero cambios de UI.** Funciona igual para `hourly_legal` en cuanto el backend deje de bloquearlo.
- Los permisos `productions.index.workday_start`, `productions.index.workday_close`, `productions.index.workday_others` — **ya existen** (`PermissionHelper.php:88`, ya sembrados en `CompanyDefaultRolesService`). No crear permisos nuevos para jornada; son por acción, no por modalidad de nómina.
- Las rutas `work-day-sessions.today|start|close` — no se agregan rutas nuevas.

**Refuerzo de integridad recomendado (mismo archivo que ya se está tocando):** `WorkDaySessionService::closeSession()` hoy no verifica si la fecha cae dentro de una nómina ya **pagada**. El proyecto ya tiene exactamente ese guardrail para producciones (`Payroll::paidPeriodCoversDate()`, usado en `StoreProductionRequest`/`UpdateProductionRequest`). Aplicar el mismo criterio en `closeSession()` (y en el endpoint de ajustes admin) para **cualquier** empleado con `usesWorkDaySessions()`, no solo `hourly_legal`: si `Payroll::paidPeriodCoversDate($companyId, $workDate)` es `true`, rechazar el cierre/ajuste con un mensaje claro. Esto es barato de agregar ahora mismo que se está tocando ese servicio, y cierra un vacío real que hoy también afecta a `fixed_daily`.

---

## 3. REGLAS DE NEGOCIO — ALGORITMO DE LIQUIDACIÓN

### 3.1 Valor/hora ordinaria — resuelto por día trabajado, no por período completo

```text
valor_hora_ordinaria(work_date) = legal_monthly_salary / monthly_hours_divisor_vigente(work_date)
```

**Importante — esto responde directamente al requisito de "aplicar lo estipulado en la ley al momento de tomar la nómina":** `monthly_hours_divisor_vigente`, el horario diurno/nocturno, y todos los porcentajes de §0 se resuelven **por cada `work_day_session`, usando el `work_date` propio de esa sesión** (vía `PayrollLegalParameterResolver`, §4.2) — **no** un único valor fijado al inicio del período. Esto es deliberado: si una quincena cruza una fecha de cambio de ley (por ejemplo un período que va del 10 al 25 de julio y la jornada baja de 44h a 42h el 15-jul, o un período que cruza el 1-jul-2027 cuando el recargo dominical sube a 100%), **cada día de la quincena se liquida con la norma que estaba vigente ese día específico**, de forma automática, sin intervención manual. El cálculo por sesión de §3.2 ya está escrito así (`parámetros = resolver payroll_legal_parameters vigente para (company_id, session.work_date)`); esta sección debe leerse en conjunto con esa, usando siempre la fecha de la sesión, nunca la fecha del período.

### 3.2 Clasificación por sesión (`work_day_session` cerrada o ajustada)

Para cada sesión del período, **en orden cronológico** (necesario para el tope semanal acumulado):

```text
parámetros = resolver payroll_legal_parameters vigente para (company_id, session.work_date)
es_dominical_o_festivo = session.work_date.es_domingo() OR existe holiday con esa fecha
minutos_sesion = session.duration_minutes

// 1) Cuánto de esta sesión es "ordinario" vs "extra" (ignorando is_exempt_from_overtime por ahora)
capacidad_ordinaria_dia = employee.ordinary_hours_per_day * 60
capacidad_ordinaria_semana_restante = max(0, parámetros.weekly_legal_hours*60 - minutos_ordinarios_acumulados_esta_semana)

minutos_ordinarios = min(minutos_sesion, capacidad_ordinaria_dia, capacidad_ordinaria_semana_restante)
minutos_extra = minutos_sesion - minutos_ordinarios

si employee.is_exempt_from_overtime:
    minutos_ordinarios = minutos_sesion
    minutos_extra = 0

minutos_ordinarios_acumulados_esta_semana += minutos_ordinarios   // "semana" = lunes-domingo calendario

// 2) Repartir minutos_ordinarios y minutos_extra entre franja diurna/nocturna,
//    cruzando clock_in_at/clock_out_at contra parámetros.night_start_time/night_end_time.
//    (una sesión puede cruzar la medianoche y/o el límite día/noche varias veces — recorrer
//    por segmentos, no asumir una sola franja por sesión)

// 3) Aplicar el factor de §0.5/§0.6 a cada balde de minutos según:
//    (ordinario|extra) × (diurno|nocturno) × (es_dominical_o_festivo: sí/no)
//    monto_balde = (minutos_balde/60) * valor_hora_ordinaria * (factor - 1)   // el "-1" porque
//    la parte "1.00" ya está cubierta por el salario base prorateado, ver §3.3
```

### 3.3 Salario base + recargos, no salario completo recalculado desde cero

Igual que `fixed_daily`, el salario fijo mensual/diario **ya cubre** las horas ordinarias diurnas trabajadas dentro de la jornada pactada. El valor/hora de §3.1 se usa **únicamente** para calcular los **adicionales** (recargos y extras), no para recomponer el 100% del pago:

```text
base_salary_earned    = legal_monthly_salary * (dias_calendario_del_periodo / dias_del_mes)
recargos_y_extras     = suma de todos los "monto_balde" de §3.2 (todo lo que no sea ordinario-diurno-entre-semana)
legal_hourly_subtotal = round(base_salary_earned + recargos_y_extras, 2)   // bruto de esta modalidad — SIN restar inasistencias aquí
```

**Importante — `base_salary_earned` cubre TODOS los días calendario del período, incluido el descanso semanal.** Un empleado mensual no deja de ganar el domingo/día de descanso solo porque no trabajó ese día — el salario mensual ya lo remunera (así funciona también hoy la nómina de un asalariado fijo en Colombia). Por eso el prorrateo es sobre `dias_calendario_del_periodo`, no sobre "días trabajados". La única forma en que un día deja de pagarse es el descuento explícito por inasistencia sin marcar de §3.9 — **ese** es el mecanismo correcto para reflejar ausencias, no reducir la base de este prorrateo. Documentar en código esta convención (mensual/30 días) para que sea consistente con lo que ya use el resto del sistema.

**Dónde se resta `absence_discount_total`:** **no** aquí — `legal_hourly_subtotal` es un valor **bruto** (para que `Payrolls/Show.tsx` pueda seguir mostrando "Producido"/bruto igual que las otras modalidades). El descuento por inasistencia se resta una sola vez, a nivel de neto, junto con deducciones y anticipos (fórmula completa en §3.9 punto 6 y §4.3). No restarlo dos veces.

### 3.4 Topes legales de horas extra (§0.3)

Por cada semana calendario del período, sumar minutos extra (diurnos + nocturnos). Si un día supera `parámetros.max_overtime_hours_per_day` o la semana supera `parámetros.max_overtime_hours_per_week`:

- **Comportamiento por defecto: no bloquear el cálculo**, pero registrar en `overtime_limit_alerts` (ej. `"2026-08-03: 2.5h extra (excede tope diario de 2h)"`) y mostrarlo en rojo en `Payrolls/Show`.
- Agregar `Setting` por empresa `payroll.block_overtime_over_legal_limit` (bool, default `false`) para que empresas que quieran **bloquear** el cálculo hasta que el admin ajuste las horas puedan activarlo.
- Mostrar también un recordatorio (solo texto, no bloqueante) de que las horas extra requieren autorización previa del Ministerio del Trabajo — no es algo que el software pueda verificar, es una nota de cumplimiento para el administrador.

### 3.5 Trabajo dominical/festivo — ocasional vs. habitual (§0.4)

Contar, por empleado y por mes calendario, cuántos `work_date` distintos con `es_dominical_o_festivo = true` tienen minutos trabajados. Si el conteo del mes es `>= 3`, marcar esos días como "habitual" en `legal_hours_breakdown` (informativo). **Fuera de alcance v1:** la programación/asignación real del día de descanso compensatorio — el sistema **cuenta y alerta**, no gestiona el calendario de descansos (ver §8).

### 3.6 Redondeo

Redondear cada `monto_balde` a 2 decimales antes de sumar (consistente con el resto de `PayrollCalculationService`, que ya redondea a 2 decimales en cada paso). Documentar la convención en el código, igual que hacen los otros dos modos.

### 3.7 Simplificaciones de v1 — documentar explícitamente en el código

- El límite diario usa `employee.ordinary_hours_per_day` fijo por empleado, no la "jornada flexible" del art. 161 lit. c CST (distribución desigual en 4-6 días con más horas ciertos días sin generar extra). Si una empresa necesita jornada flexible real, es una extensión futura — no la implementes silenciosamente distinto a lo aquí descrito.
- La "semana" para el tope semanal (§3.2, §3.4) se asume lunes-domingo calendario. Si la empresa ya tiene un concepto de "semana de nómina" distinto en otro módulo, alinear a ese; si no existe, usar lunes-domingo y documentarlo.
- No se calculan aquí cesantías, intereses de cesantías, prima de servicios, vacaciones ni aportes a seguridad social/parafiscales — ver §8.

### 3.8 Garantías frente a la quincena (períodos de nómina) — "sin afectar la quincena"

Cuatro reglas explícitas para que liquidar horas reales nunca descuadre ni duplique un período de nómina:

1. **Una sesión pertenece a un único período, siempre.** `work_day_sessions.work_date` es una sola fecha calendario fijada al **iniciar** la jornada (no al cerrar). El cálculo de nómina filtra sesiones por `whereBetween('work_date', [period_start, period_end])` (igual que ya hace hoy para `fixed_daily`, `PayrollCalculationService.php:259`). Una jornada nocturna que empieza 11:40 p.m. del último día de la quincena y cierra 3:10 a.m. del día siguiente (ya en la quincena próxima) se liquida **completa** en la quincena que contiene su `work_date` de inicio — nunca se reparte ni se duplica entre las dos. Los minutos nocturnos de esa sesión sí se siguen clasificando correctamente dentro de la franja nocturna por el algoritmo de §3.2; lo que no cruza es la asignación **contable** a un período distinto.
2. **No se cuentan dos veces entre nóminas del mismo tipo.** `StorePayrollRequest` (`app/Http/Requests/Payroll/StorePayrollRequest.php`) **ya** rechaza crear una nómina cuyo período se solape con otra del mismo `type` (misma periodicidad) para la empresa — esta protección aplica automáticamente a `hourly_legal` sin cambios adicionales, porque opera a nivel de `Payroll`, no de modalidad de empleado.
3. **Límite conocido, no introducido por este prompt:** esa validación de solape es **por tipo** (`type`). Si la empresa llegara a tener, por ejemplo, una nómina `quincenal` y una `mensual` con fechas que se crucen, ambas podrían recoger la misma `work_day_session` y pagarla dos veces. Esto ya es así hoy para `fixed_daily`; no es un problema nuevo de `hourly_legal`. Si se quiere cerrar ese vacío, sería una validación adicional en `StorePayrollRequest` que compare contra **todos** los tipos, no solo el mismo — queda como mejora opcional, fuera del alcance obligatorio de este prompt.
4. **Sesión abierta al momento de calcular = se excluye, no se inventa.** Igual que ya ocurre con `fixed_daily`, si un empleado `hourly_legal` tiene una jornada `open` (sin cerrar) dentro del rango del período, esa sesión **no** entra al cálculo (`status in ('closed','adjusted')`, §4.3). El admin debe cerrarla o ajustarla antes de recalcular; el sistema no debe asumir horas de una jornada todavía abierta.

### 3.9 Descuento por inasistencia (día hábil sin marcación) — SOLO empleados salariales, NUNCA `operations`

**Alcance explícito, tal como se pidió:** esta regla aplica **únicamente** a empleados con modalidad **salarial por tiempo** (`fixed_daily` y `hourly_legal`, es decir `usesWorkDaySessions()` de §2.5). **Nunca** aplica a `payroll_mode = 'operations'`: su pago depende solo de producción registrada, no de marcación de jornada, así que el concepto de "día hábil sin marcar" no existe para ellos. Poner esta exclusión como guarda explícita al inicio del método (`if ($employee->isPayrollByOperations()) { return; }`), no solo como efecto colateral de que la query no los toque.

**1) Determinar los "días hábiles esperados" del período, por empleado:**

```text
para cada fecha d en [period_start, period_end]:
    es_dia_esperado(d) = isoWeekday(d) está en employee.scheduled_work_days   // default lunes-sábado
                          AND d no está en holidays (tabla §2.3, ni domingo ya cubierto por scheduled_work_days)
                          AND d >= employee.hire_date
```

**2) Detectar candidatos:** un `d` esperado **sin** `work_day_session` en estado `closed`/`adjusted` para ese empleado es un candidato a "inasistencia sin marcar".

**3) Aplicar el parámetro (§2.2), resuelto para esa fecha `d` (mismo resolver de §4.2, nunca un valor fijo para todo el período):**

- Si `parámetros.discount_unexcused_absences` es `false` → no se descuenta nada; opcionalmente se puede seguir mostrando el listado de días sin marcar solo como información.
- Si es `true` → el día entra a `absence_discount_detail` con su fecha y el monto a descontar (paso 4).

**4) Monto a descontar por día candidato — distinto según modalidad, no tratarlo como igual:**

| Modalidad | Monto por día de inasistencia | Por qué |
|---|---|---|
| `fixed_daily` | **Ninguno adicional que restar.** Hoy, si no hay sesión ese día, ya no se genera `day_earnings` (comportamiento actual de `computeFixedDailyEarnings`, sin cambios). El único efecto de este parámetro para `fixed_daily` es **de trazabilidad**: listar en `legal_hours_breakdown`/un bloque equivalente cuántos días esperados no se marcaron, para que quede visible en el detalle y el reporte — no hay un monto positivo previo del que restar. |
| `hourly_legal` | `(legal_monthly_salary / dias_del_mes) * (parámetros.absence_discount_percent / 100)` — mismo valor/día que ya usa el prorrateo de `base_salary_earned` (§3.3), aplicado en sentido contrario. Aquí **sí** hay una resta real, porque §3.3 parte de pagar todos los días calendario del período; un día hábil no marcado y no justificado debe restarse de eso explícitamente. |

**5) Punto de control humano obligatorio antes de restar de verdad (no auto-descontar sin revisión):** el sistema **no** tiene hoy un módulo de incapacidades/licencias/vacaciones (sigue fuera de alcance, §8), así que no puede distinguir por sí solo una inasistencia injustificada de una falta con justa causa (cita médica, calamidad, permiso verbal no registrado, etc.). Por eso, en `Payrolls/Show.tsx` (extensión de §5.2), cada fecha candidata se muestra al admin con un check "Descontar" preseleccionado según el parámetro, que el admin puede desmarcar y anotar un motivo ("justificada: incapacidad", "permiso autorizado", etc.) **antes** de calcular. Solo las fechas que queden marcadas al calcular entran al `absence_discount_total` final.

**6) Fórmula final (extiende `recalculatePayrollEmployeeTotals`, ya existente):**

```text
absence_discount_total = suma de los montos confirmados por el admin en el paso 5
net_payment = gross - deductions_amount - advances_discount - absence_discount_total
```

**⚠️ Caveat legal — verificar con contador/abogado antes de activar el parámetro en cualquier empresa:** la regla general en Colombia es que el empleador **no está obligado a pagar** un día en que el trabajador no prestó el servicio sin justificación (fuente: doctrina y prensa especializada, ver §12). Existe además un límite legal distinto y **no debe confundirse** con lo anterior: el art. 113 CST limita las **multas por sanciones disciplinarias** a máximo 1/5 (20%) del salario de un día, y ese dinero además no puede quedar en poder del empleador (debe ir a un fondo de bienestar social o similar). Ese límite del 20% aplica a **sanciones/multas por faltas al reglamento**, no necesariamente al simple no-pago de un día no trabajado — pero las fuentes consultadas no son unánimes ni completamente claras en separar ambos conceptos en todos los casos, y hay jurisprudencia constitucional relevante (ver Sentencia C-478/07 en §12) que conviene revisar. Por eso `absence_discount_percent` es **configurable y no viene forzado a 100%** — la empresa debe fijarlo con asesoría legal, y el valor sembrado por defecto en la fila global (`company_id = null`) debe dejarse con `discount_unexcused_absences = false` hasta que cada empresa lo confirme y active conscientemente.

**Fuera de alcance de esta sección (documentar, no implementar):** el art. 173 CST condiciona el pago del descanso dominical remunerado a que el trabajador haya cumplido su semana completa de trabajo — una inasistencia injustificada en la semana podría además hacer perder ese pago. Automatizar esa segunda consecuencia es más complejo y disputable; **no** se implementa en v1, solo se deja anotado aquí para que quede claro que existe.

---

## 4. BACKEND — SERVICIOS Y CONTROLADORES

### 4.1 `HolidayService` (o `ColombianHolidayService`)

- `syncYear(int $year): int` — calcula y hace upsert de los festivos del año (algoritmo Pascua + Ley Emiliani descrito en §2.3), retorna cuántos se crearon/actualizaron.
- `isHolidayOrSunday(Carbon $date, string $countryCode = 'CO'): bool`
- Comando Artisan `holidays:sync {year?}` que además pueda correr para un rango (`--from=2023 --to=2028`).

### 4.2 `PayrollLegalParameterResolver`

- `resolve(int $companyId, \DateTimeInterface $date): PayrollLegalParameter` — implementa la lógica de vigencia de §2.2; lanza `\DomainException` si no hay fila aplicable.
- Cachear por request (no por proceso largo) para no repetir la query por cada sesión del período.

### 4.3 Extender `PayrollCalculationService`

**Sin tocar** las ramas existentes de `operations` ni `fixed_daily`. Agregar:

```text
if empleado.payroll_mode == 'hourly_legal':
    sessions = work_day_sessions donde work_date entre period_start y period_end
              y status in ('closed', 'adjusted'), ordenadas por work_date, id
    para cada session:
        parámetros = PayrollLegalParameterResolver.resolve(company_id, session.work_date)
        // NUNCA payroll.period_start — cada sesión usa la ley vigente en SU propio día (§3.1)
    ejecutar algoritmo de §3.2-§3.6 sesión por sesión (cada una con sus propios parámetros vigentes)
    legal_hourly_subtotal = ... (§3.3)
    legal_hours_breakdown = ... (JSON de auditoría)
    overtime_limit_alerts = ... (§3.4)
    production_total = 0
    daily_work_subtotal = 0
    validated_work_days = []  // igual convención que fixed_daily usa para su propio detalle
```

**Nuevo método compartido `computeAbsenceDiscount(Employee $employee, Payroll $payroll): array`** (§3.9), llamado desde **ambas** ramas de tiempo:

```text
if empleado.payroll_mode == 'operations':
    return []  // guarda explícita — esta rama nunca corre para operations

expected_days = días hábiles esperados del período según employee.scheduled_work_days y holidays (§3.9.1)
missing_days  = expected_days sin work_day_session closed/adjusted
para cada missing_day: resolver parámetros por esa fecha (§4.2) y calcular el monto según la
tabla de §3.9.4 (0 para fixed_daily salvo trazabilidad, valor/día real para hourly_legal)
retornar candidatos (antes de confirmación admin, ver §3.9.5)
```

Se invoca tanto en la rama `hourly_legal` de arriba como dentro de `computeFixedDailyEarnings()` (rama existente, sin romperla): en `fixed_daily` el resultado solo alimenta el detalle informativo, no resta nada de `daily_work_subtotal`.

`recalculatePayrollEmployeeTotals` (ya existente) debe extender su fórmula de `gross`/`net_payment` para incluir `legal_hourly_subtotal` y `absence_discount_total`, tal como ya lo hace hoy con `adjustments_subtotal`:

```text
gross = production_total + daily_work_subtotal + legal_hourly_subtotal + adjustments_subtotal
net_payment = gross - deductions_amount - advances_discount - absence_discount_total
```

**No olvidar `applyWorkSessionAdjustments()` (línea 191 hoy):** es el método que deja al admin corregir horas de entrada/salida **en el mismo momento de calcular la nómina**, antes de que se generen los montos — es el mecanismo que ya existe para que "las horas realmente trabajadas" queden bien antes de liquidar. Hoy solo acepta empleados `fixed_daily`; debe ampliarse a `usesWorkDaySessions()` (ver tabla de §2.5) para que también funcione con `hourly_legal`. Sin este cambio, el admin no podrá ajustar una marcación nocturna mal registrada antes de tomar la nómina.

### 4.4 Requests / validaciones

- `StoreEmployeeRequest` / `UpdateEmployeeRequest`: si `payroll_mode = 'hourly_legal'`, exigir `legal_monthly_salary` (o `base_salary` si se reutiliza, ver §2.1) `required|numeric|min:1` y `ordinary_hours_per_day` `required|numeric|min:1|max:12`.
- Nuevo `StorePayrollLegalParameterRequest` / `UpdatePayrollLegalParameterRequest`: validar que `effective_from < effective_to` (si `effective_to` no es null) y que no se solape con otra fila de la misma `company_id` (o global) — típico problema de rangos de fecha, usar consulta de solapamiento estándar.
- Todos los porcentajes `numeric|min:0|max:500` (dejar margen amplio, no asumir techo bajo — recordar que el dominical ya casi duplicó su valor histórico).

### 4.5 Endpoints nuevos

Siguiendo el mismo patrón ya usado por `PayrollPeriodicityController` y `PayrollConceptController` (recursos propios, no anidados bajo Settings):

| Método | Ruta | Acción |
|---|---|---|
| GET/POST | `/payroll-legal-parameters` | Listar / crear tramo de vigencia |
| PUT/DELETE | `/payroll-legal-parameters/{id}` | Editar / eliminar (solo si no hay nóminas **aprobadas/pagadas** liquidadas con ese tramo — si las hay, bloquear eliminación, permitir solo cerrar `effective_to` y crear tramo nuevo) |
| GET/POST | `/holidays` | Listar / crear festivo manual |
| DELETE | `/holidays/{id}` | Eliminar (solo `source = 'manual'`; los `calculated` se regeneran con el comando) |
| POST | `/holidays/sync` | Ejecutar `HolidayService::syncYear` desde UI para el año indicado |

### 4.6 Autorización — el empleador/administrador de empresa SÍ debe poder parametrizar

Requisito explícito: "todas estas reglas... deben quedar en un módulo donde se puedan parametrizar por el empleador o administrador" — es decir, esto **no** debe quedar encerrado solo para `super_admin` de la plataforma. Split de dos niveles, usando el mismo `company_id` nullable de §2.2:

- **Admin de empresa** (mismo rol que ya administra `PayrollConcept`/`PayrollPeriodicity`): puede crear/editar/eliminar filas de `payroll_legal_parameters` **con su propio `company_id`** — esto le permite ajustar jornada, horarios, recargos, topes y el nuevo parámetro de descuento por inasistencia **solo para su empresa**, sin tocar ni ver las filas de otras empresas. Es la vía normal de uso para lo que se pidió.
- **`super_admin`** conserva control exclusivo sobre la fila **global** (`company_id IS NULL`) — el valor legal por defecto que hereda cualquier empresa que no haya creado su propia fila. Esto evita que un error de una empresa individual corrompa el default de todas las demás, pero no le quita autonomía a cada empresa sobre sus propios parámetros.
- `PayrollLegalParameterPolicy`: `viewAny`/`create`/`update`/`delete` permiten admin de empresa **si** `$parameter->company_id === $user->company_id`; para `company_id === null` exigir `$user->isSuperAdmin()`.
- `HolidayPolicy`: los festivos (§2.3) sí son de alcance nacional (no dependen de la empresa), así que su gestión (sincronizar/agregar manual) puede quedar en `super_admin` o en cualquier admin de empresa indistintamente — es información compartida, no hay "override por empresa" que proteger.
- Mantener en la UI (§5.3) el mismo disclaimer de verificar con asesor legal/contable, ahora dirigido explícitamente al admin de empresa que va a poder tocar esto por sí mismo.

---

## 5. FRONTEND — CAMBIOS DE UI

### 5.1 `Employees/Create.tsx` y `Edit.tsx`

- Modalidad de nómina: agregar tercera opción "Por horas — liquidación legal (jornada, recargos y extras)" junto a las dos ya existentes.
- Si se selecciona `hourly_legal`: mostrar `legal_monthly_salary` (o el campo que se decida reutilizar), `ordinary_hours_per_day` (default 8) y checkbox `is_exempt_from_overtime` con tooltip explicando el art. 162 CST (cargos de dirección, confianza y manejo).
- Si se selecciona `fixed_daily` **o** `hourly_legal` (cualquier modalidad salarial por tiempo): mostrar selector de `scheduled_work_days` (checkboxes lunes-domingo, default lunes-sábado marcado) — es la base para detectar inasistencias sin marcar (§3.9). **No** mostrar este campo para `operations`.

### 5.2 `Payrolls/Show.tsx`

Para cada empleado `hourly_legal`, sección expandible nueva (paralela a la que ya existe para `fixed_daily`):

- Tabla por día del período: fecha, entrada, salida, horas ordinarias, horas nocturnas, horas extra, ¿dominical/festivo?, valor del día.
- Resumen: salario base del período + recargo nocturno + recargo dominical/festivo + horas extra = `legal_hourly_subtotal`.
- Si `overtime_limit_alerts` no está vacío: banner de advertencia (amarillo/rojo) listando los días/semanas que excedieron el tope legal.
- Reutilizar el mismo patrón de edición de tiempos que ya existe para `fixed_daily` (celdas editables antes de recalcular) — el admin edita la sesión, no los totales calculados directamente.

**Bloque nuevo — "Días sin marcación" (§3.9), visible para `fixed_daily` y `hourly_legal` por igual, antes de calcular/recalcular:**

- Lista de fechas candidatas (días hábiles esperados según `scheduled_work_days` sin sesión `closed`/`adjusted`).
- Checkbox por fecha "Descontar" — preseleccionado según `parámetros.discount_unexcused_absences` vigente; el admin puede desmarcarlo y escribir una nota ("justificada: ...") para excluirlo del descuento.
- Para `hourly_legal`: mostrar el monto que representa cada día marcado (§3.9.4) y el total `absence_discount_total` reflejado en el neto.
- Para `fixed_daily`: mostrar la lista igual, pero solo como información — dejar claro en la UI que no resta nada adicional (el día ya no se pagó al no existir la sesión).
- Si `parámetros.discount_unexcused_absences` está en `false`, mostrar el bloque igual (informativo) pero sin checkboxes activos, con nota: "El descuento por inasistencia está desactivado para esta empresa. Actívalo en Parámetros Legales de Nómina si aplica."

### 5.3 Nueva pantalla `PayrollLegalParameters/Index.tsx`

- Tabla de tramos de vigencia (desde/hasta, jornada semanal, divisor, horarios, %, topes, **y ahora** descuento por inasistencia).
- Sección propia dentro del formulario de tramo: switch "Descontar día hábil sin marcación" (`discount_unexcused_absences`) + campo numérico "% a descontar" (`absence_discount_percent`, default 100) — con el tooltip del caveat legal de §3.9 (art. 113 CST sobre multas vs. simple no-pago) junto al switch.
- Botón "Nuevo tramo" — al guardar uno con `effective_from` posterior al último, sugerir auto-completar `effective_to = null` y cerrar automáticamente el `effective_to` del tramo anterior (evitar huecos/solapes manuales).
- Si el usuario es admin de empresa (no `super_admin`): solo ve/edita los tramos de su propia `company_id` (§4.6); puede ver de solo lectura el tramo global vigente como referencia, pero no editarlo.
- Semilla inicial: cargar la tabla de §0 completa (2023 → hoy) para que el sistema pueda recalcular nómina histórica correctamente si algún día se reprocesa, con `discount_unexcused_absences = false` en todos los tramos globales sembrados.
- Mensaje fijo en la pantalla: *"Estos valores determinan cómo se paga la jornada, los recargos, las horas extra y las inasistencias de todas las nóminas. Verifícalos con tu asesor legal/contable antes de aprobar nómina."*

### 5.4 Nueva pantalla `Holidays/Index.tsx`

- Lista de festivos por año (filtro de año), badge "calculado" vs "manual".
- Botón "Sincronizar año" → llama `POST /holidays/sync`.
- Botón "Agregar festivo manual" (para casos como el de la Ley 2578/2026 mencionado en §2.3).

### 5.5 Reportes

- Nuevo reporte opcional: **Horas extra y recargos por empleado** (rango de fechas), desglosado por tipo (nocturno, dominical/festivo, extra diurna/nocturna) — útil para auditoría y para el contador.
- No eliminar reportes existentes.

---

## 6. PERMISOS (`PermissionHelper` / seed)

Siguiendo el formato ya usado (módulo → páginas → acciones):

```php
'payroll_legal_parameters' => [
    'display' => 'Parámetros Legales de Nómina',
    'icon' => 'ScaleIcon',
    'order' => <siguiente disponible>,
    'pages' => [
        'index' => [
            'display' => 'Parámetros Legales',
            'route' => 'payroll-legal-parameters.index',
            'actions' => ['view', 'create', 'edit', 'delete'],
        ],
    ],
],
'holidays' => [
    'display' => 'Festivos',
    'icon' => 'CalendarDaysIcon',
    'order' => <siguiente disponible>,
    'pages' => [
        'index' => [
            'display' => 'Festivos',
            'route' => 'holidays.index',
            'actions' => ['view', 'create', 'delete', 'sync'],
        ],
    ],
],
```

Actualizar el rol demo de super_admin/admin empresa según lo decidido en §4.6. Añadir permiso de lectura del desglose legal en `payrolls.show` si el proyecto maneja sub-acciones granulares (o reusar `payrolls.show.view`).

---

## 7. SEEDERS Y FACTORIES

- `PayrollLegalParameterSeeder`: inserta los 5 tramos históricos de §0.1-§0.4 (global, `company_id = null`) para que cualquier empresa nueva ya tenga cobertura desde 2023 hasta hoy sin configuración manual.
- `HolidaySeeder` / comando `holidays:sync`: generar 2023-2028 al momento de correr seeders de desarrollo.
- `EmployeeFactory`: agregar variante `hourly_legal` (ej. ~20% de los empleados demo) con `legal_monthly_salary` realista (>= SMMLV 2026) y `ordinary_hours_per_day = 8`.
- `DemoDataSeeder`: para 2-3 empleados `hourly_legal`, generar `work_day_sessions` cerradas que incluyan al menos: un día con hora extra, un día nocturno, un domingo o festivo trabajado — para que el detalle de §5.2 tenga datos que mostrar de entrada.

---

## 8. FUERA DE ALCANCE (v1) — no implementar salvo que se pida explícitamente

- Cesantías, intereses de cesantías, prima de servicios, vacaciones (son prestaciones sociales con reglas propias, no son parte de "horas y jornada").
- Aportes a seguridad social (salud, pensión, ARL) y parafiscales — hoy el sistema ya maneja deducciones porcentuales genéricas (`default_deductions`); no se tocan aquí.
- Programación/gestión del día de descanso compensatorio por trabajo dominical/festivo habitual (§3.5) — el sistema cuenta y alerta, no agenda.
- Jornada flexible real (distribución desigual en 4-6 días, art. 161 lit. c CST) — se documenta como simplificación en §3.7.
- Trámite/validación de la autorización del Ministerio del Trabajo para horas extra — solo se muestra un recordatorio en UI.
- Multi-país — todo el marco de §0 es específico de Colombia; `holidays.country_code` se deja preparado pero no se implementa lógica multi-país.
- Módulo formal de incapacidades/licencias/permisos/vacaciones — el sistema (§3.9) solo detecta "falta sesión ese día" y deja que el admin confirme o justifique manualmente; no hay flujo de solicitud/aprobación de ausencias ni carga de soportes médicos.
- Pérdida automática del pago del descanso dominical por inasistencia en la semana (art. 173 CST) — se documenta como consecuencia legal posible en §3.9, no se calcula ni se descuenta automáticamente.

---

## 9. NO REGRESIONES — CHECKLIST

- [ ] Empleados `operations` y `fixed_daily` existentes: nómina **idéntica** a antes (mismos totales con los mismos datos).
- [ ] Empleado `hourly_legal` sin sesiones en el período: `legal_hourly_subtotal = 0`, sin error.
- [ ] Cálculo con sesión que cruza medianoche: minutos repartidos correctamente entre franja diurna y nocturna.
- [ ] Cálculo con sesión en domingo: recargo dominical aplicado; si además hay minutos nocturnos, se combinan (factor 2.25 con los % vigentes hoy).
- [ ] Cálculo con minutos que exceden `ordinary_hours_per_day` en un día pero **no** exceden el tope semanal: se pagan como extra igual (el tope diario y el semanal son dos chequeos independientes, no solo uno).
- [ ] Empleado con `is_exempt_from_overtime = true`: nunca genera horas extra aunque trabaje más de la jornada.
- [ ] Cambiar un tramo en `payroll_legal_parameters` (ej. subir el % dominical de prueba) y recalcular una nómina de un período cubierto por ese tramo: el resultado cambia acorde, sin tocar código.
- [ ] Nómina de un período que cruza dos tramos de vigencia distintos (ej. quincena que incluye el 15-jul con cambio de jornada): cada sesión se liquida con el tramo vigente en **su propio** `work_date` (§3.1), no con un único tramo para todo el período — probar con un período de prueba a caballo entre dos tramos sembrados.
- [ ] Multiempresa: parámetros legales y festivos no se cruzan entre `company_id` salvo los globales (`company_id = null`) que aplican a todas.
- [ ] `overtime_limit_alerts` aparece cuando corresponde y no bloquea el cálculo salvo que el `Setting` de bloqueo esté activado.
- [ ] **Botón de jornada:** con un empleado `hourly_legal` de prueba, el banner "Iniciar/Cerrar jornada" aparece y funciona igual que para `fixed_daily` (§2.5), sin cambios visuales en `WorkDayBanner.tsx`.
- [ ] Con un empleado `fixed_daily` existente: el banner y su cálculo de nómina siguen **exactamente igual** que antes de este cambio (la ampliación de `usesWorkDaySessions()` no le cambia nada).
- [ ] El admin puede editar (`applyWorkSessionAdjustments`) las horas de una sesión de un empleado `hourly_legal` **antes** de calcular la nómina, igual que ya puede con `fixed_daily`.
- [ ] **Quincena:** una sesión que cruza medianoche justo en el borde de dos períodos se liquida completa en la quincena de su `work_date` de inicio, nunca partida ni duplicada (§3.8.1); crear dos nóminas del mismo `type` con períodos solapados sigue bloqueado por `StorePayrollRequest` (§3.8.2).
- [ ] Intentar cerrar o ajustar una `work_day_session` cuya fecha ya cae dentro de una nómina **pagada**: bloqueado con mensaje claro (si se implementó el refuerzo de `paidPeriodCoversDate` sugerido en §2.5), para `fixed_daily` y `hourly_legal` por igual.
- [ ] Importar empleados `hourly_legal` por el flujo CSV existente (`EmployeeUserImportStrategy`): no se rechazan ni se guardan con datos incompletos.
- [ ] **Empleado `operations` con días sin producción:** el cálculo de inasistencia (§3.9) ni siquiera se ejecuta para él — verificar la guarda explícita, no solo que el resultado dé 0.
- [ ] Empleado `fixed_daily`/`hourly_legal` con `discount_unexcused_absences = false` (default): ningún descuento aunque falten marcaciones, aunque el bloque informativo de §5.2 sí puede mostrarse.
- [ ] Empleado `hourly_legal` con un día hábil esperado sin marcar y el parámetro activo: `absence_discount_total` corresponde al `absence_discount_percent` configurado, y se refleja en `net_payment`.
- [ ] El admin desmarca ("justifica") un día candidato antes de calcular: ese día queda fuera de `absence_discount_total`.
- [ ] Un festivo o un día fuera de `scheduled_work_days` (ej. domingo) **nunca** aparece como candidato a descuento.
- [ ] Cambiar `absence_discount_percent` (ej. de 100 a 50) y recalcular: el monto descontado cambia proporcionalmente.
- [ ] Admin de empresa (no `super_admin`) puede crear/editar el tramo de `payroll_legal_parameters` de **su** empresa (incluido activar el descuento por inasistencia) sin poder tocar el tramo global ni el de otra empresa.
- [ ] `npm run build` y `php artisan test` (si hay tests) sin errores.  

---

## 10. ORDEN DE IMPLEMENTACIÓN OBLIGATORIO

1. Migraciones: `payroll_legal_parameters` (incluidas `discount_unexcused_absences`/`absence_discount_percent`), `holidays`, columnas nuevas en `employees` (incluida `scheduled_work_days`) y `payroll_employees` (incluidas `absence_discount_total`/`absence_discount_detail`).
2. Modelos + relaciones + factories + el nuevo `Employee::usesWorkDaySessions()` (§2.5).
3. **Ampliar los puntos reales de la tabla de §2.5** (`WorkDaySessionService`, `WorkDaySessionController`, `ProductionController`, `StoreEmployeeRequest`/`UpdateEmployeeRequest`, `EmployeeController`, importación CSV) para que un empleado `hourly_legal` pueda existir, usar el botón de jornada y ser ajustado por el admin **antes** de seguir — sin esto no hay datos reales con los que probar los siguientes pasos. Incluir el refuerzo `paidPeriodCoversDate` en `closeSession()`.
4. `HolidayService` + comando `holidays:sync` + `PayrollLegalParameterSeeder` (cargar los 5 tramos históricos de §0 antes de seguir).
5. `PayrollLegalParameterResolver` (resolución por `work_date`, no por período — §3.1).
6. Extender `PayrollCalculationService` — rama `hourly_legal` (§4.3), método compartido `computeAbsenceDiscount()` (§3.9) invocado desde `hourly_legal` y desde `computeFixedDailyEarnings()`, y ampliar `applyWorkSessionAdjustments()`, sin tocar las otras dos ramas ni romper `operations` (guarda explícita de exclusión).
7. Policies + rutas + controladores nuevos (`PayrollLegalParameterController` con autorización de dos niveles §4.6, `HolidayController`).
8. Frontend: modalidad y `scheduled_work_days` en Empleados, pantallas `PayrollLegalParameters` (con la sección de descuento por inasistencia) y `Holidays`.
9. Frontend: sección de desglose en `Payrolls/Show.tsx` + banner de alertas de topes + bloque "Días sin marcación" con checkboxes de confirmación.
10. Reporte opcional de horas extra/recargos.
11. Seeders demo actualizados (empleados + sesiones de ejemplo con extra/nocturno/dominical, usando el botón de jornada real o el mismo mecanismo que ya usa el seeder de `fixed_daily`).
12. Revisar exportación/impresión de nómina (`Payrolls/Print.tsx`): incluir bloque de desglose legal cuando aplique.

---

## 11. INSTRUCCIÓN FINAL PARA CLAUDE OPUS

Implementa los cambios anteriores sobre el código existente del proyecto **Taller Confección**. **No** elimines ni alteres el comportamiento de `operations` ni `fixed_daily`. **No** crees un segundo botón, banner o mecanismo de fichaje: `hourly_legal` usa el mismo `WorkDayBanner.tsx` y las mismas rutas `work-day-sessions.*` que ya existen, solo ampliando las validaciones de modalidad listadas en §2.5. **No** hardcodees ningún porcentaje, horario u hora límite de §0 directamente en PHP/TypeScript — todo debe leerse de `payroll_legal_parameters` resuelto por el `work_date` de cada sesión (§2.2, §3.1, §4.2), nunca por la fecha del período completo. **No** dejes `TODO` ni código incompleto. **No** apliques el descuento por inasistencia (§3.9) a empleados `operations` bajo ninguna circunstancia — es una guarda explícita, no un efecto colateral. **No** restrinjas la gestión de `payroll_legal_parameters` a `super_admin` únicamente: el admin de cada empresa debe poder crear/editar la fila de su propia `company_id` (§4.6), que es justamente lo que se pidió. Si encuentras conflicto de nombres con el código ya generado (por ejemplo si `base_salary` sí está en uso para otra cosa), **adapta este spec al patrón existente** y dilo explícitamente en tu resumen final.

Al terminar, entrega:

1. Resumen de archivos tocados/creados.
2. Confirmación explícita de qué campo se usó para `legal_monthly_salary` (reutilizado `base_salary` o campo nuevo) y por qué.
3. Los comandos:

```bash
php artisan migrate
php artisan holidays:sync --from=2023 --to=2028
php artisan db:seed --class=PayrollLegalParameterSeeder
php artisan db:seed --class=DemoDataSeeder   # si aplica
npm run build
```

4. Recordatorio explícito al usuario (en el resumen, no solo en este documento) de que los parámetros legales cargados deben ser **verificados por su contador o abogado laboral** antes de aprobar nómina real con esta modalidad.

---

## 12. FUENTES CONSULTADAS PARA LAS CIFRAS DE §0 (verificar vigencia antes de usar en producción)

- [Ministerio del Trabajo — Jornada nocturna desde las 7:00 p.m. y pago del 100% de dominicales y festivos](https://www.mintrabajo.gov.co/comunicados/2023/diciembre/jornada-nocturna-desde-las-7-00-p.m.-y-pago-del-100-de-dominicales-y-festivos-hacen-parte-de-los-16-articulos-aprobados-de-la-reforma-laboral)
- [Ley 2466 de 2025 — Gestor Normativo, Función Pública](https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=260676)
- [RULEX — Jornada Laboral de 42 Horas en Colombia 2026](https://rulex.org/blog/jornada-laboral-42-horas-colombia-2026-guia)
- [Actualícese — Reducción de la jornada laboral semanal 2026 en Colombia](https://actualicese.com/jornada-laboral-semanal-2026-en-colombia/)
- [Actualícese — Liquidador reforma laboral 2025: valor del trabajo en días de descanso](https://actualicese.com/liquidador-reforma-laboral-2025-valor-del-trabajo-en-dias-de-descanso-dominicales-y-festivos/)
- [Buk — Recargo dominical y festivo 2026: nueva reforma laboral](https://www.buk.co/blog/recargo-dominical-y-festivo-reforma-laboral)
- [gusabogados — Horas Extras en Colombia 2026: qué cambió con la reforma](https://gusabogados.com/blog/posts/horas-extras-en-colombia-como-se-calculan-y-que-cambio-con-la-reforma)
- [Holland & Knight — Colombia decreta aumento del salario mínimo y auxilio de transporte 2026](https://www.hklaw.com/en/insights/publications/2025/12/colombia-decreta-aumento-del-salario-minimo-y-auxilio-de-transporte)
- [El Colombiano — Así quedan los 19 festivos de Colombia (Ley 2578 de 2026)](https://www.elcolombiano.com/colombia/calendario-puentes-festivos-colombia-2026-NA37373097)
- [El Colombiano — ¿Faltó al trabajo sin permiso? Esto es lo que le pueden descontar de su salario](https://www.elcolombiano.com/negocios/faltar-al-trabajo-sin-justificar-salario-descuentos-sanciones-LO26820193)
- [Gerencie.com — Descuento de días no trabajados](https://www.gerencie.com/en-la-liquidacion-del-contrato-de-trabajo-se-descuentan-los-dias-no-laborados-por-el-trabajador.html)
- [Infobae — La falta común que le puede costar dinero a un trabajador](https://www.infobae.com/colombia/2025/03/12/la-falta-comun-que-le-puede-costar-dinero-y-hasta-el-empleo-a-un-trabajador-que-gana-el-salario-minimo-o-mas/)
- [Función Pública — Concepto 177601 de 2022 (Gestor Normativo)](https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=189108)
- [Corte Constitucional — Sentencia C-478/07 (revisar antes de fijar `absence_discount_percent`)](https://www.corteconstitucional.gov.co/relatoria/2007/c-478-07.htm)
- [Magneto — ¿Cuánto me descuentan si falto al trabajo sin justa causa?](https://www.magneto365.com/co/blog/cuanto-me-descuentan-por-faltar-sin-justa-causa)

---

*Documento: Nómina — tercera modalidad "por horas con liquidación legal" (jornada, recargos y horas extra, Colombia) — Agosto 2026 — Compatible con `PROMPT_TALLER_CONFECCION.md`, `PROMPT_AJUSTE_NOMINA_SALARIO_DIARIO.md` y `PROMPT_NOMINA_CONCEPTOS_MANUALES.md`.*
