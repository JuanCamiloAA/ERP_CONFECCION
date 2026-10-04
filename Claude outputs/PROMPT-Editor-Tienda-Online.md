# Prompt de cambio — Editor de la tienda online (bloques, aspecto y funciones por sede)

> **Contexto.** Proyecto "La Canasta": Laravel 12 + Inertia 2 + React 19 + TypeScript + Tailwind 4,
> spatie/laravel-permission, multiempresa (`companies`) con sedes (`stores`). Ya existe un editor de la tienda con
> tres columnas (bloques · propiedades · vista previa) que solo edita **contenido**, guarda bloque por bloque y
> publica en vivo. Este documento lo reemplaza.
>
> **Regla de oro:** no se entrega nada que no funcione. Ningún botón sin acción, ninguna pantalla con datos escritos
> en el `.tsx`, ningún bloque que se pueda agregar pero no se renderice en la tienda.

---

## 1. Decisiones ya tomadas (no volver a abrirlas)

| Decisión | Valor |
|---|---|
| Modelo de edición | **Constructor por bloques**: se agregan, ordenan, ocultan, duplican y programan libremente |
| Guardado | **Borrador → Publicar → Historial** con posibilidad de revertir a una versión anterior |
| Alcance | **Todo por sede**: aspecto, contenido y funciones. Con acciones "copiar de otra sede" y "aplicar a todas" |
| Funciones configurables | Domicilio y cobertura · Horarios y franjas · Cupones y promociones · Medios de pago en línea |
| Dispositivos | El editor completo funciona en **escritorio y celular** (no una versión recortada) |

---

## 2. Modelo de datos

Todas las tablas llevan `company_id` y `store_id` (la sede dueña de la configuración), `timestamps`, y respetan
`CompanyScope`.

### 2.1 Sitio, borrador y versiones

**`storefronts`** — una fila por sede.
`company_id`, `store_id` (unique), `slug`, `custom_domain` (nullable), `is_online` (bool),
`published_version_id` (nullable → `storefront_versions`), `published_at`, `published_by_user_id`.

**`storefront_versions`** — foto completa de una publicación.
`storefront_id`, `number` (consecutivo por sitio), `label` (nullable: "Campaña del jueves"),
`snapshot` (json: `{theme, blocks[], settings}` completo y autosuficiente), `created_by_user_id`,
`published_at` (nullable: null = borrador guardado como punto de restauración).
Se conservan las últimas 30 versiones por sitio; las más viejas se podan con un comando programado.

**`storefront_blocks`** — el **borrador vivo** (lo que el editor edita).
`storefront_id`, `type` (ver §3), `sort_order` (int), `is_visible` (bool),
`visible_from` / `visible_to` (datetime nullable → programación),
`devices` (`all`|`mobile`|`desktop`), `payload` (json con la forma del tipo), `uuid` (para React keys estables).

**`storefront_themes`** — un registro por sede, es el borrador del aspecto.
`storefront_id`, `logo_media_id`, `favicon_media_id`, `display_name`, `tagline`,
`accent` (hex), `scheme` (`light`|`dark`|`auto`), `font_pair` (`moderna`|`editorial`|`cercana`),
`radius` (`sharp`|`soft`|`round`), `density` (`compact`|`cozy`), `button_style` (`solid`|`outline`).

**`storefront_settings`** — funciones, una fila por `storefront_id` + `key`, `value` (json), unique compuesto.
Claves: `delivery`, `coverage`, `slots`, `payments`, `catalog`, `texts`, `seo`.

### 2.2 Funciones con tabla propia

**`delivery_zones`** — `storefront_id`, `name` (barrio), `fee`, `eta_minutes`, `is_active`, `geometry` (json
nullable: polígono o centro+radio), `sort_order`.

**`delivery_slots`** — `storefront_id`, `weekday` (0-6), `starts_at` (time), `ends_at` (time),
`capacity` (int, pedidos máximos), `is_active`.

