import { Head, Link, router, useForm } from '@inertiajs/react';
import { ArrowLeft, Check, CheckCircle, Circle, Trash } from '@phosphor-icons/react';
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
import { formatNumber } from '@/lib/utils';
import '../../../../css/module-ui.css';

interface CategoryProp {
    id: number;
    name: string;
    description: string | null;
    is_active: boolean;
    sort_order: number;
}

interface Props {
    category: CategoryProp;
    siblings: CatalogSibling[];
    usage: CatalogUsage & { count_with_trashed: number; month_total: number };
}

export default function ExpenseCategoryEdit({ category, siblings, usage }: Props) {
    const initialPosition = Math.max(0, siblings.findIndex((sibling) => sibling.id === category.id));
    const [position, setPosition] = useState(initialPosition);
    const [confirmDelete, setConfirmDelete] = useState(false);

    const { data, setData, put, processing, errors } = useForm({
        name: category.name,
        description: category.description ?? '',
        is_active: category.is_active,
        sort_order: initialPosition,
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        put(route('expense-categories.update', category.id));
    };

    const movePosition = (next: number) => {
        setPosition(next);
        setData('sort_order', next);
    };

    // El servidor cuenta tambien los archivados al bloquear el borrado; el boton usa el
    // mismo numero para no prometer algo que va a fallar.
    const blocked = usage.count_with_trashed > 0;

    const header = (
        <header
            className="sticky top-0 z-30 px-4 py-3 sm:px-[34px] sm:py-4"
            style={{ backgroundColor: 'var(--emp-bar)', borderBottom: '1px solid var(--emp-border)' }}
        >
            <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                    <p className="emp-kicker">Categorías de gastos · Editar</p>
                    <h1 className="mt-0.5 truncate text-[20px]" style={{ color: 'var(--emp-text)' }}>
                        {category.name}
                    </h1>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                        <span className="emp-pill">Clasifica gastos de esta empresa</span>
                        <span className={`emp-pill ${data.is_active ? '' : 'emp-pill-warn'}`}>
                            {data.is_active ? 'Activa' : 'Inactiva'}
                        </span>
                    </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                    <Link href={route('expense-categories.index')} className="emp-btn emp-btn-ghost max-sm:hidden">
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
                subtitle="Selector de categoría al registrar un gasto"
                siblings={siblings}
                currentId={category.id}
                currentName={data.name}
                position={position}
            />

            <CatalogUsageCard
                usage={usage}
                countLabel="Gastos registrados"
                totalLabel={`Total en ${new Date().getFullYear()}`}
                lastLabel="Último gasto"
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
                <Link href={route('expense-categories.index')} className="emp-btn flex-1">
                    Cancelar
                </Link>
                <button type="submit" disabled={processing} className="emp-btn emp-btn-primary flex-[2]">
                    {processing ? 'Guardando…' : 'Guardar cambios'}
                </button>
            </div>
        </div>
    );

    return (
        <AppLayout title={`Editar: ${category.name}`}>
            <Head title={`Editar categoría: ${category.name}`} />

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
                                help="Es el texto que verá quien registre un gasto. Corto y sin abreviar."
                            />
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
                                label="Activa"
                                description={
                                    data.is_active
                                        ? 'Aparece al registrar un gasto.'
                                        : 'No aparece al registrar; los gastos ya registrados no cambian.'
                                }
                            />
                        </div>

                        <div className="mt-3">
                            <label className="emp-label">Orden en la lista</label>
                            <CatalogOrderField
                                siblings={siblings}
                                currentId={category.id}
                                currentName={data.name}
                                position={position}
                                onChange={movePosition}
                            />
                        </div>
                        {errors.sort_order ? <p className="emp-error">{errors.sort_order}</p> : null}
                    </EmployeeFormSection>

                    <Can permission="expenses.categories.delete">
                        <EmployeeFormSection title="Eliminar categoría">
                            <p className="text-[12.5px]" style={{ color: 'var(--emp-muted)' }}>
                                {blocked ? (
                                    <>
                                        No se puede eliminar: hay {formatNumber(usage.count_with_trashed)}{' '}
                                        {usage.count_with_trashed === 1 ? 'gasto' : 'gastos'} en esta categoría
                                        (incluidos los archivados). Desactívala para que deje de aparecer sin tocar el
                                        histórico.
                                    </>
                                ) : (
                                    <>
                                        No tiene gastos asociados, así que se puede eliminar del catálogo. La acción no
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
                                Eliminar categoría
                            </button>
                        </EmployeeFormSection>
                    </Can>
                </CatalogFormLayout>
            </form>

            <ConfirmDialog
                open={confirmDelete}
                onClose={() => setConfirmDelete(false)}
                onConfirm={() => {
                    router.delete(route('expense-categories.destroy', category.id), {
                        onFinish: () => setConfirmDelete(false),
                    });
                }}
                title="Eliminar categoría"
                message={`Se elimina «${category.name}» del catálogo. Solo es posible porque no tiene gastos asociados.`}
                confirmText="Eliminar"
                variant="danger"
            />
        </AppLayout>
    );
}
