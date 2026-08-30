# Prompt de implementación — Rediseño del módulo Bancos (con logo del banco)

Pégale este documento completo a tu agente de código dentro del repo `ERP_CONFECCION`.
Continúa el rediseño ya implementado (`ViewToggle`, `useViewMode`, `EntityCard`, `StatBand`, `FilterChips`, `UsageBar`, `StickySaveBar` ya existen en `resources/js/Components/UI/`). Si alguno falta, créalo según `prompt-rediseno-modulos.md`.

Prototipo de referencia: pantallas **Bancos**, **Editar banco** y **Selección de banco** de `Rediseno - ERP (4 modulos).dc.html`.

---

## 0. Objetivo

1. Rediseñar `Pages/Banks/{Index,Create,Edit}.tsx` con el mismo lenguaje que Empresas: `StatBand`, `FilterChips`, `ViewToggle` Tabla ⇄ Tarjetas.
2. **Mostrar el logo del banco.** Cada banco guarda un logo; al seleccionarlo en la ficha de datos de pago del empleado aparece su logo, y con él las reglas de cuenta de ese banco.
3. Donde no haya logo cargado, se muestra un **monograma** (2 letras del código) con el mismo borde y tamaño — nunca un hueco vacío.

---

## 1. Backend

### 1.1 Migración

```php
Schema::table('banks', function (Blueprint $table) {
    $table->string('logo_path')->nullable()->after('name');
    $table->string('brand_color', 7)->nullable()->after('logo_path');
    $table->string('type', 20)->default('bank')->after('brand_color'); // bank | wallet | coop
    $table->string('account_format')->nullable()->after('type');       // máscara, ej. 000-000000-00
    $table->string('account_hint')->nullable()->after('account_format');
    $table->boolean('requires_key')->default(true)->after('account_hint');
    $table->text('notes')->nullable()->after('requires_key');
});
```

### 1.2 Modelo `app/Models/Bank.php`

- Añadir a `$fillable`: `logo_path`, `brand_color`, `type`, `account_format`, `account_hint`, `requires_key`, `notes`.
- `$casts`: `'requires_key' => 'boolean'`.
- Accesor:

```php
protected $appends = ['logo_url', 'initials'];

public function getLogoUrlAttribute(): ?string
{
    return $this->logo_path ? Storage::disk('public')->url($this->logo_path) : null;
}

public function getInitialsAttribute(): string
{
    $base = $this->code ?: $this->name;
    return mb_strtoupper(mb_substr(preg_replace('/[^A-Za-z]/', '', $base), 0, 2));
}
```

- Constantes de tipo con etiquetas en español: `Banco`, `Billetera digital`, `Cooperativa`.

### 1.3 `BankController`

- `index`: añadir `withCount('employees')` (ya existe), `stats` para `StatBand` y soportar filtros `status`, `type`, `without_logo`.

```php
'stats' => [
    'active'          => Bank::where('is_active', true)->count(),
    'total'           => Bank::count(),
    'employees_with_account' => Employee::whereNotNull('bank_id')->count(),
    'employees_total' => Employee::count(),
    'with_logo'       => Bank::whereNotNull('logo_path')->count(),
],
```

- `store` / `update`: si llega `logo` (archivo), guardar en `banks/logos` en el disco `public` y borrar el anterior con `Storage::disk('public')->delete($old)`. Aceptar `logo_remove` booleano para limpiarlo.
- `destroy`: sin cambios (ya desactiva cuando hay empleados).

### 1.4 Requests

`StoreBankRequest` / `UpdateBankRequest`:

```php
'logo' => ['nullable', 'image', 'mimes:png,svg,webp', 'max:512', 'dimensions:min_width=128,min_height=128'],
'brand_color' => ['nullable', 'regex:/^#[0-9A-Fa-f]{6}$/'],
'type' => ['required', Rule::in(['bank', 'wallet', 'coop'])],
'account_format' => ['nullable', 'string', 'max:40'],
'account_hint' => ['nullable', 'string', 'max:120'],
'requires_key' => ['boolean'],
'notes' => ['nullable', 'string', 'max:500'],
```

