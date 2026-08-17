# Prompt de implementación — Landing pública editable, editor de landing (super usuario) y acceso

Tercera tanda, después de (1) Producción + editor de Dashboard y (2) Nóminas, Empleados, Referencias y Reportes. Pégale esto a tu agente de código dentro del repo `ERP_CONFECCION` (Laravel 11 + Inertia + React 19 + TS + Tailwind v4).

Cubre tres entregables:

- **A.** Landing pública multiempresa, escritorio y móvil, con **todo el contenido editable** (nada de textos en el componente).
- **B.** Módulo de super usuario para administrar esa landing por bloques.
- **C.** Pantalla de acceso (login) rediseñada, escritorio y móvil.

Referencia visual: 5a (landing escritorio), 5b (landing móvil), 5c (editor), 4c (acceso escritorio) y 4d (acceso móvil) del documento de diseño.

---

## 0. Lenguaje visual de lo público

La landing y el acceso son las **únicas** pantallas con este lenguaje; el interior de la app (slate + indigo claro/oscuro) no se toca.

- Fondo `#161826`, superficie `#232532`, texto `#e9e9ed`, acento `#9184d9`. Escalones de acento usados: `#d2cefd` (cifras/realces), `#e7e5fe` y `#f5f4ff` (texto sobre la banda saturada), `#423a6a` (relleno de etiquetas).
- Grises: `#cfd3e5`, `#b2b6ca`, `#9397ab`, `#75798c`, `#595d6c`, `#3f424d`.
- Divisor: `color-mix(in srgb, #e9e9ed 16%, transparent)`.
- Elevación: `0 0 0 1px #3f424d` (sm) y `0 0 0 1px #595d6c, 0 6px 18px rgba(0,0,0,.55)` (md). **Nada de sombras pesadas apiladas.**
- Inter en peso 500 para títulos (no más), 400 para cuerpo. Radios 4 / 8 / 14 px.
- El acento va como **línea, borde, marca y resplandor** — nunca como relleno de área. Botones **delineados** (borde acento sobre transparente), jamás rellenos sólidos.
- **Una sola** superficie saturada en toda la página: la banda multiempresa, en `#262a60`.
- Reglas horizontales con extremos desvanecidos: `linear-gradient(to right, transparent, var(--divider) 48px, var(--divider) calc(100% - 48px), transparent)`.
- Resplandores decorativos: círculos con `radial-gradient(circle, rgba(145,132,217,.14–.16), transparent 68–70%)`, en contenedores con `overflow:hidden` y `pointer-events:none`.
- Íconos: Phosphor (`@phosphor-icons/react` o la fuente web). No mezcles con Heroicons en estas pantallas.
- Focus visible: `outline: 2px solid #9184d9; outline-offset: 2px`. Nunca el anillo azul por defecto.
- Define estos valores **una vez** como variables CSS en una capa pública (p. ej. `resources/css/public.css` importado solo por el layout público) y consúmelas; no repartas hex por los componentes.

---

## A. Landing pública editable

### A.1 Datos

Crea el contenido como registros, no como JSX:

- Migración `landing_blocks`: `id`, `type` (string), `position` (int), `is_visible` (bool), `data` (json), `published_data` (json, nullable), `timestamps`.
- Migración `landing_block_versions` (historial): `id`, `snapshot` (json con todos los bloques), `published_by`, `published_at`.
- Modelo `LandingBlock` con `$casts = ['data' => 'array', 'is_visible' => 'boolean']` y scope `ordered()`.
- Seeder `LandingContentSeeder` con el contenido por defecto (los textos de más abajo). Es la instalación limpia; el super usuario los cambia después.

Tipos de bloque y forma de `data`:

| `type` | `data` |
| --- | --- |
| `header` | `{ brand, links: [{label, url}], cta: {label, url} }` |
| `hero` | `{ tag, title, body, primary: {label,url}, secondary: {label,url}, trust: [string] }` |
| `flow` | `{ kicker, steps: [{icon, title, body}], caption }` |
| `band` | `{ title, items: [{icon, label}] }` |
| `virtues` | `{ kicker, title, cards: [{icon, title, body}] }` |
| `audience` | `{ kicker, title, roles: [{tag, title, points: [string]}] }` |
| `steps_media` | `{ kicker, steps: [{number, title, body}], image, image_caption }` |
| `quote` | `{ text, source }` |
| `closing` | `{ title, body, primary, secondary }` |
| `footer` | `{ copyright, links: [{label,url}] }` |

`icon` guarda el nombre Phosphor (`ph-scissors`, `ph-receipt`…). Valídalo contra una lista blanca del set que empaquetes.

### A.2 Render