**`coupons`** — `company_id`, `storefront_id` (nullable = todas las sedes), `code` (unique por empresa),
`type` (`percent`|`amount`|`free_delivery`), `value`, `min_order_total`, `max_discount`,
`scope` (`all`|`category`|`product`), `scope_ids` (json), `starts_at`, `ends_at`,
`usage_limit`, `usage_limit_per_customer`, `first_order_only` (bool), `is_active`.
**`coupon_redemptions`** — `coupon_id`, `order_id`, `customer_id`, `discount_amount`, `redeemed_at`.

**`media_assets`** — `company_id`, `path`, `disk`, `mime`, `width`, `height`, `bytes`,
`alt` (texto alternativo), `focal_x` / `focal_y` (0–1, punto de recorte), `created_by_user_id`.
Al subir se generan variantes 16:9, 4:5 y 1:1 en WebP (cola de trabajos), y se sirve `<img srcset>`.

---

## 3. Catálogo de bloques

Cada tipo declara su `payload` con un DTO tipado en PHP (`App\Storefront\Blocks\*BlockData`) y su esquema `zod`
equivalente en TypeScript. **Un tipo no existe si no tiene las tres piezas:** DTO + editor + renderizador.

| `type` | Para qué sirve | `payload` |
|---|---|---|
| `announcement` | Franja de avisos arriba de todo | `{text, link?, tone: 'accent'\|'warn'}` |
| `hero` | Banner principal | `{media_id?, alt, title, subtitle?, button_label?, button_target: {kind:'category'\|'page'\|'url', value}, text_color:'light'\|'dark'}` |
| `categories` | Círculos de categorías | `{source:'all'\|'manual', category_ids[], limit}` |
| `product_grid` | Vitrina de artículos | `{title, source:'category'\|'tag'\|'best_sellers'\|'manual', value, limit, columns:2\|3, show_price_per_unit:bool}` |
| `promo_carousel` | Carrusel de promociones | `{slides:[{media_id, alt, title, target}]}` |
| `benefits` | Banda de beneficios | `{items:[{icon, title, text}]}` (máx. 4) |
| `rich_text` | Texto libre | `{title?, body}` (markdown acotado: negrita, listas, enlaces) |
| `faq` | Preguntas frecuentes | `{items:[{question, answer}]}` |
| `store_info` | Dirección, teléfono y horario | `{show_map:bool, note?}` (los datos salen de `stores`, no se re-escriben) |

Reglas transversales de todo bloque: `is_visible`, `devices`, `visible_from`/`visible_to`, duplicar y eliminar.
Un bloque programado se muestra en el editor con la insignia **Programado** y en la tienda solo dentro de su ventana.

---

## 4. Borrador, publicación e historial

```
storefront_blocks + storefront_themes + storefront_settings   ← BORRADOR (lo que edita el editor)
                     │  publicar  ▼
storefront_versions.snapshot (json completo)  →  storefronts.published_version_id
                                                  ▲ la tienda pública SIEMPRE lee de aquí
```

- **Guardado automático**: cada cambio de propiedad hace `PATCH` con *debounce* de 600 ms sobre el borrador.
  El editor muestra "Guardado en el borrador hace N s". **No existe botón "Guardar el bloque".**
- **Publicar** (`StorefrontPublisher::publish`): valida (§8), arma el `snapshot`, crea la versión, apunta
  `published_version_id`, invalida la caché y registra quién publicó.
- **Vista previa**: `GET /tienda/preview/{token}` renderiza el **borrador** con un token firmado de 30 minutos
  (`URL::temporarySignedRoute`). Nadie más ve el borrador.
- **Historial**: lista de versiones con número, etiqueta, autor, fecha y un diff legible
  ("3 bloques cambiados · tarifa de domicilio $4.000 → $4.500"). **Revertir** crea una versión nueva copiando el
  snapshot elegido (nunca se borra historia) y repone el borrador.
