# AJUSTE — Referencias: crear Operación desde un modal dentro del formulario de creación
## Prompt para Claude — Implementación incremental sin romper lo ya desarrollado

---

> **USO:** El proyecto (Taller confección, Laravel 12, Inertia, React/TS, módulo de referencias con operaciones vía `reference_operations`) **ya existe**. Pega este documento completo en una sesión de Claude Code / Claude Opus dentro del repo. Implementa **únicamente** lo aquí descrito. No alterar el flujo actual de `Operations/Create.tsx`, `Operations/Index.tsx`, `Operations/Edit.tsx`, `OperationController`, `ReferenceController`, permisos existentes, ni el resto de la lógica de creación/edición de referencias salvo lo estrictamente necesario para esta funcionalidad.

---

## 0. OBJETIVO DE NEGOCIO

En [resources/js/Pages/References/Create.tsx](resources/js/Pages/References/Create.tsx) hoy existe una sección "Operaciones de la referencia" con un `Select` que solo permite elegir **operaciones ya existentes** (prop `operations` que llega del backend en `ReferenceController::create()`), un input de precio y un botón "Agregar" que empuja la fila a la tabla local `refOperations`.

Se requiere agregar, junto a ese selector, un botón **"Nueva operación"** que:

1. Abra un **modal** (no navegación de página) con el mismo formulario que hoy existe en `Operations/Create.tsx` (nombre, descripción, precio base, activa).
2. Al enviarse y crearse la operación correctamente en backend, **cierre el modal automáticamente**.
3. La operación recién creada debe quedar **agregada al listado de operaciones de la referencia** (`refOperations`) sin que el usuario tenga que repetir el paso de "seleccionar + Agregar".
4. El usuario debe poder **seguir agregando más operaciones** (ya existentes, incluida la que se acaba de crear si la quita y quiere reagregarla) **sin perder** ningún dato ya digitado en el formulario principal de la referencia (código, nombre, valor de pago, cantidad de lote, descripción, imagen, etc.).

**Restricción dura:** cero regresiones. La página independiente de creación de operaciones (`/operations/create`), su controlador y su validación deben seguir funcionando exactamente igual que hoy.

---

## 1. POR QUÉ NO SE PUEDE USAR EL FLUJO ACTUAL DE INERTIA TAL CUAL

`Operations/Create.tsx` usa `useForm(...).post(route('operations.store'))`, y `OperationController::store()` siempre responde con `redirect()->route('operations.index')`. Si se reutiliza ese mismo `post` de Inertia dentro del modal, al enviarse el formulario Inertia hará una **visita de página completa** y navegará a `/operations`, perdiendo todo lo digitado en el formulario de la referencia que está a medio llenar. Esto **no es aceptable**.

**Solución:** la petición de creación de operación desde el modal debe hacerse con `axios` (ya usado directamente en el proyecto, ver [resources/js/Components/Productions/WorkDayBanner.tsx](resources/js/Components/Productions/WorkDayBanner.tsx)) contra la misma ruta `operations.store`, pidiendo JSON, **sin** disparar una visita de Inertia. Ejemplo:

```ts
import axios from 'axios';

const res = await axios.post(route('operations.store'), payload, {
    headers: { Accept: 'application/json' },
});
```

En el backend, `OperationController::store()` debe **añadir** (sin quitar el comportamiento actual) una rama para responder JSON cuando la petición lo pide, dejando intacto el redirect para el flujo normal de página:

```php
public function store(StoreOperationRequest $request): RedirectResponse|JsonResponse
{
    $data = $request->validated();
    $data['company_id'] = TenantContext::requireCompanyIdForWrite($request->user());
    $data['is_active'] = $data['is_active'] ?? true;

    $operation = Operation::create($data);

    if ($request->wantsJson()) {
        return response()->json($operation);
    }

    return redirect()->route('operations.index')->with('success', 'Operacion creada.');
}
```

- Ajustar el tipo de retorno del método (`RedirectResponse|JsonResponse`) e importar `Illuminate\Http\JsonResponse`.
- Los errores de validación (422) de `StoreOperationRequest` ya son manejados automáticamente por Laravel devolviendo JSON cuando la petición pide `Accept: application/json`; no requiere cambios adicionales en el Form Request.
- El permiso de autorización de `StoreOperationRequest::authorize()` (`operations.index.create`) sigue aplicando igual para ambos flujos — no tocar.

