<?php

namespace App\Mail;

use App\Models\Payroll;
use App\Models\PayrollEmployee;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Mail\Mailables\Attachment;
use Illuminate\Queue\SerializesModels;

/**
 * Comprobante de nomina de un empleado: resumen en el cuerpo, PDF adjunto y enlace.
 *
 * El PDF llega ya generado (bytes) y no se genera aqui: el envio recorre varios empleados y
 * el mismo comprobante hace falta antes, para no mandar un correo si el PDF fallo.
 */
class PayrollReceiptMail extends Mailable
{
    use Queueable, SerializesModels;

    /**
     * @param  array<string, mixed>  $receipt  Datos ya calculados del comprobante.
     */
    public function __construct(
        public Payroll $payroll,
        public PayrollEmployee $payrollEmployee,
        public array $receipt,
        public string $pdf,
        public string $pdfName,
        public string $link,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Tu comprobante de nómina — '.$this->payroll->name,
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.payroll-receipt',
            with: ['receipt' => $this->receipt, 'link' => $this->link],
        );
    }

    /**
     * @return list<Attachment>
     */
    public function attachments(): array
    {
        return [
            Attachment::fromData(fn () => $this->pdf, $this->pdfName)
                ->withMime('application/pdf'),
        ];
    }
}
