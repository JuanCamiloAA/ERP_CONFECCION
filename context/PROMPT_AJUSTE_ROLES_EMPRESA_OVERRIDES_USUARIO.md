# AJUSTE — Roles y permisos por empresa + excepciones por usuario (sin tocar el rol ni a compañeros)
## Prompt para Claude Opus — Implementación incremental sin romper lo ya desarrollado

---

> **USO:** El proyecto ya implementa roles con Spatie, matriz de permisos y multiempresa (ver `PROMPT_TALLER_CONFECCION.md` y ajustes posteriores). Pega **este documento completo** en Claude Opus. Aplica **solo** lo descrito aquí. No eliminar el catálogo global de permisos definidos en código (`PermissionHelper` o equivalente); no romper login, nómina, producción, importación CSV ni demás módulos.

---

## 0. OBJETIVO DE NEGOCIO

1. **Roles propios por empresa:** Cada empresa administra **sus roles** además de (o en sustitución operativa de) los roles iniciales del sistema. Los roles creados por el administrador de la empresa **A** **no** deben verse ni asignarse en la empresa **B**.

2. **Permisos iniciales / sistema:** Los roles y permisos “semilla” (`super_admin`, etc.) siguen existiendo según lo ya implementado; debe quedar claro cuáles son **globales** (`company_id` nulo) y cuáles son **replicados o plantilla** por empresa si aplica — ver §2.

3. **Excepciones por usuario (empleado-usuario o usuario corporativo):** Desde el **dato del empleado** (ficha del empleado con cuenta vinculada) y/o desde el **módulo de usuarios**, el administrador debe poder ajustar **acciones concretas** (permisos granulares ya existentes, ej. `employees.index.edit`) **solo para esa persona**, sin modificar la definición del rol y **sin afectar** a otros usuarios que compartan el mismo rol.

**Ejemplo obligatorio que debe quedar cubierto:** Dos usuarios con rol “Supervisor”. A uno se le **quita** crear/editar empleados (solo ver). Al otro se mantiene el comportamiento del rol (ver + crear + editar). El rol “Supervisor” en la matriz de la empresa **no cambia**.

---

## 1. CONCEPTOS Y MODELO DE AUTORIZACIÓN EFECTIVA

### 1.1 Resolución de permisos (orden lógico)

Para un usuario autenticado `U`, empresa activa `C`, y permiso string `P` (ej. `employees.index.view`):

1. **`super_admin` global:** Si `U` tiene rol sistema `super_admin` (sin `company_id` o marcado como sistema), **permitir todo** — comportamiento actual preservado.

2. **Overrides explícitos por usuario:** Consultar tabla `user_permission_overrides` (§3):
   - Si existe registro **`deny`** para `P` → **false** (bloquea aunque el rol lo otorgue).
   - Si existe registro **`grant`** para `P` → **true** (otorga aunque el rol no lo tenga — opcional según política; **recomendado permitir** `grant` para flexibilidad).

3. **Sin override:** Usar permisos del **rol** (Spatie) considerando el **ámbito de empresa** — solo roles asignados válidos para `C`.

4. **Sin rol ni grant:** false.

Implementar **un único punto de verdad** en backend:

- Clase sugerida: `EffectivePermissionChecker` o método `User::hasEffectivePermission(string $P): bool`
- Sustituir en **middleware de ruta**, **policies** y **HandleInertiaRequests** (para compartir lista al frontend) las llamadas directas dispersas `hasPermissionTo` **solo donde corresponda** — o bien extender con un helper que siempre aplique overrides.

### 1.2 Coherencia frontend

- Inertia debe compartir **`effective_permissions: string[]`** (lista plana ya resuelta), no solo permisos del rol.
- Hook `usePermissions().can('employees.index.edit')` debe leer de `effective_permissions` generados en servidor **o** replicar la misma lógica (preferible **solo servidor** y confiar en la lista compartida actualizada tras guardar overrides).
- Tras guardar overrides vía Inertia, **refrescar** props de usuario (`router.reload({ only: ['auth'] })` o equivalente).

---

## 2. ROLES POR EMPresa (AISLAMIENTO)

### 2.1 Base de datos

Si no existe, añadir a tabla `roles` (paquete Spatie):

```text
company_id UUID/BIGINT NULLABLE FK companies.id ON DELETE CASCADE
is_system BOOLEAN DEFAULT false  -- true: rol semilla no editable por admin empresa
```

**Semántica:**

