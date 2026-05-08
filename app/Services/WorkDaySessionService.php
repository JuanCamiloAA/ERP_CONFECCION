<?php

namespace App\Services;

use App\Models\Company;
use App\Models\Employee;
use App\Models\User;
use App\Models\WorkDaySession;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class WorkDaySessionService
{
    public function startSession(
        Company $company,
        Employee $employee,
        ?User $actor,
        string $source = WorkDaySession::SOURCE_EMPLOYEE,
    ): WorkDaySession {
        if (! $employee->is_active) {
            throw new \DomainException('El empleado no esta activo.');
        }
        if (! $employee->isPayrollFixedDaily()) {
            throw new \DomainException('Solo empleados con modalidad salario diario pueden registrar jornada.');
        }
        if ((int) $employee->company_id !== (int) $company->id) {
            throw new \DomainException('El empleado no pertenece a esta empresa.');
        }

        $workDate = Carbon::now(config('app.timezone'))->toDateString();

        return DB::transaction(function () use ($company, $employee, $actor, $source, $workDate) {
            $hasClosed = WorkDaySession::query()
                ->where('company_id', $company->id)
                ->where('employee_id', $employee->id)
                ->whereDate('work_date', $workDate)
                ->whereIn('status', [WorkDaySession::STATUS_CLOSED, WorkDaySession::STATUS_ADJUSTED])
                ->lockForUpdate()
                ->exists();

            if ($hasClosed) {
                throw new \DomainException('Ya existe una jornada cerrada para este dia. No se puede iniciar otra.');
            }

            $open = WorkDaySession::query()
                ->where('company_id', $company->id)
                ->where('employee_id', $employee->id)
                ->whereDate('work_date', $workDate)
                ->where('status', WorkDaySession::STATUS_OPEN)
                ->lockForUpdate()
                ->first();

            if ($open) {
                throw new \DomainException('Ya tienes una jornada abierta hoy.');
            }

            return WorkDaySession::create([
                'company_id' => $company->id,
                'employee_id' => $employee->id,
                'work_date' => $workDate,
                'clock_in_at' => now(),
                'clock_out_at' => null,
                'duration_minutes' => null,
                'status' => WorkDaySession::STATUS_OPEN,
                'source' => $source,
                'created_by_user_id' => $actor?->id,
            ]);
        });
    }

    public function closeSession(WorkDaySession $session, ?User $actor): WorkDaySession
    {
        if (! $session->isOpen()) {
            throw new \DomainException('La jornada no esta abierta.');
        }

        return DB::transaction(function () use ($session, $actor) {
            $session->refresh();
            if (! $session->isOpen()) {
                throw new \DomainException('La jornada ya fue cerrada.');
            }

            $out = now();
            $in = $session->clock_in_at;
            if ($out->lte($in)) {
                throw new \DomainException('La hora de salida debe ser posterior a la entrada.');
            }

            $minutes = $this->calculateDurationMinutes($in, $out);

            $session->update([
                'clock_out_at' => $out,
                'duration_minutes' => $minutes,
                'status' => WorkDaySession::STATUS_CLOSED,
                'closed_by_user_id' => $actor?->id,
            ]);

            return $session->fresh();
        });
    }

    public function getOpenSessionForDate(Employee $employee, string $workDate): ?WorkDaySession
    {
        return WorkDaySession::query()
            ->where('employee_id', $employee->id)
            ->whereDate('work_date', $workDate)
            ->where('status', WorkDaySession::STATUS_OPEN)
            ->first();
    }

    public function getTodayState(Employee $employee): array
    {
        $tz = config('app.timezone');
        $workDate = Carbon::now($tz)->toDateString();

        $sessions = WorkDaySession::query()
            ->where('employee_id', $employee->id)
            ->whereDate('work_date', $workDate)
            ->orderBy('id')
            ->get();

        $closed = $sessions->first(fn ($s) => in_array($s->status, [WorkDaySession::STATUS_CLOSED, WorkDaySession::STATUS_ADJUSTED], true));
        $open = $sessions->first(fn ($s) => $s->status === WorkDaySession::STATUS_OPEN);

        return [
            'work_date' => $workDate,
            'open' => $open,
            'closed' => $closed,
            'long_shift_warning' => $closed && ($closed->duration_minutes ?? 0) > 720,
        ];
    }

    public function calculateDurationMinutes(Carbon $clockIn, Carbon $clockOut): int
    {
        return max(0, (int) round($clockIn->diffInMinutes($clockOut)));
    }
}
