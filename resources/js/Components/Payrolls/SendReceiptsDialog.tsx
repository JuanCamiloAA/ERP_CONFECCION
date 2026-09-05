import { router } from '@inertiajs/react';
import { EnvelopeIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { useMemo, useState } from 'react';
import { Button } from '@/Components/UI/Button';
import { Modal } from '@/Components/UI/Modal';
import { employeeName } from '@/lib/payrolls';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Payroll, PayrollEmployee } from '@/types';

interface Props {
    open: boolean;
    onClose: () => void;
    payroll: Payroll;
    rows: PayrollEmployee[];
}

/**
 * Seleccion de a quien se le envia el comprobante de nomina.
 *
 * Arranca con nadie marcado a proposito: el envio sale del sistema hacia gente real y
 * marcar por defecto convierte un clic distraido en decenas de correos. Quien ya recibio
 * el suyo se puede volver a marcar cuantas veces haga falta (el empleado borro el correo,
 * cambio de direccion); lo unico que hace la marca «enviado» es que sea una decision.
 */
export function SendReceiptsDialog({ open, onClose, payroll, rows }: Props) {
    const [selected, setSelected] = useState<number[]>([]);
    const [search, setSearch] = useState('');
    const [sending, setSending] = useState(false);

    const withEmail = useMemo(() => rows.filter((row) => Boolean(row.employee?.email)), [rows]);

    const visible = useMemo(() => {
        const term = search.trim().toLowerCase();
        if (!term) return rows;

        return rows.filter(
            (row) =>
                employeeName(row).toLowerCase().includes(term) ||
                (row.employee?.email ?? '').toLowerCase().includes(term),
        );
    }, [rows, search]);

    const toggle = (id: number) =>
        setSelected((current) =>
            current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
        );

    /** «Todos» actua sobre lo que hay a la vista y solo sobre quien tiene correo. */
    const visibleSelectable = visible.filter((row) => Boolean(row.employee?.email));
    const allVisibleSelected =
        visibleSelectable.length > 0 && visibleSelectable.every((row) => selected.includes(row.id));

    const toggleAll = () => {
        const ids = visibleSelectable.map((row) => row.id);
        setSelected((current) =>
            allVisibleSelected
                ? current.filter((id) => !ids.includes(id))
                : Array.from(new Set([...current, ...ids])),
        );
    };

    const close = () => {
        setSelected([]);
        setSearch('');
        onClose();
    };

    const submit = () => {
        if (selected.length === 0) return;

        setSending(true);
        router.post(
            route('payrolls.receipts.send', payroll.id),
            { payroll_employee_ids: selected },
            {
                preserveScroll: true,
                onSuccess: () => close(),
                onFinish: () => setSending(false),
            },
        );
    };

    const noEmailCount = rows.length - withEmail.length;

    return (
        <Modal
            open={open}
            onClose={close}
            size="2xl"
            sheetOnMobile
            title="Enviar comprobantes"
            description={`${payroll.name} · el empleado recibe su comprobante en PDF y un enlace para abrirlo.`}
            footer={
                <>
                    <Button variant="ghost" onClick={close} disabled={sending}>
                        Cancelar
                    </Button>
                    <Button
                        variant="primary"
                        onClick={submit}
                        loading={sending}
                        disabled={selected.length === 0}
                        icon={<EnvelopeIcon className="h-4 w-4" />}
                    >
                        {selected.length === 0
                            ? 'Enviar'
                            : `Enviar ${selected.length} ${selected.length === 1 ? 'comprobante' : 'comprobantes'}`}
                    </Button>
                </>
            }
        >
            <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-0 flex-1">
                    <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Buscar empleado o correo..."
                        aria-label="Buscar empleado"
                        className="h-9 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                    />
                </div>
                <Button variant="outline" size="sm" onClick={toggleAll} disabled={visibleSelectable.length === 0}>
                    {allVisibleSelected ? 'Quitar todos' : 'Seleccionar todos'}
                </Button>
            </div>

            {noEmailCount > 0 && (
                <p className="mt-2.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                    {noEmailCount === 1
                        ? '1 empleado no tiene correo registrado y no se puede seleccionar.'
                        : `${noEmailCount} empleados no tienen correo registrado y no se pueden seleccionar.`}{' '}
                    Agrega el correo en su ficha para incluirlos.
                </p>
            )}

            <div className="mt-3 max-h-[52vh] overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700">
                {visible.length === 0 ? (
                    <p className="px-3 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                        Ningún empleado coincide con la búsqueda.
                    </p>
                ) : (
                    <ul className="divide-y divide-slate-100 dark:divide-slate-700">
                        {visible.map((row) => {
                            const email = row.employee?.email ?? null;
                            const checked = selected.includes(row.id);
                            const sentAt = row.receipt_sent_at ?? null;

                            return (
                                <li key={row.id}>
                                    <label
                                        className={`flex cursor-pointer items-center gap-3 px-3 py-2.5 ${
                                            email
                                                ? 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                                                : 'cursor-not-allowed opacity-55'
                                        }`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={checked}
                                            disabled={!email}
                                            onChange={() => toggle(row.id)}
                                            className="h-4 w-4 shrink-0 rounded border-slate-300 text-indigo-600 focus:ring-2 focus:ring-indigo-500/40 disabled:cursor-not-allowed dark:border-slate-600 dark:bg-slate-800"
                                        />

                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                                                {employeeName(row)}
                                            </p>
                                            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                                                {email ?? 'Sin correo registrado'}
                                            </p>
                                        </div>

                                        <div className="shrink-0 text-right">
                                            <p className="text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                                                {formatCurrency(row.net_payment)}
                                            </p>
                                            {sentAt ? (
                                                <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
                                                    Enviado {formatDate(sentAt)}
                                                    {(row.receipt_sent_count ?? 0) > 1
                                                        ? ` · ${row.receipt_sent_count} veces`
                                                        : ''}
                                                </p>
                                            ) : (
                                                <p className="text-[11px] text-slate-400 dark:text-slate-500">
                                                    Sin enviar
                                                </p>
                                            )}
                                        </div>
                                    </label>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </Modal>
    );
}

export default SendReceiptsDialog;
