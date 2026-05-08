# PROMPT COMPLETO — SISTEMA DE GESTIÓN DE TALLERES DE CONFECCIÓN
## Para Claude Opus / Claude 4 — Generación de Código Completo sin Errores

---

> **INSTRUCCIONES DE USO:**
> Copia este prompt completo y pégalo directamente en Claude Opus.
> El modelo generará TODO el código paso a paso siguiendo el orden indicado.

---

## CONTEXTO Y ROL

Eres un desarrollador full-stack senior experto en Laravel 12, PHP 8.3, React, Inertia.js y Tailwind CSS. Tu tarea es construir desde cero una aplicación web multiempresa completamente funcional para la administración y control de talleres de confección. Debes generar **todo el código**, incluyendo migraciones, modelos, controladores, rutas, componentes React, layouts, configuración, seeders y cualquier archivo necesario para que el proyecto compile y funcione sin errores.

Sigue estrictamente el orden indicado. Antes de generar cada archivo, anuncia su ruta. No omitas ningún archivo. No uses placeholders como `// TODO` o `// implementar`. Todo el código debe estar completo y funcional.

---

## 1. STACK TECNOLÓGICO EXACTO

```
Backend:
  - Laravel 12 (última versión estable)
  - PHP 8.3+
  - Laravel Sanctum (autenticación API)
  - Laravel Spatie Permission (roles y permisos)
  - API REST + Inertia.js

Frontend:
  - React 18 con TypeScript
  - Inertia.js v2 (@inertiajs/react)
  - Tailwind CSS v3
  - Heroicons (@heroicons/react)
  - Headless UI (@headlessui/react)
  - Recharts (gráficas)
  - React Hook Form + Zod (formularios y validación)
  - Sonner (notificaciones toast)
  - Modo oscuro / claro con clase 'dark' en <html>

Base de Datos:
  - MySQL 8+ o PostgreSQL 15+
  - Soporte multiempresa con campo company_id en todas las tablas principales
```

---

## 2. ARQUITECTURA MULTIEMPRESA

```
Modelo de datos:
  - Tabla: companies (empresas/talleres)
  - Todas las tablas de negocio tienen: company_id (foreign key → companies.id)
  - Middleware: EnsureUserBelongsToCompany
  - Scope global: CompanyScope aplicado en todos los modelos de negocio
  - Super Admin puede ver todas las empresas
  - Admin solo ve su empresa
  - Empleados solo ven sus propios datos

RELACIÓN USUARIO ↔ EMPLEADO:
  - Todo empleado del taller ES TAMBIÉN un usuario de la aplicación.
  - La tabla employees tiene un campo user_id (nullable, fk → users.id).
  - La tabla users tiene un campo employee_id (nullable, fk → employees.id).
  - Cuando se crea un empleado, el sistema crea automáticamente una cuenta
    de usuario vinculada con el rol que el admin le asigne en ese momento.
  - Si el empleado ya existe sin cuenta, se puede "activar acceso" desde
    su ficha para generarle usuario + contraseña.
  - Si se desactiva al empleado (is_active = false), su cuenta de usuario
    también se desactiva automáticamente (is_active = false en users).
  - Un usuario puede no ser empleado (ej: admin contable externo).
  - Un empleado puede no tener acceso al sistema (sin cuenta de usuario).
  - Los permisos del empleado-usuario se controlan 100% desde el módulo
    de Roles y Permisos, igual que cualquier otro usuario.
```

---

## 3. MÓDULOS DEL SISTEMA

### 3.1 Módulo de Autenticación
- Login con email y contraseña
- Registro de empresa + usuario administrador
- Recuperación de contraseña
- Gestión de sesiones
- Selector de empresa activa (para Super Admin)

### 3.2 Módulo de Empresas (Super Admin)
- CRUD completo de empresas
- Activar / desactivar empresa
- Ver estadísticas por empresa

### 3.3 Módulo de Empleados
- CRUD completo
- Campos: nombre, apellido, cédula/documento, teléfono, dirección, fecha_ingreso, estado (activo/inactivo), foto
- Asignación a empresa
- Historial de producción por empleado
- Historial de pagos por empleado

#### Vínculo Empleado ↔ Usuario del Sistema
- Al crear un empleado, el formulario incluye una sección "Acceso al sistema":
  - Toggle: "¿Este empleado tendrá acceso a la aplicación?"
  - Si está activado, muestra:
    - Email de acceso (pre-llenado con datos del empleado, editable)
    - Contraseña inicial (generada automáticamente, visible una sola vez)
    - Selección de rol (dropdown con los roles disponibles de la empresa)
  - Si está desactivado, el empleado solo existe como registro de producción/nómina
- En la ficha del empleado (Show) existe el panel "Cuenta de acceso":
  - Si no tiene usuario: botón "Crear acceso al sistema" → abre modal con email, rol
  - Si tiene usuario: muestra email, rol asignado, último acceso, estado de la cuenta
  - Botón "Cambiar rol" → selector de rol con confirmación
  - Botón "Desactivar acceso" / "Activar acceso" → cambia is_active del user vinculado
  - Botón "Restablecer contraseña" → genera nueva contraseña temporal y la muestra
- Al desactivar un empleado (is_active = false), se desactiva automáticamente
  su cuenta de usuario vinculada mediante un Observer en el modelo Employee
- El empleado-usuario ve en su dashboard solo SUS propias producciones y pagos,
  controlado por sus permisos (el rol define qué páginas y acciones puede hacer)

### 3.4 Módulo de Referencias (Prendas)
- CRUD de referencias de prendas
- Campos: código, nombre, descripción, imagen, estado
- Lista de operaciones por referencia con precio unitario

### 3.5 Módulo de Operaciones
- CRUD de operaciones de confección
- Campos: nombre, descripción, precio_base, estado
- Relación con referencias (tabla pivot: reference_operations con precio override)

### 3.6 Módulo de Producción
- Registro de producción diaria por empleado
- Campos: empleado, referencia, operación, cantidad, fecha, turno, observaciones
- Cálculo automático de valor producido (cantidad × precio_operación)
- Vista de producción por día / semana / mes
- Filtros por empleado, referencia, operación, rango de fechas
- Resumen de producción por empleado

### 3.7 Módulo de Nómina y Pagos
- Generación de nómina por período (quincenal/mensual)
- Cálculo automático basado en producción registrada
- Deducciones configurables (seguridad social, impuestos, anticipos)
- Anticipos / préstamos a empleados
- Liquidación de pago con desglose detallado
- Historial de pagos por empleado y período
- Marcar nómina como pagada / pendiente
- Exportar nómina (tabla HTML imprimible)

### 3.8 Módulo de Reportes
- Producción por empleado (rango de fechas)
- Producción por referencia
- Producción por operación
- Resumen de nómina por período
- Top empleados por producción
- Gráficas con Recharts

### 3.9 Módulo de Usuarios, Roles y Permisos — COMPLETAMENTE PARAMETRIZABLE Y DINÁMICO

