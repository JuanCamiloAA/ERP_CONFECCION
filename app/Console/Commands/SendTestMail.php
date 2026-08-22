<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Mail;
use Throwable;

/**
 * Prueba de envio de correo con la configuracion vigente.
 *
 * Existe porque los fallos de correo casi nunca aparecen donde se usan: el formulario de
 * la landing o el «olvide mi contrasena» dicen «enviado» y el mensaje se pierde en el
 * transporte. Aqui el error del servidor SMTP se ve tal cual, con el remitente y el
 * transporte que se estan usando de verdad.
 */
class SendTestMail extends Command
{
    protected $signature = 'mail:test {email : Direccion que recibira la prueba}';

    protected $description = 'Envia un correo de prueba con la configuracion actual y muestra el resultado.';

    public function handle(): int
    {
        $to = (string) $this->argument('email');

        if (! filter_var($to, FILTER_VALIDATE_EMAIL)) {
            $this->error("«{$to}» no es una direccion de correo valida.");

            return self::FAILURE;
        }

        $mailer = (string) config('mail.default');
        $from = (string) config('mail.from.address');

        $this->newLine();
        $this->line('  Transporte  : '.$mailer);

        if ($mailer === 'smtp') {
            $this->line('  Servidor    : '.config('mail.mailers.smtp.host').':'.config('mail.mailers.smtp.port'));
            $this->line('  Usuario     : '.config('mail.mailers.smtp.username'));
        }

        $this->line('  Remitente   : '.$from.' ('.config('mail.from.name').')');
        $this->line('  Destino     : '.$to);
        $this->newLine();

        // El transporte «log» no envia nada: escribe el mensaje en storage/logs. Es el
        // valor por defecto del proyecto, y sin este aviso la prueba parece exitosa.
        if ($mailer === 'log') {
            $this->warn('MAIL_MAILER=log: el mensaje se escribira en storage/logs/laravel.log, NO se enviara.');
        }

        try {
            Mail::raw(
                'Prueba de configuracion de correo de '.config('app.name').".\n\n"
                ."Si lees esto, el envio de correo funciona.\n"
                .'Enviado el '.now()->format('d/m/Y H:i:s').".\n",
                fn ($message) => $message->to($to)->subject('Prueba de correo — '.config('app.name')),
            );
        } catch (Throwable $e) {
            $this->newLine();
            $this->error('Fallo el envio: '.$e->getMessage());
            $this->newLine();

            foreach ($this->hints($mailer) as $hint) {
                $this->line('  '.$hint);
            }

            return self::FAILURE;
        }

        $this->info($mailer === 'log'
            ? 'Escrito en el log. Cambie MAIL_MAILER para enviar de verdad.'
            : 'Correo entregado al proveedor. Revise la bandeja de entrada (y la carpeta de spam).');

        return self::SUCCESS;
    }

    /**
     * Que revisar cuando falla, segun el transporte: las causas no se parecen en nada.
     *
     * @return list<string>
     */
    protected function hints(string $mailer): array
    {
        if ($mailer === 'brevo') {
            return [
                'Revise que BREVO_API_KEY sea la clave v3 (xkeysib-...), no la clave SMTP.',
                'Si el error habla de una IP no reconocida, autorice la IP de este servidor',
                'en Brevo > Security > Authorised IPs (o desactive esa restriccion).',
                'El remitente ('.config('mail.from.address').') debe estar verificado en Brevo.',
            ];
        }

        return [
            'Revise usuario y clave SMTP, que el remitente este verificado en el proveedor',
            'y que el servidor tenga salida al puerto configurado.',
        ];
    }
}
