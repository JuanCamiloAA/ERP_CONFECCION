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
import { formatCurrency, formatDate, formatNumber } from '@/lib/utils';
import type { Operation } from '@/types';
import '../../../css/module-ui.css';

interface Props {
    operation: Operation & { references_count?: number; productions_count?: number };
    usage?: { units_month: number; last_production_at: string | null };
}

export default function OperationEdit({ operation, usage }: Props) {
    const thresholds = usePage<App.PageProps>().props.difficultyMinuteThresholds ?? DEFAULT_DIFFICULTY_MINUTE_THRESHOLDS;

    const { data, setData, put, processing, errors } = useForm({
        name: operation.name,
        description: operation.description ?? '',
        base_price: String(operation.base_price ?? ''),
        estimated_minutes: String(operation.estimated_minutes ?? ''),
        is_active: operation.is_active,
    });

    const minutes = useMemo(() => {
        const value = Number(data.estimated_minutes);

        return data.estimated_minutes !== '' && Number.isFinite(value) && value > 0 ? value : null;
    }, [data.estimated_minutes]);

    const level = minutes !== null ? levelFromMinutes(minutes, thresholds) : null;

    const perMinute = useMemo(() => {
        const price = Number(data.base_price);
        if (!minutes || !Number.isFinite(price) || price <= 0) return null;

        return price / minutes;
    }, [data.base_price, minutes]);

    const submit = (e: FormEvent) => {
        e.preventDefault();
        put(route('operations.update', operation.id));
    };

    const references = operation.references_count ?? 0;
    const productions = operation.productions_count ?? 0;

    const header = (
        <header
            className="sticky top-0 z-30 px-4 py-3 sm:px-[34px] sm:py-4"
            style={{ backgroundColor: 'var(--emp-bar)', borderBottom: '1px solid var(--emp-border)' }}
        >
            <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                    <p className="emp-kicker">Operaciones · Editar</p>
                    <h1 className="mt-0.5 truncate text-[20px]" style={{ color: 'var(--emp-text)' }}>
                        {operation.name}
                    </h1>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span className={operation.is_active ? 'emp-pill' : 'emp-pill emp-pill-warn'}>
                            {operation.is_active ? 'Activa' : 'Inactiva'}
                        </span>
                        <span className="emp-pill">
                            {references === 0 && productions === 0
                                ? 'Sin uso todavía'
                                : `${formatNumber(references)} ${references === 1 ? 'referencia' : 'referencias'}${
                                      usage?.units_month ? ` · ${formatNumber(usage.units_month)} u este mes` : ''
                                  }`}
                        </span>
                    </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                    <Link href={route('operations.show', operation.id)} className="emp-btn emp-btn-ghost max-sm:hidden">
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

            <OperationAsideCard title="Uso">
                <dl className="mt-2 flex flex-col gap-1.5 text-[12px]">
                    {[
                        ['Referencias', formatNumber(references)],
                        ['Registros de producción', formatNumber(productions)],
                        ['Último registro', usage?.last_production_at ? formatDate(usage.last_production_at) : '—'],
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
        </>
    );

    return (
        <AppLayout title="Editar operación">
            <Head title={`Editar ${operation.name}`} />

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
                                    {level !== operation.difficulty_level
                                        ? ` Hoy está guardada como ${difficultyLabel(operation.difficulty_level)}; al guardar cambia.`
                                        : level < 5
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
