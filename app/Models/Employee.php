<?php

namespace App\Models;

use App\Models\Concerns\ResolvesMediaUrlsInArray;
use App\Models\Scopes\CompanyScope;
use Illuminate\Database\Eloquent\Attributes\ScopedBy;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

#[ScopedBy([CompanyScope::class])]
class Employee extends Model
{
    use HasFactory, ResolvesMediaUrlsInArray, SoftDeletes;

    /**
     * @var list<string>
     */
    protected array $mediaUrlAttributes = ['photo'];

    public const PAYROLL_MODE_OPERATIONS = 'operations';

    public const PAYROLL_MODE_FIXED_DAILY = 'fixed_daily';

    public const PAYROLL_MODE_HOURLY_LEGAL = 'hourly_legal';

    /** Dias ISO (1=lunes...7=domingo) por defecto: lunes a sabado, domingo como descanso semanal. */
    public const DEFAULT_SCHEDULED_WORK_DAYS = [1, 2, 3, 4, 5, 6];

    protected $fillable = [
        'company_id',
        'user_id',
        'first_name',
        'last_name',
        'document_type',
        'document_number',
        'phone',
        'email',
        'address',
        'hire_date',
        'photo',
        'base_salary',
        'payroll_mode',
        'daily_salary',
        'minutes_per_full_workday',
        'ordinary_hours_per_day',
        'is_exempt_from_overtime',
        'scheduled_work_days',
        'bank_id',
        'bank_account_type',
        'bank_account_number',
        'bank_key',
        'is_active',
        'notes',
    ];

    protected $casts = [
        'hire_date' => 'date',
        'base_salary' => 'decimal:2',
        'daily_salary' => 'decimal:2',
        'minutes_per_full_workday' => 'integer',
        'ordinary_hours_per_day' => 'decimal:2',
        'is_exempt_from_overtime' => 'boolean',
        'is_active' => 'boolean',
    ];

    protected $appends = ['full_name'];

    /**
     * Dias ISO de la jornada programada, SIEMPRE como enteros.
     *
     * El formulario de empleados envia el payload como FormData (forceFormData por la foto),
     * y FormData convierte todo a texto: sin normalizar, se guardaba ["1","2",...] y cualquier
     * comparacion estricta contra Carbon::isoWeekday() (int) fallaba silenciosamente, dejando
     * al empleado sin ningun dia laborable (no se detectaba ninguna inasistencia).
     * Se normaliza al leer y al escribir para reparar tambien los registros ya guardados asi.
     *
     * @return Attribute<list<int>|null, string|null>
     */
    protected function scheduledWorkDays(): Attribute
    {
        return Attribute::make(
            get: function (?string $value): ?array {
                if ($value === null) {
                    return null;
                }

                $decoded = json_decode($value, true);

                return is_array($decoded) ? self::normalizeWorkDays($decoded) : null;
            },
            set: function (array|string|null $value): ?string {
                if ($value === null) {
                    return null;
                }

                if (is_string($value)) {
                    $decoded = json_decode($value, true);
                    $value = is_array($decoded) ? $decoded : [];
                }

                return json_encode(self::normalizeWorkDays($value));
            },
        );
    }

    /**
     * @param  array<int|string, mixed>  $days
     * @return list<int>
     */
    protected static function normalizeWorkDays(array $days): array
    {
        $normalized = [];

        foreach ($days as $day) {
            if (! is_scalar($day)) {
                continue;
            }

            $int = (int) $day;
            if ($int >= 1 && $int <= 7 && ! in_array($int, $normalized, true)) {
                $normalized[] = $int;
            }
        }

        sort($normalized);

        return $normalized;
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function bank(): BelongsTo
    {
        return $this->belongsTo(Bank::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function productions(): HasMany
    {
        return $this->hasMany(Production::class);
    }

    public function payrollEmployees(): HasMany
    {
        return $this->hasMany(PayrollEmployee::class);
    }

    public function advances(): HasMany
    {
        return $this->hasMany(Advance::class);
    }

    public function workDaySessions(): HasMany
    {
        return $this->hasMany(WorkDaySession::class);
    }

    public function isPayrollByOperations(): bool
    {
        return ($this->payroll_mode ?? self::PAYROLL_MODE_OPERATIONS) === self::PAYROLL_MODE_OPERATIONS;
    }

    public function isPayrollFixedDaily(): bool
    {
        return ($this->payroll_mode ?? self::PAYROLL_MODE_OPERATIONS) === self::PAYROLL_MODE_FIXED_DAILY;
    }

    public function isPayrollHourlyLegal(): bool
    {
        return ($this->payroll_mode ?? self::PAYROLL_MODE_OPERATIONS) === self::PAYROLL_MODE_HOURLY_LEGAL;
    }

    /**
     * true para cualquier modalidad que registre tiempo via work_day_sessions (el mismo boton
     * Iniciar/Cerrar jornada de WorkDayBanner.tsx): fixed_daily y hourly_legal. Nunca operations.
     * Usar este metodo en vez de comparar isPayrollFixedDaily() directamente en los puntos de
     * integracion de jornada (WorkDaySessionService, WorkDaySessionController, ProductionController,
     * PayrollCalculationService::applyWorkSessionAdjustments) para que ambas modalidades compartan
     * el mismo mecanismo de fichaje sin duplicar la lista de modos en cada archivo.
     */
    public function usesWorkDaySessions(): bool
    {
        return $this->isPayrollFixedDaily() || $this->isPayrollHourlyLegal();
    }

    public function getFullNameAttribute(): string
    {
        return trim(($this->first_name ?? '').' '.($this->last_name ?? ''));
    }

    public function getInitialsAttribute(): string
    {
        $f = mb_substr($this->first_name ?? '', 0, 1);
        $l = mb_substr($this->last_name ?? '', 0, 1);

        return mb_strtoupper($f.$l) ?: 'E';
    }

    public function hasSystemAccess(): bool
    {
        return ! is_null($this->user_id) && optional($this->user)->is_active === true;
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }

    public function scopeWithAccess(Builder $query): Builder
    {
        return $query->whereNotNull('user_id');
    }
}
