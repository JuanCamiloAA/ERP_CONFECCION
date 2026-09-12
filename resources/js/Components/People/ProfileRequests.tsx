import { router } from '@inertiajs/react';
import { Check, X } from '@phosphor-icons/react';
import { useState } from 'react';
import { toast } from 'sonner';
import { EmpTextarea } from '@/Components/UI/ModuleFields';
import { Modal } from '@/Components/UI/Modal';
import { formatDateTime } from '@/lib/utils';
import type { ProfileRequest } from '@/types';
import { EmployeeFadingRule } from '@/Components/Employees/EmployeeFormSection';
import { StatusTag } from './primitives';

/**
 * Solicitudes de la persona y, para quien puede, su bandeja de aprobación.
 *
 * Las dos vistas son la misma lista: separar «mis solicitudes» de «pendientes de mi
 * aprobación» en dos componentes distintos duplicaría el estado y la forma de una fila
 * para no cambiar nada de lo que se ve.
 */
export function ProfileRequests({
    requests,
    canApprove,
    isSelf,
}: {
    requests: ProfileRequest[];
    canApprove: boolean;
    isSelf: boolean;
}) {
    const [rejecting, setRejecting] = useState<ProfileRequest | null>(null);
    const [reason, setReason] = useState('');
    const [reasonError, setReasonError] = useState<string | undefined>();
    const [busyId, setBusyId] = useState<number | null>(null);

    const pending = requests.filter((row) => row.status === 'pending');
    const history = requests.filter((row) => row.status !== 'pending');

    const approve = (row: ProfileRequest) => {
        setBusyId(row.id);
        router.post(
            route('employee-requests.approve', row.id),
            {},
            {
                preserveScroll: true,
                onError: (errors) => toast.error(Object.values(errors)[0] ?? 'No se pudo aprobar.'),
                onFinish: () => setBusyId(null),
            },
        );
    };

    const submitRejection = () => {
        if (!rejecting) {
            return;
        }

        // El motivo es obligatorio también en servidor; validarlo aquí evita el viaje.
        if (reason.trim().length < 5) {
            setReasonError('Explica en una frase por qué se rechaza.');

            return;
        }

        setBusyId(rejecting.id);
        router.post(
            route('employee-requests.reject', rejecting.id),
            { rejection_reason: reason.trim() },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setRejecting(null);
                    setReason('');
                    setReasonError(undefined);
                },
                onError: (errors) => setReasonError(errors.rejection_reason ?? 'No se pudo rechazar.'),
                onFinish: () => setBusyId(null),
            },
        );
    };

    if (requests.length === 0) {
        return (
            <p className="text-[12.5px]" style={{ color: 'var(--emp-subtle)' }}>
                {isSelf ? 'No has enviado ninguna solicitud.' : 'Esta persona no tiene solicitudes.'}
            </p>
        );
    }

    return (
        <div className="space-y-4">
            {pending.length > 0 ? (
                <div>
                    <p className="emp-kicker">{canApprove ? 'Pendientes de mi aprobación' : 'En revisión'}</p>
                    <ul className="mt-2 space-y-2">
                        {pending.map((row) => (
                            <li key={row.id}>
                                <RequestRow
                                    row={row}
                                    busy={busyId === row.id}
                                    onApprove={canApprove ? () => approve(row) : undefined}
                                    onReject={
                                        canApprove
                                            ? () => {
                                                  setRejecting(row);
                                                  setReason('');
                                                  setReasonError(undefined);
                                              }
                                            : undefined
                                    }
                                />
                            </li>
                        ))}
                    </ul>
                </div>
            ) : null}

            {history.length > 0 ? (
                <div>
                    {pending.length > 0 ? <EmployeeFadingRule /> : null}
                    <p className={`emp-kicker ${pending.length > 0 ? 'mt-3' : ''}`}>Resueltas</p>
                    <ul className="mt-2 space-y-2">
                        {history.map((row) => (
                            <li key={row.id}>
                                <RequestRow row={row} busy={false} />
                            </li>
                        ))}
                    </ul>
                </div>
            ) : null}

            <Modal
                open={rejecting !== null}
                onClose={() => setRejecting(null)}
                title="Rechazar solicitud"
                description={rejecting?.summary}
                size="md"
                footer={
                    <>
                        <button type="button" className="emp-btn emp-btn-ghost" onClick={() => setRejecting(null)}>
                            Cancelar
                        </button>
                        <button
                            type="button"
                            className="emp-btn emp-btn-primary"
                            onClick={submitRejection}
                            disabled={busyId !== null}
                        >
                            Rechazar
                        </button>
                    </>
                }
            >
                {/* emp-scope: el modal se pinta en un portal, fuera del árbol de la página. */}
                <div className="emp-scope">
                    <EmpTextarea
                        label="Motivo del rechazo"
                        required
                        rows={4}
                        value={reason}
                        onChange={(event) => {
                            setReason(event.target.value);
                            setReasonError(undefined);
                        }}
                        error={reasonError}
                        help="Lo verá la persona que hizo la solicitud."
                    />
                </div>
            </Modal>
        </div>
    );
}

function RequestRow({
    row,
    busy,
    onApprove,
    onReject,
}: {
    row: ProfileRequest;
    busy: boolean;
    onApprove?: () => void;
    onReject?: () => void;
}) {
    const tone = row.status === 'approved' ? 'ok' : row.status === 'rejected' ? 'warn' : 'accent';

    return (
        <div className="emp-card p-3">
            <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[13px]" style={{ color: 'var(--emp-text)' }}>
                            {row.type_label}
                        </span>
                        <StatusTag label={row.status_label} tone={tone} />
                    </div>
                    <p className="mt-1 text-[12.5px]" style={{ color: 'var(--emp-muted)' }}>
                        {row.summary}
                    </p>
                    <p className="mt-1 text-[11.5px]" style={{ color: 'var(--emp-subtle)' }}>
                        Enviada {formatDateTime(row.created_at)}
                        {row.reviewed_at ? ` · Revisada ${formatDateTime(row.reviewed_at)}` : ''}
                        {row.reviewer ? ` por ${row.reviewer}` : ''}
                    </p>
                    {row.rejection_reason ? (
                        <p className="emp-note mt-2">Motivo del rechazo: {row.rejection_reason}</p>
                    ) : null}
                </div>

                {onApprove || onReject ? (
                    <div className="flex shrink-0 gap-2">
                        {onReject ? (
                            <button type="button" className="emp-btn emp-btn-sm emp-btn-danger" onClick={onReject} disabled={busy}>
                                <X size={14} aria-hidden="true" /> Rechazar
                            </button>
                        ) : null}
                        {onApprove ? (
                            <button type="button" className="emp-btn emp-btn-sm emp-btn-primary" onClick={onApprove} disabled={busy}>
                                <Check size={14} aria-hidden="true" /> {busy ? 'Aprobando…' : 'Aprobar'}
                            </button>
                        ) : null}
                    </div>
                ) : null}
            </div>
        </div>
    );
}

export default ProfileRequests;
