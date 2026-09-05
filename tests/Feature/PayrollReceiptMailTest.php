<?php

namespace Tests\Feature;

use App\Mail\PayrollReceiptMail;
use App\Models\Payroll;
use App\Models\PayrollEmployee;
use App\Models\Scopes\CompanyScope;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\URL;
use Tests\TestCase;

/**
 * Envio del comprobante de nomina por correo.
 *
 * Lo que se protege: que solo salga de una nomina pagada y con permiso, que se mande
 * unicamente a los seleccionados, que quien no tiene correo quede reportado en vez de
 * desaparecer, que reenviar siga siendo posible, y que el enlace publico del PDF no se
 * abra sin firma — es la unica puerta que hay entre un desconocido y la liquidacion
 * de un empleado.
 *
 * Lo que escribe va dentro de una transaccion que se revierte al terminar.
 */
class PayrollReceiptMailTest extends TestCase
{
    use DatabaseTransactions;

    protected function actor(): User
    {
        $user = User::query()
            ->whereNotNull('company_id')
            ->get()
            ->first(fn (User $u) => ! $u->isSuperAdmin() && $u->can('payrolls.show.send_receipts'));

        if ($user === null) {
            $this->markTestSkipped('No hay usuario de empresa con permiso payrolls.show.send_receipts.');
        }

        return $user;
    }

    /**
     * Nomina pagada con empleados, marcandola pagada si hace falta: la transaccion
     * de la prueba deshace el cambio.
     */
    protected function paidPayroll(User $user): Payroll
    {
        $payroll = Payroll::query()->withoutGlobalScope(CompanyScope::class)
            ->where('company_id', $user->company_id)
            ->whereHas('payrollEmployees')
            ->orderByDesc('period_start')
            ->first();

        if ($payroll === null) {
            $this->markTestSkipped('La empresa del usuario no tiene nominas con empleados.');
        }

        if ($payroll->status !== Payroll::STATUS_PAID) {
            $payroll->forceFill(['status' => Payroll::STATUS_PAID])->save();
        }

        return $payroll;
    }

    /**
     * @return \Illuminate\Database\Eloquent\Collection<int, PayrollEmployee>
     */
    protected function rowsOf(Payroll $payroll)
    {
        return PayrollEmployee::query()
            ->where('payroll_id', $payroll->id)
            ->with('employee')
            ->get();
    }

    public function test_sending_requires_the_permission(): void
    {
        $actor = $this->actor();
        $payroll = $this->paidPayroll($actor);
        $row = $this->rowsOf($payroll)->first();

        $outsider = User::query()
            ->whereNotNull('company_id')
            ->get()
            ->first(fn (User $u) => ! $u->isSuperAdmin() && ! $u->can('payrolls.show.send_receipts'));

        if ($outsider === null) {
            $this->markTestSkipped('No hay usuario sin el permiso para comprobar el bloqueo.');
        }

        $this->actingAs($outsider)
            ->post(route('payrolls.receipts.send', $payroll->id), [
                'payroll_employee_ids' => [$row->id],
            ])
            ->assertForbidden();
    }

    public function test_it_refuses_a_payroll_that_is_not_paid_yet(): void
    {
        $actor = $this->actor();
        $payroll = $this->paidPayroll($actor);
        $row = $this->rowsOf($payroll)->first();

        $payroll->forceFill(['status' => Payroll::STATUS_APPROVED])->save();

        Mail::fake();

        $this->actingAs($actor)
            ->post(route('payrolls.receipts.send', $payroll->id), [
                'payroll_employee_ids' => [$row->id],
            ])
            ->assertStatus(422);

        Mail::assertNothingSent();
    }

    public function test_it_only_mails_the_selected_employees_and_records_the_delivery(): void
    {
        $actor = $this->actor();
        $payroll = $this->paidPayroll($actor);
        $rows = $this->rowsOf($payroll);

        $target = $rows->first();
        $target->employee->forceFill(['email' => 'destino.prueba@ejemplo.com'])->save();

        Mail::fake();

        $this->actingAs($actor)
            ->post(route('payrolls.receipts.send', $payroll->id), [
                'payroll_employee_ids' => [$target->id],
            ])
            ->assertRedirect();

        Mail::assertSent(PayrollReceiptMail::class, 1);
        Mail::assertSent(
            PayrollReceiptMail::class,
            fn (PayrollReceiptMail $mail) => $mail->hasTo('destino.prueba@ejemplo.com')
                && str_starts_with($mail->pdf, '%PDF')
                && str_ends_with($mail->pdfName, '.pdf'),
        );

        $fresh = PayrollEmployee::find($target->id);
        $this->assertNotNull($fresh->receipt_sent_at);
        $this->assertSame('destino.prueba@ejemplo.com', $fresh->receipt_sent_to);
        $this->assertSame(1, $fresh->receipt_sent_count);
    }

    public function test_an_employee_without_email_is_reported_instead_of_silently_dropped(): void
    {
        $actor = $this->actor();
        $payroll = $this->paidPayroll($actor);
        $target = $this->rowsOf($payroll)->first();

        $target->employee->forceFill(['email' => null])->save();

        Mail::fake();

        $this->actingAs($actor)
            ->post(route('payrolls.receipts.send', $payroll->id), [
                'payroll_employee_ids' => [$target->id],
            ])
            ->assertRedirect()
            ->assertSessionHas('error', fn (string $message) => str_contains($message, 'Sin correo registrado'));

        Mail::assertNothingSent();
        $this->assertNull(PayrollEmployee::find($target->id)->receipt_sent_at);
    }

    public function test_resending_is_allowed_and_counts_up(): void
    {
        $actor = $this->actor();
        $payroll = $this->paidPayroll($actor);
        $target = $this->rowsOf($payroll)->first();

        $target->employee->forceFill(['email' => 'reenvio.prueba@ejemplo.com'])->save();

        Mail::fake();

        foreach ([1, 2] as $expected) {
            $this->actingAs($actor)
                ->post(route('payrolls.receipts.send', $payroll->id), [
                    'payroll_employee_ids' => [$target->id],
                ])
                ->assertRedirect();

            $this->assertSame($expected, PayrollEmployee::find($target->id)->receipt_sent_count);
        }

        Mail::assertSent(PayrollReceiptMail::class, 2);
    }

    public function test_the_public_receipt_link_is_useless_without_its_signature(): void
    {
        $actor = $this->actor();
        $payroll = $this->paidPayroll($actor);
        $row = $this->rowsOf($payroll)->first();

        $this->get(route('payrolls.receipt.public', [
            'payroll' => $payroll->id,
            'payrollEmployee' => $row->id,
        ]))->assertForbidden();
    }

    public function test_the_signed_receipt_link_serves_the_pdf_without_logging_in(): void
    {
        $actor = $this->actor();
        $payroll = $this->paidPayroll($actor);
        $row = $this->rowsOf($payroll)->first();

        $signed = URL::temporarySignedRoute(
            'payrolls.receipt.public',
            now()->addDay(),
            ['payroll' => $payroll->id, 'payrollEmployee' => $row->id],
        );

        $response = $this->get($signed);

        $response->assertOk();
        $response->assertHeader('content-type', 'application/pdf');
        $this->assertStringStartsWith('%PDF', $response->getContent());
    }
}
