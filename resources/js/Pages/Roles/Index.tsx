import { Head, Link, router } from '@inertiajs/react';
import { CaretLeft, CaretRight, MagnifyingGlass, Plus } from '@phosphor-icons/react';
import { useMemo, useState } from 'react';
import { RoleCard, type RoleRow } from '@/Components/Roles/RoleCard';
import { Can } from '@/Components/UI/Can';
import { ConfirmDialog } from '@/Components/UI/ConfirmDialog';
import { RoleTable } from '@/Components/Roles/RoleTable';
import { cardsViewClass, tableViewClass } from '@/Components/UI/ListViewSwitch';
import { ViewToggle } from '@/Components/UI/ViewToggle';
import { useViewMode } from '@/hooks/useViewMode';
import AppLayout from '@/Layouts/AppLayout';
import { formatNumber } from '@/lib/utils';
import type { PaginatedResponse } from '@/types';
import '../../../css/module-ui.css';

interface Metrics {
    roles_total: number;
    system_total: number;
    users_total: number;
    users_with_role: number;
    users_with_overrides: number;
    roles_without_users: number;
    roles_without_users_name: string | null;
}

interface Props {
    roles: PaginatedResponse<RoleRow>;
    metrics: Metrics;
}

type Scope = 'all' | 'system' | 'custom';

const SCOPES: { value: Scope; label: string }[] = [
    { value: 'all', label: 'Todos' },
    { value: 'system', label: 'Sistema' },
    { value: 'custom', label: 'Propios' },
];

/** Etiqueta de pagina de Laravel, sin entidades ni las palabras de navegacion. */
function pageLabel(label: string): string {
    return label
        .replace('&laquo;', '')
        .replace('&raquo;', '')
        .replace('Previous', '')
        .replace('Next', '')
        .replace('Anterior', '')
        .replace('Siguiente', '')
        .trim();
}