Mensajes en español. Para SVG, validar el mime real y sanear el contenido (rechazar `<script`) antes de guardar.

### 1.5 Empleados

`EmployeeController@banksOptionsForEmployee`: incluir en el `select` los campos nuevos (`logo_path`, `brand_color`, `type`, `account_format`, `account_hint`, `requires_key`, `notes`) más `logo_url` e `initials` vía `$appends`, para que el selector del front pinte logo y reglas sin peticiones extra.

### 1.6 Tipos front

`resources/js/types/index.d.ts` — extender `Bank`:

```ts
export interface Bank {
    id: number;
    name: string;
    code: string | null;
    is_active: boolean;
    logo_url: string | null;
    initials: string;
    brand_color: string | null;
    type: 'bank' | 'wallet' | 'coop';
    account_format: string | null;
    account_hint: string | null;
    requires_key: boolean;
    notes: string | null;
    employees_count?: number;
}
```

---

## 2. Componente nuevo: `resources/js/Components/UI/BankLogo.tsx`

Es la pieza central: **una sola** implementación del logo con respaldo de monograma, usada en tabla, tarjetas, selector y previsualizaciones.

```tsx
import { cn } from '@/lib/utils';

interface Props {
    name: string;
    initials: string;
    logoUrl?: string | null;
    brandColor?: string | null;
    size?: 30 | 34 | 44 | 72;
    className?: string;
}

const RADIUS: Record<number, string> = { 30: 'rounded-[7px]', 34: 'rounded-lg', 44: 'rounded-[10px]', 72: 'rounded-xl' };
const FONT: Record<number, string> = { 30: 'text-[10px]', 34: 'text-[11px]', 44: 'text-xs', 72: 'text-lg' };

export function BankLogo({ name, initials, logoUrl, brandColor, size = 34, className }: Props) {
    return (
        <span
            style={{ width: size, height: size, borderColor: logoUrl && brandColor ? brandColor : undefined }}
            className={cn(
                'inline-flex shrink-0 items-center justify-center overflow-hidden border bg-white tracking-wide',
                'border-slate-200 dark:border-slate-700 dark:bg-slate-900',
                logoUrl ? '' : 'text-indigo-600 dark:text-indigo-300',
                RADIUS[size], FONT[size], className,
            )}
        >
            {logoUrl ? (
                <img src={logoUrl} alt={`Logo de ${name}`} loading="lazy" className="h-full w-full object-contain p-1" />
            ) : (
                <span aria-hidden>{initials}</span>
            )}
        </span>
    );
}
```

Reglas:
- **Nunca** un contenedor vacío: sin `logo_url` se pinta el monograma en el mismo tamaño y borde.
- El logo va con `object-contain` y `p-1` para que un logo cuadrado y uno alargado se vean igual de bien.
- Fondo blanco (`bg-white`, en oscuro `slate-900`): la mayoría de logos bancarios son de color sobre blanco.
- Si el banco tiene `brand_color`, el borde toma ese color solo cuando hay logo.
- **No** meter un control de arrastre/subida en cajas ≤ 44px: la subida vive únicamente en la pantalla de Editar banco (§4).

---

## 3. `Pages/Banks/Index.tsx`

Orden: `PageHeader` → `StatBand` → filtros (buscador + `FilterChips` + `ViewToggle`) → tabla o tarjetas → `Pagination`.

**PageHeader**: título `Bancos`, descripción "Catálogo de bancos para los datos de pago de empleados. El logo se muestra al elegir el banco en la ficha del empleado y en los desprendibles." Acción `Nuevo banco` con `whitespace-nowrap shrink-0`.

**StatBand** (3 métricas):
1. `Bancos activos` — `5 / 6`, nota con el inactivo más reciente.
2. `Empleados con cuenta` — `10 / 128`, nota `118 sin datos de pago`.
3. `Logos cargados` — `2 / 6`, nota `Los demás usan monograma`; `tone: 'warning'` si faltan más de la mitad.