- **Caché**: el snapshot publicado se cachea por `store_id`; la clave se invalida al publicar y al revertir.

---

## 5. Permisos (añadir al catálogo de `PermissionHelper`)

```
storefront.editor.view        Abrir el editor de la tienda
storefront.editor.content     Editar bloques y contenido
storefront.editor.appearance  Editar el aspecto (marca, color, tipografía)
storefront.editor.settings    Editar funciones (domicilio, franjas, pagos, cupones)
storefront.editor.publish     Publicar cambios
storefront.editor.history     Ver el historial y revertir
storefront.editor.copy_store  Copiar la configuración a otras sedes
coupons.index.view / create / edit / delete
```

Quien tenga `content` pero no `publish` edita el borrador y deja el cambio listo: el botón Publicar aparece
deshabilitado con la explicación "Necesitas permiso para publicar; avísale a un administrador".

---

## 6. Rutas

```
GET    tienda/editor                         Storefront\EditorController@index        storefront.editor.view
PATCH  tienda/editor/tema                    Storefront\ThemeController@update        storefront.editor.appearance
POST   tienda/editor/bloques                 Storefront\BlockController@store         storefront.editor.content
PATCH  tienda/editor/bloques/{block}         Storefront\BlockController@update        storefront.editor.content
POST   tienda/editor/bloques/{block}/duplicar Storefront\BlockController@duplicate    storefront.editor.content
DELETE tienda/editor/bloques/{block}         Storefront\BlockController@destroy       storefront.editor.content
POST   tienda/editor/bloques/orden           Storefront\BlockController@reorder       storefront.editor.content
PATCH  tienda/editor/funciones/{key}         Storefront\SettingController@update      storefront.editor.settings
resource tienda/editor/zonas                 Storefront\DeliveryZoneController        storefront.editor.settings
resource tienda/editor/franjas               Storefront\DeliverySlotController        storefront.editor.settings
resource cupones                             CouponController                         coupons.*
POST   tienda/editor/publicar                Storefront\PublishController@store       storefront.editor.publish
GET    tienda/editor/historial               Storefront\VersionController@index       storefront.editor.history
POST   tienda/editor/historial/{version}/revertir Storefront\VersionController@restore storefront.editor.history
POST   tienda/editor/copiar                  Storefront\CopyController@store          storefront.editor.copy_store
GET    tienda/preview/{token}                Storefront\PreviewController@show        (firmada, sin sesión)
POST   media                                 MediaController@store                    storefront.editor.content
```

Todas las rutas del editor resuelven la sede desde `StoreContext`; cambiar de sede en el selector cambia la sesión
y recarga el editor con **su** borrador.

---

## 7. Interfaz

### 7.1 Barra superior (siempre visible, escritorio y celular)

Salir · **Editor de la tienda** · selector de **sede** · pestañas **Aspecto / Contenido / Funciones** ·
estado (`● Borrador · guardado 10:42` en ámbar, `● Publicado` en verde) · Historial · Vista previa · **Publicar**.
Debajo, una franja fija: *"Todo lo que cambies aquí aplica solo a la Sede Centro"* con
"Copiar configuración de otra sede" y "Aplicar a todas las sedes".

### 7.2 Escritorio — pestaña Contenido (1440 px de referencia)

Tres columnas: **Bloques 302 px · Propiedades 404 px · Cómo se ve (resto)**.

- **Bloques**: contador, botón *Agregar*, lista arrastrable. Cada fila: asa de arrastre, nombre **con su regla**
  ("Vitrina · Destacados de hoy — más vendidos · 12 artículos"), insignias *Programado / Oculto / Vacío*, y ojo para
  mostrar u ocultar. Pie: "Arrastra para reordenar. En celular se reordena con las flechas".
