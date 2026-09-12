# Prompt de implementación — Rediseño de "Mi perfil" (cuenta sin ficha de empleado)

> Pega este archivo completo como prompt en tu agente de código (Claude Code, Cursor, etc.) con el repo `ERP_CONFECCION` abierto.
> Complementa a `PROMPT-rediseno-perfil-empleados.md`: ese cubre el módulo completo de empleados; **este cubre solo la pantalla `/perfil` de una cuenta administrativa no vinculada a una ficha de empleado**.

---

## 0. Contexto

- Stack: **Laravel + Inertia.js + React + TypeScript**.
- Archivos afectados:
  - `resources/js/Pages/Profile/Edit.tsx` (pantalla a rediseñar)
  - `app/Http/Controllers/ProfileController.php`
  - `resources/js/Layouts/AppLayout.tsx` (**no modificar** — la pantalla vive dentro de este layout; no dibujar barra superior, marca ni navegación propias)
  - `routes/web.php`, `routes/auth.php`
- Sistema visual: **Nocturne** — fondo `#161826`, texto `#e9e9ed`, acento único `#9184d9`, Inter, radio 8px, densidad 0.7×, botones **outline** (no rellenos), iconos **Phosphor**. Solo tokens `var(--*)`; cero hex/px sueltos.

**Problema actual:** la pantalla es un formulario plano donde nombre, correo y contraseña conviven como inputs sueltos, sin jerarquía, sin estado de seguridad y con un botón "Guardar" siempre visible aunque no haya cambios.

---

## 1. Estructura nueva de la pantalla

Orden vertical, ancho máximo ~920px, dentro del layout existente:

1. **Encabezado** — H1 "Mi perfil", subtítulo "Cuenta administrativa. Aquí gestionas tu identidad y tu seguridad de acceso." y a la derecha un `.tag .tag-accent` con el rol del usuario.
2. **Aviso de vínculo** — tarjeta informativa: "Tu cuenta no está vinculada a una ficha de empleado." + explicación ("Por eso no verás producción, nómina ni anticipos") + botón **Vincular ficha**. Debe desaparecer si la cuenta ya está vinculada.
3. **Identidad** — foto (avatar circular 104px con carga por arrastrar/soltar y texto de ayuda en español: "Arrastra la foto o sube un archivo · JPG o PNG, máx. 2 MB") y rejilla de **2 columnas fijas** (1 columna bajo 620px): Nombre*, Apellido, Teléfono (con nota "Usado para avisos de nómina y alertas"), Cargo.
4. **Acceso y seguridad** — deja de ser inputs: tres **filas de estado** con icono, valor, etiqueta de estado y acción propia:
   - Correo de inicio de sesión → `tag-accent` "Verificado" + botón "Cambiar" (flujo con confirmación por correo).
   - Contraseña → antigüedad real ("Actualizada hace N meses") + `tag-outline` "Antigua" si supera 180 días + "Cambiar contraseña".
   - Verificación en dos pasos → estado real + "Activar" / "Desactivar".
5. **Actividad reciente** — últimas sesiones (dispositivo + navegador, ciudad aproximada por IP, fecha) con etiqueta "Esta sesión" / "Activa" / "Cerrada" y acción **Cerrar las demás sesiones**. Nota: "Si algo no fuiste tú, cambia tu contraseña de inmediato."
6. **Preferencias de notificación** — checkboxes: cierre de nómina, solicitudes pendientes de aprobación, resumen semanal de producción por correo.

---

## 2. Comportamiento requerido

- **Estado sucio (dirty)**: el botón Guardar **no** está siempre visible. Al modificar cualquier campo de Identidad/Preferencias aparece una **barra pegada al fondo** (sticky, fondo translúcido con blur y borde superior) con el texto "Tienes cambios sin guardar", **Descartar** y **Guardar cambios**; la tarjeta de Identidad muestra un `tag-outline` "Sin guardar".
- **Descartar** restaura los valores originales sin recargar.
- Al guardar: toast breve "Perfil actualizado" (2–3 s) y limpieza del estado sucio.
- **Aviso al salir** con cambios pendientes (`beforeunload` + interceptor de navegación de Inertia).
- Validación **inline** por campo (nombre obligatorio, teléfono con formato, imagen ≤ 2 MB y JPG/PNG), mensaje debajo del input, no un banner global.
- Cambio de correo y cambio de contraseña van en **modales** (`.dialog-backdrop` + `.dialog`) con reautenticación por contraseña actual.
- Activar 2FA: modal con QR, código de verificación y códigos de respaldo descargables una sola vez.
- "Cerrar las demás sesiones" pide confirmación y revoca el resto de tokens/sesiones.
- La pantalla **no** renderiza navegación propia: el shell (marca, menú, sidebar) lo provee `AppLayout.tsx`.

