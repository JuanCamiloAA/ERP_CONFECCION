import { Head, Link, router } from '@inertiajs/react';
import { Plus, Scales } from '@phosphor-icons/react';
import { useMemo, useState } from 'react';
import { LegalParameterActiveCard } from '@/Components/PayrollLegalParameters/LegalParameterActiveCard';
import { LegalParameterTable } from '@/Components/PayrollLegalParameters/LegalParameterTable';
import { LegalParameterTramoCard } from '@/Components/PayrollLegalParameters/LegalParameterTramoCard';
import { Can } from '@/Components/UI/Can';
import { ConfirmDialog } from '@/Components/UI/ConfirmDialog';
import { cardsViewClass, tableViewClass } from '@/Components/UI/ListViewSwitch';
import { ViewToggle } from '@/Components/UI/ViewToggle';
import { useViewMode } from '@/hooks/useViewMode';
import AppLayout from '@/Layouts/AppLayout';
import type { LegalParameterRow } from '@/lib/legalParameters';
import { formatDate, formatNumber } from '@/lib/utils';
import '../../../css/module-ui.css';

interface Props {
    parameters: LegalParameterRow[];
    active: LegalParameterRow | null;
    isSuperAdmin: boolean;
    salaryExample: number;
}

export default function PayrollLegalParametersIndex({ parameters, active, isSuperAdmin, salaryExample }: Props) {
    const [confirmDelete, setConfirmDelete] = useState<LegalParameterRow | null>(null);
    const [view, setView] = useViewMode('payroll-legal-parameters');

    // Los de la empresa primero: son los que mandan sobre el global.
    const sorted = useMemo(
        () =>
            [...parameters].sort((a, b) => {
                if (a.scope !== b.scope) {
                    return a.scope === 'company' ? -1 : 1;
                }

                return String(b.effective_from).localeCompare(String(a.effective_from));
            }),
        [parameters],
    );

    return (
        <AppLayout title="Parámetros legales de nómina">
            <Head title="Parámetros legales de nómina" />

            <div className="emp-form emp-bleed min-h-screen px-4 pb-10 pt-5 sm:px-[34px] sm:pb-8">
                {/* -------------------------------------------------- cabecera */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                        <h1 className="text-[24px]" style={{ color: 'var(--emp-text)' }}>
                            Parámetros legales de nómina
                        </h1>
                        <p className="mt-1 text-[13px]" style={{ color: 'var(--emp-muted)' }}>
                            Jornada, franja nocturna, recargos, horas extra e inasistencias que rigen la liquidación de
                            la modalidad «Por horas (legal)».
                        </p>
                    </div>

                    <Can permission="payroll_legal_parameters.index.create">
                        <Link
                            href={route('payroll-legal-parameters.create')}
                            className="emp-btn emp-btn-sm emp-btn-primary"
                        >
                            <Plus size={15} />
                            Nuevo tramo
                        </Link>
                    </Can>
                </div>

                {/* Aviso legal: rojo del sistema, no un ambar fuera de la paleta. */}
                <div
                    className="emp-note mt-4 flex items-start gap-2.5"
                    style={{
                        borderLeftColor: 'var(--emp-danger)',
                        backgroundColor: 'color-mix(in srgb, var(--emp-danger) 8%, transparent)',
                    }}
                >
                    <Scales size={18} style={{ color: 'var(--emp-danger)', flexShrink: 0, marginTop: '1px' }} />
                    <p>
                        Estos valores determinan cómo se paga la jornada, los recargos, las horas extra y las
                        inasistencias de todas las nóminas.{' '}
                        <strong style={{ color: 'var(--emp-danger)' }}>
                            Verifícalos con tu asesor legal o contable antes de aprobar nómina real.
                        </strong>{' '}
                        El descuento por inasistencia en particular tiene matices legales genuinos —no confundir con el
                        tope del 20% de multas disciplinarias del art. 113 del CST—: actívalo solo con ese
                        acompañamiento.
                    </p>
                </div>

                {/* ---------------------------------------------- vigente hoy */}
                <div className="mt-5">
                    {active ? (
                        <LegalParameterActiveCard
                            active={active}
                            salaryExample={salaryExample}
                            hasCompanyOverride={active.scope === 'company'}
                        />
                    ) : (
                        <div className="emp-card p-6 text-center text-[13px]" style={{ color: 'var(--emp-muted)' }}>
                            Ningún tramo cubre la fecha de hoy: la nómina por horas no tiene parámetros con los que
                            liquidar. Crea un tramo con vigencia desde hoy.
                        </div>
                    )}
                </div>

                {/* ------------------------------------------------- tramos */}
                <section className="mt-6">
                    <header className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 px-0.5 pb-2">
                        <h2 className="text-[11px] uppercase tracking-[0.09em]" style={{ color: 'var(--emp-subtle)' }}>
                            Tramos de vigencia
                        </h2>
                        <p className="text-[11px]" style={{ color: 'var(--emp-muted)' }}>
                            · {formatNumber(parameters.length)} {parameters.length === 1 ? 'tramo' : 'tramos'} · los
                            globales aplican a toda empresa sin tramo propio
                        </p>

                        <ViewToggle variant="emp" value={view} onChange={setView} className="ml-auto self-center" />
                    </header>

                    {parameters.length === 0 ? (
                        <div className="emp-card p-6 text-center text-[13px]" style={{ color: 'var(--emp-muted)' }}>
                            No hay tramos configurados.
                        </div>
                    ) : (
                        <>
                            <div className={tableViewClass(view)}>
                                <LegalParameterTable
                                    parameters={sorted}
                                    isSuperAdmin={isSuperAdmin}
                                    onDelete={setConfirmDelete}
                                />
                            </div>

                            <div className={cardsViewClass(view, 'gap-2.5')}>
                                {sorted.map((parameter) => (
                                    <LegalParameterTramoCard
                                        key={parameter.id}
                                        parameter={parameter}
                                        isSuperAdmin={isSuperAdmin}
                                        onDelete={setConfirmDelete}
                                    />
                                ))}
                            </div>
                        </>
                    )}
                </section>
            </div>

            <ConfirmDialog
                open={!!confirmDelete}
                onClose={() => setConfirmDelete(null)}
                onConfirm={() => {
                    if (!confirmDelete) return;
                    router.delete(route('payroll-legal-parameters.destroy', confirmDelete.id), {
                        onFinish: () => setConfirmDelete(null),
                    });
                }}
                title="Eliminar tramo"
                message={
                    confirmDelete
                        ? `Se elimina el tramo desde el ${formatDate(confirmDelete.effective_from)}. Si había nóminas liquidadas dentro del rango, el servidor lo rechaza; en ese caso cierra su vigencia y crea uno nuevo.`
                        : ''
                }
                confirmText="Eliminar"
                variant="danger"
            />
        </AppLayout>
    );
}
