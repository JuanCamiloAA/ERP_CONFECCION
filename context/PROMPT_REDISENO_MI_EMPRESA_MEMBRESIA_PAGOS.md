# PROMPT — Rediseño completo de "Mi empresa" + membresía, tarjeta y débito automático

Aplica el rediseño completo de `Pages/Settings/Index.tsx` ("Mi empresa") al proyecto Laravel + Inertia + React (`ERP_CONFECCION`), migrándolo a la piel compartida `emp-*` (`resources/css/module-ui.css`) —es de los últimos módulos que sigue con las primitivas viejas (`Card`, `PageHeader`, `Badge`, `Button`, `Input`, `Select`)— y sumando la base de datos necesaria para más adelante conectar una pasarela de pagos real y el débito automático de la membresía.

La maqueta de referencia (interactiva) está en `Mi Empresa Rediseño.dc.html`. Cuando este documento y la maqueta discrepen, manda la maqueta.

---

## 0. Reglas que no se negocian

1. **Una sola hoja de tokens**: `resources/css/module-ui.css`. Nada de hex sueltos ni variables nuevas; todo color sale de `var(--emp-*)`.
2. **Nunca se guarda el número de tarjeta completo ni el CVC**. Solo se persiste lo que devuelve la pasarela tras tokenizar (últimos 4 dígitos, marca, vencimiento, un token/id de cliente). Esto es un requisito de cumplimiento (PCI-DSS), no una preferencia de diseño.
3. **Botones delineados, iconos Phosphor, elevación = borde, foco visible**, igual que el resto de módulos ya migrados (Producción, Empleados, Referencias).
4. **Claro y oscuro**: nada de colores fijos asumiendo tema oscuro.
5. La pasarela de pagos en sí (Stripe/Wompi/PayU/Mercado Pago — a definir con el negocio) **no se integra en este cambio**: se deja la estructura de datos, los endpoints y la UI listos para conectarla; el guardado de tarjeta y el cobro automático quedan simulados/pendientes de la integración real.

---

## 1. Base de datos

### 1.1 Nuevas columnas en `companies`
Migración `add_billing_fields_to_companies_table`:

| Columna | Tipo | Nota |
| --- | --- | --- |
| `payment_gateway` | string, nullable | `stripe`, `wompi`, etc. Vacío hasta integrar. |
| `payment_customer_id` | string, nullable | id del cliente en la pasarela (no dato sensible). |
| `auto_debit_enabled` | boolean, default false | switch de renovación automática. |
| `next_charge_at` | date, nullable | próxima fecha de cobro (hoy se puede igualar a `membership_ends_at`). |

### 1.2 Nueva tabla `company_payment_methods`
Una tarjeta activa por empresa (deja espacio a histórico si algún día se soportan varias):

| Columna | Tipo | Nota |
| --- | --- | --- |
| `id` | bigint | |
| `company_id` | FK, único | |
| `gateway_token` | string | referencia tokenizada de la pasarela; nunca el PAN. |
| `brand` | string | Visa, Mastercard, etc. |
| `last4` | string(4) | |
| `expiry_month` | unsignedTinyInteger | |
| `expiry_year` | unsignedSmallInteger | |
| `holder_name` | string | |
| `created_at` / `updated_at` | timestamps | |

### 1.3 Nueva tabla `company_billing_charges`
Historial de cobros (vacía hasta que exista integración real; el backend puede ya insertar filas manuales si soporte cobra por fuera):

| Columna | Tipo | Nota |
| --- | --- | --- |
| `id` | bigint | |
| `company_id` | FK | |
| `membership_plan_id` | FK, nullable | plan vigente al momento del cobro |
| `amount` | decimal(12,2) | |
| `currency` | string(3), default COP | |
| `concept` | string | ej. "Renovación mensual — Plan Profesional" |
| `status` | enum: `pendiente`,`pagado`,`fallido` | |
| `gateway_reference` | string, nullable | id de la transacción en la pasarela |
| `charged_at` | datetime, nullable | |
| `created_at` / `updated_at` | timestamps | |

### 1.4 Modelo `Company`
- Agregar a `$fillable`: `payment_gateway`, `payment_customer_id`, `auto_debit_enabled`, `next_charge_at`.
- Cast `auto_debit_enabled` a boolean, `next_charge_at` a `date`.
- Relación `paymentMethod(): HasOne` → `CompanyPaymentMethod`.
- Relación `billingCharges(): HasMany` → `CompanyBillingCharge`, orden `charged_at desc`.

### 1.5 Modelos nuevos
`CompanyPaymentMethod` y `CompanyBillingCharge` (namespace `App\Models`), con sus `belongsTo(Company::class)` y, en el segundo caso, `belongsTo(MembershipPlan::class)`.

---

## 2. Permisos nuevos

| Permiso | Qué habilita | Por defecto |
| --- | --- | --- |
| `settings.index.edit` | Ya existe: editar Datos/Nómina/Deducciones/Dificultad | — |
| `settings.membership.manage_payment` | Cambiar/agregar tarjeta y activar/desactivar el débito automático | Solo el **dueño de la cuenta** (rol Admin de empresa, `is_owner` o rol raíz de la empresa — usar el mismo criterio que ya distingue al admin principal de un staff con `settings.index.edit`) |

