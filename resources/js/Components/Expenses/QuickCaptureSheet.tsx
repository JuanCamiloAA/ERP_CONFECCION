import { useForm } from '@inertiajs/react';
import { Camera, Image as ImageIcon, X } from '@phosphor-icons/react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { formatCurrency } from '@/lib/utils';

/** Montos que se repiten en la caja del taller; ahorran teclear en el celular. */
const QUICK_AMOUNTS = [20000, 50000, 100000];

export interface QuickCategory {
    id: number;
    name: string;
}

interface Props {
    open: boolean;
    onClose: () => void;
    categories: QuickCategory[];
}

/**
 * Captura rapida de un gasto desde el movil: foto, monto y categoria.
 *
 * El formulario completo esta pensado para el escritorio; en el taller lo que hay es un
 * recibo en la mano y un telefono. Se guarda lo que no se puede reconstruir despues —la
 * foto— y se marca el gasto para completarlo luego.
 */
export function QuickCaptureSheet({ open, onClose, categories }: Props) {
    const [step, setStep] = useState<1 | 2>(1);
    const cameraInput = useRef<HTMLInputElement>(null);

    const { data, setData, post, processing, errors, reset, clearErrors } = useForm({
        receipt: null as File | null,
        amount: '',
        category_id: '' as number | '',
    });

    useEffect(() => {
        if (!open) {
            return;
        }

        setStep(1);
        reset();
        clearErrors();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    if (!open) {
        return null;
    }

    const amount = Number(data.amount) || 0;
    const category = categories.find((c) => String(c.id) === String(data.category_id)) ?? null;
    const ready = Boolean(data.receipt) && amount > 0 && data.category_id !== '';

    const submit = (event: FormEvent) => {
        event.preventDefault();

        if (!ready) {
            return;
        }

        post(route('expenses.quick-store'), {
            forceFormData: true,
            onSuccess: () => onClose(),
        });
    };

    return (
        <div
            className="emp-scope fixed inset-0 z-[60] flex items-end sm:hidden"
            style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(2px)' }}
            role="dialog"
            aria-modal="true"
            aria-label="Capturar gasto"
        >
            {/* El fondo cierra; el panel no propaga el toque. */}
            <button type="button" aria-label="Cerrar" className="absolute inset-0 h-full w-full" onClick={onClose} />

            <form
                onSubmit={submit}
                className="emp-form relative w-full rounded-t-[18px] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4"
                style={{ backgroundColor: 'var(--emp-surface)', maxHeight: '92vh', overflowY: 'auto' }}
            >
                <header className="flex items-start justify-between gap-3">
                    <div>
                        <p className="emp-kicker">Gastos · Captura rápida</p>
                        <h2 className="mt-0.5 text-[18px]" style={{ color: 'var(--emp-text)' }}>
                            {step === 1 ? 'Foto del comprobante' : 'Monto y categoría'}
                        </h2>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Cerrar"
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg"
                        style={{ color: 'var(--emp-muted)' }}
                    >
                        <X size={18} />
                    </button>
                </header>

                <input
                    ref={cameraInput}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                        const picked = e.target.files?.[0] ?? null;
                        setData('receipt', picked);
                        if (picked) {
                            setStep(2);
                        }
                    }}
                />

                {step === 1 ? (
                    <div className="mt-4">
                        <button
                            type="button"
                            onClick={() => cameraInput.current?.click()}
                            className="flex w-full flex-col items-center justify-center rounded-[14px]"
                            style={{
                                height: '200px',
                                border: '1px dashed var(--emp-border)',
                                backgroundColor: 'var(--emp-field-alt)',
                            }}
                        >
                            <Camera size={34} style={{ color: 'var(--emp-accent-line)' }} />
                            <span className="mt-2 text-[14px]" style={{ color: 'var(--emp-text)' }}>
                                Tomar la foto
                            </span>
                        </button>

                        <p className="emp-note mt-3">
                            El comprobante es obligatorio. Con la foto ya guardada, el monto y la categoría se pueden
                            completar después desde el listado.
                        </p>

                        {errors.receipt ? <p className="emp-error">{errors.receipt}</p> : null}
                    </div>
                ) : (
                    <div className="mt-4">
                        <div
                            className="flex items-center gap-2.5 rounded-[12px] p-2.5"
                            style={{ border: '1px solid var(--emp-border)', backgroundColor: 'var(--emp-field-alt)' }}
                        >
                            <ImageIcon size={18} style={{ color: 'var(--emp-accent-on)' }} />
                            <span className="min-w-0 flex-1 truncate text-[12px]" style={{ color: 'var(--emp-text)' }}>
                                {data.receipt?.name ?? 'Comprobante'}
                            </span>
                            <button
                                type="button"
                                onClick={() => cameraInput.current?.click()}
                                className="emp-btn emp-btn-sm shrink-0"
                            >
                                Cambiar
                            </button>
                        </div>

                        <div className="mt-3">
                            <label className="emp-label" htmlFor="quick-amount">
                                Monto <span className="emp-req">*</span>
                            </label>
                            <div className="relative">
                                <span
                                    className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[13px]"
                                    style={{ color: 'var(--emp-subtle)' }}
                                >
                                    $
                                </span>
                                <input
                                    id="quick-amount"
                                    type="number"
                                    inputMode="numeric"
                                    min={1}
                                    step="0.01"
                                    value={data.amount}
                                    onChange={(e) => setData('amount', e.target.value)}
                                    className={`emp-field pl-6 ${errors.amount ? 'emp-field-error' : ''}`}
                                />
                            </div>
                            {errors.amount ? <p className="emp-error">{errors.amount}</p> : null}

                            <div className="mt-2 flex flex-wrap gap-1.5">
                                {QUICK_AMOUNTS.map((value) => (
                                    <button
                                        key={value}
                                        type="button"
                                        onClick={() => setData('amount', String(value))}
                                        className="emp-pill"
                                        style={{ height: '32px', cursor: 'pointer' }}
                                    >
                                        {formatCurrency(value)}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="mt-3">
                            <label className="emp-label">
                                Categoría <span className="emp-req">*</span>
                            </label>
                            <div className="flex flex-wrap gap-1.5">
                                {categories.map((option) => (
                                    <button
                                        key={option.id}
                                        type="button"
                                        onClick={() => setData('category_id', option.id)}
                                        className={`emp-day ${String(data.category_id) === String(option.id) ? 'emp-day-on' : ''}`}
                                        style={{ paddingInline: '14px' }}
                                    >
                                        {option.name}
                                    </button>
                                ))}
                            </div>
                            {errors.category_id ? <p className="emp-error">{errors.category_id}</p> : null}
                        </div>

                        <p className="emp-note mt-3">
                            {ready
                                ? `Se registra ${formatCurrency(amount)} en ${category?.name} con fecha de hoy. La descripción se puede completar luego desde el listado.`
                                : 'Elige el monto y la categoría para guardar.'}
                        </p>
                    </div>
                )}

                <div className="mt-4 flex gap-2">
                    <button type="button" onClick={onClose} className="emp-btn flex-1">
                        Cancelar
                    </button>
                    {step === 1 ? (
                        <button
                            type="button"
                            onClick={() => cameraInput.current?.click()}
                            className="emp-btn emp-btn-primary flex-[2]"
                        >
                            <Camera size={17} />
                            Tomar foto
                        </button>
                    ) : (
                        <button type="submit" disabled={!ready || processing} className="emp-btn emp-btn-primary flex-[2]">
                            {processing ? 'Guardando…' : `Guardar ${amount > 0 ? formatCurrency(amount) : ''}`}
                        </button>
                    )}
                </div>
            </form>
        </div>
    );
}

export default QuickCaptureSheet;
