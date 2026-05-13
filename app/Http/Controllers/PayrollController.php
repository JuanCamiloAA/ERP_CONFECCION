<?php

namespace App\Http\Controllers;

use App\Http\Requests\Payroll\CalculatePayrollRequest;
use App\Http\Requests\Payroll\StorePayrollRequest;
use App\Models\Company;
use App\Models\Payroll;
use App\Models\PayrollConcept;
use App\Models\PayrollEmployee;
use App\Models\PayrollPeriodicity;
use App\Models\Production;
use App\Models\WorkDaySession;
use App\Services\PayrollCalculationService;
use App\Support\CompanyContext;
use App\Support\TenantContext;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Inertia\Inertia;
use Inertia\Response;

class PayrollController extends Controller
{
    public function __construct(protected PayrollCalculationService $calculator) {}

    public function index(Request $request): Response
    {
        $user = $request->user();
        $status = $request->input('status', 'all');
        $year = (int) $request->input('year', now()->year);
        $companyId = CompanyContext::id($user);

        $query = Payroll::query()
            ->with(['company:id,name'])
            ->withCount('payrollEmployees');

        if ($companyId) {
            $query->where('company_id', $companyId);
        }

        if ($status !== 'all') {
            $query->where('status', $status);
        }
        if ($year) {
            $query->whereYear('period_start', $year);
        }

        if ($user->isEmployee() && ! $user->isAdmin()) {
            $query->whereHas('payrollEmployees', fn ($q) => $q->where('employee_id', $user->employee_id));
        }

        $payrolls = $query->orderByDesc('period_start')->paginate(15)->withQueryString();

        return Inertia::render('Payrolls/Index', [
            'payrolls' => $payrolls,
            'filters' => ['status' => $status, 'year' => $year],
        ]);
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

        return Inertia::render('Payrolls/Create', [
            'defaultPayrollType' => $default,
        ]);
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
                COALESCE(SUM(adjustments_subtotal), 0) as total_adjustments,
                COALESCE(SUM(advances_discount), 0) as total_advances,
                COALESCE(SUM(
                    COALESCE(production_total, 0)
                    + COALESCE(daily_work_subtotal, 0)
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

        $payrollEmployeeRows = (clone $peBase)
            ->with([
                'employee:id,first_name,last_name,document_number,payroll_mode,daily_salary,minutes_per_full_workday',
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

        $workSessionsByEmployee = [];
        if ($idsForDetail !== []) {
            $workSessionsByEmployee = WorkDaySession::query()
                ->withoutGlobalScopes()
                ->where('company_id', $payroll->company_id)
                ->whereBetween('work_date', [
                    $payroll->period_start->format('Y-m-d'),
                    $payroll->period_end->format('Y-m-d'),
                ])
                ->whereIn('employee_id', $idsForDetail)
                ->orderBy('work_date')
                ->orderBy('id')
                ->get()
                ->groupBy(fn ($s) => (string) $s->employee_id)
                ->map(fn ($sessions) => $sessions->values()->all())
                ->all();
        }

        $productionsByEmployee = [];
        if ($idsForDetail !== []) {
            $productionsByEmployee = Production::query()
                ->withoutGlobalScopes()
                ->with(['reference:id,code,name', 'operation:id,name'])
                ->whereBetween('date', [
                    $payroll->period_start->format('Y-m-d'),
                    $payroll->period_end->format('Y-m-d'),
                ])
                ->whereIn('status', [Production::STATUS_CONFIRMED, Production::STATUS_PENDING])
                ->where(function ($q) use ($payroll) {
                    $cid = (int) $payroll->company_id;
                    $q->where('company_id', $cid)
                        ->orWhereHas('reference', fn ($r) => $r->where('company_id', $cid));
                })
                ->whereIn('employee_id', $idsForDetail)
                ->orderBy('date')
                ->orderBy('id')
                ->get()
                ->groupBy(fn ($p) => (string) $p->employee_id)
                ->map(fn ($rows) => $rows->values()->all())
                ->all();
        }

        return Inertia::render('Payrolls/Show', [
            'payroll' => $payroll,
            'payrollEmployees' => $payrollEmployees,
            'payrollEmployeeTotals' => [
                'employee_count' => (int) ($totalsRow->employee_count ?? 0),
                'total_production' => (float) ($totalsRow->total_production ?? 0),
                'total_daily' => (float) ($totalsRow->total_daily ?? 0),
                'total_adjustments' => (float) ($totalsRow->total_adjustments ?? 0),
                'total_gross' => (float) ($totalsRow->total_gross ?? 0),
                'total_advances' => (float) ($totalsRow->total_advances ?? 0),
                'total_deductions' => $totalDeductions,
                'show_daily_column' => $showDailyColumn,
            ],
            'workSessionsByEmployee' => $workSessionsByEmployee,
            'productionsByEmployee' => $productionsByEmployee,
            'payrollConcepts' => $payrollConcepts,
        ]);
    }

    public function calculate(CalculatePayrollRequest $request, Payroll $payroll): RedirectResponse
    {
        $this->authorize('calculate', $payroll);
        $this->ensurePayrollBelongsToActiveCompany($request, $payroll);

        if (! $payroll->canBeCalculated()) {
            return back()->with('error', 'Esta nomina no puede ser calculada en su estado actual.');
        }

        $request->validated();

        $this->calculator->calculate(
            $payroll,
            $request->input('employee_adjustments'),
            $request->user()
        );

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

        if (! $payroll->isEditable()) {
            return back()->with('error', 'Solo se pueden eliminar nominas en borrador o calculadas.');
        }

        $payroll->payrollEmployees()->delete();
        $payroll->delete();

        return redirect()->route('payrolls.index')->with('success', 'Nomina eliminada.');
    }

    public function export(Request $request, Payroll $payroll): Response
    {
        $this->authorize('view', $payroll);
        $this->ensurePayrollBelongsToActiveCompany($request, $payroll);

        $payroll->load([
            'company:id,name,nit,address,phone',
            'payrollEmployees.employee:id,first_name,last_name,document_number,payroll_mode',
        ]);

        return Inertia::render('Payrolls/Print', [
            'payroll' => $payroll,
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