El sistema de roles y permisos debe ser 100% configurable desde la interfaz, sin hardcodear permisos en el código. Cada empresa puede crear sus propios roles con acceso exacto a páginas y acciones.

#### 3.9.1 Modelo de Permisos Dinámicos

```
ESTRUCTURA DE PERMISOS:
  Cada permiso se define como: {módulo}.{página}.{acción}
  
  Módulos disponibles:
    - dashboard       → página: index
    - employees       → páginas: index, show, create, edit
    - references      → páginas: index, show, create, edit
    - operations      → páginas: index, create, edit
    - productions     → páginas: index, create, edit, report
    - payrolls        → páginas: index, show, create
    - advances        → páginas: index, create
    - reports         → páginas: production, payroll
    - users           → páginas: index, create, edit
    - roles           → páginas: index, create, edit
    - settings        → páginas: index

  Acciones por página:
    - view            → puede ver/acceder a la página
    - create          → puede crear registros
    - edit            → puede editar registros
    - delete          → puede eliminar registros
    - export          → puede exportar datos
    - calculate       → (payrolls) puede calcular nómina
    - approve         → (payrolls) puede aprobar nómina
    - pay             → (payrolls) puede marcar como pagada

  Ejemplo de permiso completo: "productions.index.view"
                                "payrolls.show.approve"
                                "employees.show.delete"
```

#### 3.9.2 Tabla de permisos del sistema (semilla fija, no editable)

```
Tabla: permissions (manejada por Spatie + registros propios)
  - Registrar TODOS los permisos posibles del sistema al hacer seed
  - Agruparlos por módulo para facilitar la UI del editor de roles
  - El sistema lee esta tabla para construir la matriz de permisos
```

#### 3.9.3 Roles Parametrizables por Empresa

```
Tabla: roles
  - id, name, display_name, description, company_id (nullable para roles globales),
    is_system (bool: los roles super_admin y admin no son editables),
    color (hex, para badge visual), created_at, updated_at

Tabla: role_has_permissions (Spatie estándar)
  - role_id, permission_id

Tabla: model_has_roles (Spatie estándar)
  - role_id, model_type, model_id

Roles del sistema (is_system = true, no editables):
  - super_admin: acceso total a todo (no pertenece a ninguna empresa)
  - admin: acceso total a su empresa

Roles personalizados (is_system = false, editables por admin):
  - La empresa puede crear tantos roles como necesite
  - Ejemplo: "Supervisor Producción", "Contador", "Auxiliar", "Solo Consulta"
  - Cada rol tiene una matriz visual de permisos configurable
```

#### 3.9.4 Perfil Dinámico de Usuario en Frontend

```
Al autenticarse, el sistema debe:
  1. Cargar el rol y todos sus permisos desde la BD
  2. Enviar al frontend via Inertia shared data:
     auth.user.permissions: string[]  → lista plana de permisos activos
     auth.user.role: { name, display_name, color }
     auth.user.accessible_pages: string[]  → páginas a las que tiene acceso

  3. El sidebar se construye DINÁMICAMENTE según accessible_pages:
     - Solo muestra los ítems de menú permitidos
     - Si no tiene view en ninguna sub-página de un módulo, oculta el módulo entero

  4. Dentro de cada página, los botones/acciones se muestran según permisos:
     - Botón "Crear" → solo si tiene {módulo}.{página}.create
     - Botón "Editar" → solo si tiene {módulo}.{página}.edit
     - Botón "Eliminar" → solo si tiene {módulo}.{página}.delete
     - Botón "Exportar" → solo si tiene {módulo}.{página}.export
     - Botones especiales (calcular, aprobar, pagar) → permisos específicos

  5. Rutas protegidas:
     - Middleware Laravel verifica permiso antes de cargar la página Inertia
     - Si no tiene acceso, redirige a /403 con mensaje descriptivo
     - El 403 muestra qué permiso falta (solo en desarrollo) o mensaje genérico
```

#### 3.9.5 Páginas React del Módulo

```
- resources/js/Pages/Roles/Index.tsx
  Lista de roles de la empresa:
    - Nombre, color badge, descripción, # usuarios asignados, sistema (badge)
    - Acciones: Ver permisos, Editar, Eliminar (solo roles no-sistema)
    - Botón "Crear nuevo rol"

- resources/js/Pages/Roles/Create.tsx
  Formulario en 2 partes:
  PARTE 1 — Datos del rol:
    - Nombre del rol (display_name)
    - Nombre interno (name, auto-generado desde display_name, editable)
    - Descripción
    - Color (color picker con presets)

  PARTE 2 — Matriz de permisos (el núcleo del módulo):
    Interfaz tipo "spreadsheet" visual:
    ┌─────────────────────┬──────┬────────┬────────┬──────────┬────────┬─────────┐
    │ Módulo / Página     │ Ver  │ Crear  │ Editar │ Eliminar │Exportar│Especial │
    ├─────────────────────┼──────┼────────┼────────┼──────────┼────────┼─────────┤
    │ ▼ PRODUCCIÓN        │      │        │        │          │        │         │
    │   Listado           │  ☑  │   ☑   │   ☑   │    ☐    │   ☑   │         │
    │   Registrar         │  ☑  │   ☑   │   ☐   │    ☐    │        │         │
    │   Reportes          │  ☑  │        │        │          │   ☑   │         │
    ├─────────────────────┼──────┼────────┼────────┼──────────┼────────┼─────────┤
    │ ▼ NÓMINA            │      │        │        │          │        │         │
    │   Listado           │  ☑  │   ☑   │   ☐   │    ☐    │   ☑   │         │
    │   Detalle           │  ☑  │        │        │          │   ☑   │Calcular ☐│
    │                     │      │        │        │          │        │Aprobar ☐│
    │                     │      │        │        │          │        │Pagar   ☐│
    └─────────────────────┴──────┴────────┴────────┴──────────┴────────┴─────────┘

    Funcionalidades de la matriz:
    - Checkbox "Seleccionar todo el módulo" en el header de cada sección
    - Checkbox "Seleccionar toda la columna" (ej: marcar todos los "Ver")
    - Preset buttons: "Solo lectura", "Operador", "Supervisor", "Administrador"
      que pre-marcan combinaciones comunes
    - Contador de permisos seleccionados en tiempo real
    - Destacar visualmente las acciones especiales (calcular/aprobar/pagar)

- resources/js/Pages/Roles/Edit.tsx
  Mismo formulario que Create pero pre-cargado
  Los roles is_system solo permiten ver, no editar

- resources/js/Pages/Roles/Show.tsx
  Vista de solo lectura de la matriz de permisos de un rol
  Útil para auditoría

- resources/js/Pages/Users/Index.tsx
  Tabla: avatar, nombre, email, rol (badge con color), empresa, 
  último acceso, estado, acciones

- resources/js/Pages/Users/Create.tsx
  Formulario:
    - Nombre, apellido, email, contraseña
    - Selección de rol (dropdown con color badge + descripción)
    - Empresa (solo visible para super_admin)
    - Estado (activo/inactivo)

- resources/js/Pages/Users/Edit.tsx
  Igual que Create, con opción de cambiar contraseña opcional

- resources/js/Pages/Users/Show.tsx
  Perfil del usuario:
    - Datos personales
    - Rol asignado con lista expandida de permisos agrupados
    - Historial de accesos (últimos 10 logins con IP y fecha)
    - Botón "Simular sesión como este usuario" (solo super_admin)
```

