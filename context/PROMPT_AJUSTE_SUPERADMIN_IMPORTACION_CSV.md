# AJUSTE — Super Admin: plantillas CSV e importación masiva de datos maestros
## Prompt para Claude Opus — Implementación incremental sin afectar lo ya desarrollado

---

> **USO:** Pega este documento completo en Claude Opus. El proyecto (Laravel 12, Inertia, React, multiempresa, roles Spatie, módulos de empresas, empleados-usuarios, bancos, referencias, operaciones, producción, nómina, etc.) **ya existe**. Aplica **únicamente** lo descrito aquí. No eliminar seeders existentes; este flujo es **alternativo** al `db:seed` para poblar datos cuando se incorporan nuevas empresas al sistema.

---

## 0. OBJETIVO

Exponer un **módulo exclusivo para el rol `super_admin`** que permita:

1. **Descargar plantillas CSV** (una por tipo de dato maestro) con encabezados documentados y fila de ejemplo comentada o segunda hoja de ayuda en README embebido — en CSV puro: primera fila = encabezados, fila 2 opcional con `EJEMPLO` en comentarios vía archivo `.md` aparte descargable o tooltip en UI.
2. **Subir archivos `.csv`** para **importar/poblar** la base de datos con datos maestros coherentes con el modelo actual del sistema:
   - **Empresas** (`companies`)
   - **Operaciones** (`operations`)
   - **Bancos** (`banks`)
   - **Referencias** (`references`)
   - **Empleados + usuarios vinculados** (`employees` + `users` + asignación de rol Spatie + vínculo `employee_id`/`user_id` según la arquitectura ya implementada)

3. Objetivo operativo: cargar datos **sin ejecutar seeders** en el momento de dar de alta varias empresas o ambientes.

**Regla de oro:** Ningún usuario que **no** sea `super_admin` puede ver rutas, menús, APIs ni archivos de este módulo. El **admin de empresa** no importa CSV global aquí (si en el futuro se desea import por empresa, sería otro módulo; **fuera de alcance**).

---

## 1. CONTROL DE ACCESO Y SEGURIDAD

### 1.1 Autorización

- Middleware dedicado: `EnsureSuperAdmin` (o reutilizar si existe), que verifique **una sola** condición clara:
  - Usuario tiene el rol del sistema `super_admin` (Spatie `hasRole('super_admin')`), **o** el permiso único `imports.super_admin` asignado **solo** a ese rol en el seeder de permisos.
- Registro en `bootstrap/app.php` o equivalente Laravel 12.
- Todas las rutas del módulo bajo prefijo sugerido: `/super-admin/data-imports` (evitar colisiones con módulos existentes).

### 1.2 Protección adicional

- Deshabilitar listado de directorios de `storage/app/imports`.
- Validar MIME real del upload: solo `text/csv`, `text/plain`, `application/csv` según lo que devuelva el servidor; opcional: extensión `.csv` obligatoria.
- **Tamaño máximo** configurable (ej. `config/data_import.php` → `max_upload_kb` default 5120).
- Sanitizar nombres de archivo; guardar en `storage/app/imports/{uuid}.csv` sin usar el nombre original como path.
- **CSRF** en formularios Inertia; **throttle** en rutas POST (ej. 10 por minuto por usuario) para evitar abuso.
- Opcional: registrar IP y `user_id` en cada ejecución de importación.

### 1.3 Sidebar / menú

- Ítem visible **solo** si `super_admin`, etiqueta sugerida: **“Importación de datos (CSV)”** o **“Carga masiva”**.
- No añadir permisos granulares a la matriz de empresas para este flujo salvo que el proyecto exija consistencia; en ese caso crear permisos que **solo** se asignen al rol `super_admin` en el seeder.

---

## 2. EXPERIENCIA DE USUARIO (FRONTEND INERTIA + REACT)

### 2.1 Página índice — `SuperAdmin/DataImports/Index.tsx`

Secciones en una sola página con tabs o acordeón:

1. **Instrucciones breves** (español): orden recomendado de importación, codificación UTF-8, separador `,`, delimitador de texto `"` si aplica.
2. **Descarga de plantillas:** botones por tipo:
   - `Descargar plantilla: Empresas`
   - `Descargar plantilla: Operaciones`
   - `Descargar plantilla: Bancos`
   - `Descargar plantilla: Referencias`
   - `Descargar plantilla: Empleados y usuarios`
   - Opcional: **“Paquete ZIP”** con las cinco plantillas + `LEEME_IMPORTACION.md` — recomendado.
3. **Carga de archivos:** por cada tipo, `input type="file" accept=".csv"` + botón “Importar”.
4. **Historial de importaciones** (tabla paginada): fecha, usuario, tipo, archivo (nombre original), estado (`pendiente`, `procesando`, `completado`, `fallido`), filas OK / filas con error, enlace “Ver detalle”.

### 2.2 Página detalle — `SuperAdmin/DataImports/Show.tsx`

- Resumen: totales insertados, actualizados (si aplica), omitidos.
- Lista de errores por **número de línea** y mensaje (máximo N errores en pantalla + descargar JSON/CSV de errores).
- Estado del job si fue asíncrono.

### 2.3 UX de feedback

- Toasts (Sonner) al iniciar cola / completar.
- No bloquear la UI del navegador 60s: usar **cola** para archivos grandes (ver sección 4).

---

## 3. PLANTILLAS CSV — ESPECIFICACIÓN DE COLUMNAS

**Convenciones generales (documentar en `LEEME_IMPORTACION.md` del ZIP y en pantalla):**

- Primera fila = nombres de columna **exactos** (en minúsculas con `snake_case` recomendado para coincidir con código).
- Encoding: **UTF-8**.
- Separador: coma `,`.
- Fechas: `YYYY-MM-DD`.
- Decimales: punto `.` (ej. `15000.50`).
- Identificación de empresa en filas hijas: usar **`company_nit`** (string, debe coincidir con una empresa ya importada **en el mismo lote secuencial** o preexistente en BD — ver orden en §5).

### 3.1 `companies.csv`

Columnas mínimas sugeridas (ajustar a migración real `companies`):

| Columna        | Obligatorio | Notas |
|----------------|-------------|--------|
| `name`         | Sí          | Razón social |
| `nit`          | Sí          | Único global; usado como clave para enlazar otros CSV |
| `address`      | No          | |
| `phone`        | No          | |
| `email`        | No          | Email de contacto empresa |
| `is_active`    | No          | `1`/`0` o `true`/`false`; default true |

### 3.2 `banks.csv`

| Columna        | Obligatorio | Notas |
|----------------|-------------|--------|
| `company_nit`  | Sí          | Empresa existente o creada en paso previo |
| `name`         | Sí          | Nombre del banco |
| `code`         | No          | Código interno |
| `is_active`    | No          | Default true |

### 3.3 `operations.csv`

| Columna        | Obligatorio | Notas |
|----------------|-------------|--------|
| `company_nit`  | Sí          | |
| `name`         | Sí          | |
| `description`  | No          | |
| `base_price`   | Sí          | decimal |
| `is_active`    | No          | Default true |

### 3.4 `references.csv`

| Columna        | Obligatorio | Notas |
|----------------|-------------|--------|
| `company_nit`  | Sí          | |
| `code`         | Sí          | Único por empresa |
| `name`         | Sí          | |
| `description`  | No          | |
| `is_active`    | No          | Default `true` para “referencias activas”; si viene `0`, crear inactiva |

**Nota:** Imagen de referencia **no** en CSV v1 (opcional URL `image_url` futura — fuera de alcance mínimo).

### 3.5 `employees_users.csv` (empleado + usuario + datos bancarios + rol)

Una fila = un empleado; si `create_user` = `1`, crear también `User` y vínculos según el diseño actual del proyecto.

