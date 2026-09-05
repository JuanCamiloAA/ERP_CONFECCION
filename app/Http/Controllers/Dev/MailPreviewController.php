<?php

namespace App\Http\Controllers\Dev;

use App\Http\Controllers\Controller;
use App\Models\MembershipPlan;
use App\Models\Payroll;
use App\Models\PayrollEmployee;
use App\Models\User;
use App\Services\Payroll\PayrollReceiptBuilder;
use App\Services\Payroll\PayrollReceiptSender;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\View;

/**
 * Vista previa de los correos en el navegador. Solo se registra en entorno local.
 *
 * Existe porque probar un correo enviandolo cuesta un minuto por intento y deja
 * ruido en la bandeja: aqui el mismo HTML que sale por el transporte se recarga
 * con F5. Lo que no reemplaza es la prueba final en el cliente real, que es la
 * unica que dice como se ve en Outlook.
 */
class MailPreviewController extends Controller
{
    public function __invoke(?string $email = null): Response
    {
        $previews = $this->previews();

        if ($email === null || ! isset($previews[$email])) {
            return response($this->index(array_keys($previews)));
        }

        [$view, $data] = $previews[$email]();

        return response(View::make($view, $data)->render());
    }

    /**
     * @return array<string, callable(): array{0: string, 1: array<string, mixed>}>
     */
    protected function previews(): array
    {
        return [
            'landing-plan-inquiry' => fn () => ['emails.landing-plan-inquiry', [
                'plan' => MembershipPlan::query()->first() ?? new MembershipPlan([
                    'name' => 'Basico',
                    'price_monthly' => 89000,
                ]),
                'payload' => [
                    'company_name' => 'Confecciones La Aguja SAS',
                    'company_tax_id' => '901.234.567-8',
                    'company_phone' => '3196439570',
                    'company_email' => 'contacto@laaguja.co',
                    'admin_full_name' => 'Juan Diego Mira Moreno',
                    'admin_email' => 'juandiego.miramoreno@gmail.com',
                    'admin_phone' => '3196439570',
                    'message' => "Somos un taller de 24 maquinas.\nQueremos saber si el plan cubre nomina por operacion.",
                ],
            ]],

            'reset-password' => fn () => ['emails.auth.reset-password', [
                'url' => url('/reset-password/'.str_repeat('a1b2c3d4', 8)),
                'user' => User::query()->first() ?? new User([
                    'name' => 'Camilo',
                    'email' => 'camilo@ejemplo.com',
                ]),
                'expiresInMinutes' => config('auth.passwords.'.config('auth.defaults.passwords').'.expire'),
            ]],

            'payroll-receipt' => function () {
                $payroll = Payroll::query()->withoutGlobalScopes()
                    ->whereHas('payrollEmployees')
                    ->orderByDesc('id')
                    ->first();

                abort_if($payroll === null, 404, 'No hay nominas con empleados para previsualizar.');

                $row = PayrollEmployee::query()
                    ->where('payroll_id', $payroll->id)
                    ->orderByDesc('net_payment')
                    ->firstOrFail();

                return ['emails.payroll-receipt', [
                    'receipt' => app(PayrollReceiptBuilder::class)->build($payroll, $row),
                    'link' => app(PayrollReceiptSender::class)->publicLink($payroll, $row),
                ]];
            },

            'test' => fn () => ['emails.test', [
                'transport' => config('mail.default'),
                'sentAt' => now(),
            ]],
        ];
    }

    /**
     * @param  list<string>  $names
     */
    protected function index(array $names): string
    {
        $links = collect($names)
            ->map(fn (string $name) => '<li style="margin:6px 0;"><a style="color:#d2cefd;" href="'.url('dev/emails/'.$name).'">'.e($name).'</a></li>')
            ->implode('');

        return '<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Vista previa de correos</title></head>'
            .'<body style="margin:0;padding:40px;background:#101120;color:#e9e9ed;font-family:system-ui,sans-serif;">'
            .'<h1 style="font-size:18px;margin:0 0 16px;">Vista previa de correos</h1>'
            .'<ul style="list-style:none;padding:0;">'.$links.'</ul></body></html>';
    }
}
