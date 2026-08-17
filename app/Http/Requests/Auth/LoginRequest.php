<?php

namespace App\Http\Requests\Auth;

use App\Models\Company;
use App\Models\Employee;
use App\Models\Scopes\CompanyScope;
use App\Models\User;
use Illuminate\Auth\Events\Lockout;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class LoginRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * El formulario manda con que credencial se esta entrando. Si no lo manda (clientes
     * viejos que solo enviaban correo) se deduce de lo que venga lleno.
     */
    protected function prepareForValidation(): void
    {
        $mode = $this->input('login_mode');

        if (! in_array($mode, ['email', 'document'], true)) {
            $mode = filled($this->input('document')) ? 'document' : 'email';
        }

        $this->merge([
            'login_mode' => $mode,
            'document' => is_string($this->input('document')) ? trim($this->input('document')) : null,
        ]);
    }

    public function rules(): array
    {
        return [
            'login_mode' => ['required', 'string', 'in:email,document'],
            'email' => ['required_if:login_mode,email', 'nullable', 'string', 'email'],
            'document' => ['required_if:login_mode,document', 'nullable', 'string', 'max:50'],
            'password' => ['required', 'string'],
            'remember' => ['nullable', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'email.required_if' => 'El correo es obligatorio.',
            'email.email' => 'El correo no es valido.',
            'document.required_if' => 'El documento es obligatorio.',
            'password.required' => 'La contrasena es obligatoria.',
        ];
    }

    /** true cuando se esta entrando con documento en vez de correo. */
    public function isDocumentLogin(): bool
    {
        return $this->input('login_mode') === 'document';
    }

    /**
     * Campo al que se cuelgan los mensajes de error, para que salgan bajo el input visible.
     */
    public function credentialField(): string
    {
        return $this->isDocumentLogin() ? 'document' : 'email';
    }

    public function authenticate(): void
    {
        $this->ensureIsNotRateLimited();
        $field = $this->credentialField();

        $authenticated = $this->isDocumentLogin()
            ? $this->attemptWithDocument()
            : Auth::attempt($this->only('email', 'password'), $this->boolean('remember'));

        if (! $authenticated) {
            RateLimiter::hit($this->throttleKey());

            throw ValidationException::withMessages([
                $field => 'Credenciales invalidas.',
            ]);
        }

        $user = Auth::user();

        if ($user && ! $user->is_active) {
            Auth::logout();
            throw ValidationException::withMessages([
                $field => 'Tu cuenta esta desactivada. Contacta al administrador.',
            ]);
        }

        if ($user && ! $user->isSuperAdmin()) {
            if (! $user->company_id) {
                Auth::logout();
                throw ValidationException::withMessages([
                    $field => 'Tu cuenta no esta asociada a ninguna empresa.',
                ]);
            }

            $company = Company::query()->find($user->company_id);

            if (! $company) {
                Auth::logout();
                throw ValidationException::withMessages([
                    $field => 'Tu empresa ya no existe o fue eliminada. Contacta al soporte.',
                ]);
            }

            $blockMessage = $company->corporateAuthenticationBlockReason();

            if ($blockMessage !== null) {
                Auth::logout();
                throw ValidationException::withMessages([
                    $field => $blockMessage,
                ]);
            }
        }

        if ($user) {
            $user->forceFill(['last_login_at' => now()])->save();
        }

        RateLimiter::clear($this->throttleKey());
    }

    /**
     * Entrada con documento: la cedula vive en la ficha del empleado, asi que se busca al
     * usuario enlazado a ella.
     *
     * El documento solo es unico dentro de cada empresa, de modo que puede haber varios
     * candidatos. Si el enlace de acceso trae empresa se filtra por ella; si no, se prueba
     * la contrasena contra cada candidato y entra el que coincida. Nunca se revela si el
     * documento existe: el mensaje de fallo es siempre el mismo.
     */
    private function attemptWithDocument(): bool
    {
        $document = (string) $this->input('document');

        if ($document === '') {
            return false;
        }

        // Sin scope de empresa a proposito: en el login todavia no hay sesion, y el filtro
        // por empresa lo hace el enlace de acceso mas abajo.
        $employeeIds = Employee::query()
            ->withoutGlobalScope(CompanyScope::class)
            ->where('document_number', $document)
            ->pluck('id');

        if ($employeeIds->isEmpty()) {
            return false;
        }

        $candidates = User::query()
            ->whereIn('employee_id', $employeeIds)
            ->when($this->loginCompanyId(), fn ($q, $companyId) => $q->where('company_id', $companyId))
            ->get();

        foreach ($candidates as $candidate) {
            // Se delega en el guard estandar para no duplicar la verificacion del hash.
            if (Auth::attempt(['id' => $candidate->id, 'password' => $this->input('password')], $this->boolean('remember'))) {
                return true;
            }
        }

        return false;
    }

    /** Empresa del enlace de acceso (/login?company=X), cuando viene. */
    private function loginCompanyId(): ?int
    {
        $raw = $this->query('company') ?? $this->query('empresa');

        return is_numeric($raw) ? (int) $raw : null;
    }

    public function ensureIsNotRateLimited(): void
    {
        if (! RateLimiter::tooManyAttempts($this->throttleKey(), 5)) {
            return;
        }

        event(new Lockout($this));

        $seconds = RateLimiter::availableIn($this->throttleKey());

        throw ValidationException::withMessages([
            $this->credentialField() => "Demasiados intentos. Intenta de nuevo en {$seconds} segundos.",
        ]);
    }

    /** La cuenta se limita por la credencial usada, sea correo o documento. */
    public function throttleKey(): string
    {
        $identifier = $this->isDocumentLogin()
            ? 'doc:'.$this->string('document')
            : (string) $this->string('email');

        return Str::transliterate(Str::lower($identifier).'|'.$this->ip());
    }
}
