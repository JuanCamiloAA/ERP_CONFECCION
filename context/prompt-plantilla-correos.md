# Prompt de desarrollo: plantilla base de correos (Taller Confección)

## Objetivo
Reemplazar el HTML plano actual de los correos (ver `resources/views/emails/landing-plan-inquiry.blade.php`) por una plantilla base reutilizable, con estilo oscuro (Nocturne: fondo `#161826`, texto `#e9e9ed`, acento `#9184d9`, radios 8-10px), que use SOLO tablas HTML y estilos inline (compatibilidad Outlook/Gmail/Apple Mail). Todos los correos de la app deben compartir el mismo encabezado y pie, y solo cambiar el contenido central.

## Alcance
1. Crear un layout Blade reutilizable: `resources/views/emails/layout.blade.php` con secciones `@yield`/`@section` o slots de componente Blade, conteniendo:
   - Preheader oculto (texto de preview, `display:none;max-height:0;overflow:hidden`).
   - Encabezado: ícono de marca (cuadrado 36x36, `background:#2b2741`, radius 10px) + wordmark "Taller Confección" (`#e9e9ed`, 16px, 600).
   - Contenedor central: tabla `width="600"` centrada, `background:#161826`, `border-radius:14px`, `border:1px solid #292b31`.
   - Slot de contenido (aquí cada correo inyecta su propio cuerpo: título, badge de estado, tarjetas de datos, botón CTA).
   - Pie: iconos de redes sociales (enlaces cuadrados 32x32, `border:1px solid #3f424d`, radius 8px), línea "Taller Confección · Bogotá, Colombia", línea de aviso legal ("Recibiste este correo porque tienes una cuenta activa en la plataforma.").
2. Extraer piezas reutilizables como componentes Blade (`<x-mail::badge>`, `<x-mail::info-card>`, `<x-mail::button>`) o simplemente como `@include` parciales, para que cualquier Mailable nuevo los use sin reescribir HTML.
3. Migrar `landing-plan-inquiry.blade.php` para extender el nuevo layout, manteniendo la misma data (`$plan`, `$payload`) pero con el nuevo maquetado:
   - Badge "Nueva solicitud".
   - Título "Solicitud de plan — {{ $payload['company_name'] }}".
   - Tarjeta "Empresa" con nombre, NIT, teléfono, correo (tabla 2 columnas, etiqueta gris `#75798c` + valor `#e9e9ed`).
   - Tarjeta "Administrador" con los mismos campos.
   - Bloque "Mensaje" si `$payload['message']` no está vacío.
   - Botón CTA opcional "Ver solicitud en el panel" (outline, borde `#9184d9`, texto `#d2cefd`).
4. Auditar `app/Mail/*.php` y cualquier otro lugar que use `Mail::` o notificaciones para asegurarse de que todos apunten a vistas que extienden el layout nuevo (no dejar ningún correo con el HTML plano viejo).
5. Reglas de compatibilidad de email (obligatorias):
   - Solo `<table role="presentation">` para estructura, no `flexbox`/`grid`.
   - Estilos 100% inline (`style="..."`), nada de `<style>` con selectores de clase salvo un bloque `@media` opcional para mobile dentro de `<head>` con fallback inline ya aplicado.
   - Fuente: `Inter, system-ui, sans-serif` (Inter puede no cargar en todos los clientes; el fallback ya cubre esto — no depender de `<link>` a Google Fonts).
   - Ancho fijo de 600px para el contenedor central, con `max-width:100%` para mobile.
   - No usar `background-image` para el ícono de marca; usar tabla/celda con `bgcolor`/`style="background:"` sólido.
   - Botones como `<a>` con padding y borde, no `<button>`.
6. Probar el render en Litmus/Mailtrap (o al menos Gmail web + Outlook desktop) antes de dar por cerrado — Outlook desktop no soporta `border-radius` ni `box-shadow`; degradar con gracia (esquinas cuadradas en Outlook es aceptable).

## Referencia visual
Diseño de referencia (mockup) ya aprobado: `Plantilla Correos.dc.html` en este proyecto — usar como guía de estructura, jerarquía y colores exactos. Convertir su maquetado (actualmente con flex/grid y CSS moderno, válido solo para previsualización) a tablas + inline styles puros para el envío real.

## Entregable esperado
- `resources/views/emails/layout.blade.php` (o partials equivalentes) + Mailables/vistas migradas.
- Sin cambios en la lógica de negocio de `LandingPlanInquiryMail.php` (mismo `envelope()`, mismo `content()` apuntando a la vista), solo el HTML/CSS del correo.
