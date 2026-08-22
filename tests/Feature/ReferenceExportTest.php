<?php

namespace Tests\Feature;

use App\Models\Reference;
use App\Models\User;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

/**
 * Exportacion de referencias a Excel y a la vista imprimible (PDF).
 *
 * Se apoya en los datos que ya tenga la base configurada: no siembra ni modifica nada,
 * solo hace peticiones de lectura. Sin usuario con permiso o sin referencias, cada
 * prueba se omite en lugar de fallar por un entorno vacio.
 */
class ReferenceExportTest extends TestCase
{
    protected function usuarioConPermiso(): User
    {
        $user = User::query()
            ->whereNotNull('company_id')
            ->get()
            ->first(fn (User $u) => $u->isSuperAdmin() || $u->can('references.index.view'));

        if ($user === null) {
            $this->markTestSkipped('No hay usuario con permiso references.index.view en esta base.');
        }

        return $user;
    }

    protected function algunaReferencia(): Reference
    {
        $reference = Reference::query()->withoutGlobalScopes()->first();

        if ($reference === null) {
            $this->markTestSkipped('No hay referencias en esta base.');
        }

        return $reference;
    }

    public function test_excel_export_downloads_a_workbook(): void
    {
        $user = $this->usuarioConPermiso();
        $reference = Reference::query()->withoutGlobalScopes()->where('company_id', $user->company_id)->first();

        if ($reference === null) {
            $this->markTestSkipped('La empresa del usuario no tiene referencias.');
        }

        $response = $this->actingAs($user)->get(route('references.export.excel', ['ids' => $reference->id]));

        $response->assertOk();
        $response->assertHeader('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        $this->assertStringContainsString('attachment; filename=', (string) $response->headers->get('content-disposition'));
        // Todo .xlsx es un ZIP: su firma son los dos primeros bytes.
        $this->assertSame('PK', substr((string) $response->getContent(), 0, 2));
    }

    public function test_pdf_export_renders_the_printable_sheet_with_the_cost_breakdown(): void
    {
        $user = $this->usuarioConPermiso();
        $reference = Reference::query()->withoutGlobalScopes()->where('company_id', $user->company_id)->first();

        if ($reference === null) {
            $this->markTestSkipped('La empresa del usuario no tiene referencias.');
        }

        $response = $this->actingAs($user)->get(route('references.export.pdf', ['ids' => $reference->id]));

        $response->assertOk();
        $response->assertInertia(fn (AssertableInertia $page) => $page
            ->component('References/Print')
            ->has('references', 1)
            ->has('references.0.operational_cost_per_unit')
            ->has('references.0.lot_operational_total')
            ->has('references.0.operations')
            ->where('references.0.code', $reference->code));
    }

    public function test_export_includes_inactive_references(): void
    {
        $user = $this->usuarioConPermiso();
        $reference = Reference::query()->withoutGlobalScopes()
            ->where('company_id', $user->company_id)
            ->where('is_active', false)
            ->first();

        if ($reference === null) {
            $this->markTestSkipped('La empresa del usuario no tiene referencias inactivas.');
        }

        $this->actingAs($user)
            ->get(route('references.export.pdf', ['ids' => $reference->id]))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('References/Print')
                ->where('references.0.status_label', 'Inactiva'));
    }

    public function test_export_warns_instead_of_failing_when_nothing_matches(): void
    {
        $user = $this->usuarioConPermiso();

        $this->actingAs($user)
            ->from(route('references.index'))
            ->get(route('references.export.excel', ['ids' => '99999999']))
            ->assertRedirect(route('references.index'))
            ->assertSessionHas('error');
    }

    public function test_guests_cannot_export(): void
    {
        $this->algunaReferencia();

        $this->get(route('references.export.excel', ['ids' => '1']))->assertRedirect(route('login'));
    }
}
