<?php

namespace App\Http\Controllers;

use App\Http\Requests\Advance\StoreAdvanceRequest;
use App\Models\Advance;
use App\Models\Employee;
use App\Models\Payroll;
use App\Models\PayrollEmployee;
use App\Support\TenantContext;
use Carbon\CarbonInterface;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use League\Csv\Bom;
use League\Csv\Writer;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AdvanceController extends Controller
{
    public function index(Request $request): Response
    {
        $search = trim((string) $request->input('search', ''));
        // Se filtra por saldo y no por `status`: es lo que permite distinguir un anticipo
        // a medio descontar (parcial) sin agregar un estado nuevo a la base.
        $balance = (string) $request->input('balance', 'with');
        $employeeId = $request->input('employee_id');

        $query = Advance::query()->with('employee:id,first_name,last_name,document_number');
        $balance = $this->applyFilters($query, $search, $balance, $employeeId);

        $advances = $query->orderByDesc('date')->orderByDesc('id')->paginate(15)->withQueryString();

        return Inertia::render('Advances/Index', [
            'advances' => $advances,
            'filters' => [
                'search' => $search,
                'balance' => $balance,
                'employee_id' => $employeeId !== null ? (int) $employeeId : null,
            ],
            'employees' => Employee::active()->orderBy('first_name')->get(['id', 'first_name', 'last_name']),
            'metrics' => $this->indexMetrics(),
        ]);
    }

    /**
     * Aplica los filtros del listado y devuelve el valor de `balance` ya saneado.
     *
     * Vive aparte porque lo usan la pantalla y la exportacion: un CSV que no coincida con
     * lo que se ve en pantalla es peor que no tener CSV.
     */
    protected function applyFilters($query, string $search, string $balance, $employeeId): string
    {
        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                $q->where('reason', 'like', "%{$search}%")
                    ->orWhereHas('employee', fn ($e) => $e
                        ->where('first_name', 'like', "%{$search}%")
                        ->orWhere('last_name', 'like', "%{$search}%")
                        ->orWhere('document_number', 'like', "%{$search}%"));
            });
        }

        if ($balance === 'with') {
            $query->where('remaining_amount', '>', 0);
        } elseif ($balance === 'settled') {
            $query->where('remaining_amount', '<=', 0);
        } else {
            $balance = 'all';
        }

        if ($employeeId) {
            $query->where('employee_id', $employeeId);
        }

        return $balance;
    }

    /**
     * Descarga en CSV lo que muestra el listado, con el filtro aplicado.
     *
     * Incluye el saldo y lo ya descontado, que es justo lo que no cabe en pantalla cuando
     * hay que cuadrar con contabilidad.
     */
    public function export(Request $request): StreamedResponse
    {
        $query = Advance::query()->with('employee:id,first_name,last_name,document_number');

        $this->applyFilters(
            $query,
            trim((string) $request->input('search', '')),
            (string) $request->input('balance', 'with'),
            $request->input('employee_id'),
        );

        $filename = 'anticipos-'.now()->format('Ymd-Hi').'.csv';

        return response()->streamDownload(function () use ($query) {
            $writer = Writer::createFromStream(fopen('php://output', 'w'));
            $writer->setOutputBOM(Bom::Utf8);
            $writer->insertOne([
                'Fecha', 'Empleado', 'Documento', 'Motivo', 'Monto', 'Ya descontado', 'Saldo por descontar', 'Estado',
            ]);

            $query->orderByDesc('date')->orderByDesc('id')->chunk(500, function ($rows) use ($writer) {
                foreach ($rows as $advance) {
                    $remaining = (float) $advance->remaining_amount;
                    $amount = (float) $advance->amount;
                    $applied = round(max(0, $amount - $remaining), 2);

                    $writer->insertOne([
                        $advance->date?->format('Y-m-d'),
                        trim(($advance->employee?->first_name ?? '').' '.($advance->employee?->last_name ?? '')),
                        $advance->employee?->document_number,
                        $advance->reason,
                        $amount,
                        $applied,
                        max(0, $remaining),
                        // El estado util es el derivado, no el crudo de la base.
                        $remaining <= 0 ? 'Descontado' : ($applied > 0 ? 'Parcial' : 'Pendiente'),
                    ]);
                }
            });
        }, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Cache-Control' => 'no-store, no-cache, must-revalidate',
        ]);
    }

    /**
     * Cifras de cabecera: siempre sobre toda la empresa, nunca sobre la pagina.
     *
     * @return array<string, mixed>
     */
    protected function indexMetrics(): array
    {
        $monthStart = now()->startOfMonth()->toDateString();
        $monthEnd = now()->endOfMonth()->toDateString();
        $prevStart = now()->subMonthNoOverflow()->startOfMonth()->toDateString();
        $prevEnd = now()->subMonthNoOverflow()->endOfMonth()->toDateString();

        $pending = Advance::query()
            ->where('remaining_amount', '>', 0)
            ->selectRaw('SUM(remaining_amount) as total, COUNT(*) as count, COUNT(DISTINCT employee_id) as employees')
            ->first();

        $year = Advance::query()
            ->whereYear('date', now()->year)
            ->where('remaining_amount', '<=', 0)
            ->selectRaw('SUM(amount) as total, COUNT(*) as count')
            ->first();

        return [
            'pending_total' => round((float) ($pending->total ?? 0), 2),
            'pending_count' => (int) ($pending->count ?? 0),
            'pending_employees' => (int) ($pending->employees ?? 0),
            'month_total' => round((float) Advance::query()->whereBetween('date', [$monthStart, $monthEnd])->sum('amount'), 2),
            'prev_month_total' => round((float) Advance::query()->whereBetween('date', [$prevStart, $prevEnd])->sum('amount'), 2),
            'year_discounted' => round((float) ($year->total ?? 0), 2),
            'year_closed_count' => (int) ($year->count ?? 0),
            'next_payroll_date' => $this->nextPayroll()?->period_end?->format('Y-m-d'),
        ];
    }

    /**
     * La nomina donde caeria el descuento: la abierta mas reciente.
     *
     * No hay un servicio que calcule «el periodo vigente», y no se inventa uno aqui: si no
     * hay nomina abierta, la pantalla lo dice en lugar de mostrar unas fechas supuestas.
     */
    protected function nextPayroll(): ?Payroll
    {
        return Payroll::query()
            ->whereIn('status', [Payroll::STATUS_DRAFT, Payroll::STATUS_CALCULATED, Payroll::STATUS_APPROVED])
            ->orderByDesc('period_end')
            ->first();
    }

    /**
     * Nomina en cuyo periodo cae una fecha.
     *
     * Para el comprobante importa el periodo donde cae la entrega, no el «proximo»: un
     * anticipo del mes pasado se descuenta en la nomina de ese mes. Si esa nomina no
     * existe todavia, se cae a la abierta mas reciente.
     */
    protected function payrollForDate(?CarbonInterface $date): ?Payroll
    {
        if ($date === null) {
            return $this->nextPayroll();
        }

        return Payroll::query()
            ->whereDate('period_start', '<=', $date->toDateString())
            ->whereDate('period_end', '>=', $date->toDateString())
            ->orderByDesc('period_end')
            ->first() ?? $this->nextPayroll();
    }

    /**
     * Comprobante imprimible: dos copias en una hoja carta (empresa y empleado).
     *
     * El PDF lo produce el navegador desde la pantalla, igual que el comprobante de
     * nomina; no se instala ninguna libreria de PDF.
     */
    public function receipt(Request $request, Advance $advance): Response
    {
        $advance->load([
            'employee:id,first_name,last_name,document_type,document_number,hire_date,payroll_mode',
            'creator:id,name,last_name',
            'company:id,name,nit,address,phone,logo',
        ]);

        $payroll = $this->payrollForDate($advance->date);
        $creator = trim(($advance->creator?->name ?? '').' '.($advance->creator?->last_name ?? ''));

        return Inertia::render('Advances/Receipt', [
            'advance' => $advance,
            'company' => $advance->company,
            'previous_balance' => $this->balanceBefore($advance),
            'period' => [
                'start' => $payroll?->period_start?->format('Y-m-d'),
                'end' => $payroll?->period_end?->format('Y-m-d'),
                'payroll_date' => $payroll?->period_end?->format('Y-m-d'),
                'payroll_name' => $payroll?->name,
            ],
            'issued_by' => $creator !== '' ? $creator : null,
            // Una sola copia cuando el comprobante ya se firmo y solo se reimprime.
            'copies' => (int) $request->input('copies') === 1 ? 1 : 2,
        ]);
    }

    /**
     * Saldo del empleado por anticipos ANTERIORES a este.
     *
     * Es la cifra que hace honesto el comprobante: el empleado firma sabiendo el total
     * que se le va a descontar, no solo lo que recibe hoy. Se excluye este mismo anticipo
     * —por fecha y, en empates, por id— para que la suma de la franja cuadre siempre.
     */
    protected function balanceBefore(Advance $advance): float
    {
        return round((float) Advance::query()
            ->where('employee_id', $advance->employee_id)
            ->where('remaining_amount', '>', 0)
            ->whereKeyNot($advance->id)
            ->where(function ($query) use ($advance) {
                $query->whereDate('date', '<', $advance->date)
                    ->orWhere(fn ($same) => $same
                        ->whereDate('date', '=', $advance->date)
                        ->where('id', '<', $advance->id));
            })
            ->sum('remaining_amount'), 2);
    }

    public function create(): Response
    {
        $payroll = $this->nextPayroll();

        return Inertia::render('Advances/Create', [
            'employees' => $this->employeesWithContext(),
            'period' => [
                'start' => $payroll?->period_start?->format('Y-m-d'),
                'end' => $payroll?->period_end?->format('Y-m-d'),
                'payroll_date' => $payroll?->period_end?->format('Y-m-d'),
                'payroll_name' => $payroll?->name,
            ],
        ]);
    }

    /**
     * Empleados del selector, con lo que el panel necesita para anticipar el efecto.
     *
     * Todo sale de tres consultas agregadas y no de una por empleado: con cien empleados,
     * el patron «una consulta por fila» convierte abrir el formulario en una espera.
     *
     * @return list<array<string, mixed>>
     */
    protected function employeesWithContext(): array
    {
        $employees = Employee::active()
            ->orderBy('first_name')
            ->get(['id', 'first_name', 'last_name', 'document_number']);

        if ($employees->isEmpty()) {
            return [];
        }

        $ids = $employees->pluck('id');

        $balances = Advance::query()
            ->whereIn('employee_id', $ids)
            ->where('remaining_amount', '>', 0)
            ->selectRaw('employee_id, SUM(remaining_amount) as pending')
            ->groupBy('employee_id')
            ->pluck('pending', 'employee_id');

        $year = Advance::query()
            ->whereIn('employee_id', $ids)
            ->whereYear('date', now()->year)
            ->selectRaw('employee_id, COUNT(*) as count, AVG(amount) as avg_amount')
            ->groupBy('employee_id')
            ->get()
            ->keyBy('employee_id');

        $lastAdvances = Advance::query()
            ->whereIn('employee_id', $ids)
            ->orderByDesc('date')
            ->orderByDesc('id')
            ->get(['id', 'employee_id', 'date', 'amount'])
            ->groupBy('employee_id')
            ->map(fn ($rows) => $rows->first());

        $avgNets = $this->averageNetByEmployee($ids->all());

        return $employees
            ->map(fn (Employee $employee) => [
                'id' => $employee->id,
                'first_name' => $employee->first_name,
                'last_name' => $employee->last_name,
                'document_number' => $employee->document_number,
                'pending_balance' => round((float) ($balances[$employee->id] ?? 0), 2),
                'avg_net' => round((float) ($avgNets[$employee->id] ?? 0), 2),
                'advances_this_year' => (int) ($year[$employee->id]->count ?? 0),
                'avg_amount' => round((float) ($year[$employee->id]->avg_amount ?? 0), 2),
                'last_advance' => isset($lastAdvances[$employee->id]) ? [
                    'date' => $lastAdvances[$employee->id]->date?->format('Y-m-d'),
                    'amount' => (float) $lastAdvances[$employee->id]->amount,
                ] : null,
            ])
            ->values()
            ->all();
    }

    /**
     * Neto promedio de los ultimos tres periodos pagados de cada empleado.
     *
     * Es la vara contra la que se mide si un anticipo deja el pago demasiado corto. Solo
     * cuentan las nominas pagadas: una en borrador todavia puede cambiar.
     *
     * @param  list<int>  $employeeIds
     * @return array<int, float>
     */
    protected function averageNetByEmployee(array $employeeIds): array
    {
        if ($employeeIds === []) {
            return [];
        }

        $rows = PayrollEmployee::query()
            ->withoutGlobalScopes()
            ->whereIn('employee_id', $employeeIds)
            ->whereHas('payroll', fn ($q) => $q->where('status', Payroll::STATUS_PAID))
            ->orderByDesc('id')
            ->get(['employee_id', 'net_payment']);

        return $rows
            ->groupBy('employee_id')
            // Los tres ultimos por empleado: un promedio de todo el historico arrastra
            // periodos viejos que ya no dicen cuanto gana hoy.
            ->map(fn ($items) => round((float) $items->take(3)->avg('net_payment'), 2))
            ->all();
    }

    public function store(StoreAdvanceRequest $request): RedirectResponse
    {
        $user = $request->user();
        $data = $request->validated();

        Advance::create([
            'company_id' => TenantContext::requireCompanyIdForWrite($user),
            'employee_id' => $data['employee_id'],
            'amount' => $data['amount'],
            'remaining_amount' => $data['amount'],
            'date' => $data['date'],
            'reason' => $data['reason'],
            'status' => Advance::STATUS_PENDING,
            'created_by' => $user->id,
        ]);

        return redirect()->route('advances.index')->with('success', 'Anticipo registrado.');
    }

    /**
     * Ficha del anticipo: cuanto queda y donde se esta descontando.
     */
    public function show(Advance $advance): Response
    {
        $advance->load([
            'employee:id,first_name,last_name,document_number',
            'creator:id,name,last_name',
        ]);

        return Inertia::render('Advances/Show', [
            'advance' => $advance,
            'applications' => $this->applicationsFor($advance),
            'employee_other' => Advance::query()
                ->where('employee_id', $advance->employee_id)
                ->whereKeyNot($advance->id)
                ->orderByDesc('date')
                ->limit(5)
                ->get(['id', 'date', 'amount', 'remaining_amount', 'reason']),
            'employee_pending_total' => round((float) Advance::query()
                ->where('employee_id', $advance->employee_id)
                ->where('remaining_amount', '>', 0)
                ->sum('remaining_amount'), 2),
            'can_delete' => bccomp((string) $advance->remaining_amount, (string) $advance->amount, 2) === 0,
        ]);
    }

    /**
     * Descuentos de este anticipo, hasta donde el sistema los recuerda.
     *
     * Solo queda rastro del descuento que esta programado ahora mismo: al pagar una
     * nomina, PayrollCalculationService resta el monto del saldo y limpia
     * `payroll_employee_id` y `applied_amount` (no hay tabla que guarde el historico). De
     * lo ya descontado se sabe el total —monto menos saldo— pero no en que nomina cayo
     * cada parte; la ficha lo dice asi en vez de repartirlo a ojo.
     *
     * @return list<array<string, mixed>>
     */
    protected function applicationsFor(Advance $advance): array
    {
        if ($advance->payroll_employee_id === null) {
            return [];
        }

        $payrollEmployee = PayrollEmployee::query()
            ->withoutGlobalScopes()
            ->with('payroll:id,name,period_start,period_end,status,paid_at')
            ->find($advance->payroll_employee_id);

        if ($payrollEmployee?->payroll === null) {
            return [];
        }

        $applied = round((float) ($advance->applied_amount ?? 0), 2);

        return [[
            'payroll_id' => $payrollEmployee->payroll->id,
            'payroll_name' => $payrollEmployee->payroll->name,
            'period_start' => $payrollEmployee->payroll->period_start?->format('Y-m-d'),
            'period_end' => $payrollEmployee->payroll->period_end?->format('Y-m-d'),
            'status' => $payrollEmployee->payroll->status,
            'paid_at' => $payrollEmployee->payroll->paid_at?->format('Y-m-d'),
            'applied_amount' => $applied,
            // Saldo que quedaria al pagar esa nomina.
            'balance_after' => round(max(0, (float) $advance->remaining_amount - $applied), 2),
        ]];
    }

    public function destroy(Advance $advance): RedirectResponse
    {
        if (bccomp((string) $advance->remaining_amount, (string) $advance->amount, 2) !== 0) {
            return back()->with('error', 'No se puede eliminar un anticipo que ya tiene descuentos aplicados (totales o parciales).');
        }

        $advance->delete();

        return redirect()->route('advances.index')->with('success', 'Anticipo eliminado.');
    }
}
