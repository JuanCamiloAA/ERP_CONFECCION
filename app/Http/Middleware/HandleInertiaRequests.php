<?php

namespace App\Http\Middleware;

use App\Helpers\PermissionHelper;
use App\Models\Company;
use App\Models\Employee;
use App\Models\PayrollPeriodicity;
use App\Services\Files\MediaUrlResolver;
use App\Support\BrandIcon;
use App\Support\TenantContext;
use Illuminate\Http\Request;
use Inertia\Middleware;
use Tighten\Ziggy\Ziggy;

class HandleInertiaRequests extends Middleware
{
    protected $rootView = 'app';

    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    public function share(Request $request): array
    {
        $user = $request->user();
        $this->refreshSuperAdminCompanySession($user);

        return array_merge(parent::share($request), [
            'appName' => config('app.name'),
            'brandIconUrl' => fn () => BrandIcon::url(),
            'auth' => [
                'user' => $user ? $this->buildUserPayload($user) : null,
            ],
            'flash' => [
                'success' => fn () => $request->session()->get('success'),
                'error' => fn () => $request->session()->get('error'),
                'warning' => fn () => $request->session()->get('warning'),
                'info' => fn () => $request->session()->get('info'),
                'temporary_password' => fn () => $request->session()->get('temporary_password'),
            ],
            'ziggy' => fn () => array_merge((new Ziggy)->toArray(), [
                'location' => $request->url(),
            ]),
            'activeCompany' => fn () => $this->getActiveCompany($user),
            'permissionMatrix' => fn () => $request->routeIs('roles.*')
                ? PermissionHelper::getPermissionMatrix()
                : null,
            'payrollPeriodicities' => fn () => $user
                ? PayrollPeriodicity::query()->active()->ordered()->get(['id', 'code', 'name', 'sort_order'])->all()
                : [],
            'activeCompanyId' => fn () => $this->sharedActiveCompanyId($user),
            'companiesForSelector' => fn () => $this->companiesForSuperAdminSelector($user),
            'isConsolidatedView' => fn () => (bool) ($user && $user->isSuperAdmin() && TenantContext::isConsolidatedSuperAdmin($user)),
        ]);
    }

    protected function refreshSuperAdminCompanySession($user): void
    {
        if (! $user?->isSuperAdmin()) {
            return;
        }

        TenantContext::migrateLegacySession();

        $id = TenantContext::superAdminSelectedCompanyId();
        if ($id === null) {
            return;
        }

        $ok = Company::query()->whereKey($id)->where('is_active', true)->exists();
        if (! $ok) {
            session()->forget(TenantContext::SESSION_KEY);
            session()->flash('warning', 'La empresa seleccionada ya no esta disponible. Se muestra la vista consolidada.');
        }
    }

    /**
     * @return int|null null = todas (solo super admin) o sin empresa.
     */
    protected function sharedActiveCompanyId($user): ?int
    {
        if (! $user) {
            return null;
        }

        if ($user->isSuperAdmin()) {
            return TenantContext::superAdminSelectedCompanyId();
        }

        return $user->company_id ? (int) $user->company_id : null;
    }

    /**
     * @return list<array{id: int, name: string, is_active: bool}>
     */
    protected function companiesForSuperAdminSelector($user): array
    {
        if (! $user?->isSuperAdmin()) {
            return [];
        }

        return Company::query()
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'is_active'])
            ->map(fn (Company $c) => [
                'id' => $c->id,
                'name' => $c->name,
                'is_active' => (bool) $c->is_active,
            ])
            ->all();
    }

    protected function buildUserPayload($user): array
    {
        $user->loadMissing(['company', 'employee', 'roles.permissions']);

        $resolver = app(MediaUrlResolver::class);

        $primaryRole = $user->roles->first();
        $rolePermissionNames = $user->roles
            ->flatMap(fn ($r) => $r->permissions->pluck('name'))
            ->unique()
            ->values()
            ->toArray();

        return [
            'id' => $user->id,
            'name' => $user->name,
            'last_name' => $user->last_name,
            'full_name' => trim(($user->name ?? '').' '.($user->last_name ?? '')),
            'email' => $user->email,
            'avatar' => $resolver->url($user->getAttributes()['avatar'] ?? null),
            'phone' => $user->phone,
            'is_active' => (bool) $user->is_active,
            'is_employee' => $user->isEmployee(),
            'is_super_admin' => $user->isSuperAdmin(),
            'is_admin' => $user->isAdmin(),
            'employee_id' => $user->employee_id,
            'company_id' => $user->company_id,
            'company' => $user->company ? [
                'id' => $user->company->id,
                'name' => $user->company->name,
                'logo' => $resolver->url($user->company->getAttributes()['logo'] ?? null),
            ] : null,
            'role' => $primaryRole ? [
                'id' => $primaryRole->id,
                'name' => $primaryRole->name,
                'display_name' => $primaryRole->display_name ?? $primaryRole->name,
                'color' => $primaryRole->color ?? '#6366f1',
                'is_system' => (bool) ($primaryRole->is_system ?? false),
            ] : null,
            'permissions' => $user->getEffectivePermissionNames(),
            'role_permissions' => $rolePermissionNames,
            'accessible_pages' => $user->getAccessiblePages(),
            'password_change_required' => (bool) $user->password_change_required,
            'last_login_at' => $user->last_login_at?->toIso8601String(),
            'initials' => $user->initials,
            'employee_profile' => $user->employee ? [
                'id' => $user->employee->id,
                'payroll_mode' => $user->employee->payroll_mode ?? Employee::PAYROLL_MODE_OPERATIONS,
                'full_name' => $user->employee->full_name,
            ] : null,
        ];
    }

    protected function getActiveCompany($user)
    {
        if (! $user) {
            return null;
        }

        if ($user->isSuperAdmin()) {
            $companyId = TenantContext::superAdminSelectedCompanyId();
            if ($companyId) {
                return Company::find($companyId);
            }

            return null;
        }

        return $user->company;
    }
}
