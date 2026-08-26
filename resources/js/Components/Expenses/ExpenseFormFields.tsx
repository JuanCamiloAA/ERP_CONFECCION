import { Link } from '@inertiajs/react';
import { CheckCircle, Circle } from '@phosphor-icons/react';
import { EmployeeAsideCard } from '@/Components/Employees/EmployeeFormLayout';
import { EmployeeFormSection } from '@/Components/Employees/EmployeeFormSection';
import { ReceiptField } from '@/Components/Expenses/ReceiptField';
import { EmpInput, EmpTextarea } from '@/Components/UI/ModuleFields';
import { monthName } from '@/lib/expenses';
import { formatCurrency, formatDate } from '@/lib/utils';

export const EXPENSE_SECTIONS = [
    { id: 'que', label: 'Qué se pagó' },
    { id: 'cuando', label: 'Cuándo' },
    { id: 'comprobante', label: 'Comprobante' },
    { id: 'detalle', label: 'Detalle' },
];

export interface ExpenseFormData {
    category_id: number | '';
    amount: string;
    expense_date: string;
    description: string;
    notes: string;
    receipt: File | null;
}

export interface ExpenseCategoryOption {
    id: number;
    name: string;
    description?: string | null;
    is_active?: boolean;
}

/** Que secciones estan resueltas; lo usan el indice lateral y la lista de control. */
export function sectionStatus(data: ExpenseFormData, hasReceipt: boolean) {
    return {
        que: data.category_id !== '' && Number(data.amount) > 0,
        cuando: Boolean(data.expense_date),
        comprobante: hasReceipt,
        detalle: data.description.trim().length > 0,
    };
}

interface FieldsProps {
    data: ExpenseFormData;
    setData: <K extends keyof ExpenseFormData>(key: K, value: ExpenseFormData[K]) => void;
    errors: Partial<Record<keyof ExpenseFormData, string>>;
    categories: ExpenseCategoryOption[];
    existingReceipt?: { url: string | null; mime: string | null; name: string | null; uploadedAt: string | null };
}

/**
 * Las cuatro secciones del gasto, compartidas por crear y editar.
 *
 * Viven aparte para que las dos pantallas no se separen: el mismo campo con dos ayudas
 * distintas es como empiezan los formularios que ya no coinciden.
 */
