import { Head, Link, router } from '@inertiajs/react';
import { PencilSquareIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import { Avatar } from '@/Components/UI/Avatar';
import { Badge } from '@/Components/UI/Badge';
import { Button } from '@/Components/UI/Button';
import { Can } from '@/Components/UI/Can';
import { ConfirmDialog } from '@/Components/UI/ConfirmDialog';
import { PageHeader } from '@/Components/UI/PageHeader';
import { Pagination } from '@/Components/UI/Pagination';
import { SearchInput } from '@/Components/UI/SearchInput';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/Components/UI/Table';
import { RoleBadge } from '@/Components/Roles/RoleBadge';
import AppLayout from '@/Layouts/AppLayout';
import { formatRelativeDate } from '@/lib/utils';
import type { PaginatedResponse } from '@/types';

interface UserRow {
    id: number;
    name: string;
    last_name: string | null;
    full_name: string;
    email: string;
    phone: string | null;
    avatar: string | null;
    is_active: boolean;
    last_login_at: string | null;
    company: { id: number; name: string } | null;
    roles: { id: number; name: string; display_name: string; color: string }[];
}

interface Props {
    users: PaginatedResponse<UserRow>;
    filters: { search: string; status: string };
}

export default function UsersIndex({ users, filters }: Props) {
    const [search, setSearch] = useState(filters.search ?? '');
    const [status, setStatus] = useState(filters.status ?? 'all');
    const [confirmDelete, setConfirmDelete] = useState<UserRow | null>(null);

    const updateFilters = (next: { search?: string; status?: string }) => {
        const params: Record<string, string> = {};
        const newSearch = next.search ?? search;
        const newStatus = next.status ?? status;
        if (newSearch) params.search = newSearch;
        if (newStatus !== 'all') params.status = newStatus;

        router.get(route('users.index'), params, { preserveState: true, preserveScroll: true, replace: true });
    };

    const handleDelete = () => {
        if (!confirmDelete) return;
        router.delete(route('users.destroy', confirmDelete.id), {
            onFinish: () => setConfirmDelete(null),
        });
    };

    return (
        <AppLayout title="Usuarios">
            <Head title="Usuarios" />
            <div className="space-y-6">
                <PageHeader
                    title="Usuarios"
                    description="Administra las cuentas de acceso al sistema."
                    action={
                        <Can permission="users.index.create">
                            <Link href={route('users.create')}>
                                <Button icon={<PlusIcon className="h-4 w-4" />}>Nuevo usuario</Button>
                            </Link>
                        </Can>
                    }
                />

                <div className="flex flex-col gap-3 sm:flex-row">
                    <SearchInput
                        value={search}
                        onChange={(v) => {
                            setSearch(v);
                            updateFilters({ search: v });
                        }}
                        placeholder="Buscar por nombre o correo..."
                        className="sm:max-w-md"
                    />
                    <select
                        value={status}
                        onChange={(e) => {
                            setStatus(e.target.value);
                            updateFilters({ status: e.target.value });
                        }}
                        className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    >
                        <option value="all">Todos</option>
                        <option value="active">Activos</option>
                        <option value="inactive">Inactivos</option>
                    </select>
                </div>

                <Table>
                    <TableHead>
                        <TableRow>
                            <TableHeader>Usuario</TableHeader>
                            <TableHeader>Rol</TableHeader>
                            <TableHeader>Empresa</TableHeader>
                            <TableHeader>Ultimo acceso</TableHeader>
                            <TableHeader align="center">Estado</TableHeader>
                            <TableHeader align="right">Acciones</TableHeader>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {users.data.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
                                    No se encontraron usuarios.
                                </td>
                            </tr>
                        ) : (
                            users.data.map((user) => (
                                <TableRow key={user.id}>
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <Avatar src={user.avatar} name={user.full_name} size="sm" />
                                            <div>
                                                <p className="font-medium text-slate-900 dark:text-slate-100">{user.full_name}</p>
                                                <p className="text-xs text-slate-500 dark:text-slate-400">{user.email}</p>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {user.roles.length > 0 ? <RoleBadge role={user.roles[0]} /> : <span className="text-slate-400">Sin rol</span>}
                                    </TableCell>
                                    <TableCell>{user.company?.name ?? '-'}</TableCell>
                                    <TableCell>
                                        <span className="text-sm text-slate-500 dark:text-slate-400">{formatRelativeDate(user.last_login_at)}</span>
                                    </TableCell>
                                    <TableCell align="center">
                                        <Badge variant={user.is_active ? 'success' : 'danger'}>
                                            {user.is_active ? 'Activo' : 'Inactivo'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell align="right">
                                        <div className="flex justify-end gap-1">
                                            <Can permission="users.index.edit">
                                                <Link href={route('users.edit', user.id)}>
                                                    <Button variant="ghost" size="sm" icon={<PencilSquareIcon className="h-4 w-4" />} />
                                                </Link>
                                            </Can>
                                            <Can permission="users.index.delete">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    icon={<TrashIcon className="h-4 w-4 text-rose-500" />}
                                                    onClick={() => setConfirmDelete(user)}
                                                />
                                            </Can>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>

                <Pagination links={users.links} from={users.from} to={users.to} total={users.total} />
            </div>

            <ConfirmDialog
                open={!!confirmDelete}
                onClose={() => setConfirmDelete(null)}
                onConfirm={handleDelete}
                title="Eliminar usuario"
                message={`Eliminar a "${confirmDelete?.full_name}"? Esta accion no se puede deshacer.`}
                confirmText="Eliminar"
                variant="danger"
            />
        </AppLayout>
    );
}
