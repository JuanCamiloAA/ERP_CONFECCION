import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowLeft, Check, CheckCircle, Circle, Warning } from '@phosphor-icons/react';
import { useState, type FormEvent } from 'react';
import { EmployeeFormLayout, EmployeeFormNav, EmployeeAsideCard } from '@/Components/Employees/EmployeeFormLayout';
import { LegalCompareCard } from '@/Components/PayrollLegalParameters/LegalCompareCard';
import { LegalSimulationCard } from '@/Components/PayrollLegalParameters/LegalSimulationCard';
import {
    LEGAL_DEFAULTS,
    LEGAL_SECTIONS,
    PayrollLegalParameterFields,
    type PayrollLegalParameterFormData,
} from '@/Components/PayrollLegalParameters/PayrollLegalParameterFields';
import { EmpSwitch } from '@/Components/UI/ModuleFields';
import AppLayout from '@/Layouts/AppLayout';
import { suggestedDivisor, type LegalParameterRow } from '@/lib/legalParameters';
import '../../../css/module-ui.css';

interface Props {
    isSuperAdmin: boolean;
    active: LegalParameterRow | null;
    salaryExample: number;
}

export default function PayrollLegalParameterCreate({ isSuperAdmin, active, salaryExample }: Props) {
    const [salary, setSalary] = useState(String(salaryExample));

    const { data, setData, post, processing, errors } = useForm<PayrollLegalParameterFormData & { is_global: boolean }>({
        is_global: false,
        effective_from: new Date().toISOString().split('T')[0],
        effective_to: '',
        weekly_legal_hours: '42',
        monthly_hours_divisor: '210',
        night_start_time: '19:00',
        night_end_time: '06:00',
        night_surcharge_percent: '35',
        overtime_day_percent: '25',
        overtime_night_percent: '75',
        sunday_holiday_surcharge_percent: '90',
        max_overtime_hours_per_day: '2',
        max_overtime_hours_per_week: '12',
        discount_unexcused_absences: false,
        absence_discount_percent: '100',
        legal_reference: '',
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        post(route('payroll-legal-parameters.store'));
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
                    <p className="emp-kicker">Parámetros legales · Nuevo tramo</p>
                    <h1 className="mt-0.5 text-[20px]" style={{ color: 'var(--emp-text)' }}>
                        Nuevo tramo de vigencia
                    </h1>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                        <span className={`emp-pill ${data.is_global ? '' : 'emp-pill-accent'}`}>
                            {data.is_global ? 'Tramo global' : 'Tramo de esta empresa'}
                        </span>
                        <span className="emp-pill">Aplica a la modalidad por horas</span>
                    </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                    <Link href={route('payroll-legal-parameters.index')} className="emp-btn emp-btn-ghost max-sm:hidden">
                        <ArrowLeft size={15} />
                        Cancelar
                    </Link>
                    <button type="submit" disabled={processing} className="emp-btn emp-btn-primary">
                        <Check size={15} />
                        {processing ? 'Guardando…' : 'Crear tramo'}
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
            {isSuperAdmin ? (
                <EmployeeAsideCard title="Alcance">
                    <div className="mt-1">
                        <EmpSwitch
                            checked={data.is_global}
                            onChange={(value) => setData('is_global', value)}
                            label="Tramo global (default de sistema)"
                            description="Solo super admin. Si lo desactivas, el tramo se crea para la empresa activa."
                        />
                    </div>
                </EmployeeAsideCard>
            ) : null}

            <LegalSimulationCard data={data} salary={salary} onSalaryChange={setSalary} />
            <LegalCompareCard active={active} data={data} salary={Number(salary) || 0} />

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
                    {processing ? 'Guardando…' : 'Crear tramo'}
                </button>
            </div>
        </div>
    );

    return (
        <AppLayout title="Nuevo tramo de parámetros legales">
            <Head title="Nuevo tramo de parámetros legales" />

            <form onSubmit={submit}>
                <EmployeeFormLayout header={header} nav={nav} aside={aside} mobileBar={mobileBar}>
                    <PayrollLegalParameterFields
                        data={data}
                        setData={setData}
                        errors={errors}
                        salary={Number(salary) || 0}
                    />
                </EmployeeFormLayout>
            </form>
        </AppLayout>
    );
}