#### 3.9.6 Componentes específicos del módulo

```
- resources/js/Components/Permissions/PermissionMatrix.tsx
  El componente visual de la matriz. Props:
    - permissions: PermissionGroup[]  → estructura de permisos disponibles
    - value: string[]                 → permisos actualmente seleccionados
    - onChange: (selected: string[]) → callback
    - readonly?: boolean

- resources/js/Components/Permissions/PermissionPresets.tsx
  Botones de preset que llaman onChange con combinaciones predefinidas

- resources/js/Components/Permissions/PermissionBadge.tsx
  Muestra un permiso individual como chip/badge legible

- resources/js/Components/Roles/RoleBadge.tsx
  Badge con color del rol + display_name

- resources/js/Components/UI/Can.tsx
  Componente wrapper React:
    <Can permission="productions.index.create">
      <Button>Registrar Producción</Button>
    </Can>
  Si no tiene el permiso, renderiza null (o un fallback opcional)
```

#### 3.9.7 Hook y contexto de permisos

```
- resources/js/hooks/usePermissions.ts
  Funciones exportadas:
    can(permission: string): boolean
    canAny(permissions: string[]): boolean
    canAll(permissions: string[]): boolean
    hasRole(roleName: string): boolean
    accessiblePages(): string[]
    
  Ejemplo de uso en cualquier componente:
    const { can } = usePermissions()
    const canDelete = can('employees.index.delete')

- resources/js/contexts/PermissionsContext.tsx
  Provider que lee auth.user.permissions de Inertia shared data
  y expone las funciones del hook a todo el árbol de componentes
```

#### 3.9.8 Middleware y autorización Laravel

```
- app/Http/Middleware/CheckPermission.php
  Middleware parametrizable que recibe el permiso requerido:
  Route::get('/productions', [...])
    ->middleware('permission:productions.index.view')

- app/Helpers/PermissionHelper.php
  getPermissionMatrix(): array
    Retorna todos los permisos del sistema agrupados por módulo/página
    Esta función es la FUENTE DE VERDAD usada por:
      a) El seeder para crear los permisos en BD
      b) El frontend (vía Inertia shared data) para construir la matriz UI
      c) El middleware para validar permisos en rutas

  Estructura retornada:
  [
    'dashboard' => [
      'display' => 'Dashboard',
      'icon' => 'HomeIcon',
      'pages' => [
        'index' => [
          'display' => 'Inicio',
          'actions' => ['view']
        ]
      ]
    ],
    'productions' => [
      'display' => 'Producción',
      'icon' => 'ClipboardDocumentListIcon',
      'pages' => [
        'index' => [
          'display' => 'Listado de Producción',
          'actions' => ['view', 'create', 'edit', 'delete', 'export']
        ],
        'report' => [
          'display' => 'Reportes de Producción',
          'actions' => ['view', 'export']
        ]
      ]
    ],
    'payrolls' => [
      'display' => 'Nómina',
      'icon' => 'BanknotesIcon',
      'pages' => [
        'show' => [
          'display' => 'Detalle de Nómina',
          'actions' => ['view', 'calculate', 'approve', 'pay', 'export']
        ]
      ]
    ],
    // ... todos los módulos
  ]
```

#### 3.9.9 Seeder actualizado

```
- database/seeders/RolesPermissionsSeeder.php
  1. Leer PermissionHelper::getPermissionMatrix()
  2. Crear TODOS los permisos en BD con Spatie
  3. Crear roles del sistema:
     - super_admin: todos los permisos
     - admin: todos los permisos de su empresa
  4. Crear roles de ejemplo personalizados:
     - "Supervisor de Producción":
         productions.*.view, productions.*.create, productions.*.edit
         employees.index.view, employees.show.view
         reports.production.view, reports.production.export
     - "Auxiliar Contable":
         payrolls.*.view, payrolls.show.calculate, payrolls.show.export
         advances.*.view, advances.*.create
         reports.payroll.*
     - "Solo Consulta":
         *.*.view únicamente en todos los módulos
     - "Operario de Producción":
         (rol pensado para empleados-usuarios del taller)
         dashboard.index.view
         productions.index.view  (solo ve SUS propias producciones → filtrado por employee_id)
         productions.report.view (solo sus datos)
         payrolls.index.view     (solo ve nóminas donde él aparece)
         payrolls.show.view      (solo su renglón de la nómina)
         (NO puede ver empleados de otros, referencias, operaciones, usuarios, roles, etc.)
```

#### 3.9.10 Registro de Auditoría de Accesos

```
Tabla: access_logs
  - id, user_id, company_id, action, ip_address, user_agent,
    permission_checked (nullable), result (allowed/denied),
    created_at

- app/Models/AccessLog.php
- app/Observers/UserObserver.php
  Registrar en access_logs cada login/logout y acceso denegado
```

---

## 4. ESTRUCTURA DE ARCHIVOS A GENERAR

Genera los archivos en este orden exacto:

### PASO 1 — Configuración inicial del proyecto

```
1.1 Crear proyecto Laravel 12:
    composer create-project laravel/laravel taller-confeccion
    cd taller-confeccion

1.2 Instalar dependencias PHP:
    composer require inertiajs/inertia-laravel
    composer require tightenco/ziggy
    composer require spatie/laravel-permission
    composer require laravel/sanctum

1.3 Instalar dependencias Node:
    npm install @inertiajs/react react react-dom
    npm install @types/react @types/react-dom typescript
    npm install @headlessui/react @heroicons/react
    npm install recharts
    npm install react-hook-form @hookform/resolvers zod
    npm install sonner
    npm install -D tailwindcss postcss autoprefixer
    npm install -D @tailwindcss/forms

1.4 Generar archivos de configuración:
    npx tailwindcss init -p
    php artisan inertia:middleware
    php artisan vendor:publish --provider="Spatie\Permission\PermissionServiceProvider"
```

### PASO 2 — Archivos de configuración

Genera el contenido completo de:

```
- vite.config.ts
- tailwind.config.js  (con darkMode: 'class', paths de React/Inertia)
- tsconfig.json
- postcss.config.js
- .env.example
- config/app.php  (timezone: 'America/Bogota')
- bootstrap/app.php  (con middleware HandleInertiaRequests)
```

### PASO 3 — Migraciones de base de datos (orden exacto)

Genera el contenido completo de cada migración:

```
001 - create_companies_table
      Campos: id, name, nit, address, phone, email, logo, is_active, 
              settings (json), created_at, updated_at, deleted_at

002 - create_users_table (modificar la existente de Laravel)
      Añadir: company_id (nullable, fk companies), employee_id (nullable, fk employees),
              avatar, phone, is_active, last_login_at,
              password_change_required (boolean, default false)
      NOTA: employee_id se agrega en una migración posterior para evitar
            dependencia circular. Ver migración 012.

003 - create_employees_table
      Campos: id, company_id, user_id (nullable, fk users → se completa en migración 012),
              first_name, last_name, document_type, document_number,
              phone, address, hire_date, photo,
              base_salary, is_active, notes, created_at, updated_at, deleted_at

...
(las migraciones 004 a 011 continúan igual)
...

012 - add_employee_id_to_users_table
      ALTER TABLE users ADD COLUMN employee_id (nullable, fk employees.id, onDelete set null)
      Resuelve la dependencia circular entre users y employees

004 - create_references_table
      Campos: id, company_id, code, name, description, image, 
              is_active, created_at, updated_at, deleted_at

005 - create_operations_table
      Campos: id, company_id, name, description, base_price (decimal 10,2), 
              is_active, created_at, updated_at, deleted_at

006 - create_reference_operations_table (pivot)
      Campos: id, reference_id, operation_id, price (decimal 10,2), 
              is_active, created_at, updated_at
      (precio override por referencia-operación)

007 - create_productions_table
      Campos: id, company_id, employee_id, reference_id, operation_id, 
              quantity (int), unit_price (decimal 10,2), 
              total_value (decimal 10,2, generado), date, shift 
              (mañana/tarde/noche), notes, created_by, 
              created_at, updated_at, deleted_at

008 - create_payrolls_table
      Campos: id, company_id, name, period_start, period_end, 
              type (quincenal/mensual), status (borrador/calculado/aprobado/pagado), 
              total_amount, paid_at, notes, created_by, 
              created_at, updated_at, deleted_at

009 - create_payroll_employees_table
      Campos: id, payroll_id, employee_id, production_total, 
              deductions (json), additions (json), advances_discount, 
              net_payment, is_paid, paid_at, notes

010 - create_advances_table
      Campos: id, company_id, employee_id, amount, date, reason, 
              status (pendiente/descontado), payroll_employee_id (nullable), 
              created_by, created_at, updated_at

011 - create_settings_table
      Campos: id, company_id, key, value, group, created_at, updated_at
```

### PASO 4 — Modelos Eloquent

Genera el contenido completo con relaciones, scopes y casts:

```
- app/Models/Company.php
- app/Models/User.php
  HasRoles (Spatie), relación company(), relación employee() (hasOne)
  Accessor: isEmployee(): bool → true si tiene employee_id
  Scope: scopeEmployees() → usuarios con employee_id not null
  Scope: scopeStaff() → usuarios sin employee_id (admin, supervisor externo, etc.)

- app/Models/Employee.php  (con CompanyScope, SoftDeletes)
  Relación user() (belongsTo User, nullable)
  Accessor: hasSystemAccess(): bool → true si user_id no es null y user.is_active
  Observer: EmployeeObserver
    - Al desactivar empleado (is_active=false) → desactivar user vinculado
    - Al reactivar empleado (is_active=true) → reactivar user vinculado
    - Al eliminar empleado (SoftDelete) → desactivar user vinculado (no eliminar)
- app/Models/Reference.php  (con CompanyScope, SoftDeletes)
- app/Models/Operation.php  (con CompanyScope, SoftDeletes)
- app/Models/ReferenceOperation.php
- app/Models/Production.php  (con CompanyScope, SoftDeletes, computed total_value)
- app/Models/Payroll.php  (con CompanyScope, SoftDeletes)
- app/Models/PayrollEmployee.php  (casts json en deductions/additions)
- app/Models/Advance.php  (con CompanyScope)
- app/Models/Setting.php  (con CompanyScope)
```

### PASO 5 — Middleware y Scopes

```
- app/Http/Middleware/HandleInertiaRequests.php
  Compartir via Inertia::share():
    auth.user → usuario autenticado con:
      - role: { name, display_name, color, is_system }
      - permissions: string[]  (lista plana: ["productions.index.view", ...])
      - accessible_pages: string[]  (páginas con al menos permiso 'view')
      - is_employee: bool  (true si el usuario tiene employee_id vinculado)
      - employee_id: int|null  (para que el frontend pueda filtrar/resaltar datos propios)
      - password_change_required: bool  (si true, redirigir al cambio de contraseña)
    empresa activa, flash messages, appName, darkMode preference
    permissionMatrix: solo cuando la ruta es del módulo de roles (lazy load)

  IMPORTANTE — Filtrado automático por empleado propio:
    En ProductionController e PayrollController, si el usuario tiene
    is_employee=true y NO tiene permiso de admin/supervisor global,
    el query filtra SIEMPRE por employee_id del usuario autenticado.
    Esto garantiza que un operario nunca vea datos de otros empleados,
    aunque acceda directamente a la URL.

- app/Http/Middleware/EnsureUserBelongsToCompany.php
  (verificar company_id del usuario en cada request)

- app/Http/Middleware/ForcePasswordChange.php
  Si auth()->user()->password_change_required === true,
  redirigir a /profile/change-password en cualquier ruta protegida
  (excepto la propia ruta de cambio de contraseña y logout)

- app/Observers/EmployeeObserver.php
  updated: si is_active cambia → sincronizar is_active del user vinculado
  deleted (soft): desactivar user vinculado (is_active = false)

- app/Http/Middleware/SetActiveCompany.php
  (para super_admin que puede cambiar de empresa)

- app/Models/Scopes/CompanyScope.php
  (aplicar where company_id = auth()->user()->company_id automáticamente)
```

### PASO 6 — Seeders

```
- database/seeders/DatabaseSeeder.php
- database/seeders/CompanySeeder.php
  (crear empresa demo: "Taller Modelo S.A.S.")
- database/seeders/RolesPermissionsSeeder.php
  Usar PermissionHelper::getPermissionMatrix() como fuente de verdad.
  Crear TODOS los permisos del sistema ({módulo}.{página}.{acción}).
  Crear roles del sistema (super_admin, admin) y roles de ejemplo
  personalizados: "Supervisor de Producción", "Auxiliar Contable", "Solo Consulta".
  Los roles personalizados deben tener is_system=false y company_id de la empresa demo.
- database/seeders/UserSeeder.php
  (crear super admin: superadmin@demo.com / password)
  (crear admin demo: admin@demo.com / password)
- database/seeders/DemoDataSeeder.php
  Crear 10 empleados con datos realistas (nombres colombianos/latinoamericanos).
  De esos 10 empleados:
    - 7 tienen cuenta de usuario activa con rol "Operario de Producción"
      (un rol personalizado creado en RolesPermissionsSeeder con permisos mínimos:
       solo ver su propio dashboard, su producción y su historial de pagos)
    - 2 tienen cuenta con rol "Supervisor de Producción"
    - 1 no tiene cuenta de usuario
  Crear 5 referencias, 8 operaciones, producción del mes actual.
```

