import { Head, Link, usePage } from '@inertiajs/react';
import { CaretRight, ChartBar, ClockCounterClockwise, ListMagnifyingGlass, Plus, Trophy } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { ProductionListing, type ProductionListingProps } from '@/Components/Productions/ProductionListing';
import type { ReferenceWithOps } from '@/Components/Productions/ProductionRegisterForm';
import { ProductionRegisterForm } from '@/Components/Productions/ProductionRegisterForm';
import { WorkDayBanner, type WorkDayBannerPayload } from '@/Components/Productions/WorkDayBanner';
import { Can } from '@/Components/UI/Can';
import AppLayout from '@/Layouts/AppLayout';
import { formatCurrency, formatNumber } from '@/lib/utils';
import type { Employee } from '@/types';
import '../../../css/module-ui.css';

/** Cifras de los accesos del operario: cuanto queda por pagar y cuanto ya se pago. */
interface PaymentSummary {
    unpaid_count: number;
    unpaid_value: number;
    pending_count: number;
    paid_count: number;
    paid_value: number;
}

/**
 * El listado solo llega en modo administracion. El operario registra aqui y consulta lo
 * registrado en el Detalle y el Historial, asi que en su caso llega `paymentSummary`.
 */
interface Props extends Partial<Omit<ProductionListingProps, 'workerMode' | 'scope'>> {
    workerMode?: boolean;
    lockedEmployee?: { id: number; name: string; payroll_mode?: string } | null;
    referencesWithOperations?: ReferenceWithOps[];
    workDayBanner?: WorkDayBannerPayload | null;
    workDaySelectableEmployees?: Pick<Employee, 'id' | 'first_name' | 'last_name'>[];
    paymentSummary?: PaymentSummary | null;
}

function records(count: number): string {
    return `${formatNumber(count)} ${count === 1 ? 'registro' : 'registros'}`;
}

