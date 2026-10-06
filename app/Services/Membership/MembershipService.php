<?php

namespace App\Services\Membership;

use App\Models\BillingCycle;
use App\Models\Company;
use App\Models\CompanyBillingCharge;
use App\Models\CompanyMembershipEvent;
use App\Models\MembershipPlan;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * El unico que mueve el estado de la membresia de una empresa.
 *
 *     prueba / activa  --vence-->  gracia  --pasa la gracia-->  suspendida
 *            ^                                                       |
 *            +------------------ pago aprobado ----------------------+
 *
 * El acceso dura hasta el final del dia de `membership_ends_at` (asi funcionaba antes de los
 * estados y asi lo sigue entendiendo quien fija la fecha en Empresas): la gracia arranca al
 * dia siguiente. Cada cambio deja su renglon en la bitacora.
 */
class MembershipService
{
    public function graceDays(): int
    {
        return max(0, (int) config('membership.grace_days', 5));
    }

    /** El momento en que la empresa deja de estar al dia: el dia siguiente al vencimiento. */
    public static function expiresAt(Company $company): ?Carbon
    {
        return $company->membership_ends_at?->copy()->startOfDay()->addDay();
    }

    public static function isExpired(Company $company, ?Carbon $now = null): bool
    {
        $expiresAt = self::expiresAt($company);

        return $expiresAt !== null && ($now ?? now())->gte($expiresAt);
    }

    /** Dias que faltan para el vencimiento; negativo si ya vencio. Null si no vence. */
    public static function daysLeft(Company $company): ?int
    {
        if ($company->membership_ends_at === null) {
            return null;
        }

        return (int) Carbon::today()->diffInDays($company->membership_ends_at->copy()->startOfDay(), false);
    }

    /**
     * El estado que corresponde a las fechas de la empresa. La prueba se conserva mientras no
     * venza; una vencida cae en gracia o suspendida segun cuanto lleva vencida.
     *
     * @return array{0: string, 1: ?Carbon} estado y fin de la gracia
     */
    public function statusForDates(Company $company): array
    {
        if (! self::isExpired($company)) {
            $status = $company->membership_status === Company::MEMBERSHIP_TRIAL
                ? Company::MEMBERSHIP_TRIAL
                : Company::MEMBERSHIP_ACTIVE;

            return [$status, null];
        }

        $graceEndsAt = self::expiresAt($company)->addDays($this->graceDays());

        return [$graceEndsAt->isFuture() ? Company::MEMBERSHIP_GRACE : Company::MEMBERSHIP_SUSPENDED, $graceEndsAt];
    }

    /**
     * La membresia con que nace una empresa. Si el plan trae dias de prueba y nadie fijo un
     * vencimiento, arranca en `prueba` por esos dias; si no, el estado sale de las fechas.
     */
    public function provision(Company $company, ?BillingCycle $cycle = null, ?User $actor = null): void
    {
        $company->loadMissing('membershipPlan');
        $plan = $company->membershipPlan;
        $cycle ??= $plan ? BillingCycle::default() : null;

        $company->billing_cycle_id = $cycle?->id;

        if ($plan && (int) $plan->trial_days > 0 && $company->membership_ends_at === null) {
            $company->membership_started_at ??= Carbon::today();
            $company->membership_ends_at = Carbon::today()->addDays((int) $plan->trial_days);
            $company->membership_status = Company::MEMBERSHIP_TRIAL;
        }

        [$status, $graceEndsAt] = $this->statusForDates($company);

        $company->forceFill(['membership_status' => $status, 'grace_ends_at' => $graceEndsAt])->save();

        $this->record($company, CompanyMembershipEvent::PROVISIONED, [
            'plan' => $plan?->name,
            'cycle' => $cycle?->name,
            'status' => $status,
            'ends_at' => $company->membership_ends_at?->toDateString(),
        ], $actor);
    }

