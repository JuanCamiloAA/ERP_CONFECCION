# AJUSTE — Almacenamiento de imágenes y archivos en Firebase Storage
## Prompt para Claude Opus — Implementación incremental sin romper lo ya desarrollado

---

> **USO:** El proyecto (Laravel 12 + Inertia + React, multiempresa, cargas existentes vía `storage/app/public`, `Storage::disk('local')`, symlink, etc.) **ya funciona**. Pega este documento completo en Claude Opus. Objetivo: **vincular Firebase** (Google) para que **todas las imágenes y archivos** que se suban a la aplicación se **persistan en Firebase Storage**, guardando en base de datos **la URL pública o el path de objeto** retornado por Firebase. **No** eliminar lógica de negocio de módulos; **parametrizar** el backend para poder desplegar con o sin Firebase durante la transición si hace falta.

---

## 0. ALCANCE Y PRINCIPIOS

1. **Producto objetivo:** [Firebase Storage](https://firebase.google.com/docs/storage) como **único destino** de nuevos uploads de la app (fotos de empleado, logo de empresa, imagen de referencia, adjuntos futuros, etc.).
2. **Compatibilidad:** Los registros que **ya** tengan URL/path apuntando a `/storage/...` local deben **seguir sirviendo** hasta una migración opcional (script fuera de alcance mínimo). Las **nuevas** cargas usan Firebase.
3. **Multiempresa:** Path de objeto obligatoriamente namespaced: `companies/{company_id}/...` para evitar colisiones y facilitar reglas.
4. **Seguridad:** No commitear claves privadas. Todo vía `.env` y secretos en servidor.
5. **Un solo punto de subida en Laravel:** encapsular en un servicio reutilizable; evitar llamadas directas dispersas al SDK en controladores.

---

## 1. CONFIGURACIÓN EN GOOGLE FIREBASE CONSOLE

Documentar en `README` o comentario de deploy (para el desarrollador, no en repo):

1. Crear proyecto en [Firebase Console](https://console.firebase.google.com/).
2. Habilitar **Storage** (ubicación geográfica acorde al negocio).
3. **Cuenta de servicio (recomendada para Laravel):**
   - Proyecto → Configuración → Cuentas de servicio → Generar nueva clave JSON.
   - El JSON **no** se sube al git: contenido en variable de entorno `FIREBASE_CREDENTIALS` como **string JSON escapado** **o** ruta `GOOGLE_APPLICATION_CREDENTIALS` a archivo fuera del repo en servidor.
4. Copiar **nombre del bucket** (ej. `proyecto.appspot.com`) → `FIREBASE_STORAGE_BUCKET`.
5. Opcional: **App Web** si se implementa upload directo desde el navegador en una fase 2 (este prompt prioriza **upload vía servidor**).

---

## 2. VARIABLES DE ENTORNO (.env)

Añadir (nombres ejemplo, unificar en el código):

```env
# Firebase / Google Cloud Storage (bucket de Firebase)
FIREBASE_PROJECT_ID=tu-proyecto-id
FIREBASE_STORAGE_BUCKET=tu-proyecto.appspot.com

# Opción A: ruta absoluta al JSON de cuenta de servicio (desarrollo local)
GOOGLE_APPLICATION_CREDENTIALS=/ruta/segura/firebase-service-account.json

# Opción B (producción): JSON en una sola línea o base64 — el servicio Laravel debe soportar la que elijan
# FIREBASE_CREDENTIALS_JSON={...}

# Conmutador para rollback / transición
FILESYSTEM_DEFAULT_UPLOAD_DRIVER=firebase
# Valores: firebase | local  (si local, comportamiento anterior)
```

---

## 3. BACKEND LARAVEL — DEPENDENCIAS

### 3.1 Paquete recomendado

Evaluar **una** de estas opciones (elegir la que mejor encaje con PHP 8.3 y mantenimiento):

- **`kreait/laravel-firebase`** ([documentación](https://firebase-php.readthedocs.io)) — Admin SDK, Storage incluido.
- O **`google/cloud-storage`** directamente contra el bucket de Firebase (compatible con credenciales de servicio).

**Instrucción para Opus:** Añadir al `composer.json` la dependencia elegida, registrar provider si aplica, publicar config si el paquete lo trae.

### 3.2 Archivo de configuración

Crear `config/firebase.php` (o extender existente) con:

- `project_id`, `storage_bucket`, credenciales (array desde env), `default_storage_path_prefix` opcional.

### 3.3 Servicio único `FirebaseStorageService`

Ubicación sugerida: `app/Services/Files/FirebaseStorageService.php`

**Responsabilidades:**

- `upload(UploadedFile $file, string $directory, ?string $filename = null): array`
  - Retorna al menos: `['path' => objectPath, 'url' => publicUrl, 'mime' => ..., 'size' => ...]`
- `uploadFromPath(string $absolutePath, string $remotePath): array` — para migraciones o imágenes generadas.
- `delete(string $objectPath): bool` — al reemplazar avatar/logo/borrar registro.
- `publicUrl(string $objectPath): string` — usando el formato oficial del bucket (URL pública si las reglas lo permiten, o URL firmada si el bucket es privado).

**Convención de paths remotos:**

```
companies/{company_id}/employees/{employee_id}/{uuid}.{ext}
companies/{company_id}/references/{reference_id}/{uuid}.{ext}
companies/{company_id}/companies/logo/{uuid}.{ext}
companies/{company_id}/misc/{uuid}.{ext}
```

Normalizar nombres: sanitizar extensión, nunca usar nombre original solo.

**Tipo MIME:** validar contra lista blanca existente del proyecto (`image/jpeg`, `image/png`, `image/webp`, `application/pdf`, etc.) — **reutilizar** reglas de Form Requests actuales.

**Errores:** lanzar excepciones de dominio traducibles; loguear `Log::error` con contexto sin adjuntar binarios.

### 3.4 Fachada / contrato para conmutar driver

Crear interfaz `App\Contracts\ObjectStorageInterface` con métodos `upload`, `delete`, `url` y dos implementaciones:

- `LocalPublicObjectStorage` — delega en `Storage::disk('public')` como hoy.
- `FirebaseObjectStorage` — usa `FirebaseStorageService`.

Registrar binding en `AppServiceProvider` según `config('filesystems.default_upload')` o env.

**Todos** los controladores que hoy hagan `$request->file(...)->store(...)` deben migrar a inyectar `ObjectStorageInterface` (o un `FileUploadMediator`) **sin duplicar lógica**.

---

## 4. CAMBIOS POR MÓDULO (BUSCAR Y SUSTITUIR DE FORMA SEGURA)

**Instrucción para Opus:** Hacer `grep` / búsqueda de:

- `store('public'`, `storePublic`, `Storage::disk`, `->store(`, `move`, `$request->file`.

Sustituir por el servicio unificado. Módulos típicos según prompts anteriores:

| Área            | Campo / uso              | Notas |
|-----------------|--------------------------|--------|
| Empleados       | `photo`                  | Borrar objeto anterior al actualizar |
| Empresas        | `logo`                   | Ídem |
| Referencias     | `image`                  | Ídem |
| Usuarios        | `avatar`                 | Ídem |
| Cualquier adjunto futuro | —               | Mismo patrón |

**Base de datos:** Los campos existentes (`photo`, `image`, `logo`, …) deben almacenar **URL completa** o **path de objeto** de forma **consistente**:

- **Recomendado:** guardar `url` pública o firmada **o** `path` relativo al bucket con prefijo `firebase:` para distinguir de URLs locales antiguas — documentar en modelo con accessor `getImageUrlAttribute()` que:

  - Si empieza por `http` → devolver tal cual.
  - Si empieza por `firebase:` → generar URL vía servicio.
  - Si es path relativo antiguo `storage/...` → `Storage::url`.

Así **no** se rompen filas legacy.

---

## 5. REGLAS DE SEGURIDAD EN FIREBASE STORAGE

Proveer en el prompt reglas **de partida** (el equipo las endurecerá):

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Upload solo por backend con credenciales de admin: las reglas pueden denegar escritura cliente.
    match /companies/{companyId}/{allPaths=**} {
      allow read: if true;   // O restringir por auth Firebase si en el futuro hay upload cliente
      allow write: if false; // Solo servidor con Admin SDK
    }
  }
}
```

**Nota:** Con subida **solo desde Laravel** usando Admin SDK, las reglas pueden mantener `write: false` para clientes anónimos; el servidor no está limitado por estas reglas de la misma forma. Ajustar según documentación actual de Firebase si usan tokens cliente.

---

## 6. FRONTEND (INERTIA / REACT)

- **Sin cambio obligatorio** si los formularios ya envían `multipart/form-data` al backend: Laravel recibe el archivo y sube a Firebase.
- Si hay **preview** local con `URL.createObjectURL`, mantenerlo.
- Las respuestas Inertia que devuelvan el modelo deben incluir la **URL resuelta** para `<img src>` mediante el accessor del modelo o prop `image_url` computada en Resource/API.
- **No** exponer credenciales Firebase en el bundle del frontend en la opción “solo servidor”.

---

## 7. ELIMINACIÓN Y REEMPLAZO DE ARCHIVOS

- Al actualizar imagen: llamar `delete` en el storage activo **solo si** el valor anterior era de Firebase (detectar por prefijo o columna `storage_disk` opcional futura).
- Al hacer soft delete del dueño (empleado, etc.): **política** — eliminar objeto en Firebase en `forceDelete` o job diferido; documentar (alcance mínimo: eliminar al reemplazar archivo y al `forceDelete`).

---

## 8. PRUEBAS Y CHECKLIST

- [ ] `.env` con bucket y credenciales: subida crea objeto visible en consola Firebase.
- [ ] Crear/editar empleado con foto: URL accesible desde el navegador (o descarga con URL firmada según configuración).
- [ ] Referencias y logo empresa igual.
- [ ] `FILESYSTEM_DEFAULT_UPLOAD_DRIVER=local` restaura comportamiento anterior (sin romper).
- [ ] Registro antiguo con imagen local sigue mostrándose.
- [ ] `php artisan config:cache` en producción documentado.
- [ ] `composer install` y `npm run build` sin errores.

---

## 9. ORDEN DE IMPLEMENTACIÓN RECOMENDADO

1. Variables `.env.example` + `config/firebase.php`.
2. Instalar SDK + `FirebaseStorageService` + interfaz + binding.
3. Implementar accessor `url` en modelos con archivos.
4. Migrar un controlador piloto (ej. `EmployeeController`); probar E2E.
5. Migrar resto de uploads.
6. Documentar despliegue y rotación de credenciales.

---

## 10. INSTRUCCIÓN FINAL PARA CLAUDE OPUS

Implementa de forma **incremental**. No elimines el disco `public` ni rutas symlink salvo que el proyecto ya no las use para otros fines. Si un paquete falla en Windows local, documenta uso de WSL o credenciales por archivo.

Al terminar, entrega:

- Lista de **archivos creados/modificados**
- Fragmento de **`.env.example`** añadido
- Comandos: `composer require ...`, `php artisan config:clear`, `npm run build`

---

*Documento: Integración Firebase Storage para uploads — Mayo 2026*
