import {
    Buildings,
    Calculator,
    ChartLineUp,
    CheckCircle,
    ClipboardText,
    Clock,
    CurrencyCircleDollar,
    DeviceMobile,
    LockKey,
    MagnifyingGlass,
    Needle,
    Package,
    Receipt,
    Scissors,
    SealCheck,
    ShieldCheck,
    SquaresFour,
    UserGear,
    UsersThree,
    WifiHigh,
    type Icon,
} from '@phosphor-icons/react';
import type { ReactNode } from 'react';

/**
 * Traduce el nombre guardado en el contenido ("ph-scissors") al componente Phosphor.
 * Debe mantenerse alineada con la lista blanca de App\Support\LandingIcons, que es la que
 * valida el editor: si aqui falta un nombre permitido, el bloque se dibuja sin icono.
 */
const ICONS: Record<string, Icon> = {
    'ph-scissors': Scissors,
    'ph-device-mobile': DeviceMobile,
    'ph-seal-check': SealCheck,
    'ph-receipt': Receipt,
    'ph-buildings': Buildings,
    'ph-lock-key': LockKey,
    'ph-user-gear': UserGear,
    'ph-currency-circle-dollar': CurrencyCircleDollar,
    'ph-clipboard-text': ClipboardText,
    'ph-shield-check': ShieldCheck,
    'ph-calculator': Calculator,
    'ph-magnifying-glass': MagnifyingGlass,
    'ph-squares-four': SquaresFour,
    'ph-wifi-high': WifiHigh,
    'ph-needle': Needle,
    'ph-users-three': UsersThree,
    'ph-chart-line-up': ChartLineUp,
    'ph-package': Package,
    'ph-clock': Clock,
    'ph-check-circle': CheckCircle,
};

export function phosphorIcon(name: string | null | undefined, size = 18): ReactNode {
    if (!name) return null;
    const Cmp = ICONS[name];

    return Cmp ? <Cmp size={size} weight="regular" /> : null;
}

export const ALLOWED_ICON_NAMES = Object.keys(ICONS);