    /**
     * El periodo que pagaria un cobro hecho hoy: si la empresa esta al dia, empieza cuando
     * termina el actual; si venia de gracia o suspendida, empieza hoy.
     *
     * @return array{starts: Carbon, ends: Carbon, plan: ?MembershipPlan, cycle: ?BillingCycle}
     */
    public function nextPeriod(Company $company): array
    {
        $company->loadMissing(['membershipPlan', 'billingCycle']);
        $plan = $company->membershipPlan;
        $cycle = $company->billingCycle ?? ($plan ? BillingCycle::default() : null);

        $upToDate = in_array($company->membership_status, [Company::MEMBERSHIP_ACTIVE, Company::MEMBERSHIP_TRIAL], true)
            && $company->membership_ends_at !== null
            && ! self::isExpired($company);

        $starts = $upToDate ? $company->membership_ends_at->copy() : Carbon::today();
        $ends = $starts->copy()->addMonthsNoOverflow(max(1, (int) ($cycle?->months ?? 1)));

        return ['starts' => $starts, 'ends' => $ends, 'plan' => $plan, 'cycle' => $cycle];
    }

    /**
     * Cuanto y que cubre el proximo cobro. `amount` es null si el plan no tiene precio.
     *
     * @return array{amount: ?int, plan: MembershipPlan, cycle: ?BillingCycle, starts: Carbon, ends: Carbon, concept: string}
     */
    public function quote(Company $company): array
    {
        $period = $this->nextPeriod($company);

        if (! $period['plan']) {
            throw ValidationException::withMessages(['membership' => 'La empresa no tiene plan asignado.']);
        }

        $amount = $period['cycle'] ? MembershipPricing::priceFor($period['plan'], $period['cycle']) : null;

        return [
            'amount' => $amount,
            'plan' => $period['plan'],
            'cycle' => $period['cycle'],
            'starts' => $period['starts'],
            'ends' => $period['ends'],
            'concept' => trim("Membresía {$period['plan']->name}".($period['cycle'] ? " · {$period['cycle']->name}" : '')),
        ];
    }

    /**
     * Crea el cobro en `pendiente`, antes de tocar la pasarela. `$amount` solo lo usa el
     * super admin al registrar un pago por fuera con un valor pactado.
     */
    public function createPendingCharge(Company $company, string $method, ?User $user, ?string $note = null, ?float $amount = null): CompanyBillingCharge
    {
        $quote = $this->quote($company);
        $amount ??= $quote['amount'];

        if ($amount === null || $amount <= 0) {
            throw ValidationException::withMessages([
                'amount' => 'El plan no tiene precio configurado: no hay nada que cobrar.',
            ]);
        }

        return CompanyBillingCharge::query()->create([
            'company_id' => $company->id,
            'membership_plan_id' => $quote['plan']->id,
            'billing_cycle_id' => $quote['cycle']?->id,
            'amount' => $amount,
            'currency' => (string) (($company->settings['currency'] ?? null) ?: 'COP'),
            'concept' => Str::limit($note ? $quote['concept'].' · '.$note : $quote['concept'], 250, ''),
            'reference' => self::newReference($company),
            'status' => CompanyBillingCharge::STATUS_PENDING,
            'method' => $method,
            'period_starts_at' => $quote['starts'],
            'period_ends_at' => $quote['ends'],
            'attempts' => 1,
            'charged_at' => now(),
            'created_by_user_id' => $user?->id,
        ]);
    }