### PASO 7 — Factories

```
- database/factories/EmployeeFactory.php
- database/factories/ReferenceFactory.php
- database/factories/OperationFactory.php
- database/factories/ProductionFactory.php
```

### PASO 8 — Form Requests (Validación)

```
- app/Http/Requests/Employee/StoreEmployeeRequest.php
- app/Http/Requests/Employee/UpdateEmployeeRequest.php
- app/Http/Requests/Reference/StoreReferenceRequest.php
- app/Http/Requests/Reference/UpdateReferenceRequest.php
- app/Http/Requests/Operation/StoreOperationRequest.php
- app/Http/Requests/Operation/UpdateOperationRequest.php
- app/Http/Requests/Production/StoreProductionRequest.php
- app/Http/Requests/Production/UpdateProductionRequest.php
- app/Http/Requests/Payroll/StorePayrollRequest.php
- app/Http/Requests/Payroll/CalculatePayrollRequest.php
- app/Http/Requests/Advance/StoreAdvanceRequest.php
- app/Http/Requests/Auth/LoginRequest.php
```

### PASO 9 — Controladores

```
- app/Http/Controllers/Auth/AuthenticatedSessionController.php
- app/Http/Controllers/Auth/RegisteredUserController.php
- app/Http/Controllers/Auth/PasswordResetController.php
- app/Http/Controllers/DashboardController.php
  (estadísticas: total empleados activos, producción del mes, 
   nómina pendiente, top 5 empleados)
- app/Http/Controllers/CompanyController.php  (solo super_admin)
- app/Http/Controllers/EmployeeController.php  (CRUD + historial)
  Métodos adicionales:
    createAccess(Employee $employee)   → mostrar formulario de creación de usuario
    storeAccess(Employee $employee)    → crear User vinculado + asignar rol
    toggleAccess(Employee $employee)   → activar/desactivar cuenta de usuario
    changeRole(Employee $employee)     → cambiar rol del usuario vinculado
    resetPassword(Employee $employee)  → generar contraseña temporal y retornarla
- app/Http/Controllers/ReferenceController.php  (CRUD + operaciones)
- app/Http/Controllers/OperationController.php  (CRUD)
- app/Http/Controllers/ProductionController.php  (CRUD + reportes)
- app/Http/Controllers/PayrollController.php
  (index, create, store, show, calculate, approve, markAsPaid, export)
- app/Http/Controllers/AdvanceController.php  (CRUD)
- app/Http/Controllers/ReportController.php
  (productionByEmployee, productionByReference, payrollSummary, charts)
- app/Http/Controllers/UserController.php  (CRUD + asignación de rol)
- app/Http/Controllers/RoleController.php
  Métodos: index, create, store, show, edit, update, destroy
  + getPermissionMatrix() → retorna la estructura de módulos/páginas/acciones
    para que el frontend construya la PermissionMatrix dinámica
- app/Helpers/PermissionHelper.php
  Fuente de verdad de todos los permisos del sistema (ver sección 3.9.8)
- app/Http/Controllers/ProfileController.php
- app/Http/Controllers/SettingController.php
```

### PASO 10 — Servicios (Service Layer)

```
- app/Services/PayrollCalculationService.php
  Método: calculate(Payroll $payroll): void
  - Sumar toda la producción del período por empleado
  - Descontar anticipos pendientes
  - Aplicar deducciones configuradas
  - Calcular pago neto
  - Guardar en payroll_employees

- app/Services/ProductionReportService.php
  Métodos: byEmployee, byReference, byOperation, summary

- app/Services/DashboardStatsService.php
  Retorna array con todas las estadísticas del dashboard
```

### PASO 11 — Rutas

```
- routes/web.php  (rutas Inertia con grupos y middleware)
- routes/auth.php  (login, logout, register, password reset)

Estructura de rutas web:
  GET  /                    → redirect al dashboard
  GET  /login               → Auth/Login
  POST /login               → procesar login
  POST /logout              → logout
  GET  /register            → Auth/Register (crear empresa + admin)
  POST /register            → procesar registro

  Grupo autenticado (auth):
    GET  /dashboard           → Dashboard
    
    Grupo admin:
      Resources: /companies (solo super_admin)
      Resources: /employees
      Resources: /references
      Resources: /operations
      GET  /references/{reference}/operations → operaciones de referencia
      POST /references/{reference}/operations → agregar operación
      DELETE /references/{reference}/operations/{operation} → quitar operación
      
      Resources: /productions
      GET  /productions/report  → reporte de producción
      
      Resources: /payrolls
      POST /payrolls/{payroll}/calculate  → calcular nómina
      POST /payrolls/{payroll}/approve    → aprobar nómina
      POST /payrolls/{payroll}/pay        → marcar como pagada
      GET  /payrolls/{payroll}/export     → exportar HTML
      
      Resources: /advances
      Resources: /users
      Resources: /roles
      GET  /roles/permission-matrix  → JSON con estructura de módulos/páginas/acciones
                                       (usado por el frontend para construir la UI)
      GET  /reports/production  → reportes
      GET  /reports/payroll     → reportes nómina
      GET  /profile             → perfil
      PUT  /profile             → actualizar perfil
      GET  /settings            → configuración
      PUT  /settings            → guardar configuración
```

### PASO 12 — Layout Principal React

```
- resources/js/Layouts/AppLayout.tsx
  Incluye:
  - Sidebar colapsable con navegación por módulos
  - Header con: nombre empresa, usuario, toggle dark/light, notificaciones
  - Breadcrumbs
  - Flash messages (Sonner toasts)
  - Responsive: sidebar como drawer en móvil
  - Iconos Heroicons para cada sección del menú
  - Menú construido DINÁMICAMENTE desde auth.user.accessible_pages
    (solo muestra los ítems donde el usuario tiene al menos permiso 'view')
  - Usar el componente <Can> para envolver acciones dentro de cada vista

- resources/js/Layouts/AuthLayout.tsx
  Para páginas de login/registro: fondo con gradiente, logo centrado
```

### PASO 13 — Componentes UI Reutilizables

