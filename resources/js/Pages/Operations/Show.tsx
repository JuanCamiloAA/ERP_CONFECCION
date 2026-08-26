import { Head, Link, router } from '@inertiajs/react';
import { ArrowLeft, ArrowCounterClockwise, Copy, PencilSimple, Prohibit } from '@phosphor-icons/react';
import { useState } from 'react';
import { EmployeeFadingRule } from '@/Components/Employees/EmployeeFormSection';
import { OperationAsideCard } from '@/Components/Operations/OperationFormLayout';
import { Can } from '@/Components/UI/Can';
import { ConfirmDialog } from '@/Components/UI/ConfirmDialog';
import AppLayout from '@/Layouts/AppLayout';
import { difficultyLabel } from '@/lib/difficulty';
import { formatCurrency, formatDate, formatDateTime, formatNumber } from '@/lib/utils';
import type { Operation } from '@/types';
import '../../../css/module-ui.css';

interface ReferenceRow {
    id: number;
    code: string;
    name: string;
    is_active: boolean;
    price: number;
    minutes: number | null;
    pivot_is_active: boolean;
}

interface ProductionRow {
    id: number;
    date: string | null;
    employee: string;
    reference_code: string | null;
    reference_name: string | null;
    quantity: number;
    total_value: number;
}

interface Props {
    operation: Operation & { references_count?: number; productions_count?: number };
    metrics: { units_month: number; value_month: number; people_month: number; avg_daily: number };
    references: ReferenceRow[];
    productions: ProductionRow[];
}

/** Encabezado de sección con la regla que se desvanece; se repite en las dos tablas. */
function SectionHead({ title, meta, action }: { title: string; meta?: string; action?: React.ReactNode }) {
    return (
        <>
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <h2 className="text-[15px]" style={{ color: 'var(--emp-text)' }}>
                    {title}
                </h2>
                {meta ? (
                    <span className="text-[12px]" style={{ color: 'var(--emp-muted)' }}>
                        {meta}
                    </span>
                ) : null}
                {action ? <span className="ml-auto shrink-0">{action}</span> : null}
            </div>
            <EmployeeFadingRule />
        </>
    );
}

