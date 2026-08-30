<?php

namespace App\Http\Controllers;

use App\Http\Requests\Payroll\CalculatePayrollRequest;
use App\Http\Requests\Payroll\StorePayrollRequest;
use App\Models\AccessLog;
use App\Models\Company;
use App\Models\Payroll;
use App\Models\PayrollConcept;
use App\Models\PayrollEmployee;
use App\Models\PayrollPeriodicity;
use App\Models\Production;
use App\Models\Scopes\CompanyScope;
use App\Models\WorkDaySession;
use App\Services\PayrollCalculationService;
use App\Support\CompanyContext;
use App\Support\TenantContext;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Carbon;
use Inertia\Inertia;
use Inertia\Response;
use League\Csv\Bom;
use League\Csv\Writer;
use Symfony\Component\HttpFoundation\StreamedResponse;

class PayrollController extends Controller
{
    public function __construct(protected PayrollCalculationService $calculator) {}

    public function index(Request $request): Response
    {
        $search = trim((string) $request->input('search', ''));

        // El estado util del listado no es el crudo de la base sino el del flujo: una nomina
        // esta abierta mientras se pueda tocar (borrador/calculado) y cerrada cuando ya se
        // aprobo o pago. Cuatro casillas de estado obligaban a conocer el vocabulario interno.
        $state = (string) $request->input('state', 'open');
        if (! in_array($state, ['open', 'closed', 'all'], true)) {
            $state = 'open';
        }

        $year = (int) $request->input('year', now()->year);
        if ($year < 2000 || $year > 2100) {
            $year = (int) now()->year;
        }

        $type = $request->input('type');
        $type = is_string($type) && $type !== '' ? $type : null;

        $query = $this->indexBaseQuery($request)
            ->with(['company:id,name', 'creator:id,name,last_name'])
            ->withCount('payrollEmployees');

        $this->applyIndexFilters($query, $search, $state, $year, $type);

        $payrolls = $query->orderByDesc('period_start')->orderByDesc('id')->paginate(15)->withQueryString();

        return Inertia::render('Payrolls/Index', [
            'payrolls' => $payrolls,
            'filters' => [
                'search' => $search,
                'state' => $state,
                'year' => $year,
                'type' => $type,
            ],
            'metrics' => $this->indexMetrics($request, $year, $search, $type),
            'periodicities' => PayrollPeriodicity::query()->active()->ordered()->get(['code', 'name']),
            'years' => $this->availableYears($request, $year),
        ]);
    }