| Columna                 | Obligatorio | Notas |
|-------------------------|-------------|--------|
| `company_nit`           | Sí          | |
| `first_name`            | Sí          | |
| `last_name`             | Sí          | |
| `document_type`         | No          | Default `CC` u otro según dominio |
| `document_number`       | Sí          | Único por empresa |
| `phone`                 | No          | |
| `address`               | No          | |
| `hire_date`             | No          | |
| `base_salary`           | No          | Según significado actual en BD |
| `payroll_mode`          | No          | `operations` o `fixed_daily`; default `operations` |
| `daily_salary`          | Condicional | Obligatorio si `fixed_daily` |
| `is_active`             | No          | Default true |
| `create_user`           | No          | `1`/`0` — si `1`, crear cuenta |
| `user_email`            | Condicional | Obligatorio si `create_user=1` |
| `user_password`         | Condicional | Si vacío, generar aleatorio y marcar `password_change_required=1` |
| `role_name`             | Condicional | Nombre del rol Spatie **existente** en BD (ej. `admin`, `Operario de Producción`); obligatorio si `create_user=1` |
| `bank_name`             | No          | Resolver `bank_id` por `name` + `company_nit`; si no existe, registrar error en fila |
| `bank_account_number`   | No          | |
| `bank_key`              | No          | Alfanumérico |
| `notes`                 | No          | |

**Reglas de validación empleado-usuario:**

- Si `create_user=1`: crear `User`, asignar `company_id`, `employee_id` bidireccional, `password_change_required` si password autogenerado, ejecutar `$user->assignRole($roleName)`; validar que el rol exista y sea **asignable** (política: solo roles de la empresa o roles globales definidos — documentar; si el rol es global por nombre, aceptar).
- Email único en `users`.
- Respetar validación grupal banco del prompt de datos bancarios previo (si rellena uno, los tres — alinear con Form Request existente).

### 3.6 Generación de plantillas en backend

- `GET /super-admin/data-imports/templates/{type}` con `type` ∈ `companies|banks|operations|references|employees_users|all`
- Respuesta: descarga archivo CSV con **solo la fila de encabezados** + **una fila de ejemplo** con valores ficticios claramente marcados como ejemplo (o sin fila ejemplo si preferís solo headers — en ese caso el README lo explica).
- Headers `Content-Disposition: attachment`.

---

## 4. ARQUITECTURA BACKEND IMPORTACIÓN

### 4.1 Config

- `config/data_import.php`:
  - `max_upload_kb`
  - `allowed_mimes`
  - `queue_connection` (default `database` o `sync` en dev)

### 4.2 Tabla de auditoría `data_import_batches` (nombre ajustable)

```text
id
user_id (fk users) — quien subió
original_filename (string)
stored_path (string)
type (enum string): companies | banks | operations | references | employees_users
status: pending | processing | completed | failed
rows_total, rows_success, rows_failed
error_report_path (nullable) — JSON o CSV de errores en storage
meta (json nullable) — timings, memoria, versión
started_at, finished_at
timestamps
```

### 4.3 Endpoints (web, Inertia-friendly)

- `GET  /super-admin/data-imports` → Index con historial + formularios
- `GET  /super-admin/data-imports/{batch}` → Show errores/resumen
- `GET  /super-admin/data-imports/templates/{type}` → download
- `POST /super-admin/data-imports` → upload `file` + `type` → crear batch + despachar job

### 4.4 Servicios (una clase por tipo o estrategia)

Patrón recomendado:

- Interfaz `ImportStrategyInterface` con `validateRow(array $row, int $line): void` y `importRow(array $row, DataImportContext $ctx): void`
- Contexto lleva mapas en memoria: `nit → company_id` cache durante el mismo archivo batch para acelerar resolución.

**Transacciones:**

- **Una transacción por fila** (recomendado para CSV grandes): si falla una fila, hacer rollback solo de esa fila y acumular error; continuar.
- Alternativa **todo o nada** por archivo: transacción global — menos flexible; **no** como default para este requerimiento.

### 4.5 Job en cola

- `ProcessDataImportJob` recibe `batch_id`:
  - Abrir CSV con `League\Csv` (recomendado; si no, `fgetcsv` nativo).
  - Iterar líneas; validar; importar.
  - Actualizar contadores en `data_import_batches`.
  - Al final, `status = completed` o `failed` si error irrecuperable (archivo ilegible).

### 4.6 Dependencias Composer