- `company_id IS NULL` **y** `is_system = true`: roles globales (`super_admin`, y cualquier otro que deba existir fuera de tenant).
- `company_id IS NOT NULL`: rol **pertenece exclusivamente** a esa empresa. **Imposible** listar o asignar estos roles a usuarios de otra `company_id`.

**Migración de datos:** Para cada empresa ya existente, si hay roles “plantilla” deseados (Admin empresa, Supervisor, Operario…), ejecutar **seeder idempotente** o comando `php artisan roles:seed-company {company}` que cree copias con `company_id` fijado — **sin** Borrar roles globales que el sistema necesite.

### 2.2 Asignación de roles a usuarios (Spatie + multiempresa)

Elegir **una** estrategia consistente con la versión de Spatie en el proyecto:

**Opción A (recomendada si Spatie teams está activo):** Usar `team_foreign_key = company_id` en `model_has_roles` y `model_has_permissions` para que la misma persona pueda tener roles distintos por empresa (si el producto lo permite). Documentar en el prompt de implementación.

**Opción B:** Sin teams: validar en `assignRole` que `role.company_id === user.company_id` o que el rol es global de sistema.

El prompt debe exigir: **nunca** asignar un rol cuyo `company_id` no coincida con el `company_id` del usuario (excepto `super_admin`).

### 2.3 UI y controladores

- `RoleController@index`: filtro **obligatorio** `where('company_id', auth()->user()->company_id)` para admin empresa; `super_admin` puede `whereNull('company_id')->orWhere('company_id', $selected)` según selector de empresa.
- Crear rol: siempre `company_id = auth()->user()->company_id` (admin empresa); `super_admin` define `company_id` explícito al gestionar otra empresa.
- Eliminar rol: no permitir si `is_system`; no permitir si hay usuarios asignados (mensaje con conteo).

### 2.4 Permisos (catálogo)

- Los **strings de permiso** siguen siendo el catálogo **global** definido por `PermissionHelper::getPermissionMatrix()` (no duplicar permisos por empresa en BD salvo requerimiento futuro).
- Lo que es **por empresa** es **qué permisos tiene asignados cada rol** (`role_has_permissions`) — ya soportado por Spatie; asegurar que `role_id` solo se enlaza a roles de la misma empresa al guardar desde UI.

---

## 3. EXCEPCIONES POR USUARIO (`user_permission_overrides`)

### 3.1 Migración nueva

```text
user_permission_overrides
  id
  company_id FK companies NOT NULL   -- redundante pero útil para consultas y constraints
  user_id FK users NOT NULL
  permission_id FK permissions NOT NULL   -- preferir FK a permissions de Spatie
  effect ENUM: grant | deny
  created_by_user_id NULLABLE FK users
  note TEXT NULLABLE  -- motivo administrativo opcional
  timestamps

UNIQUE (user_id, permission_id)  -- un solo registro por permiso; upsert reemplaza effect
INDEX (company_id, user_id)
```

**Reglas:**

- Solo usuarios con `user.company_id` igual a `company_id` del override (validación).
- `super_admin` puede no usar esta tabla (bypass total).

### 3.2 Servicio `UserPermissionOverrideService`

- `setOverride(User $user, string $permissionName, string $effect, ?string $note, User $actor): void`
  - Resolver `permission_id` por nombre; error si no existe.
- `removeOverride(User $user, string $permissionName): void`
- `listOverrides(User $user): Collection` agrupado por módulo para la UI
- `clearAllOverrides(User $user): void` opcional (con confirmación UI)

Tras cada mutación: `app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();` y limpiar caché de usuario si el proyecto cachea `effective_permissions`.

### 3.3 Cálculo de `effective_permissions`

- Al compartir usuario en Inertia, calcular:
  1. Conjunto base desde roles del usuario (Spatie, scoped empresa).
  2. Aplicar `deny`: quitar del conjunto.
  3. Aplicar `grant`: añadir al conjunto.
- Devolver array de strings ordenado para establecer diff en tests.

**Optimización:** Una query con join de overrides + carga de permisos del rol; evitar N+1.

---

## 4. INTERFACES (REACT + INERTIA)

### 4.1 Módulo Usuarios — edición de usuario

En `Users/Edit.tsx` (y `Create` si aplica solo después de crear):

- Nueva sección **“Permisos individuales (excepciones)”**:
  - Texto de ayuda: *“Los cambios solo afectan a este usuario. El rol de referencia no se modifica.”*
  - Mostrar la misma **matriz visual** que en roles, pero cada celda tiene **tres estados**: **Heredado del rol** (solo lectura / color neutro), **Concedido** (verde), **Denegado** (rojo).
  - Alternativa compacta: por cada permiso del catálogo visible (filtrado por lo que el rol ya usa + opción “mostrar todos los permisos” colapsable), selector `Neutral | Grant | Deny`.
