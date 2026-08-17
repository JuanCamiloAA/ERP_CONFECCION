# Prompt de implementación — Editor de landing del super usuario (5c), al detalle

Prompt **individual y autocontenido**: implementa solo el módulo de administración de la landing pública, exactamente como la pantalla 5c del documento de diseño. No requiere leer los otros prompts, pero convive con ellos (la landing pública consume los mismos datos).

Repo: `ERP_CONFECCION` — Laravel 11 + Inertia + React 19 + TypeScript + Tailwind v4. Íconos Phosphor (`@phosphor-icons/react`).

---

## 0. Qué se construye, en una frase

Una pantalla de super usuario en `super-admin/landing` con **tres columnas** — lista de bloques a la izquierda, vista previa en vivo al centro, campos del bloque activo a la derecha — más una barra superior con *Versiones*, *Previsualizar* y *Publicar*. Toda la landing pública se edita ahí: textos, íconos, imágenes, enlaces, orden y visibilidad. Nada de copy en el código.

---

## 1. Backend

### 1.1 Migraciones

`landing_blocks`

| columna | tipo |
| --- | --- |
| `id` | id |
| `type` | string(40), indexado |
| `position` | unsignedInteger, indexado |
| `is_visible` | boolean, default true |
| `data` | json — **borrador** |
| `published_data` | json nullable — lo que ve el público |
| `timestamps` | |

`landing_versions`

| columna | tipo |
| --- | --- |
| `id` | id |
| `snapshot` | json — arreglo completo de bloques (`type`, `position`, `is_visible`, `data`) |
| `published_by` | foreignId → users, nullOnDelete |
| `note` | string(120) nullable |
| `published_at` | timestamp |

### 1.2 Modelo

```php
class LandingBlock extends Model
{
    protected $fillable = ['type', 'position', 'is_visible', 'data', 'published_data'];
    protected $casts = ['data' => 'array', 'published_data' => 'array', 'is_visible' => 'boolean'];

    public function scopeOrdered($q) { return $q->orderBy('position'); }

    /** true cuando el borrador difiere de lo publicado. */
    public function getIsDirtyAttribute(): bool
    {
        return $this->published_data === null || $this->data != $this->published_data;
    }
}
```

### 1.3 Catálogo de tipos — fuente única de verdad

Crea `config/landing_blocks.php` con el esquema de cada tipo: etiqueta legible, ícono, si es único (`singleton`) y sus campos. El editor **genera el formulario desde este archivo**; agregar un tipo nuevo no debe requerir tocar React.

```php
return [
    'hero' => [
        'label' => 'Hero',
        'icon' => 'ph-megaphone',
        'singleton' => true,
        'fields' => [
            'tag'       => ['type' => 'text',  'label' => 'Etiqueta', 'max' => 60],
            'title'     => ['type' => 'textarea', 'label' => 'Título', 'max' => 120, 'rows' => 2],
            'body'      => ['type' => 'textarea', 'label' => 'Párrafo', 'max' => 320, 'rows' => 3],
            'primary'   => ['type' => 'link',  'label' => 'Botón principal'],
            'secondary' => ['type' => 'link',  'label' => 'Botón secundario'],
            'trust'     => ['type' => 'repeater', 'label' => 'Sellos de confianza', 'max_items' => 4,
                            'item' => ['label' => ['type' => 'text', 'max' => 40]]],
        ],
    ],
    // header, flow, band, virtues, audience, steps_media, quote, closing, footer …
];
```

Tipos de campo que el editor debe soportar: `text`, `textarea`, `link` (`{label, url}`), `icon` (nombre Phosphor), `image` (ruta en storage), `repeater` (lista de subcampos, con `max_items`).

Lista blanca de íconos: `config/landing_icons.php` con los nombres permitidos (los usados por la landing más un set general). Cualquier `icon` fuera de la lista es error de validación.

### 1.4 Rutas y controlador

Dentro del grupo de super usuario, permiso `landing.manage`:

```
GET    super-admin/landing                          → LandingAdminController@index
POST   super-admin/landing/blocks                   → store        (crear del catálogo)
PUT    super-admin/landing/blocks/{block}           → update       (data + is_visible)
POST   super-admin/landing/blocks/{block}/duplicate  → duplicate
DELETE super-admin/landing/blocks/{block}           → destroy
PUT    super-admin/landing/blocks/reorder           → reorder      ({ids: [...]})
POST   super-admin/landing/publish                  → publish
GET    super-admin/landing/versions                 → versions
POST   super-admin/landing/versions/{version}/restore → restore
POST   super-admin/landing/media                    → media        (imagen → storage/app/public/landing, ≤2MB, jpg/png/webp)
```

`index` entrega:

```php
Inertia::render('SuperAdmin/Landing/Index', [
    'blocks'  => LandingBlock::ordered()->get()->map(fn ($b) => [
        'id' => $b->id, 'type' => $b->type, 'position' => $b->position,
        'is_visible' => $b->is_visible, 'data' => $b->data, 'is_dirty' => $b->is_dirty,
    ]),
    'catalog'      => config('landing_blocks'),
    'icons'        => config('landing_icons'),
    'linkTargets'  => [ ['label' => 'Registro de empresa', 'url' => route('register')], ['label' => 'Ingresar', 'url' => route('login')], /* … */ ],
    'dirtyCount'   => /* cuántos bloques con is_dirty */,
    'lastPublished'=> LandingVersion::latest('published_at')->first(?),
]);
```

- `update` valida contra el esquema del tipo (longitudes, `max_items`, íconos en la lista blanca, `url` válida o ruta interna conocida) en un `FormRequest` que **lee `config/landing_blocks.php`**, no reglas escritas a mano por tipo.
- `publish`: en una transacción copia `data → published_data` en todos los bloques y crea una `LandingVersion` con el snapshot, `published_by = auth()->id()`.
- `restore`: repone el snapshot en `data` (no publica) y responde con los bloques actualizados.
- `reorder`: reasigna `position` según el orden recibido, en una transacción.
- Respuestas de mutación: redirect Inertia de vuelta a `index` (`->back()`), para que la página quede con los datos frescos sin recargas manuales.

---

## 2. Frontend — `Pages/SuperAdmin/Landing/Index.tsx`

Vive dentro del `AppLayout` interno (slate/indigo, claro y oscuro). **La vista previa es la única parte con el lenguaje oscuro público**, porque renderiza los componentes reales de la landing.

### 2.1 Estructura

```
AppLayout
└─ div  h-[calc(100vh-4rem)] flex flex-col overflow-hidden
   ├─ Barra superior      h-14 shrink-0, borde inferior
   └─ div  flex-1 min-h-0 grid lg:grid-cols-[300px_1fr_320px]
      ├─ Panel Bloques    borde derecho, columna con scroll propio
      ├─ Panel Vista previa
      └─ Panel Campos     borde izquierdo, columna con scroll propio
```

Cada panel scrollea por dentro (`min-h-0 overflow-y-auto`); la página **no** scrollea.

### 2.2 Barra superior

De izquierda a derecha: cuadro de marca de 26px (borde `indigo-500`, ícono `ph-needle`), título `Super usuario · Landing pública` (15px, medium), `Badge` neutro con `Borrador con {n} cambios` (o `Todo publicado` cuando `dirtyCount === 0`), y a la derecha, con `ml-auto`:

- `Versiones` — botón secundario de 36px, ícono `ph-clock-counter-clockwise`. Abre un `Modal` con la lista de versiones: fecha, autor y botón `Restaurar` (con `ConfirmDialog`).
- `Previsualizar` — botón secundario de 36px, ícono `ph-eye`. Abre `/?preview=1` en pestaña nueva.
- `Publicar` — botón primario de 36px. Deshabilitado si `dirtyCount === 0`. Confirma antes de publicar y avisa con `toast.success`.

### 2.3 Panel izquierdo — Bloques