- `LandingController@index` (ruta pública `/`, sin auth) devuelve `Inertia::render('Public/Landing', ['blocks' => LandingBlock::ordered()->where('is_visible', true)->get()->map(fn($b) => ['type' => $b->type, 'data' => $b->published_data ?? $b->data])])`. En producción sirve **solo lo publicado**.
- `Pages/Public/Landing.tsx` recorre `blocks` y despacha a un componente por tipo (`Components/Public/Blocks/Hero.tsx`, `Flow.tsx`, `Band.tsx`, …) desde un mapa `type → componente`. Un tipo desconocido se ignora en silencio.
- Layout `Layouts/PublicLayout.tsx`: fondo del sistema, `PublicHeader` y `PublicFooter` alimentados por los bloques `header` / `footer`.
- Todo el texto sale de `data`. **Cero literales de copy en los componentes** (salvo `alt` genéricos y etiquetas de accesibilidad).
- Móvil primero: el `header` colapsa en un botón de 44px que abre un menú a pantalla completa; los CTA van a 50px de alto y ancho completo; las rejillas de 3 y 4 columnas pasan a 1 (y la banda a 1 columna en lista).
- Imágenes: envuélvelas en un contenedor con `mix-blend-mode: lighten` y prefiere fotos sobre fondo oscuro. Mientras no haya imagen cargada, muestra el marco con ícono y la leyenda del campo `image_caption`.

### A.3 Contenido por defecto (para el seeder)

**header** — marca `ConfecciónERP`; enlaces: Cómo funciona, Módulos, Para quién, Precios, Ingresar; CTA `Vincular mi empresa`.

**hero** — etiqueta `Software para talleres de confección`; título `Tu taller, con las cuentas claras cada quincena.`; cuerpo `Vincula tu empresa y maneja producción a destajo, lotes por operación y nómina en un solo lugar. Tus datos, tus tarifas y tu gente quedan aislados de cualquier otro taller.`; botones `Vincular mi empresa` y `Ver una demostración`; sellos: `Sin instalación`, `Cada empresa con sus datos`, `Pensado para el celular del taller`.

**flow** — kicker `El flujo completo`; pasos: `Referencia y lote` (ph-scissors, "Operaciones de la prenda y tarifa por unidad"), `Registro en el puesto` (ph-device-mobile, "Cada operaria marca lo que hizo, con tope de lote"), `Confirmación del supervisor` (ph-seal-check, "Lo registrado se valida antes de entrar a nómina"), `Nómina liquidada` (ph-receipt, "Producido, recargos, anticipos y comprobante"); leyenda `Un solo hilo: lo que se cose es lo que se paga.` Los pasos se unen con una línea vertical de 1px en degradado del acento a transparente.

**band** — título `Multiempresa de verdad`; ítems: `Cada taller su propio espacio` (ph-buildings), `Datos aislados por empresa` (ph-lock-key), `Roles y permisos propios` (ph-user-gear), `Tarifas y lotes propios` (ph-currency-circle-dollar).

**virtues** — kicker `Por qué vincularte`; título `Lo que cambia en el taller desde la primera semana`; seis tarjetas: *Se acaba la planilla de papel* (ph-clipboard-text), *Nadie cobra más de lo cortado* (ph-shield-check), *La quincena se cierra sola* (ph-calculator), *Toda cifra tiene origen* (ph-magnifying-glass), *Cada rol ve lo suyo* (ph-squares-four), *Funciona con lo que ya tienes* (ph-wifi-high). Cuerpos como en 5a.

**audience** — kicker `Para quién`; título `Una sola herramienta, tres maneras de usarla`; roles `Dueño` / `Jefe de planta` / `Operaria` con tres puntos cada uno (los de 5a).

**steps_media** — kicker `Vincularse toma una tarde`; pasos 01 `Creas la empresa`, 02 `Cargas referencias y gente`, 03 `Cierras tu primera quincena`; imagen vacía con leyenda `Foto de taller — máquina plana o mesa de corte, fondo oscuro`.

**quote** — creado pero con `is_visible = false` (queda listo para cuando haya un testimonio real).

**closing** — título `Vincula tu taller y prueba con una línea`; cuerpo `Empiezas con una referencia y un módulo. Si te cuadra la primera quincena, sigues con toda la planta.`; botones `Vincular mi empresa` y `Hablar con el equipo`.

**footer** — `© 2026 ConfecciónERP`; enlaces Términos, Privacidad, Soporte.

> Ningún bloque menciona empresas, empleados, montos o métricas de un cliente: la landing vende el software, no los datos de un taller. Mantén esa regla al editar los textos por defecto.

---

## B. Editor de landing (super usuario)

Ruta `super-admin/landing`, permiso nuevo `landing.manage`, solo super usuario. Vive en el `AppLayout` interno (slate/indigo), **no** en el lenguaje oscuro público — excepto la vista previa, que sí renderiza los bloques reales.

Layout de escritorio en tres columnas (`grid-cols-[300px_1fr_320px]`) con barra superior:

**Barra superior:** título `Landing pública`, `Badge` con el número de cambios sin publicar, y a la derecha `Versiones`, `Previsualizar` y `Publicar`.

**Columna izquierda — lista de bloques:** cada fila con manija de arrastre (`ph-dots-six-vertical`), nombre del tipo, resumen del contenido ("Etiqueta · título · 2 botones · 3 sellos") y ojo para alternar visibilidad. El bloque activo se marca con anillo del acento; los ocultos van al 60% con `ph-eye-slash`. Arrastre para reordenar (persiste `position`), botón `Añadir` con el catálogo de tipos.

