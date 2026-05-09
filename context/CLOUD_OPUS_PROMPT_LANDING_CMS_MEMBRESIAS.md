# Instrucciones Cloud Opus (descargable)
## Landing en `/` + CMS Super Admin + membresías por empresa (usuarios staff, no empleados)

---

> **Archivo:** `CLOUD_OPUS_PROMPT_LANDING_CMS_MEMBRESIAS.md`  
> **Uso:** Copiar y pegar **todo** el contenido en Claude Opus. El proyecto Laravel + Inertia + React ya existe. Implementar **sin** romper módulos actuales salvo el enrutamiento de la raíz indicado.

---

# PROMPT COMPLETO — Landing pública (ruta principal) + CMS Super Admin + Membresías por empresa
## Para Claude Opus — Proyecto MiTallerPro / Taller de confección

---

## 0. VISIÓN Y REFERENCIA DE DISEÑO (ADMIN CMS)

Referencia de **layout y flujo** (mockup tipo “Admin Portal / Landing Page Editor”):

- **Sidebar izquierdo** oscuro: **Landing Editor** (activo), enlaces a otros módulos super admin, al pie **Publicar cambios**, ayuda, cerrar sesión.
- **Cabecera del área de trabajo:** título “Landing Page Editor”, subtítulo, botón **Preview Live** (abre `/` en nueva pestaña).
- **Columna izquierda:** tarjetas **Hero**, **Features Grid**, **Partners & Clients**, **About**; badges **LIVE** (verde) / **DRAFT** (ámbar); sección seleccionada con borde; **+ Add New Custom Section** (borde discontinuo).
- **Columna derecha:** formulario por sección, “Last saved…”, **Save Changes**, textos, CTAs, **upload imagen/fondo** (drag-drop, Replace Media, tip de diseño), **Reset to Default**, **Discard Draft**, **Apply to Live**.

**Obligatorio:** Misma **estructura UX**, pero **estilos actuales del proyecto** (`tailwind.config`, colores primary, componentes `Button`, `Card`, `Input`, modo oscuro si el admin lo usa). Marca: **MiTallerPro** (`config('app.name')`), no copiar nombres de terceros del mockup.

---

## 1. ENRUTAMIENTO

- **`GET /`** → landing pública Inertia (`Landing/Public.tsx`), **sin** auth.
- **Invitado:** siempre ve `/`.
- **`super_admin` autenticado:** ver landing con enlace “Ir al panel” **o** ir a `/super-admin/...` — documentar decisión; recomendado mostrar landing + barra mínima.
- **Usuario empresa (admin, etc.):** **`GET /` → redirect `/dashboard`** (o dashboard actual).

Opcional: `GET /privacy`, `GET /terms` desde contenido CMS/footer.

---

## 2. MODELO DE DATOS (CMS)

### 2.1 `landing_sections`

```text
id, slug (unique), title_internal, sort_order, status (draft|live),
is_system (bool), published_at nullable, timestamps
draft_payload (json), live_payload (json)
```

Al **Apply to Live:** copiar `draft_payload` → `live_payload`, `status=live`, `published_at=now()`.

### 2.2 Estructura `payload` (ejemplos)

- **hero:** headline, subtext, primary_cta_text/url, secondary_cta_text/url, background_image_path, background_image_alt.
- **features:** items `[{ icon, title, description }]`.
- **partners:** items `[{ name, logo_path, url, sort }]`.
- **about:** title, body, image_path.
- **custom:** title, body_markdown (sanitizar).

### 2.3 `landing_globals` (key-value o columnas tipadas)

Incluir explícitamente campos para **logos e imagen social**:

- `site_name`, `meta_title`, `meta_description`, `og_image_path`
- **`header_logo_path`** — logo cabecera landing (navbar)
- **`favicon_path`** — favicon URL/path para `<link rel="icon">` en vista pública
- Enlaces footer (privacy, terms, contact, etc.), texto legal corto

El **super admin** edita estos valores en una subsección del editor (“Ajustes globales / SEO / marca”) o pantalla dedicada enlazada desde el mismo módulo Landing.

### 2.4 `LandingSeeder` — copy y bullets de producto (obligatorio en seed)

Rellenar **live_payload** y **draft_payload** igual al inicio, con textos en **español** para **MiTallerPro**.

**Hero (ejemplo de intención; Opus puede pulir redacción):**

- Proposition: software multiempresa para talleres de confección: producción, nómina, personas y control operativo en un solo lugar.

**Features Grid — incluir al menos estas capacidades (una tarjeta cada una, icono Heroicon coherente):**