- Si no existe: `composer require league/csv` (parser robusto, BOM UTF-8).

### 4.7 Idempotencia / duplicados

Política clara **por tipo** (documentar en UI y en código):

| Tipo        | Si existe `nit` empresa / clave natural | Acción |
|-------------|------------------------------------------|--------|
| Companies   | `nit` duplicado                         | **Actualizar** campos no sensibles o **omitir** según flag en query `?mode=skip|update` — implementar switch en formulario import |
| Banks       | `(company_id, name)` duplicado           | Omitir fila + mensaje o update — elegir **omitir** por simplicidad |
| Operations  | `(company_id, name)`                     | Omitir o update — elegir una |
| References  | `(company_id, code)`                     | Omitir o update — elegir una |
| Employees   | `(company_id, document_number)`          | **Omitir** por defecto si ya existe; opción `update_existing=1` en formulario import para admin |

---

## 5. ORDEN DE IMPORTACIÓN OBLIGATORIO

En la UI, mostrar alerta numerada:

1. **Empresas** (`companies.csv`)
2. **Bancos** (`banks.csv`) — requiere `company_nit`
3. **Operaciones** — requiere `company_nit`
4. **Referencias** — requiere `company_nit`
5. **Empleados y usuarios** — requiere `company_nit` y referencias opcionales de rol/banco existentes

El backend **no** ordena automáticamente varios CSV en un solo POST salvo que se implemente “import wizard” multi-archivo — **fuera de alcance mínimo**. Un POST = un CSV de un tipo.

---

## 6. PERMISOS Y MENÚ

- Si el proyecto usa `PermissionHelper` con matriz JSON: añadir módulo `super_admin_imports` **no** editable por empresas normales; o no exponer en matriz y usar solo `hasRole('super_admin')`.
- **`EnsureSuperAdmin` middleware es suficiente** para el alcance mínimo.

---

## 7. PRUEBAS Y CHECKLIST

- [ ] Usuario `admin` de empresa recibe **403** en todas las rutas `/super-admin/data-imports*`.
- [ ] `super_admin` descarga cada plantilla con headers correctos.
- [ ] Importar `companies` + `banks` en orden crea FKs válidas.
- [ ] Importar empleado con `create_user=1` deja login funcional y rol asignado.
- [ ] CSV malformado (columna faltante) produce error por línea sin romper el batch entero (modo transacción por fila).
- [ ] Archivo > límite rechazado con mensaje claro.
- [ ] `php artisan migrate` y `npm run build` sin errores; colas: `php artisan queue:work` documentado en README del módulo.

---

## 8. ORDEN DE IMPLEMENTACIÓN SUGERIDO PARA OPUS

1. `config/data_import.php` + migración `data_import_batches`
2. Model `DataImportBatch` + policy solo super admin
3. Middleware `EnsureSuperAdmin`
4. `TemplateGeneratorService` (CSV headers + ejemplo)
5. Strategies: `CompanyImportStrategy`, `BankImportStrategy`, `OperationImportStrategy`, `ReferenceImportStrategy`, `EmployeeUserImportStrategy`
6. `DataImportController` + `ProcessDataImportJob`
7. Rutas agrupadas
8. Páginas React `SuperAdmin/DataImports/Index.tsx`, `Show.tsx`
9. Enlace en menú solo `super_admin`
10. Prueba manual con CSV de 5 líneas por tipo

---

## 9. INSTRUCCIÓN FINAL PARA CLAUDE OPUS

Implementa lo anterior **sin modificar** la lógica de negocio de producción, nómina, jornadas ni permisos por empresa, salvo donde sea imprescindible exponer un método público reutilizable (ej. crear empleado+usuario refactored en action/service).

**No** sustituyas los seeders existentes; este flujo es **adicional**.

Al finalizar, entrega lista de **archivos creados/modificados** y comandos:

```bash
composer require league/csv
php artisan migrate
php artisan queue:table   # si aún no existe
php artisan migrate
npm run build
```

---

*Documento: Módulo Super Admin — Plantillas e importación CSV (empresas, bancos, operaciones, referencias, empleados-usuarios) — Mayo 2026*