---

## 2. FRONTEND — NUEVO COMPONENTE DE MODAL

Crear `resources/js/Components/Operations/OperationQuickCreateModal.tsx` (carpeta `Operations` nueva bajo `Components/`, seguir convención de `resources/js/Components/References/ReferenceUnitEconomicsCard.tsx`).

**Reutilizar:**
- `Modal` de [resources/js/Components/UI/Modal.tsx](resources/js/Components/UI/Modal.tsx) (ya soporta `open`, `onClose`, `title`, `footer`).
- Los mismos campos/inputs que [resources/js/Pages/Operations/Create.tsx](resources/js/Pages/Operations/Create.tsx): `Input` (nombre, precio base con `prefix="$"`), `Textarea` (descripción), `Switch` (activa).

**Props sugeridas:**

```ts
interface OperationQuickCreateModalProps {
    open: boolean;
    onClose: () => void;
    onCreated: (operation: { id: number; name: string; base_price: string | number; description: string | null; is_active: boolean }) => void;
}
```

**Comportamiento interno:**
- Estado local propio (`name`, `description`, `base_price`, `is_active`) — no usar `useForm` de Inertia para evitar acoplarse a una visita de página.
- Estado de `processing` (booleano) y `errors` (`Record<string, string>`) poblado manualmente a partir de la respuesta 422 de axios (`error.response?.data?.errors`).
- Al enviar (`onSubmit`): `axios.post(route('operations.store'), data, { headers: { Accept: 'application/json' } })`.
  - Éxito: limpiar el formulario interno, llamar `onCreated(operationCreada)` y luego `onClose()`.
  - Error 422: mapear `error.response.data.errors` (formato estándar Laravel: `{ campo: string[] }`) a `{ campo: string }` para mostrarlos bajo cada input, igual que en `Operations/Create.tsx`.
  - Cualquier otro error: mostrar un mensaje genérico (usar `toast.error` de `sonner`, ya usado en el proyecto — ver `Employees/Create.tsx`).
- Botón "Cancelar" cierra el modal sin crear nada (`onClose`), botón "Guardar" hace submit con `loading={processing}` como en el resto del proyecto (prop `loading` de `Button`).

---

## 3. FRONTEND — INTEGRACIÓN EN `References/Create.tsx`

Archivo: [resources/js/Pages/References/Create.tsx](resources/js/Pages/References/Create.tsx)

1. **Convertir `operations` (prop) en estado local**, para poder agregarle la operación recién creada:
   ```ts
   const [availableOperations, setAvailableOperations] = useState<OperationOption[]>(operations);
   ```
   Sustituir los usos de `operations` dentro del componente (el `.filter(...)` del `Select` y el `.find(...)` de `addOperation`) por `availableOperations`.

2. **Estado del modal:**
   ```ts
   const [showOperationModal, setShowOperationModal] = useState(false);
   ```

3. **Botón nuevo**, junto al `Select` de operación existente (mismo grid `md:grid-cols-[1fr_200px_auto]`, agregar una cuarta columna o colocarlo debajo del grid, decisión de UI libre pero debe quedar visualmente asociado a la sección "Operaciones de la referencia"):
   ```tsx
   <Button type="button" variant="secondary" icon={<PlusIcon className="h-4 w-4" />} onClick={() => setShowOperationModal(true)}>
       Nueva operación
   </Button>
   ```
   Envolver el botón (o toda la sección de creación rápida) en `<Can permission="operations.index.create">...</Can>` (componente ya existente en `resources/js/Components/UI/Can.tsx`, mismo patrón usado en `Employees/Create.tsx` y `Banks/Index.tsx`) para que solo se muestre a usuarios con permiso de crear operaciones.

4. **Handler `onCreated`:** al crearse la operación desde el modal:
   ```ts
   const handleOperationCreated = (op: OperationOption) => {
       setAvailableOperations((prev) => [...prev, op].sort((a, b) => a.name.localeCompare(b.name)));
       setRefOperations((prev) => [...prev, { operation_id: op.id, name: op.name, price: Number(op.base_price) }]);
       setShowOperationModal(false);
   };
   ```
   Esto cumple el requisito "que inmediatamente sea creada se cierre la modal y me permita agregarla al listado de la referencia": la operación queda añadida directamente a la tabla `refOperations` con su `base_price`, visible de inmediato en la tabla que ya existe (líneas ~171-196 del archivo), y el usuario puede seguir usando el flujo normal (`Select` + "Agregar") para sumar más operaciones ya existentes — incluida la recién creada si la llega a quitar con el botón de la papelera.

