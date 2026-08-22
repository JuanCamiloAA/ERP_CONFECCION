<?php

namespace App\Http\Controllers;

use App\Contracts\ObjectStorageInterface;
use App\Http\Requests\Reference\StoreReferenceRequest;
use App\Http\Requests\Reference\UpdateReferenceRequest;
use App\Models\Operation;
use App\Models\Production;
use App\Models\Reference;
use App\Services\Files\StoredFileDeleter;
use App\Services\References\ReferenceDifficultySync;
use App\Services\References\ReferenceExportData;
use App\Services\References\ReferenceXlsxExport;
use App\Support\OperationDifficulty;
use App\Support\ReferenceLotCompletion;
use App\Support\TenantContext;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\Response as HttpResponse;

class ReferenceController extends Controller
{
    /**
     * Tope de referencias por exportacion.
     *
     * Cada ficha trae su foto incrustada, asi que una seleccion enorme produce un archivo
     * que ni se descarga bien ni se abre comodo; es preferible decirlo que entregarlo.
     */
    public const EXPORT_MAX = 100;

    public function __construct(
        protected ObjectStorageInterface $objectStorage,
        protected StoredFileDeleter $storedFileDeleter,
    ) {}

    public function index(Request $request): Response
    {
        $search = trim((string) $request->input('search', ''));

        $query = Reference::query()
            ->withCount('operations')
            ->withCount('productions')
            ->withSum('productions', 'quantity');

        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                $q->where('code', 'like', "%{$search}%")
                    ->orWhere('name', 'like', "%{$search}%");
            });
        }

        $references = $query->orderBy('code')->paginate(15)->withQueryString();

        $ids = $references->getCollection()->pluck('id');
        if ($ids->isNotEmpty()) {
            // Produccion acumulada por operacion (una fila por referencia+operacion).
            $perOperation = Production::query()
                ->withoutGlobalScopes()
                ->selectRaw('reference_id, operation_id, SUM(quantity) as op_sum')
                ->whereIn('reference_id', $ids)
                ->groupBy('reference_id', 'operation_id')
                ->get()
                ->groupBy('reference_id');

            $references->getCollection()->each(function (Reference $ref) use ($perOperation) {
                $sums = $perOperation->get($ref->id) ?? collect();
                $lot = $ref->lot_total_quantity !== null ? (int) $ref->lot_total_quantity : null;

                $ref->setAttribute('productions_max_per_operation', (int) $sums->max('op_sum'));

                // Una operacion se considera completa cuando su produccion acumulada cubre
                // el lote. Sin lote definido no hay meta contra la cual compararla.
                $ref->setAttribute(
                    'operations_completed_count',
                    $lot !== null && $lot > 0
                        ? $sums->filter(fn ($row) => (int) $row->op_sum >= $lot)->count()
                        : 0
                );
            });
        }

        return Inertia::render('References/Index', [
            'references' => $references,
            'filters' => ['search' => $search],
        ]);
    }

    /**
     * Descarga en Excel la ficha completa de las referencias seleccionadas.
     */
    public function exportExcel(Request $request, ReferenceXlsxExport $export): HttpResponse|RedirectResponse
    {
        $references = $this->exportSelection($request);

        if ($references instanceof RedirectResponse) {
            return $references;
        }

        return response($export->build($references), 200, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition' => 'attachment; filename="'.$export->filename($references).'"',
            // Un catalogo que cambia cada dia no debe quedar cacheado en el navegador.
            'Cache-Control' => 'no-store, no-cache, must-revalidate',
        ]);
    }

    /**
     * Version imprimible (PDF desde el navegador) de las referencias seleccionadas.
     *
     * Se sigue el mismo camino que la nomina: una pantalla pensada para papel que el
     * navegador convierte en PDF. Evita meter un motor de PDF al servidor y deja al
     * usuario elegir tamano, margenes y destino.
     */
    public function exportPdf(Request $request, ReferenceExportData $data): Response|RedirectResponse
    {
        $references = $this->exportSelection($request);

        if ($references instanceof RedirectResponse) {
            return $references;
        }

        return Inertia::render('References/Print', $data->build($references));
    }

    /**
     * Referencias que pide la exportacion: las marcadas o, sin marcar ninguna, todas las
     * que coinciden con la busqueda del listado.
     *
     * Activas e inactivas por igual —una referencia cerrada es justamente la que se
     * quiere archivar o cotizar de nuevo—; el unico filtro que queda es el de empresa,
     * que aplica el scope global.
     *
     * @return EloquentCollection<int, Reference>|RedirectResponse
     */
    protected function exportSelection(Request $request): EloquentCollection|RedirectResponse
    {
        $raw = $request->input('ids');
        $ids = collect(is_string($raw) ? explode(',', $raw) : (is_array($raw) ? $raw : []))
            ->map(fn ($id) => (int) $id)
            ->filter()
            ->unique()
            ->values();

        $query = Reference::query()->with(['operations', 'company']);

        if ($ids->isNotEmpty()) {
            $query->whereIn('id', $ids);
        } else {
            $search = trim((string) $request->input('search', ''));

            if ($search !== '') {
                $query->where(function ($q) use ($search) {
                    $q->where('code', 'like', "%{$search}%")
                        ->orWhere('name', 'like', "%{$search}%");
                });
            }
        }

        // Se pide uno mas que el tope para poder distinguir "justo el tope" de "se pasó".
        $references = $query->orderBy('code')->limit(self::EXPORT_MAX + 1)->get();

        if ($references->isEmpty()) {
            return back()->with('error', 'No hay referencias que exportar con esa selección.');
        }

        if ($references->count() > self::EXPORT_MAX) {
            return back()->with('error', sprintf(
                'Puedes exportar hasta %d referencias a la vez (cada ficha lleva su imagen). Afina la búsqueda o marca menos referencias.',
                self::EXPORT_MAX,
            ));
        }

        return $references;
    }

    public function create(): Response
    {
        return Inertia::render('References/Create', [
            'operations' => Operation::active()->orderBy('name')->get(['id', 'name', 'base_price', 'estimated_minutes', 'difficulty_level']),
        ]);
    }

    public function store(StoreReferenceRequest $request): RedirectResponse
    {
        $data = $request->validated();
        $user = $request->user();

        return DB::transaction(function () use ($request, $data, $user) {
            $lotQty = (int) $data['lot_total_quantity'];

            $reference = Reference::create([
                'company_id' => TenantContext::requireCompanyIdForWrite($user),
                'code' => $data['code'],
                'name' => $data['name'],
                'payment_per_unit' => $data['payment_per_unit'],
                'operational_cost_per_unit_fixed' => 0,
                'operational_lot_qty_at_cost_fix' => $lotQty,
                'description' => $data['description'] ?? null,
                'image' => null,
                'is_active' => $data['is_active'] ?? true,
                'lot_total_quantity' => $lotQty,
            ]);

            if ($request->hasFile('image')) {
                $uploaded = $this->objectStorage->upload(
                    $request->file('image'),
                    "companies/{$reference->company_id}/references/{$reference->id}"
                );
                $reference->update(['image' => $uploaded['path']]);
            }

            if (! empty($data['operations'])) {
                $thresholds = OperationDifficulty::thresholdsFor($reference->company);
                $sync = collect($data['operations'])->mapWithKeys(function ($row) use ($thresholds) {
                    $minutes = $row['estimated_minutes'] ?? null;

                    return [
                        $row['operation_id'] => [
                            'price' => $row['price'],
                            'estimated_minutes' => $minutes,
                            'difficulty_level' => $minutes !== null && $minutes !== ''
                                ? OperationDifficulty::levelFromMinutes((float) $minutes, $thresholds)
                                : null,
                            'is_active' => true,
                        ],
                    ];
                })->all();
                $reference->operations()->sync($sync);
            }

            // El costo sale siempre del detalle ya guardado, tambien al crear: un solo
            // lugar decide cuanto cuesta la unidad.
            $reference->refreshOperationalCost();

            return redirect()->route('references.show', $reference)->with('success', 'Referencia creada.');
        });
    }

    public function show(Reference $reference): Response
    {
        $reference->load(['operations', 'company']);
        $reference->loadSum('productions', 'quantity');

        $progress = $this->productionProgress($reference);
        $reference->setAttribute('productions_max_per_operation', $progress['max']);
        // La ficha mide el avance en operaciones completadas, igual que el listado; sin
        // esta cifra cada pantalla contaba una cosa distinta del mismo lote.
        $reference->setAttribute('operations_completed_count', $progress['completed']);

        return Inertia::render('References/Show', [
            'reference' => $reference,
            'comparison' => $this->buildEconomicsComparison($reference),
        ]);
    }

    public function edit(Reference $reference): Response
    {
        $reference->load(['operations', 'company']);

        return Inertia::render('References/Edit', [
            'reference' => $reference,
            'operations' => Operation::active()->orderBy('name')->get(['id', 'name', 'base_price', 'estimated_minutes', 'difficulty_level']),
            'comparison' => $this->buildEconomicsComparison($reference),
            'producedMax' => $this->productionProgress($reference)['max'],
        ]);
    }

    /**
     * Avance de una referencia, con las dos cifras que se miden contra el lote.
     *
     * - `max`: unidades producidas de la operacion mas avanzada. Es lo comparable contra
     *   el lote; `productions_sum_quantity` suma todas las operaciones, asi que una
     *   prenda de ocho pasos daria un 800% de avance.
     * - `completed`: cuantas operaciones ya cubren el lote completo. Mismo criterio que
     *   usa el listado (ver index), para que la ficha y la tabla no discrepen.
     *
     * @return array{max: int, completed: int}
     */
    protected function productionProgress(Reference $reference): array
    {
        $sums = Production::query()
            ->withoutGlobalScopes()
            ->where('reference_id', $reference->id)
            ->selectRaw('operation_id, SUM(quantity) as op_sum')
            ->groupBy('operation_id')
            ->pluck('op_sum');

        $lot = (int) ($reference->lot_total_quantity ?? 0);

        return [
            'max' => (int) $sums->max(),
            // Sin lote definido no hay meta contra la cual dar una operacion por completa.
            'completed' => $lot > 0 ? $sums->filter(fn ($sum) => (int) $sum >= $lot)->count() : 0,
        ];
    }

    public function update(UpdateReferenceRequest $request, Reference $reference): RedirectResponse
    {
        $data = $request->validated();

        // El detalle solo se toca si la peticion lo trae: cualquier otro consumidor del
        // endpoint sigue actualizando unicamente los datos de la referencia.
        $operations = $data['operations'] ?? null;
        unset($data['operations'], $data['image']);

        if ($request->hasFile('image')) {
            $this->storedFileDeleter->deleteIfPresent($reference->getAttributes()['image'] ?? null);
            $uploaded = $this->objectStorage->upload(
                $request->file('image'),
                "companies/{$reference->company_id}/references/{$reference->id}"
            );
            $data['image'] = $uploaded['path'];
        }

        if ($operations !== null) {
            $quitadas = $reference->referenceOperations()
                ->whereNotIn('operation_id', collect($operations)->pluck('operation_id')->all())
                ->pluck('operation_id');

            // Quitar una linea ya producida dejaria producciones apuntando a un detalle
            // que no existe, y con el la trazabilidad de lo que se pago.
            if ($quitadas->isNotEmpty()) {
                $conProduccion = Production::query()->withoutGlobalScopes()
                    ->where('reference_id', $reference->id)
                    ->whereIn('operation_id', $quitadas)
                    ->pluck('operation_id')
                    ->unique();

                if ($conProduccion->isNotEmpty()) {
                    $nombres = Operation::query()->withoutGlobalScopes()
                        ->whereIn('id', $conProduccion)
                        ->pluck('name')
                        ->implode(', ');

                    throw ValidationException::withMessages([
                        'operations' => "No puedes quitar operaciones con produccion registrada: {$nombres}.",
                    ]);
                }
            }
        }

        DB::transaction(function () use ($reference, $data, $operations) {
            $reference->update($data);

            if ($operations !== null) {
                $thresholds = OperationDifficulty::thresholdsFor($reference->company);

                // El estado activo es del detalle, no del formulario: una linea cerrada por
                // lote completo o inactivada a mano no debe reactivarse al guardar.
                $activasPrevias = $reference->referenceOperations()
                    ->pluck('is_active', 'operation_id');

                $sync = collect($operations)->mapWithKeys(function ($row) use ($thresholds, $activasPrevias) {
                    $minutes = $row['estimated_minutes'] ?? null;

                    return [
                        $row['operation_id'] => [
                            'price' => $row['price'],
                            'estimated_minutes' => $minutes,
                            'difficulty_level' => $minutes !== null && $minutes !== ''
                                ? OperationDifficulty::levelFromMinutes((float) $minutes, $thresholds)
                                : null,
                            'is_active' => (bool) ($activasPrevias[$row['operation_id']] ?? true),
                        ],
                    ];
                })->all();

                $reference->operations()->sync($sync);
            }

            $reference->refreshOperationalCost();
        });

        $reference->refresh();
        // Despues del costo: el cierre por lote depende del detalle ya sincronizado.
        ReferenceLotCompletion::sync((int) $reference->id);

        return redirect()->route('references.show', $reference)->with('success', 'Referencia actualizada.');
    }

    /**
     * Copia una referencia con su detalle de operaciones, lista para ajustar.
     *
     * No se copian ni la imagen —dos referencias apuntando al mismo archivo hacen que
     * borrar una deje a la otra sin imagen— ni las producciones, que son historia de la
     * referencia original.
     */
    public function duplicate(Request $request, Reference $reference): RedirectResponse
    {
        $user = $request->user();
        abort_if(! $user?->can('references.index.create') && ! $user?->isSuperAdmin(), 403);

        $copia = DB::transaction(function () use ($reference) {
            $copia = Reference::create([
                'company_id' => $reference->company_id,
                'code' => $this->availableCopyCode($reference),
                'name' => $reference->name,
                'payment_per_unit' => $reference->payment_per_unit,
                'description' => $reference->description,
                'lot_total_quantity' => $reference->lot_total_quantity,
                'is_active' => $reference->is_active,
                'image' => null,
                'operational_cost_per_unit_fixed' => 0,
                'operational_lot_qty_at_cost_fix' => $reference->lot_total_quantity,
            ]);

            $sync = $reference->referenceOperations->mapWithKeys(fn ($linea) => [
                $linea->operation_id => [
                    'price' => $linea->price,
                    'estimated_minutes' => $linea->estimated_minutes,
                    'difficulty_level' => $linea->difficulty_level,
                    'is_active' => $linea->is_active,
                ],
            ])->all();

            if ($sync !== []) {
                $copia->operations()->sync($sync);
            }

            $copia->refreshOperationalCost();

            return $copia;
        });

        return redirect()->route('references.edit', $copia)->with('success', 'Referencia duplicada. Revisa el codigo.');
    }

    /**
     * Primer «-COPIA» libre dentro de la empresa; el codigo es unico por empresa.
     */
    protected function availableCopyCode(Reference $reference): string
    {
        $base = $reference->code.'-COPIA';
        $candidato = $base;
        $n = 1;

        while (Reference::query()->withoutGlobalScopes()
            ->where('company_id', $reference->company_id)
            ->whereNull('deleted_at')
            ->where('code', $candidato)
            ->exists()) {
            $n++;
            $candidato = $base.'-'.$n;
        }

        return mb_substr($candidato, 0, 50);
    }

    public function destroy(Reference $reference): RedirectResponse
    {
        // Antes dependia de lo que hiciera la llave foranea: mejor un mensaje que un 500.
        $producidas = Production::query()->withoutGlobalScopes()
            ->where('reference_id', $reference->id)
            ->exists();

        if ($producidas) {
            return back()->with('error', 'No puedes eliminar una referencia con produccion registrada.');
        }

        $reference->delete();

        return redirect()->route('references.index')->with('success', 'Referencia eliminada.');
    }

    /**
     * @return array{
     *     payment_per_unit: float,
     *     production_cost_per_unit: float,
     *     margin_per_unit: float,
     *     has_operations: bool,
     *     payment_per_unit_incomplete: bool,
     *     currency: string,
     *     operational_lot_qty: int,
     *     total_operational: float
     * }
     */
    protected function buildEconomicsComparison(Reference $reference): array
    {
        $reference->loadMissing('company');

        $hasOperations = $reference->referenceOperations()->exists();
        $payment = (float) ($reference->payment_per_unit ?? 0);
        $cost = $reference->productionCostPerUnit();
        $settings = $reference->company?->settings ?? [];
        $currency = is_array($settings) ? (string) ($settings['currency'] ?? 'COP') : 'COP';
        $paymentMissing = ($reference->getAttributes()['payment_per_unit'] ?? null) === null;
        // Lote vigente, no el declarado al crear: el costo unitario ya es un valor vivo,
        // asi que el total tiene que acompanarlo o la tarjeta se contradice sola.
        $lot = (int) ($reference->lot_total_quantity ?? 0);
        $totalOperational = round($cost * $lot, 2);

        return [
            'payment_per_unit' => $payment,
            'production_cost_per_unit' => $cost,
            'margin_per_unit' => round($payment - $cost, 2),
            'has_operations' => $hasOperations,
            'payment_per_unit_incomplete' => $paymentMissing,
            'currency' => $currency,
            'operational_lot_qty' => $lot,
            'total_operational' => $totalOperational,
        ];
    }

    public function attachOperation(Request $request, Reference $reference): RedirectResponse
    {
        $request->validate([
            'operation_id' => ['required', 'integer', 'exists:operations,id'],
            'price' => ['required', 'numeric', 'min:0'],
            'estimated_minutes' => ['nullable', 'numeric', 'min:0.01', 'max:9999.99'],
        ]);

        $minutes = $request->input('estimated_minutes');
        $difficultyLevel = null;
        if ($minutes !== null && $minutes !== '') {
            $thresholds = OperationDifficulty::thresholdsFor($reference->company);
            $difficultyLevel = OperationDifficulty::levelFromMinutes((float) $minutes, $thresholds);
        }

        $reference->operations()->syncWithoutDetaching([
            $request->input('operation_id') => [
                'price' => $request->input('price'),
                'estimated_minutes' => $minutes,
                'difficulty_level' => $difficultyLevel,
                'is_active' => true,
            ],
        ]);

        $reference->refreshOperationalCost();

        return back()->with('success', 'Operacion asociada.');
    }

    public function updateOperationPrice(Request $request, Reference $reference, Operation $operation): RedirectResponse
    {
        $request->validate([
            'price' => ['required', 'numeric', 'min:0'],
            'estimated_minutes' => ['nullable', 'numeric', 'min:0.01', 'max:9999.99'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $minutes = $request->input('estimated_minutes');
        $difficultyLevel = null;
        if ($minutes !== null && $minutes !== '') {
            $thresholds = OperationDifficulty::thresholdsFor($reference->company);
            $difficultyLevel = OperationDifficulty::levelFromMinutes((float) $minutes, $thresholds);
        }

        $reference->operations()->updateExistingPivot($operation->id, [
            'price' => $request->input('price'),
            'estimated_minutes' => $minutes,
            'difficulty_level' => $difficultyLevel,
            'is_active' => (bool) $request->input('is_active', true),
        ]);

        $reference->refreshOperationalCost();

        return back()->with('success', 'Precio actualizado.');
    }

    public function detachOperation(Reference $reference, Operation $operation): RedirectResponse
    {
        $reference->operations()->detach($operation->id);
        $reference->refreshOperationalCost();

        return back()->with('success', 'Operacion desasociada.');
    }

    /**
     * Reaplica los rangos de dificultad de Mi empresa a las lineas de una referencia.
     */
    public function recalculateDifficulties(Reference $reference, ReferenceDifficultySync $sync): RedirectResponse
    {
        return back()->with('success', $this->difficultyMessage($sync->forReference($reference)));
    }

    /**
     * Lo mismo, pero para todas las referencias de la empresa activa.
     */
    public function recalculateAllDifficulties(ReferenceDifficultySync $sync): RedirectResponse
    {
        $result = $sync->forAllReferences();

        return back()->with('success', sprintf(
            '%s (%d referencias)',
            $this->difficultyMessage($result),
            $result['references']
        ));
    }

    /**
     * @param  array{lines: int, changed: int, without_minutes: int}  $result
     */
    private function difficultyMessage(array $result): string
    {
        if ($result['lines'] === 0) {
            return 'No hay operaciones asociadas para recalcular.';
        }

        $message = $result['changed'] === 0
            ? sprintf('Las %d lineas ya estaban al dia.', $result['lines'])
            : sprintf('%d de %d lineas actualizaron su dificultad.', $result['changed'], $result['lines']);

        if ($result['without_minutes'] > 0) {
            $message .= sprintf(' %d sin minutos definidos quedaron sin grado.', $result['without_minutes']);
        }

        return $message;
    }
}