    /**
     * Descarga en CSV lo que muestra el listado, con el filtro aplicado.
     *
     * Un CSV que no coincida con lo que se ve en pantalla es peor que no tener CSV, asi que
     * reutiliza los mismos filtros que `index()`.
     */
    public function exportList(Request $request): StreamedResponse
    {
        $search = trim((string) $request->input('search', ''));

        $state = (string) $request->input('state', 'open');
        if (! in_array($state, ['open', 'closed', 'all'], true)) {
            $state = 'open';
        }

        $year = (int) $request->input('year', now()->year);
        if ($year < 2000 || $year > 2100) {
            $year = (int) now()->year;
        }

        $type = $request->input('type');
        $type = is_string($type) && $type !== '' ? $type : null;

        $query = $this->indexBaseQuery($request)
            ->with('company:id,name')
            ->withCount('payrollEmployees');

        $this->applyIndexFilters($query, $search, $state, $year, $type);

        $filename = 'nomina-'.now()->format('Ymd-Hi').'.csv';

        return response()->streamDownload(function () use ($query) {
            $writer = Writer::createFromStream(fopen('php://output', 'w'));
            $writer->setOutputBOM(Bom::Utf8);
            $writer->insertOne([
                'Nomina', 'Periodicidad', 'Inicio', 'Fin', 'Estado', 'Empleados', 'Neto',
            ]);

            $query->orderByDesc('period_start')->orderByDesc('id')->chunk(500, function ($rows) use ($writer) {
                foreach ($rows as $payroll) {
                    $writer->insertOne([
                        $payroll->name,
                        $payroll->type,
                        $payroll->period_start?->format('Y-m-d'),
                        $payroll->period_end?->format('Y-m-d'),
                        $payroll->status,
                        (int) ($payroll->payroll_employees_count ?? 0),
                        (float) $payroll->total_amount,
                    ]);
                }
            });
        }, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Cache-Control' => 'no-store, no-cache, must-revalidate',
        ]);
    }

    /**
     * Alcance comun del listado: empresa activa y, para un empleado sin rol administrativo,
     * solo las nominas donde aparece. Lo comparten la tabla y las metricas: si divergieran,
     * la cabecera diria una cosa y la lista otra.
     */
    protected function indexBaseQuery(Request $request): Builder
    {
        $user = $request->user();
        $companyId = CompanyContext::id($user);

        $query = Payroll::query();

        if ($companyId) {
            $query->where('company_id', $companyId);
        }

        if ($user && $user->isEmployee() && ! $user->isAdmin()) {
            $query->whereHas('payrollEmployees', fn ($q) => $q->where('employee_id', $user->employee_id));
        }

        return $query;
    }

    protected function applyIndexFilters(Builder $query, string $search, string $state, int $year, ?string $type): void
    {
        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('notes', 'like', "%{$search}%")
                    ->orWhere('type', 'like', "%{$search}%")
                    ->orWhere('period_start', 'like', "%{$search}%")
                    ->orWhere('period_end', 'like', "%{$search}%");
            });
        }

        if ($state === 'open') {
            $query->whereIn('status', [Payroll::STATUS_DRAFT, Payroll::STATUS_CALCULATED]);
        } elseif ($state === 'closed') {
            $query->whereIn('status', [Payroll::STATUS_APPROVED, Payroll::STATUS_PAID]);
        }

        $query->whereYear('period_start', $year);

        if ($type !== null) {
            $query->where('type', $type);
        }
    }

    /**
     * Las tres cifras de la cabecera: que hay abierto ahora mismo, cuanto se pago en el ano
     * y cuanto cuesta en promedio un empleado del periodo abierto.
     */
    protected function indexMetrics(Request $request, int $year, string $search, ?string $type): array
    {
        // Cuantas abiertas hay con el filtro puesto (sin contar el segmentado de estado):
        // es lo que da sentido al contador «N nominas · M abiertas» de la barra.
        $filteredOpen = $this->indexBaseQuery($request);
        $this->applyIndexFilters($filteredOpen, $search, 'open', $year, $type);

        $open = $this->indexBaseQuery($request)
            ->withCount('payrollEmployees')
            ->whereIn('status', [Payroll::STATUS_DRAFT, Payroll::STATUS_CALCULATED])
            ->orderByDesc('period_start')
            ->orderByDesc('id')
            ->first();

        $openEmployees = (int) ($open->payroll_employees_count ?? 0);
        $openNet = (float) ($open->total_amount ?? 0);

        return [
            'open_net' => $openNet,
            'open_employees' => $openEmployees,
            'open_status' => $open?->status,
            'open_period_end' => $open?->period_end?->toDateString(),
            'open_type' => $open?->type,
            'year_paid' => (float) $this->indexBaseQuery($request)
                ->whereYear('period_start', $year)
                ->where('status', Payroll::STATUS_PAID)
                ->sum('total_amount'),
            'year_closed_count' => $this->indexBaseQuery($request)
                ->whereYear('period_start', $year)
                ->whereIn('status', [Payroll::STATUS_APPROVED, Payroll::STATUS_PAID])
                ->count(),
            'year_approved_unpaid' => $this->indexBaseQuery($request)
                ->whereYear('period_start', $year)
                ->where('status', Payroll::STATUS_APPROVED)
                ->count(),
            'average_per_employee' => $openEmployees > 0 ? round($openNet / $openEmployees, 2) : 0.0,
            'filtered_open_count' => $filteredOpen->count(),
        ];
    }

    /**
     * Anos con nomina registrada, para que el desplegable no ofrezca anos vacios. Siempre
     * incluye el ano en curso y el que se este filtrando, aunque no tengan nada todavia.
     */
    protected function availableYears(Request $request, int $selected): array
    {
        $years = $this->indexBaseQuery($request)
            ->selectRaw('YEAR(period_start) as y')
            ->distinct()
            ->pluck('y')
            ->map(fn ($y) => (int) $y)
            ->all();

        $years[] = (int) now()->year;
        $years[] = $selected;

        $years = array_values(array_unique(array_filter($years, fn ($y) => $y > 0)));
        rsort($years);

        return $years;
    }

    public function create(Request $request): Response
    {
        $companyId = CompanyContext::id($request->user());
        $company = $companyId ? Company::query()->find($companyId) : null;
        $storedCode = (string) ($company?->settings['payroll_periodicity'] ?? '');
        $default = PayrollPeriodicity::query()
            ->where('code', $storedCode !== '' ? $storedCode : 'quincenal')
            ->where('is_active', true)
            ->value('code');

        if ($default === null) {
            $default = PayrollPeriodicity::query()->active()->ordered()->value('code') ?? 'quincenal';
        }

        $last = $companyId
            ? Payroll::query()
                ->withoutGlobalScope(CompanyScope::class)
                ->where('company_id', $companyId)
                ->orderByDesc('period_end')
                ->orderByDesc('id')
                ->first()
            : null;

        $codes = PayrollPeriodicity::query()->active()->ordered()->pluck('code')->all();
        if (! in_array($default, $codes, true)) {
            $codes[] = $default;
        }

        $suggestions = [];
        foreach ($codes as $code) {
            $suggestions[$code] = $this->suggestPeriodFor((string) $code, $last?->period_end);
        }

        // El aviso de solape se resuelve antes de enviar: el servidor lo rechaza igual
        // (StorePayrollRequest), pero enterarse tras el envio obliga a rehacer el formulario.
        $existing = $companyId
            ? Payroll::query()
                ->withoutGlobalScope(CompanyScope::class)
                ->where('company_id', $companyId)
                ->orderByDesc('period_start')
                ->limit(40)
                ->get(['id', 'name', 'period_start', 'period_end', 'type'])
                ->map(fn (Payroll $p) => [
                    'id' => $p->id,
                    'name' => $p->name,
                    'period_start' => $p->period_start?->toDateString(),
                    'period_end' => $p->period_end?->toDateString(),
                    'type' => $p->type,
                ])
                ->all()
            : [];

        return Inertia::render('Payrolls/Create', [
            'defaultPayrollType' => $default,
            'suggestions' => $suggestions,
            'lastPeriod' => $last ? [
                'name' => $last->name,
                'period_end' => $last->period_end?->toDateString(),
                'type' => $last->type,
            ] : null,
            'existingPeriods' => $existing,
        ]);
    }

    /**
     * Largo del periodo en dias para las periodicidades de paso fijo. `null` marca las que
     * se resuelven por calendario (quincenal y mensual), que no tienen largo constante.
     */
    protected function periodLengthDays(string $code): ?int
    {
        return match ($code) {
            'diario' => 1,
            'semanal' => 7,
            'decadal' => 10,
            'catorcenal' => 14,
            default => null,
        };
    }

    /**
     * Siguiente periodo a partir del cierre anterior. Sin nominas previas se propone el
     * periodo en curso, que es lo que hace quien empieza a usar el modulo a mitad de mes.
     */
    protected function suggestPeriodFor(string $code, ?Carbon $lastEnd): array
    {
        $start = $lastEnd ? $lastEnd->copy()->addDay()->startOfDay() : now()->startOfDay();

        if ($code === 'mensual') {
            if (! $lastEnd) {
                $start = now()->startOfMonth();
            }
            $end = $start->copy()->endOfMonth();
        } elseif ($code === 'quincenal') {
            if (! $lastEnd) {
                $start = now()->day <= 15 ? now()->startOfMonth() : now()->startOfMonth()->addDays(15);
            }
            $end = $start->day <= 15 ? $start->copy()->day(15) : $start->copy()->endOfMonth();
            if ($end->lt($start)) {
                $end = $start->copy()->endOfMonth();
            }
        } else {
            $days = $this->periodLengthDays($code) ?? 15;
            $end = $start->copy()->addDays($days - 1);
        }

        return [
            'type' => $code,
            'period_start' => $start->toDateString(),
            'period_end' => $end->toDateString(),
            'name' => $this->suggestName($code, $start, $end),
        ];
    }

    protected function suggestName(string $code, Carbon $start, Carbon $end): string
    {
        $months = [
            'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
            'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
        ];
        $month = $months[$start->month - 1] ?? '';

        if ($code === 'mensual') {
            return 'Nomina '.$month.' '.$start->year;
        }

        if ($start->month === $end->month && $start->year === $end->year) {
            return 'Nomina '.$start->day.'-'.$end->day.' '.$month.' '.$start->year;
        }

        return 'Nomina '.$start->format('d/m').' - '.$end->format('d/m/Y');
    }

    public function store(StorePayrollRequest $request): RedirectResponse
    {
        $user = $request->user();
        $data = $request->validated();
        $companyId = CompanyContext::id($user);
        if (! $companyId) {
            return back()->with('error', 'Selecciona una empresa activa antes de crear una nomina.');
        }

        $payroll = Payroll::create([
            'company_id' => $companyId,
            'name' => $data['name'],
            'period_start' => $data['period_start'],
            'period_end' => $data['period_end'],
            'type' => $data['type'],
            'status' => Payroll::STATUS_DRAFT,
            'total_amount' => 0,
            'notes' => $data['notes'] ?? null,
            'created_by' => $user->id,
        ]);

        return redirect()->route('payrolls.show', $payroll)->with('success', 'Nomina creada en borrador.');
    }

    public function show(Request $request, Payroll $payroll): Response
    {
        $user = $request->user();
        $this->authorize('view', $payroll);
        $this->ensurePayrollBelongsToActiveCompany($request, $payroll);

        $payroll->load('creator:id,name,last_name');

        $payrollConcepts = collect();
        if ($user->can('payrolls.show.manage_adjustments')) {
            $payrollConcepts = PayrollConcept::query()
                ->where('company_id', $payroll->company_id)
                ->where('is_active', true)
                ->orderBy('sort_order')
                ->orderBy('name')
                ->get(['id', 'name', 'code']);
        }

        $peBase = PayrollEmployee::query()->where('payroll_id', $payroll->id);

        if ($user->isEmployee() && ! $user->isAdmin()) {
            $peBase->where('employee_id', $user->employee_id);
        }

        $totalsRow = (clone $peBase)
            ->selectRaw('
                COUNT(*) as employee_count,
                COALESCE(SUM(production_total), 0) as total_production,
                COALESCE(SUM(daily_work_subtotal), 0) as total_daily,
                COALESCE(SUM(legal_hourly_subtotal), 0) as total_legal_hourly,
                COALESCE(SUM(adjustments_subtotal), 0) as total_adjustments,
                COALESCE(SUM(advances_discount), 0) as total_advances,
                COALESCE(SUM(absence_discount_total), 0) as total_absence_discount,
                COALESCE(SUM(
                    COALESCE(production_total, 0)
                    + COALESCE(daily_work_subtotal, 0)
                    + COALESCE(legal_hourly_subtotal, 0)
                    + COALESCE(adjustments_subtotal, 0)
                ), 0) as total_gross
            ')
            ->first();

        $totalDeductions = (float) (clone $peBase)->get(['deductions'])->sum(function (PayrollEmployee $pe) {
            $ded = $pe->deductions ?? [];
            if (! is_array($ded)) {
                return 0.0;
            }

            return (float) collect($ded)->sum(fn ($d) => (float) ($d['amount'] ?? 0));
        });

        $showDailyColumn = (clone $peBase)->where('daily_work_subtotal', '>', 0)->exists();
        $showLegalColumn = (clone $peBase)->where('legal_hourly_subtotal', '>', 0)->exists();

        $payrollEmployeeRows = (clone $peBase)
            ->with([
                'employee:id,first_name,last_name,document_type,document_number,payroll_mode,base_salary,daily_salary,minutes_per_full_workday,ordinary_hours_per_day,is_exempt_from_overtime,scheduled_work_days',
                'advances',
                'adjustments.payrollConcept:id,name,code',
            ])
            ->join('employees', 'payroll_employees.employee_id', '=', 'employees.id')
            ->orderBy('employees.first_name')
            ->orderBy('employees.last_name')
            ->select('payroll_employees.*')
            ->get();

        $totalRows = $payrollEmployeeRows->count();
        $perPage = max($totalRows, 1);

        $payrollEmployees = new LengthAwarePaginator(
            $payrollEmployeeRows,
            $totalRows,
            $perPage,
            1,
            [
                'path' => $request->url(),
                'pageName' => 'page',
            ]
        );

        $payrollEmployees->withQueryString();

        $idsForDetail = $payrollEmployeeRows->pluck('employee_id')->filter()->values()->all();

        return Inertia::render('Payrolls/Show', [
            'payroll' => $payroll,
            'payrollEmployees' => $payrollEmployees,
            'payrollEmployeeTotals' => [
                'employee_count' => (int) ($totalsRow->employee_count ?? 0),
                'total_production' => (float) ($totalsRow->total_production ?? 0),
                'total_daily' => (float) ($totalsRow->total_daily ?? 0),
                'total_legal_hourly' => (float) ($totalsRow->total_legal_hourly ?? 0),
                'total_adjustments' => (float) ($totalsRow->total_adjustments ?? 0),
                'total_gross' => (float) ($totalsRow->total_gross ?? 0),
                'total_advances' => (float) ($totalsRow->total_advances ?? 0),
                'total_absence_discount' => (float) ($totalsRow->total_absence_discount ?? 0),
                'total_deductions' => $totalDeductions,
                'show_daily_column' => $showDailyColumn,
                'show_legal_column' => $showLegalColumn,
            ],
            'workSessionsByEmployee' => $this->workSessionsFor($payroll, $idsForDetail),
            'productionsByEmployee' => $this->productionsFor($payroll, $idsForDetail),
            'payrollConcepts' => $payrollConcepts,
            'periodicityName' => PayrollPeriodicity::query()->where('code', $payroll->type)->value('name'),
        ]);
    }

    /**
     * Ficha completa de un empleado dentro de la nomina: jornadas, liquidacion legal o
     * produccion, conceptos, anticipos e inasistencias, con espacio para editarlos.
     */
    public function employee(Request $request, Payroll $payroll, PayrollEmployee $payrollEmployee): Response
    {
        $this->authorize('view', $payroll);
        $this->ensurePayrollBelongsToActiveCompany($request, $payroll);
        $this->ensurePayrollEmployeeIsVisible($request, $payroll, $payrollEmployee);

        $user = $request->user();
        $payroll->load('creator:id,name,last_name');

        $payrollEmployee->load([
            'employee',
            'employee.bank:id,name,code,is_active,logo_path,brand_color,type,requires_key',
            'advances',
            'adjustments.payrollConcept:id,name,code',
        ]);

        $payrollConcepts = collect();
        if ($user->can('payrolls.show.manage_adjustments')) {
            $payrollConcepts = PayrollConcept::query()
                ->where('company_id', $payroll->company_id)
                ->where('is_active', true)
                ->orderBy('sort_order')
                ->orderBy('name')
                ->get(['id', 'name', 'code']);
        }

        $employeeId = (int) $payrollEmployee->employee_id;

        return Inertia::render('Payrolls/Employee', [
            'payroll' => $payroll,
            'payrollEmployee' => $payrollEmployee,
            'workSessions' => $this->workSessionsFor($payroll, [$employeeId])[(string) $employeeId] ?? [],
            'productions' => $this->productionsFor($payroll, [$employeeId])[(string) $employeeId] ?? [],
            'payrollConcepts' => $payrollConcepts,
            // Recalcular reevalua las inasistencias de TODA la nomina: sin el estado de los
            // demas empleados, guardar desde esta ficha revertiria sus exclusiones al valor
            // por defecto de los parametros legales.
            'absenceBaseline' => $this->absenceBaseline($payroll),
            'siblings' => $this->employeeSiblings($payroll, $payrollEmployee),
            'periodicityName' => PayrollPeriodicity::query()->where('code', $payroll->type)->value('name'),
        ]);
    }

    /**
     * Comprobante individual imprimible. Reusa la misma retícula del informe de nomina.
     */
    public function receipt(Request $request, Payroll $payroll, PayrollEmployee $payrollEmployee): Response
    {
        $this->authorize('view', $payroll);
        $this->ensurePayrollBelongsToActiveCompany($request, $payroll);
        $this->ensurePayrollEmployeeIsVisible($request, $payroll, $payrollEmployee);

        $payroll->load('company:id,name,nit,address,phone,logo');
        $payrollEmployee->load([
            'employee',
            'employee.bank:id,name,code,is_active,logo_path,brand_color,type,requires_key',
            'advances',
            'adjustments.payrollConcept:id,name,code',
        ]);

        $employeeId = (int) $payrollEmployee->employee_id;

        return Inertia::render('Payrolls/Receipt', [
            'payroll' => $payroll,
            'payrollEmployee' => $payrollEmployee,
            'workSessions' => $this->workSessionsFor($payroll, [$employeeId])[(string) $employeeId] ?? [],
            'productions' => $this->productionsFor($payroll, [$employeeId])[(string) $employeeId] ?? [],
        ]);
    }

    /**
     * Una nomina solo muestra los empleados de su propia empresa, y un empleado sin rol
     * administrativo solo se ve a si mismo.
     */
    protected function ensurePayrollEmployeeIsVisible(Request $request, Payroll $payroll, PayrollEmployee $payrollEmployee): void
    {
        abort_unless((int) $payrollEmployee->payroll_id === (int) $payroll->id, 404);

        $user = $request->user();

        if ($user && $user->isEmployee() && ! $user->isAdmin()
            && (int) $payrollEmployee->employee_id !== (int) $user->employee_id) {
            abort(403, 'Solo puedes consultar tu propia liquidacion.');
        }
    }

    /**
     * Empleado anterior y siguiente en el mismo orden que la lista del detalle, para poder
     * recorrer la nomina sin volver atras.
     */
    protected function employeeSiblings(Payroll $payroll, PayrollEmployee $current): array
    {
        $rows = PayrollEmployee::query()
            ->where('payroll_id', $payroll->id)
            ->join('employees', 'payroll_employees.employee_id', '=', 'employees.id')
            ->orderBy('employees.first_name')
            ->orderBy('employees.last_name')
            ->get([
                'payroll_employees.id',
                'employees.first_name',
                'employees.last_name',
            ]);

        $index = $rows->search(fn ($row) => (int) $row->id === (int) $current->id);

        $map = fn ($row) => $row === null ? null : [
            'id' => (int) $row->id,
            'name' => trim(($row->first_name ?? '').' '.($row->last_name ?? '')),
        ];

        return [
            'position' => $index === false ? 0 : $index + 1,
            'total' => $rows->count(),
            'previous' => $index === false ? null : $map($rows->get($index - 1)),
            'next' => $index === false ? null : $map($rows->get($index + 1)),
        ];
    }

    /**
     * Estado actual de las inasistencias de todos los empleados de la nomina, en el mismo
     * formato que espera `absence_confirmations` al recalcular.
     */
    protected function absenceBaseline(Payroll $payroll): array
    {
        return PayrollEmployee::query()
            ->where('payroll_id', $payroll->id)
            ->get(['employee_id', 'absence_discount_detail'])
            ->map(function (PayrollEmployee $row) {
                $detail = is_array($row->absence_discount_detail) ? $row->absence_discount_detail : [];

                return [
                    'employee_id' => (int) $row->employee_id,
                    'dates' => array_values(array_map(fn ($item) => [
                        'date' => (string) ($item['work_date'] ?? ''),
                        'discount' => (bool) ($item['confirmed'] ?? false),
                        'note' => $item['note'] ?? null,
                    ], $detail)),
                ];
            })
            ->filter(fn ($block) => $block['dates'] !== [])
            ->values()
            ->all();
    }

    /**
     * @param  int[]  $employeeIds
     * @return array<string, mixed>
     */
    protected function workSessionsFor(Payroll $payroll, array $employeeIds): array
    {
        if ($employeeIds === []) {
            return [];
        }

        return WorkDaySession::query()
            ->withoutGlobalScopes()
            ->where('company_id', $payroll->company_id)
            ->whereBetween('work_date', [
                $payroll->period_start->format('Y-m-d'),
                $payroll->period_end->format('Y-m-d'),
            ])
            ->whereIn('employee_id', $employeeIds)
            ->orderBy('work_date')
            ->orderBy('id')
            ->get()
            ->groupBy(fn ($s) => (string) $s->employee_id)
            ->map(fn ($sessions) => $sessions->values()->all())
            ->all();
    }

    /**
     * @param  int[]  $employeeIds
     * @return array<string, mixed>
     */
    protected function productionsFor(Payroll $payroll, array $employeeIds): array
    {
        if ($employeeIds === []) {
            return [];
        }

        return Production::query()
            ->withoutGlobalScope(CompanyScope::class)
            ->with(['reference:id,code,name', 'operation:id,name'])
            ->whereBetween('date', [
                $payroll->period_start->format('Y-m-d'),
                $payroll->period_end->format('Y-m-d'),
            ])
            ->whereIn('status', Production::PAYABLE_STATUSES)
            ->where(function ($q) use ($payroll) {
                $cid = (int) $payroll->company_id;
                $q->where('company_id', $cid)
                    ->orWhereHas('reference', fn ($r) => $r->where('company_id', $cid));
            })
            ->whereIn('employee_id', $employeeIds)
            ->orderBy('date')
            ->orderBy('id')
            ->get()
            ->groupBy(fn ($p) => (string) $p->employee_id)
            ->map(fn ($rows) => $rows->values()->all())
            ->all();
    }

    public function calculate(CalculatePayrollRequest $request, Payroll $payroll): RedirectResponse
    {
        $this->authorize('calculate', $payroll);
        $this->ensurePayrollBelongsToActiveCompany($request, $payroll);

        if (! $payroll->canBeCalculated()) {
            return back()->with('error', 'Esta nomina no puede ser calculada en su estado actual.');
        }

        $request->validated();

        try {
            $this->calculator->calculate(
                $payroll,
                $request->input('employee_adjustments'),
                $request->user(),
                $request->input('absence_confirmations'),
                $request->input('advance_adjustments'),
            );
        } catch (\DomainException $e) {
            return back()->with('error', $e->getMessage());
        }

        return back()->with('success', 'Nomina calculada.');
    }

    public function approve(Request $request, Payroll $payroll): RedirectResponse
    {
        $this->authorize('approve', $payroll);
        $this->ensurePayrollBelongsToActiveCompany($request, $payroll);

        try {
            $this->calculator->approve($payroll);
        } catch (\DomainException $e) {
            return back()->with('error', $e->getMessage());
        }

        return back()->with('success', 'Nomina aprobada.');
    }

    public function pay(Request $request, Payroll $payroll): RedirectResponse
    {
        $this->authorize('pay', $payroll);
        $this->ensurePayrollBelongsToActiveCompany($request, $payroll);

        try {
            $this->calculator->markAsPaid($payroll);
        } catch (\DomainException $e) {
            return back()->with('error', $e->getMessage());
        }

        return back()->with('success', 'Nomina marcada como pagada.');
    }

    public function destroy(Request $request, Payroll $payroll): RedirectResponse
    {
        $this->authorize('delete', $payroll);
        $this->ensurePayrollBelongsToActiveCompany($request, $payroll);

        // Una nomina cerrada (aprobada o pagada) solo la puede eliminar el super usuario, y
        // deshaciendo antes lo que el cierre cambio. Es la salida cuando la empresa cierra
        // por error: sin esto el periodo queda bloqueado y no se puede rehacer.
        if (! $payroll->isEditable()) {
            if (! $request->user()?->isSuperAdmin()) {
                return back()->with('error', 'Solo se pueden eliminar nominas en borrador o calculadas.');
            }

            return $this->destroyClosedPayroll($request, $payroll);
        }

        $payroll->payrollEmployees()->delete();
        $payroll->delete();

        return redirect()->route('payrolls.index')->with('success', 'Nomina eliminada.');
    }

    /**
     * Borrado de una nomina ya cerrada por parte del super usuario: se revierte el cierre
     * (produccion y anticipos) y se deja constancia de quien lo hizo.
     */
    private function destroyClosedPayroll(Request $request, Payroll $payroll): RedirectResponse
    {
        $nombre = $payroll->name;
        $estado = $payroll->status;

        $resultado = $this->calculator->deletePaidPayroll($payroll);

        AccessLog::log('payroll_closed_deleted', $request->user()?->id, [
            'company_id' => $payroll->company_id,
            'permission_checked' => 'super_admin',
        ]);

        $detalle = sprintf(
            'Se repusieron %d registro(s) de produccion y %d anticipo(s).',
            $resultado['productions'],
            $resultado['advances'],
        );

        // Una nomina cerrada antes de que se guardara el retrato se puede reabrir igual (la
        // produccion vuelve a «confirmada» por barrido), pero no hay como saber cual estaba
        // pendiente ni cuanto se descontó de cada anticipo. Se dice, en vez de dar por hecho
        // que quedo todo como estaba.
        if (! $resultado['from_snapshot']) {
            return redirect()
                ->route('payrolls.index')
                ->with('warning', "Nomina \"{$nombre}\" eliminada. Se reabrieron {$resultado['reopened_without_snapshot']} registro(s) de produccion como «confirmada», pero esta nomina se cerro antes de que el sistema guardara el estado previo: revisa a mano los anticipos del periodo y la produccion que estuviera pendiente por confirmar.");
        }

        return redirect()
            ->route('payrolls.index')
            ->with('success', "Nomina \"{$nombre}\" ({$estado}) eliminada y revertida. {$detalle} Ya puedes generarla de nuevo.");
    }

    public function export(Request $request, Payroll $payroll): Response
    {
        $this->authorize('view', $payroll);
        $this->ensurePayrollBelongsToActiveCompany($request, $payroll);

        $mode = $request->input('mode') === 'detailed' ? 'detailed' : 'general';

        $payroll->load([
            'company:id,name,nit,address,phone,logo',
            'payrollEmployees.employee:id,first_name,last_name,document_number,payroll_mode',
            // Permite mostrar en el documento el saldo entregado, lo aplicado en este periodo y
            // lo que queda pendiente para el siguiente (descuento parcial de anticipos).
            'payrollEmployees.advances',
        ]);

        // Modo detallado: cada empleado se imprime en su propia seccion con el detalle de
        // operaciones producidas (y las jornadas cuando aplica) que sustentan su liquidacion.
        $productionsByEmployee = [];
        $workSessionsByEmployee = [];

        if ($mode === 'detailed') {
            $employeeIds = $payroll->payrollEmployees->pluck('employee_id')->filter()->values()->all();

            if ($employeeIds !== []) {
                $productionsByEmployee = Production::query()
                    ->withoutGlobalScope(CompanyScope::class)
                    ->with(['reference:id,code,name', 'operation:id,name'])
                    ->whereBetween('date', [
                        $payroll->period_start->format('Y-m-d'),
                        $payroll->period_end->format('Y-m-d'),
                    ])
                    ->whereIn('status', Production::PAYABLE_STATUSES)
                    ->whereIn('employee_id', $employeeIds)
                    ->where(function ($inner) use ($payroll) {
                        $inner->where('company_id', $payroll->company_id)
                            ->orWhereHas('reference', fn ($r) => $r->where('company_id', $payroll->company_id));
                    })
                    ->orderBy('date')
                    ->orderBy('id')
                    ->get()
                    ->groupBy(fn ($p) => (string) $p->employee_id)
                    ->map(fn ($items) => $items->values()->all())
                    ->all();

                $workSessionsByEmployee = WorkDaySession::query()
                    ->withoutGlobalScopes()
                    ->where('company_id', $payroll->company_id)
                    ->whereBetween('work_date', [
                        $payroll->period_start->format('Y-m-d'),
                        $payroll->period_end->format('Y-m-d'),
                    ])
                    ->whereIn('employee_id', $employeeIds)
                    ->orderBy('work_date')
                    ->orderBy('id')
                    ->get()
                    ->groupBy(fn ($s) => (string) $s->employee_id)
                    ->map(fn ($items) => $items->values()->all())
                    ->all();
            }
        }

        return Inertia::render('Payrolls/Print', [
            'payroll' => $payroll,
            'mode' => $mode,
            'productionsByEmployee' => $productionsByEmployee,
            'workSessionsByEmployee' => $workSessionsByEmployee,
        ]);
    }

    protected function ensurePayrollBelongsToActiveCompany(Request $request, Payroll $payroll): void
    {
        $user = $request->user();
        if (! $user?->isSuperAdmin()) {
            return;
        }

        $activeId = TenantContext::superAdminSelectedCompanyId();
        if ($activeId && (int) $activeId !== (int) $payroll->company_id) {
            abort(403, 'Esta nomina pertenece a otra empresa. Activa la empresa correcta en el selector.');
        }
    }
}
