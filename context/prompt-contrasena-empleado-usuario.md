# Prompt de implementación: Contraseña manual y cambio obligatorio en primer inicio de sesión

## Contexto del sistema

**Proyecto:** MiTallerCol — ERP taller de confección  
**Stack:** Laravel 12 + PHP 8.2, React 19 + TypeScript + Inertia.js 3, Tailwind CSS 4, Vite 6

### Situación actual

En el módulo de **creación de empleado**, cuando se activa el switch **"Crear acceso"** (`create_user_account`), el formulario muestra una contraseña temporal generada en el cliente, pero **esa contraseña no se envía al servidor**. El backend siempre genera su propia contraseña de forma independiente en `EmployeeController::store()`.

Además, al crear un usuario vinculado a un empleado, el sistema **siempre** establece `password_change_required = true` de forma fija, sin dar opción al administrador de decidir.

La infraestructura para forzar el cambio de contraseña en el primer inicio de sesión **ya existe** y funciona:
- Campo en BD: `users.password_change_required` (boolean, default `false`)
- Middleware: `app/Http/Middleware/ForcePasswordChange.php` (alias `force.password`)
- Pantalla: `resources/js/Pages/Profile/ChangePassword.tsx`
- Controlador: `app/Http/Controllers/ProfileController.php`

Lo que falta es **exponer estas opciones en la UI** de creación de empleado/usuario y **conectar el frontend con el backend**.

---

## Objetivo de la modificación

Al crear un empleado con acceso al sistema, el administrador debe poder:

1. **Elegir el modo de contraseña:**
   - **Autogenerada** (comportamiento actual, pero sincronizado entre frontend y backend)
   - **Manual** (digitar contraseña y confirmación, como en `Users/Create.tsx`)

2. **Decidir con un checkbox** si el usuario debe cambiar la contraseña en su primer inicio de sesión (`password_change_required`).

3. **Si el checkbox está activo**, al iniciar sesión por primera vez el usuario debe ser redirigido automáticamente a cambiar su contraseña (reutilizar flujo existente de `ForcePasswordChange`).

---

## Archivos involucrados

| Archivo | Rol actual | Cambio requerido |
|---------|-----------|------------------|
| `resources/js/Pages/Employees/Create.tsx` | Formulario crear empleado + acceso | UI contraseña manual/autogenerada + checkbox |
| `resources/js/Pages/Employees/Show.tsx` | Modal "Crear acceso" en empleado existente | Misma UI (consistencia) |
| `app/Http/Requests/Employee/StoreEmployeeRequest.php` | Validación crear empleado | Validar `user_password`, `password_mode`, `require_password_change` |
| `app/Http/Requests/Employee/StoreEmployeeAccessRequest.php` | Validación crear acceso posterior | Mismas reglas de contraseña |
| `app/Http/Controllers/EmployeeController.php` | `store()`, `storeAccess()`, `resetPassword()` | Usar contraseña del request o autogenerar; respetar flag |
| `app/Http/Middleware/ForcePasswordChange.php` | Redirige si `password_change_required` | **Sin cambios** (ya funciona) |
| `resources/js/Pages/Profile/ChangePassword.tsx` | Cambio de contraseña forzado | **Sin cambios** (ya funciona) |
| `resources/js/Pages/Users/Create.tsx` | Referencia de UI para contraseña manual | Usar como patrón de diseño |

### Referencia de código existente

**Generación server-side (autoritativa):**
```php
// app/Http/Controllers/EmployeeController.php
protected function generateTemporaryPassword(): string
{
    $upper = Str::upper(Str::random(2));
    $lower = Str::lower(Str::random(4));
    $number = (string) random_int(100, 999);
    $special = collect(['#', '@', '$', '%', '!', '&'])->random();
    return $upper.$lower.$number.$special;
}
```

**Creación actual (siempre autogenera y siempre fuerza cambio):**
```php
// EmployeeController::store() — líneas ~128-140
$temporaryPassword = $this->generateTemporaryPassword();
$newUser = User::create([
    // ...
    'password' => Hash::make($temporaryPassword),
    'password_change_required' => true, // ← siempre true, hardcodeado
]);
```

