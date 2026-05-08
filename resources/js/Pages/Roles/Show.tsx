import { Head, Link } from '@inertiajs/react';
import { ArrowLeftIcon, LockClosedIcon, PencilSquareIcon } from '@heroicons/react/24/outline';
import { Badge } from '@/Components/UI/Badge';
import { Button } from '@/Components/UI/Button';
import { Can } from '@/Components/UI/Can';
import { Card, CardHeader } from '@/Components/UI/Card';
import { PageHeader } from '@/Components/UI/PageHeader';
import { PermissionMatrix } from '@/Components/Permissions/PermissionMatrix';
import { RoleBadge } from '@/Components/Roles/RoleBadge';
import AppLayout from '@/Layouts/AppLayout';
import type { PermissionMatrix as MatrixType } from '@/types';

interface RoleData {
    id: number;
    name: string;
    display_name: string;
    description: string | null;
    color: string;
    is_system: boolean;
    permissions: string[];
}

interface Props {
    role: RoleData;
    matrix: MatrixType;
    systemRoleNotice?: string;
}

export default function RoleShow({ role, matrix, systemRoleNotice }: Props) {
    return (
        <AppLayout title={role.display_name}>
            <Head title={role.display_name} />
            <div className="space-y-6">
                <PageHeader
                    title={role.display_name}
                    description={role.description ?? 'Detalle del rol'}
                    breadcrumbs={[{ label: 'Roles', href: route('roles.index') }, { label: role.display_name }]}
                    action={
                        <div className="flex gap-2">
                            <Link href={route('roles.index')}>
                                <Button variant="ghost" icon={<ArrowLeftIcon className="h-4 w-4" />}>Volver</Button>
                            </Link>
                            {!role.is_system && (
                                <Can permission="roles.index.edit">
                                    <Link href={route('roles.edit', role.id)}>
                                        <Button icon={<PencilSquareIcon className="h-4 w-4" />}>Editar rol</Button>
                                    </Link>
                                </Can>
                            )}
                        </div>
                    }
                />

                {systemRoleNotice && (
                    <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-700/50 dark:bg-amber-900/20 dark:text-amber-300">
                        <LockClosedIcon className="mt-0.5 h-5 w-5 shrink-0" />
                        <p>{systemRoleNotice}</p>
                    </div>
                )}

                <Card>
                    <CardHeader title="Datos generales" />
                    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <div>
                            <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Rol</p>
                            <div className="mt-1"><RoleBadge role={role} /></div>
                        </div>
                        <div>
                            <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Identificador</p>
                            <p className="mt-1 font-mono text-sm text-slate-700 dark:text-slate-300">{role.name}</p>
                        </div>
                        <div>
                            <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Tipo</p>
                            <div className="mt-1">
                                {role.is_system ? <Badge variant="warning">Sistema</Badge> : <Badge variant="primary">Personalizado</Badge>}
                            </div>
                        </div>
                        <div>
                            <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Permisos asignados</p>
                            <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">{role.permissions.length}</p>
                        </div>
                    </div>
                </Card>

                <PermissionMatrix matrix={matrix} value={role.permissions} onChange={() => {}} readonly />
            </div>
        </AppLayout>
    );
}