```
- resources/js/Components/UI/Button.tsx
  Variantes: primary, secondary, danger, ghost, outline
  Tamaños: sm, md, lg
  Con loading state y ícono opcional

- resources/js/Components/UI/Input.tsx
  Con label, error, descripción, ícono prefijo/sufijo

- resources/js/Components/UI/Select.tsx
  Con label, error, opciones, searchable opcional

- resources/js/Components/UI/Modal.tsx
  Con Headless UI Dialog, tamaños, header, footer

- resources/js/Components/UI/Table.tsx
  Con sorting, pagination, loading skeleton, empty state

- resources/js/Components/UI/Badge.tsx
  Variantes: success, warning, danger, info, neutral

- resources/js/Components/UI/Card.tsx
  Con header, body, footer opcionales

- resources/js/Components/UI/StatCard.tsx
  Para dashboard: ícono, título, valor, tendencia, color

- resources/js/Components/UI/Pagination.tsx
  Compatible con paginación de Laravel

- resources/js/Components/UI/ConfirmDialog.tsx
  Modal de confirmación para eliminar

- resources/js/Components/UI/DateRangePicker.tsx
  Dos inputs de fecha para filtros

- resources/js/Components/UI/SearchInput.tsx
  Con debounce 300ms, ícono lupa

- resources/js/Components/UI/Avatar.tsx
  Con fallback a iniciales, tamaños

- resources/js/Components/UI/Breadcrumb.tsx

- resources/js/Components/UI/EmptyState.tsx
  Con ícono, título, descripción, CTA opcional

- resources/js/Components/UI/LoadingSkeleton.tsx
```

### PASO 14 — Páginas React (Inertia Pages)

#### Auth
```
- resources/js/Pages/Auth/Login.tsx
  Formulario: email, contraseña, recordarme
  Link a registro y recuperar contraseña

- resources/js/Pages/Auth/Register.tsx
  Paso 1: Datos de la empresa (nombre, NIT, teléfono)
  Paso 2: Datos del administrador (nombre, email, contraseña)
  Formulario de 2 pasos con stepper visual

- resources/js/Pages/Auth/ForgotPassword.tsx
- resources/js/Pages/Auth/ResetPassword.tsx
```

#### Dashboard
```
- resources/js/Pages/Dashboard/Index.tsx
  - Fila de StatCards: empleados activos, producción mes, 
    total nóminas pendientes, referencias activas
  - Gráfica de producción últimos 7 días (LineChart Recharts)
  - Gráfica top 5 empleados del mes (BarChart Recharts)
  - Tabla de últimas producciones registradas
  - Nóminas pendientes de pago
```

#### Empleados
```
- resources/js/Pages/Employees/Index.tsx
  Tabla con: foto/avatar, nombre, documento, teléfono, 
  fecha ingreso, estado badge, acciones
  Búsqueda, filtro por estado, paginación

- resources/js/Pages/Employees/Create.tsx
  Formulario completo con upload de foto.
  Validación con React Hook Form + Zod.
  Sección "Acceso al sistema" al final del formulario:
    - Toggle "¿Dar acceso a la aplicación?"
    - Si activo: campos email, contraseña auto-generada (con botón regenerar),
      selector de rol (muestra color badge + descripción de cada rol disponible)
    - Nota informativa: "La contraseña inicial se mostrará solo una vez al guardar"

- resources/js/Pages/Employees/Edit.tsx
  Formulario pre-llenado.
  La sección "Acceso al sistema" muestra el estado actual de la cuenta
  (no permite cambiar email ni contraseña desde aquí; eso se hace desde Show).

- resources/js/Pages/Employees/Show.tsx
  Perfil del empleado con tabs:

  TAB 1 — Información personal:
    Datos personales completos, foto, estado activo/inactivo

  TAB 2 — Producción:
    Estadísticas (total producido mes, promedio diario)
    Historial de producción (tabla con filtros de fecha)

  TAB 3 — Pagos y Anticipos:
    Historial de pagos por nómina
    Anticipos pendientes y descontados

  TAB 4 — Cuenta de acceso (visible solo para admin/supervisor):
    Panel de estado de la cuenta de usuario vinculada:

    CASO A — Sin cuenta de usuario:
      Card con ícono de usuario con X rojo
      Mensaje: "Este empleado no tiene acceso al sistema"
      Botón "Crear acceso" → abre Modal con:
        - Email de acceso
        - Selección de rol (dropdown con badge de color)
        - Contraseña (auto-generada, con botón de regenerar, visible)
        Advertencia: "La contraseña solo se mostrará en este momento"

    CASO B — Con cuenta activa:
      Avatar del usuario, email, fecha de último acceso
      Badge del rol con su color + nombre
      Lista colapsable de permisos agrupados por módulo
      Acciones:
        - Botón "Cambiar rol" → modal con selector de rol
        - Botón "Restablecer contraseña" → confirmar → muestra nueva contraseña
        - Botón "Desactivar acceso" (con confirmación) → is_active = false

    CASO C — Con cuenta inactiva:
      Badge "Acceso desactivado" en rojo
      Botón "Reactivar acceso"
      Fecha en que fue desactivado
```

#### Referencias
```
- resources/js/Pages/References/Index.tsx
  Grid de tarjetas o tabla con imagen, código, nombre, # operaciones, estado

- resources/js/Pages/References/Create.tsx
  Formulario + upload imagen + tabla para agregar operaciones con precio

- resources/js/Pages/References/Edit.tsx
  Con gestión de operaciones inline (agregar/quitar/cambiar precio)

- resources/js/Pages/References/Show.tsx
  Detalle con operaciones y precios, estadísticas de producción
```

#### Operaciones
```
- resources/js/Pages/Operations/Index.tsx
  Tabla con nombre, precio base, # referencias, estado

- resources/js/Pages/Operations/Create.tsx
- resources/js/Pages/Operations/Edit.tsx
```

#### Producción
```
- resources/js/Pages/Productions/Index.tsx
  Tabla con filtros: empleado, referencia, operación, fecha inicio/fin
  Columnas: fecha, empleado, referencia, operación, cantidad, valor, turno
  Totales al pie: cantidad total, valor total
  Botón "Registrar producción"

- resources/js/Pages/Productions/Create.tsx
  Formulario:
  - Empleado (select searchable)
  - Referencia (select → carga operaciones de esa referencia)
  - Operación (select con precio automático)
  - Cantidad (número, mínimo 1)
  - Fecha
  - Turno
  - Observaciones
  - Preview del valor a pagar (cantidad × precio)
  Opción de registrar múltiples entradas en una sola sesión

- resources/js/Pages/Productions/Edit.tsx

- resources/js/Pages/Productions/Report.tsx
  Filtros + tabla resumen + gráficas + totales
```

#### Nómina
```
- resources/js/Pages/Payrolls/Index.tsx
  Tabla: nombre, período, tipo, estado badge, total, acciones
  Filtro por estado, año

- resources/js/Pages/Payrolls/Create.tsx
  Formulario: nombre, fecha inicio, fecha fin, tipo
  Al guardar se crea en estado "borrador"

- resources/js/Pages/Payrolls/Show.tsx
  Cabecera: datos del período, estado, botones de acción
  Tabla de empleados con:
    - Nombre, producción total, anticipos, deducciones, pago neto
    - Expandir fila para ver detalle de producción
    - Editar deducciones manuales
  Totales generales
  Botones: Calcular / Aprobar / Marcar como Pagada / Exportar

- resources/js/Pages/Payrolls/Print.tsx
  Vista de impresión: tabla completa con membrete de empresa
  CSS específico para impresión (@media print)
```