**Patrón de contraseña manual en Users/Create.tsx:**
- Campos `password` y `password_confirmation` en el formulario
- Botón "Generar" que llama a `generatePassword(12)` de `@/lib/utils`
- La contraseña **sí se envía** al backend en el POST

**Import CSV ya soporta ambos modos** (`EmployeeUserImportStrategy.php`):
- Si `user_password` viene vacío → autogenera + `password_change_required = true`
- Si `user_password` tiene valor → usa esa contraseña + `password_change_required = false`

Usar esa lógica como referencia de negocio.

---

## Especificación funcional

### 1. Formulario — Crear empleado (`Employees/Create.tsx`)

Cuando `create_user_account === true`, mostrar sección de contraseña con:

#### a) Selector de modo de contraseña (radio o tabs)

| Opción | Comportamiento |
|--------|----------------|
| **Autogenerar contraseña** (default) | Muestra contraseña en campo de solo lectura + botón regenerar. Al enviar, incluir `user_password` en el formulario con el valor generado. |
| **Definir contraseña manualmente** | Muestra campos editables: `Contraseña` y `Confirmar contraseña`. Botón opcional "Generar" que rellena ambos campos. |

Campos nuevos en `useForm`:
```typescript
password_mode: 'auto' as 'auto' | 'manual',
user_password: '',
user_password_confirmation: '',
require_password_change: true, // checkbox, default true
```

#### b) Checkbox de cambio obligatorio

```
☑ Requerir cambio de contraseña en el primer inicio de sesión
```

- **Label:** "Requerir cambio de contraseña en el primer inicio de sesión"
- **Descripción:** "El usuario deberá establecer una nueva contraseña antes de acceder al sistema."
- **Default:** `true` (marcado)
- Campo enviado: `require_password_change` (boolean)

#### c) Comportamiento al enviar

- Modo `auto`: enviar `user_password` con la contraseña generada en el cliente (ya no depender solo del servidor).
- Modo `manual`: enviar `user_password` y `user_password_confirmation` diligenciados por el admin.
- Enviar `require_password_change` siempre que `create_user_account` sea true.

#### d) Mensaje informativo

- Modo auto: "Esta contraseña se mostrará una vez después de guardar. Anótela antes de continuar."
- Modo manual: "La contraseña quedará activa de inmediato. Compártela de forma segura con el empleado."

---

### 2. Formulario — Crear acceso en empleado existente (`Employees/Show.tsx`)

Aplicar **la misma UI y campos** en el modal "Crear acceso al sistema":
- Selector auto/manual
- Campos de contraseña
- Checkbox `require_password_change`
- Enviar los nuevos campos en `router.post(route('employees.access.store', ...))`

> Nota: Actualmente `accessPassword` es solo visual y no se envía. Corregir este desfase.

---

### 3. Validación backend

#### `StoreEmployeeRequest.php`

Agregar reglas condicionales cuando `create_user_account` es true:

```php
'password_mode' => ['required_if:create_user_account,1', 'nullable', 'in:auto,manual'],
'user_password' => [
    'required_if:create_user_account,1',
    'nullable',
    'string',
    'min:8',
    'regex:/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/', // al menos 1 minúscula, 1 mayúscula, 1 número, 1 especial
],
'user_password_confirmation' => [
    'required_if:password_mode,manual',
    'nullable',
    'same:user_password',
],
'require_password_change' => ['nullable', 'boolean'],
```

Mensajes en español:
- `user_password.min` → "La contraseña debe tener al menos 8 caracteres."
- `user_password.regex` → "La contraseña debe incluir mayúsculas, minúsculas, números y un carácter especial."
- `user_password_confirmation.same` → "La confirmación de contraseña no coincide."

#### `StoreEmployeeAccessRequest.php`

Replicar las mismas reglas para `password_mode`, `user_password`, `user_password_confirmation` y `require_password_change`.

---

### 4. Lógica backend — `EmployeeController.php`

#### `store()` y `storeAccess()`

Reemplazar la lógica hardcodeada por:

```php
// Determinar contraseña
$passwordPlain = $request->validated('user_password');
if (blank($passwordPlain)) {
    $passwordPlain = $this->generateTemporaryPassword();
}

// Determinar si requiere cambio
$requireChange = $request->boolean('require_password_change', true);

$newUser = User::create([
    // ...campos existentes...
    'password' => Hash::make($passwordPlain),
    'password_change_required' => $requireChange,
]);
```

