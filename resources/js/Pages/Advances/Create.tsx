import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowLeft, CaretDown, Check } from '@phosphor-icons/react';
import { FormEvent, useMemo } from 'react';
import {
    AdvanceHistoryCard,
    AdvanceImpactCard,
    RISKY_SHARE,
    type AdvanceEmployeeContext,
} from '@/Components/Advances/AdvanceImpactCard';
import {
    EmployeeAsideCard,
    EmployeeFormLayout,
    EmployeeFormNav,
    type EmployeeSectionRef,
} from '@/Components/Employees/EmployeeFormLayout';
import { EmployeeFormSection } from '@/Components/Employees/EmployeeFormSection';
import { EmpInput, EmpTextarea } from '@/Components/UI/ModuleFields';
import AppLayout from '@/Layouts/AppLayout';
import { formatCurrency, formatDate } from '@/lib/utils';
import '../../../css/module-ui.css';

export const ADVANCE_SECTIONS: EmployeeSectionRef[] = [
    { id: 'quien', label: 'A quién' },
    { id: 'cuanto', label: 'Cuánto y cuándo' },
    { id: 'motivo', label: 'Motivo' },
];

/** Montos que se piden una y otra vez; ahorran teclear en el celular. */
const QUICK_AMOUNTS = [100000, 200000, 300000];

const QUICK_REASONS = ['Salud', 'Imprevisto familiar', 'Servicios públicos', 'Educación'];

interface Props {
    employees: AdvanceEmployeeContext[];
    period: { start: string | null; end: string | null; payroll_date: string | null; payroll_name: string | null };
}