#### Anticipos
```
- resources/js/Pages/Advances/Index.tsx
  Tabla con empleado, monto, fecha, motivo, estado

- resources/js/Pages/Advances/Create.tsx
  Formulario: empleado, monto, fecha, motivo
```

#### Reportes
```
- resources/js/Pages/Reports/Production.tsx
  Filtros → datos → gráficas → tabla exportable

- resources/js/Pages/Reports/Payroll.tsx
  Resumen de nóminas por período
```

#### Roles y Permisos
```
- resources/js/Pages/Roles/Index.tsx
  (ver sección 3.9.5 para especificación completa)

- resources/js/Pages/Roles/Create.tsx
  Incluye PermissionMatrix component con matriz visual interactiva

- resources/js/Pages/Roles/Edit.tsx
  Pre-cargado con permisos actuales; roles is_system son de solo lectura

- resources/js/Pages/Roles/Show.tsx
  Vista auditoría: qué permisos tiene el rol
```

#### Usuarios
```
- resources/js/Pages/Users/Index.tsx
  Tabla: avatar, nombre, email, rol badge (con color dinámico), empresa,
  último acceso, estado activo/inactivo, acciones

- resources/js/Pages/Users/Create.tsx
  Formulario: nombre, apellido, email, contraseña, selección de rol
  (dropdown muestra color + descripción del rol), empresa (solo super_admin)

- resources/js/Pages/Users/Edit.tsx
  Pre-cargado; contraseña es campo opcional (vacío = no cambiar)

- resources/js/Pages/Users/Show.tsx
  Perfil con lista expandida de permisos agrupados por módulo
  + historial de accesos (access_logs)
```

#### Perfil y Configuración
```
- resources/js/Pages/Profile/Edit.tsx
  Tabs: Información personal | Cambiar contraseña | Preferencias (dark mode)

- resources/js/Pages/Settings/Index.tsx
  Configuración de empresa: logo, datos, configuración de nómina
  (porcentajes de deducciones predeterminadas)
```

### PASO 15 — Hooks React Personalizados

```
- resources/js/hooks/useConfirm.ts
  Hook para mostrar ConfirmDialog y esperar respuesta

- resources/js/hooks/useDarkMode.ts
  Toggle dark mode persistido en localStorage + Inertia shared state

- resources/js/hooks/usePermissions.ts
  can(permission: string): boolean
  canAny(permissions: string[]): boolean
  canAll(permissions: string[]): boolean
  hasRole(roleName: string): boolean
  accessiblePages(): string[]
  Lee de auth.user.permissions compartido por Inertia (ver sección 3.9.7)

- resources/js/contexts/PermissionsContext.tsx
  Provider global que expone el hook a todo el árbol de componentes

- resources/js/Components/UI/Can.tsx
  Wrapper <Can permission="x.y.z">...</Can> que oculta children sin permiso
  Acepta prop fallback?: ReactNode para mostrar alternativa

- resources/js/hooks/useDebounce.ts
  Para búsquedas con delay

- resources/js/hooks/useFilters.ts
  Manejo de filtros en tablas con URL params (Inertia router)
```

### PASO 16 — Tipos TypeScript

```
- resources/js/types/index.d.ts
  Definir interfaces:
  - User, Company, Employee, Reference, Operation
  - ReferenceOperation, Production, Payroll
  - PayrollEmployee, Advance, Setting
  - PaginatedResponse<T>
  - PageProps (Inertia shared props)
  - FlashMessages
```

### PASO 17 — Helpers y Utilidades

```
- resources/js/lib/utils.ts
  formatCurrency(amount: number, currency?: string): string
  formatDate(date: string, format?: string): string
  formatNumber(n: number): string
  cn(...classes: string[]): string  (classnames helper)

- resources/js/lib/api.ts
  Funciones helper para Inertia router (get, post, put, delete con manejo de errores)
```

### PASO 18 — Archivos raíz React/Inertia

```
- resources/js/app.tsx
  Setup Inertia + React 18 createRoot
  Importar CSS global

- resources/js/ssr.tsx  (opcional, para SSR)
- resources/css/app.css  (Tailwind directives + custom CSS)
```

### PASO 19 — Blade principal

```
- resources/views/app.blade.php
  Template Inertia con: meta tags, @viteReactRefresh, @vite(['resources/css/app.css', 'resources/js/app.tsx']), @inertiaHead, @inertia
```

### PASO 20 — Políticas (Authorization)

```
- app/Policies/EmployeePolicy.php
- app/Policies/ReferencePolicy.php
- app/Policies/ProductionPolicy.php
- app/Policies/PayrollPolicy.php
- app/Policies/UserPolicy.php
- app/Policies/RolePolicy.php
  (no permitir editar/eliminar roles is_system)
- app/Providers/AuthServiceProvider.php  (registrar policies)
- app/Http/Middleware/CheckPermission.php
  Middleware usado en rutas: ->middleware('permission:productions.index.view')
  Registrar acceso denegado en access_logs
- app/Models/AccessLog.php  (tabla access_logs, sin SoftDeletes)
- app/Observers/UserObserver.php  (registrar login/logout en access_logs)
```

### PASO 21 — Comandos Artisan personalizados

```
- app/Console/Commands/CalculateMonthlyPayroll.php
  Comando: php artisan payroll:calculate-monthly
  Auto-genera nómina del mes anterior para todas las empresas activas
```

---

## 5. REQUERIMIENTOS DE DISEÑO UI/UX

```
Color Palette (Tailwind custom colors):
  Primary:  indigo-600 / indigo-500 (dark)
  Success:  emerald-500
  Warning:  amber-500
  Danger:   rose-500
  Neutral:  slate-*

Dark Mode:
  - bg: slate-900 (fondo principal), slate-800 (cards), slate-700 (inputs)
  - text: slate-100 (principal), slate-400 (secundario)
  - border: slate-700

Light Mode:
  - bg: slate-50 (fondo principal), white (cards)
  - text: slate-900 (principal), slate-500 (secundario)
  - border: slate-200

Sidebar:
  - Ancho: 256px expandido, 72px colapsado
  - Logo en la parte superior
  - Secciones: Principal, Producción, Nómina, Administración
  - Indicador activo con borde izquierdo y fondo suave
  - Colapso con solo íconos en modo compacto

Tablas:
  - Hover de fila sutil
  - Checkbox para selección múltiple (futuro)
  - Acciones inline: editar (ícono lápiz), eliminar (ícono basura) con confirmación

Formularios:
  - Labels flotantes o encima del input
  - Error messages en rojo debajo del campo
  - Botones: Cancel (ghost) + Save (primary) alineados a la derecha
  - Loading state en botón submit
```

---

## 6. VALIDACIONES IMPORTANTES

