<?php

namespace App\Support;

/**
 * Catalogo de avisos por correo que cada persona puede activar o desactivar.
 *
 * Un solo sitio define las claves, sus etiquetas y su valor por defecto. Que este
 * centralizado es lo que permite que la pantalla de perfil, el guardado y los tres
 * emisores hablen de lo mismo: con las claves escritas a mano en cada archivo, un cambio
 * de nombre dejaria la casilla marcada y el correo saliendo igual.
 *
 * El valor por defecto es `true` en los tres: son avisos de trabajo, no promociones, y
 * quien no los quiera los apaga. Una cuenta sin preferencias guardadas —todas las que ya
 * existian antes de esta pantalla— recibe por tanto lo mismo que antes.
 */
final class NotificationPreferences
{
    public const PAYROLL_CLOSED = 'payroll_closed';

    public const PENDING_APPROVALS = 'pending_approvals';

    public const WEEKLY_PRODUCTION_DIGEST = 'weekly_production_digest';

    /**
     * clave => [etiqueta, descripcion, por defecto]
     *
     * @return array<string, array{label: string, description: string, default: bool}>
     */
    public static function catalogue(): array
    {
        return [
            self::PAYROLL_CLOSED => [
                'label' => 'Cierre de nómina',
                'description' => 'Un correo cuando una nómina de tu empresa se marca como pagada.',
                'default' => true,
            ],
            self::PENDING_APPROVALS => [
                'label' => 'Solicitudes pendientes de aprobación',
                'description' => 'Cuando alguien radica un anticipo, un cambio de cuenta o una corrección que te toca revisar.',
                'default' => true,
            ],
            self::WEEKLY_PRODUCTION_DIGEST => [
                'label' => 'Resumen semanal de producción',
                'description' => 'Los lunes, lo producido por tu empresa la semana anterior.',
                'default' => true,
            ],
        ];
    }

    /**
     * @return list<string>
     */
    public static function keys(): array
    {
        return array_keys(self::catalogue());
    }

    /**
     * @return array<string, bool>
     */
    public static function defaults(): array
    {
        return array_map(fn (array $item) => $item['default'], self::catalogue());
    }

    /**
     * Normaliza lo que venga de la base o del formulario: solo claves conocidas, solo
     * booleanos, y las que falten con su valor por defecto.
     *
     * @param  array<string, mixed>|null  $stored
     * @return array<string, bool>
     */
    public static function normalize(?array $stored): array
    {
        $normalized = [];

        foreach (self::catalogue() as $key => $item) {
            $normalized[$key] = array_key_exists($key, $stored ?? [])
                ? filter_var($stored[$key], FILTER_VALIDATE_BOOLEAN)
                : $item['default'];
        }

        return $normalized;
    }
}