**FilterChips**: `Todos`, `Activos`, `Billeteras` (`type=wallet`), `Sin logo` (`whereNull('logo_path')`). Cada uno con `count`.

**Vista tabla** (sustituye la actual): Banco (`BankLogo size=34` + nombre + etiqueta de tipo como subtítulo) · Código (`font-mono text-indigo-600 dark:text-indigo-300`) · Empleados (derecha, `tabular-nums`) · Estado (`Switch` en línea que hace `router.patch(route('banks.update', b.id), { is_active })` optimista con `preserveScroll`) · Acciones (`Editar`, menú `…`).
Se elimina la columna "Código" como primera columna: el nombre con logo manda, el código va después.
Pie de tabla: "Los bancos sin logo muestran el monograma del código. Sube el logo desde Editar banco."

**Vista tarjetas**: `EntityCard` con `BankLogo size=44` en lugar de iniciales, `Badge` de estado, `código · tipo` como subtítulo, métrica `Empleados`, acciones `Editar` + eliminar.

Empty state existente.

---

## 4. `Pages/Banks/Create.tsx` y `Edit.tsx`

Dos columnas (`lg:grid-cols-[1.5fr,1fr]`):

**Izquierda — "Datos del banco"** (`Card`), texto de ayuda "El código se usa en la carga masiva de empleados y en los archivos de dispersión":
- `Nombre`, `Código` (mono, se sugiere en mayúsculas desde el nombre), `Tipo` (`Select`: Banco / Billetera digital / Cooperativa), `Color de marca` (input hex + muestra de color; `<input type="color">` sincronizado).
- Divisor, luego `Switch` "Banco activo" con descripción "Solo los activos aparecen al registrar nuevos empleados".
- Sección "Reglas de cuenta": `account_format` (placeholder `000-000000-00`), `account_hint` ("10 dígitos, sin guiones"), `Switch requires_key`, `notes` (textarea) — son los textos que verá quien capture los datos del empleado.

**Derecha — "Logo"** (`Card`):
- Zona de arrastre de ~150px de alto: `<label>` con `input type="file" className="sr-only"`, borde `border-dashed`, estados `drag over` (borde indigo) y con archivo (miniatura `object-contain` + botón `Quitar`).
- Texto: "Arrastra el archivo del banco. PNG o SVG con fondo transparente, mínimo 128×128."
- Debajo, divisor y **"Previsualización"**: la fila tal como se verá en la ficha del empleado — `BankLogo size=34` + nombre + `Ahorros · ****4821` en mono. Usa `URL.createObjectURL(file)` para reflejar el archivo recién elegido antes de guardar (revocar en `useEffect` cleanup).
- Nota: "Así se ve en la ficha del empleado y en el desprendible de nómina."

**Pie**: `StickySaveBar`. En Edit, mostrar "N empleados con cuenta en este banco. Desactivarlo no borra sus datos de pago."
Enviar con `useForm` + `forceFormData: true` (hay archivo) y `router.post` con `_method: 'put'` en Edit.

---

## 5. Selector de banco en la ficha del empleado — **el requisito principal**

Componente nuevo `resources/js/Components/Forms/BankAccountFields.tsx`, usado en `Pages/Employees/Create.tsx` y `Edit.tsx` (reemplaza el `<select>` de `bank_id` y los inputs sueltos de cuenta/clave).

Layout `lg:grid-cols-[340px,minmax(0,1fr)]`:

**Panel izquierdo — lista de bancos**
- Buscador "Filtrar bancos activos".
- Lista con `max-h-[340px] overflow-y-auto`, un `<button>` por banco: `BankLogo size=30` + nombre + código en mono + check indigo cuando está seleccionado.
- Seleccionado: `border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20`. Hover: `bg-slate-100 dark:bg-slate-700/40`.
- Navegación por teclado: ↑/↓ mueven, Enter selecciona, `role="listbox"` / `role="option"` con `aria-selected`.
- Pie: "Solo bancos activos. [Administrar catálogo]" (enlace a `banks.index`, protegido con `Can`).

