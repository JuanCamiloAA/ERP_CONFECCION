# Prompt de implementación — Fondo del acceso: «Urdimbre y trama» (6c)

Prompt individual y autocontenido. Cambia **solo la presentación** de la pantalla de acceso: el fondo del panel izquierdo, la posición del titular, el pie de derechos y el ancho del formulario. No toca autenticación, rutas ni validaciones.

Repo: `ERP_CONFECCION` — Laravel 11 + Inertia + React 19 + TypeScript + Tailwind v4.
Archivos: `resources/js/Layouts/AuthLayout.tsx` y `resources/js/Pages/Auth/Login.tsx`.
Referencia visual: pantalla **6c** del documento de diseño.

---

## 1. Qué está mal hoy

En la implementación actual (ver capturas del proyecto):

1. El panel izquierdo es una superficie negra casi vacía; el fondo no comunica nada.
2. El titular queda pegado al borde inferior izquierdo, aislado del resto.
3. El pie `© 2026 Taller Confección` cuelga suelto bajo el formulario, en la columna derecha.
4. El formulario se estira a todo el ancho de su columna: campos de ~730px, ilegibles y raros de recorrer.

Este prompt corrige esas cuatro cosas.

---

## 2. Tokens

Define estos valores **una sola vez** (por ejemplo en `resources/css/public.css`, importado solo por el layout de autenticación y la landing) y consúmelos con `var(--*)`. No repartas hex por los componentes.

```css
:root {
  --auth-bg: #161826;
  --auth-surface: #232532;
  --auth-text: #e9e9ed;
  --auth-accent: #9184d9;
  --auth-accent-300: #d2cefd;
  --auth-neutral-300: #cfd3e5;
  --auth-neutral-400: #b2b6ca;
  --auth-neutral-500: #9397ab;
  --auth-neutral-600: #75798c;
  --auth-divider: color-mix(in srgb, #e9e9ed 16%, transparent);
  --auth-radius-sm: 4px;
  --auth-radius-md: 8px;
}
```

Inter en peso **500** para títulos (no más), 400 para cuerpo. Foco visible siempre temático: `outline: 2px solid var(--auth-accent); outline-offset: 2px`. Nunca el anillo azul por defecto.

Íconos: Phosphor (`ph-needle`, `ph-envelope-simple`, `ph-lock-simple`, `ph-eye`, `ph-arrow-right`).

---

## 3. El fondo «Urdimbre y trama»

Cuatro capas absolutas dentro del panel izquierdo, todas con `pointer-events-none`, en un contenedor con `relative overflow-hidden`. El orden importa.

```jsx
{/* 1. Baño de acento en diagonal */}
<div className="pointer-events-none absolute inset-0"
     style={{ background: 'linear-gradient(155deg, rgba(145,132,217,.16), transparent 46%, rgba(145,132,217,.10))' }} />

{/* 2. Urdimbre — líneas verticales finas cada 7px, neutras */}
<div className="pointer-events-none absolute inset-0"
     style={{
       backgroundImage: 'repeating-linear-gradient(90deg, rgba(233,233,237,.13) 0 1px, transparent 1px 7px)',
       maskImage: 'linear-gradient(200deg, transparent 18%, #000 96%)',
       WebkitMaskImage: 'linear-gradient(200deg, transparent 18%, #000 96%)',
     }} />

{/* 3. Trama — líneas horizontales cada 11px, en el acento */}
<div className="pointer-events-none absolute inset-0"
     style={{
       backgroundImage: 'repeating-linear-gradient(0deg, rgba(145,132,217,.20) 0 1px, transparent 1px 11px)',
       maskImage: 'linear-gradient(200deg, transparent 30%, #000 100%)',
       WebkitMaskImage: 'linear-gradient(200deg, transparent 30%, #000 100%)',
     }} />

{/* 4. Resplandor en la esquina inferior izquierda */}
<div className="pointer-events-none absolute -left-[140px] -bottom-[220px] h-[600px] w-[600px] rounded-full"
     style={{ background: 'radial-gradient(circle, rgba(145,132,217,.22), transparent 66%)' }} />
```

Notas que importan:

- Las dos tramas tienen **frecuencias distintas** (7px y 11px) a propósito: cruzadas dan la textura de tejido visto de cerca. No las igualés ni las hagás múltiplos.
- Las máscaras van en el **mismo ángulo** (200deg) con umbrales distintos (18% y 30%): así el tejido se tupe hacia la esquina inferior izquierda y desaparece arriba a la derecha.
- Incluí siempre el par `maskImage` + `WebkitMaskImage`.
- Nada de esto es una imagen: cero peso adicional, nada que cargar.
- El contenido del panel va en elementos con `relative` para quedar sobre las capas.
- El cuadro de la marca lleva `background: var(--auth-bg)` para que la trama no se lea por detrás del logo.

### Sustituir por fotografía más adelante

Cuando exista una foto de taller sobre fondo oscuro, este fondo es el que la recibe: reemplazá las capas 2 y 3 por la imagen envuelta en `mix-blend-mode: lighten` (`object-cover`, `absolute inset-0`), y **conservá** las capas 1 y 4. El resto de la pantalla no cambia.

---

## 4. Estructura del layout (escritorio, ≥1024px)

