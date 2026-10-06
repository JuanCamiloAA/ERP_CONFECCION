<?php

namespace App\Models;

use App\Models\Concerns\ResolvesMediaUrlsInArray;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;

class Company extends Model
{
    use HasFactory, ResolvesMediaUrlsInArray, SoftDeletes;

    /*
     * Estado de la membresia. Lo mueve `MembershipService` (y el comando `membership:process`),
     * nunca un update suelto: cada cambio deja su renglon en la bitacora.
     */
    public const MEMBERSHIP_TRIAL = 'prueba';

    public const MEMBERSHIP_ACTIVE = 'activa';

    /** Vencio sin pagar: sigue trabajando normal hasta `grace_ends_at`. */
    public const MEMBERSHIP_GRACE = 'gracia';

    /** La gracia paso sin pago: sus usuarios solo pueden entrar a pagar. */
    public const MEMBERSHIP_SUSPENDED = 'suspendida';

    public const MEMBERSHIP_LABELS = [
        self::MEMBERSHIP_TRIAL => 'Prueba',
        self::MEMBERSHIP_ACTIVE => 'Activa',
        self::MEMBERSHIP_GRACE => 'En gracia',
        self::MEMBERSHIP_SUSPENDED => 'Suspendida',
    ];

    /**
     * @var list<string>
     */
    protected array $mediaUrlAttributes = ['logo'];

    protected $fillable = [
        'name',
        'nit',
        'address',
        'phone',
        'email',
        'logo',
        'is_active',
        'settings',
        'membership_plan_id',
        'billing_cycle_id',
        // `membership_status` y `grace_ends_at` no van aqui a proposito: solo los mueve
        // `MembershipService` con forceFill, para que ningun formulario los cambie de lado.
        'membership_started_at',
        'membership_ends_at',
        'payment_gateway',
        'payment_customer_id',
        'auto_debit_enabled',
        'next_charge_at',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'settings' => 'array',
        'membership_started_at' => 'datetime',
        'membership_ends_at' => 'datetime',
        'grace_ends_at' => 'datetime',
        'auto_debit_enabled' => 'boolean',
        'next_charge_at' => 'date',
    ];

    public function membershipPlan(): BelongsTo
    {
        return $this->belongsTo(MembershipPlan::class, 'membership_plan_id');
    }

    public function billingCycle(): BelongsTo
    {
        return $this->belongsTo(BillingCycle::class);
    }

    public function membershipEvents(): HasMany
    {
        return $this->hasMany(CompanyMembershipEvent::class)->latest('created_at')->latest('id');
    }

    /** Una tarjeta activa por empresa; la tabla admite historico si algun dia hay varias. */
    public function paymentMethod(): HasOne
    {
        return $this->hasOne(CompanyPaymentMethod::class);
    }

    public function billingCharges(): HasMany
    {
        return $this->hasMany(CompanyBillingCharge::class)->orderByDesc('charged_at')->orderByDesc('id');
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    public function employees(): HasMany
    {
        return $this->hasMany(Employee::class);
    }

    public function references(): HasMany
    {
        return $this->hasMany(Reference::class);
    }

    public function operations(): HasMany
    {
        return $this->hasMany(Operation::class);
    }

    public function productions(): HasMany
    {
        return $this->hasMany(Production::class);
    }

    public function payrolls(): HasMany
    {
        return $this->hasMany(Payroll::class);
    }

    public function advances(): HasMany
    {
        return $this->hasMany(Advance::class);
    }

    public function payrollConcepts(): HasMany
    {
        return $this->hasMany(PayrollConcept::class);
    }

    public function expenseCategories(): HasMany
    {
        return $this->hasMany(ExpenseCategory::class);
    }

    public function expenses(): HasMany
    {
        return $this->hasMany(Expense::class);
    }

    public function settings(): HasMany
    {
        return $this->hasMany(Setting::class);
    }

    public function roles(): HasMany
    {
        return $this->hasMany(Role::class);
    }

    /**
     * Fecha límite en maestro empresa: permite acceso ese día inclusivo y bloquea a partir del día siguiente.
     * Si no hay fecha, no hay tope temporal (solo cuenta is_active).
     */
    public function isMembershipEnded(?Carbon $today = null): bool
    {
        if ($this->membership_ends_at === null) {
            return false;
        }

        $today = ($today ?? Carbon::today())->copy()->startOfDay();
        $limit = Carbon::parse($this->membership_ends_at)->copy()->startOfDay();

        return $today->gt($limit);
    }

    public function isSuspended(): bool
    {
        return $this->membership_status === self::MEMBERSHIP_SUSPENDED;
    }

    public function membershipLabel(): string
    {
        return self::MEMBERSHIP_LABELS[$this->membership_status] ?? (string) $this->membership_status;
    }

    /**
     * Motivo por el que un usuario de empresa NO puede autenticarse, o null si la empresa permite acceso corporativo.
     *
     * La membresia vencida ya no bloquea la entrada: pasa por gracia y, si se suspende, sus
     * usuarios entran pero solo pueden ir a pagar (ver `EnsureUserBelongsToCompany`). Cerrarles
     * la puerta del todo era dejarlos sin forma de renovar por su cuenta.
     */
    public function corporateAuthenticationBlockReason(?Carbon $today = null): ?string
    {
        if (! $this->is_active) {
            return 'Tu empresa esta inactiva. Contacta al soporte.';
        }

        return null;
    }
}
