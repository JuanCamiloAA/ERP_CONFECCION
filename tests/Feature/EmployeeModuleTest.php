<?php

namespace Tests\Feature;

use App\Models\Employee;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

/**
 * Modulo de empleados tras el rediseno de las pantallas.
 *
 * Lo que se protege aqui no es el aspecto —eso no se prueba desde PHP— sino que el
 * rediseno no haya movido el contrato: mismas claves de formulario, mismo payload en
 * crear y editar, y las pantallas respondiendo con las props que esperan.
 *
 * Las pruebas que escriben van dentro de una transaccion que se revierte al terminar,
 * asi que no dejan rastro en la base configurada.
 */
class EmployeeModuleTest extends TestCase
{
    use DatabaseTransactions;

    protected function actor(): User
    {
        $user = User::query()
            ->whereNotNull('company_id')
            ->get()
            ->first(fn (User $u) => $u->isSuperAdmin() || $u->can('employees.index.view'));

        if ($user === null) {
            $this->markTestSkipped('No hay usuario con permiso employees.index.view en esta base.');
        }

        return $user;
    }

    /** Payload identico al que arma el formulario de Create. */
    protected function formPayload(array $overrides = []): array
    {
        return array_merge([
            'first_name' => 'Prueba',
            'last_name' => 'Rediseno',
            'document_type' => 'CC',
            'document_number' => '99'.random_int(1000000, 9999999),
            'phone' => '3001234567',
            'email' => null,
            'address' => 'Calle 1 # 2-3',
            'hire_date' => now()->toDateString(),
            'base_salary' => '0',
            'payroll_mode' => 'operations',
            'daily_salary' => '',
            'minutes_per_full_workday' => '480',
            'ordinary_hours_per_day' => '8',
            'is_exempt_from_overtime' => false,
            'scheduled_work_days' => [1, 2, 3, 4, 5, 6],
            'is_active' => true,
            'notes' => 'Creado por la suite de pruebas.',
            'bank_id' => '',
            'bank_account_number' => '',
            'bank_key' => '',
            'create_user_account' => false,
        ], $overrides);
    }