**Columna central — vista previa:** renderiza los mismos componentes públicos con el contenido del borrador, cada bloque con una etiqueta flotante de su tipo y contorno al pasar el mouse; clic en un texto lo enfoca en el panel derecho (edición en línea con `contentEditable` es opcional, el panel es la fuente de verdad). Conmutador `Escritorio / Móvil` que solo cambia el ancho del contenedor de la vista previa.

**Columna derecha — campos del bloque activo:** formulario generado desde un esquema por tipo. Controles necesarios: texto corto, texto largo, ícono (selector con búsqueda sobre la lista blanca de Phosphor), enlace (texto + destino, con las rutas conocidas en un `<select>` y opción de URL libre), imagen (subida a `storage/app/public/landing`), y **listas repetibles** (sellos, ítems de banda, tarjetas, roles, puntos, pasos, enlaces) con añadir / eliminar / reordenar. Arriba, duplicar y eliminar el bloque; abajo, interruptor `Visible en el sitio`.

**Comportamiento:**

- Guardado del borrador con debounce (600ms) sobre `data`; `PUT super-admin/landing/blocks/{block}`. Reordenar: `PUT super-admin/landing/blocks/reorder` con el arreglo de ids. Crear / duplicar / eliminar: rutas propias.
- `Publicar` copia `data → published_data` de todos los bloques y crea un registro en `landing_block_versions`. `Versiones` lista los snapshots con fecha y autor y permite restaurar uno (restaurar solo repone el borrador; el usuario vuelve a publicar).
- `Previsualizar` abre la landing con `?preview=1`, que sirve `data` en vez de `published_data`, y solo para quien tiene `landing.manage`.
- Validación en el `FormRequest`: tipos permitidos, longitudes máximas por campo, íconos contra la lista blanca, URLs válidas, imágenes ≤2MB. Errores por campo devueltos a Inertia.
- **En móvil el editor es una sola columna**: lista de bloques → al tocar uno se abre su formulario a pantalla completa con `Guardar` y `Volver` de 48px; la vista previa es una pestaña aparte. No intentes tres columnas en 390px.

---

## C. Acceso (login)

`Pages/Auth/Login.tsx` + `Layouts/AuthLayout.tsx`, con el lenguaje público. Quita el degradado indigo→blanco→slate actual.

**Escritorio** — dos paneles (`grid-cols-[1.15fr_1fr]`) separados por un divisor de 1px, en una tarjeta a pantalla completa sobre `#161826`:

- Izquierda: marca arriba (cuadro de 28px con borde acento + `ph-needle`, nombre `ConfecciónERP`), y abajo el titular `El turno de hoy ya está contando.` con una línea de apoyo. Un resplandor del acento en la esquina inferior izquierda. **Las tres cifras que muestra este panel deben venir del servidor o no mostrarse**: son agregados globales anónimos (unidades del día, operarias activas, nóminas por aprobar) — si no puedes calcularlos sin exponer datos de una empresa, omite el bloque y deja solo el titular. Nunca datos inventados ni de un taller identificable.
- Derecha: `Iniciar sesión`, control segmentado `Correo / Documento` (cambia el tipo y el placeholder del primer campo), campo de correo/documento con ícono, campo de contraseña con ícono y botón de 36px para mostrarla, fila `Recordarme` + `¿Olvidaste tu clave?`, botón `Entrar` delineado de 48px a ancho completo, y una nota final `¿Problemas para entrar? Habla con el administrador de tu taller.`
- Campos: 46px de alto, fondo `#232532`, borde del divisor; en foco, borde acento.

**Móvil (390px)** — una columna: marca, titular, segmentado a ancho completo, campos de **52px**, fila de recordarme, las cifras (si existen) justo encima del pie, y el botón `Entrar` de **52px** en una barra fija al fondo con borde superior. Nada bajo 44px.

**Sin cambios funcionales**: mismo `useForm`, mismos campos y misma ruta `login`; el segmentado solo alterna qué credencial se envía si el backend ya lo soporta — si no, déjalo deshabilitado o quítalo antes que inventar comportamiento.

---

## Criterios de aceptación

- Cambiar cualquier texto, ícono, orden o visibilidad de la landing es posible **sin tocar código** y sobrevive a un despliegue.
- La landing pública no muestra en ninguna parte datos de una empresa, empleado o monto real.
- Sin publicar, los cambios no se ven en `/`; al publicar, sí, y queda una versión restaurable.
- A 390px no hay scroll horizontal en la landing, el editor ni el acceso; ningún objetivo táctil bajo 44px.
- La landing tiene exactamente **una** superficie saturada (la banda) y ningún botón relleno sólido.
- El acceso funciona con las credenciales actuales sin cambios de backend.
- El interior de la app conserva su lenguaje slate/indigo: nada del tema oscuro público se filtra a los módulos internos.

## Pendiente que no resuelve este prompt

Una fotografía de taller genérica (máquina plana o mesa de corte) tomada sobre fondo oscuro, para el bloque `steps_media`. Hasta que exista, el marco con leyenda es el estado correcto.
