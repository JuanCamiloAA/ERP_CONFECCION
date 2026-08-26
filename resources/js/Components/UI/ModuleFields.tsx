import { CaretDown } from '@phosphor-icons/react';
import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

/**
 * Campos de los modulos con la piel nueva (empleados y produccion).
 *
 * Los componentes de `Components/UI` siguen la escala slate del resto del producto; este
 * modulo tiene su propia paleta, y mezclarlas dejaria la mitad de la pantalla con otro
 * gris. En lugar de reescribir los componentes compartidos —que usan otras veinte
 * pantallas— el modulo trae los suyos, delgados, sobre las clases `emp-*`.
 */

interface WrapProps {
    label?: string;
    required?: boolean;
    help?: string;
    error?: string;
    htmlFor?: string;
    className?: string;
    children: ReactNode;
}

export function EmpField({ label, required, help, error, htmlFor, className, children }: WrapProps) {
    return (
        <div className={`min-w-0 ${className ?? ''}`}>
            {label ? (
                <label className="emp-label" htmlFor={htmlFor}>
                    {label} {required ? <span className="emp-req">*</span> : null}
                </label>
            ) : null}
            {children}
            {help ? <p className="emp-help">{help}</p> : null}
            {error ? <p className="emp-error">{error}</p> : null}
        </div>
    );
}

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> {
    label?: string;
    help?: string;
    error?: string;
    /** Simbolo a la izquierda del valor (dinero). */
    prefix?: string;
    containerClassName?: string;
}

export function EmpInput({ label, help, error, prefix, containerClassName, required, id, ...props }: InputProps) {
    const generated = useId();
    const inputId = id ?? generated;

    return (
        <EmpField
            label={label}
            required={required}
            help={help}
            error={error}
            htmlFor={inputId}
            className={containerClassName}
        >
            <div className="relative">
                {prefix ? (
                    <span
                        className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[13px]"
                        style={{ color: 'var(--emp-subtle)' }}
                    >
                        {prefix}
                    </span>
                ) : null}
                <input
                    id={inputId}
                    required={required}
                    className={`emp-field ${prefix ? 'pl-6' : ''} ${error ? 'emp-field-error' : ''}`}
                    {...props}
                />
            </div>
        </EmpField>
    );
}

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'className'> {
    label?: string;
    help?: string;
    error?: string;
    placeholder?: string;
    options: { value: string | number; label: string }[];
    containerClassName?: string;
}

export function EmpSelect({
    label,
    help,
    error,
    placeholder,
    options,
    containerClassName,
    required,
    id,
    ...props
}: SelectProps) {
    const generated = useId();
    const selectId = id ?? generated;

    return (
        <EmpField
            label={label}
            required={required}
            help={help}
            error={error}
            htmlFor={selectId}
            className={containerClassName}
        >
            <div className="relative">
                <select
                    id={selectId}
                    required={required}
                    className={`emp-field ${error ? 'emp-field-error' : ''}`}
                    {...props}
                >
                    {placeholder ? <option value="">{placeholder}</option> : null}
                    {options.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
                <CaretDown
                    size={13}
                    className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2"
                    style={{ color: 'var(--emp-subtle)' }}
                />
            </div>
        </EmpField>
    );
}

interface TextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'className'> {
    label?: string;
    help?: string;
    error?: string;
    containerClassName?: string;
}

export function EmpTextarea({ label, help, error, containerClassName, required, id, ...props }: TextareaProps) {
    const generated = useId();
    const areaId = id ?? generated;

    return (
        <EmpField
            label={label}
            required={required}
            help={help}
            error={error}
            htmlFor={areaId}
            className={containerClassName}
        >
            <textarea id={areaId} className={`emp-field ${error ? 'emp-field-error' : ''}`} {...props} />
        </EmpField>
    );
}

/**
 * Interruptor de 40×22. Toda la fila es el objetivo tactil, no solo el control.
 */
export function EmpSwitch({
    checked,
    onChange,
    label,
    description,
    disabled,
}: {
    checked: boolean;
    onChange: (value: boolean) => void;
    label: string;
    description?: string;
    disabled?: boolean;
}) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            disabled={disabled}
            onClick={() => onChange(!checked)}
            className="flex w-full items-center justify-between gap-3 text-left disabled:opacity-60"
            style={{ minHeight: '48px' }}
        >
            <span className="min-w-0">
                <span className="block text-[13px]" style={{ color: 'var(--emp-text)' }}>
                    {label}
                </span>
                {description ? (
                    <span className="mt-0.5 block text-[11px]" style={{ color: 'var(--emp-subtle)' }}>
                        {description}
                    </span>
                ) : null}
            </span>
            <span
                aria-hidden="true"
                className="relative shrink-0 rounded-full transition-colors"
                style={{
                    width: '40px',
                    height: '22px',
                    backgroundColor: checked ? 'var(--emp-accent)' : 'var(--emp-border)',
                }}
            >
                <span
                    className="absolute top-[3px] rounded-full bg-white transition-all"
                    style={{ width: '16px', height: '16px', left: checked ? '21px' : '3px' }}
                />
            </span>
        </button>
    );
}

const DOCUMENT_TYPES = [
    { value: 'CC', label: 'CC' },
    { value: 'CE', label: 'CE' },
    { value: 'TI', label: 'TI' },
    { value: 'PAS', label: 'PAS' },
    { value: 'NIT', label: 'NIT' },
];

/**
 * Documento: un solo borde para el tipo y el numero.
 *
 * Antes eran dos campos de media fila cada uno. El tipo casi nunca cambia —es «CC» en
 * nueve de cada diez casos— y no merece el mismo peso visual que el numero.
 */
export function EmpDocumentField({
    type,
    number,
    onTypeChange,
    onNumberChange,
    typeError,
    numberError,
    containerClassName,
    id,
}: {
    type: string;
    number: string;
    onTypeChange: (value: string) => void;
    onNumberChange: (value: string) => void;
    typeError?: string;
    numberError?: string;
    containerClassName?: string;
    /** Id del campo del numero; el formulario lo usa para llevar el foco a lo que falta. */
    id?: string;
}) {
    const generated = useId();
    const inputId = id ?? generated;

    return (
        <EmpField
            label="Documento"
            required
            error={typeError ?? numberError}
            htmlFor={inputId}
            className={containerClassName}
        >
            <div className="emp-compound" style={typeError || numberError ? { borderColor: 'var(--emp-danger)' } : undefined}>
                <select value={type} onChange={(e) => onTypeChange(e.target.value)} aria-label="Tipo de documento">
                    {DOCUMENT_TYPES.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
                <input
                    id={inputId}
                    value={number}
                    onChange={(e) => onNumberChange(e.target.value)}
                    inputMode="numeric"
                    placeholder="Número"
                    aria-label="Número de documento"
                />
            </div>
        </EmpField>
    );
}
