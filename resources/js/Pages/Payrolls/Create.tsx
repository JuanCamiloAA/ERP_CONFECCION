import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { CalendarBlank, CheckCircle, Clock, CurrencyDollar, Receipt, Sparkle, X } from '@phosphor-icons/react';
import { FormEvent, useMemo } from 'react';
import { EmployeeAsideCard } from '@/Components/Employees/EmployeeFormLayout';
import AppLayout from '@/Layouts/AppLayout';
import { nextAction } from '@/lib/payrolls';
import { formatDate } from '@/lib/utils';
import '../../../css/module-ui.css';

interface Suggestion {
    type: string;
    name: string;
    period_start: string;
    period_end: string;
}

interface ExistingPeriod {
    id: number;
    name: string;
    period_start: string;
    period_end: string;
    type: string;
}

interface Props {
    defaultPayrollType: string;
    suggestions: Record<string, Suggestion>;
    lastPeriod: { name: string; period_end: string | null; type: string } | null;
    existingPeriods: ExistingPeriod[];
}

const STEPS = [
    { title: 'Borrador', hint: 'El periodo queda creado y vacío; todavía no se liquida nada.' },
    { title: 'Calculada', hint: nextAction('borrador').hint },
    { title: 'Aprobada', hint: nextAction('calculado').hint },
    { title: 'Pagada', hint: nextAction('aprobado').hint },
];

const INPUTS = [
    { icon: Clock, text: 'Producción confirmada y pendiente del periodo.' },
    { icon: CalendarBlank, text: 'Jornadas cerradas o ajustadas, y los festivos del calendario.' },
    { icon: CurrencyDollar, text: 'Anticipos con saldo por descontar.' },
    { icon: Receipt, text: 'Parámetros legales vigentes en las fechas del periodo.' },
];

