# Prompt de implementación — Rediseño funcional del módulo de Perfil y Empleados

> Pega este archivo completo como prompt en tu agente de código (Claude Code, Cursor, etc.) con el repo `ERP_CONFECCION` abierto.

---

## 0. Contexto del proyecto

- Stack: **Laravel + Inertia.js + React + TypeScript** (Vite). Multi-tenant por empresa, con roles y permisos.
- Archivos afectados principales:
  - `resources/js/Pages/Profile/Edit.tsx`
  - `resources/js/Pages/Employees/Show.tsx`, `Index.tsx`, `Edit.tsx`, `Create.tsx`
  - `app/Http/Controllers/ProfileController.php`
  - `app/Http/Controllers/EmployeeController.php`
  - `app/Http/Controllers/UserController.php`, `RoleController.php`
  - `app/Http/Controllers/AdvanceController.php`, `ProductionController.php`, `PayrollController.php`, `PayrollReceiptController.php`
  - `routes/web.php`
- Sistema visual: **Nocturne** (fondo oscuro `#161826`, texto `#e9e9ed`, acento único `#9184d9`, Inter, radio 8px, densidad compacta, botones **outline** no rellenos, iconos **Phosphor**). Nada de hex sueltos: usar tokens/variables.

**Objetivo:** el módulo de perfiles hoy es un formulario de datos. Debe convertirse en un módulo **operativo**: autoservicio para el empleado, ficha 360 con acciones y auditoría para administración, y una sola pantalla gobernada por permisos.

---

## 1. Alcance funcional (qué construir)

### 1.1 Unificar Perfil y Detalle de empleado en un solo módulo

- Crear un componente compartido `resources/js/Pages/People/Profile.tsx` que renderice **la misma ficha** en dos modos:
  - `mode="self"` → ruta `/perfil` (el usuario autenticado).
  - `mode="admin"` → ruta `/empleados/{employee}` (otro empleado).
- `Profile/Edit.tsx` y `Employees/Show.tsx` pasan a ser wrappers delgados que montan `People/Profile.tsx`. No duplicar layout ni lógica de tabs.
- El backend expone un único payload normalizado (`EmployeeProfileResource`) con la forma:
  ```
  { identity, contact, payroll, bankAccount, account, metrics, alerts, permissions, requests, auditLog }
  ```
- `permissions` es un objeto plano de booleanos calculado en servidor (`canEditIdentity`, `canViewSalary`, `canViewBankAccount`, `canManageAccess`, `canApproveRequests`, `canEditOwnContact`, …). **El frontend nunca decide permisos**, solo los consume.

### 1.2 Autoservicio del empleado (opción 1a)

En modo `self`:

- Cabecera con resumen de la **quincena en curso**: producido, anticipos, **neto estimado** y barra de progreso contra la meta de unidades.
- Acciones que crean **solicitudes**, no escrituras directas:
  1. **Solicitar anticipo** → nuevo `AdvanceRequest` (monto, motivo, fecha) en estado `pending`.
  2. **Actualizar cuenta bancaria** → `ProfileChangeRequest` con los campos propuestos; el dato vigente no cambia hasta aprobación.
  3. **Reportar corrección de producción** → `ProductionCorrectionRequest` sobre un registro concreto.
- Bloque **"Mis solicitudes"** con estado (`pending` / `approved` / `rejected`), fecha y aprobador.
- Botón **"Mi desprendible"**: descarga del recibo de nómina del periodo (reusar `PayrollReceiptController`).
- Campos editables directamente por el propio empleado: nombre, apellido, teléfono, contacto de emergencia, foto. **Nunca**: salario, tarifa, modalidad de pago, rol, estado, cuenta bancaria (esos van por solicitud).

### 1.3 Ficha 360 con acciones y auditoría (opción 1b)

En modo `admin`:

- **Alertas accionables** en la parte superior, calculadas en servidor (`alerts[]`), cada una con etiqueta y acción directa:
  - sin cuenta de acceso activa → "Crear acceso"
  - datos obligatorios faltantes (dirección, contacto de emergencia, cuenta bancaria) → "Completar"
  - producción sin registrar en N días → "Revisar"
  - solicitudes pendientes del empleado → "Aprobar"
- **Guardado por sección**: cada bloque (Identidad, Contacto, Nómina, Datos de pago, Notas) tiene su propio `Editar sección` → `PATCH /empleados/{employee}/seccion/{section}` con validación parcial. Eliminar el formulario monolítico.
- **Bitácora / auditoría** por empleado: tabla `employee_audit_logs` (`employee_id`, `actor_id`, `event`, `field`, `old_value`, `new_value`, `created_at`). Registrar automáticamente cambios de rol, restablecimientos de contraseña, activación/desactivación de acceso, cambios de salario/tarifa/cuenta, aprobaciones de anticipo y correcciones de producción. Valores sensibles se guardan enmascarados.
- La gestión de acceso deja de ser una pestaña aislada: crear/suspender/restablecer se dispara desde la alerta y desde el bloque "Cuenta de acceso", con modales de confirmación (`.dialog`).

### 1.4 Permisos por rol y ciclo de vida (opción 1c)

- La misma pantalla, distinto contenido según rol:
  - **Operario**: su propia ficha (1.2), sin datos de otros.
  - **Supervisor**: producción, eficiencia y bandeja de aprobaciones de su módulo; **salario y cuenta bancaria enmascarados** con estado visible "Restringido" (no ocultos silenciosamente).
  - **Admin de empresa**: todo lo de su empresa.
  - **Super admin**: todo, más el selector de empresa.
- **Ciclo de vida** del empleado como estado explícito: `contratado → documentos_ok → acceso_creado → activo → retirado`, con checklist de onboarding y flujo de retiro (fecha de retiro, motivo, liquidación pendiente, revocación de acceso automática).
- **Bandeja "Pendientes de mi aprobación"** dentro de la ficha para quien tenga `canApproveRequests`, con acciones Aprobar / Rechazar (rechazo exige motivo).

---

## 2. Trabajo de backend

### 2.1 Migraciones nuevas

1. `employee_requests` — solicitudes unificadas: `id`, `employee_id`, `type` (`advance|profile_change|production_correction`), `payload` (json), `status`, `reviewed_by`, `reviewed_at`, `rejection_reason`, timestamps.
2. `employee_audit_logs` — según 1.3.
3. Campos en `employees`: `lifecycle_status`, `emergency_contact_name`, `emergency_contact_phone`, `termination_date`, `termination_reason`, `photo_path`.

### 2.2 Controladores / acciones

- `EmployeeProfileController@show` — payload unificado para ambos modos.
- `EmployeeProfileController@updateSection` — guardado parcial por sección + escritura en auditoría.
- `EmployeeRequestController@store|approve|reject` — ciclo de solicitudes; al aprobar, aplica el cambio real y registra auditoría.
- `EmployeeAccessController@create|reset|toggle` — cuenta de acceso; contraseña temporal mostrada una sola vez y `must_change_password = true`.
- Policies: `EmployeePolicy` (`view`, `updateSection`, `viewSalary`, `viewBankAccount`, `manageAccess`, `approveRequests`), siempre con alcance por empresa (tenant).

### 2.3 Rutas (`routes/web.php`)

```
GET    /perfil                                  → self
GET    /empleados/{employee}                    → admin
PATCH  /empleados/{employee}/seccion/{section}
POST   /empleados/{employee}/solicitudes
POST   /solicitudes/{request}/aprobar
POST   /solicitudes/{request}/rechazar
POST   /empleados/{employee}/acceso
POST   /empleados/{employee}/acceso/restablecer
PATCH  /empleados/{employee}/acceso/estado
GET    /empleados/{employee}/desprendible/{period}
```

---

## 3. Reglas de UI (Nocturne, obligatorias)

