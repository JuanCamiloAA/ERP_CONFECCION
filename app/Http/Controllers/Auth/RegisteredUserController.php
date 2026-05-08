<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\Company;
use App\Models\Role;
use App\Models\User;
use Illuminate\Auth\Events\Registered;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules;
use Inertia\Inertia;
use Inertia\Response;

class RegisteredUserController extends Controller
{
    public function create(): Response
    {
        return Inertia::render('Auth/Register');
    }

    public function store(Request $request): RedirectResponse
    {
        $request->validate([
            'company_name' => 'required|string|max:255',
            'company_nit' => 'nullable|string|max:50',
            'company_phone' => 'nullable|string|max:50',
            'name' => 'required|string|max:255',
            'last_name' => 'nullable|string|max:255',
            'email' => 'required|string|email|max:255|unique:users,email',
            'password' => ['required', 'confirmed', Rules\Password::defaults()],
        ]);

        $user = DB::transaction(function () use ($request) {
            $company = Company::create([
                'name' => $request->company_name,
                'nit' => $request->company_nit,
                'phone' => $request->company_phone,
                'is_active' => true,
            ]);

            $user = User::create([
                'company_id' => $company->id,
                'name' => $request->name,
                'last_name' => $request->last_name,
                'email' => $request->email,
                'password' => Hash::make($request->password),
                'is_active' => true,
                'email_verified_at' => now(),
            ]);

            $adminRole = Role::firstOrCreate(
                ['name' => 'admin', 'guard_name' => 'web', 'company_id' => $company->id],
                [
                    'display_name' => 'Administrador',
                    'description' => 'Administrador con acceso total a su empresa.',
                    'color' => '#4f46e5',
                    'is_system' => true,
                ]
            );

            $adminPermissions = \App\Helpers\PermissionHelper::presetPermissions('admin');
            $adminRole->syncPermissions($adminPermissions);

            $user->syncRoles([$adminRole]);

            return $user;
        });

        event(new Registered($user));
        Auth::login($user);

        return redirect(route('dashboard', absolute: false))->with('success', 'Bienvenido! Tu empresa ha sido registrada exitosamente.');
    }
}