```
Producción:
  - No permitir registrar producción en fecha futura
  - Verificar que referencia y operación pertenezcan a la misma empresa
  - Verificar que operación esté activa en la referencia seleccionada
  - Cantidad mínima: 1

Nómina:
  - No permitir calcular nómina si ya está en estado "aprobado" o "pagado"
  - Verificar que el período no se solape con otra nómina del mismo tipo
  - Al marcar como pagada, actualizar anticipos relacionados

Empleados:
  - Documento único por empresa
  - Si se da acceso al sistema, el email debe ser único globalmente (tabla users)
  - Al desactivar un empleado → desactivar su cuenta de usuario (Observer)
  - Al reactivar un empleado → reactivar su cuenta de usuario (Observer)
  - Al eliminar (soft delete) un empleado → desactivar cuenta, NO eliminar usuario
  - No se puede eliminar el usuario de un empleado directamente desde el módulo
    de Usuarios si ese usuario está vinculado a un empleado activo
  - La contraseña inicial generada debe tener mínimo 10 caracteres,
    combinando letras, números y un carácter especial
  - Cuando se restablece la contraseña desde la ficha del empleado,
    debe forzarse cambio en el siguiente login (password_change_required = true en users)

Usuarios:
  - Email único global
  - No permitir eliminar el propio usuario
  - Super admin no puede ser eliminado

Roles:
  - Roles con is_system=true no pueden ser editados ni eliminados desde la UI ni la API
  - No se puede dejar un rol sin ningún permiso de tipo 'view' (al menos uno requerido)
  - Al eliminar un rol con usuarios asignados, mostrar error indicando cuántos usuarios lo tienen
  - El nombre interno (name) de un rol no puede contener espacios (usar snake_case)
  - No se pueden crear dos roles con el mismo name en la misma empresa

Permisos:
  - Los permisos del sistema son de solo lectura (no se crean desde la UI, solo se asignan)
  - Verificar siempre en el backend (middleware) además del frontend (componente Can)
  - Si el usuario pierde un permiso que tenía, al recargar la página se redirige según sus nuevos permisos
```

---

## 7. INSTRUCCIONES ESPECIALES DE GENERACIÓN

```
1. Genera CADA archivo de forma COMPLETA. No uses "// resto del código similar".
2. Cada componente React debe tener sus imports completos.
3. Cada modelo debe tener fillable, casts, relationships y scopes completos.
4. Cada controlador debe manejar errores y retornar respuestas Inertia correctas.
5. Los Form Requests deben tener authorize() y rules() completos.
6. El seeder debe crear datos de demostración realistas (nombres colombianos/latinoamericanos).
7. Los tipos TypeScript deben cubrir todas las interfaces necesarias.
8. Usa Tailwind classes directamente, no CSS personalizado salvo excepciones.
9. Todos los textos de la UI deben estar en ESPAÑOL.
10. Los precios deben mostrarse en formato moneda colombiana (COP) pero configurable.
```

---

## 8. COMANDOS DE INSTALACIÓN Y DESPLIEGUE

Al final, genera un script bash completo `setup.sh` y las instrucciones:

```bash
#!/bin/bash
# setup.sh — Instalación completa del sistema

# 1. Clonar/entrar al proyecto
# 2. Copiar .env.example a .env y configurar DB
# 3. composer install
# 4. php artisan key:generate
# 5. php artisan migrate:fresh --seed
# 6. npm install && npm run build
# 7. php artisan storage:link
# 8. php artisan serve
```

---

## 9. CHECKLIST DE VERIFICACIÓN (Claude debe confirmar cada punto)

Al terminar la generación, verifica y confirma:

- [ ] Todas las migraciones tienen sintaxis correcta y foreign keys consistentes
- [ ] Todos los modelos tienen $fillable correcto (no hay MassAssignmentException)
- [ ] Todos los controladores importan los modelos y servicios correctos
- [ ] Todos los componentes React importan sus dependencias correctamente
- [ ] El sidebar se construye dinámicamente desde auth.user.accessible_pages (cero ítems hardcodeados)
- [ ] El componente <Can> oculta correctamente acciones no permitidas en todas las páginas
- [ ] La PermissionMatrix muestra checkboxes correctos al editar un rol existente
- [ ] Al crear un empleado con "acceso al sistema" activado, se crea el usuario vinculado y se muestra la contraseña inicial una sola vez
- [ ] Al desactivar un empleado, su usuario vinculado se desactiva automáticamente (EmployeeObserver)
- [ ] Un empleado-usuario con rol "Operario de Producción" solo ve sus propios datos (filtrado por employee_id en backend)
- [ ] El middleware ForcePasswordChange redirige correctamente cuando password_change_required=true
- [ ] Desde la ficha del empleado (Show → tab "Cuenta de acceso") se puede crear/cambiar rol/desactivar/restablecer contraseña
- [ ] Los roles is_system no pueden ser editados ni eliminados desde la UI
- [ ] La eliminación de un rol con usuarios asignados retorna error descriptivo
- [ ] El endpoint /roles/permission-matrix retorna la estructura completa de módulos
- [ ] El dark mode funciona en todos los componentes
- [ ] Las gráficas de Recharts son responsive
- [ ] La paginación de Laravel es compatible con el componente Pagination.tsx
- [ ] Los formularios muestran errores de validación del servidor en los campos correctos
- [ ] El cálculo de nómina produce resultados matemáticamente correctos
- [ ] Los scopes multiempresa están aplicados en todos los modelos de negocio

---

## 10. ORDEN DE EJECUCIÓN PARA CLAUDE

**Genera los archivos en este orden estricto:**

1. `composer.json` y `package.json` (dependencias)
2. Archivos de configuración (vite, tailwind, tsconfig)
3. `.env.example`
4. `bootstrap/app.php`
5. Todas las migraciones (001 → 011)
6. Todos los modelos (Company → Setting)
7. Todos los scopes y middleware
8. Todos los seeders y factories
9. Todos los Form Requests
10. Todos los servicios
11. Todos los controladores
12. `routes/web.php` y `routes/auth.php`
13. `resources/views/app.blade.php`
14. `resources/js/app.tsx` y `resources/css/app.css`
15. Tipos TypeScript (`types/index.d.ts`)
16. Helpers y hooks
17. Componentes UI (Button → LoadingSkeleton)
18. Layouts (AppLayout, AuthLayout)
19. Todas las páginas React (Auth → Settings)
20. Políticas de autorización
21. `setup.sh`

---

## INSTRUCCIÓN FINAL

Empieza AHORA con el PASO 1 (composer.json) y continúa sin interrupciones hasta generar el sistema completo. Si necesitas hacer suposiciones, hazlas razonables y documéntalas brevemente con un comentario. Al finalizar cada módulo principal, muestra un resumen de los archivos generados. El objetivo es tener un sistema que funcione con:

```
php artisan migrate:fresh --seed
npm run build
php artisan serve
```

y pueda ser usado inmediatamente en producción.

---

*Prompt generado para: Sistema de Gestión de Talleres de Confección v1.0*
*Stack: Laravel 12 + React 18 + Inertia.js v2 + Tailwind CSS v3*
*Fecha: Mayo 2026*
