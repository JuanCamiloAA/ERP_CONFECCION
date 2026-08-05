<?php

namespace App\Http\Controllers;

use App\Contracts\ObjectStorageInterface;
use App\Models\PayrollPeriodicity;
use App\Services\Files\StoredFileDeleter;
use App\Support\OperationDifficulty;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class SettingController extends Controller
{
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
        ]);
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
