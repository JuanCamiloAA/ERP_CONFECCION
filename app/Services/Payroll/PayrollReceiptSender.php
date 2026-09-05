<?php

namespace App\Services\Payroll;

use App\Mail\PayrollReceiptMail;
use App\Models\Payroll;
use App\Models\PayrollEmployee;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\URL;
use Throwable;

/**
 * Envio de comprobantes por correo, uno por empleado.
 *
 * Va empleado por empleado y aisla el fallo de cada uno: con un solo `try` alrededor del
 * lote, un correo rebotado a la mitad dejaba a los siguientes sin enviar y sin manera de
 * saber cuales habian salido. El registro (`receipt_sent_at`) se escribe solo cuando el
 * envio salio bien, para que la marca «enviado» no mienta.
 *
 * El envio es sincrono a proposito: el proyecto no tiene worker de colas corriendo (el
 * unico job existente esta marcado como deprecado por eso mismo), y encolar aqui habria
 * dejado los comprobantes esperando indefinidamente sin que nadie se enterara.
 */
class PayrollReceiptSender
{
    public function __construct(
        private PayrollReceiptBuilder $builder,
        private PayrollReceiptPdf $pdf,
    ) {}

    /**
     * @param  Collection<int, PayrollEmployee>  $rows
     * @return array{sent: list<string>, skipped: list<array{name: string, reason: string}>, failed: list<array{name: string, reason: string}>}
     */
    public function send(Payroll $payroll, Collection $rows): array
    {
        $sent = [];
        $skipped = [];
        $failed = [];

        foreach ($rows as $row) {
            $name = trim(($row->employee->first_name ?? '').' '.($row->employee->last_name ?? '')) ?: 'Empleado';
            $email = trim((string) ($row->employee->email ?? ''));

            if ($email === '' || ! filter_var($email, FILTER_VALIDATE_EMAIL)) {
                $skipped[] = ['name' => $name, 'reason' => 'sin correo valido'];

                continue;
            }

            try {
                $receipt = $this->builder->build($payroll, $row);
                $pdf = $this->pdf->render($payroll, $row);

                Mail::to($email)->send(new PayrollReceiptMail(
                    payroll: $payroll,
                    payrollEmployee: $row,
                    receipt: $receipt,
                    pdf: $pdf,
                    pdfName: $this->pdf->filename($payroll, $row),
                    link: $this->publicLink($payroll, $row),
                ));

                $row->forceFill([
                    'receipt_sent_at' => now(),
                    'receipt_sent_to' => $email,
                    'receipt_sent_count' => (int) $row->receipt_sent_count + 1,
                ])->save();

                $sent[] = $name;
            } catch (Throwable $e) {
                // El detalle va al log; al usuario le sirve el nombre y que fallo, no la traza.
                Log::error('No se pudo enviar el comprobante de nomina', [
                    'payroll_id' => $payroll->id,
                    'payroll_employee_id' => $row->id,
                    'error' => $e->getMessage(),
                ]);

                $failed[] = ['name' => $name, 'reason' => $e->getMessage()];
            }
        }

        return ['sent' => $sent, 'skipped' => $skipped, 'failed' => $failed];
    }

    /**
     * Enlace firmado y con caducidad al PDF. El empleado no tiene usuario en la
     * plataforma, asi que la firma de la URL es lo unico que autoriza la descarga.
     */
    public function publicLink(Payroll $payroll, PayrollEmployee $row): string
    {
        return URL::temporarySignedRoute(
            'payrolls.receipt.public',
            now()->addDays((int) config('branding.mail.receipt_link_days', 45)),
            ['payroll' => $payroll->id, 'payrollEmployee' => $row->id],
        );
    }
}