**Panel derecho — el banco seleccionado**
- Cabecera: `BankLogo size=72` + nombre en 19px + `código · tipo · N empleados` + `Badge` de estado. **Aquí es donde el logo aparece al seleccionar**; si el banco no tiene logo, el mismo recuadro muestra el monograma.
- Divisor.
- Campos: `Tipo de cuenta` (`Select` Ahorros/Corriente, oculto si `type === 'wallet'`), `Número de cuenta` (mono, `placeholder = account_format`, texto de ayuda `account_hint`), `Clave / referencia de pago` (a ancho completo; si `requires_key === false`, deshabilitado con placeholder "No requiere clave").
- Aviso informativo (icono `InformationCircleIcon` indigo + borde): el `notes` del banco. Ejemplos reales que deben verse distintos al cambiar de banco:
  - Bancolombia → "cuenta de 10 dígitos y clave de dispersión de 4; archivo en formato SAP".
  - Nequi → "usa el celular como cuenta; no pide tipo de cuenta ni clave".
- Pie: "El logo se toma del catálogo de bancos; súbelo una vez y aparece en toda la aplicación." + botón `Guardar datos de pago`.
- Sin banco seleccionado: estado vacío "Elige un banco para capturar la cuenta", sin campos.

Al cambiar de banco: limpiar `bank_account_number` y `bank_key` solo si el formato de cuenta cambia, y respetar la validación existente de `StoreEmployeeRequest` (los tres campos van juntos o los tres vacíos).

---

## 6. Donde más aparece el logo

- **Lista de empleados**: `BankLogo size=30` junto al banco en la columna de datos de pago (si esa columna existe).
- **Desprendible / exportación de nómina**: incluir `logo_url` en el payload y renderizarlo a `24px` de alto junto al número de cuenta enmascarado.
- **Carga masiva (CSV)**: en la previsualización de filas, mostrar el logo del banco resuelto por código para que el usuario confirme el mapeo de un vistazo.

---

## 7. Consistencia

- Todo con Tailwind y las primitivas del repo; Heroicons 24 outline. Sin librerías nuevas.
- `tabular-nums` en cuentas, números de empleados y montos.
- Foco visible en cada opción de la lista: `focus-visible:ring-2 focus-visible:ring-indigo-500`.
- Modo claro y oscuro verificados en `BankLogo` (fondo blanco del logo en ambos).
- **Legal/asset**: la aplicación no dibuja ni empaqueta logos de bancos. Los archivos los sube el cliente en Editar banco; el respaldo siempre es el monograma.

---

## 8. Criterios de aceptación

- [ ] Al seleccionar un banco en la ficha del empleado aparece su logo en el recuadro de 72px, junto al nombre, código y tipo.
- [ ] Un banco sin logo muestra el monograma de 2 letras en el mismo recuadro — nunca un hueco ni un texto de "arrastra aquí".
- [ ] El formato de cuenta, la ayuda, la clave y la nota cambian al cambiar de banco (comprobar Bancolombia vs Nequi).
- [ ] La subida de logo existe solo en Crear/Editar banco, con previsualización de cómo se verá en la ficha del empleado.
- [ ] Índice de bancos con `StatBand`, chips (incluido "Sin logo") y toggle Tabla ⇄ Tarjetas persistente.
- [ ] El switch de estado en la tabla activa/desactiva sin salir de la página.
- [ ] Validación rechaza logos > 512 KB, menores de 128×128 o de mime distinto a png/svg/webp, con mensaje en español.
- [ ] Al reemplazar un logo se borra el archivo anterior del disco.
- [ ] Se respetan los permisos `banks.index.{view,create,edit,delete}` en toda acción nueva.
- [ ] Modo claro y oscuro correctos en `BankLogo` y en el selector.