- Encabezado: `BLOQUES` (11px, uppercase, tracking .1em, slate-500) y a la derecha `+ Añadir` (botón ghost de 32px) que abre un menú con los tipos del catálogo; los `singleton` ya usados aparecen deshabilitados.
- Una fila por bloque, alto ≥64px, `rounded-lg`, `gap-1.5` entre filas:
  - manija `ph-dots-six-vertical` (16px, slate-400) — arrastre para reordenar;
  - nombre del tipo (14px medium) y debajo el **resumen del contenido** en 11px slate-500, generado desde `data`: `Marca · 5 enlaces · 1 botón`, `Etiqueta · título · 2 botones · 3 sellos`, `4 pasos con ícono`, `6 tarjetas · rejilla de 3`, `3 roles · 3 puntos cada uno`, `Título · 2 botones · 3 enlaces`. Escribe una función `summarize(type, data)` con un caso por tipo;
  - a la derecha, ojo de 24px: `ph-eye` cuando es visible, `ph-eye-slash` cuando no; alterna `is_visible` de inmediato.
- **Bloque activo**: anillo del acento (`ring-1 ring-indigo-500`) y el nombre en `indigo-300`/`indigo-700`. Los demás llevan solo el borde hairline (`ring-1 ring-slate-200 dark:ring-slate-700`).
- **Bloque oculto**: toda la fila al 60% de opacidad y el resumen dice `Oculto en el sitio`.
- Reordenar por arrastre (usa `@dnd-kit` si ya está en el proyecto; si no, `react-grid-layout` no sirve aquí — implementa arrastre simple con HTML5 drag & drop) y persiste con `reorder` al soltar.

### 2.4 Panel central — Vista previa

- Encabezado: `VISTA PREVIA · EDICIÓN EN LÍNEA` (11px uppercase slate-500) y a la derecha un segmentado `Escritorio / Móvil` con íconos `ph-desktop` y `ph-device-mobile`, que solo cambia el ancho del contenedor (1160px escalado a lo que quepa / 390px centrado).
- Dentro, sobre fondo `#161826`: los **componentes públicos reales**, alimentados con el borrador, en orden y respetando `is_visible` (los ocultos se pintan al 40% con una cinta `Oculto`, para que el super usuario los vea sin publicarlos).
- Cada bloque va envuelto en un contorno interactivo: `ring-1 ring-transparent` en reposo, `ring-slate-500` al pasar el mouse, `ring-indigo-500` cuando está activo, y una **etiqueta flotante** con el tipo en la esquina superior izquierda (`-top-2 left-3.5`, 10px uppercase, fondo del acento y texto oscuro cuando está activo; fondo `slate-900` y texto `slate-300` cuando no).
- Clic en un bloque lo activa (y hace scroll de la lista izquierda hasta su fila). Clic sobre un texto activa el bloque **y** enfoca ese campo en el panel derecho (`data-field="title"` en el elemento → `focusField(name)`).
- Debajo de la vista previa, una nota en 12px slate-500: `Al hacer clic en cualquier texto se edita en el sitio; el panel derecho guarda los campos del bloque activo.`
- La edición `contentEditable` in-situ es opcional; si la implementas, sincroniza con el mismo estado del panel derecho y no dupliques la fuente de verdad.

### 2.5 Panel derecho — Campos del bloque activo

- Encabezado: `BLOQUE · {TIPO}` en 11px uppercase, y a la derecha dos iconos de 24px: duplicar (`ph-copy`) y eliminar (`ph-trash`, con `ConfirmDialog`).
- El formulario se **genera desde el esquema** del tipo. Un componente por tipo de campo:
  - `text` → `Input` de 40px.
  - `textarea` → `Textarea` con las filas del esquema; contador de caracteres cuando hay `max`.
  - `link` → dos campos en fila: texto del botón (`Input`) y `Destino` (`Select` con `linkTargets` + opción `URL personalizada` que revela un `Input`).
  - `icon` → botón que abre un selector con buscador sobre la lista blanca, mostrando el glifo real en una rejilla; el botón muestra el ícono elegido.
  - `image` → marco 4:3 con la imagen o el estado vacío (ícono `ph-image` + leyenda), botón `Subir imagen` y `Quitar`; sube a `media` y guarda la ruta.
  - `repeater` → lista de filas con manija de arrastre, los subcampos, y una `×` para eliminar; abajo `+ Añadir {singular}` en ghost. Respeta `max_items` (deshabilita el botón al llegar al tope).
