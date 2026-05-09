<?php

namespace App\Http\Controllers;

use App\Helpers\PermissionHelper;
use App\Http\Requests\Role\StoreRoleRequest;
use App\Http\Requests\Role\UpdateRoleRequest;
use App\Models\Company;
use App\Models\Role;
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

        $roles = $query->orderBy('is_system', 'desc')->orderBy('display_name')
            ->paginate(15)
            ->withQueryString();

        $roles->getCollection()->transform(function (Role $role) {
            return [
                'id' => $role->id,
                'name' => $role->name,
                'display_name' => $role->display_name,
                'description' => $role->description,
                'color' => $role->color ?? '#6366f1',
                'is_system' => (bool) $role->is_system,
                'company_id' => $role->company_id,
                'users_count' => DB::table('model_has_roles')
                    ->where('role_id', $role->id)
                    ->count(),
            ];
        });

        return Inertia::render('Roles/Index', [
            'roles' => $roles,
        ]);
    }

    public function create(Request $request): Response
    {
        return Inertia::render('Roles/Create', [
            'matrix' => PermissionHelper::getPermissionMatrix(),
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
        ]);
    }

    public function edit(Role $role): Response
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
                'systemRoleNotice' => 'Los roles del sistema no son editables.',
            ]);
        }

        $role->load('permissions');

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
        ]);
    }

    public function update(UpdateRoleRequest $request, Role $role): RedirectResponse
    {
        $data = $request->validated();

        return DB::transaction(function () use ($role, $data) {
            $role->update([
                'name' => $data['name'],
                'display_name' => $data['display_name'],
                'description' => $data['description'] ?? null,
                'color' => $data['color'] ?? $role->color,
            ]);

            $role->syncPermissions($data['permissions'] ?? []);

            return redirect()->route('roles.index')->with('success', 'Rol actualizado.');
        });
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