---

## 3. Backend

- `ProfileController@edit` devuelve: `{ user: {name, lastName, email, phone, jobTitle, photoUrl, role}, security: {emailVerifiedAt, passwordChangedAt, twoFactorEnabled}, sessions: [...], preferences: {...}, employeeLinked: bool }`.
- `ProfileController@update` — solo identidad y preferencias (nunca rol, correo ni contraseña).
- `ProfileEmailController@update` — cambio de correo con reautenticación + reverificación.
- `PasswordController@update` — cambio de contraseña; actualiza `password_changed_at`.
- `TwoFactorController@enable|confirm|disable` + `recovery-codes`.
- `SessionController@destroyOthers` — revoca las demás sesiones.
- `ProfilePhotoController@update|destroy` — almacenamiento, validación de tipo/tamaño y recorte cuadrado.
- Migración: añadir a `users` → `last_name`, `phone`, `job_title`, `photo_path`, `password_changed_at`, `notification_preferences` (json).
- Registrar en auditoría: cambio de correo, cambio de contraseña, activación/desactivación de 2FA, cierre masivo de sesiones.

### Rutas

```
GET    /perfil
PATCH  /perfil
PATCH  /perfil/correo
PUT    /perfil/contrasena
POST   /perfil/foto
DELETE /perfil/foto
POST   /perfil/2fa            POST /perfil/2fa/confirmar     DELETE /perfil/2fa
DELETE /perfil/sesiones
POST   /perfil/vincular-ficha
```

---

## 4. Reglas de UI (Nocturne)

- Componentes del sistema: `.card` (+ `.card-title`, `.elev-sm/lg`), `.btn` (`.btn-primary` outline, `.btn-secondary`, `.btn-ghost`), `.tag` (`.tag-accent`, `.tag-outline`, `.tag-neutral`), `.field` + `.input`, `.radio` + `.dot`, `.hr`, `.dialog-*`.
- Iconos Phosphor: `ph-envelope-simple`, `ph-key`, `ph-device-mobile`, `ph-desktop`, `ph-shield-check`, `ph-link`, `ph-upload-simple`, `ph-sign-out`, `ph-check-circle`. Sin emojis.
- Todo texto de interfaz en **español** (incluidos placeholders de componentes de terceros).
- Estados siempre con **texto**, no solo color.
- `:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }` en todo elemento interactivo; nunca el anillo azul por defecto.
- Sin rellenos grandes de acento: el acento es borde, línea y marca.
- Contraste mínimo 4.5:1 en texto; las notas auxiliares no bajan de ~62% de opacidad del texto base.

---

## 5. Criterios de aceptación

1. La pantalla no dibuja cabecera, marca ni navegación propias; encaja dentro de `AppLayout`.
2. Correo, contraseña y 2FA se presentan como filas con estado y acción, no como campos de texto editables en línea.
3. El botón Guardar aparece **solo** cuando hay cambios; Descartar los revierte; salir con cambios pendientes avisa.
4. La antigüedad de la contraseña y el estado de 2FA provienen de datos reales, no de texto fijo.
5. Las sesiones listadas son reales y "Cerrar las demás sesiones" invalida efectivamente el resto.
6. Cambio de correo y de contraseña exigen reautenticación; el correo nuevo queda no verificado hasta confirmarse.
7. El aviso de "cuenta no vinculada" solo aparece cuando `employeeLinked === false`, y "Vincular ficha" lleva a un flujo real de vinculación.
8. Toda la interfaz está en español, usa solo tokens de Nocturne y es navegable por teclado.
9. Funciona a 360px de ancho: la rejilla colapsa a una columna y la barra inferior no tapa contenido.
10. Las preferencias de notificación persisten y afectan los correos/avisos que realmente se envían.

---

## 6. Orden sugerido

1. Migración de campos en `users` + payload de `ProfileController@edit`.
2. Rediseño de la pantalla en modo lectura con las cuatro tarjetas.
3. Estado sucio + barra pegada + descartar + aviso al salir.
4. Modales de correo y contraseña con reautenticación.
5. Foto de perfil.
6. 2FA y sesiones.
7. Preferencias de notificación conectadas al envío real.
8. Pasada de accesibilidad, contraste y responsive.

---

## 7. Fuera de alcance

- Ficha de empleado y módulo de empleados (ver `PROMPT-rediseno-perfil-empleados.md`).
- Cambios en el layout general, menú o landing.
- SSO / inicio de sesión con proveedores externos.
