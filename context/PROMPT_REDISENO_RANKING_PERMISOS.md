# PROMPT — Rediseño del módulo Ranking de Producción + permisos nuevos

Aplica el rediseño del módulo **Ranking de Producción** al proyecto Laravel + Inertia + React (`ERP_CONFECCION`), unificando su estilo con la piel compartida `emp-*` (`resources/css/module-ui.css`) que ya usan Producción, Empleados, Nómina y Referencias. Además de la vista, esta pantalla suma un **filtro de fechas compartido por empresa** (lo fija un admin y lo ven todos los que abren la pestaña) y por eso requiere **permisos nuevos**: hoy solo existe `productions.ranking.view`, que no distingue quién puede exportar, quién puede fijar el filtro para todos y quién solo puede consultar.

La maqueta de referencia (interactiva) está en `Ranking Producción Rediseño.dc.html`. Cuando este documento y la maqueta discrepen, manda la maqueta.

---

## 0. Reglas que no se negocian

1. **Una sola hoja de tokens**: `resources/css/module-ui.css`. No se inventan variables nuevas ni hex sueltos; todo color sale de `var(--emp-*)`.
2. **Importar la hoja** en la página: `import '../../../css/module-ui.css';`, envolver en `.emp-form` con el mismo patrón de `Pages/Productions/Index.tsx`.
3. **Reusar `ProductionFilterBar`** (o extraerla a un componente compartido `RankingFilterBar` que la envuelva) en vez de los dos `<input type="date">` sueltos que tiene hoy `Ranking.tsx`: mismos segmentados de rango, mismo patrón de "Más filtros" con contador y chips.
4. **Botones delineados, iconos Phosphor, elevación = borde, foco visible** — igual que el resto de módulos ya migrados.
5. **Claro y oscuro**: nada de colores fijos asumiendo tema oscuro.
6. **Nada de esto se habilita "por defecto activado" para roles existentes**: los permisos nuevos nacen apagados salvo para Super Admin; cada empresa decide a quién se los da (ver §3).

---

## 1. Qué cambia en la pantalla

### 1.1 Filtros (antes: solo Desde/Hasta + switch)
- Rango rápido: **Hoy · Semana · Quincena · Mes · Rango…** (quincena = del 1 al 15 o del 16 al fin de mes, según el día de hoy).
- Filtro por **referencia** (limita el ranking a la producción de esa referencia).
- Filtro por **turno** (Mañana/Tarde/Noche).
- Switch "Solo confirmadas" (se conserva).
- Chips de filtros activos, con opción de limpiar uno o todos.

### 1.2 Filtro de equipo (compartido)
- Quien tenga el permiso de gestión (`productions.ranking.filter_team.manage`) puede marcar, dentro del panel de filtros, **"Aplicar este filtro a todos los usuarios que abran el ranking"**.
- Al guardar, se persiste un filtro por empresa (fechas, no incluye referencia/turno) y aparece un **banner** en la parte superior visible para *todos* los usuarios con acceso al módulo: *"Filtro del equipo: 01/09/2026 al 15/09/2026 · fijado por [nombre]"*.
- Cualquier usuario puede ajustar su propio filtro sin afectar a los demás; si su filtro personal difiere del de equipo aparece el enlace **"Restablecer al filtro del equipo"**.
- Solo quien tiene el permiso de gestión puede **quitar** el filtro de equipo.

### 1.3 Métricas
- Se agregan 4 tarjetas: Empleados en el ranking, Unidades totales, Puntos totales, **Variación vs. periodo anterior (%)** (mismo rango de días, periodo inmediatamente anterior).
- Estas tarjetas requieren el permiso `productions.ranking.stats.view` — sin él, el usuario ve solo la lista, no las métricas agregadas de la empresa.

### 1.4 Exportar
- Botón "Exportar CSV" arriba a la derecha, visible solo con `productions.ranking.export`.

### 1.5 Lista
- Se mantiene una sola lista ordenada (sin bloque de podio aparte), con medalla en los 3 primeros, barra de progreso, puntos, unidades y variación % individual vs. periodo anterior.

---

## 2. Backend

### 2.1 Migración — filtro de equipo por empresa
Nueva tabla `production_ranking_team_filters`:

| Columna | Tipo | Nota |
| --- | --- | --- |
| `company_id` | FK, único | un filtro activo por empresa |
| `date_start` | date | |
| `date_end` | date | |
| `set_by_user_id` | FK users | quién lo fijó |
| `updated_at` | timestamp | se muestra como "fijado el…" si se quiere |

