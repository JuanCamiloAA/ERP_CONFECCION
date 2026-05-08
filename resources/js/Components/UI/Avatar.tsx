import { cn } from '@/lib/utils';

interface AvatarProps {
    src?: string | null;
    alt?: string;
    name?: string;
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
    className?: string;
}

const sizes = {
    xs: 'h-6 w-6 text-xs',
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-14 w-14 text-base',
    xl: 'h-20 w-20 text-xl',
};

function getInitials(name: string): string {
    const parts = name.trim().split(/\s+/);
    const first = parts[0]?.charAt(0) ?? '';
    const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : '';
    const result = (first + last).toUpperCase();
    return result || 'U';
}

function getColorFromName(name: string): string {
    const colors = [
        'bg-indigo-500',
        'bg-emerald-500',
        'bg-amber-500',
        'bg-rose-500',
        'bg-sky-500',
        'bg-violet-500',
        'bg-pink-500',
        'bg-teal-500',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
}

export function Avatar({ src, alt, name = 'Usuario', size = 'md', className }: AvatarProps) {
    const initials = getInitials(name);
    const bgColor = getColorFromName(name);

    if (src) {
        return (
            <img
                src={src}
                alt={alt ?? name}
                className={cn('rounded-full object-cover ring-2 ring-white dark:ring-slate-800', sizes[size], className)}
            />
        );
    }

    return (
        <div
            className={cn(
                'flex items-center justify-center rounded-full font-semibold text-white ring-2 ring-white dark:ring-slate-800',
                bgColor,
                sizes[size],
                className,
            )}
            aria-label={name}
        >
            {initials}
        </div>
    );
}

export default Avatar;
