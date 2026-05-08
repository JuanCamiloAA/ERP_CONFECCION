import { Head, Link, router } from '@inertiajs/react';
import { BuildingOffice2Icon, PencilSquareIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
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
import AppLayout from '@/Layouts/AppLayout';
import type { PaginatedResponse } from '@/types';

interface CompanyRow {
    id: number;
    name: string;
    nit: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
    logo: string | null;
    is_active: boolean;
    employees_count: number;
    users_count: number;
}

interface Props {
    companies: PaginatedResponse<CompanyRow>;
    filters: { search: string };
}

export default function CompaniesIndex({ companies, filters }: Props) {
    const [search, setSearch] = useState(filters.search ?? '');
    const [confirmDelete, setConfirmDelete] = useState<CompanyRow | null>(null);

    const updateFilters = (value: string) => {
        const params: Record<string, string> = {};
        if (value) params.search = value;
        router.get(route('companies.index'), params, { preserveState: true, preserveScroll: true, replace: true });
    };

    const handleDelete = () => {
        if (!confirmDelete) return;
        router.delete(route('companies.destroy', confirmDelete.id), {
            onFinish: () => setConfirmDelete(null),
        });
    };

    return (
        <AppLayout title="Empresas">
            <Head title="Empresas" />
            <div className="space-y-6">
                <PageHeader
                    title="Empresas"
                    description="Gestiona las empresas del sistema (solo super administradores)."
                    action={
                        <Can permission="companies.index.create">
                            <Link href={route('companies.create')}>
                                <Button icon={<PlusIcon className="h-4 w-4" />}>Nueva empresa</Button>
                            </Link>
                        </Can>
                    }
                />

                <SearchInput
                    value={search}
                    onChange={(v) => {
                        setSearch(v);
                        updateFilters(v);
                    }}
                    placeholder="Buscar por nombre o NIT..."
                    className="sm:max-w-md"
                />

                <Table>
                    <TableHead>
                        <TableRow>
                            <TableHeader>Empresa</TableHeader>
                            <TableHeader>NIT</TableHeader>
                            <TableHeader>Contacto</TableHeader>
                            <TableHeader align="center">Empleados</TableHeader>
                            <TableHeader align="center">Usuarios</TableHeader>
                            <TableHeader align="center">Estado</TableHeader>
                            <TableHeader align="right">Acciones</TableHeader>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {companies.data.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
                                    No se encontraron empresas.
                                </td>
                            </tr>
                        ) : (
                            companies.data.map((company) => (
                                <TableRow key={company.id}>
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            {company.logo ? (
                                                <Avatar src={`/storage/${company.logo}`} name={company.name} size="sm" />
                                            ) : (
                                                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400">
                                                    <BuildingOffice2Icon className="h-5 w-5" />
                                                </div>
                                            )}
                                            <div>
                                                <p className="font-medium text-slate-900 dark:text-slate-100">{company.name}</p>
                                                {company.address && <p className="text-xs text-slate-500">{company.address}</p>}
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>{company.nit ?? '-'}</TableCell>
                                    <TableCell>
                                        <div className="text-xs text-slate-500">
                                            {company.email && <p>{company.email}</p>}
                                            {company.phone && <p>{company.phone}</p>}
                                            {!company.email && !company.phone && '-'}
                                        </div>
                                    </TableCell>
                                    <TableCell align="center">{company.employees_count}</TableCell>
                                    <TableCell align="center">{company.users_count}</TableCell>
                                    <TableCell align="center">
                                        <Badge variant={company.is_active ? 'success' : 'danger'}>
                                            {company.is_active ? 'Activa' : 'Inactiva'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell align="right">
                                        <div className="flex justify-end gap-1">
                                            <Can permission="companies.index.edit">
                                                <Link href={route('companies.edit', company.id)}>
                                                    <Button variant="ghost" size="sm" icon={<PencilSquareIcon className="h-4 w-4" />} />
                                                </Link>
                                            </Can>
                                            <Can permission="companies.index.delete">
                                                <Button variant="ghost" size="sm" icon={<TrashIcon className="h-4 w-4 text-rose-500" />} onClick={() => setConfirmDelete(company)} />
                                            </Can>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>

                <Pagination links={companies.links} from={companies.from} to={companies.to} total={companies.total} />
            </div>

            <ConfirmDialog
                open={!!confirmDelete}
                onClose={() => setConfirmDelete(null)}
                onConfirm={handleDelete}
                title="Desactivar empresa"
                message={`Seguro que deseas desactivar "${confirmDelete?.name}"? Sus empleados y usuarios dejaran de tener acceso.`}
                confirmText="Desactivar"
                variant="danger"
            />
        </AppLayout>
    );
}
