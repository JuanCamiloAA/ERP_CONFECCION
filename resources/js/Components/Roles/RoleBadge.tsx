import { cn } from '@/lib/utils';

interface RoleBadgeProps {
    role: { name: string; display_name: string; color?: string | null } | null;
    className?: string;
}

/**
 * Etiqueta del rol con su color.
 *
 * Toma la forma de `emp-pill` —borde y texto del color, sin relleno saturado— porque un
 * fondo fuerte compite con las pastillas de estado que van al lado en la misma fila. El
 * color del rol es la única excepción a la regla de usar solo variables `--emp-*`: lo elige
 * quien crea el rol y es su seña de identidad.
 */
export function RoleBadge({ role, className }: RoleBadgeProps) {
    if (! role) {
        return (
            <span className={cn('emp-pill', className)} style={{ color: 'var(--emp-subtle)' }}>
                Sin rol
            </span>
        );
    }

    const color = role.color ?? '#6366f1';

    return (
        <span className={cn('emp-pill', className)} style={{ borderColor: color, color }}>
            <span
                aria-hidden="true"
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: color }}
            />
            {role.display_name}
        </span>
    );
}

export default RoleBadge;
