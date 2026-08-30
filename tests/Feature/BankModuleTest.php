<?php

namespace Tests\Feature;

use App\Helpers\PermissionHelper;
use App\Http\Requests\Employee\StoreEmployeeRequest;
use App\Models\Bank;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;

/**
 * Rediseño de Bancos: identidad del banco (logo, tipo, color) y reglas de cuenta.
 *
 * Se comprueba lo que las pantallas nuevas dan por hecho: los props del listado, el
 * monograma de respaldo, la validación del logo subido y que un banco sin clave de
 * dispersión pueda guardarse en la ficha del empleado.
 */
class BankModuleTest extends TestCase
{
    use DatabaseTransactions;

    protected function admin(): User
    {
        $user = User::query()
            ->whereNotNull('company_id')
            ->whereHas('roles', fn ($q) => $q->whereIn('name', ['admin', 'super_admin']))
            ->first();

        if (! $user) {
            $this->markTestSkipped('No hay un administrador con empresa asignada.');
        }

        return $user;
    }

    protected function makeBank(array $attributes = []): Bank
    {
        $user = $this->admin();

        return Bank::query()->create(array_merge([
            'company_id' => $user->company_id,
            'name' => 'Banco de prueba '.uniqid(),
            'code' => 'TEST'.random_int(100, 999),
            'type' => 'bank',
            'requires_key' => true,
            'is_active' => true,
        ], $attributes));
    }

