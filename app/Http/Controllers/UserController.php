<?php

namespace App\Http\Controllers;

use App\Http\Requests\User\StoreUserRequest;
use App\Http\Requests\User\UpdateUserRequest;
use App\Helpers\PermissionHelper;
use App\Models\AccessLog;
use App\Models\Company;
use App\Models\Role;
use App\Models\User;
use App\Services\CompanyDefaultRolesService;
use App\Services\UserPermissionOverrideService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
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

        if ($status === 'active') {
            $query->where('is_active', true);
        } elseif ($status === 'inactive') {
            $query->where('is_active', false);
        }

        $users = $query->orderBy('name')->paginate(15)->withQueryString();

        return Inertia::render('Users/Index', [
            'users' => $users,
            'filters' => ['search' => $search, 'status' => $status],
        ]);
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

    public function show(User $user): Response
    {
        $user->load(['roles.permissions', 'company:id,name']);

        $logs = AccessLog::query()
            ->where('user_id', $user->id)
            ->orderByDesc('created_at')
            ->limit(10)
            ->get();

        return Inertia::render('Users/Show', [
            'user' => $user,
            'accessLogs' => $logs,
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
        ]);
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

    protected function availableRoles($authUser): \Illuminate\Support\Collection
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