- **Propiedades**: encabezado con el nombre del bloque, duplicar y eliminar; pestañas internas
  **Contenido · Estilo · Cuándo se ve**; campos del `payload`; al pie "Guardado en el borrador hace N s" + *Deshacer*.
- **Cómo se ve**: alternador **Celular 390 / Escritorio 1280**, *Ver como cliente*, y la tienda renderizada de verdad
  (iframe con el borrador). El bloque en edición se resalta con borde de acento y su etiqueta; **hacer clic en un
  bloque de la vista previa abre sus propiedades** (mensaje `postMessage` del iframe al editor).

### 7.3 Escritorio — pestaña Aspecto

Marca (logo, nombre visible, frase, ícono del navegador) · Color (acento con muestras y hex, fondo claro/oscuro/auto,
**verificación de contraste en vivo** que bloquea combinaciones bajo 4.5:1) · Tipografía (tres parejas con muestra
real) · Formas y densidad (esquinas, densidad, estilo de botón) · vista previa al lado.
Aviso fijo: los tamaños de toque se mantienen en 44 px aunque la densidad sea compacta.

### 7.4 Escritorio — pestaña Funciones

Navegación lateral (Domicilio y cobertura · Horarios y franjas · Medios de pago · Cupones · Catálogo en línea ·
Textos y avisos · Dominio y compartir) y, a la derecha, un panel **Resumen de la sede** + checklist
*Antes de publicar*.

- **Domicilio**: tarifa, pedido mínimo, gratis desde, tiempo estimado; interruptores de cobrar domicilio, recoger en
  tienda y propina.
- **Cobertura**: por barrios (tabla con tarifa, tiempo y activo) o por radio en km, con mapa.
- **Franjas**: por día de la semana, con cupo por franja y bloqueo automático al llenarse.
- **Medios de pago**: efectivo contraentrega, tarjeta al recibir, transferencia y crédito del cliente
  (este último solo se ofrece a clientes con cupo y sin mora).
- **Cupones**: listado con estado (*Activo, Programado, Agotado*) y creación.

### 7.5 Celular (390 px) — el mismo editor, no uno recortado

- Barra superior compacta con estado y **Publicar**.
- Vista previa a pantalla completa; tocar un bloque lo selecciona.
- **Hoja inferior** en dos alturas: colapsada (lista de bloques, agregar, reordenar con flechas de 44 px) y
  expandida (propiedades del bloque con sus pestañas y las acciones Ocultar / Duplicar / Eliminar).
- Nada de arrastrar para reordenar en táctil: flechas arriba/abajo.
- Subir imagen desde cámara o galería; recorte con punto focal con el dedo.
- Las tres pestañas (Aspecto/Contenido/Funciones) viajan como chips deslizables sobre la vista previa.

---

## 8. Correcciones concretas sobre el editor actual

1. **Quitar "Guardar el bloque"** y pasar a guardado automático del borrador + un único *Publicar*.
2. **Agregar las pestañas Aspecto y Funciones**; hoy solo existe contenido.
3. **Mostrar sede y estado** (borrador/publicado) en la barra superior.
4. **Nombrar los bloques por su regla**: no puede haber dos "Vitrina de artículos" indistinguibles.
5. **Insignias de estado** en la lista: Programado, Oculto, Vacío.
6. **Vista previa completa**, no una columna recortada: teléfono de 390 px centrado, sin cortar tarjetas.
7. **Texto alternativo obligatorio** en toda imagen, con recorte y punto focal.
8. **Destino del botón como selector** (categoría / página / enlace externo), no texto libre.
9. **Avisos accionables dentro de la vista previa**: una vitrina vacía muestra "Arreglar" que lleva a su regla.
10. **Acentuación correcta en toda la microcopia** (hoy se lee "Maximo", "Titulo", "Boton", "promocion", "dias").
11. **Precio por unidad de medida** en las tarjetas de producto ("$ 5.100 / L"), útil en supermercado.
12. **Deshacer / rehacer** con `Ctrl/Cmd + Z` sobre las últimas 20 acciones del borrador.

