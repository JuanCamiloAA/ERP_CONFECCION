<?php

namespace App\Http\Controllers;

use App\Helpers\PermissionHelper;
use App\Http\Requests\Production\StoreProductionRequest;
use App\Http\Requests\Production\UpdateProductionRequest;
use App\Models\Company;
use App\Models\Employee;
use App\Models\Operation;
use App\Models\Payroll;
use App\Models\Production;
use App\Models\ProductionRankingTeamFilter;
use App\Models\Reference;
use App\Models\Scopes\CompanyScope;
use App\Models\User;
use App\Services\Productions\ProductionRankingExport;
use App\Services\ProductionReportService;
use App\Services\WorkDaySessionService;
use App\Support\TenantContext;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response as HttpResponse;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Inertia\Inertia;
use Inertia\Response;
use League\Csv\Bom;
use League\Csv\Writer;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ProductionController extends Controller
{
    /** Turnos que acepta el filtro del ranking; cualquier otro valor se ignora. */
    protected const RANKING_SHIFTS = ['manana', 'tarde', 'noche'];

    public function index(Request $request): Response
    {
        $user = $request->user();

        $query = Production::query()->with([
            'employee:id,first_name,last_name',
            'reference:id,code,name',
            'operation:id,name',
            'company:id,name',
        ]);

        $this->applyEmployeeRestriction($query, $user);
        $filters = $this->applyIndexFilters($query, $request);

        /** Mismo filtro que el listado, sin eager/limit/order: evita fromSub + scope (rompe el SQL) y evita clonar tras paginate(). */
        $totalsRow = (clone $query)
            ->withoutEagerLoads()
            ->reorder()
            // `pending_count` sale de la misma consulta que el resto: contarlo sobre la
            // pagina daria «3 por confirmar» cuando hay treinta en el filtro.
            ->selectRaw('
                SUM(quantity) as total_quantity,
                SUM(total_value) as total_value,
                SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as pending_count
            ', [Production::STATUS_PENDING])
            ->first();

        $productions = $query->orderByDesc('date')->orderByDesc('id')->paginate(20)->withQueryString();

        $workerMode = $user->isRestrictedProductionAccount();

        $referencesWithOperations = null;
        if ($workerMode) {
            $referencesWithOperations = $this->referencesForProductionForm();
        }

        $lockedEmployee = null;
        if ($workerMode && $user->employee_id) {
            $user->loadMissing('employee');
            $lockedEmployee = [
                'id' => $user->employee_id,
                'name' => $user->employee?->full_name ?? '',
                'payroll_mode' => $user->employee?->payroll_mode ?? Employee::PAYROLL_MODE_OPERATIONS,
            ];
        }

        $workDayBanner = null;
        $workDaySelectableEmployees = collect();

        if ($workerMode && $user->employee_id) {
            $emp = Employee::query()->find($user->employee_id);
            if ($emp?->usesWorkDaySessions()) {
                $svc = app(WorkDaySessionService::class);
                $st = $svc->getTodayState($emp);
                $workDayBanner = array_merge($st, [
                    'mode' => 'self',
                    'employee_id' => $emp->id,
                ]);
            }
        } elseif ($user->can('productions.index.workday_start')) {
            $workDaySelectableEmployees = Employee::query()
                ->active()
                ->whereIn('payroll_mode', [Employee::PAYROLL_MODE_FIXED_DAILY, Employee::PAYROLL_MODE_HOURLY_LEGAL])
                ->orderBy('first_name')
                ->orderBy('last_name')
                ->get(['id', 'first_name', 'last_name']);
        }

        return Inertia::render('Productions/Index', [
            'productions' => $productions,
            'filters' => $filters,
            'totals' => [
                'total_quantity' => (int) ($totalsRow->total_quantity ?? 0),
                'total_value' => (float) ($totalsRow->total_value ?? 0),
                'pending_count' => (int) ($totalsRow->pending_count ?? 0),
            ],
            'employees' => $workerMode ? [] : $this->employeesList(),
            'references' => Reference::active()->orderBy('code')->get(['id', 'code', 'name']),
            'operations' => Operation::active()->orderBy('name')->get(['id', 'name']),
            'workerMode' => $workerMode,
            'lockedEmployee' => $lockedEmployee,
            'referencesWithOperations' => $referencesWithOperations ?? [],
            'workDayBanner' => $workDayBanner,
            'workDaySelectableEmployees' => $workDaySelectableEmployees,
        ]);
    }

    public function create(Request $request): Response|RedirectResponse
    {
        if ($request->user()?->isRestrictedProductionAccount()) {
            return redirect()->route('productions.index');
        }

        $workDaySelectableEmployees = Employee::query()
            ->active()
            ->whereIn('payroll_mode', [Employee::PAYROLL_MODE_FIXED_DAILY, Employee::PAYROLL_MODE_HOURLY_LEGAL])
            ->orderBy('first_name')
            ->orderBy('last_name')
            ->get(['id', 'first_name', 'last_name']);

        return Inertia::render('Productions/Create', [
            'employees' => $this->employeesList(),
            'references' => $this->referencesForProductionForm(),
            'workDaySelectableEmployees' => $workDaySelectableEmployees,
        ]);
    }

    public function store(StoreProductionRequest $request): RedirectResponse
    {
        $user = $request->user();
        $data = $request->validated();

        $unitPrice = $this->resolveUnitPriceForSave($user, $data);

        $companyId = TenantContext::requireCompanyIdForWrite($user);

        Production::create([
            'company_id' => $companyId,
            'employee_id' => $data['employee_id'],
            'reference_id' => $data['reference_id'],
            'operation_id' => $data['operation_id'],
            'quantity' => $data['quantity'],
            'unit_price' => $unitPrice,
            'date' => $data['date'],
            'status' => $user->isRestrictedProductionAccount() ? Production::STATUS_PENDING : Production::STATUS_CONFIRMED,
            'shift' => $data['shift'],
            'notes' => $data['notes'] ?? null,
            'created_by' => $user->id,
        ]);

        return redirect()->route('productions.index')->with('success', 'Produccion registrada.');
    }

    public function edit(Request $request, Production $production): Response
    {
        return Inertia::render('Productions/Edit', [
            'production' => $production,
            'employees' => $this->employeesList(),
            'references' => $this->referencesForProductionForm($production),
            'priceLocked' => $request->user()?->isRestrictedProductionAccount() ?? false,
            'statusEditable' => ! ($request->user()?->isRestrictedProductionAccount() ?? false),
        ]);
    }

    public function update(UpdateProductionRequest $request, Production $production): RedirectResponse
    {
        // Igual que al eliminar: lo que ya se pago no se toca, o la nomina cerrada dejaria
        // de cuadrar con la produccion que la respalda.
        if ($production->isPaid()) {
            return redirect()
                ->route('productions.index')
                ->with('error', 'Esta produccion ya fue pagada en una nomina y no se puede modificar.');
        }

        $data = $request->validated();
        $user = $request->user();

        $unitPrice = $this->resolveUnitPriceForUpdate($user, $data, $production);

        $payload = array_merge($data, ['unit_price' => $unitPrice]);
        if ($user->isRestrictedProductionAccount()) {
            unset($payload['status']);
        }
        $production->update($payload);

        return redirect()->route('productions.index')->with('success', 'Produccion actualizada.');
    }

    public function destroy(Production $production): RedirectResponse
    {
        if (Payroll::paidPeriodCoversDate((int) $production->company_id, $production->date)) {
            return redirect()
                ->route('productions.index')
                ->with('error', 'No se puede eliminar produccion de un periodo de nomina ya pagado.');
        }

        $production->delete();

        return redirect()->route('productions.index')->with('success', 'Produccion eliminada.');
    }

    /**
     * Confirma un registro pendiente desde el listado.
     *
     * Confirmar era hasta ahora un efecto secundario de guardar el formulario completo de
     * edicion: para aprobar una cifra correcta habia que reenviar empleado, referencia,
     * operacion, cantidad y fecha, y volver a pasar por todas sus validaciones. Aqui solo
     * cambia el estado, que es lo unico que se quiso cambiar.
     */
    public function confirm(Request $request, Production $production): RedirectResponse
    {
        // Registrar y aprobar son cosas distintas: el operario hace lo primero.
        abort_if($request->user()?->isRestrictedProductionAccount(), 403);

        if ($production->status === Production::STATUS_PAID) {
            return back()->with('error', 'Este registro ya entro en una nomina pagada; su estado no se puede cambiar.');
        }

        if ($production->status === Production::STATUS_CONFIRMED) {
            return back()->with('warning', 'Este registro ya estaba confirmado.');
        }

        $production->update(['status' => Production::STATUS_CONFIRMED]);

        return back()->with('success', 'Registro confirmado.');
    }

    /**
     * Confirma de una vez los pendientes de un dia (y de un empleado, si el listado esta
     * filtrado por uno).
     *
     * Es la accion natural del cierre del dia: se revisa la jornada completa y se aprueba.
     * Registro por registro son treinta confirmaciones y treinta recargas.
     */
    public function confirmDay(Request $request): RedirectResponse
    {
        abort_if($request->user()?->isRestrictedProductionAccount(), 403);

        $data = $request->validate([
            'date' => ['required', 'date'],
            'employee_id' => ['nullable', 'integer', 'exists:employees,id'],
        ]);

        $query = Production::query()
            ->whereDate('date', $data['date'])
            ->where('status', Production::STATUS_PENDING);

        if (! empty($data['employee_id'])) {
            $query->where('employee_id', $data['employee_id']);
        }

        // Actualizacion en bloque: el estado no interviene en el cierre de lote (que suma
        // cantidades, ver ReferenceLotCompletion), asi que no hay observador que perder.
        $confirmed = $query->update(['status' => Production::STATUS_CONFIRMED]);

        if ($confirmed === 0) {
            return back()->with('warning', 'No quedaban registros pendientes en ese dia.');
        }

        return back()->with('success', $confirmed === 1
            ? 'Se confirmo 1 registro del dia.'
            : "Se confirmaron {$confirmed} registros del dia.");
    }

    /**
     * Descarga en CSV lo que muestra el listado, con el filtro aplicado.
     *
     * Sin limite de pagina: se exporta el filtro completo, que es justo lo que no cabe en
     * la pantalla. El BOM va porque Excel en Windows abre el CSV en la codificacion del
     * sistema y sin el rompe cada tilde.
     */
    public function export(Request $request): StreamedResponse
    {
        $user = $request->user();

        $query = Production::query()->with([
            'employee:id,first_name,last_name',
            'reference:id,code,name',
            'operation:id,name',
        ]);

        $this->applyEmployeeRestriction($query, $user);
        $this->applyIndexFilters($query, $request);

        $filename = 'produccion-'.now()->format('Ymd-Hi').'.csv';

        return response()->streamDownload(function () use ($query) {
            $writer = Writer::createFromStream(fopen('php://output', 'w'));
            $writer->setOutputBOM(Bom::Utf8);
            $writer->insertOne([
                'Fecha', 'Empleado', 'Referencia', 'Nombre referencia', 'Operacion',
                'Cantidad', 'Precio unitario', 'Valor', 'Turno', 'Estado', 'Observaciones',
            ]);

            // Por trozos: una exportacion de meses no tiene por que caber en memoria.
            $query->orderByDesc('date')->orderByDesc('id')->chunk(500, function ($rows) use ($writer) {
                foreach ($rows as $row) {
                    $writer->insertOne([
                        $row->date?->format('Y-m-d'),
                        trim(($row->employee?->first_name ?? '').' '.($row->employee?->last_name ?? '')),
                        $row->reference?->code,
                        $row->reference?->name,
                        $row->operation?->name,
                        (int) $row->quantity,
                        (float) $row->unit_price,
                        (float) $row->total_value,
                        $row->shift,
                        $row->status,
                        $row->notes,
                    ]);
                }
            });
        }, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Cache-Control' => 'no-store, no-cache, must-revalidate',
        ]);
    }

    public function report(Request $request, ProductionReportService $service): Response
    {
        $user = $request->user();
        $companyId = TenantContext::effectiveCompanyId($user);

        $start = $request->input('start', now()->startOfMonth()->toDateString());
        $end = $request->input('end', now()->endOfMonth()->toDateString());

        return Inertia::render('Productions/Report', [
            'filters' => ['start' => $start, 'end' => $end],
            'summary' => $service->summary($start, $end, $companyId),
            'byEmployee' => $service->byEmployee($start, $end, $companyId),
            'byReference' => $service->byReference($start, $end, $companyId),
            'byOperation' => $service->byOperation($start, $end, $companyId),
            'dailySeries' => $service->dailySeries($start, $end, $companyId),
        ]);
    }

    /**
     * Ranking de produccion.
     *
     * El rango que se pinta sale de tres sitios, en este orden: lo que trae la URL (si el
     * usuario puede ajustar su filtro), el filtro que un administrador fijo para toda la
     * empresa, y por ultimo la quincena en curso. Quien no puede ajustar el suyo se queda
     * en los dos ultimos, sin panel de filtros.
     */
    public function ranking(Request $request, ProductionReportService $service): Response
    {
        $user = $request->user();
        $companyId = TenantContext::effectiveCompanyId($user);

        $teamFilter = $this->rankingTeamFilter($companyId);
        $canFilterOwn = (bool) $user?->can(PermissionHelper::RANKING_OWN_FILTER_PERMISSION);

        $filters = $this->resolveRankingFilters($request, $teamFilter, $canFilterOwn);

        return Inertia::render('Productions/Ranking', [
            'filters' => $filters,
            'ranking' => $this->rankingRows($service, $filters, $companyId),
            'teamFilter' => $this->rankingTeamFilterPayload($teamFilter),
            'defaultRange' => $this->currentFortnight(),
            'previousPeriod' => $service->previousPeriod($filters['start'], $filters['end']),
            // Solo las referencias que se pueden elegir en el panel; el turno es fijo.
            'references' => Reference::active()->orderBy('code')->get(['id', 'code', 'name']),
        ]);
    }

    /**
     * Fija (o cambia) el filtro de fechas que ven todos los que abran el ranking.
     */
    public function storeRankingTeamFilter(Request $request): RedirectResponse
    {
        $companyId = TenantContext::requireCompanyIdForWrite($request->user());

        $data = $request->validate([
            'date_start' => ['required', 'date'],
            'date_end' => ['required', 'date', 'after_or_equal:date_start'],
        ], [
            'date_end.after_or_equal' => 'La fecha final no puede ser anterior a la inicial.',
        ]);

        ProductionRankingTeamFilter::withoutGlobalScope(CompanyScope::class)->updateOrCreate(
            ['company_id' => $companyId],
            [
                'date_start' => Carbon::parse($data['date_start'])->toDateString(),
                'date_end' => Carbon::parse($data['date_end'])->toDateString(),
                'set_by_user_id' => $request->user()?->id,
            ]
        );

        return back()->with('success', 'El filtro quedo fijado para todo el equipo.');
    }

    /**
     * Quita el filtro de equipo; cada quien vuelve a su propio rango.
     */
    public function destroyRankingTeamFilter(Request $request): RedirectResponse
    {
        $companyId = TenantContext::requireCompanyIdForWrite($request->user());

        $removed = ProductionRankingTeamFilter::withoutGlobalScope(CompanyScope::class)
            ->where('company_id', $companyId)
            ->delete();

        if ($removed === 0) {
            return back()->with('warning', 'No habia ningun filtro de equipo puesto.');
        }

        return back()->with('success', 'Se quito el filtro del equipo.');
    }

    /**
     * El mismo ranking que se ve en pantalla, en Excel.
     *
     * Los numeros salen como numeros —no como texto ya formateado— para que quien reciba
     * el archivo pueda sumar, ordenar y hacer tabla dinamica, igual que en Referencias.
     */
    public function exportRankingExcel(Request $request, ProductionReportService $service, ProductionRankingExport $export): HttpResponse
    {
        [$rows, $filters, $previous, $company, $referenceLabel] = $this->rankingExportPayload($request, $service);

        return $this->rankingDownload(
            $export->xlsx($rows, $filters, $previous, $company, $referenceLabel),
            $export->filename($filters, 'xlsx'),
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        );
    }

    /**
     * El mismo ranking, en Word: paginado y con el encabezado repetido, para imprimirlo o
     * pegarlo en un informe.
     */
    public function exportRankingWord(Request $request, ProductionReportService $service, ProductionRankingExport $export): HttpResponse
    {
        [$rows, $filters, $previous, $company, $referenceLabel] = $this->rankingExportPayload($request, $service);

        return $this->rankingDownload(
            $export->docx($rows, $filters, $previous, $company, $referenceLabel),
            $export->filename($filters, 'docx'),
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        );
    }

    /**
     * Lo que necesitan los dos formatos: las mismas filas, filtros y contexto que la
     * pantalla. Vive aparte para que el Excel y el Word no puedan divergir.
     *
     * @return array{0: list<array<string, mixed>>, 1: array<string, mixed>, 2: array{start: string, end: string}, 3: Company|null, 4: string|null}
     */
    protected function rankingExportPayload(Request $request, ProductionReportService $service): array
    {
        $user = $request->user();
        $companyId = TenantContext::effectiveCompanyId($user);

        $teamFilter = $this->rankingTeamFilter($companyId);
        $canFilterOwn = (bool) $user?->can(PermissionHelper::RANKING_OWN_FILTER_PERMISSION);

        $filters = $this->resolveRankingFilters($request, $teamFilter, $canFilterOwn);

        $reference = $filters['reference_id']
            ? Reference::query()->find($filters['reference_id'], ['id', 'code', 'name'])
            : null;

        return [
            $this->rankingRows($service, $filters, $companyId),
            $filters,
            $service->previousPeriod($filters['start'], $filters['end']),
            $companyId ? Company::query()->find($companyId) : null,
            $reference ? $reference->code.' - '.$reference->name : null,
        ];
    }

    protected function rankingDownload(string $bytes, string $filename, string $contentType): HttpResponse
    {
        return response($bytes, 200, [
            'Content-Type' => $contentType,
            'Content-Disposition' => 'attachment; filename="'.$filename.'"',
            // Un ranking cambia cada dia: no debe quedarse cacheado en el navegador.
            'Cache-Control' => 'no-store, no-cache, must-revalidate',
        ]);
    }

    /**
     * Filas del ranking con la variacion de cada empleado frente al periodo anterior.
     *
     * @param  array{start: string, end: string, only_confirmed: bool, reference_id: int|null, shift: string|null}  $filters
     * @return list<array<string, mixed>>
     */
    protected function rankingRows(ProductionReportService $service, array $filters, ?int $companyId): array
    {
        $current = $service->rankingByEmployee(
            $filters['start'],
            $filters['end'],
            $companyId,
            $filters['only_confirmed'],
            $filters['reference_id'],
            $filters['shift'],
        );

        $previous = $service->previousPeriod($filters['start'], $filters['end']);

        $previousPoints = $service->rankingByEmployee(
            $previous['start'],
            $previous['end'],
            $companyId,
            $filters['only_confirmed'],
            $filters['reference_id'],
            $filters['shift'],
        )->mapWithKeys(fn ($row) => [(int) $row->employee_id => (int) $row->total_points]);

        return $current
            ->values()
            ->map(function ($row, int $index) use ($previousPoints) {
                $points = (int) $row->total_points;
                $before = (int) ($previousPoints[(int) $row->employee_id] ?? 0);

                return [
                    'position' => $index + 1,
                    'employee_id' => (int) $row->employee_id,
                    'employee' => $row->employee ? [
                        'id' => $row->employee->id,
                        'full_name' => trim($row->employee->first_name.' '.$row->employee->last_name),
                        'document_number' => $row->employee->document_number,
                        'photo' => $row->employee->toArray()['photo'] ?? null,
                    ] : null,
                    'total_quantity' => (int) $row->total_quantity,
                    'total_value' => (float) $row->total_value,
                    'total_points' => $points,
                    'records' => (int) $row->records,
                    'previous_points' => $before,
                    'change_percent' => self::changePercent($points, $before),
                ];
            })
            ->all();
    }

    /**
     * Variacion porcentual entre dos periodos.
     *
     * Sin produccion antes no hay porcentaje que calcular —dividir por cero da «infinito»,
     * no «subio mucho»—: se devuelve null y la pantalla lo escribe como «nuevo».
     */
    protected static function changePercent(int $current, int $previous): ?float
    {
        if ($previous === 0) {
            return null;
        }

        return round((($current - $previous) / $previous) * 100, 1);
    }

    /**
     * Que rango y que filtros se aplican, segun lo que trae la URL y lo que puede el usuario.
     *
     * @return array{start: string, end: string, only_confirmed: bool, reference_id: int|null, shift: string|null}
     */
    protected function resolveRankingFilters(Request $request, ?ProductionRankingTeamFilter $teamFilter, bool $canFilterOwn): array
    {
        $fallback = $this->currentFortnight();

        $baseStart = $teamFilter?->date_start?->toDateString() ?? $fallback['start'];
        $baseEnd = $teamFilter?->date_end?->toDateString() ?? $fallback['end'];

        // Sin permiso para su propio filtro la URL no manda: se le deja el del equipo.
        if (! $canFilterOwn) {
            return [
                'start' => $baseStart,
                'end' => $baseEnd,
                'only_confirmed' => false,
                'reference_id' => null,
                'shift' => null,
            ];
        }

        $start = $this->normalizeDate($request->input('start')) ?? $baseStart;
        $end = $this->normalizeDate($request->input('end')) ?? $baseEnd;

        if ($start > $end) {
            [$start, $end] = [$end, $start];
        }

        // La referencia se comprueba contra el catalogo de la empresa: un id de otra
        // empresa vaciaria el ranking sin decir por que.
        $referenceId = (int) $request->input('reference_id');
        if ($referenceId <= 0 || ! Reference::query()->whereKey($referenceId)->exists()) {
            $referenceId = null;
        }

        $shift = $request->input('shift');
        if (! in_array($shift, self::RANKING_SHIFTS, true)) {
            $shift = null;
        }

        return [
            'start' => $start,
            'end' => $end,
            'only_confirmed' => $request->boolean('only_confirmed', false),
            'reference_id' => $referenceId,
            'shift' => $shift,
        ];
    }

    protected function rankingTeamFilter(?int $companyId): ?ProductionRankingTeamFilter
    {
        if (! $companyId) {
            return null;
        }

        return ProductionRankingTeamFilter::withoutGlobalScope(CompanyScope::class)
            ->with('setBy:id,name,last_name')
            ->where('company_id', $companyId)
            ->first();
    }

    /**
     * @return array{date_start: string, date_end: string, set_by: string|null, updated_at: string|null}|null
     */
    protected function rankingTeamFilterPayload(?ProductionRankingTeamFilter $teamFilter): ?array
    {
        if (! $teamFilter) {
            return null;
        }

        return [
            'date_start' => $teamFilter->date_start?->toDateString() ?? '',
            'date_end' => $teamFilter->date_end?->toDateString() ?? '',
            'set_by' => $teamFilter->setBy?->full_name ?: null,
            'updated_at' => $teamFilter->updated_at?->toIso8601String(),
        ];
    }

    /**
     * Quincena en curso: del 1 al 15, o del 16 al fin de mes.
     *
     * Es el rango por defecto del ranking porque coincide con el corte de nomina: mirar
     * «el mes» a dia 3 daba un podio de tres dias.
     *
     * @return array{start: string, end: string}
     */
    protected function currentFortnight(): array
    {
        $today = now();

        if ($today->day <= 15) {
            return [
                'start' => $today->copy()->startOfMonth()->toDateString(),
                'end' => $today->copy()->startOfMonth()->addDays(14)->toDateString(),
            ];
        }

        return [
            'start' => $today->copy()->startOfMonth()->addDays(15)->toDateString(),
            'end' => $today->copy()->endOfMonth()->toDateString(),
        ];
    }

    /** Una fecha de la URL solo se usa si de verdad lo es; si no, manda el valor por defecto. */
    protected function normalizeDate(mixed $value): ?string
    {
        if (! is_string($value) || trim($value) === '') {
            return null;
        }

        try {
            return Carbon::parse($value)->toDateString();
        } catch (\Throwable) {
            return null;
        }
    }

    protected function applyEmployeeRestriction($query, $user): void
    {
        if ($user->isRestrictedProductionAccount()) {
            $query->where('employee_id', $user->employee_id);
        }
    }

    /**
     * Filtros del listado: los aplica a la consulta y devuelve como quedaron.
     *
     * Vive aparte porque los usan dos salidas —la pantalla y la exportacion— y un CSV que
     * no coincida con lo que se ve en pantalla es peor que no tener CSV.
     *
     * @return array{employee_id: mixed, reference_id: mixed, operation_id: mixed, date_start: mixed, date_end: mixed, shift: mixed, status: mixed}
     */
    protected function applyIndexFilters($query, Request $request): array
    {
        $filters = [
            'employee_id' => $request->input('employee_id'),
            'reference_id' => $request->input('reference_id'),
            'operation_id' => $request->input('operation_id'),
            'date_start' => $request->input('date_start'),
            'date_end' => $request->input('date_end'),
            'shift' => $request->input('shift'),
            'status' => $request->input('status'),
        ];

        if ($filters['employee_id']) {
            $query->where('employee_id', $filters['employee_id']);
        }
        if ($filters['reference_id']) {
            $query->where('reference_id', $filters['reference_id']);
        }
        if ($filters['operation_id']) {
            $query->where('operation_id', $filters['operation_id']);
        }
        if ($filters['date_start']) {
            $query->where('date', '>=', $filters['date_start']);
        }
        if ($filters['date_end']) {
            $query->where('date', '<=', $filters['date_end']);
        }
        if ($filters['shift']) {
            $query->where('shift', $filters['shift']);
        }
        if ($filters['status'] && in_array((string) $filters['status'], [Production::STATUS_PENDING, Production::STATUS_CONFIRMED, Production::STATUS_PAID], true)) {
            $query->where('status', $filters['status']);
        }

        return $filters;
    }

    protected function employeesList()
    {
        return Employee::active()->orderBy('first_name')->get(['id', 'first_name', 'last_name', 'document_number']);
    }

    /**
     * Referencias con operaciones activas y total producido (suma de cantidades) para tope de lote.
     * Al editar, incluye la referencia/operacion del registro aunque el lote este cerrado (inactivo).
     */
    protected function referencesForProductionForm(?Production $editing = null)
    {
        $references = Reference::active()
            ->withSum('productions', 'quantity')
            ->with(['operations' => function ($q) {
                $q->wherePivot('is_active', true);
            }])
            ->orderBy('code')
            ->get();

        if ($editing && ! $references->contains(fn ($r) => (int) $r->id === (int) $editing->reference_id)) {
            $extra = Reference::query()
                ->where('id', $editing->reference_id)
                ->withSum('productions', 'quantity')
                ->with(['operations' => function ($q) use ($editing) {
                    $q->where(function ($inner) use ($editing) {
                        $inner->where('reference_operations.is_active', true)
                            ->orWhere('operations.id', $editing->operation_id);
                    });
                }])
                ->first();
            if ($extra) {
                $references->push($extra);
                $references = $references->sortBy('code')->values();
            }
        }

        $this->hydrateProductionQuantitiesByOperation($references);

        return $references;
    }

    /**
     * @param  Collection<int, Reference>  $references
     */
    protected function hydrateProductionQuantitiesByOperation($references): void
    {
        if ($references->isEmpty()) {
            return;
        }

        $refIds = $references->pluck('id');
        $rows = Production::query()
            ->withoutGlobalScopes()
            ->selectRaw('reference_id, operation_id, SUM(quantity) as qty')
            ->whereIn('reference_id', $refIds)
            ->groupBy('reference_id', 'operation_id')
            ->get();

        $map = [];
        foreach ($rows as $row) {
            $map[(int) $row->reference_id][(int) $row->operation_id] = (int) $row->qty;
        }

        foreach ($references as $ref) {
            $byOp = $map[(int) $ref->id] ?? [];
            $ref->setAttribute('productions_quantity_by_operation', $byOp === [] ? new \stdClass : $byOp);
        }
    }

    protected function unitPriceFromReferenceOperation(int $referenceId, int $operationId): float
    {
        $reference = Reference::find($referenceId);
        $row = $reference?->operations()->where('operations.id', $operationId)->first();

        return (float) ($row?->pivot?->price ?? Operation::find($operationId)?->base_price ?? 0);
    }

    protected function resolveUnitPriceForSave(?User $user, array $data): float
    {
        if ($user?->isRestrictedProductionAccount()) {
            return $this->unitPriceFromReferenceOperation((int) $data['reference_id'], (int) $data['operation_id']);
        }

        $unitPrice = $data['unit_price'] ?? null;
        if ($unitPrice !== null && $unitPrice !== '') {
            return (float) $unitPrice;
        }

        return $this->unitPriceFromReferenceOperation((int) $data['reference_id'], (int) $data['operation_id']);
    }

    protected function resolveUnitPriceForUpdate(?User $user, array $data, Production $production): float
    {
        if ($user?->isRestrictedProductionAccount()) {
            return $this->unitPriceFromReferenceOperation((int) $data['reference_id'], (int) $data['operation_id']);
        }

        $unitPrice = $data['unit_price'] ?? null;
        if ($unitPrice !== null && $unitPrice !== '') {
            return (float) $unitPrice;
        }

        return (float) $production->unit_price;
    }
}
