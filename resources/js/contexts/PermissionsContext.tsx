import { usePage } from '@inertiajs/react';
import { createContext, ReactNode, useContext, useMemo } from 'react';
import type { AuthUser } from '@/types';

interface PermissionsContextValue {
    user: AuthUser | null;
    permissions: string[];
    accessiblePages: string[];
    can: (permission: string | string[]) => boolean;
    canAny: (permissions: string[]) => boolean;
    canAll: (permissions: string[]) => boolean;
    hasRole: (roleName: string | string[]) => boolean;
    isSuperAdmin: boolean;
    isAdmin: boolean;
    isEmployee: boolean;
}

const PermissionsContext = createContext<PermissionsContextValue | null>(null);

export function PermissionsProvider({ children }: { children: ReactNode }) {
    const page = usePage();
    const props = page.props as unknown as App.PageProps;
    const user = props.auth?.user ?? null;

    const value = useMemo<PermissionsContextValue>(() => {
        const permissions = user?.permissions ?? [];
        const accessiblePages = user?.accessible_pages ?? [];
        const isSuperAdmin = user?.is_super_admin ?? false;

        const can = (permission: string | string[]): boolean => {
            if (!user) return false;
            if (isSuperAdmin) return true;
            if (Array.isArray(permission)) {
                return permission.some((p) => permissions.includes(p));
            }
            return permissions.includes(permission);
        };

        const canAny = (perms: string[]): boolean => {
            if (!user) return false;
            if (isSuperAdmin) return true;
            return perms.some((p) => permissions.includes(p));
        };

        const canAll = (perms: string[]): boolean => {
            if (!user) return false;
            if (isSuperAdmin) return true;
            return perms.every((p) => permissions.includes(p));
        };

        const hasRole = (roleName: string | string[]): boolean => {
            if (!user?.role) return false;
            if (Array.isArray(roleName)) {
                return roleName.includes(user.role.name);
            }
            return user.role.name === roleName;
        };

        return {
            user,
            permissions,
            accessiblePages,
            can,
            canAny,
            canAll,
            hasRole,
            isSuperAdmin,
            isAdmin: user?.is_admin ?? false,
            isEmployee: user?.is_employee ?? false,
        };
    }, [user]);

    return <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>;
}

export function usePermissions(): PermissionsContextValue {
    const ctx = useContext(PermissionsContext);
    if (!ctx) {
        return {
            user: null,
            permissions: [],
            accessiblePages: [],
            can: () => false,
            canAny: () => false,
            canAll: () => false,
            hasRole: () => false,
            isSuperAdmin: false,
            isAdmin: false,
            isEmployee: false,
        };
    }
    return ctx;
}
