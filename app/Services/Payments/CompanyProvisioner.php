<?php

namespace App\Services\Payments;

use App\Helpers\PermissionHelper;
use App\Models\Company;
use App\Models\CompanyBillingCharge;
use App\Models\CompanySignup;
use App\Models\Role;
use App\Models\User;
use App\Services\CompanyDefaultRolesService;
use Illuminate\Auth\Events\Registered;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Crea la empresa y su administrador a partir de un alta ya pagada.
 *
 * Es el unico sitio donde nace una empresa desde el alta publica, para que no haya dos
 * versiones del mismo procedimiento. Todo va en una transaccion: una empresa sin rol
 * admin, o un admin sin permisos, es peor que un alta fallida.
 *
 * Ojo con los permisos: desde que el rol es solo una plantilla, lo que un usuario puede
 * hacer sale de `model_has_permissions`, no de su rol. El registro anterior solo llamaba a
 * `syncRoles()` y por eso toda cuenta creada desde `/register` entraba sin poder abrir
 * nada. Aqui se asignan tambien los permisos directos, que es lo que de verdad manda.
 */
class CompanyProvisioner
{
    public function __construct(protected CompanyDefaultRolesService $defaultRoles) {}

    /**
     * @return array{company: Company, user: User}
     */
    public function fromSignup(CompanySignup $signup): array
    {
        return DB::transaction(function () use ($signup) {
            $plan = $signup->membershipPlan;
            $startsAt = Carbon::today();
            // Primer mes pagado: la membresia vale hasta el mismo dia del mes siguiente.
            $endsAt = $startsAt->copy()->addMonth();

            $company = Company::create([
                'name' => $signup->company_name,
                'nit' => $signup->company_nit,
                'phone' => $signup->company_phone,
                'email' => $signup->company_email,
                'is_active' => true,
                'membership_plan_id' => $signup->membership_plan_id,
                'membership_started_at' => $startsAt,
                'membership_ends_at' => $endsAt,
                'payment_gateway' => PaymentGatewayResolver::PROVIDER,
                'next_charge_at' => $endsAt,
            ]);

            // Crea admin, supervisor, contable, consulta y operario de esta empresa.
            $this->defaultRoles->ensureDefaultRolesForCompany($company, false);

            $user = User::create([
                'company_id' => $company->id,
                'name' => $signup->admin_name,
                'last_name' => $signup->admin_last_name,
                'email' => $signup->admin_email,
                // Ya viene hasheada del alta: no se vuelve a hashear.
                'password' => $signup->admin_password,
                'is_active' => true,
                'email_verified_at' => now(),
            ]);

            $adminRole = Role::query()
                ->where('name', 'admin')
                ->where('guard_name', 'web')
                ->where('company_id', $company->id)
                ->firstOrFail();

            $user->syncRoles([$adminRole]);
            // Lo que de verdad decide que puede hacer. Sin esto entra y no ve nada.
            $user->syncPermissions(PermissionHelper::presetPermissions('admin'));
            $user->flushEffectivePermissionCache();

            // El cobro queda en el historial que ya muestra «Mi empresa».
            CompanyBillingCharge::create([
                'company_id' => $company->id,
                'membership_plan_id' => $signup->membership_plan_id,
                'amount' => $signup->amount_in_cents / 100,
                'currency' => $signup->currency,
                'concept' => 'Primer mes — Plan '.($plan?->name ?? 'membresía'),
                'status' => CompanyBillingCharge::STATUS_PAID,
                'gateway_reference' => $signup->transaction_id,
                'charged_at' => $signup->paid_at ?? now(),
            ]);

            $signup->forceFill([
                'status' => CompanySignup::STATUS_PAID,
                'company_id' => $company->id,
            ])->save();

            event(new Registered($user));

            return ['company' => $company, 'user' => $user];
        });
    }
}
