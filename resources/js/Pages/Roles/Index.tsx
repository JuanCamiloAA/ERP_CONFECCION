import { Head, Link, router } from '@inertiajs/react';
import { EyeIcon, LockClosedIcon, PencilSquareIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import { Badge } from '@/Components/UI/Badge';
import { Button } from '@/Components/UI/Button';
import { Can } from '@/Components/UI/Can';
import { ConfirmDialog } from '@/Components/UI/ConfirmDialog';
import { PageHeader } from '@/Components/UI/PageHeader';
import { Pagination } from '@/Components/UI/Pagination';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/Components/UI/Table';
import { RoleBadge } from '@/Components/Roles/RoleBadge';
import AppLayout from '@/Layouts/AppLayout';
import type { PaginatedResponse } from '@/types';

interface Role {
    id: number;
    name: string;
    display_name: string;
    description: string | null;
    color: string;
    is_system: boolean;
    company_id: number | null;
    users_count: number;
}

interface Props {
    roles: PaginatedResponse<Role>;
}

export default function RolesIndex({ roles }: Props) {
    const [confirmDelete, setConfirmDelete] = useState<Role | null>(null);

    return (
        <AppLayout title="Roles y Permisos">
            <Head title="Roles" />
            <div className="space-y-6">
                <PageHeader
                    title="Roles y Permisos"
                    description="Crea y configura los roles disponibles en tu empresa."
                    action={
                        <Can permission="roles.index.create">
                            <Link href={route('roles.create')}>
                                <Button icon={<PlusIcon className="h-4 w-4" />}>Nuevo rol</Button>
                            </Link>
                        </Can>
                    }
                />

                <Table>
                    <TableHead>
                        <TableRow>
                            <TableHeader>Rol</TableHeader>
                            <TableHeader>Descripcion</TableHeader>
                            <TableHeader align="center">Tipo</TableHeader>
                            <TableHeader align="center">Usuarios</TableHeader>
                            <TableHeader align="right">Acciones</TableHeader>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {roles.data.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="py-10 text-center text-sm text-slate-500">
                                    No hay roles en esta empresa.
                                </TableCell>
                            </TableRow>
                        ) : (
                            roles.data.map((role) => (
                            <TableRow key={role.id}>
                                <TableCell>
                                    <RoleBadge role={role} />
                                    <p className="mt-1 text-xs text-slate-500">{role.name}</p>
                                </TableCell>
                                <TableCell>{role.description ?? '-'}</TableCell>
                                <TableCell align="center">
                                    {role.is_system ? (
                                        <Badge variant="warning"><LockClosedIcon className="mr-1 h-3 w-3" /> Sistema</Badge>
                                    ) : (
                                        <Badge variant="primary">Personalizado</Badge>
                                    )}
                                </TableCell>
                                <TableCell align="center">{role.users_count}</TableCell>
                                <TableCell align="right">
                                    <div className="flex justify-end gap-1">
                                        <Link href={route('roles.show', role.id)}>
                                            <Button variant="ghost" size="sm" icon={<EyeIcon className="h-4 w-4" />} />
                                        </Link>
                                        {!role.is_system && (
                                            <>
                                                <Can permission="roles.index.edit">
                                                    <Link href={route('roles.edit', role.id)}>
                                                        <Button variant="ghost" size="sm" icon={<PencilSquareIcon className="h-4 w-4" />} />
                                                    </Link>
                                                </Can>
                                                <Can permission="roles.index.delete">
                                                    <Button variant="ghost" size="sm" icon={<TrashIcon className="h-4 w-4 text-rose-500" />} onClick={() => setConfirmDelete(role)} />
                                                </Can>
                                            </>
                                        )}
                                    </div>
                                </TableCell>
                            </TableRow>
                            )))}
                    </TableBody>
                </Table>

                <Pagination links={roles.links} from={roles.from} to={roles.to} total={roles.total} />
            </div>

            <ConfirmDialog
                open={!!confirmDelete}
                onClose={() => setConfirmDelete(null)}
                onConfirm={() => {
                    if (!confirmDelete) return;
                    router.delete(route('roles.destroy', confirmDelete.id), { onFinish: () => setConfirmDelete(null) });
                }}
                title="Eliminar rol"
                message={`Eliminar el rol "${confirmDelete?.display_name}"?`}
            />
        </AppLayout>
    );
}
