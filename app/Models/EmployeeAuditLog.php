<?php

namespace App\Models;

use App\Models\Scopes\CompanyScope;
use Illuminate\Database\Eloquent\Attributes\ScopedBy;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Un hecho de la bitacora del empleado. Solo se inserta: nada en la aplicacion lo edita
 * ni lo borra, porque una bitacora que se puede corregir no prueba nada.
 */
#[ScopedBy([CompanyScope::class])]
class EmployeeAuditLog extends Model
{
    public const EVENT_SECTION_UPDATED = 'section_updated';

    public const EVENT_ACCESS_CREATED = 'access_created';

    public const EVENT_ACCESS_TOGGLED = 'access_toggled';

    public const EVENT_PASSWORD_RESET = 'password_reset';

    public const EVENT_ROLE_CHANGED = 'role_changed';

    public const EVENT_REQUEST_CREATED = 'request_created';

    public const EVENT_REQUEST_APPROVED = 'request_approved';

    public const EVENT_REQUEST_REJECTED = 'request_rejected';

    public const EVENT_LIFECYCLE_CHANGED = 'lifecycle_changed';

    protected $fillable = [
        'company_id',
        'employee_id',
        'actor_id',
        'actor_name',
        'event',
        'field',
        'old_value',
        'new_value',
    ];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_id');
    }
}
