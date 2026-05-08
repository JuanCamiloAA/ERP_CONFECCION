<?php

namespace App\Http\Controllers;

use App\Models\Employee;
use App\Models\WorkDaySession;
use App\Services\WorkDaySessionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class WorkDaySessionController extends Controller
{
    public function __construct(protected WorkDaySessionService $sessions) {}

    public function today(Request $request): JsonResponse
    {
        $user = $request->user();
        $requestedEmployeeId = $request->integer('employee_id') ?: null;

        $employee = null;

        if ($requestedEmployeeId && $user?->can('productions.index.workday_others')) {
            $employee = Employee::query()
                ->withoutGlobalScopes()
                ->where('company_id', $user->company_id)
                ->find($requestedEmployeeId);
        } elseif ($user?->employee_id) {
            $employee = Employee::query()->find($user->employee_id);
        }

        if (! $employee) {
            return response()->json(['applicable' => false]);
        }

        if (! $employee->isPayrollFixedDaily()) {
            return response()->json([
                'applicable' => false,
                'payroll_mode' => $employee->payroll_mode ?? Employee::PAYROLL_MODE_OPERATIONS,
            ]);
        }

        $state = $this->sessions->getTodayState($employee);

        return response()->json([
            'applicable' => true,
            'payroll_mode' => 'fixed_daily',
            'employee_id' => $employee->id,
            'work_date' => $state['work_date'],
            'open' => $state['open'],
            'closed' => $state['closed'],
            'long_shift_warning' => $state['long_shift_warning'],
        ]);
    }

    public function start(Request $request): RedirectResponse
    {
        $user = $request->user();
        $companyId = (int) $user->company_id;
        $company = $user->company ?? \App\Models\Company::find($companyId);
        if (! $company) {
            return back()->with('error', 'Empresa no encontrada.');
        }

        $validated = $request->validate([
            'employee_id' => ['nullable', 'integer', 'exists:employees,id'],
        ]);

        $targetId = (int) ($validated['employee_id'] ?? $user->employee_id ?? 0);
        if ($targetId < 1) {
            return back()->with('error', 'No se pudo determinar el empleado.');
        }

        if ($targetId !== (int) $user->employee_id) {
            if (! $user->can('productions.index.workday_others')) {
                abort(403, 'No puedes iniciar jornada para otro empleado.');
            }
        }

        if (! $user->can('productions.index.workday_start')) {
            abort(403, 'No tienes permiso para iniciar jornada.');
        }

        $employee = Employee::query()->withoutGlobalScopes()
            ->where('company_id', $companyId)
            ->findOrFail($targetId);

        try {
            $source = $targetId !== (int) $user->employee_id || $user->isAdmin()
                ? WorkDaySession::SOURCE_ADMIN
                : WorkDaySession::SOURCE_EMPLOYEE;

            $this->sessions->startSession(
                $company,
                $employee,
                $user,
                $source
            );
        } catch (\DomainException $e) {
            return back()->with('error', $e->getMessage());
        }

        return back()->with('success', 'Jornada iniciada.');
    }

    public function close(Request $request, WorkDaySession $workDaySession): RedirectResponse
    {
        $user = $request->user();

        if ((int) $workDaySession->company_id !== (int) $user->company_id && ! $user->isSuperAdmin()) {
            abort(403);
        }

        if ((int) $workDaySession->employee_id !== (int) $user->employee_id) {
            if (! $user->can('productions.index.workday_others')) {
                abort(403, 'No puedes cerrar la jornada de otro empleado.');
            }
        }

        if (! $user->can('productions.index.workday_close')) {
            abort(403, 'No tienes permiso para cerrar jornada.');
        }

        try {
            $this->sessions->closeSession($workDaySession, $user);
        } catch (\DomainException $e) {
            return back()->with('error', $e->getMessage());
        }

        return back()->with('success', 'Jornada cerrada.');
    }
}