export default function PayrollCreate({ defaultPayrollType, suggestions, lastPeriod, existingPeriods }: Props) {
    const page = usePage<App.PageProps>();
    const payrollPeriodicities = page.props.payrollPeriodicities ?? [];

    const initialType = useMemo(() => {
        if (payrollPeriodicities.some((p) => p.code === defaultPayrollType)) {
            return defaultPayrollType;
        }

        return payrollPeriodicities[0]?.code ?? defaultPayrollType;
    }, [defaultPayrollType, payrollPeriodicities]);

    const { data, setData, post, processing, errors } = useForm({
        name: suggestions[initialType]?.name ?? '',
        period_start: '',
        period_end: '',
        type: initialType,
        notes: '',
    });

    const suggestion = suggestions[data.type] ?? null;

    /** El rango invertido lo rechaza el servidor; avisarlo aquí evita rehacer el formulario. */
    const rangeError =
        data.period_start && data.period_end && data.period_end < data.period_start
            ? 'La fecha final debe ser posterior a la inicial.'
            : null;

    /** Mismo criterio de solape que `StorePayrollRequest`: solo cuenta la misma periodicidad. */
    const overlap = useMemo(() => {
        if (! data.period_start || ! data.period_end || rangeError) return null;

        return (
            existingPeriods.find(
                (period) =>
                    period.type === data.type &&
                    period.period_start <= data.period_end &&
                    period.period_end >= data.period_start,
            ) ?? null
        );
    }, [existingPeriods, data.period_start, data.period_end, data.type, rangeError]);

    const applySuggestion = () => {
        if (! suggestion) return;
        setData((current) => ({
            ...current,
            name: suggestion.name,
            period_start: suggestion.period_start,
            period_end: suggestion.period_end,
        }));
    };

    const submit = (e: FormEvent) => {
        e.preventDefault();
        if (rangeError) return;
        post(route('payrolls.store'));
    };

    return (
        <AppLayout title="Nueva nómina">
            <Head title="Nueva nómina" />

            <form
                onSubmit={submit}
                className="emp-form -m-4 min-h-screen px-4 pb-28 pt-5 sm:-m-6 sm:px-[34px] sm:pb-8 lg:-m-8 lg:pb-8"
            >
                {/* -------------------------------------------------- cabecera */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                        <Link
                            href={route('payrolls.index')}
                            className="emp-kicker inline-flex items-center gap-1.5 hover:underline"
                        >
                            <X size={13} />
                            Nómina
                        </Link>
                        <h1 className="mt-1 text-[24px]" style={{ color: 'var(--emp-text)' }}>
                            Nueva nómina
                        </h1>
                        <p className="mt-1 max-w-[560px] text-[13px]" style={{ color: 'var(--emp-muted)' }}>
                            Se crea en borrador. El cálculo se hace después, cuando la producción y las jornadas del
                            periodo ya están cerradas.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 max-sm:hidden">
                        <Link href={route('payrolls.index')} className="emp-btn emp-btn-sm">
                            Cancelar
                        </Link>
                        <button type="submit" disabled={processing} className="emp-btn emp-btn-sm emp-btn-primary">
                            {processing ? 'Creando…' : 'Crear borrador'}
                        </button>
                    </div>
                </div>

                <div className="mt-5 flex flex-col items-start gap-6 lg:flex-row lg:gap-[26px]">
                    {/* ---------------------------------------------- formulario */}
                    <section className="emp-card w-full min-w-0 flex-1 p-[20px_22px]">
                        <p className="emp-kicker">Datos del periodo</p>

                        {suggestion ? (
                            <div className="emp-note mt-3 flex flex-wrap items-center justify-between gap-2">
                                <span className="min-w-0">
                                    {lastPeriod?.period_end
                                        ? `La última nómina cerró el ${formatDate(lastPeriod.period_end)}. `
                                        : 'Todavía no hay nóminas registradas. '}
                                    Con periodicidad {data.type} el siguiente periodo va del{' '}
                                    {formatDate(suggestion.period_start)} al {formatDate(suggestion.period_end)}.
                                </span>
                                <button
                                    type="button"
                                    onClick={applySuggestion}
                                    className="emp-btn emp-btn-sm emp-btn-primary shrink-0"
                                >
                                    <Sparkle size={14} />
                                    Usar periodo sugerido
                                </button>
                            </div>
                        ) : null}

                        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div className="sm:col-span-2">
                                <label className="emp-label" htmlFor="payroll-name">
                                    Nombre <span className="emp-req">*</span>
                                </label>
                                <input
                                    id="payroll-name"
                                    value={data.name}
                                    onChange={(e) => setData('name', e.target.value)}
                                    className={`emp-field ${errors.name ? 'emp-field-error' : ''}`}
                                    required
                                />
                                {errors.name ? <p className="emp-error">{errors.name}</p> : null}
                                <p className="emp-help">
                                    Aparece en el listado, en los comprobantes y en el reporte de nómina.
                                </p>
                            </div>

                            <div>
                                <label className="emp-label" htmlFor="payroll-start">
                                    Fecha inicio <span className="emp-req">*</span>
                                </label>
                                <input
                                    id="payroll-start"
                                    type="date"
                                    value={data.period_start}
                                    onChange={(e) => setData('period_start', e.target.value)}
                                    className={`emp-field ${errors.period_start ? 'emp-field-error' : ''}`}
                                    required
                                />
                                {errors.period_start ? <p className="emp-error">{errors.period_start}</p> : null}
                            </div>

                            <div>
                                <label className="emp-label" htmlFor="payroll-end">
                                    Fecha fin <span className="emp-req">*</span>
                                </label>
                                <input
                                    id="payroll-end"
                                    type="date"
                                    value={data.period_end}
                                    onChange={(e) => setData('period_end', e.target.value)}
                                    className={`emp-field ${errors.period_end || rangeError ? 'emp-field-error' : ''}`}
                                    required
                                />
                                {rangeError ? <p className="emp-error">{rangeError}</p> : null}
                                {! rangeError && errors.period_end ? <p className="emp-error">{errors.period_end}</p> : null}
                            </div>

                            <div className="sm:col-span-2">
                                <span className="emp-label">Periodicidad</span>
                                <div className="emp-seg sm:max-w-[420px]">
                                    {payrollPeriodicities.map((periodicity) => (
                                        <button
                                            key={periodicity.code}
                                            type="button"
                                            onClick={() => setData('type', periodicity.code)}
                                            className={`emp-seg-item ${data.type === periodicity.code ? 'emp-seg-on' : ''}`}
                                        >
                                            {periodicity.name}
                                        </button>
                                    ))}
                                </div>
                                {errors.type ? <p className="emp-error">{errors.type}</p> : null}
                                <p className="emp-help">
                                    Las periodicidades se administran en el catálogo{' '}
                                    <Link
                                        href={route('payroll-periodicities.index')}
                                        className="underline underline-offset-2"
                                        style={{ color: 'var(--emp-accent-on)' }}
                                    >
                                        Periodicidades de nómina
                                    </Link>
                                    .
                                </p>
                            </div>

                            <div className="sm:col-span-2">
                                <label className="emp-label" htmlFor="payroll-notes">
                                    Notas
                                </label>
                                <textarea
                                    id="payroll-notes"
                                    rows={3}
                                    value={data.notes}
                                    onChange={(e) => setData('notes', e.target.value)}
                                    className="emp-field"
                                />
                                {errors.notes ? <p className="emp-error">{errors.notes}</p> : null}
                            </div>
                        </div>

                        {overlap ? (
                            <div className="emp-note mt-4" style={{ borderLeftColor: 'var(--emp-danger)' }}>
                                <span style={{ color: 'var(--emp-danger)' }}>
                                    Ya existe «{overlap.name}» ({formatDate(overlap.period_start)} –{' '}
                                    {formatDate(overlap.period_end)}) que cubre parte de este rango con la misma
                                    periodicidad. El servidor rechazará el periodo solapado.
                                </span>
                            </div>
                        ) : null}
                    </section>

                    {/* --------------------------------------------------- aside */}
                    <aside className="flex w-full flex-col gap-4 lg:w-[340px] lg:shrink-0">
                        <EmployeeAsideCard title="Qué pasa después">
                            <ol className="mt-2.5 flex flex-col gap-2.5">
                                {STEPS.map((step, index) => (
                                    <li key={step.title} className="flex gap-2.5">
                                        <span
                                            aria-hidden="true"
                                            className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-[11px]"
                                            style={{
                                                backgroundColor: 'var(--emp-accent-fill)',
                                                color: 'var(--emp-accent-on)',
                                            }}
                                        >
                                            {index + 1}
                                        </span>
                                        <span className="min-w-0">
                                            <span className="block text-[12.5px]" style={{ color: 'var(--emp-text)' }}>
                                                {step.title}
                                            </span>
                                            <span className="block text-[11.5px]" style={{ color: 'var(--emp-subtle)' }}>
                                                {step.hint}
                                            </span>
                                        </span>
                                    </li>
                                ))}
                            </ol>
                        </EmployeeAsideCard>

                        <EmployeeAsideCard title="Qué entra en el cálculo">
                            <ul className="mt-2.5 flex flex-col gap-2">
                                {INPUTS.map((input) => (
                                    <li key={input.text} className="flex items-start gap-2">
                                        <input.icon
                                            size={15}
                                            className="mt-0.5 shrink-0"
                                            style={{ color: 'var(--emp-accent-on)' }}
                                        />
                                        <span className="text-[12px]" style={{ color: 'var(--emp-muted)' }}>
                                            {input.text}
                                        </span>
                                    </li>
                                ))}
                                <li className="flex items-start gap-2">
                                    <CheckCircle size={15} className="mt-0.5 shrink-0" style={{ color: 'var(--emp-ok)' }} />
                                    <span className="text-[12px]" style={{ color: 'var(--emp-muted)' }}>
                                        Nada de esto se toca al crear el borrador: el periodo solo reserva las fechas.
                                    </span>
                                </li>
                            </ul>
                        </EmployeeAsideCard>
                    </aside>
                </div>

                {/* Movil: crear siempre a mano. */}
                <div
                    className="fixed inset-x-0 bottom-0 z-30 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:hidden"
                    style={{ backgroundColor: 'var(--emp-bar)', borderTop: '1px solid var(--emp-border)' }}
                >
                    <button type="submit" disabled={processing} className="emp-btn emp-btn-primary w-full">
                        {processing ? 'Creando…' : 'Crear borrador'}
                    </button>
                </div>
            </form>
        </AppLayout>
    );
}
