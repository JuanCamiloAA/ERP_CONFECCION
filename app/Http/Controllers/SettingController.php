<?php

namespace App\Http\Controllers;

use App\Contracts\ObjectStorageInterface;
use App\Models\Company;
use App\Models\CompanyBillingCharge;
use App\Models\PayrollPeriodicity;
use App\Models\Scopes\CompanyScope;
use App\Services\Files\StoredFileDeleter;
use App\Support\OperationDifficulty;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class SettingController extends Controller
{
    /** Ultimos cobros que se muestran en pantalla; el resto no cabe ni se consulta a diario. */
    protected const BILLING_HISTORY_LIMIT = 10;

    public function __construct(
        protected ObjectStorageInterface $objectStorage,
        protected StoredFileDeleter $storedFileDeleter,
    ) {}

    public function index(Request $request): Response
    {
        $company = $request->user()->company;
        if (! $company) {
            abort(404);
        }

        $defaults = [
            'currency' => 'COP',
            'payroll_periodicity' => 'quincenal',
            'default_deductions' => [
                ['key' => 'salud', 'label' => 'Salud', 'percent' => 4],
                ['key' => 'pension', 'label' => 'Pension', 'percent' => 4],
            ],
            'difficulty_minute_thresholds' => OperationDifficulty::DEFAULT_THRESHOLDS,
        ];

        $stored = $company->settings ?? [];
        $merged = array_merge($defaults, $stored ?? []);

        if (isset($merged['payroll_periodicity']) && $merged['payroll_periodicity'] !== '') {
            $ok = PayrollPeriodicity::query()
                ->where('code', $merged['payroll_periodicity'])
                ->where('is_active', true)
                ->exists();
            if (! $ok) {
                $merged['payroll_periodicity'] = $defaults['payroll_periodicity'];
            }
        }

        return Inertia::render('Settings/Index', [
            'company' => $company,
            'settings' => $merged,
            'membership' => $this->membershipPayload($company),
        ]);
    }

    /**
     * Estado de la membresia de la empresa.
     *
     * Es informativo y de solo lectura: el plan y la fecha limite los fija el super admin
     * desde Empresas, no el administrador de la empresa desde su propia pantalla. Aqui se
     * responde a lo unico que se pregunta a diario —que plan tengo, hasta cuando y cuanto
     * me queda de cupo— sin tener que pedirselo a soporte.
     *
     * @return array<string, mixed>
     */
    protected function membershipPayload(Company $company): array
    {
        $company->loadMissing(['membershipPlan', 'paymentMethod']);
        $plan = $company->membershipPlan;
        $card = $company->paymentMethod;

        $endsAt = $company->membership_ends_at;
        $daysLeft = $endsAt ? Carbon::today()->diffInDays(Carbon::parse($endsAt)->startOfDay(), false) : null;

        $staffUsed = $company->users()->whereNull('employee_id')->count();
        $employeesUsed = $company->employees()->withoutGlobalScope(CompanyScope::class)->count();

        return [
            'plan' => $plan ? [
                'name' => $plan->name,
                'slug' => $plan->slug,
                'price_monthly' => $plan->price_monthly !== null ? (float) $plan->price_monthly : null,
                'features' => array_values($plan->features_json ?? []),
            ] : null,
            'started_at' => $company->membership_started_at?->toDateString(),
            'ends_at' => $endsAt?->toDateString(),
            // Negativo = ya vencio. Null = sin fecha limite.
            'days_left' => $daysLeft !== null ? (int) $daysLeft : null,
            'is_expired' => $company->isMembershipEnded(),
            'is_active' => (bool) $company->is_active,
            'usage' => [
                'staff_used' => $staffUsed,
                'staff_limit' => $plan?->max_staff_users,
                'employees_used' => $employeesUsed,
                'employees_limit' => $plan?->max_employees,
            ],
            // Nunca el token ni, por supuesto, el numero completo: solo lo que hace falta
            // para que quien mira reconozca su tarjeta.
            'payment_method' => $card ? [
                'brand' => $card->brand,
                'last4' => $card->last4,
                'expiry_month' => $card->expiry_month,
                'expiry_year' => $card->expiry_year,
                'expiry_label' => $card->expiry_label,
                'holder_name' => $card->holder_name,
            ] : null,
            'auto_debit_enabled' => (bool) $company->auto_debit_enabled,
            'next_charge_at' => $company->next_charge_at?->toDateString() ?? $endsAt?->toDateString(),
            'next_charge_amount' => $plan?->price_monthly !== null ? (float) $plan->price_monthly : null,
            'billing_charges' => $company->billingCharges()
                ->limit(self::BILLING_HISTORY_LIMIT)
                ->get()
                ->map(fn (CompanyBillingCharge $charge) => [
                    'id' => $charge->id,
                    'amount' => (float) $charge->amount,
                    'currency' => $charge->currency,
                    'concept' => $charge->concept,
                    'status' => $charge->status,
                    'charged_at' => $charge->charged_at?->toIso8601String(),
                ])
                ->all(),
        ];
    }

    /**
     * Guarda la tarjeta con la que se cobra la membresia.
     *
     * Hoy la pasarela no esta conectada, asi que el `gateway_token` es un marcador de
     * posicion. Lo que no cambia al conectarla es el contrato de esta accion: el numero de
     * tarjeta y el CVC **no se guardan ni se registran**. En la integracion real el frontend
     * tokeniza contra el SDK de la pasarela y aqui solo llega el token mas la marca, los
     * cuatro ultimos digitos y el vencimiento; el campo `card_number` que se valida abajo
     * desaparece de la peticion ese dia.
     */
    public function updatePaymentMethod(Request $request): RedirectResponse
    {
        $company = $request->user()->company;
        if (! $company) {
            abort(404);
        }

        $data = $request->validate([
            'holder_name' => ['required', 'string', 'max:120'],
            // Solo para derivar marca y ultimos cuatro; no se persiste en ningun campo.
            'card_number' => ['required', 'string', 'regex:/^[0-9 ]{13,25}$/'],
            'expiry_month' => ['required', 'integer', 'between:1,12'],
            'expiry_year' => ['required', 'integer', 'between:'.now()->year.','.(now()->year + 20)],
            'cvc' => ['required', 'string', 'regex:/^[0-9]{3,4}$/'],
        ], [
            'card_number.regex' => 'El número de tarjeta no es válido.',
            'cvc.regex' => 'El código de seguridad no es válido.',
            'expiry_year.between' => 'El año de vencimiento no es válido.',
        ]);

        $digits = preg_replace('/\D/', '', $data['card_number']) ?? '';

        // Mientras no haya pasarela, esta es la unica comprobacion del numero que existe.
        if (strlen($digits) < 13 || ! self::passesLuhn($digits)) {
            return back()->withErrors(['card_number' => 'El número de tarjeta no es válido.']);
        }

        if (! $this->cardStillValid((int) $data['expiry_month'], (int) $data['expiry_year'])) {
            return back()->withErrors(['expiry_month' => 'La tarjeta está vencida.']);
        }

        $company->paymentMethod()->updateOrCreate(
            ['company_id' => $company->id],
            [
                // Marcador de posicion hasta que exista pasarela. TODO: sustituir por el
                // token que devuelva el SDK; nunca derivarlo del numero de tarjeta.
                'gateway_token' => 'pendiente_'.Str::random(32),
                'brand' => self::cardBrand($digits),
                'last4' => substr($digits, -4),
                'expiry_month' => (int) $data['expiry_month'],
                'expiry_year' => (int) $data['expiry_year'],
                'holder_name' => $data['holder_name'],
            ]
        );

        // El numero y el CVC mueren aqui: fuera de la peticion no existe copia de ellos.
        unset($digits, $data);

        return back()->with('success', 'Tarjeta guardada.');
    }

    /**
     * Activa o desactiva la renovacion automatica.
     */
    public function toggleAutoDebit(Request $request): RedirectResponse
    {
        $company = $request->user()->company;
        if (! $company) {
            abort(404);
        }

        $data = $request->validate(['enabled' => ['required', 'boolean']]);
        $enabled = (bool) $data['enabled'];

        // Activarlo sin tarjeta dejaria una empresa esperando un cobro que nunca se
        // intentaria; se dice ahora y no el dia del vencimiento.
        if ($enabled && $company->paymentMethod()->doesntExist()) {
            return back()->withErrors([
                'enabled' => 'Agrega una tarjeta antes de activar la renovación automática.',
            ]);
        }

        $company->forceFill([
            'auto_debit_enabled' => $enabled,
            // Sin fecha propia, la primera renovacion cae el dia que vence la membresia.
            'next_charge_at' => $enabled
                ? ($company->next_charge_at ?? $company->membership_ends_at?->toDateString())
                : $company->next_charge_at,
        ])->save();

        return back()->with('success', $enabled
            ? 'Renovación automática activada.'
            : 'Renovación automática desactivada.');
    }

    /**
     * Digito de control de Luhn, el mismo que usa cualquier pasarela antes de intentar cobrar.
     *
     * Atrapa el error de tecleo, que es para lo que sirve; no dice si la tarjeta existe.
     */
    protected static function passesLuhn(string $digits): bool
    {
        $sum = 0;
        $double = false;

        for ($i = strlen($digits) - 1; $i >= 0; $i--) {
            $value = (int) $digits[$i];

            if ($double) {
                $value *= 2;
                if ($value > 9) {
                    $value -= 9;
                }
            }

            $sum += $value;
            $double = ! $double;
        }

        return $sum % 10 === 0;
    }

    /** Una tarjeta vale hasta el ultimo dia de su mes de vencimiento, ese dia incluido. */
    protected function cardStillValid(int $month, int $year): bool
    {
        return Carbon::create($year, $month, 1)->endOfMonth()->gte(Carbon::today());
    }

    /**
     * Marca deducida del primer digito (regla IIN estandar).
     *
     * Se calcula aqui solo mientras no hay pasarela; cuando la haya, la marca la informa
     * ella y este metodo desaparece junto con el campo `card_number`.
     */
    protected static function cardBrand(string $digits): string
    {
        return match (true) {
            str_starts_with($digits, '4') => 'Visa',
            (bool) preg_match('/^(5[1-5]|2[2-7])/', $digits) => 'Mastercard',
            (bool) preg_match('/^3[47]/', $digits) => 'American Express',
            (bool) preg_match('/^(36|38|30[0-5])/', $digits) => 'Diners Club',
            str_starts_with($digits, '6') => 'Discover',
            default => 'Tarjeta',
        };
    }

    public function update(Request $request): RedirectResponse
    {
        $company = $request->user()->company;
        if (! $company) {
            abort(404);
        }

        if ($request->has('nit')) {
            $v = trim((string) $request->input('nit', ''));
            $request->merge(['nit' => $v === '' ? null : $v]);
        }

        $validator = Validator::make($request->all(), [
            'name' => ['required', 'string', 'max:120'],
            'nit' => ['nullable', 'string', 'max:30', Rule::unique('companies', 'nit')->ignore($company->id)],
            'address' => ['nullable', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:30'],
            'email' => ['nullable', 'email', 'max:120'],
            'logo' => ['nullable', 'image', 'max:2048'],
            'settings' => ['nullable', 'array'],
            'settings.currency' => ['nullable', 'string', 'max:10'],
            'settings.payroll_periodicity' => [
                'nullable',
                'string',
                'max:50',
                Rule::exists('payroll_periodicities', 'code')->where('is_active', true),
            ],
            'settings.default_deductions' => ['nullable', 'array'],
            'settings.default_deductions.*.key' => ['required_with:settings.default_deductions', 'string', 'max:30'],
            'settings.default_deductions.*.label' => ['required_with:settings.default_deductions', 'string', 'max:50'],
            'settings.default_deductions.*.percent' => ['required_with:settings.default_deductions', 'numeric', 'min:0', 'max:100'],
            'settings.difficulty_minute_thresholds' => ['nullable', 'array', 'size:4'],
            'settings.difficulty_minute_thresholds.*' => ['required_with:settings.difficulty_minute_thresholds', 'numeric', 'min:0.01', 'max:99999'],
        ]);

        $validator->after(function ($validator) use ($request) {
            // La suma de deducciones no puede pasar del 100 %: el neto quedaria negativo y
            // el calculo de nomina lo recortaria a cero sin decir por que.
            $deductions = $request->input('settings.default_deductions');
            if (is_array($deductions) && $deductions !== []) {
                $sum = array_sum(array_map(fn ($row) => (float) ($row['percent'] ?? 0), $deductions));

                if ($sum > 100) {
                    $validator->errors()->add(
                        'settings.default_deductions',
                        'Las deducciones suman '.number_format($sum, 2, ',', '.').' %; no pueden pasar del 100 %.'
                    );
                }
            }

            $thresholds = $request->input('settings.difficulty_minute_thresholds');
            if (! is_array($thresholds) || count($thresholds) !== 4) {
                return;
            }

            $values = array_map('floatval', $thresholds);
            for ($i = 1; $i < count($values); $i++) {
                if ($values[$i] <= $values[$i - 1]) {
                    $validator->errors()->add(
                        'settings.difficulty_minute_thresholds',
                        'Cada nivel debe tener mas minutos que el anterior.'
                    );
                    break;
                }
            }
        });

        $data = $validator->validate();

        $update = [
            'name' => $data['name'],
            'nit' => $data['nit'] ?? null,
            'address' => $data['address'] ?? null,
            'phone' => $data['phone'] ?? null,
            'email' => $data['email'] ?? null,
        ];

        if ($request->hasFile('logo')) {
            $this->storedFileDeleter->deleteIfPresent($company->getAttributes()['logo'] ?? null);
            $uploaded = $this->objectStorage->upload(
                $request->file('logo'),
                "companies/{$company->id}/logo"
            );
            $update['logo'] = $uploaded['path'];
        }

        if (isset($data['settings'])) {
            $update['settings'] = array_merge($company->settings ?? [], $data['settings']);
        }

        $company->update($update);

        return back()->with('success', 'Cambios guardados.');
    }
}