    /**
     * Liquida un cobro aprobado: renueva el periodo que el cobro dice que pago.
     *
     * Idempotente: un evento repetido o una segunda lectura encuentran el cobro ya pagado y
     * no renuevan dos veces. Devuelve si hubo renovacion.
     */
    public function approveCharge(CompanyBillingCharge $charge, ?string $gatewayReference = null): bool
    {
        return DB::transaction(function () use ($charge, $gatewayReference) {
            /** @var CompanyBillingCharge $locked */
            $locked = CompanyBillingCharge::query()->lockForUpdate()->findOrFail($charge->id);

            if ($locked->isPaid()) {
                return false;
            }

            /** @var Company $company */
            $company = Company::query()->lockForUpdate()->findOrFail($locked->company_id);
            $previous = $company->membership_status;

            // El periodo se recalcula al aprobar: si el cobro quedo pendiente dias, la empresa
            // pudo pasar a gracia en el entretanto y el periodo arranca hoy.
            $period = $this->nextPeriod($company);
            $months = max(1, (int) ($locked->billingCycle?->months ?? $period['cycle']?->months ?? 1));
            $starts = $period['starts'];
            $ends = $starts->copy()->addMonthsNoOverflow($months);

            $locked->forceFill([
                'status' => CompanyBillingCharge::STATUS_PAID,
                'gateway_reference' => $gatewayReference ?? $locked->gateway_reference,
                'paid_at' => now(),
                'charged_at' => $locked->charged_at ?? now(),
                'period_starts_at' => $starts,
                'period_ends_at' => $ends,
                'failure_reason' => null,
            ])->save();

            $company->forceFill([
                // El cobro dice que plan y periodo pago.
                'membership_plan_id' => $locked->membership_plan_id ?? $company->membership_plan_id,
                'billing_cycle_id' => $locked->billing_cycle_id ?? $company->billing_cycle_id,
                'membership_status' => Company::MEMBERSHIP_ACTIVE,
                'membership_started_at' => $company->membership_started_at ?? now(),
                'membership_ends_at' => $ends,
                'grace_ends_at' => null,
                'next_charge_at' => $company->auto_debit_enabled ? $ends->toDateString() : null,
            ])->save();

            $actor = $locked->created_by_user_id ? User::query()->find($locked->created_by_user_id) : null;

            $this->record($company, CompanyMembershipEvent::RENEWED, [
                'reference' => $locked->reference,
                'amount' => (float) $locked->amount,
                'method' => $locked->method,
                'from' => $starts->toDateString(),
                'until' => $ends->toDateString(),
                'previous_status' => $previous,
            ], $actor);

            if (in_array($previous, [Company::MEMBERSHIP_GRACE, Company::MEMBERSHIP_SUSPENDED], true)) {
                $this->record($company, CompanyMembershipEvent::REACTIVATED, ['reference' => $locked->reference], $actor);
            }

            return true;
        });
    }

    /**
     * Un cobro que no paso. No cambia la membresia: la gracia la mueve el calendario.
     */
    public function failCharge(CompanyBillingCharge $charge, ?string $reason, ?string $gatewayReference = null, string $status = CompanyBillingCharge::STATUS_FAILED): void
    {
        DB::transaction(function () use ($charge, $reason, $gatewayReference, $status) {
            /** @var CompanyBillingCharge $locked */
            $locked = CompanyBillingCharge::query()->lockForUpdate()->findOrFail($charge->id);

            // Uno pagado no se deshace por un evento viejo que llega tarde.
            if ($locked->isPaid()) {
                return;
            }

            $locked->forceFill([
                'status' => $status,
                'failure_reason' => $reason ? Str::limit($reason, 250, '') : null,
                'gateway_reference' => $gatewayReference ?? $locked->gateway_reference,
            ])->save();

            $this->record($locked->company, CompanyMembershipEvent::CHARGE_FAILED, [
                'reference' => $locked->reference,
                'status' => $status,
                'reason' => $reason,
            ]);
        });
    }

    /** Un pago recibido por fuera (transferencia, efectivo) que registra el super admin. */
    public function recordManualPayment(Company $company, User $user, string $note, ?float $amount = null): CompanyBillingCharge
    {
        $charge = $this->createPendingCharge($company, CompanyBillingCharge::METHOD_MANUAL, $user, $note, $amount);
        $this->approveCharge($charge);

        return $charge->refresh();
    }

    /** La prueba o el periodo vencieron sin renovar: empieza la gracia. */
    public function startGrace(Company $company): void
    {
        $company->forceFill([
            'membership_status' => Company::MEMBERSHIP_GRACE,
            'grace_ends_at' => (self::expiresAt($company) ?? now())->copy()->addDays($this->graceDays()),
        ])->save();

        $this->record($company, CompanyMembershipEvent::GRACE_STARTED, [
            'until' => $company->grace_ends_at?->toIso8601String(),
        ]);
    }

    public function suspend(Company $company): void
    {
        $company->forceFill(['membership_status' => Company::MEMBERSHIP_SUSPENDED])->save();

        $this->record($company, CompanyMembershipEvent::SUSPENDED, [
            'grace_ended_at' => $company->grace_ends_at?->toIso8601String(),
        ]);
    }