Agregar la fila en `PermissionHelper.php` bajo el bloque de `settings`, y en `CompanyDefaultRolesService.php` asignarla solo al rol de administrador propietario, nunca a roles de staff aunque tengan `settings.index.edit`.

Nota: `settings.membership.manage_payment` es **más restrictivo** que `settings.index.edit` a propósito — un contador con acceso a "Mi empresa" para ver nómina no debería poder cambiar la tarjeta con la que se cobra la membresía.

---

## 3. Backend

### 3.1 `SettingsController`
- `index()`: agregar a la respuesta Inertia el prop `membership` ampliado con `payment_method` (o `null`), `auto_debit_enabled`, `next_charge_at`, `next_charge_amount` (= precio del plan vigente) y `billing_charges` (paginado o los últimos 10).
- Nuevo `updatePaymentMethod(Request $request)`: valida los campos del formulario (hoy simulados: `holder_name`, `expiry_month`, `expiry_year`, y un dato de tarjeta que en la integración real nunca llega tal cual al backend — llega tokenizado desde el frontend de la pasarela). Por ahora, mientras no hay pasarela conectada, generar un `gateway_token` de marcador de posición y guardar solo `brand`/`last4`/vencimiento/nombre. Requiere `settings.membership.manage_payment`.
- Nuevo `toggleAutoDebit(Request $request)`: activa/desactiva `auto_debit_enabled`; si se activa sin `payment_method`, devuelve error de validación. Requiere `settings.membership.manage_payment`.

### 3.2 Rutas (`routes/web.php`)
```
PUT  /settings/payment-method   -> SettingsController@updatePaymentMethod
POST /settings/auto-debit       -> SettingsController@toggleAutoDebit
```
Ambas dentro del grupo de rutas de empresa autenticada, con el permiso correspondiente vía middleware/policy.

### 3.3 Job/comando futuro (dejar el hueco, no implementar el cobro real)
Un comando programado diario `ProcessMembershipAutoDebits` que, cuando exista integración: recorra empresas con `auto_debit_enabled = true` y `next_charge_at <= hoy`, cree una fila en `company_billing_charges` en estado `pendiente`, llame a la pasarela y actualice el estado. Dejar el comando registrado en `routes/console.php` con un `//TODO: conectar pasarela` explícito — no se implementa el llamado real en este cambio.

---

## 4. Frontend

| Archivo | Qué se hace |
| --- | --- |
| `resources/js/Pages/Settings/Index.tsx` | Reescribir sobre la maqueta: `.emp-form`, índice lateral `emp-nav-item`, secciones Datos/Nómina/Deducciones/Dificultad en `emp-card`, barra de guardado `StickySaveBar` restyleada a `emp-btn` |
| `resources/js/Components/Settings/MembershipSection.tsx` | Reescribir: tarjeta de estado, límites, aviso de renovación, método de pago + modal, historial de cobros — todo `emp-*` |
| `resources/js/Components/Settings/PaymentMethodModal.tsx` | **Nuevo**: formulario de tarjeta (número, vencimiento, CVC, nombre) — hoy simulado; dejar un comentario marcando dónde se integra el campo tokenizado del SDK de la pasarela |
| `resources/js/Components/Settings/BillingHistoryTable.tsx` | **Nuevo**: tabla `emp-*` con estado vacío, reusable si se agrega paginación luego |
| `resources/js/Components/UI/Switch.tsx` | Verificar que ya siga el patrón `emp-*`; si no, ajustarlo (lo usa el nuevo switch de auto-débito) |
| `resources/js/types/index.d.ts` | Tipar `PaymentMethod`, `BillingCharge`, ampliar `Membership` con `payment_method`, `auto_debit_enabled`, `next_charge_at`, `next_charge_amount`, `billing_charges` |
| `app/Http/Controllers/SettingsController.php` | Endpoints de §3.1 |
| `routes/web.php` | Rutas de §3.2 |
| `app/Helpers/PermissionHelper.php` | Permiso nuevo de §2 |
| `app/Services/CompanyDefaultRolesService.php` | Asignación por defecto |
| `app/Models/Company.php`, `app/Models/CompanyPaymentMethod.php` (nuevo), `app/Models/CompanyBillingCharge.php` (nuevo) | §1.4 y §1.5 |
| `database/migrations/` | 3 migraciones de §1.1, §1.2, §1.3 |

Usar `<Can permission="settings.membership.manage_payment">` para condicionar el botón "Cambiar/Agregar tarjeta" y el switch de renovación automática — quien no lo tenga ve la información en solo lectura, igual que el resto del módulo respeta `canEdit` con `settings.index.edit`.

---

## 5. Aceptación

- Migraciones corren limpio en una base nueva y revierten sin dejar residuos (`down()` completo en las 3).
- Un usuario con `settings.index.edit` pero sin `settings.membership.manage_payment` ve la sección Membresía completa, pero sin botón de cambiar tarjeta ni switch activable.
- Activar el switch de renovación automática sin tarjeta guardada devuelve un error de validación claro, no un 500.
- El historial de cobros se ve vacío con su mensaje explicativo cuando no hay filas — no se inventa data de ejemplo en producción.
- Ningún log, respuesta JSON ni vista imprime el número completo de tarjeta o el CVC en ningún punto del flujo.
