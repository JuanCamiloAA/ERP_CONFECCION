import { Link, router } from '@inertiajs/react';
import { PencilSimple, Plus, Trash } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { ConfirmDialog } from '@/Components/UI/ConfirmDialog';
import { Modal } from '@/Components/UI/Modal';
import { usePermissions } from '@/contexts/PermissionsContext';
import { formatCurrency } from '@/lib/utils';
import type { Payroll, PayrollConcept, PayrollEmployee, PayrollEmployeeAdjustment } from '@/types';

interface Props {
    payroll: Payroll;
    row: PayrollEmployee;
    concepts: PayrollConcept[];
    /** Nomina en `calculado` y permiso `payrolls.show.manage_adjustments`. */
    canManage: boolean;
}

/**
 * Conceptos manuales del empleado (bonificaciones, auxilios, descuentos pactados).
 *
 * El panel guarda contra el servidor de inmediato —no espera al recalculo— porque cada
 * concepto recalcula por su cuenta las deducciones y el neto de la fila. El catalogo de
 * conceptos vive en «Conceptos de nómina»; aqui solo se eligen.
 */
export function ManualConceptsPanel({ payroll, row, concepts, canManage }: Props) {
    const perms = usePermissions();
    const [editing, setEditing] = useState<null | { adjustment?: PayrollEmployeeAdjustment }>(null);
    const [confirmDelete, setConfirmDelete] = useState<PayrollEmployeeAdjustment | null>(null);
    const [conceptId, setConceptId] = useState('');
    const [amount, setAmount] = useState('');
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);

    const adjustments = row.adjustments ?? [];

    useEffect(() => {
        if (! editing) {
            setConceptId('');
            setAmount('');
            setNotes('');

            return;
        }

        if (editing.adjustment) {
            setConceptId(String(editing.adjustment.payroll_concept_id));
            setAmount(String(editing.adjustment.amount));
            setNotes(editing.adjustment.notes ?? '');
        } else {
            setConceptId(concepts[0]?.id ? String(concepts[0].id) : '');
            setAmount('');
            setNotes('');
        }
    }, [editing, concepts]);

    const submit = () => {
        if (! editing) return;

        const parsedAmount = Number(amount.replace(',', '.'));
        if (Number.isNaN(parsedAmount) || parsedAmount <= 0) return;

        setSaving(true);

        if (editing.adjustment) {
            router.put(
                route('payrolls.payroll-employees.adjustments.update', [payroll.id, row.id, editing.adjustment.id]),
                { amount: parsedAmount, notes: notes.trim() || null },
                {
                    preserveScroll: true,
                    onFinish: () => {
                        setSaving(false);
                        setEditing(null);
                    },
                },
            );

            return;
        }

        if (! conceptId) {
            setSaving(false);

            return;
        }

        router.post(
            route('payrolls.payroll-employees.adjustments.store', [payroll.id, row.id]),
            { payroll_concept_id: Number(conceptId), amount: parsedAmount, notes: notes.trim() || null },
            {
                preserveScroll: true,
                onFinish: () => {
                    setSaving(false);
                    setEditing(null);
                },
            },
        );
    };

    const remove = () => {
        if (! confirmDelete) return;
        const target = confirmDelete;
        setConfirmDelete(null);
        router.delete(route('payrolls.payroll-employees.adjustments.destroy', [payroll.id, row.id, target.id]), {
            preserveScroll: true,
        });
    };

    return (
        <section className="emp-card p-[15px_16px]">
            <header className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                    <p className="emp-kicker">Conceptos manuales</p>
                    <p className="mt-0.5 text-[11px]" style={{ color: 'var(--emp-subtle)' }}>
                        Se suman al bruto antes de deducciones y anticipos.
                    </p>
                </div>

                {canManage && concepts.length > 0 ? (
                    <button
                        type="button"
                        onClick={() => setEditing({})}
                        className="emp-btn emp-btn-sm emp-btn-primary shrink-0"
                    >
                        <Plus size={14} />
                        Agregar
                    </button>
                ) : null}
            </header>

            {canManage && concepts.length === 0 ? (
                <div className="emp-note mt-2.5">
                    No hay conceptos activos para esta empresa.{' '}
                    {perms.can('payroll_concepts.index.view') ? (
                        <Link
                            href={route('payroll-concepts.index')}
                            className="underline underline-offset-2"
                            style={{ color: 'var(--emp-accent-on)' }}
                        >
                            Crea al menos uno en Conceptos de nómina
                        </Link>
                    ) : (
                        'Pide que se cree al menos uno en Conceptos de nómina'
                    )}{' '}
                    para poder registrar ajustes.
                </div>
            ) : null}

            {adjustments.length === 0 ? (
                <p className="mt-2.5 text-[12.5px]" style={{ color: 'var(--emp-muted)' }}>
                    Sin conceptos registrados.
                </p>
            ) : (
                <div className="mt-2.5 flex flex-col">
                    {adjustments.map((adjustment) => (
                        <div
                            key={adjustment.id}
                            className="flex items-center gap-2 py-1.5"
                            style={{ borderBottom: '1px solid var(--emp-row)' }}
                        >
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-[12.5px]" style={{ color: 'var(--emp-text)' }}>
                                    {adjustment.payroll_concept?.name ?? `#${adjustment.payroll_concept_id}`}
                                </p>
                                {adjustment.notes ? (
                                    <p className="truncate text-[11px]" style={{ color: 'var(--emp-subtle)' }}>
                                        {adjustment.notes}
                                    </p>
                                ) : null}
                            </div>

                            <span
                                className="shrink-0 text-[12.5px] tabular-nums"
                                style={{ color: 'var(--emp-accent-on)' }}
                            >
                                + {formatCurrency(adjustment.amount)}
                            </span>

                            {canManage ? (
                                <div className="flex shrink-0 items-center gap-0.5">
                                    <button
                                        type="button"
                                        onClick={() => setEditing({ adjustment })}
                                        aria-label={`Editar ${adjustment.payroll_concept?.name ?? 'concepto'}`}
                                        className="flex h-[30px] w-[30px] items-center justify-center rounded-lg"
                                        style={{ color: 'var(--emp-muted)' }}
                                    >
                                        <PencilSimple size={15} />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setConfirmDelete(adjustment)}
                                        aria-label={`Eliminar ${adjustment.payroll_concept?.name ?? 'concepto'}`}
                                        className="flex h-[30px] w-[30px] items-center justify-center rounded-lg"
                                        style={{ color: 'var(--emp-danger)' }}
                                    >
                                        <Trash size={15} />
                                    </button>
                                </div>
                            ) : null}
                        </div>
                    ))}

                    <p className="mt-2 text-right text-[12px]" style={{ color: 'var(--emp-muted)' }}>
                        Subtotal {formatCurrency(row.adjustments_subtotal ?? 0)}
                    </p>
                </div>
            )}

            <Modal
                open={!! editing}
                onClose={() => ! saving && setEditing(null)}
                title={editing?.adjustment ? 'Editar concepto' : 'Agregar concepto'}
                size="sm"
                footer={
                    <div className="emp-scope flex justify-end gap-2">
                        <button type="button" className="emp-btn" disabled={saving} onClick={() => setEditing(null)}>
                            Cancelar
                        </button>
                        <button type="button" className="emp-btn emp-btn-primary" disabled={saving} onClick={submit}>
                            {saving ? 'Guardando…' : 'Guardar'}
                        </button>
                    </div>
                }
            >
                <div className="emp-scope flex flex-col gap-3">
                    {editing?.adjustment ? (
                        <p className="text-[12.5px]" style={{ color: 'var(--emp-muted)' }}>
                            Concepto:{' '}
                            <span style={{ color: 'var(--emp-text)' }}>
                                {editing.adjustment.payroll_concept?.name ?? `#${editing.adjustment.payroll_concept_id}`}
                            </span>
                        </p>
                    ) : (
                        <div>
                            <label className="emp-label" htmlFor="payroll-concept">
                                Concepto <span className="emp-req">*</span>
                            </label>
                            <select
                                id="payroll-concept"
                                value={conceptId}
                                onChange={(e) => setConceptId(e.target.value)}
                                className="emp-field"
                            >
                                {concepts.map((concept) => (
                                    <option key={concept.id} value={concept.id}>
                                        {concept.code ? `${concept.name} (${concept.code})` : concept.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div>
                        <label className="emp-label" htmlFor="payroll-concept-amount">
                            Monto <span className="emp-req">*</span>
                        </label>
                        <input
                            id="payroll-concept-amount"
                            type="number"
                            min={0.01}
                            step={0.01}
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="emp-field"
                        />
                    </div>

                    <div>
                        <label className="emp-label" htmlFor="payroll-concept-notes">
                            Nota
                        </label>
                        <textarea
                            id="payroll-concept-notes"
                            rows={2}
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="emp-field"
                        />
                    </div>
                </div>
            </Modal>

            <ConfirmDialog
                open={!! confirmDelete}
                onClose={() => setConfirmDelete(null)}
                onConfirm={remove}
                title="Eliminar concepto"
                message="¿Eliminar esta línea de ajuste? Se recalcularán deducciones y totales de la nómina."
                confirmText="Eliminar"
                variant="danger"
            />
        </section>
    );
}

export default ManualConceptsPanel;