    /**
     * Una empresa en gracia o suspendida cuyo vencimiento quedo en el futuro (alguien lo
     * corrigio por fuera de Empresas) vuelve a estar activa.
     */
    public function reactivateIfCurrent(Company $company): bool
    {
        if (! in_array($company->membership_status, [Company::MEMBERSHIP_GRACE, Company::MEMBERSHIP_SUSPENDED], true)
            || self::isExpired($company)) {
            return false;
        }

        $previous = $company->membership_status;

        $company->forceFill(['membership_status' => Company::MEMBERSHIP_ACTIVE, 'grace_ends_at' => null])->save();

        $this->record($company, CompanyMembershipEvent::REACTIVATED, [
            'previous_status' => $previous,
            'ends_at' => $company->membership_ends_at?->toDateString(),
        ]);

        return true;
    }

    /**
     * El super admin cambia plan, periodo o fechas desde Empresas. El estado se recalcula con
     * las fechas nuevas: alargar el vencimiento de una suspendida la reactiva, como antes
     * bastaba con cambiar la fecha para volver a dejarla entrar.
     *
     * @param  array{membership_plan_id?: ?int, billing_cycle_id?: ?int, membership_started_at?: mixed, membership_ends_at?: mixed}  $changes
     */
    public function manualUpdate(Company $company, array $changes, ?string $reason, User $user): void
    {
        $before = $this->snapshot($company);
        $types = [];

        if (array_key_exists('membership_plan_id', $changes) && (int) $changes['membership_plan_id'] !== (int) $company->membership_plan_id) {
            $types[] = CompanyMembershipEvent::PLAN_CHANGED;
        }

        if (array_key_exists('billing_cycle_id', $changes) && (int) $changes['billing_cycle_id'] !== (int) $company->billing_cycle_id) {
            $types[] = CompanyMembershipEvent::CYCLE_CHANGED;
        }

        $company->fill($changes);

        if ($company->isDirty('membership_ends_at') && $company->membership_ends_at !== null && ! self::isExpired($company)) {
            $types[] = CompanyMembershipEvent::MANUAL_EXTENSION;
        }

        [$status, $graceEndsAt] = $this->statusForDates($company);
        $company->forceFill(['membership_status' => $status, 'grace_ends_at' => $graceEndsAt]);

        if (! $company->isDirty()) {
            return;
        }

        // Con renovacion automatica, el proximo cobro sigue al vencimiento nuevo.
        if ($company->isDirty('membership_ends_at') && $company->auto_debit_enabled) {
            $company->next_charge_at = $company->membership_ends_at?->toDateString();
        }

        $previous = $company->getOriginal('membership_status');
        $company->save();

        $data = ['before' => $before, 'after' => $this->snapshot($company), 'reason' => $reason ?: null];

        foreach ($types ?: [CompanyMembershipEvent::MANUAL_UPDATE] as $type) {
            $this->record($company, $type, $data, $user);
        }

        if (in_array($previous, [Company::MEMBERSHIP_GRACE, Company::MEMBERSHIP_SUSPENDED], true)
            && in_array($status, [Company::MEMBERSHIP_ACTIVE, Company::MEMBERSHIP_TRIAL], true)) {
            $this->record($company, CompanyMembershipEvent::REACTIVATED, ['previous_status' => $previous], $user);
        }
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function record(Company $company, string $type, array $data = [], ?User $user = null): CompanyMembershipEvent
    {
        return CompanyMembershipEvent::query()->create([
            'company_id' => $company->id,
            'type' => $type,
            'data' => $data,
            'user_id' => $user?->id,
            'created_at' => now(),
        ]);
    }

    public static function newReference(Company $company): string
    {
        do {
            $reference = CompanyBillingCharge::REFERENCE_PREFIX.$company->id.'-'.Str::upper(Str::random(12));
        } while (CompanyBillingCharge::query()->where('reference', $reference)->exists());

        return $reference;
    }

    /**
     * Lo que se compara antes y despues de un ajuste manual, con nombres y no ids.
     *
     * @return array<string, mixed>
     */
    protected function snapshot(Company $company): array
    {
        return [
            'plan' => $company->membership_plan_id ? MembershipPlan::query()->whereKey($company->membership_plan_id)->value('name') : null,
            'cycle' => $company->billing_cycle_id ? BillingCycle::query()->whereKey($company->billing_cycle_id)->value('name') : null,
            'status' => $company->membership_status,
            'started_at' => $company->membership_started_at?->toDateString(),
            'ends_at' => $company->membership_ends_at?->toDateString(),
        ];
    }
}