export default function ProductionsIndex({
    productions,
    filters,
    totals,
    employees = [],
    references = [],
    operations = [],
    workerMode = false,
    lockedEmployee = null,
    referencesWithOperations = [],
    workDayBanner = null,
    paymentSummary = null,
}: Props) {
    const isConsolidatedView = usePage<App.PageProps>().props.isConsolidatedView ?? false;

    // La barra inferior fija solo aplica cuando existe la accion "Registrar" como enlace.
    // En workerMode el formulario ya trae su propia barra y se solaparian.
    const showMobileCreateBar = !workerMode && !isConsolidatedView;

    return (
        <AppLayout title="Producción">
            <Head title="Producción" />

            <div className="emp-form emp-bleed min-h-screen px-4 pb-28 pt-5 sm:px-[34px] sm:pb-8">
                {/* -------------------------------------------------- cabecera */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                        <h1 className="text-[24px]" style={{ color: 'var(--emp-text)' }}>
                            {workerMode ? 'Mi producción' : 'Producción'}
                        </h1>
                        <p className="mt-1 text-[13px]" style={{ color: 'var(--emp-muted)' }}>
                            {workerMode
                                ? 'Registra lo producido. Lo que falta por pagar está en Detalle; lo ya pagado, en Historial.'
                                : 'Registro diario por empleado.'}
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <Can permission="productions.report.view">
                            <Link href={route('productions.report')} className="emp-btn emp-btn-sm">
                                <ChartBar size={15} />
                                Reporte
                            </Link>
                        </Can>
                        <Can permission="productions.ranking.view">
                            <Link href={route('productions.ranking')} className="emp-btn emp-btn-sm">
                                <Trophy size={15} />
                                Ranking
                            </Link>
                        </Can>
                        {!workerMode && !isConsolidatedView ? (
                            <Can permission="productions.index.create">
                                <Link href={route('productions.create')} className="emp-btn emp-btn-sm emp-btn-primary max-sm:hidden">
                                    <Plus size={15} />
                                    Registrar producción
                                </Link>
                            </Can>
                        ) : null}
                    </div>
                </div>

                {/*
                  * Jornada propia: primera accion del dia del operario, por encima de todo.
                  * El control de jornada de administrador ya no vive aqui; esta en el
                  * formulario de registro, que es donde tiene contexto.
                  */}
                {workDayBanner && workerMode ? (
                    <Can any={['productions.index.workday_start', 'productions.index.workday_close']}>
                        <div className="mt-4">
                            <WorkDayBanner variant="self" initialSelf={workDayBanner} />
                        </div>
                    </Can>
                ) : null}

                {workerMode && !lockedEmployee ? (
                    <p className="emp-note mt-4">
                        Tu cuenta no tiene un empleado vinculado. No puedes registrar producción hasta que un
                        administrador lo asocie.
                    </p>
                ) : null}

                {workerMode && lockedEmployee && referencesWithOperations.length > 0 ? (
                    <div className="mt-4">
                        <ProductionRegisterForm
                            references={referencesWithOperations}
                            lockedEmployeeId={lockedEmployee.id}
                            lockedEmployeeName={lockedEmployee.name}
                            submitButtonText="Registrar producción"
                        />
                    </div>
                ) : null}

                {workerMode && lockedEmployee && referencesWithOperations.length === 0 ? (
                    <p className="emp-note mt-4">
                        No hay referencias activas configuradas. Contacta a administración para poder registrar
                        producción.
                    </p>
                ) : null}

                {/*
                  * Lo registrado ya no se lista debajo del formulario: el operario lo abre
                  * en dos pantallas, partido por el pago, cada una con su permiso.
                  */}
                {workerMode && paymentSummary ? (
                    <Can any={['productions.detail.view', 'productions.history.view']}>
                        <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                            <Can permission="productions.detail.view">
                                <RecordsLink
                                    href={route('productions.detail')}
                                    icon={<ListMagnifyingGlass size={20} />}
                                    title="Detalle"
                                    caption="Producción sin pagar"
                                    value={formatCurrency(paymentSummary.unpaid_value)}
                                    meta={
                                        paymentSummary.pending_count > 0
                                            ? `${records(paymentSummary.unpaid_count)} · ${formatNumber(paymentSummary.pending_count)} por confirmar`
                                            : records(paymentSummary.unpaid_count)
                                    }
                                />
                            </Can>
                            <Can permission="productions.history.view">
                                <RecordsLink
                                    href={route('productions.history')}
                                    icon={<ClockCounterClockwise size={20} />}
                                    title="Historial"
                                    caption="Producción ya pagada"
                                    value={formatCurrency(paymentSummary.paid_value)}
                                    meta={records(paymentSummary.paid_count)}
                                />
                            </Can>
                        </div>
                    </Can>
                ) : null}

                {!workerMode && productions && filters && totals ? (
                    <ProductionListing
                        productions={productions}
                        filters={filters}
                        totals={totals}
                        employees={employees}
                        references={references}
                        operations={operations}
                    />
                ) : null}
            </div>

            {/* Accion primaria al alcance del pulgar en movil. */}
            {showMobileCreateBar ? (
                <Can permission="productions.index.create">
                    <div
                        className="emp-form fixed inset-x-0 bottom-[var(--tabbar-h)] z-30 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 lg:hidden"
                        style={{ backgroundColor: 'var(--emp-bar)', borderTop: '1px solid var(--emp-border)' }}
                    >
                        <Link href={route('productions.create')} className="emp-btn emp-btn-primary w-full">
                            <Plus size={17} />
                            Registrar producción
                        </Link>
                    </div>
                </Can>
            ) : null}
        </AppLayout>
    );
}

/* --------------------------------------------------------------- auxiliares */

/** Acceso del operario al Detalle o al Historial, con la cifra que lo resume. */
function RecordsLink({
    href,
    icon,
    title,
    caption,
    value,
    meta,
}: {
    href: string;
    icon: ReactNode;
    title: string;
    caption: string;
    value: string;
    meta: string;
}) {
    return (
        <Link href={href} className="emp-card emp-hover-row flex items-center gap-3 p-[17px]">
            <span
                aria-hidden="true"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: 'var(--emp-accent-fill)', color: 'var(--emp-accent-on)' }}
            >
                {icon}
            </span>
            <span className="min-w-0 flex-1">
                <span className="block text-[15px]" style={{ color: 'var(--emp-text)' }}>
                    {title}
                </span>
                <span className="block truncate text-[12px]" style={{ color: 'var(--emp-muted)' }}>
                    {caption} · {meta}
                </span>
            </span>
            <span className="shrink-0 text-[17px] tabular-nums" style={{ color: 'var(--emp-text)' }}>
                {value}
            </span>
            <CaretRight size={15} className="shrink-0" style={{ color: 'var(--emp-subtle)' }} />
        </Link>
    );
}