export function ExpenseFormFields({ data, setData, errors, categories, existingReceipt }: FieldsProps) {
    const amount = Number(data.amount) || 0;
    const now = new Date();
    const inCurrentMonth = String(data.expense_date).slice(0, 7) === now.toISOString().slice(0, 7);
    const expenseMonth = data.expense_date
        ? monthName(Number(String(data.expense_date).slice(5, 7)) - 1)
        : '';

    const shortcut = (label: string, value: string) => (
        <button
            key={label}
            type="button"
            onClick={() => setData('expense_date', value)}
            className="emp-pill"
            style={{ height: '28px', cursor: 'pointer' }}
        >
            {label}
        </button>
    );

    const today = new Date();
    const yesterday = new Date(today.getTime() - 86400000);
    const lastMonthEnd = new Date(Date.UTC(today.getFullYear(), today.getMonth(), 0));
    const iso = (d: Date) => d.toISOString().slice(0, 10);

    return (
        <>
            {/* --------------------------------------------------- que se pago */}
            <EmployeeFormSection id="que" step={1} title="Qué se pagó" requirement="required">
                <label className="emp-label">
                    Categoría <span className="emp-req">*</span>
                </label>

                {categories.length === 0 ? (
                    <p className="emp-note">
                        No hay categorías activas todavía.{' '}
                        <Link
                            href={route('expense-categories.create')}
                            className="underline underline-offset-2"
                            style={{ color: 'var(--emp-accent-on)' }}
                        >
                            Crea la primera
                        </Link>{' '}
                        para poder registrar gastos.
                    </p>
                ) : (
                    <>
                        {/* Chips y no un select: son 5-8 opciones y en movil el desplegable
                            es un paso extra por nada. */}
                        <div className="flex flex-wrap gap-1.5">
                            {categories.map((category) => (
                                <button
                                    key={category.id}
                                    type="button"
                                    onClick={() => setData('category_id', category.id)}
                                    title={category.description ?? undefined}
                                    className={`emp-day ${String(data.category_id) === String(category.id) ? 'emp-day-on' : ''}`}
                                    style={{ paddingInline: '14px' }}
                                >
                                    {category.name}
                                    {category.is_active === false ? ' (inactiva)' : ''}
                                </button>
                            ))}
                        </div>

                        <p className="emp-help">
                            Solo categorías activas.{' '}
                            <Link
                                href={route('expense-categories.index')}
                                className="underline underline-offset-2"
                                style={{ color: 'var(--emp-accent-on)' }}
                            >
                                Administrar el catálogo
                            </Link>
                        </p>
                    </>
                )}
                {errors.category_id ? <p className="emp-error">{errors.category_id}</p> : null}

                <div className="mt-3 sm:max-w-[340px]">
                    <EmpInput
                        label="Monto"
                        type="number"
                        inputMode="numeric"
                        step="0.01"
                        min={0.01}
                        prefix="$"
                        required
                        value={data.amount}
                        onChange={(e) => setData('amount', e.target.value)}
                        error={errors.amount}
                        help={
                            amount > 0
                                ? `${formatCurrency(amount)} en pesos colombianos. Sin IVA discriminado: se registra el valor pagado.`
                                : 'En pesos colombianos. Sin IVA discriminado: se registra el valor pagado.'
                        }
                    />
                </div>
            </EmployeeFormSection>

            {/* ---------------------------------------------------- cuando */}
            <EmployeeFormSection id="cuando" step={2} title="Cuándo" requirement="required">
                <div className="sm:max-w-[340px]">
                    <EmpInput
                        label="Fecha del gasto"
                        type="date"
                        required
                        value={data.expense_date}
                        onChange={(e) => setData('expense_date', e.target.value)}
                        error={errors.expense_date}
                        help={
                            !data.expense_date
                                ? 'La fecha en que se pagó, no la de hoy.'
                                : inCurrentMonth
                                  ? `Cae en ${expenseMonth}: entra en el cierre de costos de este mes.`
                                  : `Ojo: es de ${expenseMonth}, un mes ya cerrado. El reporte de ese mes cambia al guardar.`
                        }
                    />
                </div>

                <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {shortcut('Hoy', iso(today))}
                    {shortcut('Ayer', iso(yesterday))}
                    {shortcut('Fin del mes pasado', iso(lastMonthEnd))}
                </div>
            </EmployeeFormSection>

            {/* ----------------------------------------------- comprobante */}
            <EmployeeFormSection id="comprobante" step={3} title="Comprobante" requirement="required">
                <ReceiptField
                    file={data.receipt}
                    onChange={(file) => setData('receipt', file)}
                    existing={existingReceipt}
                    error={errors.receipt}
                />
            </EmployeeFormSection>

            {/* --------------------------------------------------- detalle */}
            <EmployeeFormSection
                id="detalle"
                step={4}
                title="Detalle"
                summary={<span className="emp-pill">Descripción obligatoria</span>}
            >
                <EmpTextarea
                    label="Descripción / concepto"
                    rows={2}
                    required
                    value={data.description}
                    onChange={(e) => setData('description', e.target.value)}
                    error={errors.description}
                    help="Es lo que se lee en el listado y en el reporte de costos. Sé concreto: qué se compró y a quién."
                />

                <div className="mt-3">
                    <EmpTextarea
                        label="Notas"
                        rows={2}
                        value={data.notes}
                        onChange={(e) => setData('notes', e.target.value)}
                        error={errors.notes}
                        placeholder="Número de factura, guía, contrato…"
                    />
                </div>
            </EmployeeFormSection>
        </>
    );
}

/**
 * Lista de control del panel: los cuatro datos que el servidor exige, con su valor cuando
 * ya estan resueltos.
 */
