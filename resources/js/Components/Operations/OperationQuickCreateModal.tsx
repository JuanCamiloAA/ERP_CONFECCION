import { Dialog, DialogPanel, Transition, TransitionChild } from '@headlessui/react';
import { usePage } from '@inertiajs/react';
import { X } from '@phosphor-icons/react';
import axios from 'axios';
import { Fragment, FormEvent, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { EmployeeFadingRule } from '@/Components/Employees/EmployeeFormSection';
import { EmpInput, EmpSwitch, EmpTextarea } from '@/Components/UI/ModuleFields';
import { DEFAULT_DIFFICULTY_MINUTE_THRESHOLDS, difficultyLabel, levelFromMinutes } from '@/lib/difficulty';
import { formatNumber } from '@/lib/utils';
import '../../../css/module-ui.css';

export interface QuickCreatedOperation {
    id: number;
    name: string;
    base_price: string | number;
    estimated_minutes: string | number;
    difficulty_level: number;
    description: string | null;
    is_active: boolean;
}

interface OperationQuickCreateModalProps {
    open: boolean;
    onClose: () => void;
    onCreated: (operation: QuickCreatedOperation) => void;
    /** Referencia desde la que se abre; solo se muestra como contexto. */
    contextLabel?: string;
}

const emptyForm = {
    name: '',
    description: '',
    base_price: '',
    estimated_minutes: '',
    is_active: true,
};

/**
 * Alta de una operacion sin salir de donde se esta.
 *
 * El comportamiento no cambia: se envia por axios a `operations.store`, un 422 se reparte
 * por campo y `onCreated` devuelve la operacion para que la referencia la seleccione. Lo
 * que cambia es la piel, y que el contenido va dentro de `.emp-scope`: el dialogo se
 * pinta en un portal, fuera del arbol de la pagina, y sin ese ambito se quedaria sin las
 * reglas de tipografia y foco del modulo.
 */
export function OperationQuickCreateModal({ open, onClose, onCreated, contextLabel }: OperationQuickCreateModalProps) {
    const thresholds = usePage<App.PageProps>().props.difficultyMinuteThresholds ?? DEFAULT_DIFFICULTY_MINUTE_THRESHOLDS;
    const [form, setForm] = useState(emptyForm);
    const [processing, setProcessing] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const minutes = useMemo(() => {
        const value = Number(form.estimated_minutes);

        return form.estimated_minutes !== '' && Number.isFinite(value) && value > 0 ? value : null;
    }, [form.estimated_minutes]);

    const level = minutes !== null ? levelFromMinutes(minutes, thresholds) : null;

    const setField = <K extends keyof typeof emptyForm>(key: K, value: (typeof emptyForm)[K]) => {
        setForm((prev) => ({ ...prev, [key]: value }));
    };

    const handleClose = () => {
        setForm(emptyForm);
        setErrors({});
        onClose();
    };

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        setProcessing(true);
        setErrors({});
        try {
            const { data } = await axios.post<QuickCreatedOperation>(route('operations.store'), form, {
                headers: { Accept: 'application/json' },
            });
            setForm(emptyForm);
            onCreated(data);
        } catch (error) {
            if (axios.isAxiosError(error) && error.response?.status === 422) {
                const raw = (error.response.data?.errors ?? {}) as Record<string, string[]>;
                setErrors(Object.fromEntries(Object.entries(raw).map(([field, messages]) => [field, messages[0]])));
            } else {
                toast.error('No se pudo crear la operación.');
            }
        } finally {
            setProcessing(false);
        }
    };

    return (
        <Transition show={open} as={Fragment}>
            <Dialog onClose={handleClose} className="relative z-50">
                <TransitionChild
                    as={Fragment}
                    enter="ease-out duration-150"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-100"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0" style={{ backgroundColor: 'rgba(10, 11, 18, 0.62)' }} aria-hidden="true" />
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
                            className="emp-scope emp-card w-full max-w-[560px] overflow-hidden max-sm:rounded-b-none"
                            style={{ backgroundColor: 'var(--emp-surface)', boxShadow: '0 0 0 1px var(--emp-border), 0 18px 48px rgba(0,0,0,.28)' }}
                        >
                            <header className="flex items-start justify-between gap-3 px-[17px] pt-[17px]">
                                <div className="min-w-0">
                                    {contextLabel ? <p className="emp-kicker truncate">{contextLabel}</p> : null}
                                    <h2 className="mt-0.5 text-[16px]" style={{ color: 'var(--emp-text)' }}>
                                        Nueva operación
                                    </h2>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleClose}
                                    aria-label="Cerrar"
                                    className="emp-btn emp-btn-ghost flex h-8 w-8 shrink-0 items-center justify-center px-0"
                                >
                                    <X size={15} />
                                </button>
                            </header>

                            <div className="px-[17px]">
                                <EmployeeFadingRule />
                            </div>

                            <form
                                id="operation-quick-create-form"
                                onSubmit={submit}
                                className="grid grid-cols-1 gap-3 px-[17px] py-4 sm:grid-cols-2"
                            >
                                <EmpInput
                                    label="Nombre"
                                    required
                                    value={form.name}
                                    onChange={(e) => setField('name', e.target.value)}
                                    error={errors.name}
                                    containerClassName="sm:col-span-2"
                                />
                                <EmpInput
                                    label="Precio base"
                                    type="number"
                                    step="0.01"
                                    min={0}
                                    prefix="$"
                                    required
                                    value={form.base_price}
                                    onChange={(e) => setField('base_price', e.target.value)}
                                    error={errors.base_price}
                                />
                                <EmpInput
                                    label="Minutos estándar"
                                    type="number"
                                    step="0.1"
                                    min={0.1}
                                    required
                                    value={form.estimated_minutes}
                                    onChange={(e) => setField('estimated_minutes', e.target.value)}
                                    error={errors.estimated_minutes}
                                    help="Define el grado de dificultad."
                                />
                                <EmpTextarea
                                    label="Descripción"
                                    rows={2}
                                    value={form.description}
                                    onChange={(e) => setField('description', e.target.value)}
                                    error={errors.description}
                                    containerClassName="sm:col-span-2"
                                />

                                <p className="emp-note sm:col-span-2">
                                    {minutes && level ? (
                                        <>
                                            {formatNumber(minutes)} min → dificultad <strong>{difficultyLabel(level)}</strong>. Se
                                            guarda en el catálogo y queda seleccionada en esta referencia.
                                        </>
                                    ) : (
                                        <>
                                            Escribe los minutos y aquí aparece la dificultad. Se guarda en el catálogo y queda
                                            seleccionada en esta referencia.
                                        </>
                                    )}
                                </p>
                            </form>

                            <div className="px-[17px]">
                                <EmployeeFadingRule className="mt-0" />
                            </div>

                            <footer className="flex items-center justify-between gap-3 px-[17px] py-3">
                                <EmpSwitch
                                    checked={form.is_active}
                                    onChange={(v) => setField('is_active', v)}
                                    label="Activa"
                                />

                                <div className="flex shrink-0 items-center gap-2">
                                    <button type="button" onClick={handleClose} className="emp-btn emp-btn-sm emp-btn-ghost">
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        form="operation-quick-create-form"
                                        disabled={processing}
                                        className="emp-btn emp-btn-sm emp-btn-primary"
                                    >
                                        {processing ? 'Guardando…' : 'Guardar y seleccionar'}
                                    </button>
                                </div>
                            </footer>
                        </DialogPanel>
                    </TransitionChild>
                </div>
            </Dialog>
        </Transition>
    );
}

export default OperationQuickCreateModal;
