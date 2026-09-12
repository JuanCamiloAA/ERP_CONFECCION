import { router } from '@inertiajs/react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { EmpInput, EmpSelect, EmpTextarea } from '@/Components/UI/ModuleFields';
import { Modal } from '@/Components/UI/Modal';
import { formatDate } from '@/lib/utils';
import type { EmployeeProfile } from '@/types';

/** Los tres tipos que el empleado puede radicar desde su ficha. */
export type RequestKind = 'advance' | 'profile_change' | 'production_correction' | null;

/**
 * Diálogos de autoservicio.
 *
 * Ninguno escribe el dato: los tres crean una solicitud en estado «En revisión». Es la
 * diferencia que justifica todo el mecanismo —un operario propone su cuenta bancaria,
 * no la cambia— y por eso el texto de cada diálogo lo dice explícitamente.
 */
export function RequestDialogs({
    profile,
    kind,
    onClose,
}: {
    profile: EmployeeProfile;
    kind: RequestKind;
    onClose: () => void;
}) {
    const action = route('employees.requests.store', profile.employeeId);

    return (
        <>
            <AdvanceDialog open={kind === 'advance'} action={action} onClose={onClose} />
            <BankChangeDialog
                open={kind === 'profile_change'}
                action={action}
                banks={profile.options.banks}
                onClose={onClose}
            />
            <CorrectionDialog
                open={kind === 'production_correction'}
                action={action}
                productions={profile.history.productions}
                onClose={onClose}
            />
        </>
    );
}

/** Envío común: mismo endpoint, mismo manejo de errores, distinto `payload`. */
function useRequestSubmit(action: string, onDone: () => void) {
    const [processing, setProcessing] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const submit = (type: string, payload: Record<string, string | number | null>) => {
        setProcessing(true);
        router.post(
            action,
            // Inertia tipa el cuerpo como plano; aquí es a propósito anidado (`payload`
            // es la columna json de la solicitud) y el `as never` es lo que reconoce eso.
            { type, payload } as never,
            {
                preserveScroll: true,
                onSuccess: () => {
                    setErrors({});
                    onDone();
                },
                onError: (formErrors) => {
                    // El servidor valida el contenido dentro de `payload`, así que los
                    // errores llegan con esa ruta: se recortan para casar con los campos.
                    const flat: Record<string, string> = {};
                    Object.entries(formErrors).forEach(([key, message]) => {
                        flat[key.replace(/^payload\./, '')] = message as string;
                    });
                    setErrors(flat);
                    const first = Object.values(flat)[0];
                    if (first) {
                        toast.error(first);
                    }
                },
                onFinish: () => setProcessing(false),
            },
        );
    };

    return { submit, processing, errors, setErrors };
}

function DialogShell({
    open,
    onClose,
    title,
    description,
    onSubmit,
    processing,
    confirmLabel = 'Enviar solicitud',
    children,
}: {
    open: boolean;
    onClose: () => void;
    title: string;
    description: string;
    onSubmit: () => void;
    processing: boolean;
    confirmLabel?: string;
    children: React.ReactNode;
}) {
    return (
        <Modal
            open={open}
            onClose={onClose}
            title={title}
            description={description}
            size="md"
            sheetOnMobile
            footer={
                <>
                    <button type="button" className="emp-btn emp-btn-ghost" onClick={onClose}>
                        Cancelar
                    </button>
                    <button type="button" className="emp-btn emp-btn-primary" onClick={onSubmit} disabled={processing}>
                        {processing ? 'Enviando…' : confirmLabel}
                    </button>
                </>
            }
        >
            {/* emp-scope: el modal vive en un portal y sin esto se queda sin tokens. */}
            <form
                className="emp-scope space-y-3.5"
                onSubmit={(event) => {
                    event.preventDefault();
                    onSubmit();
                }}
            >
                {children}
                <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true">
                    Enviar
                </button>
            </form>
        </Modal>
    );
}

// ---------------------------------------------------------------------- anticipo

function AdvanceDialog({ open, action, onClose }: { open: boolean; action: string; onClose: () => void }) {
    const today = new Date().toISOString().slice(0, 10);
    const [amount, setAmount] = useState('');
    const [reason, setReason] = useState('');
    const [date, setDate] = useState(today);
    const { submit, processing, errors } = useRequestSubmit(action, () => {
        setAmount('');
        setReason('');
        setDate(today);
        onClose();
    });

    return (
        <DialogShell
            open={open}
            onClose={onClose}
            title="Solicitar anticipo"
            description="Queda en revisión. El anticipo solo se registra cuando lo aprueban."
            onSubmit={() => submit('advance', { amount, reason, date })}
            processing={processing}
        >
            <EmpInput
                label="Monto"
                required
                prefix="$"
                inputMode="numeric"
                value={amount}
                onChange={(event) => setAmount(event.target.value.replace(/[^\d]/g, ''))}
                error={errors.amount}
            />
            <EmpInput
                label="Fecha en que lo necesitas"
                type="date"
                required
                value={date}
                onChange={(event) => setDate(event.target.value)}
                error={errors.date}
            />
            <EmpTextarea
                label="Motivo"
                required
                rows={3}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                error={errors.reason}
            />
        </DialogShell>
    );
}

