import { Head, Link } from '@inertiajs/react';
import { ArrowLeftIcon, EnvelopeIcon, PencilSquareIcon, PhoneIcon } from '@heroicons/react/24/outline';
import { Avatar } from '@/Components/UI/Avatar';
import { Badge } from '@/Components/UI/Badge';
import { Button } from '@/Components/UI/Button';
import { Can } from '@/Components/UI/Can';
import { Card, CardHeader } from '@/Components/UI/Card';
import { PageHeader } from '@/Components/UI/PageHeader';
import { RoleBadge } from '@/Components/Roles/RoleBadge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/Components/UI/Table';
import AppLayout from '@/Layouts/AppLayout';
import { formatDateTime } from '@/lib/utils';

interface AccessLog {
    id: number;
    action: string;
    description: string | null;
    ip_address: string | null;
    user_agent: string | null;
    created_at: string;
}

interface UserData {
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
    roles: {
        id: number;
        name: string;
        display_name: string;
        color: string;
        permissions: { id: number; name: string }[];
    }[];
}

interface Props {
    user: UserData;
    accessLogs: AccessLog[];
}

export default function UserShow({ user, accessLogs }: Props) {
    const role = user.roles[0];
    const permissions = role?.permissions ?? [];

    return (
        <AppLayout title={user.full_name}>
            <Head title={user.full_name} />
            <div className="space-y-6">
                <PageHeader
                    title={user.full_name}
                    description={user.email}
                    breadcrumbs={[{ label: 'Usuarios', href: route('users.index') }, { label: user.full_name }]}
                    action={
                        <div className="flex gap-2">
                            <Link href={route('users.index')}>
                                <Button variant="ghost" icon={<ArrowLeftIcon className="h-4 w-4" />}>Volver</Button>
                            </Link>
                            <Can permission="users.index.edit">
                                <Link href={route('users.edit', user.id)}>
                                    <Button icon={<PencilSquareIcon className="h-4 w-4" />}>Editar</Button>
                                </Link>
                            </Can>
                        </div>
                    }
                />

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                    <Card className="lg:col-span-1">
                        <div className="flex flex-col items-center text-center">
                            <Avatar src={user.avatar} name={user.full_name} size="xl" />
                            <h3 className="mt-3 text-lg font-semibold text-slate-900 dark:text-slate-100">{user.full_name}</h3>
                            {role && <div className="mt-1"><RoleBadge role={role} /></div>}
                            <Badge variant={user.is_active ? 'success' : 'danger'} className="mt-2">
                                {user.is_active ? 'Activo' : 'Inactivo'}
                            </Badge>

                            <div className="mt-4 w-full space-y-2 text-left text-sm">
                                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                                    <EnvelopeIcon className="h-4 w-4" />
                                    <span>{user.email}</span>
                                </div>
                                {user.phone && (
                                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                                        <PhoneIcon className="h-4 w-4" />
                                        <span>{user.phone}</span>
                                    </div>
                                )}
                                {user.company && (
                                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                                        <span className="text-xs uppercase tracking-wide text-slate-400">Empresa:</span>
                                        <span>{user.company.name}</span>
                                    </div>
                                )}
                                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                                    <span className="text-xs uppercase tracking-wide text-slate-400">Ultimo acceso:</span>
                                    <span>{user.last_login_at ? formatDateTime(user.last_login_at) : 'Sin registros'}</span>
                                </div>
                            </div>
                        </div>
                    </Card>

                    <Card className="lg:col-span-2">
                        <CardHeader title={`Permisos (${permissions.length})`} description="Permisos heredados del rol asignado." />
                        <div className="mt-4 max-h-96 overflow-y-auto">
                            {permissions.length === 0 ? (
                                <p className="text-sm text-slate-500">Este usuario no tiene permisos asignados.</p>
                            ) : (
                                <div className="flex flex-wrap gap-2">
                                    {permissions.map((p) => (
                                        <span key={p.id} className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300">
                                            {p.name}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    </Card>
                </div>

                <Card>
                    <CardHeader title="Ultimos accesos" description="Registro de las acciones recientes del usuario." />
                    <div className="mt-4">
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableHeader>Accion</TableHeader>
                                    <TableHeader>Descripcion</TableHeader>
                                    <TableHeader>IP</TableHeader>
                                    <TableHeader>Fecha</TableHeader>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {accessLogs.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                                            Sin accesos registrados.
                                        </td>
                                    </tr>
                                ) : (
                                    accessLogs.map((log) => (
                                        <TableRow key={log.id}>
                                            <TableCell><Badge variant="primary" size="sm">{log.action}</Badge></TableCell>
                                            <TableCell>{log.description ?? '-'}</TableCell>
                                            <TableCell>{log.ip_address ?? '-'}</TableCell>
                                            <TableCell>{formatDateTime(log.created_at)}</TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </Card>
            </div>
        </AppLayout>
    );
}
