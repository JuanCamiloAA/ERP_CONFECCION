<?php

namespace App\Services\Employee;

use App\Models\Employee;
use App\Models\EmployeeAuditLog;
use App\Models\User;
use Illuminate\Support\Facades\Auth;

/**
 * Unico punto por el que se escribe la bitacora del empleado.
 *
 * Que este centralizado importa por dos motivos: el enmascarado de los datos sensibles
 * tiene que ser el mismo se registre desde donde se registre, y el nombre del autor se
 * congela aqui —si el usuario se borra manana, la linea sigue diciendo quien fue.
 *
 * La bitacora nunca hace fallar la operacion que la origina: se escribe despues del
 * cambio real y, si algo saliera mal al insertarla, es preferible perder la linea a
 * dejar el cambio a medias. Por eso el llamador no espera valor de retorno.
 */
class EmployeeAuditLogger
{
    /**
     * Campos que jamas se guardan en claro. La cuenta y la clave conservan los cuatro
     * ultimos digitos porque sin eso la bitacora no distingue un cambio de otro.
     *
     * @var list<string>
     */
    public const MASKED_FIELDS = [
        'bank_account_number',
        'bank_key',
        'password',
    ];

    /**
     * Etiquetas legibles de los campos; la bitacora se lee, no se descifra.
     *
     * @var array<string, string>
     */
    public const FIELD_LABELS = [
        'first_name' => 'Nombre',
        'last_name' => 'Apellido',
        'document_type' => 'Tipo de documento',
        'document_number' => 'Documento',
        'hire_date' => 'Fecha de ingreso',
        'photo' => 'Foto',
        'phone' => 'Teléfono',
        'email' => 'Correo',
        'address' => 'Dirección',
        'emergency_contact_name' => 'Contacto de emergencia',
        'emergency_contact_phone' => 'Teléfono de emergencia',
        'payroll_mode' => 'Modalidad de pago',
        'base_salary' => 'Salario base',
        'daily_salary' => 'Salario diario',
        'minutes_per_full_workday' => 'Minutos de jornada completa',
        'ordinary_hours_per_day' => 'Jornada ordinaria diaria',
        'is_exempt_from_overtime' => 'Exento de horas extra',
        'scheduled_work_days' => 'Días hábiles esperados',
        'bank_id' => 'Banco',
        'bank_account_type' => 'Tipo de cuenta',
        'bank_account_number' => 'Cuenta bancaria',
        'bank_key' => 'Llave bancaria',
        'notes' => 'Notas',
        'is_active' => 'Estado',
        'lifecycle_status' => 'Ciclo de vida',
        'termination_date' => 'Fecha de retiro',
        'termination_reason' => 'Motivo de retiro',
        'role' => 'Rol',
        'password' => 'Contraseña',
        'access' => 'Acceso al sistema',
        'advance' => 'Anticipo',
    ];

    public function log(
        Employee $employee,
        string $event,
        ?string $field = null,
        mixed $oldValue = null,
        mixed $newValue = null,
        ?User $actor = null,
    ): void {
        $actor = $actor ?? Auth::user();

        EmployeeAuditLog::query()->create([
            'company_id' => $employee->company_id,
            'employee_id' => $employee->id,
            'actor_id' => $actor?->id,
            'actor_name' => $actor?->full_name ?: ($actor?->email ?? 'Sistema'),
            'event' => $event,
            'field' => $field,
            'old_value' => $this->present($field, $oldValue),
            'new_value' => $this->present($field, $newValue),
        ]);
    }

    /**
     * Registra una linea por cada campo que realmente cambio.
     *
     * Compara en texto a proposito: `base_salary` llega como `decimal:2` («1200000.00»)
     * y del formulario como «1200000», y una comparacion laxa marcaria cambios que no
     * existen —la bitacora se llenaria de ruido en cada guardado.
     *
     * @param  array<string, mixed>  $before
     * @param  array<string, mixed>  $after
     */
    public function logChanges(Employee $employee, array $before, array $after, string $event, ?User $actor = null): void
    {
        foreach ($after as $field => $newValue) {
            $oldValue = $before[$field] ?? null;

            if ($this->normalize($oldValue) === $this->normalize($newValue)) {
                continue;
            }

            $this->log($employee, $event, $field, $oldValue, $newValue, $actor);
        }
    }

    /** Etiqueta legible del campo, o el nombre crudo si no esta en el diccionario. */
    public static function labelFor(?string $field): ?string
    {
        if ($field === null) {
            return null;
        }

        return self::FIELD_LABELS[$field] ?? $field;
    }

    /** Valor listo para guardar: enmascarado si el campo es sensible, texto si no. */
    protected function present(?string $field, mixed $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        // De una contrasena no se conserva ni la longitud: la linea dice que se cambio.
        if ($field === 'password') {
            return '••••••••';
        }

        $text = $this->normalize($value);

        if ($field !== null && in_array($field, self::MASKED_FIELDS, true)) {
            return $this->mask($text);
        }

        return mb_substr($text, 0, 500);
    }

    /**
     * `•••• 4821`. Una contrasena no deja ni eso: se registra que se cambio, nunca
     * ninguna parte de ella.
     */
    protected function mask(string $value): string
    {
        if (mb_strlen($value) <= 4) {
            return str_repeat('•', max(mb_strlen($value), 4));
        }

        return '•••• '.mb_substr($value, -4);
    }

    /** Todo a texto comparable: booleanos, arreglos y decimales incluidos. */
    protected function normalize(mixed $value): string
    {
        if ($value === null) {
            return '';
        }

        if (is_bool($value)) {
            return $value ? '1' : '0';
        }

        if (is_array($value)) {
            return implode(', ', array_map(fn ($item) => (string) $item, $value));
        }

        if (is_numeric($value)) {
            // «1200000.00» y «1200000» son el mismo salario.
            return rtrim(rtrim(number_format((float) $value, 2, '.', ''), '0'), '.');
        }

        if ($value instanceof \DateTimeInterface) {
            return $value->format('Y-m-d');
        }

        return trim((string) $value);
    }
}
