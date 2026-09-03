import { Dialog, DialogPanel, Transition, TransitionChild } from '@headlessui/react';
import { useForm } from '@inertiajs/react';
import { LockSimple, X } from '@phosphor-icons/react';
import { Fragment, useEffect, type FormEvent } from 'react';
import type { PaymentMethod } from '@/types';

interface Props {
    open: boolean;
    onClose: () => void;
    /** La tarjeta actual, si la hay: se usa solo para prellenar el titular. */
    current: PaymentMethod | null;
}

/**
 * Formulario de la tarjeta con la que se cobra la membresía.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PROVISIONAL — hoy el número y el CVC viajan al backend, que los usa para
 * deducir marca y últimos cuatro y los descarta sin guardarlos.
 *
 * Cuando se integre la pasarela (Stripe / Wompi / PayU / Mercado Pago), los tres
 * campos sensibles de abajo —número, vencimiento y CVC— se sustituyen por el
 * campo montado del SDK (`<div id="card-element" />` de Stripe Elements o su
 * equivalente), que vive en un iframe del proveedor: el dato nunca toca este
 * dominio. Este formulario pasa entonces a enviar únicamente el token que
 * devuelve el SDK más el nombre del titular, y `card_number`/`cvc` desaparecen
 * de la petición y de la validación del controlador.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function PaymentMethodModal({ open, onClose, current }: Props) {
    const { data, setData, put, processing, errors, reset, clearErrors } = useForm({
        holder_name: current?.holder_name ?? '',
        card_number: '',
        expiry_month: '',
        expiry_year: '',
        cvc: '',
    });

    // Al cerrar se limpia todo: los datos de una tarjeta no deben sobrevivir en
    // memoria a la vista que los pidió, ni reaparecer si se vuelve a abrir.
    useEffect(() => {
        if (! open) {
            reset();
            clearErrors();
        }
        // `reset`/`clearErrors` cambian de identidad en cada render de useForm.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const submit = (event: FormEvent) => {
        event.preventDefault();
        put(route('settings.payment-method.update'), {
            preserveScroll: true,
            onSuccess: () => {
                reset();
                onClose();
            },
        });
    };

    /** Grupos de cuatro mientras se teclea: así se relee lo escrito sin contar dígitos. */
    const onNumberChange = (value: string) => {
        const digits = value.replace(/\D/g, '').slice(0, 19);
        setData('card_number', digits.replace(/(.{4})/g, '$1 ').trim());
    };

    const currentYear = new Date().getFullYear();

    return (
        <Transition show={open} as={Fragment}>
            <Dialog onClose={onClose} className="relative z-50">
                <TransitionChild
                    as={Fragment}
                    enter="ease-out duration-150"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-100"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div
                        className="fixed inset-0"
                        style={{ backgroundColor: 'rgba(10, 11, 18, 0.62)' }}
                        aria-hidden="true"
                    />
                </TransitionChild>

                <div className="fixed inset-0 flex items-end justify-center p-0 sm:items-center sm:p-4">
                    <TransitionChild
                        as={Fragment}
                        enter="ease-out duration-150"
                        enterFrom="opacity-0 translate-y-3 sm:scale-95"
                        enterTo="opacity-100 translate-y-0 sm:scale-100"
                        leave="ease-in duration-100"
                        leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                        leaveTo="opacity-0 translate-y-3 sm:scale-95"
                    >
                        <DialogPanel
                            className="emp-scope emp-card w-full max-w-[480px] overflow-hidden max-sm:rounded-b-none"
                            style={{
                                backgroundColor: 'var(--emp-surface)',
                                boxShadow: '0 0 0 1px var(--emp-border), 0 18px 48px rgba(0,0,0,.28)',
                            }}
                        >
                            <form onSubmit={submit}>
                                <header className="flex items-start justify-between gap-3 px-[17px] pt-[17px]">
                                    <div className="min-w-0">
                                        <p className="emp-kicker">Membresía</p>
                                        <h2 className="mt-0.5 text-[16px]" style={{ color: 'var(--emp-text)' }}>
                                            {current ? 'Cambiar tarjeta' : 'Agregar tarjeta'}
                                        </h2>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={onClose}
                                        aria-label="Cerrar"
                                        className="emp-btn emp-btn-ghost flex h-8 w-8 shrink-0 items-center justify-center px-0"
                                    >
                                        <X size={15} />
                                    </button>
                                </header>

                                <div className="space-y-3 p-[17px]">
                                    <div>
                                        <label className="emp-label" htmlFor="pm-holder">
                                            Nombre del titular <span className="emp-req">*</span>
                                        </label>
                                        <input
                                            id="pm-holder"
                                            value={data.holder_name}
                                            onChange={(e) => setData('holder_name', e.target.value)}
                                            autoComplete="cc-name"
                                            placeholder="Como aparece en la tarjeta"
                                            className="emp-field"
                                        />
                                        {errors.holder_name ? <p className="emp-error">{errors.holder_name}</p> : null}
                                    </div>

                                    <div>
                                        <label className="emp-label" htmlFor="pm-number">
                                            Número de tarjeta <span className="emp-req">*</span>
                                        </label>
                                        <input
                                            id="pm-number"
                                            value={data.card_number}
                                            onChange={(e) => onNumberChange(e.target.value)}
                                            inputMode="numeric"
                                            autoComplete="cc-number"
                                            placeholder="0000 0000 0000 0000"
                                            className="emp-field tabular-nums"
                                        />
                                        {errors.card_number ? <p className="emp-error">{errors.card_number}</p> : null}
                                    </div>

                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="min-w-0">
                                            <label className="emp-label" htmlFor="pm-month">
                                                Mes <span className="emp-req">*</span>
                                            </label>
                                            <select
                                                id="pm-month"
                                                value={data.expiry_month}
                                                onChange={(e) => setData('expiry_month', e.target.value)}
                                                autoComplete="cc-exp-month"
                                                className="emp-field"
                                            >
                                                <option value="">MM</option>
                                                {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                                                    <option key={month} value={month}>
                                                        {String(month).padStart(2, '0')}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="min-w-0">
                                            <label className="emp-label" htmlFor="pm-year">
                                                Año <span className="emp-req">*</span>
                                            </label>
                                            <select
                                                id="pm-year"
                                                value={data.expiry_year}
                                                onChange={(e) => setData('expiry_year', e.target.value)}
                                                autoComplete="cc-exp-year"
                                                className="emp-field"
                                            >
                                                <option value="">AAAA</option>
                                                {Array.from({ length: 16 }, (_, i) => currentYear + i).map((year) => (
                                                    <option key={year} value={year}>
                                                        {year}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="min-w-0">
                                            <label className="emp-label" htmlFor="pm-cvc">
                                                CVC <span className="emp-req">*</span>
                                            </label>
                                            <input
                                                id="pm-cvc"
                                                value={data.cvc}
                                                onChange={(e) => setData('cvc', e.target.value.replace(/\D/g, '').slice(0, 4))}
                                                inputMode="numeric"
                                                autoComplete="cc-csc"
                                                placeholder="123"
                                                className="emp-field tabular-nums"
                                            />
                                        </div>
                                    </div>

                                    {errors.expiry_month || errors.expiry_year || errors.cvc ? (
                                        <p className="emp-error">
                                            {errors.expiry_month || errors.expiry_year || errors.cvc}
                                        </p>
                                    ) : null}

                                    <p className="emp-note flex items-start gap-2">
                                        <LockSimple size={14} className="mt-0.5 shrink-0" />
                                        <span>
                                            No se guarda el número completo ni el código de seguridad: solo la marca,
                                            los cuatro últimos dígitos y el vencimiento.
                                        </span>
                                    </p>
                                </div>

                                <footer
                                    className="flex justify-end gap-2 px-[17px] py-3"
                                    style={{ borderTop: '1px solid var(--emp-border)' }}
                                >
                                    <button type="button" onClick={onClose} className="emp-btn emp-btn-sm">
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={processing}
                                        className="emp-btn emp-btn-sm emp-btn-primary"
                                    >
                                        {processing ? 'Guardando…' : 'Guardar tarjeta'}
                                    </button>
                                </footer>
                            </form>
                        </DialogPanel>
                    </TransitionChild>
                </div>
            </Dialog>
        </Transition>
    );
}

export default PaymentMethodModal;