export function ExpenseChecklistCard({
    data,
    categoryName,
    hasReceipt,
    receiptLabel,
}: {
    data: ExpenseFormData;
    categoryName: string | null;
    hasReceipt: boolean;
    receiptLabel: string;
}) {
    const status = sectionStatus(data, hasReceipt);

    const items = [
        { label: 'Categoría', ok: data.category_id !== '', value: categoryName ?? '' },
        { label: 'Monto', ok: Number(data.amount) > 0, value: Number(data.amount) > 0 ? formatCurrency(Number(data.amount)) : '' },
        { label: 'Comprobante', ok: status.comprobante, value: hasReceipt ? receiptLabel : '' },
        { label: 'Descripción', ok: status.detalle, value: data.description.trim().slice(0, 40) },
    ];

    return (
        <EmployeeAsideCard title="Antes de guardar">
            <ul className="mt-2 flex flex-col gap-1.5">
                {items.map((item) => (
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
                            {item.ok && item.value ? (
                                <span className="block truncate" style={{ color: 'var(--emp-subtle)' }}>
                                    {item.value}
                                </span>
                            ) : null}
                        </span>
                    </li>
                ))}
            </ul>
        </EmployeeAsideCard>
    );
}

/** Auditoria del gasto (solo al editar). */
export function ExpenseAuditCard({
    creator,
    createdAt,
    updatedAt,
    companyName,
}: {
    creator: string | null;
    createdAt: string | null;
    updatedAt: string | null;
    companyName: string | null;
}) {
    return (
        <EmployeeAsideCard title="Auditoría">
            <dl className="mt-2 flex flex-col gap-1.5 text-[12px]">
                <div className="flex items-start justify-between gap-3">
                    <dt style={{ color: 'var(--emp-muted)' }}>Registró</dt>
                    <dd className="text-right" style={{ color: 'var(--emp-text)' }}>
                        {creator ?? '—'}
                        {createdAt ? (
                            <span className="block text-[11px]" style={{ color: 'var(--emp-subtle)' }}>
                                {formatDate(createdAt)}
                            </span>
                        ) : null}
                    </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                    <dt style={{ color: 'var(--emp-muted)' }}>Última edición</dt>
                    <dd style={{ color: 'var(--emp-text)' }}>{updatedAt ? formatDate(updatedAt) : '—'}</dd>
                </div>
                {companyName ? (
                    <div className="flex items-center justify-between gap-3">
                        <dt style={{ color: 'var(--emp-muted)' }}>Empresa</dt>
                        <dd style={{ color: 'var(--emp-text)' }}>{companyName}</dd>
                    </div>
                ) : null}
            </dl>
        </EmployeeAsideCard>
    );
}

/**
 * Indice lateral del gasto.
 *
 * A diferencia del de empleados, marca lo que ya esta **completo**, no lo que esta a la
 * vista: en un formulario de cuatro campos obligatorios lo util es saber que falta, y
 * bajo la lista se dice con todas las letras.
 */
export function ExpenseFormNav({ data, hasReceipt }: { data: ExpenseFormData; hasReceipt: boolean }) {
    const status = sectionStatus(data, hasReceipt) as Record<string, boolean>;
    const missing = EXPENSE_SECTIONS.filter((section) => !status[section.id]);

    const goTo = (id: string) => {
        const el = document.getElementById(id);
        if (!el) return;

        window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 80, behavior: 'smooth' });
    };

    return (
        <div>
            <ul className="flex flex-col gap-0.5">
                {EXPENSE_SECTIONS.map((section) => (
                    <li key={section.id}>
                        <button
                            type="button"
                            onClick={() => goTo(section.id)}
                            className={`emp-nav-item ${status[section.id] ? 'emp-nav-on' : ''}`}
                        >
                            {section.label}
                        </button>
                    </li>
                ))}
            </ul>

            <p className="mt-2 px-2.5 text-[11px]" style={{ color: 'var(--emp-subtle)' }}>
                {missing.length === 0
                    ? 'Todo listo para guardar.'
                    : `Falta completar ${missing.map((section) => section.label.toLowerCase()).join(', ')}.`}
            </p>
        </div>
    );
}
