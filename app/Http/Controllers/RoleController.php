<?php

namespace App\Http\Controllers;

use App\Helpers\PermissionHelper;
use App\Http\Requests\Role\StoreRoleRequest;
use App\Http\Requests\Role\UpdateRoleRequest;
use App\Models\Company;
use App\Models\Role;
use App\Models\User;
use App\Services\PermissionInsightService;
use App\Services\RoleTemplateService;
use App\Support\TenantContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class RoleController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();

        $query = Role::query();

        if (! $user->isSuperAdmin()) {
            $query->where('company_id', $user->company_id);
        }

        $roles = $query->with('permissions:id,name')
            ->orderBy('is_system', 'desc')->orderBy('display_name')
            ->paginate(15)
            ->withQueryString();

        $insight = app(PermissionInsightService::class);
        $catalogueSize = count(PermissionHelper::flatPermissions());

        $roles->getCollection()->transform(function (Role $role) use ($insight, $catalogueSize) {
            $names = $role->permissions->pluck('name')->all();

            return [
                'id' => $role->id,
                'name' => $role->name,
                'display_name' => $role->display_name,
                'description' => $role->description,
                'color' => $role->color ?? '#6366f1',
                'is_system' => (bool) $role->is_system,
                'company_id' => $role->company_id,
                'permissions_count' => count($names),
                'permissions_total' => $catalogueSize,
                'modules' => $insight->touchedModules($names),
                'users_count' => DB::table('model_has_roles')
                    ->where('role_id', $role->id)
                    ->where('model_type', (new User)->getMorphClass())
                    ->count(),
                'avatars' => $insight->avatarsForRole($role),
            ];
        });

        return Inertia::render('Roles/Index', [
            'roles' => $roles,
            'metrics' => $this->indexMetrics($user),
        ]);
    }

    /**
     * Cifras de la franja del listado de roles.
     *
     * @return array<string, mixed>
     */
    protected function indexMetrics($user): array
    {
        $roles = Role::query()
            ->when(! $user->isSuperAdmin(), fn ($q) => $q->where('company_id', $user->company_id))
            ->withCount('permissions')
            ->get();

        $users = User::query()
            ->when(! $user->isSuperAdmin(), fn ($q) => $q->where('company_id', $user->company_id))
            ->with('roles')
            ->get();

        $roleIdsWithUsers = DB::table('model_has_roles')
            ->where('model_type', (new User)->getMorphClass())
            ->distinct()
            ->pluck('role_id')
            ->all();

        $withoutUsers = $roles->reject(fn (Role $role) => in_array($role->id, $roleIdsWithUsers))->values();

        return [
            'roles_total' => $roles->count(),
            'system_total' => $roles->where('is_system', true)->count(),
            'users_total' => $users->count(),
            'users_with_role' => $users->filter(fn ($u) => $u->roles->isNotEmpty())->count(),
            'users_with_overrides' => app(PermissionInsightService::class)->countWithOverrides($users),
            'roles_without_users' => $withoutUsers->count(),
            'roles_without_users_name' => $withoutUsers->count() === 1 ? $withoutUsers->first()->display_name : null,
        ];
    }

    public function create(Request $request): Response
    {
        return Inertia::render('Roles/Create', [
            'matrix' => PermissionHelper::getPermissionMatrix(),
            'catalogue' => PermissionHelper::catalogue($request->user()->isSuperAdmin()),
            'permissionLabels' => UserController::permissionLabels(),
            'companies' => $request->user()->isSuperAdmin()
                ? Company::query()->orderBy('name')->get(['id', 'name'])
                : [],
        ]);
    }

    public function store(StoreRoleRequest $request): RedirectResponse
    {
        $user = $request->user();
        $data = $request->validated();

        return DB::transaction(function () use ($data, $user) {
            $companyId = $user->isSuperAdmin()
                ? (int) ($data['company_id'] ?? TenantContext::effectiveCompanyId($user) ?? 0)
                : (int) $user->company_id;

            if ($user->isSuperAdmin() && ! $companyId) {
                return redirect()->back()->with('error', 'Selecciona la empresa para el nuevo rol.');
            }

            $role = Role::create([
                'name' => $data['name'],
                'guard_name' => 'web',
                'display_name' => $data['display_name'],
                'description' => $data['description'] ?? null,
                'color' => $data['color'] ?? '#6366f1',
                'is_system' => false,
                'company_id' => $companyId,
            ]);

            $role->syncPermissions($data['permissions'] ?? []);

            return redirect()->route('roles.index')->with('success', 'Rol creado correctamente.');
        });
    }

    public function show(Role $role): Response
    {
        $role->load('permissions');

        return Inertia::render('Roles/Show', [
            'role' => [
                'id' => $role->id,
                'name' => $role->name,
                'display_name' => $role->display_name,
                'description' => $role->description,
                'color' => $role->color ?? '#6366f1',
                'is_system' => (bool) $role->is_system,
                'permissions' => $role->permissions->pluck('name')->toArray(),
            ],
            'matrix' => PermissionHelper::getPermissionMatrix(),
            'catalogue' => PermissionHelper::catalogue(request()->user()?->isSuperAdmin() ?? false),
            'moduleCoverage' => app(PermissionInsightService::class)
                ->moduleCoverage($role->permissions->pluck('name')->all()),
            'users' => app(RoleTemplateService::class)->usersForPropagation($role),
            'permissionsTotal' => count(PermissionHelper::flatPermissions()),
        ]);
    }

    public function edit(Role $role, RoleTemplateService $templates): Response
    {
        if ($role->is_system) {
            return Inertia::render('Roles/Show', [
                'role' => [
                    'id' => $role->id,
                    'name' => $role->name,
                    'display_name' => $role->display_name,
                    'description' => $role->description,
                    'color' => $role->color ?? '#6366f1',
                    'is_system' => true,
                    'permissions' => $role->permissions->pluck('name')->toArray(),
                ],
                'matrix' => PermissionHelper::getPermissionMatrix(),
                'catalogue' => PermissionHelper::catalogue(request()->user()?->isSuperAdmin() ?? false),
                'moduleCoverage' => app(PermissionInsightService::class)
                    ->moduleCoverage($role->permissions->pluck('name')->all()),
                'users' => app(RoleTemplateService::class)->usersForPropagation($role),
                'permissionsTotal' => count(PermissionHelper::flatPermissions()),
                'systemRoleNotice' => 'Los roles del sistema no son editables.',
            ]);
        }

        $role->load('permissions');

        // Cambio recien guardado en la plantilla que todavia no se ha aplicado a nadie.
        $pending = session(RoleTemplateService::PENDING_SESSION_PREFIX.$role->id);
        $pending = is_array($pending) ? $pending : null;

        return Inertia::render('Roles/Edit', [
            'role' => [
                'id' => $role->id,
                'name' => $role->name,
                'display_name' => $role->display_name,
                'description' => $role->description,
                'color' => $role->color ?? '#6366f1',
                'is_system' => false,
                'permissions' => $role->permissions->pluck('name')->toArray(),
            ],
            'matrix' => PermissionHelper::getPermissionMatrix(),
            'catalogue' => PermissionHelper::catalogue(request()->user()?->isSuperAdmin() ?? false),
            'users' => $templates->usersForPropagation($role),
            'permissionsTotal' => count(PermissionHelper::flatPermissions()),
            'pendingDiff' => $pending,
            'affectedUsers' => $pending
                ? $templates->usersForPropagation($role, $pending['added'] ?? [], $pending['removed'] ?? [])
                : [],
            'permissionLabels' => UserController::permissionLabels(),
        ]);
    }

    /**
     * Guarda la plantilla y, si sus permisos cambiaron, deja preparada la propagacion.
     *
     * El rol ya no concede permisos en tiempo de ejecucion: cambiarlo no altera a nadie
     * hasta que se decida a quien aplicarselo. La diferencia se guarda en sesion —no la
     * manda el cliente— para que la pantalla siguiente ofrezca exactamente lo que se
     * acaba de cambiar.
     */
    public function update(UpdateRoleRequest $request, Role $role, RoleTemplateService $templates): RedirectResponse
    {
        $data = $request->validated();
        $before = $role->permissions->pluck('name')->values()->all();

        DB::transaction(function () use ($role, $data) {
            $role->update([
                'name' => $data['name'],
                'display_name' => $data['display_name'],
                'description' => $data['description'] ?? null,
                'color' => $data['color'] ?? $role->color,
            ]);

            $role->syncPermissions($data['permissions'] ?? []);
        });

        $diff = $templates->diff($before, $data['permissions'] ?? []);
        $affected = $templates->usersForPropagation($role, $diff['added'], $diff['removed']);

        if (($diff['added'] === [] && $diff['removed'] === []) || $affected === []) {
            return redirect()->route('roles.index')->with('success', 'Plantilla actualizada.');
        }

        session([RoleTemplateService::PENDING_SESSION_PREFIX.$role->id => $diff]);

        return redirect()
            ->route('roles.edit', $role)
            ->with('info', 'Plantilla guardada. Elige a qué usuarios se les aplica el cambio.');
    }

    /**
     * Aplica a los usuarios elegidos el cambio que se acaba de hacer en la plantilla.
     */
    public function propagate(Request $request, Role $role, RoleTemplateService $templates): RedirectResponse
    {
        $validated = $request->validate([
            'user_ids' => ['required', 'array'],
            'user_ids.*' => ['integer'],
            'mode' => ['nullable', 'string', 'in:delta,replace'],
        ]);

        $mode = $validated['mode'] ?? 'delta';

        if ($mode === 'replace') {
            $affected = $templates->applyTemplate($role, $validated['user_ids'], $request->user());
        } else {
            $pending = session(RoleTemplateService::PENDING_SESSION_PREFIX.$role->id);

            if (! is_array($pending)) {
                return back()->with('error', 'Ya no hay un cambio pendiente que aplicar. Vuelve a guardar la plantilla o usa «reemplazar por la plantilla completa».');
            }

            $affected = $templates->propagate(
                $role,
                $validated['user_ids'],
                $pending['added'] ?? [],
                $pending['removed'] ?? [],
                $request->user(),
            );
        }

        $request->session()->forget(RoleTemplateService::PENDING_SESSION_PREFIX.$role->id);

        return redirect()->route('roles.index')->with(
            'success',
            $affected === 0
                ? 'No se aplicó a ningún usuario.'
                : "Cambio aplicado a {$affected} usuario(s)."
        );
    }

    public function destroy(Role $role): RedirectResponse
    {
        if ($role->is_system) {
            return back()->with('error', 'No se pueden eliminar roles del sistema.');
        }

        $usersCount = DB::table('model_has_roles')->where('role_id', $role->id)->count();
        if ($usersCount > 0) {
            return back()->with('error', "No se puede eliminar: {$usersCount} usuario(s) tienen este rol.");
        }

        $role->delete();

        return redirect()->route('roles.index')->with('success', 'Rol eliminado.');
    }

    public function permissionMatrix(): JsonResponse
    {
        return response()->json([
            'matrix' => PermissionHelper::getPermissionMatrix(),
            'permissions' => PermissionHelper::flatPermissions(),
            'modules' => PermissionHelper::modules(),
        ]);
    }
}
