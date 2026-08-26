import { Head, Link, router, useForm } from '@inertiajs/react';
import { ArrowLeft, Check, CheckCircle, Circle, MagicWand, Trash } from '@phosphor-icons/react';
import { useState, type FormEvent } from 'react';
import { CatalogFormLayout } from '@/Components/Catalog/CatalogFormLayout';
import { CatalogOrderField, type CatalogSibling } from '@/Components/Catalog/CatalogOrderField';
import { CatalogPreviewCard } from '@/Components/Catalog/CatalogPreviewCard';
import { CatalogUsageCard, type CatalogUsage } from '@/Components/Catalog/CatalogUsageCard';
import { EmployeeAsideCard } from '@/Components/Employees/EmployeeFormLayout';
import { EmployeeFormSection } from '@/Components/Employees/EmployeeFormSection';
import { Can } from '@/Components/UI/Can';
import { ConfirmDialog } from '@/Components/UI/ConfirmDialog';
import { EmpInput, EmpSwitch, EmpTextarea } from '@/Components/UI/ModuleFields';
import AppLayout from '@/Layouts/AppLayout';
import { sanitizeConceptCode, suggestConceptCode } from '@/lib/catalog';
import { formatNumber } from '@/lib/utils';
import '../../../css/module-ui.css';

interface ConceptProp {
    id: number;
    name: string;
    code: string | null;
    description: string | null;
    is_active: boolean;
    sort_order: number;
}

interface Props {
    concept: ConceptProp;
    siblings: CatalogSibling[];
    usage: CatalogUsage;
}