- Al pie, separado por un divisor: fila `Visible en el sitio` con un interruptor de 42×24px (pista con anillo del acento, perilla de 18px) enlazado a `is_visible`.
- **Guardado**: `useState` local del bloque activo + `useEffect` con debounce de 600ms que hace `PUT` del bloque; indicador discreto `Guardando… / Guardado` junto al encabezado del panel. Errores de validación se muestran bajo el campo correspondiente (`errors['data.title']`).

### 2.6 Móvil / tablet angosta (`<1024px`)

Tres columnas no caben. En su lugar, tres pestañas — `Bloques`, `Vista previa`, `Campos` — bajo la barra superior:

- `Bloques` es la lista, con reordenar por flechas arriba/abajo de 44px en vez de arrastre.
- Tocar un bloque abre `Campos` a pantalla completa, con `Volver` y `Guardar` de 48px en una barra inferior fija.
- `Vista previa` muestra el ancho de 390px con el conmutador oculto.
- Ningún objetivo táctil bajo 44px; los iconos de ojo, duplicar y eliminar pasan a 44px.

---

## 3. Detalles visuales exactos (para que se vea como 5c)

Los interiores usan el sistema de la app (slate/indigo), la vista previa usa el sistema público:

| Elemento | Valor |
| --- | --- |
| Alto de la barra superior | 56px, borde inferior `slate-200 / slate-700` |
| Columnas | `300px / 1fr / 320px`, divisores de 1px |
| Radio de tarjetas y filas | `rounded-lg` (8px) |
| Fila de bloque | padding `10px 12px`, `gap-2.5`, alto ≥64px |
| Kickers de panel | 11px, uppercase, `tracking-[.1em]`, slate-500 |
| Nombre de bloque | 14px, `font-medium` |
| Resumen de bloque | 11px, slate-500 |
| Etiqueta flotante de bloque en la vista previa | 10px, uppercase, `tracking-[.1em]`, padding `1px 7px`, radio 3px |
| Botones de la barra | 36px de alto; `Publicar` primario, los otros secundarios |
| Campos del panel derecho | `Input` 40px; `Textarea` según `rows`; etiquetas 12px |
| Interruptor | pista 42×24px, perilla 18px, anillo del acento cuando está activo |
| Vista previa · fondo | `#161826`; superficies `#232532`; acento `#9184d9`; banda saturada `#262a60` |
| Botones dentro de la vista previa | **delineados** (borde acento sobre transparente), nunca rellenos |

---

## 4. Criterios de aceptación

- Cambiar cualquier texto, ícono, imagen, enlace, orden o visibilidad de la landing es posible sin tocar código, y el cambio se ve en la vista previa al instante.
- Sin publicar, `/` no cambia; `/?preview=1` (solo con `landing.manage`) sí muestra el borrador.
- `Publicar` deja una versión restaurable con fecha y autor; restaurar repone el borrador sin publicar.
- Reordenar y ocultar bloques sobrevive a recargar la página.
- Agregar un tipo de bloque nuevo solo requiere una entrada en `config/landing_blocks.php` y un componente de render en la landing — el formulario del editor aparece solo.
- A 390px el editor funciona con pestañas, sin scroll horizontal y sin objetivos táctiles bajo 44px.
- Los tres paneles scrollean por separado; la ventana no scrollea.
- La validación impide guardar íconos fuera de la lista blanca, textos más largos que el máximo del esquema, o más ítems que `max_items`.