// ------------------------------------------------------------- cuenta bancaria

function BankChangeDialog({
    open,
    action,
    banks,
    onClose,
}: {
    open: boolean;
    action: string;
    banks: EmployeeProfile['options']['banks'];
    onClose: () => void;
}) {
    const [bankId, setBankId] = useState('');
    const [accountNumber, setAccountNumber] = useState('');
    const [accountType, setAccountType] = useState('ahorros');
    const [key, setKey] = useState('');
    const { submit, processing, errors } = useRequestSubmit(action, () => {
        setBankId('');
        setAccountNumber('');
        setKey('');
        onClose();
    });

    const bank = useMemo(() => banks.find((row) => String(row.id) === bankId) ?? null, [banks, bankId]);
    const isWallet = bank?.type === 'wallet';

    return (
        <DialogShell
            open={open}
            onClose={onClose}
            title="Actualizar cuenta bancaria"
            description="Tu cuenta actual no cambia hasta que administración apruebe la solicitud."
            onSubmit={() =>
                submit('profile_change', {
                    bank_id: bankId,
                    bank_account_number: accountNumber,
                    bank_account_type: isWallet ? '' : accountType,
                    bank_key: key,
                })
            }
            processing={processing}
        >
            <EmpSelect
                label="Banco o billetera"
                required
                placeholder="Selecciona…"
                value={bankId}
                onChange={(event) => setBankId(event.target.value)}
                options={banks.map((row) => ({ value: String(row.id), label: row.name }))}
                error={errors.bank_id}
            />
            <EmpInput
                label="Número de cuenta"
                required
                inputMode="numeric"
                value={accountNumber}
                onChange={(event) => setAccountNumber(event.target.value.replace(/[^\d]/g, ''))}
                error={errors.bank_account_number}
                help={bank?.account_hint ?? undefined}
            />
            {!isWallet ? (
                <EmpSelect
                    label="Tipo de cuenta"
                    value={accountType}
                    onChange={(event) => setAccountType(event.target.value)}
                    options={[
                        { value: 'ahorros', label: 'Ahorros' },
                        { value: 'corriente', label: 'Corriente' },
                    ]}
                    error={errors.bank_account_type}
                />
            ) : null}
            {bank?.requires_key ? (
                <EmpInput
                    label="Clave de dispersión"
                    required
                    value={key}
                    onChange={(event) => setKey(event.target.value.replace(/[^0-9A-Za-z]/g, ''))}
                    error={errors.bank_key}
                    help="La entidad la exige para recibir la nómina."
                />
            ) : null}
        </DialogShell>
    );
}

// ----------------------------------------------------- corrección de producción

function CorrectionDialog({
    open,
    action,
    productions,
    onClose,
}: {
    open: boolean;
    action: string;
    productions: EmployeeProfile['history']['productions'];
    onClose: () => void;
}) {
    const [productionId, setProductionId] = useState('');
    const [suggested, setSuggested] = useState('');
    const [description, setDescription] = useState('');
    const { submit, processing, errors } = useRequestSubmit(action, () => {
        setProductionId('');
        setSuggested('');
        setDescription('');
        onClose();
    });

    return (
        <DialogShell
            open={open}
            onClose={onClose}
            title="Reportar corrección de producción"
            description="El registro no se modifica solo: queda marcado para que lo revise quien liquida."
            onSubmit={() =>
                submit('production_correction', {
                    production_id: productionId,
                    suggested_quantity: suggested,
                    description,
                })
            }
            processing={processing}
        >
            {productions.length === 0 ? (
                <p className="emp-note">No tienes registros de producción sobre los que reportar.</p>
            ) : (
                <>
                    <EmpSelect
                        label="Registro"
                        required
                        placeholder="Selecciona…"
                        value={productionId}
                        onChange={(event) => setProductionId(event.target.value)}
                        options={productions.map((row) => ({
                            value: String(row.id),
                            label: `${formatDate(row.date)} · ${row.operation ?? 'operación'} · ${row.quantity} und`,
                        }))}
                        error={errors.production_id}
                    />
                    <EmpInput
                        label="Cantidad que debería quedar"
                        inputMode="numeric"
                        value={suggested}
                        onChange={(event) => setSuggested(event.target.value.replace(/[^\d]/g, ''))}
                        error={errors.suggested_quantity}
                        help="Opcional. Déjalo vacío si el problema no es la cantidad."
                    />
                    <EmpTextarea
                        label="Qué está mal"
                        required
                        rows={3}
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                        error={errors.description}
                    />
                </>
            )}
        </DialogShell>
    );
}

export default RequestDialogs;