- Botón **“Restablecer excepciones”** → borra todos los overrides del usuario (confirmación).

### 4.2 Módulo Empleados — ficha “Cuenta de acceso”

En `Employees/Show.tsx`, pestaña existente de cuenta vinculada:

- Si `employee.user_id` existe, enlace **“Ajustar permisos individuales”** que navegue a `Users/Edit` con `user_id` o abra **drawer/modal embebido** que reutilice el mismo componente `PermissionOverrideMatrix` con props `userId` y `employeeContext`.

**Permiso requerido** para ver/editar overrides: ej. `users.edit.permission_overrides` o `employees.show.manage_access` — añadir a `PermissionHelper` y seed solo para rol admin de empresa.

### 4.3 Componente reutilizable

- `resources/js/Components/Permissions/PermissionOverrideMatrix.tsx`
  - Props: `permissionMatrix`, `rolePermissions: string[]`, `overrides: { permission: string, effect: 'grant'|'deny' }[]`, `onChange`
  - Visual diff claro vs rol base

---

## 5. BACKEND — RUTAS Y CONTROLADOR

- `GET  /users/{user}/permission-overrides` — datos para el partial/matrix (o incluir en edit user)
- `PUT  /users/{user}/permission-overrides` — body: `{ overrides: [{ permission: string, effect: 'grant'|'deny'|'inherit' }] }` donde `inherit` elimina fila override
- Autorización: Policy `UserPolicy@managePermissionOverrides` — solo admin empresa de la misma `company_id`; `super_admin` siempre.

Validar que el `user` objetivo **no** sea `super_admin` (no permitir overrides en super admin).

---

## 6. INTEGRACIÓN CON CÓDIGO EXISTENTE

1. **Middleware `CheckPermission`:** Debe llamar a `hasEffectivePermission` en lugar de solo `hasPermissionTo`.
2. **Policies:** Idem donde corresponda.
3. **RolesPermissionsSeeder:** 
   - Asegurar roles globales `company_id = null`, `is_system = true`.
   - Crear roles por defecto **por primera empresa demo** con `company_id` de esa empresa (no reutilizar el mismo `role_id` para otra empresa).
4. **`PermissionHelper`:** Añadir permisos nuevos si hace falta (`users.edit.permission_overrides`).
5. **Importación CSV empleados-usuarios:** Tras asignar rol, **no** crear overrides (opcional campo futuro fuera de alcance).

---

## 7. PRUEBAS MANUALES (CHECKLIST)

- [ ] Admin empresa A crea rol “Supervisor”; admin empresa B **no** lo ve.
- [ ] Dos usuarios con mismo rol; a uno se **deniega** `employees.index.create` y `employees.index.edit`; el otro sigue pudiendo crear/editar.
- [ ] Matriz de rol “Supervisor” sin cambios tras guardar overrides.
- [ ] `effective_permissions` en Inertia refleja denies en `<Can>` y sidebar.
- [ ] Usuario `super_admin` no se le pueden aplicar overrides (403 o UI oculta).
- [ ] `npm run build` y `php artisan migrate` OK.

---

## 8. ORDEN DE IMPLEMENTACIÓN RECOMENDADO

1. Migraciones: `roles.company_id`, `roles.is_system`, `user_permission_overrides`.
2. Backfill: roles existentes — asignar `company_id` según estrategia documentada (comando único).
3. `EffectivePermissionChecker` + integración middleware/policies/Inertia share.
4. `UserPermissionOverrideService` + controller + requests.
5. Componente React matrix + Users/Edit + Employees/Show enlace.
6. Tests manuales checklist + ajuste seeder.

---

## 9. INSTRUCCIÓN FINAL PARA CLAUDE OPUS

Implementa lo anterior de forma **incremental**. Si Spatie ya usa `teams`, **alinea** `company_id` con el equipo en lugar de duplicar lógica contradictoria. Si detectas conflicto con datos existentes, prioriza: **aislamiento de roles por empresa** y **permiso efectivo con overrides**, sin eliminar datos productivos sin migración segura.

Al cerrar, entrega **lista de archivos tocados** y comandos:

```bash
php artisan migrate
php artisan permission:cache-reset   # si existe / o flush según proyecto
npm run build
```

---

*Documento: Roles por empresa + overrides de permisos por usuario — Mayo 2026*