`AuthLayout.tsx`: dos columnas a pantalla completa sobre `var(--auth-bg)`, `grid-cols-[1.12fr_1fr]`, con `border-r` de `var(--auth-divider)` entre ellas. Quitá el degradado indigo→blanco→slate actual.

**Panel izquierdo** (`relative overflow-hidden p-9 flex flex-col`), tres zonas:

1. Arriba: marca — cuadro de 34px con `border: 1px solid var(--auth-accent)`, `--auth-radius-sm`, fondo `var(--auth-bg)`, ícono `ph-needle` de 18px en el acento; al lado, el nombre de la empresa en 16px peso 500. **El nombre viene del servidor** (empresa del tenant o nombre del producto); si no hay, mostrá solo el producto.
2. **Centro vertical** (`mt-auto mb-auto`) — aquí se corrige el defecto 2: marca corta de acento (`h-[2px] w-9 bg-[var(--auth-accent)]`), titular de 34px / `leading-[1.12]` / `max-w-[19ch]` (`El turno de hoy ya está contando.`) y línea de apoyo de 15px en `--auth-neutral-300`, `max-w-[34ch]` (`Entra para registrar producción, revisar jornadas y cerrar la quincena.`).
3. Abajo: el **pie de derechos** en 12px `--auth-neutral-500`. Se mueve aquí desde la columna derecha (defecto 3).

**Panel derecho** (`p-9 px-8 flex flex-col justify-center`): el formulario centrado en su columna con **`w-full max-w-[420px] mx-auto`** (defecto 4).

Contenido, en orden y con `gap-4`:

- `Iniciar sesión` (22px peso 500) + `Ingresa tus credenciales para acceder al sistema.` (13px `--auth-neutral-500`).
- Segmentado `Correo / Documento` (`align-self:flex-start`, opciones de 8px 13px). Solo si el backend ya acepta ambas credenciales; si no, quitalo antes que fingir comportamiento.
- Campo de correo/documento: 44px de alto, fondo `--auth-surface`, borde `--auth-divider`, radio `--auth-radius-md`, ícono `ph-envelope-simple` a la izquierda. En foco, borde `--auth-accent`.
- Campo de contraseña: igual, con `ph-lock-simple` y a la derecha un botón de 36px con `ph-eye` para mostrarla (`aria-label` obligatorio).
- Fila: `Recordarme` (casilla con radio `--auth-radius-sm`) a la izquierda, enlace `¿Olvidaste tu clave?` de 13px a la derecha.
- Botón `Entrar`: **delineado** (borde del acento sobre transparente), 46px, ancho completo, con `ph-arrow-right`. Nunca relleno sólido.
- Nota final de 13px `--auth-neutral-600`: `¿Problemas para entrar? Habla con el administrador de tu taller.`
- Enlace `Volver al sitio público` de 13px.

Errores de validación: bajo cada campo, 12px, en un rojo del sistema; el borde del campo pasa a ese rojo. Los mensajes que devuelve Inertia hoy siguen igual.

---

## 5. Móvil (<1024px)

Una sola columna. El fondo **no** desaparece: se convierte en la franja superior.

- **Franja superior** (`shrink-0 relative overflow-hidden px-5 pt-6 pb-6`, `border-b` del divisor): las mismas cuatro capas, con estos ajustes — degradado a `165deg`, urdimbre igual (7px), trama igual (11px), máscaras a `linear-gradient(200deg, transparent 20%/34%, #000 98%/100%)`, y el resplandor a 440×440 en `-left-[110px] -bottom-[190px]`.
  Dentro: marca (cuadro de 32px), marca corta de acento, titular de **27px** `leading-[1.14]` y la línea de apoyo de 14px.
- **Cuerpo** (`flex-1 min-h-0 px-5 py-5.5`): el formulario, con campos de **52px**, segmentado a ancho completo (opciones de 12px de padding, `flex-1`, centradas), el botón de mostrar contraseña de **44px**, y al fondo del cuerpo (`mt-auto`) la nota de ayuda y `Volver al sitio público`.
- **Barra inferior fija** (`shrink-0 px-5 pt-3.5 pb-6`, `border-t` del divisor): el botón `Entrar` de **52px** a ancho completo. Nada bajo 44px en toda la pantalla.

---

## 6. Criterios de aceptación

- El panel izquierdo tiene textura visible en su mitad inferior izquierda y se apaga hacia arriba a la derecha; el titular está en el centro vertical, no pegado al borde.
- El pie de derechos aparece **una sola vez**, en el panel izquierdo.
- En escritorio los campos no superan 420px de ancho.
- A 390px no hay scroll horizontal, el fondo ocupa la franja superior y `Entrar` queda fijo abajo con 52px.
- El botón `Entrar` es delineado; no hay ninguna superficie saturada rellena en la pantalla.
- Ninguna imagen nueva se carga: el fondo es solo `background-image` con máscara.
- Foco de teclado visible en el acento en todos los controles; ningún anillo azul por defecto.
- Login, recordarme, recuperación de clave y mensajes de error funcionan exactamente como antes del cambio.
- El interior de la app conserva su lenguaje slate/indigo: nada de estos tokens se filtra a los módulos internos.
