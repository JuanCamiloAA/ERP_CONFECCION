import { Head, Link, router } from '@inertiajs/react';
import { ArrowLeft, CheckCircle, Eye, FloppyDisk, MagnifyingGlass, Warning } from '@phosphor-icons/react';
import { useMemo, useState } from 'react';
import {
    VisibilityMatrix,
    type CompanyRow,
    type RoleRow,
    type VisibilityPair,
} from '@/Components/DashboardBuilder/VisibilityMatrix';
import { VisibilitySheet } from '@/Components/DashboardBuilder/VisibilitySheet';
import { WidgetTypeBadge } from '@/Components/DashboardBuilder/WidgetRow';
import type { QueryMode, TableMeta, WidgetType } from '@/Components/DashboardBuilder/dashboard-builder-types';
import { EmployeeAsideCard } from '@/Components/Employees/EmployeeFormLayout';
import AppLayout from '@/Layouts/AppLayout';
import { TYPE_LONG_LABELS, type Assignment } from '@/lib/dashboard-widgets';
import { formatNumber } from '@/lib/utils';
import '../../../../css/module-ui.css';

interface WidgetRecord {
    id: number;
    name: string;
    title: string;
    type: WidgetType;
    query_mode: QueryMode;
    query_definition: { table?: string } | null;
    raw_sql: string | null;
    is_active: boolean;
}

interface VisibilityRecord {
    id: number;
    company_id: number;
    role_id: number | null;
    position: number;
}

interface Props {
    widget: WidgetRecord;
    availableTables: TableMeta[];
    companies: CompanyRow[];
    rolesByCompany: Record<string, RoleRow[]>;
    visibility: VisibilityRecord[];
    assignments: Assignment[];
    querySummary: string;
}

type CompanyFilter = 'all' | 'assigned' | 'active';

const FILTER_SEGMENTS: { value: CompanyFilter; label: string }[] = [
    { value: 'all', label: 'Todas' },
    { value: 'assigned', label: 'Solo asignadas' },
    { value: 'active', label: 'Activas' },
];

/** Clave estable de una asignación, para comparar el estado con el guardado. */
const pairKey = (pair: VisibilityPair) => `${pair.company_id}:${pair.role_id ?? 'all'}`;