- Cargar `styles.css` del sistema y usar **solo** `var(--color-*)`, `var(--space-*)`, `var(--radius-*)`, `var(--shadow-sm|md|lg)`.
- Componentes del sistema: `.card` (+ `.card-title`, `.elev-sm/md`), `.btn` (`.btn-primary` = outline con acento, `.btn-secondary`, `.btn-ghost`), `.tag` (`.tag-accent`, `.tag-outline`), `.field` + `.input`, `.seg` + `.seg-opt`, `.table`, `.dialog-backdrop` + `.dialog`, `.nav`.
- Iconos **Phosphor** en todo (`ph ph-*`). Sin emojis.
- **Nunca** rellenar áreas grandes con el acento; el acento es línea, borde y marca.
- Foco de teclado: `:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }` en todo elemento interactivo.
- Contraste: texto 4.5:1 mínimo; texto tamaño párrafo en acento usa el paso profundo del ramp, no el acento base.
- Etiquetas de estado siempre con **texto**, no solo color (`Activo`, `En revisión`, `Restringido`).
- Densidad compacta: escala de espaciado 0.7×, radios 8px, sombras solo desde los tokens.
- Datos enmascarados en monoespaciada (`•••• •••• 4821`) y con icono de candado cuando es restricción de permiso.
- Tablas: responsive con contenedor `overflow-x:auto`; montos alineados a la derecha y en 600 de peso.

---

## 4. Criterios de aceptación

1. Existe **una** implementación de la ficha; `Profile/Edit.tsx` y `Employees/Show.tsx` no duplican markup ni lógica de pestañas.
2. Un operario autenticado puede: ver su neto estimado, solicitar un anticipo, pedir cambio de cuenta bancaria, reportar una corrección de producción y descargar su desprendible — sin poder editar salario, tarifa, rol ni cuenta bancaria directamente.
3. Un supervisor ve producción y eficiencia, ve "Restringido" en salario y cuenta bancaria, y puede aprobar/rechazar solicitudes de su módulo (rechazo con motivo obligatorio).
4. Un admin puede editar cada sección de forma independiente; un error de validación en una sección no descarta lo escrito en otra.
5. Toda acción sensible (rol, contraseña, acceso, salario, cuenta, aprobación) queda en `employee_audit_logs` con actor y fecha, visible en la bitácora de la ficha.
6. Las alertas de la ficha desaparecen solas cuando su causa se resuelve.
7. Todo permiso se evalúa en servidor mediante `EmployeePolicy`; el cliente solo lee `permissions`. Intentar la ruta directamente sin permiso devuelve 403.
8. Todo el módulo respeta el alcance por empresa: ningún usuario ve empleados de otra empresa.
9. Cero hex, fuentes o píxeles hard-codeados fuera de los tokens de Nocturne; sin anillo de foco azul por defecto.
10. Funciona por teclado completo y en ancho de móvil (las tablas hacen scroll horizontal, las rejillas colapsan a una columna).

---

## 5. Orden de implementación sugerido

1. Migraciones + modelos + `EmployeePolicy` + `EmployeeProfileResource`.
2. `EmployeeProfileController@show` y la ficha compartida `People/Profile.tsx` en modo lectura (ambas rutas).
3. Guardado por sección + auditoría.
4. Cuenta de acceso (crear / restablecer / activar-desactivar) con modales.
5. Solicitudes (crear, aprobar, rechazar) + bandeja de aprobaciones + "Mis solicitudes".
6. Métricas de quincena, meta y desprendible.
7. Ciclo de vida + alertas + checklist de onboarding/retiro.
8. Pasada de accesibilidad y contraste.

---

## 6. Fuera de alcance (no tocar ahora)

- Rediseño del módulo de nómina, producción o anticipos como pantallas propias (solo se consumen desde la ficha).
- Cambios en el sistema de facturación/planes ni en la landing.
- Migración de datos históricos a `employee_audit_logs` (la bitácora arranca vacía).
