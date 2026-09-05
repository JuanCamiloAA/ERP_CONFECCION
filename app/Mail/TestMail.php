<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * Correo de prueba de `php artisan mail:test`.
 *
 * Usa la plantilla real y no texto plano a proposito: la prueba sirve tanto para
 * verificar el transporte como para ver como llega el maquetado en el cliente de
 * correo de verdad (Gmail, Outlook, Apple Mail), que es lo unico que decide.
 */
class TestMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public string $transport) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Prueba de correo — '.config('branding.mail.brand'),
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.test',
            with: [
                'transport' => $this->transport,
                'sentAt' => now(),
            ],
        );
    }
}
