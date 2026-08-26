import { Head, Link, router, useForm } from '@inertiajs/react';
import { ArrowLeft, Check, CheckCircle, Circle, Trash, Warning } from '@phosphor-icons/react';
import { useState, type FormEvent } from 'react';
import { EmployeeAsideCard, EmployeeFormLayout, EmployeeFormNav } from '@/Components/Employees/EmployeeFormLayout';
import { EmployeeFormSection } from '@/Components/Employees/EmployeeFormSection';
import { LegalCompareCard } from '@/Components/PayrollLegalParameters/LegalCompareCard';
import { LegalSimulationCard } from '@/Components/PayrollLegalParameters/LegalSimulationCard';
import {
    LEGAL_DEFAULTS,
    LEGAL_SECTIONS,
    PayrollLegalParameterFields,
    type PayrollLegalParameterFormData,
} from '@/Components/PayrollLegalParameters/PayrollLegalParameterFields';
import { Can } from '@/Components/UI/Can';
import { ConfirmDialog } from '@/Components/UI/ConfirmDialog';
import AppLayout from '@/Layouts/AppLayout';
import { suggestedDivisor, type LegalParameterRow } from '@/lib/legalParameters';
import { formatDate } from '@/lib/utils';
import '../../../css/module-ui.css';

interface Props {
    parameter: LegalParameterRow;
    active: LegalParameterRow | null;
    salaryExample: number;
}