Flash `temporary_password`:
- Enviar en la respuesta **solo si** se autogeneró la contraseña en el servidor (fallback) **o** si el admin eligió modo auto (para que pueda anotarla).
- Si modo manual y `require_password_change = false`, no es obligatorio mostrar la contraseña en flash (el admin ya la conoce).

#### `resetPassword()` (opcional, mejora de consistencia)

Considerar agregar el checkbox `require_password_change` también al flujo de restablecer contraseña desde `Employees/Show.tsx`. Por defecto `true` para mantener comportamiento actual.

---

### 5. Primer inicio de sesión — Cambio obligatorio de contraseña

**No requiere desarrollo nuevo.** El flujo ya está implementado:

1. Usuario inicia sesión → `AuthenticatedSessionController::store()`
2. Redirige a `dashboard`
3. Middleware `force.password` detecta `password_change_required = true`
4. Redirige a `profile.change-password.show` con mensaje de advertencia
5. Usuario cambia contraseña en `Profile/ChangePassword.tsx` (sin pedir contraseña actual si es forzado)
6. `ProfileController::changePassword()` pone `password_change_required = false`
7. Usuario accede normalmente al sistema

**Verificar** que funcione correctamente después de los cambios:
- Crear empleado con acceso, checkbox marcado → login → debe redirigir a cambio de contraseña
- Crear empleado con acceso, checkbox desmarcado → login → acceso directo al dashboard

---

## Diseño de UI sugerido

Reutilizar componentes existentes: `Input`, `Switch`, `Button`, `Card`.

```
┌─ Acceso al sistema ─────────────────────────────────────┐
│ [Switch] Crear acceso                                   │
│                                                         │
│ ── (visible si Crear acceso = ON) ──                   │
│ Correo de acceso: [________________________]            │
│ Rol:              [Seleccionar rol        ▼]            │
│                                                         │
│ Contraseña:                                             │
│   ( ) Autogenerar    (•) Definir manualmente            │
│                                                         │
│   [modo auto]                                           │
│   ┌──────────────────────────────┐ [↻ Regenerar]       │
│   │  Xk9mP#234                   │                     │
│   └──────────────────────────────┘                     │
│   ⚠ Esta contraseña se mostrará una vez al guardar.    │
│                                                         │
│   [modo manual]                                         │
│   Contraseña:          [________________________]       │
│   Confirmar:           [________________________]       │
│   [↻ Generar sugerencia]                               │
│                                                         │
│ [☑] Requerir cambio de contraseña en el primer         │
│     inicio de sesión                                    │
│     El usuario deberá establecer una nueva contraseña   │
│     antes de acceder al sistema.                        │
└─────────────────────────────────────────────────────────┘
```

Seguir el estilo visual de `Users/Create.tsx` para la sección de contraseña manual.

---

## Criterios de aceptación

### Creación de empleado con acceso

- [ ] Con "Autogenerar" seleccionado, la contraseña mostrada en pantalla es la misma que se guarda en BD.
- [ ] Con "Definir manualmente", el admin puede escribir contraseña y confirmación; se valida longitud mínima (8), complejidad y coincidencia.
- [ ] El checkbox "Requerir cambio de contraseña en el primer inicio de sesión" aparece cuando se crea acceso.
- [ ] Checkbox marcado (default) → `password_change_required = true` en BD.
- [ ] Checkbox desmarcado → `password_change_required = false` en BD.
- [ ] Tras guardar en modo auto, se muestra toast con la contraseña en `Employees/Show` (flash `temporary_password`).
- [ ] Tras guardar en modo manual, no es necesario mostrar toast de contraseña (opcional).

### Crear acceso en empleado existente (Show)

- [ ] El modal "Crear acceso" tiene las mismas opciones de contraseña y checkbox.
- [ ] La contraseña enviada desde el modal es la que se persiste.

### Primer inicio de sesión

- [ ] Usuario creado con checkbox activo: al hacer login es redirigido a `/profile/change-password` y no puede navegar hasta cambiar la contraseña.
- [ ] Usuario creado con checkbox inactivo: al hacer login accede directamente al dashboard.
- [ ] Tras cambiar la contraseña forzada, `password_change_required` queda en `false` y el acceso es normal.