    public function test_el_listado_entrega_los_props_que_la_pantalla_necesita(): void
    {
        $response = $this->actingAs($this->admin())->get(route('banks.index'));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Banks/Index')
            ->has('banks.data')
            ->has('stats', 3)
            ->has('sorts')
            ->has('chipCounts.all')
            ->has('chipCounts.wallet')
            ->has('chipCounts.without_logo')
            ->where('filters.status', 'all')
            ->where('filters.sort', 'name'));
    }

    public function test_cada_banco_del_listado_trae_logo_y_monograma(): void
    {
        $this->makeBank();

        $response = $this->actingAs($this->admin())->get(route('banks.index'));
        $rows = $response->viewData('page')['props']['banks']['data'];

        $this->assertNotEmpty($rows);

        foreach ($rows as $row) {
            $this->assertArrayHasKey('logo_url', $row);
            $this->assertArrayHasKey('initials', $row);
            $this->assertArrayHasKey('type_label', $row);
            // Sin monograma la casilla del logo quedaría vacía y parecería un error de carga.
            $this->assertNotSame('', $row['initials']);
        }
    }

    public function test_el_monograma_sale_del_codigo_y_nunca_queda_vacio(): void
    {
        $this->assertSame('BC', $this->makeBank(['code' => 'BCO', 'name' => 'Bancolombia'])->initials);
        $this->assertSame('NE', $this->makeBank(['code' => null, 'name' => 'Nequi'])->initials);
        $this->assertSame('??', $this->makeBank(['code' => '---', 'name' => '###'])->initials);
    }

    public function test_los_filtros_nuevos_del_listado_responden(): void
    {
        foreach (['active', 'inactive', 'wallet', 'without_logo'] as $status) {
            $this->actingAs($this->admin())
                ->get(route('banks.index', ['status' => $status]))
                ->assertOk()
                ->assertInertia(fn ($page) => $page->where('filters.status', $status));
        }
    }

    public function test_las_ordenaciones_del_listado_responden(): void
    {
        foreach (['name', 'employees', 'code'] as $sort) {
            foreach (['asc', 'desc'] as $direction) {
                $this->actingAs($this->admin())
                    ->get(route('banks.index', ['sort' => $sort, 'direction' => $direction]))
                    ->assertOk()
                    ->assertInertia(fn ($page) => $page
                        ->where('filters.sort', $sort)
                        ->where('filters.direction', $direction));
            }
        }
    }

    public function test_el_interruptor_del_listado_cambia_el_estado(): void
    {
        $bank = $this->makeBank(['is_active' => true]);

        $this->actingAs($this->admin())
            ->patch(route('banks.toggle', $bank->id), ['is_active' => false])
            ->assertRedirect();

        $this->assertFalse($bank->fresh()->is_active);
    }

    public function test_el_permiso_del_interruptor_esta_en_el_catalogo(): void
    {
        $this->assertContains('banks.index.toggle', PermissionHelper::flatPermissions());
    }

    public function test_se_rechaza_un_logo_mas_pequeno_que_el_minimo(): void
    {
        $bank = $this->makeBank();

        // PNG real de 1x1 en vez de `UploadedFile::fake()->image()`: esa fabrica necesita la
        // extension GD, que no esta instalada en este entorno.
        $path = tempnam(sys_get_temp_dir(), 'png').'.png';
        file_put_contents($path, base64_decode(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
        ));

        $response = $this->actingAs($this->admin())->put(route('banks.update', $bank->id), [
            'name' => $bank->name,
            'code' => $bank->code,
            'type' => 'bank',
            'logo' => new UploadedFile($path, 'logo.png', 'image/png', null, true),
        ]);

        $response->assertSessionHasErrors('logo');

        @unlink($path);
    }

    public function test_se_rechaza_un_archivo_que_no_es_imagen_admitida(): void
    {
        $bank = $this->makeBank();

        $response = $this->actingAs($this->admin())->put(route('banks.update', $bank->id), [
            'name' => $bank->name,
            'code' => $bank->code,
            'type' => 'bank',
            'logo' => UploadedFile::fake()->create('logo.pdf', 10, 'application/pdf'),
        ]);

        $response->assertSessionHasErrors('logo');
    }

    public function test_se_rechaza_un_svg_con_codigo_ejecutable(): void
    {
        $bank = $this->makeBank();

        $path = tempnam(sys_get_temp_dir(), 'svg').'.svg';
        file_put_contents($path, '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');

        $response = $this->actingAs($this->admin())->put(route('banks.update', $bank->id), [
            'name' => $bank->name,
            'code' => $bank->code,
            'type' => 'bank',
            'logo' => new UploadedFile($path, 'logo.svg', 'image/svg+xml', null, true),
        ]);

        $response->assertSessionHasErrors('logo');

        @unlink($path);
    }

    public function test_se_rechaza_un_color_de_marca_mal_formado(): void
    {
        $bank = $this->makeBank();

        $this->actingAs($this->admin())
            ->put(route('banks.update', $bank->id), [
                'name' => $bank->name,
                'code' => $bank->code,
                'type' => 'bank',
                'brand_color' => 'azul',
            ])
            ->assertSessionHasErrors('brand_color');
    }

    public function test_las_reglas_de_cuenta_se_guardan_y_viajan_al_formulario_del_empleado(): void
    {
        $bank = $this->makeBank([
            'type' => 'wallet',
            'requires_key' => false,
            'account_format' => '300 000 0000',
            'account_hint' => 'Usa el celular como cuenta',
            'notes' => 'No pide tipo de cuenta ni clave.',
        ]);

        $response = $this->actingAs($this->admin())->get(route('employees.create'));

        $response->assertOk();

        $banks = collect($response->viewData('page')['props']['banks']);
        $row = $banks->firstWhere('id', $bank->id);

        $this->assertNotNull($row, 'El banco creado no llegó al formulario del empleado.');
        $this->assertSame('wallet', $row['type']);
        $this->assertFalse($row['requires_key']);
        $this->assertSame('300 000 0000', $row['account_format']);
        $this->assertSame('Usa el celular como cuenta', $row['account_hint']);
        $this->assertArrayHasKey('logo_url', $row);
        $this->assertArrayHasKey('initials', $row);
    }

    /** El caso que la validación anterior hacía imposible: un banco que no pide clave. */
    public function test_un_banco_sin_clave_no_exige_clave_al_guardar_el_empleado(): void
    {
        $user = $this->admin();
        $bank = $this->makeBank(['requires_key' => false, 'type' => 'wallet']);

        $request = new StoreEmployeeRequest;
        $request->setUserResolver(fn () => $user);
        $request->merge([
            'bank_id' => $bank->id,
            'bank_account_number' => '3001234567',
            'bank_key' => '',
        ]);
        $request->prepareForValidation();

        $rules = $request->rules();
        $validator = validator($request->all(), ['bank_key' => $rules['bank_key']]);

        $this->assertFalse($validator->fails(), 'La clave no debería ser obligatoria en un banco que no la pide.');
    }

    public function test_un_banco_que_si_pide_clave_la_sigue_exigiendo(): void
    {
        $user = $this->admin();
        $bank = $this->makeBank(['requires_key' => true]);

        $request = new StoreEmployeeRequest;
        $request->setUserResolver(fn () => $user);
        $request->merge([
            'bank_id' => $bank->id,
            'bank_account_number' => '1234567890',
            'bank_key' => '',
        ]);
        $request->prepareForValidation();

        $rules = $request->rules();
        $validator = validator($request->all(), ['bank_key' => $rules['bank_key']]);

        $this->assertTrue($validator->fails(), 'La clave debería seguir siendo obligatoria donde el banco la exige.');
    }

    public function test_el_tipo_de_entidad_es_obligatorio_al_crear(): void
    {
        $this->actingAs($this->admin())
            ->post(route('banks.store'), ['name' => 'Banco sin tipo '.uniqid()])
            ->assertSessionHasErrors('type');
    }
}