---

## 9. Validaciones y checklist antes de publicar

`StorefrontPublisher::validate()` devuelve avisos bloqueantes e informativos:

| Regla | Tipo |
|---|---|
| Ningún medio de pago habilitado | Bloquea |
| Cobertura sin zonas activas y domicilio encendido | Bloquea |
| Franjas vacías con domicilio encendido | Bloquea |
| Bloque `hero` sin título o sin imagen | Bloquea |
| Imagen sin texto alternativo | Avisa |
| Vitrina cuya regla devuelve 0 artículos | Avisa |
| Contraste de texto sobre el acento por debajo de 4.5:1 | Bloquea |
| Cupón programado que ya venció | Avisa |

El checklist se ve siempre en el panel derecho de Funciones y en el diálogo de publicar.

---

## 10. Pruebas obligatorias

```
StorefrontDraftTest
  ✓ editar un bloque no cambia lo que ve el cliente hasta publicar
  ✓ el guardado automático actualiza solo el borrador
StorefrontPublishTest
  ✓ publicar crea una versión con el snapshot completo y mueve published_version_id
  ✓ revertir crea una versión nueva y repone el borrador, sin borrar historia
  ✓ publicar sin medios de pago devuelve 422 con el motivo
StorefrontScopeTest
  ✓ publicar en la sede Centro no altera la tienda de la sede Norte
  ✓ "copiar de otra sede" copia aspecto, bloques y funciones al borrador, no a lo publicado
BlockRenderTest
  ✓ cada tipo del catálogo se renderiza en la tienda con su payload
  ✓ un bloque programado fuera de ventana no aparece
  ✓ un bloque con devices=mobile no aparece en escritorio
PreviewTest
  ✓ la vista previa exige token firmado y expira a los 30 minutos
CouponTest
  ✓ un cupón respeta mínimo, tope, vigencia y límite de usos
```

---

## 11. Fases

| Fase | Contenido | Criterio de aceptación |
|---|---|---|
| **E1** | Tablas, modelos, `storefronts` por sede, borrador inicial desde la tienda actual | Cada sede tiene su borrador y su tienda sigue viéndose igual |
| **E2** | Editor de contenido: lista, agregar, ordenar, ocultar, propiedades, guardado automático | Se agrega un bloque, se ordena y se ve en la vista previa, sin publicar |
| **E3** | Publicación, versiones, historial, revertir y vista previa firmada | Publicar cambia la tienda; revertir la deja como estaba |
| **E4** | Aspecto por sede con verificación de contraste | Cambiar acento y tipografía cambia la tienda publicada de esa sede |
| **E5** | Funciones: domicilio, cobertura, franjas, medios de pago, cupones | El checkout respeta tarifa, cobertura, franja y medios habilitados |
| **E6** | Editor en celular (hoja inferior, flechas, cámara) | Se edita y publica completo desde un teléfono de 390 px |
| **E7** | Medios: subida, recorte con foco, variantes WebP, alt obligatorio | Una imagen subida se ve nítida en celular y escritorio |

---

## 12. Definición de terminado

- [ ] El editor funciona completo en escritorio **y** en celular, incluyendo publicar.
- [ ] Aspecto, contenido y funciones son por sede, con copiar entre sedes.
- [ ] Nada se publica sin pasar el checklist; los motivos se muestran en la interfaz.
- [ ] Cada tipo de bloque tiene DTO, editor y renderizador reales; no hay tipos que no se rendericen.
- [ ] El historial permite volver atrás y deja rastro de quién publicó.
- [ ] Toda la microcopia está acentuada y revisada; contraste mínimo 4.5:1; toques de 44 px.
- [ ] `php artisan test` y `tsc --noEmit` en verde, con las pruebas del §10.