`ProductionController::ranking()` debe:
1. Cargar el filtro de equipo de la empresa (si existe) y enviarlo como prop `teamFilter`.
2. Si la request no trae `start`/`end` explícitos, usar el filtro de equipo como valor inicial (no forzarlo si el usuario ya trae los suyos en la URL).
3. Aceptar y aplicar los nuevos parámetros `reference_id` y `shift` en `ProductionReportService::rankingByEmployee()`.
4. Calcular y devolver el periodo anterior equivalente (mismo número de días, inmediatamente antes de `date_start`) para la variación %.

Endpoints nuevos:
- `POST /productions/ranking/team-filter` → guarda/actualiza el filtro de equipo (requiere `productions.ranking.filter_team.manage`).
- `DELETE /productions/ranking/team-filter` → lo quita (mismo permiso).

### 2.2 Permisos nuevos

| Permiso | Qué habilita | Por defecto |
| --- | --- | --- |
| `productions.ranking.view` | Ver el módulo (ya existe) | — |
| `productions.ranking.stats.view` | Ver las 4 tarjetas de métricas agregadas | Solo Super Admin / Admin de empresa |
| `productions.ranking.export` | Botón "Exportar CSV" | Solo Super Admin / Admin de empresa |
| `productions.ranking.filter_team.manage` | Fijar, cambiar o quitar el filtro de equipo (banner visible a todos) | Solo Super Admin / Admin de empresa |
| `productions.ranking.filter_own.manage` | Ajustar el filtro personal (fechas, referencia, turno, solo confirmadas) por fuera del de equipo | Todos los que tienen `.view`; si se le quita a un rol, ese usuario queda fijo en el filtro de equipo (o en el rango por defecto si no hay uno) sin poder tocarlo |

Agregar las 4 filas en `PermissionHelper.php` bajo el bloque `ranking` (junto a la que ya existe), en `CompanyDefaultRolesService.php` (solo Super Admin/Admin heredan las 3 restrictivas por defecto) y en `resources/js/lib/permissions.ts` / `navigation.ts` si el frontend necesita comprobarlas fuera de `<Can>`.

### 2.3 Reglas de conflicto
- Si un usuario tiene `filter_team.manage` pero no `filter_own.manage`, igual puede fijar el filtro de equipo (eso no es "su" filtro, es el de todos); solo no puede desviarse del de equipo para sí mismo.
- Si no hay filtro de equipo y el usuario no tiene `filter_own.manage`, el ranking usa el rango por defecto (quincena actual) sin panel de filtros editable — se le oculta el botón "Más filtros" y los rangos rápidos, dejando solo la lista.

---

## 3. Frontend

Archivos a intervenir:

| Archivo | Qué se hace |
| --- | --- |
| `resources/js/Pages/Productions/Ranking.tsx` | Reescribir sobre la maqueta: filtros, banner de equipo, métricas, lista |
| `resources/js/Components/Productions/ProductionFilterBar.tsx` | Extender u envolver para el caso ranking (agrega rango "Quincena", quita empleado/estado, añade el toggle de equipo) |
| `app/Http/Controllers/ProductionController.php` | `ranking()` + 2 endpoints nuevos de filtro de equipo |
| `app/Services/ProductionReportService.php` | `rankingByEmployee()` acepta `reference_id`, `shift`; nuevo método para el periodo anterior |
| `app/Helpers/PermissionHelper.php` | 3 permisos nuevos bajo `ranking` |
| `app/Services/CompanyDefaultRolesService.php` | asignación por defecto a Super Admin/Admin |
| `database/migrations/` | tabla `production_ranking_team_filters` |
| `resources/js/lib/permissions.ts` | claves nuevas si se consumen fuera de `<Can>` |

Usar `<Can permission="productions.ranking.export">`, `<Can permission="productions.ranking.stats.view">` y `<Can permission="productions.ranking.filter_team.manage">` para condicionar botón de exportar, tarjetas de métricas y el toggle "Aplicar a todos", respectivamente — igual patrón que el resto del módulo de Producción.

---

## 4. Aceptación

- Un usuario sin `stats.view` no ve las 4 tarjetas (la lista se acomoda ocupando ese espacio).
- Un usuario sin `export` no ve el botón exportar.
- Un usuario sin `filter_team.manage` no ve el toggle "Aplicar a todos"; si hay un filtro de equipo activo, lo ve como banner pero sin opción de quitarlo.
- Un usuario sin `filter_own.manage` no puede cambiar fechas/referencia/turno; el filtro de equipo (o el rango por defecto) queda fijo para él.
- Al fijar un filtro de equipo, otro usuario que abre la pestaña ve el mismo rango y el banner, sin recargar nada manual.
