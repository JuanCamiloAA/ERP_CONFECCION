import { Link } from '@inertiajs/react';
import { ArrowLeft, Check } from '@phosphor-icons/react';

export interface FormStep {
    key: string;
    label: string;
}

interface HeaderProps {
    steps: FormStep[];
    /** Indice del paso visible (base cero). */
    current: number;
    /** Pasos ya resueltos; marcan ✓ y se pueden volver a tocar. */
    completed: boolean[];
    onSelect: (index: number) => void;
    title: string;
    backHref: string;
}

/**
 * Cabecera del formulario por pasos (movil).
 *
 * Tres segmentos en lugar de una barra continua: el usuario necesita saber cuantos pasos
 * faltan, no que porcentaje lleva. Un paso ya resuelto se puede tocar para volver.
 */
export function EmployeeStepsHeader({ steps, current, completed, onSelect, title, backHref }: HeaderProps) {
    return (
        <header
            className="sticky top-0 z-30 px-4 py-3 sm:hidden"
            style={{ backgroundColor: 'var(--emp-bar)', borderBottom: '1px solid var(--emp-border)' }}
        >
            <div className="flex items-center gap-2">
                <Link
                    href={backHref}
                    aria-label="Volver"
                    className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg"
                    style={{ color: 'var(--emp-muted)' }}
                >
                    <ArrowLeft size={19} />
                </Link>
                <p className="min-w-0 flex-1 truncate text-[17px]" style={{ color: 'var(--emp-text)' }}>
                    {title}
                </p>
                <span className="shrink-0 text-[12px]" style={{ color: 'var(--emp-muted)' }}>
                    {current + 1} de {steps.length}
                </span>
            </div>

            <div className="mt-2 flex gap-1.5" aria-hidden="true">
                {steps.map((step, index) => (
                    <span
                        key={step.key}
                        className="h-[3px] flex-1 rounded-full"
                        style={{
                            backgroundColor:
                                index < current || completed[index] || index === current
                                    ? 'var(--emp-accent)'
                                    : 'var(--emp-border)',
                            opacity: index > current && !completed[index] ? 0.5 : 1,
                        }}
                    />
                ))}
            </div>

            <div className="mt-2 flex items-center gap-2">
                <p className="min-w-0 flex-1 truncate text-[12px]" style={{ color: 'var(--emp-muted)' }}>
                    {steps[current]?.label}
                </p>
                <div className="flex shrink-0 gap-1">
                    {steps.map((step, index) =>
                        index === current ? null : (
                            <button
                                key={step.key}
                                type="button"
                                // Solo se salta a lo ya resuelto: hacia adelante manda la validacion.
                                disabled={!completed[index] && index > current}
                                onClick={() => onSelect(index)}
                                aria-label={`Ir al paso ${index + 1}: ${step.label}`}
                                className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] disabled:opacity-40"
                                style={{
                                    border: '1px solid var(--emp-border)',
                                    color: completed[index] ? 'var(--emp-accent-on)' : 'var(--emp-muted)',
                                    backgroundColor: completed[index] ? 'var(--emp-accent-fill)' : 'transparent',
                                }}
                            >
                                {completed[index] ? <Check size={11} weight="bold" /> : index + 1}
                            </button>
                        ),
                    )}
                </div>
            </div>
        </header>
    );
}

interface BarProps {
    /** Lo que falta del paso actual; en blanco no se pinta la linea. */
    pending?: string;
    onBack?: () => void;
    backLabel?: string;
    onNext: () => void;
    nextLabel: string;
    processing?: boolean;
    /** El ultimo paso envia el formulario; los demas solo avanzan. */
    submit?: boolean;
}

/**
 * Barra fija inferior del formulario por pasos.
 *
 * La accion principal ocupa el doble que «Atras»: en el pulgar, avanzar es lo que se
 * hace nueve de cada diez veces.
 */
export function EmployeeStepsBar({
    pending,
    onBack,
    backLabel = 'Atrás',
    onNext,
    nextLabel,
    processing = false,
    submit = false,
}: BarProps) {
    return (
        <div className="px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {pending ? (
                <p className="mb-2 truncate text-[11px]" style={{ color: 'var(--emp-subtle)' }}>
                    {pending}
                </p>
            ) : null}

            <div className="flex gap-2">
                {onBack ? (
                    <button type="button" onClick={onBack} className="emp-btn flex-1">
                        {backLabel}
                    </button>
                ) : null}
                <button
                    type={submit ? 'submit' : 'button'}
                    onClick={submit ? undefined : onNext}
                    disabled={processing}
                    className={`emp-btn emp-btn-primary ${onBack ? 'flex-[2]' : 'flex-1'}`}
                >
                    {processing ? 'Guardando…' : nextLabel}
                </button>
            </div>
        </div>
    );
}