### Validaciones y errores

- [ ] Contraseña manual con menos de 8 caracteres → error en formulario.
- [ ] Contraseña y confirmación no coinciden → error en formulario.
- [ ] Contraseña sin complejidad requerida → error en formulario.
- [ ] Mensajes de error en español.

### Regresión

- [ ] Crear empleado **sin** acceso al sistema sigue funcionando igual.
- [ ] Importación CSV de empleados/usuarios no se ve afectada.
- [ ] Restablecer contraseña desde Show sigue funcionando (idealmente con checkbox opcional).
- [ ] Módulo `Users/Create` (usuarios sin empleado) no se modifica en esta tarea.

---

## Plan de implementación sugerido

### Paso 1 — Backend (validación y lógica)
1. Actualizar `StoreEmployeeRequest.php` con nuevos campos y reglas.
2. Actualizar `StoreEmployeeAccessRequest.php` con las mismas reglas.
3. Modificar `EmployeeController::store()` para usar contraseña del request y flag configurable.
4. Modificar `EmployeeController::storeAccess()` igual.
5. (Opcional) Actualizar `resetPassword()` con checkbox.

### Paso 2 — Frontend (crear empleado)
1. Refactorizar sección "Acceso al sistema" en `Employees/Create.tsx`.
2. Agregar campos al `useForm`.
3. Implementar toggle auto/manual.
4. Agregar checkbox `require_password_change`.
5. Enviar `user_password` en el POST (corregir desfase UI/backend).

### Paso 3 — Frontend (acceso en Show)
1. Replicar UI en modal de `Employees/Show.tsx`.
2. Enviar nuevos campos en `submitAccess`.

### Paso 4 — Pruebas manuales
1. Crear empleado + acceso, modo auto, checkbox ON → verificar login forzado.
2. Crear empleado + acceso, modo manual, checkbox OFF → verificar login directo.
3. Crear acceso posterior en Show con ambos modos.
4. Verificar mensajes de validación.

---

## Notas técnicas

- **No crear migraciones:** el campo `password_change_required` ya existe en `users`.
- **No modificar middleware:** `ForcePasswordChange` ya cubre el caso de primer inicio.
- **Seguridad:** nunca loguear contraseñas en texto plano; solo usar flash session para mostrar una vez al admin.
- **Consistencia:** alinear reglas de complejidad con `ChangePasswordRequest` (mínimo 8 caracteres).
- **Patrón de referencia:** `Users/Create.tsx` para UI de contraseña; `EmployeeUserImportStrategy.php` para lógica auto/manual + flag.

---

## Prompt corto (copiar y pegar en el agente)

```
Implementa en el ERP MiTallerCol (Laravel + Inertia + React) las siguientes mejoras en el módulo de creación de empleado con acceso al sistema:

1. En Employees/Create.tsx y en el modal de crear acceso en Employees/Show.tsx:
   - Agregar selector "Autogenerar contraseña" vs "Definir manualmente"
   - Modo auto: mostrar contraseña generada (generatePassword) con botón regenerar y ENVIARLA al backend en user_password
   - Modo manual: campos password + confirmación editables (como Users/Create.tsx)
   - Checkbox "Requerir cambio de contraseña en el primer inicio de sesión" (require_password_change, default true)

2. Backend:
   - StoreEmployeeRequest y StoreEmployeeAccessRequest: validar password_mode, user_password (min 8, complejidad), user_password_confirmation (same), require_password_change
   - EmployeeController store() y storeAccess(): usar user_password del request o autogenerar si viene vacío; respetar require_password_change para password_change_required (no hardcodear true)

3. El flujo de primer login ya existe (ForcePasswordChange middleware + Profile/ChangePassword). Solo verificar que funcione con el flag configurable.

4. Corregir el bug actual donde la contraseña mostrada en el frontend no coincide con la guardada en el servidor.

Seguir convenciones existentes del proyecto. Mensajes de error en español. No modificar Users/Create ni la importación CSV.
```

---

*Documento generado para el proyecto ERP_CONFECCION — Julio 2026*