export default function DashboardWidgetVisibility({
    widget,
    availableTables,
    companies,
    rolesByCompany,
    visibility,
    assignments,
    querySummary,
}: Props) {
    const initial = useMemo<VisibilityPair[]>(
        () => visibility.map((v) => ({ company_id: v.company_id, role_id: v.role_id })),
        [visibility],
    );

    const [rows, setRows] = useState<VisibilityPair[]>(initial);
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState<CompanyFilter>('all');
    const [errors, setErrors] = useState<string[]>([]);
    const [saving, setSaving] = useState(false);

    /**
     * Una consulta que no filtra por empresa no se puede asignar a ninguna: mostraría a
     * cada empresa los datos de todas. Es la misma regla que aplica el backend.
     */
    const canFilterByCompany = useMemo(() => {
        if (widget.query_mode === 'sql') {
            return (widget.raw_sql ?? '').includes(':company_id');
        }

        const table = availableTables.find((t) => t.key === widget.query_definition?.table);

        return Boolean(table?.has_company_scope);
    }, [widget, availableTables]);

    const isAllRoles = (companyId: number) => rows.some((r) => r.company_id === companyId && r.role_id === null);

    const toggleAllRoles = (companyId: number) => {
        setRows((prev) => {
            const without = prev.filter((r) => r.company_id !== companyId);

            return prev.some((r) => r.company_id === companyId && r.role_id === null)
                ? without
                : [...without, { company_id: companyId, role_id: null }];
        });
    };

    const toggleRole = (companyId: number, roleId: number) => {
        setRows((prev) => {
            const withoutAllRoles = prev.filter((r) => ! (r.company_id === companyId && r.role_id === null));

            if (prev.some((r) => r.company_id === companyId && r.role_id === roleId)) {
                return withoutAllRoles.filter((r) => ! (r.company_id === companyId && r.role_id === roleId));
            }

            return [...withoutAllRoles, { company_id: companyId, role_id: roleId }];
        });
    };

    const dirty = useMemo(() => {
        const before = new Set(initial.map(pairKey));
        const after = new Set(rows.map(pairKey));

        return before.size !== after.size || [...after].some((key) => ! before.has(key));
    }, [initial, rows]);

    const touchedCompanies = useMemo(() => new Set(rows.map((r) => r.company_id)).size, [rows]);

    const visibleCompanies = useMemo(() => {
        const term = search.trim().toLowerCase();

        return companies.filter((company) => {
            if (filter === 'assigned' && ! rows.some((r) => r.company_id === company.id)) return false;
            if (filter === 'active' && ! company.is_active) return false;
            if (term === '') return true;

            return `${company.name} ${company.nit ?? ''}`.toLowerCase().includes(term);
        });
    }, [companies, rows, filter, search]);

    const save = () => {
        setSaving(true);
        setErrors([]);

        router.put(
            route('super-admin.dashboard-widgets.visibility.update', widget.id),
            { visibility: rows.map((r, i) => ({ ...r, position: i })) },
            {
                preserveScroll: true,
                onError: (formErrors) => setErrors(Object.values(formErrors) as string[]),
                onFinish: () => setSaving(false),
            },
        );
    };

    return (
        <AppLayout title={`Visibilidad · ${widget.title}`}>
            <Head title={`Visibilidad · ${widget.title}`} />

            <div className="emp-form emp-bleed min-h-screen px-4 pb-28 pt-5 sm:px-[34px] lg:pb-8">
                {/* -------------------------------------------------- cabecera */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                        <p className="emp-kicker flex flex-wrap items-center gap-1.5">
                            <Link href={route('super-admin.dashboard-widgets.index')} className="hover:underline">
                                Constructor
                            </Link>
                            <span aria-hidden="true">›</span>
                            <Link
                                href={route('super-admin.dashboard-widgets.edit', widget.id)}
                                className="hover:underline"
                            >
                                {widget.title}
                            </Link>
                            <span aria-hidden="true">›</span>
                            <span>Visibilidad</span>
                        </p>

                        <h1 className="mt-1 text-[24px]" style={{ color: 'var(--emp-text)' }}>
                            Visibilidad del widget
                        </h1>
                        <p className="mt-1 max-w-[640px] text-[13px]" style={{ color: 'var(--emp-muted)' }}>
                            Marca la casilla donde el widget debe aparecer. Una empresa con «Todos los roles» ignora las
                            marcas por rol.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 max-sm:hidden">
                        <Link
                            href={route('super-admin.dashboard-widgets.edit', widget.id)}
                            className="emp-btn emp-btn-sm"
                        >
                            <ArrowLeft size={14} />
                            Volver al editor
                        </Link>
                        <button
                            type="button"
                            onClick={save}
                            disabled={saving || ! canFilterByCompany}
                            className="emp-btn emp-btn-sm emp-btn-primary"
                        >
                            <FloppyDisk size={14} />
                            {saving ? 'Guardando…' : 'Guardar visibilidad'}
                        </button>
                    </div>
                </div>

                {/* -------------------------------------------------- pestañas */}
                <div className="emp-seg mt-4 sm:w-[420px]">
                    <Link
                        href={route('super-admin.dashboard-widgets.edit', widget.id)}
                        className="emp-seg-item flex items-center justify-center"
                    >
                        Definición
                    </Link>
                    <Link
                        href={route('super-admin.dashboard-widgets.edit', widget.id)}
                        className="emp-seg-item flex items-center justify-center"
                    >
                        Apariencia
                    </Link>
                    <span className="emp-seg-item emp-seg-on flex items-center justify-center">
                        Visibilidad{rows.length > 0 ? ` · ${rows.length}` : ''}
                    </span>
                </div>

                {! canFilterByCompany ? (
                    <div className="emp-note mt-4" style={{ borderLeftColor: 'var(--emp-danger)' }}>
                        <p className="flex items-start gap-1.5" style={{ color: 'var(--emp-danger)' }}>
                            <Warning size={14} className="mt-0.5 shrink-0" />
                            Esta consulta no filtra por empresa (la tabla no tiene{' '}
                            <span style={{ fontFamily: 'ui-monospace, monospace' }}>company_id</span> o el SQL no incluye{' '}
                            <span style={{ fontFamily: 'ui-monospace, monospace' }}>:company_id</span>). Solo puede usarse
                            en la vista consolidada del super admin; no se puede asignar a empresas específicas.
                        </p>
                    </div>
                ) : null}

                {errors.length > 0 ? (
                    <div className="emp-note mt-4" style={{ borderLeftColor: 'var(--emp-danger)' }}>
                        <ul className="list-inside list-disc" style={{ color: 'var(--emp-danger)' }}>
                            {errors.map((error, index) => (
                                <li key={index}>{error}</li>
                            ))}
                        </ul>
                    </div>
                ) : null}

                <div className="mt-5 flex flex-col items-start gap-6 lg:flex-row lg:gap-[26px]">
                    <div className="w-full min-w-0 flex-1">
                        {/* --------------------------------------------- filtros */}
                        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
                            <div className="relative min-w-0 sm:max-w-[320px] sm:flex-1">
                                <MagnifyingGlass
                                    size={15}
                                    className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2"
                                    style={{ color: 'var(--emp-subtle)' }}
                                />
                                <input
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Buscar empresa…"
                                    aria-label="Buscar empresa"
                                    className="emp-field pl-8"
                                />
                            </div>

                            <div className="emp-seg sm:w-[300px]">
                                {FILTER_SEGMENTS.map((segment) => (
                                    <button
                                        key={segment.value}
                                        type="button"
                                        onClick={() => setFilter(segment.value)}
                                        className={`emp-seg-item ${filter === segment.value ? 'emp-seg-on' : ''}`}
                                    >
                                        {segment.label}
                                    </button>
                                ))}
                            </div>

                            <span
                                className="shrink-0 text-[12px] max-sm:hidden sm:ml-auto"
                                style={{ color: 'var(--emp-subtle)' }}
                            >
                                {formatNumber(visibleCompanies.length)}{' '}
                                {visibleCompanies.length === 1 ? 'empresa' : 'empresas'} · {formatNumber(rows.length)}{' '}
                                {rows.length === 1 ? 'asignación' : 'asignaciones'}
                            </span>
                        </div>

                        {/* ---------------------------------------------- matriz */}
                        <div className="mt-4">
                            {visibleCompanies.length === 0 ? (
                                <div
                                    className="emp-card p-6 text-center text-[13px]"
                                    style={{ color: 'var(--emp-muted)' }}
                                >
                                    Ninguna empresa coincide con el filtro.
                                </div>
                            ) : (
                                <>
                                    <div className="hidden lg:block">
                                        <VisibilityMatrix
                                            companies={visibleCompanies}
                                            rolesByCompany={rolesByCompany}
                                            rows={rows}
                                            onToggleAll={toggleAllRoles}
                                            onToggleRole={toggleRole}
                                            disabled={! canFilterByCompany}
                                        />
                                    </div>

                                    <div className="lg:hidden">
                                        <VisibilitySheet
                                            companies={visibleCompanies}
                                            rolesByCompany={rolesByCompany}
                                            rows={rows}
                                            onToggleAll={toggleAllRoles}
                                            onToggleRole={toggleRole}
                                            disabled={! canFilterByCompany}
                                        />
                                    </div>
                                </>
                            )}
                        </div>

                        {/* ------------------------------------ barra de cambios */}
                        {dirty ? (
                            <div className="emp-strip mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[10px] p-3">
                                <p className="text-[12.5px]" style={{ color: 'var(--emp-text)' }}>
                                    {formatNumber(touchedCompanies)}{' '}
                                    {touchedCompanies === 1 ? 'empresa' : 'empresas'} · {formatNumber(rows.length)}{' '}
                                    {rows.length === 1 ? 'asignación' : 'asignaciones'} sin guardar
                                </p>
                                <div className="flex items-center gap-2">
                                    <button type="button" onClick={() => setRows(initial)} className="emp-btn emp-btn-sm">
                                        Descartar
                                    </button>
                                    <button
                                        type="button"
                                        onClick={save}
                                        disabled={saving || ! canFilterByCompany}
                                        className="emp-btn emp-btn-sm emp-btn-primary"
                                    >
                                        {saving ? 'Guardando…' : 'Guardar visibilidad'}
                                    </button>
                                </div>
                            </div>
                        ) : null}
                    </div>

                    {/* --------------------------------------------------- aside */}
                    <aside className="flex w-full flex-col gap-4 lg:w-[300px] lg:shrink-0">
                        <EmployeeAsideCard title="Este widget">
                            <div className="mt-2.5 flex items-start gap-2.5">
                                <WidgetTypeBadge type={widget.type} active={widget.is_active} size={36} />
                                <div className="min-w-0">
                                    <p className="truncate text-[13px]" style={{ color: 'var(--emp-text)' }}>
                                        {widget.title}
                                    </p>
                                    <p className="text-[11px]" style={{ color: 'var(--emp-subtle)' }}>
                                        {TYPE_LONG_LABELS[widget.type]} ·{' '}
                                        {widget.query_mode === 'sql' ? 'SQL avanzado' : 'consulta guiada'}
                                    </p>
                                </div>
                            </div>

                            <p
                                className="mt-2 truncate text-[11.5px]"
                                style={{ color: 'var(--emp-subtle)', fontFamily: 'ui-monospace, monospace' }}
                                title={querySummary}
                            >
                                {querySummary}
                            </p>

                            {canFilterByCompany ? (
                                <p
                                    className="mt-2 flex items-center gap-1 text-[11.5px]"
                                    style={{ color: 'var(--emp-ok)' }}
                                >
                                    <CheckCircle size={12} />
                                    La consulta filtra por empresa
                                </p>
                            ) : null}
                        </EmployeeAsideCard>

                        <EmployeeAsideCard title="Cuándo no se puede asignar">
                            <p className="mt-2 text-[12px]" style={{ color: 'var(--emp-muted)' }}>
                                Si la tabla no tiene{' '}
                                <span style={{ fontFamily: 'ui-monospace, monospace' }}>company_id</span> —o el SQL no
                                usa <span style={{ fontFamily: 'ui-monospace, monospace' }}>:company_id</span>— el mismo
                                número le saldría igual a todas las empresas. Por eso la matriz queda bloqueada y el
                                widget solo se ve en la vista consolidada.
                            </p>
                        </EmployeeAsideCard>

                        <EmployeeAsideCard title="Orden en el dashboard">
                            <p className="mt-2 text-[12px]" style={{ color: 'var(--emp-muted)' }}>
                                Los widgets se pintan en el orden en que se guardan aquí. Cada usuario puede reordenar
                                su propio tablero después.
                            </p>
                            <Link href={route('dashboard')} className="emp-btn emp-btn-sm mt-2.5">
                                <Eye size={14} />
                                Ver el dashboard
                            </Link>
                        </EmployeeAsideCard>

                        {assignments.length > 0 ? (
                            <EmployeeAsideCard title="Guardado ahora mismo">
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                    {assignments.map((assignment) => (
                                        <span key={assignment.company} className="emp-pill max-w-full truncate">
                                            {assignment.company} · {assignment.roles_label}
                                        </span>
                                    ))}
                                </div>
                            </EmployeeAsideCard>
                        ) : null}
                    </aside>
                </div>
            </div>

            {/* Movil: guardar al alcance del pulgar. */}
            <div
                className="emp-form fixed inset-x-0 bottom-[var(--tabbar-h)] z-30 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 lg:hidden"
                style={{ backgroundColor: 'var(--emp-bar)', borderTop: '1px solid var(--emp-border)' }}
            >
                <button
                    type="button"
                    onClick={save}
                    disabled={saving || ! canFilterByCompany}
                    className="emp-btn emp-btn-primary w-full"
                >
                    <FloppyDisk size={17} />
                    {saving ? 'Guardando…' : 'Guardar visibilidad'}
                </button>
            </div>
        </AppLayout>
    );
}