1. Multiempresa y aislamiento de datos por empresa.
2. Producción por empleado: referencias, operaciones, cantidades y seguimiento.
3. Referencias y operaciones de confección; comparativo costo vs precio de pago unitario (si el módulo existe).
4. Nómina: **por operaciones** y **por salario diario / jornada** (inicio–fin de día) con validación administrativa.
5. Anticipos, deducciones y liquidaciones de pago; historial de producción y pagos.
6. Empleados y **empleado-usuario** vinculado; datos bancarios (banco, cuenta, llave).
7. **Roles y permisos por empresa**; **excepciones por usuario** sin alterar el rol compartido.
8. Reportes y tableros (producción, nómina, etc.).
9. Carga masiva CSV (**super admin**): empresas, bancos, operaciones, referencias, empleados-usuarios.
10. Integración de **almacenamiento de archivos** (p. ej. Firebase Storage) para imágenes y documentos.
11. **Planes de membresía** por empresa y límite de usuarios **staff** (no empleados operativos).

**Partners:** 3–6 entradas placeholder (nombre + logo genérico o `public/` placeholder) editables luego desde CMS.

**About:** párrafos que resuman propósito, público objetivo (talleres, confección) y valor.

**Logos en seed:** usar `public/images/landing/...` que existan en repo **o** placeholders documentados hasta que el super admin suba archivos reales.

---

## 3. BACKEND LARAVEL

### 3.1 Público

- `LandingController@show` → solo `live_payload` de cada sección + `landing_globals`.

### 3.2 Super admin — prefijo `/super-admin/landing`

Middleware: **solo `super_admin`**.

| Método | Ruta | Acción |
|--------|------|--------|
| GET | `/super-admin/landing` | Editor principal |
| GET | `/super-admin/landing/sections/{section}` | Cargar borrador |
| PUT | `/super-admin/landing/sections/{section}` | Save Changes |
| POST | `/super-admin/landing/sections/{section}/publish` | Apply to Live |
| POST | `/super-admin/landing/sections/{section}/discard` | Descartar borrador |
| POST | `/super-admin/landing/sections/{section}/reset` | Reset seed |
| POST | `/super-admin/landing/sections` | Sección custom |
| DELETE | `/super-admin/landing/sections/{section}` | Solo no system |
| POST | `/super-admin/landing/publish-all` | Publicar cambios (sidebar) |
| POST | `/super-admin/landing/media` | Subida unificada storage |
| GET/PUT | `/super-admin/landing/globals` |Opcional: SEO, logos, favicon |

Policies + Form Requests con límites de tamaño y MIME.

---

## 4. FRONTEND — `Landing/Public.tsx`

- Navbar: **`header_logo_path`** de globals, anclas `#features` `#partners` `#about`, **Iniciar sesión** → `/login`, CTA secundario desde CMS.
- Secciones según `live_payload`; **SEO** con `<Head />` desde globals.
- Tema: puede ser **landing clara** aunque el app interno sea oscuro; definir tokens (ej. `bg-slate-50` + primary) **sin romper** el build.

---

## 5. FRONTEND — `SuperAdmin/Landing/Editor.tsx`

- Layout de dos columnas como la referencia; componentes `LandingSectionList` + `LandingSectionForm`.
- Preview Live → `window.open('/', '_blank')`.
- Toasts (Sonner).

---

## 6. MEMBRESÍAS (SUPER ADMIN — MÓDULO EMPRESAS)

### 6.1 Regla de negocio

- Cada **empresa** tiene **`membership_plan_id`** y fechas opcionales.
- Límite **`max_staff_users`:** contar usuarios **staff** de la empresa (**excluir empleados**): p. ej. `employee_id IS NULL` o campo `user_kind = staff`. Documentar en código.
- Al crear usuario staff: si `count >= límite` → **403** mensaje claro.
- Límite **`max_employees`** opcional en plan; validar en alta de empleado si se implementa.

### 6.2 Tabla `membership_plans`

`name`, `slug`, `max_staff_users` (nullable = ilimitado), `max_employees` (nullable), `features_json` (opcional), `price_monthly` (opcional), `is_active`, `sort_order`, timestamps.

### 6.3 UI

- CRUD `/super-admin/membership-plans`.
- En **Empresa** (show/edit): selector de plan, **“Usuarios staff: X / Y”**, enlace a listado de usuarios de esa empresa.

---

## 7. CHECKLIST

- [ ] `/` landing sin login con datos del seed y logos/favicon configurables.
- [ ] Usuario empresa logueado: `/` → dashboard.
- [ ] Editor super admin: draft/live, multimedia, globals, publish all.
- [ ] Límite staff por plan aplicado.
- [ ] `php artisan migrate`, `db:seed`, `npm run build` OK.

---

## 8. ORDEN DE IMPLEMENTACIÓN

1. Migraciones CMS + `membership_plans` + FK empresa.  
2. Seed landing + planes.  
3. Controller público + `Landing/Public`.  
4. Controllers super admin + media.  
5. Editor React.  
6. UI membresías empresas + validación usuarios staff.  
7. Rutas `/` y redirects.

---

## 9. INSTRUCCIÓN FINAL

Implementación **completa**, sin `TODO`. Incluir archivos estáticos mínimos en `public/images/landing/` si hace falta para que el seed no quede roto.

```bash
php artisan migrate
php artisan db:seed --class=LandingSeeder
npm run build
```

---

*Versión descargable unificada — Landing + CMS + Membresías — Mayo 2026*