5. Renderizar el modal al final del `<form>` (o fuera de él pero dentro del layout, `Modal` ya maneja su propio `Dialog`/overlay vía `@headlessui/react`, no necesita estar dentro del `<form>`):
   ```tsx
   <OperationQuickCreateModal
       open={showOperationModal}
       onClose={() => setShowOperationModal(false)}
       onCreated={handleOperationCreated}
   />
   ```

**No tocar:** el `submit` del formulario de referencia, el payload enviado a `references.store`, ni `StoreReferenceRequest` — la operación recién creada ya es una operación real en BD (con `id`), así que viaja en `operations` del payload exactamente igual que cualquier otra operación seleccionada del listado.

---

## 4. BACKEND — CAMBIO MÍNIMO

Único archivo a modificar: [app/Http/Controllers/OperationController.php](app/Http/Controllers/OperationController.php), método `store()` (ver sección 1). No se requieren cambios en:
- `StoreOperationRequest` (la autorización y las reglas de validación sirven igual para ambos flujos).
- `ReferenceController` (no participa en la creación de la operación).
- Rutas (`routes/web.php`) — se reutiliza la ruta `operations.store` ya existente (`POST /operations`), no crear una ruta nueva.

---

## 5. PERMISOS

- Mostrar el botón "Nueva operación" solo si el usuario tiene `operations.index.create` (usar `<Can permission="operations.index.create">`, contexto ya disponible vía `resources/js/contexts/PermissionsContext.tsx`).
- El backend ya rechaza la creación si el usuario no tiene el permiso (`StoreOperationRequest::authorize()`), así que aunque el botón esté oculto, la protección real sigue en el servidor.

---

## 6. PRUEBAS MANUALES (CHECKLIST)

- [ ] En `/references/create`, llenar parcialmente el formulario principal (código, nombre, etc.), abrir el modal, crear una operación válida: el modal se cierra solo, la operación aparece en la tabla de "Operaciones de la referencia" con su precio base, y **los datos ya digitados en el formulario principal siguen intactos**.
- [ ] Repetir el flujo agregando además una operación ya existente con el `Select` normal: ambas conviven en la tabla sin duplicados.
- [ ] Enviar el formulario de referencia completo: la referencia se crea con todas las operaciones (creada por modal + preexistentes) asociadas con su precio correcto en `reference_operations`.
- [ ] Probar validación: intentar crear una operación con nombre duplicado o vacío desde el modal — debe mostrar el error inline **sin cerrar el modal ni navegar**.
- [ ] Confirmar que `/operations/create` (página independiente) sigue funcionando igual que antes (crea y redirige a `/operations`).
- [ ] Confirmar que un usuario sin permiso `operations.index.create` no ve el botón "Nueva operación" en `/references/create`, y que si se fuerza la petición al backend igual es rechazada (403).
- [ ] `npm run build` sin errores de TypeScript.

---

## 7. ORDEN DE IMPLEMENTACIÓN

1. Backend: rama JSON en `OperationController::store()`.
2. Frontend: `OperationQuickCreateModal.tsx` nuevo componente.
3. Frontend: integrar en `References/Create.tsx` (estado local de `operations`, botón, handler, render del modal).
4. Pruebas manuales del checklist.

---

## 8. INSTRUCCIÓN FINAL

Implementa de forma incremental y **no** modifiques archivos fuera del alcance descrito (`OperationController.php`, `References/Create.tsx`, y el nuevo `OperationQuickCreateModal.tsx`). Si algún nombre de componente UI (`Input`, `Select`, `Switch`, `Button`, `Textarea`) difiere ligeramente en props respecto a lo asumido aquí, ajusta a la firma real ya presente en el código, manteniendo la semántica descrita. Al terminar, entrega la lista de archivos modificados/creados y corre:

```bash
npm run build
```

---

*Documento: Referencias — modal de creación rápida de operaciones — Julio 2026*
