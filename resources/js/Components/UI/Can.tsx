import { ReactNode } from 'react';
import { usePermissions } from '@/contexts/PermissionsContext';

interface CanProps {
    permission?: string | string[];
    role?: string | string[];
    any?: string[];
    all?: string[];
    fallback?: ReactNode;
    children: ReactNode;
}

export function Can({ permission, role, any, all, fallback = null, children }: CanProps) {
    const perms = usePermissions();

    let allowed = true;

    if (permission) {
        allowed = allowed && perms.can(permission);
    }
    if (role) {
        allowed = allowed && perms.hasRole(role);
    }
    if (any && any.length > 0) {
        allowed = allowed && perms.canAny(any);
    }
    if (all && all.length > 0) {
        allowed = allowed && perms.canAll(all);
    }

    return <>{allowed ? children : fallback}</>;
}

export default Can;