export default function PayrollConceptEdit({ concept, siblings, usage }: Props) {
    const initialPosition = Math.max(0, siblings.findIndex((sibling) => sibling.id === concept.id));
    const [position, setPosition] = useState(initialPosition);
    const [confirmDelete, setConfirmDelete] = useState(false);

    const { data, setData, put, processing, errors } = useForm({
        name: concept.name,
        code: concept.code ?? '',
        description: concept.description ?? '',
        is_active: concept.is_active,
        sort_order: initialPosition,
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        put(route('payroll-concepts.update', concept.id));
    };

    const movePosition = (next: number) => {
        setPosition(next);
        setData('sort_order', next);
    };

    const blocked = usage.count > 0;

    const header = (
        <header
            className="sticky top-0 z-30 px-4 py-3 sm:px-[34px] sm:py-4"
            style={{ backgroundColor: 'var(--emp-bar)', borderBottom: '1px solid var(--emp-border)' }}
        >
            <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                    <p className="emp-kicker">Conceptos de nómina · Editar</p>
                    <h1 className="mt-0.5 truncate text-[20px]" style={{ color: 'var(--emp-text)' }}>
                        {concept.name}
                    </h1>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                        <span className="emp-pill">Ajuste positivo en nómina</span>
                        <span className={`emp-pill ${data.is_active ? '' : 'emp-pill-warn'}`}>
                            {data.is_active ? 'Activo' : 'Inactivo'}
                        </span>
                    </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                    <Link href={route('payroll-concepts.index')} className="emp-btn emp-btn-ghost max-sm:hidden">
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

    const checklist = [
        { label: 'Nombre', ok: data.name.trim().length > 0, value: data.name.trim() },
        { label: 'Descripción (recomendada)', ok: data.description.trim().length > 0, value: '' },
        { label: `Queda en la posición ${position + 1} de la lista`, ok: true, value: '' },
    ];

    const aside = (
        <>
            <CatalogPreviewCard
                subtitle="Selector de concepto al agregar un ajuste en la nómina"
                siblings={siblings}
                currentId={concept.id}
                currentName={data.name}
                position={position}
            />

            <CatalogUsageCard
                usage={usage}
                countLabel="Nóminas con este concepto"
                totalLabel={`Total pagado en ${new Date().getFullYear()}`}
                lastLabel="Último uso"
            />

            <EmployeeAsideCard title="Antes de guardar">
                <ul className="mt-2 flex flex-col gap-1.5">
                    {checklist.map((item) => (
                        <li key={item.label} className="flex items-start gap-2 text-[12px]">
                            {item.ok ? (
                                <CheckCircle size={15} weight="fill" style={{ color: 'var(--emp-ok)', flexShrink: 0 }} />
                            ) : (
                                <Circle size={15} style={{ color: 'var(--emp-faint)', flexShrink: 0 }} />
                            )}
                            <span className="min-w-0">
                                <span className="block" style={{ color: 'var(--emp-text)' }}>
                                    {item.label}
                                </span>
                                {item.value ? (
                                    <span className="block truncate" style={{ color: 'var(--emp-subtle)' }}>
                                        {item.value}
                                    </span>
                                ) : null}
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
                <Link href={route('payroll-concepts.index')} className="emp-btn flex-1">
                    Cancelar
                </Link>
                <button type="submit" disabled={processing} className="emp-btn emp-btn-primary flex-[2]">
                    {processing ? 'Guardando…' : 'Guardar cambios'}
                </button>
            </div>
        </div>
    );

    return (
        <AppLayout title={`Editar: ${concept.name}`}>
            <Head title={`Editar concepto: ${concept.name}`} />

            <form onSubmit={submit}>
                <CatalogFormLayout header={header} aside={aside} mobileBar={mobileBar}>
                    <EmployeeFormSection id="identidad" step={1} title="Identidad" requirement="required">
                        <div className="sm:max-w-[420px]">
                            <EmpInput
                                label="Nombre"
                                required
                                value={data.name}
                                onChange={(e) => setData('name', e.target.value)}
                                error={errors.name}
                                help="Es el texto que verá quien agregue el ajuste dentro de una nómina."
                            />
                        </div>

                        <div className="mt-3 flex items-end gap-2 sm:max-w-[420px]">
                            <div className="min-w-0 flex-1">
                                <EmpInput
                                    label="Código"
                                    value={data.code}
                                    onChange={(e) => setData('code', sanitizeConceptCode(e.target.value))}
                                    error={errors.code}
                                    help="Opcional, para cruzar con la contabilidad."
                                />
                            </div>
                            <button
                                type="button"
                                onClick={() => setData('code', suggestConceptCode(data.name))}
                                disabled={data.name.trim().length === 0}
                                className="emp-btn shrink-0 disabled:opacity-45"
                                style={{ marginBottom: '22px' }}
                            >
                                <MagicWand size={15} />
                                Sugerir
                            </button>
                        </div>

                        <div className="mt-3">
                            <EmpTextarea
                                label="Descripción"
                                rows={3}
                                value={data.description}
                                onChange={(e) => setData('description', e.target.value)}
                                error={errors.description}
                                help="Se lee al elegir en el formulario: dice qué entra y qué no entra aquí."
                            />
                        </div>
                    </EmployeeFormSection>

                    <EmployeeFormSection id="disponibilidad" step={2} title="Disponibilidad y orden" requirement="optional">
                        <div
                            className="rounded-[12px] px-3"
                            style={{ border: '1px solid var(--emp-border)', backgroundColor: 'var(--emp-field-alt)' }}
                        >
                            <EmpSwitch
                                checked={data.is_active}
                                onChange={(value) => setData('is_active', value)}
                                label="Activo"
                                description={
                                    data.is_active
                                        ? 'Aparece al agregar un ajuste en una nómina.'
                                        : 'No aparece al agregar ajustes; las nóminas ya liquidadas no cambian.'
                                }
                            />
                        </div>

                        <div className="mt-3">
                            <label className="emp-label">Orden en la lista</label>
                            <CatalogOrderField
                                siblings={siblings}
                                currentId={concept.id}
                                currentName={data.name}
                                position={position}
                                onChange={movePosition}
                            />
                        </div>
                        {errors.sort_order ? <p className="emp-error">{errors.sort_order}</p> : null}
                    </EmployeeFormSection>

                    <Can permission="payroll_concepts.index.delete">
                        <EmployeeFormSection title="Eliminar concepto">
                            <p className="text-[12.5px]" style={{ color: 'var(--emp-muted)' }}>
                                {blocked ? (
                                    <>
                                        No se puede eliminar: el concepto tiene {formatNumber(usage.count)}{' '}
                                        {usage.count === 1 ? 'ajuste' : 'ajustes'} en nóminas. Desactívalo para que deje
                                        de aparecer sin tocar lo ya liquidado.
                                    </>
                                ) : (
                                    <>
                                        No tiene ajustes en nóminas, así que se puede eliminar del catálogo. La acción no
                                        se puede deshacer.
                                    </>
                                )}
                            </p>
                            <button
                                type="button"
                                onClick={() => setConfirmDelete(true)}
                                disabled={blocked}
                                className="emp-btn emp-btn-danger mt-2.5 disabled:opacity-45"
                            >
                                <Trash size={15} />
                                Eliminar concepto
                            </button>
                        </EmployeeFormSection>
                    </Can>
                </CatalogFormLayout>
            </form>

            <ConfirmDialog
                open={confirmDelete}
                onClose={() => setConfirmDelete(false)}
                onConfirm={() => {
                    router.delete(route('payroll-concepts.destroy', concept.id), {
                        onFinish: () => setConfirmDelete(false),
                    });
                }}
                title="Eliminar concepto"
                message={`Se elimina «${concept.name}» del catálogo. Solo es posible porque no tiene ajustes en nóminas.`}
                confirmText="Eliminar"
                variant="danger"
            />
        </AppLayout>
    );
}