    public function test_index_exposes_the_metrics_and_the_mode_filter(): void
    {
        $this->actingAs($this->actor())
            ->get(route('employees.index', ['mode' => 'operations']))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Employees/Index')
                ->has('employees')
                ->has('metrics.active')
                ->has('metrics.with_access')
                ->has('metrics.missing_payment')
                ->has('metrics.inactive')
                ->where('filters.mode', 'operations'));
    }

    public function test_index_ignores_an_unknown_mode_instead_of_failing(): void
    {
        $this->actingAs($this->actor())
            ->get(route('employees.index', ['mode' => 'lo-que-sea']))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page->where('filters.mode', 'all'));
    }

    public function test_create_screen_renders_with_roles_and_banks(): void
    {
        $user = $this->actor();

        if (! $user->isSuperAdmin() && ! $user->can('employees.index.create')) {
            $this->markTestSkipped('El usuario de prueba no puede crear empleados.');
        }

        $this->actingAs($user)
            ->get(route('employees.create'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Employees/Create')
                ->has('roles')
                ->has('banks'));
    }

    public function test_edit_screen_exposes_production_flag_and_account_role(): void
    {
        $user = $this->actor();
        $employee = Employee::query()->withoutGlobalScopes()->where('company_id', $user->company_id)->first();

        if ($employee === null) {
            $this->markTestSkipped('La empresa del usuario no tiene empleados.');
        }

        $this->actingAs($user)
            ->get(route('employees.edit', $employee->id))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Employees/Edit')
                ->has('employee')
                ->has('banks')
                ->has('hasProductions'));
    }

    public function test_store_accepts_the_form_payload_unchanged(): void
    {
        $user = $this->actor();

        if (! $user->isSuperAdmin() && ! $user->can('employees.index.create')) {
            $this->markTestSkipped('El usuario de prueba no puede crear empleados.');
        }

        $payload = $this->formPayload();

        $response = $this->actingAs($user)->post(route('employees.store'), $payload);

        // El plan de la empresa puede tener el cupo lleno; eso no es un fallo del rediseno.
        if ($response->getSession()->has('errors')
            && $response->getSession()->get('errors')->has('membership_limit')) {
            $this->markTestSkipped('El plan de la empresa no admite mas empleados.');
        }

        $response->assertSessionHasNoErrors();

        $this->assertDatabaseHas('employees', [
            'document_number' => $payload['document_number'],
            'first_name' => 'Prueba',
            'payroll_mode' => 'operations',
            'is_active' => 1,
        ]);
    }

    /**
     * Cuando no se crea la cuenta, el formulario quita las claves de contrasena antes de
     * enviar (stripAccessPasswordData). El backend tiene que aceptar esa peticion.
     */
    public function test_store_without_access_account_does_not_need_password_fields(): void
    {
        $user = $this->actor();

        if (! $user->isSuperAdmin() && ! $user->can('employees.index.create')) {
            $this->markTestSkipped('El usuario de prueba no puede crear empleados.');
        }

        $payload = $this->formPayload(['payroll_mode' => 'fixed_daily', 'daily_salary' => '72000']);
        $this->assertArrayNotHasKey('user_password', $payload);

        $response = $this->actingAs($user)->post(route('employees.store'), $payload);

        if ($response->getSession()->has('errors')
            && $response->getSession()->get('errors')->has('membership_limit')) {
            $this->markTestSkipped('El plan de la empresa no admite mas empleados.');
        }

        $response->assertSessionHasNoErrors();

        $this->assertDatabaseHas('employees', [
            'document_number' => $payload['document_number'],
            'payroll_mode' => 'fixed_daily',
            'user_id' => null,
        ]);
    }

    public function test_update_accepts_the_form_payload_unchanged(): void
    {
        $user = $this->actor();
        $employee = Employee::query()->withoutGlobalScopes()->where('company_id', $user->company_id)->first();

        if ($employee === null) {
            $this->markTestSkipped('La empresa del usuario no tiene empleados.');
        }

        if (! $user->isSuperAdmin() && ! $user->can('employees.index.edit')) {
            $this->markTestSkipped('El usuario de prueba no puede editar empleados.');
        }

        // Mismo cuerpo que manda Edit: los datos del empleado mas `_method`.
        $payload = [
            'first_name' => $employee->first_name,
            'last_name' => $employee->last_name,
            'document_type' => $employee->document_type,
            'document_number' => $employee->document_number,
            'phone' => $employee->phone ?? '',
            'email' => $employee->email ?? '',
            'address' => 'Direccion de prueba',
            'hire_date' => $employee->hire_date instanceof \DateTimeInterface
                ? $employee->hire_date->format('Y-m-d')
                : (string) $employee->hire_date,
            'base_salary' => (string) ($employee->base_salary ?? 0),
            'payroll_mode' => $employee->payroll_mode ?? 'operations',
            'daily_salary' => $employee->daily_salary !== null ? (string) $employee->daily_salary : '',
            'minutes_per_full_workday' => (string) ($employee->minutes_per_full_workday ?? 480),
            'ordinary_hours_per_day' => (string) ($employee->ordinary_hours_per_day ?? 8),
            'is_exempt_from_overtime' => (bool) $employee->is_exempt_from_overtime,
            'scheduled_work_days' => $employee->scheduled_work_days ?? [1, 2, 3, 4, 5, 6],
            'is_active' => (bool) $employee->is_active,
            'notes' => $employee->notes ?? '',
            'bank_id' => $employee->bank_id ?? '',
            'bank_account_number' => $employee->bank_account_number ?? '',
            'bank_key' => $employee->bank_key ?? '',
            '_method' => 'put',
        ];

        $this->actingAs($user)
            ->post(route('employees.update', $employee->id), $payload)
            ->assertSessionHasNoErrors()
            ->assertRedirect(route('employees.show', $employee->id));

        $this->assertDatabaseHas('employees', [
            'id' => $employee->id,
            'address' => 'Direccion de prueba',
        ]);
    }

    public function test_reactivate_brings_an_inactive_employee_back(): void
    {
        $user = $this->actor();
        $employee = Employee::query()->withoutGlobalScopes()->where('company_id', $user->company_id)->first();

        if ($employee === null) {
            $this->markTestSkipped('La empresa del usuario no tiene empleados.');
        }

        if (! $user->isSuperAdmin() && ! $user->can('employees.index.edit')) {
            $this->markTestSkipped('El usuario de prueba no puede editar empleados.');
        }

        $employee->forceFill(['is_active' => false])->save();

        $this->actingAs($user)
            ->post(route('employees.reactivate', $employee->id))
            ->assertSessionHas('success');

        $this->assertDatabaseHas('employees', ['id' => $employee->id, 'is_active' => 1]);
    }

    public function test_reactivate_says_so_when_the_employee_is_already_active(): void
    {
        $user = $this->actor();
        $employee = Employee::query()->withoutGlobalScopes()
            ->where('company_id', $user->company_id)
            ->where('is_active', true)
            ->first();

        if ($employee === null) {
            $this->markTestSkipped('La empresa del usuario no tiene empleados activos.');
        }

        if (! $user->isSuperAdmin() && ! $user->can('employees.index.edit')) {
            $this->markTestSkipped('El usuario de prueba no puede editar empleados.');
        }

        $this->actingAs($user)
            ->post(route('employees.reactivate', $employee->id))
            ->assertSessionHas('warning');
    }
}