export default function OperationShow({ operation, metrics, references, productions }: Props) {
    const [confirmStatus, setConfirmStatus] = useState(false);

    const minutes = Number(operation.estimated_minutes ?? 0);
    const price = Number(operation.base_price ?? 0);
    const perMinute = minutes > 0 && price > 0 ? price / minutes : null;

    const toggleStatus = () => {
        router.post(
            route('operations.bulk-status'),
            { ids: [operation.id], is_active: !operation.is_active },
            { preserveScroll: true, onFinish: () => setConfirmStatus(false) },
        );
    };

    const metricCards = [
        { label: 'Precio base', value: formatCurrency(price), meta: 'Si la referencia no fija otro' },
        { label: 'Minutos estándar', value: `${formatNumber(minutes)} min`, meta: `Dificultad ${difficultyLabel(operation.difficulty_level)}` },
        { label: 'Pago por minuto', value: perMinute ? formatCurrency(perMinute) : '—', meta: 'Precio entre minutos' },
        { label: 'Unidades del mes', value: formatNumber(metrics.units_month), meta: `${formatNumber(metrics.avg_daily)} por día con registro` },
    ];

    return (
        <AppLayout title={operation.name}>
            <Head title={operation.name} />

            <div className="emp-form -m-4 min-h-screen px-4 pb-10 pt-5 sm:-m-6 sm:px-[34px] sm:pb-8 lg:-m-8">
                {/* -------------------------------------------------- cabecera */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                        <Link
                            href={route('operations.index')}
                            className="emp-kicker inline-flex items-center gap-1.5 hover:underline"
                        >
                            <ArrowLeft size={13} />
                            Operaciones
                        </Link>
                        <h1 className="mt-1 text-[24px]" style={{ color: 'var(--emp-text)' }}>
                            {operation.name}
                        </h1>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            <span className={operation.is_active ? 'emp-pill' : 'emp-pill emp-pill-warn'}>
                                {operation.is_active ? 'Activa' : 'Inactiva'}
                            </span>
                            <span className="emp-pill emp-pill-accent">
                                Dificultad {difficultyLabel(operation.difficulty_level)}
                            </span>
                            {operation.description ? (
                                <span className="emp-pill max-w-[280px] truncate">{operation.description}</span>
                            ) : null}
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <Can permission="operations.index.create">
                            <button
                                type="button"
                                onClick={() => router.post(route('operations.duplicate', operation.id))}
                                className="emp-btn emp-btn-sm"
                            >
                                <Copy size={15} />
                                Duplicar
                            </button>
                        </Can>
                        <Can permission="operations.index.edit">
                            <button type="button" onClick={() => setConfirmStatus(true)} className="emp-btn emp-btn-sm">
                                {operation.is_active ? <Prohibit size={15} /> : <ArrowCounterClockwise size={15} />}
                                {operation.is_active ? 'Inactivar' : 'Reactivar'}
                            </button>
                        </Can>
                        <Can permission="operations.index.edit">
                            <Link href={route('operations.edit', operation.id)} className="emp-btn emp-btn-sm emp-btn-primary">
                                <PencilSimple size={15} />
                                Editar
                            </Link>
                        </Can>
                    </div>
                </div>

                {/* -------------------------------------------------- metricas */}
                <div className="mt-5 -mx-4 flex gap-2.5 overflow-x-auto px-4 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4">
                    {metricCards.map((card) => (
                        <div key={card.label} className="emp-card min-w-[176px] shrink-0 p-[17px] sm:min-w-0">
                            <p className="emp-kicker">{card.label}</p>
                            <p className="mt-1 text-[27px] leading-none tabular-nums" style={{ color: 'var(--emp-text)' }}>
                                {card.value}
                            </p>
                            <p className="mt-1 text-[11px]" style={{ color: 'var(--emp-subtle)' }}>
                                {card.meta}
                            </p>
                        </div>
                    ))}
                </div>

                {/* ------------------------------------------------- contenido */}
                <div className="mt-6 flex flex-col items-start gap-6 lg:flex-row lg:gap-[26px]">
                    <div className="w-full min-w-0 flex-1">
                        {/* ------------------------------------- referencias */}
                        <section>
                            <SectionHead
                                title="Referencias que la usan"
                                meta={`${formatNumber(references.length)} ${references.length === 1 ? 'referencia' : 'referencias'}`}
                                action={
                                    <Link
                                        href={route('references.index')}
                                        className="text-[12px] underline underline-offset-2"
                                        style={{ color: 'var(--emp-accent-on)' }}
                                    >
                                        Ver todas
                                    </Link>
                                }
                            />

                            {references.length === 0 ? (
                                <p className="mt-3 text-[13px]" style={{ color: 'var(--emp-muted)' }}>
                                    Ninguna referencia la incluye todavía.
                                </p>
                            ) : (
                                <>
                                    {/* Escritorio: tabla. */}
                                    <div className="mt-3 hidden lg:block">
                                        <div
                                            className="grid gap-2.5 px-2 pb-2 text-[11px] uppercase tracking-[0.09em]"
                                            style={{
                                                gridTemplateColumns: '110px 1fr 120px 80px',
                                                color: 'var(--emp-subtle)',
                                                borderBottom: '1px solid var(--emp-border)',
                                            }}
                                        >
                                            <span>Código</span>
                                            <span>Referencia</span>
                                            <span className="text-right">Precio en la ref.</span>
                                            <span className="text-right">Min.</span>
                                        </div>
                                        {references.map((reference) => (
                                            <div
                                                key={reference.id}
                                                className={`emp-row-sep emp-hover-row grid items-center gap-2.5 px-2 py-2.5 ${
                                                    reference.pivot_is_active ? '' : 'emp-row-off'
                                                }`}
                                                style={{ gridTemplateColumns: '110px 1fr 120px 80px' }}
                                            >
                                                <Link
                                                    href={route('references.show', reference.id)}
                                                    className="truncate text-[13px] hover:underline"
                                                    style={{ color: 'var(--emp-text)' }}
                                                >
                                                    {reference.code}
                                                </Link>
                                                <span className="truncate text-[13px]" style={{ color: 'var(--emp-muted)' }}>
                                                    {reference.name}
                                                </span>
                                                <span className="text-right text-[13px] tabular-nums" style={{ color: 'var(--emp-text)' }}>
                                                    {formatCurrency(reference.price)}
                                                </span>
                                                <span className="text-right text-[13px] tabular-nums" style={{ color: 'var(--emp-muted)' }}>
                                                    {reference.minutes !== null ? formatNumber(reference.minutes) : '—'}
                                                </span>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Movil: tarjetas. */}
                                    <div className="mt-3 flex flex-col gap-2 lg:hidden">
                                        {references.map((reference) => (
                                            <Link
                                                key={reference.id}
                                                href={route('references.show', reference.id)}
                                                className="emp-card flex items-start justify-between gap-3 p-3"
                                            >
                                                <span className="min-w-0">
                                                    <span className="block truncate text-[14px]" style={{ color: 'var(--emp-text)' }}>
                                                        {reference.code}
                                                    </span>
                                                    <span className="block truncate text-[12px]" style={{ color: 'var(--emp-muted)' }}>
                                                        {reference.name}
                                                    </span>
                                                </span>
                                                <span className="shrink-0 text-right">
                                                    <span className="block text-[14px] tabular-nums" style={{ color: 'var(--emp-text)' }}>
                                                        {formatCurrency(reference.price)}
                                                    </span>
                                                    <span className="block text-[11px] tabular-nums" style={{ color: 'var(--emp-subtle)' }}>
                                                        {reference.minutes !== null ? `${formatNumber(reference.minutes)} min` : '—'}
                                                    </span>
                                                </span>
                                            </Link>
                                        ))}
                                    </div>
                                </>
                            )}
                        </section>

                        {/* -------------------------------------- produccion */}
                        <section className="mt-6">
                            <SectionHead title="Producción reciente" meta="Últimos 10 registros" />

                            {productions.length === 0 ? (
                                <p className="mt-3 text-[13px]" style={{ color: 'var(--emp-muted)' }}>
                                    Todavía no se ha registrado producción con esta operación.
                                </p>
                            ) : (
                                <>
                                    <div className="mt-3 hidden lg:block">
                                        <div
                                            className="grid gap-2.5 px-2 pb-2 text-[11px] uppercase tracking-[0.09em]"
                                            style={{
                                                gridTemplateColumns: '80px 1fr 1fr 70px 100px',
                                                color: 'var(--emp-subtle)',
                                                borderBottom: '1px solid var(--emp-border)',
                                            }}
                                        >
                                            <span>Fecha</span>
                                            <span>Empleado</span>
                                            <span>Referencia</span>
                                            <span className="text-right">Cant.</span>
                                            <span className="text-right">Valor</span>
                                        </div>
                                        {productions.map((production) => (
                                            <div
                                                key={production.id}
                                                className="emp-row-sep emp-hover-row grid items-center gap-2.5 px-2 py-2.5"
                                                style={{ gridTemplateColumns: '80px 1fr 1fr 70px 100px' }}
                                            >
                                                <span className="text-[12px] tabular-nums" style={{ color: 'var(--emp-muted)' }}>
                                                    {production.date ? formatDate(production.date) : '—'}
                                                </span>
                                                <span className="truncate text-[13px] capitalize" style={{ color: 'var(--emp-text)' }}>
                                                    {production.employee || '—'}
                                                </span>
                                                <span className="truncate text-[13px]" style={{ color: 'var(--emp-muted)' }}>
                                                    {production.reference_code}
                                                </span>
                                                <span className="text-right text-[13px] tabular-nums" style={{ color: 'var(--emp-text)' }}>
                                                    {formatNumber(production.quantity)}
                                                </span>
                                                <span className="text-right text-[13px] tabular-nums" style={{ color: 'var(--emp-text)' }}>
                                                    {formatCurrency(production.total_value)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="mt-3 flex flex-col gap-2 lg:hidden">
                                        {productions.map((production) => (
                                            <article key={production.id} className="emp-card flex items-start justify-between gap-3 p-3">
                                                <span className="min-w-0">
                                                    <span className="block truncate text-[14px] capitalize" style={{ color: 'var(--emp-text)' }}>
                                                        {production.employee || '—'}
                                                    </span>
                                                    <span className="block truncate text-[12px]" style={{ color: 'var(--emp-muted)' }}>
                                                        {production.reference_code} ·{' '}
                                                        {production.date ? formatDate(production.date) : '—'}
                                                    </span>
                                                </span>
                                                <span className="shrink-0 text-right">
                                                    <span className="block text-[14px] tabular-nums" style={{ color: 'var(--emp-text)' }}>
                                                        {formatCurrency(production.total_value)}
                                                    </span>
                                                    <span className="block text-[11px] tabular-nums" style={{ color: 'var(--emp-subtle)' }}>
                                                        {formatNumber(production.quantity)} und
                                                    </span>
                                                </span>
                                            </article>
                                        ))}
                                    </div>
                                </>
                            )}
                        </section>
                    </div>

                    {/* ------------------------------------------------ panel */}
                    <aside className="flex w-full flex-col gap-4 lg:w-[292px] lg:shrink-0">
                        <OperationAsideCard title="Datos">
                            <dl className="mt-2 flex flex-col gap-2 text-[12px]">
                                <div>
                                    <dt style={{ color: 'var(--emp-muted)' }}>Descripción</dt>
                                    <dd className="mt-0.5 whitespace-pre-line" style={{ color: 'var(--emp-text)' }}>
                                        {operation.description || 'Sin descripción.'}
                                    </dd>
                                </div>
                                <div className="flex items-center justify-between gap-3">
                                    <dt style={{ color: 'var(--emp-muted)' }}>Creada</dt>
                                    <dd style={{ color: 'var(--emp-text)' }}>{formatDate(operation.created_at)}</dd>
                                </div>
                                <div className="flex items-center justify-between gap-3">
                                    <dt style={{ color: 'var(--emp-muted)' }}>Última actualización</dt>
                                    <dd style={{ color: 'var(--emp-text)' }}>{formatDateTime(operation.updated_at)}</dd>
                                </div>
                            </dl>
                        </OperationAsideCard>

                        <OperationAsideCard title="Este mes">
                            <dl className="mt-2 flex flex-col gap-1.5 text-[12px]">
                                {[
                                    ['Valor pagado', formatCurrency(metrics.value_month)],
                                    [
                                        'Personas que la hicieron',
                                        `${formatNumber(metrics.people_month)} ${metrics.people_month === 1 ? 'persona' : 'personas'}`,
                                    ],
                                    ['Promedio por día', `${formatNumber(metrics.avg_daily)} und`],
                                ].map(([label, value]) => (
                                    <div key={label} className="flex items-center justify-between gap-3">
                                        <dt style={{ color: 'var(--emp-muted)' }}>{label}</dt>
                                        <dd className="tabular-nums" style={{ color: 'var(--emp-text)' }}>
                                            {value}
                                        </dd>
                                    </div>
                                ))}
                            </dl>
                        </OperationAsideCard>
                    </aside>
                </div>
            </div>

            <ConfirmDialog
                open={confirmStatus}
                onClose={() => setConfirmStatus(false)}
                onConfirm={toggleStatus}
                title={operation.is_active ? 'Inactivar operación' : 'Reactivar operación'}
                message={
                    operation.is_active
                        ? `«${operation.name}» dejará de ofrecerse al registrar producción y al armar referencias. Lo ya registrado no cambia.`
                        : `«${operation.name}» vuelve a ofrecerse al registrar producción y al armar referencias.`
                }
                confirmText={operation.is_active ? 'Inactivar' : 'Reactivar'}
            />
        </AppLayout>
    );
}