export default function AdvanceCreate({ employees, period }: Props) {
    const { data, setData, post, processing, errors } = useForm({
        employee_id: '' as number | '',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        reason: '',
    });

    const employee = useMemo(
        () => employees.find((e) => String(e.id) === String(data.employee_id)) ?? null,
        [employees, data.employee_id],
    );

    const amount = useMemo(() => {
        const value = Number(data.amount);

        return Number.isFinite(value) && value > 0 ? value : 0;
    }, [data.amount]);

    const previous = employee?.pending_balance ?? 0;
    const totalToDiscount = previous + amount;
    const avgNet = employee?.avg_net ?? 0;
    const net = Math.max(0, avgNet - totalToDiscount);
    const share = avgNet > 0 ? totalToDiscount / avgNet : 0;
    const risky = avgNet > 0 && share > RISKY_SHARE;

    const submit = (e: FormEvent) => {
        e.preventDefault();
        post(route('advances.store'));
    };

    const periodLabel =
        period.start && period.end ? `${formatDate(period.start)} al ${formatDate(period.end)}` : null;

    const header = (
        <header
            className="sticky top-0 z-30 px-4 py-3 sm:px-[34px] sm:py-4"
            style={{ backgroundColor: 'var(--emp-bar)', borderBottom: '1px solid var(--emp-border)' }}
        >
            <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                    <p className="emp-kicker">Anticipos · Nuevo</p>
                    <h1 className="mt-0.5 text-[20px]" style={{ color: 'var(--emp-text)' }}>
                        Nuevo anticipo
                    </h1>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span className="emp-pill">
                            {period.payroll_date
                                ? `Se descuenta en la nómina del ${formatDate(period.payroll_date)}`
                                : 'Se descuenta en la próxima nómina que se genere'}
                        </span>
                        <span className="emp-pill">Queda pendiente hasta cubrirse</span>
                    </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                    <Link href={route('advances.index')} className="emp-btn emp-btn-ghost max-sm:hidden">
                        <ArrowLeft size={15} />
                        Cancelar
                    </Link>
                    <button type="submit" disabled={processing} className="emp-btn emp-btn-primary">
                        <Check size={15} />
                        {processing ? 'Guardando…' : 'Registrar anticipo'}
                    </button>
                </div>
            </div>
        </header>
    );

    const aside = (
        <>
            <AdvanceImpactCard employee={employee} amount={amount} period={period} />
            <AdvanceHistoryCard employee={employee} />
        </>
    );

    const mobileBar = (
        <div className="px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <div className="flex gap-2">
                <Link href={route('advances.index')} className="emp-btn flex-1">
                    Cancelar
                </Link>
                <button type="submit" disabled={processing} className="emp-btn emp-btn-primary flex-[2]">
                    {processing ? 'Guardando…' : 'Registrar anticipo'}
                </button>
            </div>
        </div>
    );

    return (
        <AppLayout title="Nuevo anticipo">
            <Head title="Nuevo anticipo" />

            <form onSubmit={submit}>
                <EmployeeFormLayout
                    header={header}
                    nav={<EmployeeFormNav sections={ADVANCE_SECTIONS} />}
                    aside={aside}
                    mobileBar={mobileBar}
                >
                    {/* ------------------------------------------------ a quien */}
                    <EmployeeFormSection id="quien" step={1} title="A quién" requirement="required">
                        <div className="min-w-0 sm:max-w-[420px]">
                            <label className="emp-label" htmlFor="advance-employee">
                                Empleado <span className="emp-req">*</span>
                            </label>
                            <div className="relative">
                                <select
                                    id="advance-employee"
                                    value={data.employee_id}
                                    onChange={(e) => setData('employee_id', e.target.value === '' ? '' : Number(e.target.value))}
                                    required
                                    className={`emp-field ${errors.employee_id ? 'emp-field-error' : ''}`}
                                >
                                    <option value="">Selecciona empleado</option>
                                    {employees.map((e) => (
                                        <option key={e.id} value={e.id}>
                                            {e.first_name} {e.last_name} · CC {e.document_number}
                                        </option>
                                    ))}
                                </select>
                                <CaretDown
                                    size={13}
                                    className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2"
                                    style={{ color: 'var(--emp-subtle)' }}
                                />
                            </div>
                            <p className="emp-help">
                                Solo empleados activos. El anticipo se descuenta de su nómina, no de la caja general.
                            </p>
                            {errors.employee_id ? <p className="emp-error">{errors.employee_id}</p> : null}
                        </div>
                    </EmployeeFormSection>

                    {/* ------------------------------------------ cuanto/cuando */}
                    <EmployeeFormSection id="cuanto" step={2} title="Cuánto y cuándo" requirement="required">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div className="min-w-0">
                                <EmpInput
                                    label="Monto"
                                    type="number"
                                    step="0.01"
                                    min={1}
                                    prefix="$"
                                    required
                                    value={data.amount}
                                    onChange={(e) => setData('amount', e.target.value)}
                                    error={errors.amount}
                                />
                                <div className="mt-1.5 flex flex-wrap gap-1.5">
                                    {QUICK_AMOUNTS.map((value) => (
                                        <button
                                            key={value}
                                            type="button"
                                            onClick={() => setData('amount', String(value))}
                                            className="emp-pill"
                                            style={{ height: '26px', cursor: 'pointer' }}
                                        >
                                            {formatCurrency(value)}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <EmpInput
                                label="Fecha de entrega"
                                type="date"
                                required
                                value={data.date}
                                onChange={(e) => setData('date', e.target.value)}
                                error={errors.date}
                                help={periodLabel ? `Cae en el periodo del ${periodLabel}.` : 'Aún no hay una nómina abierta.'}
                            />
                        </div>

                        {/* Nota viva: dice lo que pasa con el pago, no solo lo que se entrega. */}
                        <p
                            className="emp-note mt-3"
                            style={
                                risky
                                    ? {
                                          borderLeftColor: 'var(--emp-danger)',
                                          backgroundColor: 'color-mix(in srgb, var(--emp-danger) 8%, transparent)',
                                          color: 'var(--emp-danger)',
                                      }
                                    : undefined
                            }
                        >
                            {!employee || amount <= 0 ? (
                                'Escribe el monto y aquí ves cuánto le queda de neto al empleado en la próxima nómina.'
                            ) : avgNet <= 0 ? (
                                <>
                                    {formatCurrency(amount)} se suman al saldo de {formatCurrency(previous)}. En la próxima
                                    nómina se descuentan {formatCurrency(totalToDiscount)}; todavía no hay periodos pagados
                                    para estimar el neto.
                                </>
                            ) : risky ? (
                                <>
                                    {formatCurrency(amount)} se suman al saldo de {formatCurrency(previous)}. Los{' '}
                                    {formatCurrency(totalToDiscount)} dejan un neto de {formatCurrency(net)}: el{' '}
                                    {Math.round(share * 100)}% del pago. Considera partirlo en dos periodos.
                                </>
                            ) : (
                                <>
                                    {formatCurrency(amount)} se suman al saldo de {formatCurrency(previous)}. En la próxima
                                    nómina se descuentan {formatCurrency(totalToDiscount)} y el neto queda en{' '}
                                    {formatCurrency(net)}.
                                </>
                            )}
                        </p>
                    </EmployeeFormSection>

                    {/* ------------------------------------------------- motivo */}
                    <EmployeeFormSection id="motivo" step={3} title="Motivo" requirement="required">
                        <div className="mb-2 flex flex-wrap gap-1.5">
                            {QUICK_REASONS.map((reason) => (
                                <button
                                    key={reason}
                                    type="button"
                                    onClick={() => setData('reason', reason)}
                                    className="emp-pill"
                                    style={{ height: '26px', cursor: 'pointer' }}
                                >
                                    {reason}
                                </button>
                            ))}
                        </div>

                        <EmpTextarea
                            label="Motivo"
                            rows={3}
                            required
                            value={data.reason}
                            onChange={(e) => setData('reason', e.target.value)}
                            error={errors.reason}
                            help="Queda en el recibo de nómina del empleado."
                        />
                    </EmployeeFormSection>

                    {/* En tableta el panel baja aquí; en móvil también, antes de la barra. */}
                    <div className="lg:hidden">
                        <EmployeeAsideCard title="Resumen">
                            <p className="mt-2 text-[12px]" style={{ color: 'var(--emp-muted)' }}>
                                {employee
                                    ? `${employee.first_name} ${employee.last_name} · total a descontar ${formatCurrency(totalToDiscount)}`
                                    : 'Elige un empleado para ver el efecto en su nómina.'}
                            </p>
                        </EmployeeAsideCard>
                    </div>
                </EmployeeFormLayout>
            </form>
        </AppLayout>
    );
}
