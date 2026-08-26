import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { ArrowLeft, Check } from '@phosphor-icons/react';
import { FormEvent, useMemo } from 'react';
import { EmployeeFormSection } from '@/Components/Employees/EmployeeFormSection';
import { OperationDifficultyCard } from '@/Components/Operations/OperationDifficultyCard';
import {
    OPERATION_SECTIONS,
    OperationAsideCard,
    OperationFormLayout,
    OperationFormNav,
} from '@/Components/Operations/OperationFormLayout';
import { EmpInput, EmpSwitch, EmpTextarea } from '@/Components/UI/ModuleFields';
import AppLayout from '@/Layouts/AppLayout';
import { DEFAULT_DIFFICULTY_MINUTE_THRESHOLDS, difficultyLabel, levelFromMinutes } from '@/lib/difficulty';
import { formatCurrency, formatNumber } from '@/lib/utils';
import '../../../css/module-ui.css';

export default function OperationCreate() {
    const thresholds = usePage<App.PageProps>().props.difficultyMinuteThresholds ?? DEFAULT_DIFFICULTY_MINUTE_THRESHOLDS;

    const { data, setData, post, processing, errors } = useForm({
        name: '',
        description: '',
        base_price: '',
        estimated_minutes: '',
        is_active: true,
    });

    const minutes = useMemo(() => {
        const value = Number(data.estimated_minutes);

        return data.estimated_minutes !== '' && Number.isFinite(value) && value > 0 ? value : null;
    }, [data.estimated_minutes]);

    const level = minutes !== null ? levelFromMinutes(minutes, thresholds) : null;

    /** Pago por minuto: la cifra que hace comparable una operacion con otra. */
    const perMinute = useMemo(() => {
        const price = Number(data.base_price);
        if (!minutes || !Number.isFinite(price) || price <= 0) return null;

        return price / minutes;
    }, [data.base_price, minutes]);

    const submit = (e: FormEvent) => {
        e.preventDefault();
        post(route('operations.store'));
    };

    const header = (
        <header
            className="sticky top-0 z-30 px-4 py-3 sm:px-[34px] sm:py-4"
            style={{ backgroundColor: 'var(--emp-bar)', borderBottom: '1px solid var(--emp-border)' }}
        >
            <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                    <p className="emp-kicker">Operaciones · Nueva</p>
                    <h1 className="mt-0.5 truncate text-[20px]" style={{ color: 'var(--emp-text)' }}>
                        {data.name.trim() || 'Nueva operación'}
                    </h1>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span className="emp-pill">{data.is_active ? 'Se creará activa' : 'Se creará inactiva'}</span>
                        <span className="emp-pill">Sin uso todavía</span>
                    </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                    <Link href={route('operations.index')} className="emp-btn emp-btn-ghost max-sm:hidden">
                        <ArrowLeft size={15} />
                        Cancelar
                    </Link>
                    <button type="submit" disabled={processing} className="emp-btn emp-btn-primary">
                        <Check size={15} />
                        {processing ? 'Guardando…' : 'Guardar'}
                    </button>
                </div>
            </div>
        </header>
    );

    const aside = (
        <>
            <OperationDifficultyCard minutes={minutes} thresholds={thresholds} />

            <OperationAsideCard title="Pago por minuto" subtitle="Sirve para comparar operaciones entre sí">
                <p
                    className="mt-2 text-[27px] leading-none tabular-nums"
                    style={{ color: perMinute ? 'var(--emp-text)' : 'var(--emp-faint)' }}
                >
                    {perMinute ? formatCurrency(perMinute) : '—'}
                </p>
                <p className="mt-1 text-[12px]" style={{ color: 'var(--emp-muted)' }}>
                    {perMinute
                        ? `${formatCurrency(Number(data.base_price))} entre ${formatNumber(minutes ?? 0)} min`
                        : 'Escribe precio y minutos'}
                </p>
            </OperationAsideCard>
        </>
    );

    return (
        <AppLayout title="Nueva operación">
            <Head title="Nueva operación" />

            <form onSubmit={submit}>
                <OperationFormLayout header={header} nav={<OperationFormNav sections={OPERATION_SECTIONS} />} aside={aside}>
                    <EmployeeFormSection id="identidad" step={1} title="Identidad" requirement="required">
                        <div className="flex flex-col gap-3">
                            <EmpInput
                                label="Nombre"
                                required
                                value={data.name}
                                onChange={(e) => setData('name', e.target.value)}
                                error={errors.name}
                                help="Así se ve al registrar producción; el taller la busca por estas palabras."
                            />
                            <EmpTextarea
                                label="Descripción"
                                rows={3}
                                value={data.description}
                                onChange={(e) => setData('description', e.target.value)}
                                error={errors.description}
                            />
                        </div>
                    </EmployeeFormSection>

                    <EmployeeFormSection
                        id="precio"
                        step={2}
                        title="Precio y tiempo"
                        requirement="required"
                        summary={level ? <span className="emp-pill emp-pill-accent">{difficultyLabel(level)}</span> : undefined}
                    >
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <EmpInput
                                label="Precio base"
                                type="number"
                                step="0.01"
                                min={0}
                                prefix="$"
                                required
                                value={data.base_price}
                                onChange={(e) => setData('base_price', e.target.value)}
                                error={errors.base_price}
                                help="Lo que se paga por unidad si la referencia no fija otro precio."
                            />
                            <EmpInput
                                label="Minutos estándar"
                                type="number"
                                step="0.1"
                                min={0.1}
                                required
                                value={data.estimated_minutes}
                                onChange={(e) => setData('estimated_minutes', e.target.value)}
                                error={errors.estimated_minutes}
                                help="Define el grado de dificultad automáticamente."
                            />
                        </div>

                        <p className="emp-note mt-3">
                            {minutes && level ? (
                                <>
                                    {formatNumber(minutes)} min → dificultad <strong>{difficultyLabel(level)}</strong> ({level}).
                                    {level < 5
                                        ? ` Si subes de ${formatNumber(thresholds[level - 1])} min pasa a ${difficultyLabel(level + 1)} y el ranking la pondera más.`
                                        : ' Es el grado más alto del catálogo.'}
                                </>
                            ) : (
                                <>
                                    Escribe los minutos y aquí aparece la dificultad que tendrá. Los cortes del taller son{' '}
                                    {thresholds.map((t) => formatNumber(t)).join(' / ')} min.
                                </>
                            )}
                        </p>
                    </EmployeeFormSection>

                    <EmployeeFormSection id="estado" step={3} title="Disponibilidad" requirement="optional">
                        <div className="emp-card p-[17px]">
                            <EmpSwitch
                                checked={data.is_active}
                                onChange={(v) => setData('is_active', v)}
                                label="Operación activa"
                                description="Las inactivas no se ofrecen al registrar producción ni al armar una referencia; lo ya registrado no cambia."
                            />
                        </div>
                    </EmployeeFormSection>
                </OperationFormLayout>
            </form>
        </AppLayout>
    );
}
