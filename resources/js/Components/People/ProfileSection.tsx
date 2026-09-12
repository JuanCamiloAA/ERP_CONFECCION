import { PencilSimple, X } from '@phosphor-icons/react';
import { router } from '@inertiajs/react';
import { useCallback, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { EmployeeFadingRule } from '@/Components/Employees/EmployeeFormSection';

/** Secciones que admite el guardado parcial; espeja `EmployeePolicy::SECTIONS`. */
export type SectionKey = 'identity' | 'contact' | 'payroll' | 'bank' | 'notes' | 'lifecycle';

interface RenderArgs {
    /** Errores de ESTA sección, nunca los de otra. */
    errors: Record<string, string>;
    processing: boolean;
}

interface Props {
    id: string;
    title: string;
    /** Resumen a la derecha del título: lo que la sección ya resolvió. */
    summary?: ReactNode;
    /** Sin esto la sección es de solo lectura, aunque tenga formulario. */
    canEdit?: boolean;
    editLabel?: string;
    /** Vista de lectura. */
    children: ReactNode;
    /** Formulario. Solo se monta al entrar en edición: así se re-inicializa cada vez. */
    form?: (args: RenderArgs) => ReactNode;
    /** Datos a enviar. Devolver FormData activa multipart (fotos). */
    payload?: () => Record<string, unknown> | FormData;
    /** Ruta PATCH ya construida por el llamador. */
    action?: string;
    /** Acciones extra de la cabecera (crear acceso, solicitar cambio…). */
    actions?: ReactNode;
    /**
     * Se dispara al abrir la edición. El borrador vive en la página —es quien conoce la
     * forma de cada sección— y aquí se le avisa para que lo reinicie desde el dato
     * vigente: sin esto, cancelar y volver a entrar mostraría lo que se tecleó antes.
     */
    onEditStart?: () => void;
}

/**
 * Bloque de la ficha con su propio «Editar sección».
 *
 * La razón de que cada sección envíe por separado es concreta: antes, un documento
 * repetido tiraba también el teléfono y las notas que se acababan de escribir. Aquí el
 * estado del formulario vive dentro de cada sección y los errores se capturan en
 * `onError` en vez de leerse de `page.props.errors` —que es global y, compartido, haría
 * que el fallo de una sección pintara errores en la de al lado.
 */
export function ProfileSection({
    id,
    title,
    summary,
    canEdit = false,
    editLabel = 'Editar sección',
    children,
    form,
    payload,
    action,
    actions,
    onEditStart,
}: Props) {
    const [editing, setEditing] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const close = useCallback(() => {
        setEditing(false);
        setErrors({});
    }, []);

    const submit = useCallback(() => {
        if (!action || !payload) {
            return;
        }

        const data = payload();
        const isFormData = data instanceof FormData;

        if (isFormData) {
            data.append('_method', 'patch');
        }

        setProcessing(true);

        const options = {
            preserveScroll: true,
            preserveState: true,
            forceFormData: isFormData,
            onSuccess: () => {
                setErrors({});
                setEditing(false);
            },
            onError: (formErrors: Record<string, string>) => {
                setErrors(formErrors);
                const first = Object.values(formErrors)[0];
                if (first) {
                    toast.error(first);
                }
            },
            onFinish: () => setProcessing(false),
        };

        if (isFormData) {
            router.post(action, data, options);
        } else {
            router.patch(action, data as Record<string, never>, options);
        }
    }, [action, payload]);

    const editable = canEdit && Boolean(form && payload && action);

    return (
        <section id={id} className="scroll-mt-24">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                <h2 className="shrink-0 text-[15px]" style={{ color: 'var(--emp-text)' }}>
                    {title}
                </h2>

                {summary && !editing ? <span className="min-w-0 shrink-0">{summary}</span> : null}

                <div className="ml-auto flex shrink-0 items-center gap-2">
                    {actions}
                    {editable ? (
                        editing ? (
                            <>
                                <button type="button" className="emp-btn emp-btn-sm emp-btn-ghost" onClick={close}>
                                    <X size={14} aria-hidden="true" /> Cancelar
                                </button>
                                <button
                                    type="button"
                                    className="emp-btn emp-btn-sm emp-btn-primary"
                                    onClick={submit}
                                    disabled={processing}
                                >
                                    {processing ? 'Guardando…' : 'Guardar'}
                                </button>
                            </>
                        ) : (
                            <button
                                type="button"
                                className="emp-btn emp-btn-sm"
                                onClick={() => {
                                    onEditStart?.();
                                    setEditing(true);
                                }}
                                aria-label={`${editLabel}: ${title}`}
                            >
                                <PencilSimple size={14} aria-hidden="true" /> {editLabel}
                            </button>
                        )
                    ) : null}
                </div>
            </div>

            <EmployeeFadingRule />

            <div className="mt-3.5">
                {editing && form ? (
                    <form
                        onSubmit={(event) => {
                            event.preventDefault();
                            submit();
                        }}
                    >
                        {form({ errors, processing })}
                        {/* Enviar con Enter dentro del formulario sin un botón visible extra. */}
                        <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true">
                            Guardar
                        </button>
                    </form>
                ) : (
                    children
                )}
            </div>
        </section>
    );
}

export default ProfileSection;
