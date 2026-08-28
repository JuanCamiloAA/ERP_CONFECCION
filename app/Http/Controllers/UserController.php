<?php

namespace App\Http\Controllers;

use App\Helpers\PermissionHelper;
use App\Http\Requests\User\StoreUserRequest;
use App\Http\Requests\User\UpdateUserRequest;
use App\Models\AccessLog;
use App\Models\Company;
use App\Models\Role;
use App\Models\User;
use App\Services\CompanyDefaultRolesService;
use App\Services\Membership\MembershipStaffLimiter;
use App\Services\PermissionInsightService;
use App\Services\UserPermissionOverrideService;
use App\Services\UserPermissionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Hash;
use Inertia\Inertia;
use Inertia\Response;

class UserController extends Controller
{
    public function index(Request $request): Response
    {
        $search = trim((string) $request->input('search', ''));
        $status = $request->input('status', 'all');

        $query = User::query()->with(['roles:id,name,display_name,color', 'company:id,name']);

        if (! $request->user()->isSuperAdmin()) {
            $query->where('company_id', $request->user()->company_id);
        }

        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('last_name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%");
            });
        }

        $companyFilter = $request->input('company_id');
        if ($companyFilter !== null && $companyFilter !== '' && $request->user()->isSuperAdmin()) {
            $query->where('company_id', (int) $companyFilter);
        }

        if ($status === 'active') {
            $query->where('is_active', true);
        } elseif ($status === 'inactive') {
            $query->where('is_active', false);
        }

        // Enlace cruzado desde el listado de roles: «6 usuarios» abre aqui ya filtrado.
        $roleFilter = $request->input('role_id');
        if ($roleFilter !== null && $roleFilter !== '') {
            $query->whereHas('roles', fn ($q) => $q->where('roles.id', (int) $roleFilter));
        }

        $users = $query->orderBy('name')->paginate(15)->withQueryString();

        $insight = app(PermissionInsightService::class);
        $summaries = $insight->summaries($users->getCollection());

        $users->getCollection()->transform(function (User $user) use ($summaries) {
            $summary = $summaries[$user->id] ?? ['assigned' => 0, 'extra' => 0, 'missing' => 0];
            $user->setAttribute('permissions_count', $summary['assigned']);
            $user->setAttribute('extra_count', $summary['extra']);
            $user->setAttribute('missing_count', $summary['missing']);

            return $user;
        });

        return Inertia::render('Users/Index', [
            'users' => $users,
            'filters' => [
                'search' => $search,
                'status' => $status,
                'company_id' => $companyFilter,
                'role_id' => $roleFilter !== null && $roleFilter !== '' ? (int) $roleFilter : null,
            ],
            'roles' => $this->availableRoles($request->user()),
            'metrics' => $this->indexMetrics($request),
        ]);
    }

    /**
     * Cifras de la franja: siempre sobre todos los usuarios visibles, no sobre la pagina.
     *
     * @return array<string, int>
     */
    protected function indexMetrics(Request $request): array
    {
        $base = User::query();

        if (! $request->user()->isSuperAdmin()) {
            $base->where('company_id', $request->user()->company_id);
        }

        $companyFilter = $request->input('company_id');
        if ($companyFilter !== null && $companyFilter !== '' && $request->user()->isSuperAdmin()) {
            $base->where('company_id', (int) $companyFilter);
        }

        $all = (clone $base)->get(['id', 'is_active', 'last_login_at', 'company_id']);

        return [
            'total' => $all->count(),
            'active' => $all->where('is_active', true)->count(),
            'inactive' => $all->where('is_active', false)->count(),
            'never_logged_in' => $all->whereNull('last_login_at')->count(),
            'with_overrides' => app(PermissionInsightService::class)->countWithOverrides(
                (clone $base)->with('roles')->get()
            ),
        ];
    }

    public function create(Request $request): Response
    {
        return Inertia::render('Users/Create', [
            'roles' => $this->availableRoles($request->user()),
            'companies' => $request->user()->isSuperAdmin() ? Company::orderBy('name')->get(['id', 'name']) : [],
        ]);
    }

    public function store(StoreUserRequest $request): RedirectResponse
    {
        $data = $request->validated();
        $authUser = $request->user();

        $companyId = $authUser->isSuperAdmin() ? ($data['company_id'] ?? null) : $authUser->company_id;
        $role = Role::find($data['role_id']);

        if ($companyId && $role && $role->name !== 'super_admin') {
            app(MembershipStaffLimiter::class)->assertCanAddStaffUser((int) $companyId, $authUser);
        }

        $user = User::create([
            'company_id' => $companyId,
            'name' => $data['name'],
            'last_name' => $data['last_name'] ?? null,
            'email' => $data['email'],
            'password' => Hash::make($data['password']),
            'phone' => $data['phone'] ?? null,
            'is_active' => $data['is_active'] ?? true,
        ]);

        $role = Role::find($data['role_id']);
        if ($role) {
            $role = $this->resolveRoleForTargetCompany($role, $user, $authUser);
            $this->assertRoleAssignableToUser($role, $user, $authUser);
            $user->syncRoles([$role]);
        }

        return redirect()->route('users.index')->with('success', 'Usuario creado.');
    }

    public function show(Request $request, User $user): Response
    {
        $user->load(['roles.permissions', 'company:id,name']);

        $logs = AccessLog::query()
            ->where('user_id', $user->id)
            ->orderByDesc('created_at')
            ->paginate(15)
            ->withQueryString();

        $insight = app(PermissionInsightService::class);
        $assigned = $user->isSuperAdmin()
            ? PermissionHelper::flatPermissions()
            : $user->permissions->pluck('name')->all();
        $template = $user->roles->flatMap(fn ($role) => $role->permissions->pluck('name'))->unique()->values()->all();

        return Inertia::render('Users/Show', [
            'user' => $user,
            'accessLogs' => $logs,
            'summary' => $insight->summaryFor($user),
            'moduleCoverage' => $insight->moduleCoverage($assigned, $template),
            'canManagePermissions' => Gate::forUser($request->user())->allows('managePermissionOverrides', $user),
        ]);
    }

    public function edit(User $user, Request $request): Response
    {
        $this->authorize('update', $user);

        $user->load(['roles.permissions']);

        $overrideService = app(UserPermissionOverrideService::class);

        return Inertia::render('Users/Edit', [
            'user' => $user,
            'roles' => $this->availableRoles($request->user()),
            'companies' => $request->user()->isSuperAdmin() ? Company::orderBy('name')->get(['id', 'name']) : [],
            'permission_matrix' => PermissionHelper::getPermissionMatrix(),
            'role_permissions' => $user->roles->flatMap(fn ($r) => $r->permissions->pluck('name'))->unique()->values()->all(),
            'permission_overrides' => $overrideService->listOverridesForUi($user),
            'can_manage_permission_overrides' => Gate::forUser($request->user())->allows('managePermissionOverrides', $user),
            'assigned_permissions' => app(UserPermissionService::class)->namesFor($user),
            'summary' => app(PermissionInsightService::class)->summaryFor($user),
            'permission_labels' => self::permissionLabels(),
        ]);
    }

    /**
     * Catalogo de permisos de un usuario, para el asignador del listado.
     *
     * Devuelve JSON y no una pantalla porque el asignador es un modal: abrirlo no deberia
     * sacar al administrador del listado donde estaba trabajando.
     */
    public function permissions(Request $request, User $user): JsonResponse
    {
        $this->authorize('managePermissionOverrides', $user);

        $role = $user->roles->first();

        return response()->json([
            'user' => [
                'id' => $user->id,
                'name' => trim($user->name.' '.($user->last_name ?? '')),
                'email' => $user->email,
                'role' => $role?->display_name ?? $role?->name,
                'role_id' => $role?->id,
                'is_super_admin' => $user->isSuperAdmin(),
            ],
            'catalogue' => PermissionHelper::catalogue(),
            'assigned' => app(UserPermissionService::class)->namesFor($user),
            'labels' => self::permissionLabels(),
            'summary' => app(PermissionInsightService::class)->summaryFor($user),
            // La plantilla del rol se ofrece como punto de partida, no como herencia viva.
            'template' => $role
                ? $role->permissions->pluck('name')->values()->all()
                : [],
        ]);
    }

    /**
     * Guarda el conjunto de permisos del usuario. Reemplaza, no acumula: el asignador
     * muestra el estado completo y eso es exactamente lo que se guarda.
     */
    public function updatePermissions(Request $request, User $user): RedirectResponse
    {
        $this->authorize('managePermissionOverrides', $user);

        $validated = $request->validate([
            'permissions' => ['nullable', 'array'],
            'permissions.*' => ['string'],
        ]);

        try {
            app(UserPermissionService::class)->sync($user, $validated['permissions'] ?? [], $request->user());
        } catch (\InvalidArgumentException $e) {
            return back()->with('error', $e->getMessage());
        }

        AccessLog::log('user_permissions_updated', $request->user()?->id, [
            'company_id' => $user->company_id,
            'permission_checked' => 'users.edit.permission_overrides',
        ]);

        return back()->with('success', 'Permisos actualizados.');
    }

    /**
     * `permiso => "Modulo · Etiqueta"`, para no ensenar nombres tecnicos en la interfaz.
     *
     * @return array<string, string>
     */
    public static function permissionLabels(): array
    {
        $labels = [];

        foreach (PermissionHelper::catalogue(true) as $module) {
            foreach ($module['groups'] as $group) {
                foreach ($group['permissions'] as $permission) {
                    $labels[$permission['name']] = $module['display'].' · '.$permission['label'];
                }
            }
        }

        return $labels;
    }

    public function update(UpdateUserRequest $request, User $user): RedirectResponse
    {
        $data = $request->validated();
        $authUser = $request->user();

        $update = [
            'name' => $data['name'],
            'last_name' => $data['last_name'] ?? null,
            'email' => $data['email'],
            'phone' => $data['phone'] ?? null,
            'is_active' => $data['is_active'] ?? true,
        ];

        if ($authUser->isSuperAdmin() && isset($data['company_id'])) {
            $update['company_id'] = $data['company_id'];
        }

        if (! empty($data['password'])) {
            $update['password'] = Hash::make($data['password']);
        }

        $user->update($update);

        if (! empty($data['role_id'])) {
            $role = Role::find($data['role_id']);
            if ($role) {
                $role = $this->resolveRoleForTargetCompany($role, $user, $authUser);
                $this->assertRoleAssignableToUser($role, $user, $authUser);
                $user->syncRoles([$role]);
            }
        }

        return redirect()->route('users.index')->with('success', 'Usuario actualizado.');
    }

    public function updatePermissionOverrides(Request $request, User $user, UserPermissionOverrideService $service): RedirectResponse
    {
        $this->authorize('managePermissionOverrides', $user);

        if ($request->boolean('clear_all')) {
            try {
                $service->clearAllOverrides($user);
            } catch (\InvalidArgumentException $e) {
                return back()->with('error', $e->getMessage());
            }

            return back()->with('success', 'Se restablecieron los permisos al heredado del rol.');
        }

        $validated = $request->validate([
            'overrides' => ['nullable', 'array'],
            'overrides.*.permission' => ['required', 'string'],
            'overrides.*.effect' => ['required', 'string', 'in:grant,deny'],
        ]);

        try {
            $service->syncOverridesFromRequest($user, $validated['overrides'] ?? [], $request->user());
        } catch (\InvalidArgumentException $e) {
            return back()->with('error', $e->getMessage());
        }

        return back()->with('success', 'Excepciones de permisos actualizadas.');
    }

    public function destroy(Request $request, User $user): RedirectResponse
    {
        if ($user->id === $request->user()->id) {
            return back()->with('error', 'No puedes eliminar tu propio usuario.');
        }

        if ($user->hasRole('super_admin')) {
            return back()->with('error', 'No se puede eliminar al super administrador.');
        }

        if ($user->employee_id) {
            return back()->with('error', 'Este usuario esta vinculado a un empleado activo. Desactivalo desde su ficha.');
        }

        $user->delete();

        return redirect()->route('users.index')->with('success', 'Usuario eliminado.');
    }

    protected function availableRoles($authUser): Collection
    {
        $companyId = $authUser->company_id;

        $query = Role::query()->with('company:id,name');
        if (! $authUser->isSuperAdmin()) {
            $query->where('company_id', $companyId)->where('name', '!=', 'super_admin');
        }

        return $query
            ->orderBy('company_id')
            ->orderBy('display_name')
            ->get(['id', 'name', 'display_name', 'description', 'color', 'is_system', 'company_id']);
    }

    /**
     * Cuando un super admin mueve de empresa a un usuario y el formulario sigue enviando
     * el id del rol de la empresa anterior, se reubica al rol con el mismo "name" en la empresa destino.
     */
    protected function resolveRoleForTargetCompany(Role $role, User $targetUser, User $authUser): Role
    {
        if (! $authUser->isSuperAdmin()) {
            return $role;
        }

        if ($role->company_id === null) {
            return $role;
        }

        $targetCompanyId = $targetUser->company_id;
        if ($targetCompanyId === null) {
            return $role;
        }

        if ((int) $role->company_id === (int) $targetCompanyId) {
            return $role;
        }

        $mapped = Role::query()
            ->where('company_id', $targetCompanyId)
            ->where('name', $role->name)
            ->where('guard_name', $role->guard_name)
            ->first();

        if (! $mapped) {
            $company = Company::query()->find($targetCompanyId);
            if ($company && $authUser->isSuperAdmin()) {
                app(CompanyDefaultRolesService::class)->ensureDefaultRolesForCompany($company);
                $mapped = Role::query()
                    ->where('company_id', $targetCompanyId)
                    ->where('name', $role->name)
                    ->where('guard_name', $role->guard_name)
                    ->first();
            }
        }

        if (! $mapped) {
            abort(403, 'En la empresa destino no existe un rol con el mismo codigo interno ("'.$role->name.'"). Selecciona manualmente el rol correspondiente en esa empresa.');
        }

        return $mapped;
    }

    protected function assertRoleAssignableToUser(Role $role, User $targetUser, User $authUser): void
    {
        if ($role->name === 'super_admin' && ! $authUser->isSuperAdmin()) {
            abort(403, 'No puedes asignar este rol.');
        }

        if ($role->company_id === null && ! $authUser->isSuperAdmin()) {
            abort(403, 'Este rol no pertenece a una empresa y no puede asignarse.');
        }

        if ($role->company_id !== null && (int) $role->company_id !== (int) $targetUser->company_id) {
            abort(403, 'El rol no corresponde a la empresa del usuario.');
        }
    }
}