export default function RolesIndex({ roles, metrics }: Props) {
    const [view, setView] = useViewMode('roles');

    const [confirmDelete, setConfirmDelete] = useState<RoleRow | null>(null);
    const [term, setTerm] = useState('');
    const [scope, setScope] = useState<Scope>('all');

    const rows = roles.data;

    /**
     * El filtro es en cliente: los roles de una empresa son pocos y caben en una página, así
     * que ir al servidor por cada letra solo añadiría espera.
     */
    const visible = useMemo(() => {
        const needle = term.trim().toLowerCase();

        return rows.filter((role) => {
            if (scope === 'system' && ! role.is_system) return false;
            if (scope === 'custom' && role.is_system) return false;
            if (needle === '') return true;

            return `${role.display_name} ${role.name} ${role.description ?? ''}`.toLowerCase().includes(needle);
        });
    }, [rows, term, scope]);

    const metricCards = [
        {
            label: 'Roles',
            value: formatNumber(metrics.roles_total),
            meta: `${formatNumber(metrics.system_total)} de sistema`,
            accent: false,
        },
        {
            label: 'Usuarios con rol',
            value: formatNumber(metrics.users_with_role),
            meta: `de ${formatNumber(metrics.users_total)} cuentas`,
            accent: false,
        },
        {
            label: 'Con excepciones',
            value: formatNumber(metrics.users_with_overrides),
            meta: 'no coinciden con su plantilla',
            accent: true,
        },
        {
            label: 'Sin usuarios',
            value: formatNumber(metrics.roles_without_users),
            meta: metrics.roles_without_users_name ?? 'roles que nadie usa',
            accent: false,
        },
    ];

    return (
        <AppLayout title="Roles y permisos">
            <Head title="Roles y permisos" />

            <div className="emp-form -m-4 min-h-screen px-4 pb-28 pt-5 sm:-m-6 sm:px-[34px] sm:pb-8 lg:-m-8 lg:pb-8">
                {/* -------------------------------------------------- cabecera */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                        <h1 className="text-[24px]" style={{ color: 'var(--emp-text)' }}>
                            Roles y permisos
                        </h1>
                        <p className="mt-1 max-w-[640px] text-[13px]" style={{ color: 'var(--emp-muted)' }}>
                            Cada rol es una plantilla de permisos. Editarla no cambia a nadie hasta que decides a quién
                            se le aplica.
                        </p>
                    </div>

                    <Can permission="roles.index.create">
                        <Link href={route('roles.create')} className="emp-btn emp-btn-primary max-sm:hidden">
                            <Plus size={14} />
                            Nuevo rol
                        </Link>
                    </Can>
                </div>

                {/* -------------------------------------------------- metricas */}
                <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                    {metricCards.map((card) => (
                        <div key={card.label} className="emp-card p-[15px]">
                            <p className="emp-kicker">{card.label}</p>
                            <p
                                className="mt-1 text-[26px] leading-none tabular-nums"
                                style={{ color: card.accent ? 'var(--emp-accent-on)' : 'var(--emp-text)' }}
                            >
                                {card.value}
                            </p>
                            <p className="mt-1 truncate text-[11.5px]" style={{ color: 'var(--emp-subtle)' }}>
                                {card.meta}
                            </p>
                        </div>
                    ))}
                </div>

                {/* --------------------------------------------------- filtros */}
                <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:items-center">
                    <div className="relative min-w-0 sm:max-w-[340px] sm:flex-1">
                        <MagnifyingGlass
                            size={15}
                            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2"
                            style={{ color: 'var(--emp-subtle)' }}
                        />
                        <input
                            value={term}
                            onChange={(e) => setTerm(e.target.value)}
                            placeholder="Buscar rol..."
                            aria-label="Buscar rol"
                            className="emp-field pl-8"
                        />
                    </div>

                    <div className="emp-seg sm:w-[260px]">
                        {SCOPES.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => setScope(option.value)}
                                className={`emp-seg-item ${scope === option.value ? 'emp-seg-on' : ''}`}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>

                    <span className="shrink-0 text-[12px] max-sm:hidden sm:ml-auto" style={{ color: 'var(--emp-subtle)' }}>
                        {formatNumber(visible.length)} {visible.length === 1 ? 'rol' : 'roles'} ·{' '}
                        {formatNumber(metrics.users_with_role)} usuarios asignados
                    </span>

                    <ViewToggle variant="emp" value={view} onChange={setView} />
                </div>

                {/* --------------------------------------------------- tarjetas */}
                {visible.length === 0 ? (
                    <div className="emp-card mt-4 p-6 text-center text-[13px]" style={{ color: 'var(--emp-muted)' }}>
                        {rows.length === 0
                            ? 'Todavía no hay roles propios. Crea uno o parte de una plantilla.'
                            : 'Ningún rol coincide con este filtro.'}
                    </div>
                ) : (
                    <>
                        <div className={tableViewClass(view, 'mt-4')}>
                            <RoleTable roles={visible} onDelete={setConfirmDelete} />
                        </div>

                        <div
                            className={
                                view === 'cards'
                                    ? 'mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3'
                                    : 'mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:hidden'
                            }
                        >
                            {visible.map((role) => (
                                <RoleCard key={role.id} role={role} onDelete={setConfirmDelete} />
                            ))}
                        </div>
                    </>
                )}

                {/* ----------------------------------------------- paginacion */}
                {roles.links.length > 3 ? (
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                        <p className="text-[12px]" style={{ color: 'var(--emp-subtle)' }}>
                            Mostrando {formatNumber(roles.from ?? 0)}–{formatNumber(roles.to ?? 0)} de{' '}
                            {formatNumber(roles.total ?? rows.length)}
                        </p>
                        <div className="flex flex-wrap gap-1">
                            {roles.links.map((link, index) => {
                                const isPrev = index === 0;
                                const isNext = index === roles.links.length - 1;

                                return (
                                    <Link
                                        key={index}
                                        href={link.url ?? '#'}
                                        preserveScroll
                                        aria-label={isPrev ? 'Página anterior' : isNext ? 'Página siguiente' : undefined}
                                        aria-current={link.active ? 'page' : undefined}
                                        className={`flex h-[30px] min-w-[30px] items-center justify-center rounded-lg px-2 text-[12px] ${
                                            link.active ? 'emp-seg-on' : ''
                                        } ${! link.url ? 'pointer-events-none opacity-40' : ''}`}
                                        style={{
                                            border: '1px solid var(--emp-border)',
                                            color: link.active ? 'var(--emp-accent-on)' : 'var(--emp-muted)',
                                        }}
                                    >
                                        {isPrev ? <CaretLeft size={13} /> : isNext ? <CaretRight size={13} /> : pageLabel(link.label)}
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                ) : null}
            </div>

            {/* Movil: crear siempre a mano. */}
            <Can permission="roles.index.create">
                <div
                    className="emp-form fixed inset-x-0 bottom-0 z-30 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:hidden"
                    style={{ backgroundColor: 'var(--emp-bar)', borderTop: '1px solid var(--emp-border)' }}
                >
                    <Link href={route('roles.create')} className="emp-btn emp-btn-primary w-full">
                        <Plus size={17} />
                        Nuevo rol
                    </Link>
                </div>
            </Can>

            <ConfirmDialog
                open={!! confirmDelete}
                onClose={() => setConfirmDelete(null)}
                onConfirm={() => {
                    if (! confirmDelete) return;
                    router.delete(route('roles.destroy', confirmDelete.id), {
                        onFinish: () => setConfirmDelete(null),
                    });
                }}
                title="Eliminar rol"
                message={
                    confirmDelete
                        ? `Se elimina la plantilla «${confirmDelete.display_name}». Los usuarios que la tuvieran conservan los permisos que ya tienen asignados; solo se quedan sin plantilla de referencia.`
                        : ''
                }
                confirmText="Eliminar"
                variant="danger"
            />
        </AppLayout>
    );
}