export default function PayrollLegalParameterEdit({ parameter, active, salaryExample }: Props) {
    const [salary, setSalary] = useState(String(salaryExample));
    const [confirmDelete, setConfirmDelete] = useState(false);

    const { data, setData, put, processing, errors } = useForm<PayrollLegalParameterFormData>({
        effective_from: String(parameter.effective_from).slice(0, 10),
        effective_to: parameter.effective_to ? String(parameter.effective_to).slice(0, 10) : '',
        weekly_legal_hours: String(parameter.weekly_legal_hours),
        monthly_hours_divisor: String(parameter.monthly_hours_divisor),
        night_start_time: String(parameter.night_start_time).slice(0, 5),
        night_end_time: String(parameter.night_end_time).slice(0, 5),
        night_surcharge_percent: String(parameter.night_surcharge_percent),
        overtime_day_percent: String(parameter.overtime_day_percent),
        overtime_night_percent: String(parameter.overtime_night_percent),
        sunday_holiday_surcharge_percent: String(parameter.sunday_holiday_surcharge_percent),
        max_overtime_hours_per_day: String(parameter.max_overtime_hours_per_day),
        max_overtime_hours_per_week: String(parameter.max_overtime_hours_per_week),
        discount_unexcused_absences: parameter.discount_unexcused_absences,
        absence_discount_percent: String(parameter.absence_discount_percent),
        legal_reference: parameter.legal_reference ?? '',
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        put(route('payroll-legal-parameters.update', parameter.id));
    };

    const loadLegalDefaults = () => {
        (Object.entries(LEGAL_DEFAULTS) as [keyof PayrollLegalParameterFormData, string][]).forEach(([key, value]) => {
            setData(key, value as never);
        });
    };

    const divisorMatches =
        Math.abs(Number(data.monthly_hours_divisor) - suggestedDivisor(Number(data.weekly_legal_hours))) < 0.005;

    const header = (
        <header
            className="sticky top-0 z-30 px-4 py-3 sm:px-[34px] sm:py-4"
            style={{ backgroundColor: 'var(--emp-bar)', borderBottom: '1px solid var(--emp-border)' }}
        >
            <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                    <p className="emp-kicker">Parámetros legales · Editar tramo</p>
                    <h1 className="mt-0.5 text-[20px]" style={{ color: 'var(--emp-text)' }}>
                        Desde {formatDate(parameter.effective_from)}
                    </h1>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                        <span className={`emp-pill ${parameter.scope === 'company' ? 'emp-pill-accent' : ''}`}>
                            {parameter.scope === 'company' ? 'Tramo de esta empresa' : 'Tramo global'}
                        </span>
                        {parameter.is_active ? <span className="emp-pill emp-pill-accent">Vigente hoy</span> : null}
                    </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                    <Link href={route('payroll-legal-parameters.index')} className="emp-btn emp-btn-ghost max-sm:hidden">
                        <ArrowLeft size={15} />
                        Cancelar
                    </Link>
                    <button type="submit" disabled={processing} className="emp-btn emp-btn-primary">
                        <Check size={15} />
                        {processing ? 'Guardando…' : 'Guardar cambios'}
                    </button>
                </div>
            </div>
        </header>
    );

    const nav = (
        <div>
            <EmployeeFormNav sections={LEGAL_SECTIONS} />
            <button type="button" onClick={loadLegalDefaults} className="emp-btn emp-btn-sm mt-3 w-full">
                Cargar valores de ley
            </button>
            <p className="mt-1.5 px-1 text-[11px]" style={{ color: 'var(--emp-subtle)' }}>
                Rellena los porcentajes con los del CST vigente. Igual hay que revisarlos.
            </p>
        </div>
    );

    const checklist = [
        { label: 'Fecha de inicio', ok: Boolean(data.effective_from), warn: false },
        {
            label: divisorMatches ? 'Jornada y divisor coherentes' : 'Jornada y divisor no cuadran',
            ok: divisorMatches,
            warn: !divisorMatches,
        },
        { label: 'Referencia legal escrita', ok: data.legal_reference.trim().length > 0, warn: false },
        {
            label: data.discount_unexcused_absences
                ? 'Descuento por inasistencia activo: confírmalo con tu asesor'
                : 'Descuento por inasistencia desactivado',
            ok: !data.discount_unexcused_absences,
            warn: data.discount_unexcused_absences,
        },
    ];

    const aside = (
        <>
            <LegalSimulationCard data={data} salary={salary} onSalaryChange={setSalary} />
            {/* Comparar consigo mismo no aporta: solo se muestra si el vigente es otro. */}
            <LegalCompareCard
                active={active && active.id !== parameter.id ? active : null}
                data={data}
                salary={Number(salary) || 0}
            />

            <EmployeeAsideCard title="Antes de guardar">
                <ul className="mt-2 flex flex-col gap-1.5">
                    {checklist.map((item) => (
                        <li key={item.label} className="flex items-start gap-2 text-[12px]">
                            {item.warn ? (
                                <Warning size={15} weight="fill" style={{ color: 'var(--emp-danger)', flexShrink: 0 }} />
                            ) : item.ok ? (
                                <CheckCircle size={15} weight="fill" style={{ color: 'var(--emp-ok)', flexShrink: 0 }} />
                            ) : (
                                <Circle size={15} style={{ color: 'var(--emp-faint)', flexShrink: 0 }} />
                            )}
                            <span style={{ color: item.warn ? 'var(--emp-danger)' : 'var(--emp-text)' }}>
                                {item.label}
                            </span>
                        </li>
                    ))}
                </ul>
            </EmployeeAsideCard>
        </>
    );

    const mobileBar = (
        <div className="px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <div className="flex gap-2">
                <Link href={route('payroll-legal-parameters.index')} className="emp-btn flex-1">
                    Cancelar
                </Link>
                <button type="submit" disabled={processing} className="emp-btn emp-btn-primary flex-[2]">
                    {processing ? 'Guardando…' : 'Guardar cambios'}
                </button>
            </div>
        </div>
    );

    return (
        <AppLayout title="Editar tramo de parámetros legales">
            <Head title="Editar tramo de parámetros legales" />

            <form onSubmit={submit}>
                <EmployeeFormLayout header={header} nav={nav} aside={aside} mobileBar={mobileBar}>
                    <PayrollLegalParameterFields
                        data={data}
                        setData={setData}
                        errors={errors}
                        salary={Number(salary) || 0}
                    />

                    <Can permission="payroll_legal_parameters.index.delete">
                        <EmployeeFormSection title="Eliminar tramo">
                            <p className="text-[12.5px]" style={{ color: 'var(--emp-muted)' }}>
                                Si hay nóminas aprobadas o pagadas liquidadas dentro de este rango, el servidor rechaza
                                el borrado: en ese caso cierra su vigencia con una fecha de fin y crea un tramo nuevo.
                            </p>
                            <button
                                type="button"
                                onClick={() => setConfirmDelete(true)}
                                className="emp-btn emp-btn-danger mt-2.5"
                            >
                                <Trash size={15} />
                                Eliminar tramo
                            </button>
                        </EmployeeFormSection>
                    </Can>
                </EmployeeFormLayout>
            </form>

            <ConfirmDialog
                open={confirmDelete}
                onClose={() => setConfirmDelete(false)}
                onConfirm={() => {
                    router.delete(route('payroll-legal-parameters.destroy', parameter.id), {
                        onFinish: () => setConfirmDelete(false),
                    });
                }}
                title="Eliminar tramo"
                message={`Se elimina el tramo desde el ${formatDate(parameter.effective_from)}. Si había nóminas liquidadas dentro del rango, el servidor lo rechaza.`}
                confirmText="Eliminar"
                variant="danger"
            />
        </AppLayout>
    );
}
