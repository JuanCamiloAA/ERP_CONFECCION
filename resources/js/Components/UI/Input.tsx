import { forwardRef, useState, type ChangeEvent, type FocusEvent, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
    label?: string;
    error?: string;
    description?: string;
    prefix?: ReactNode;
    suffix?: ReactNode;
    containerClassName?: string;
}

/** Cuantos decimales mostrar segun el `step` (ej. "0.01" -> 2, "0.1" -> 1, sin step -> 0). */
function decimalScaleFromStep(step: InputHTMLAttributes<HTMLInputElement>['step']): number {
    if (step === undefined || step === null) return 0;
    const s = String(step);
    const dot = s.indexOf('.');
    return dot === -1 ? 0 : s.length - dot - 1;
}

/** Miles con "." y decimales con "," (es-CO), solo para mostrar mientras el campo no tiene el foco. */
function formatNumericDisplay(value: InputHTMLAttributes<HTMLInputElement>['value'], decimalScale: number): string {
    if (value === undefined || value === null || value === '') return '';
    const str = Array.isArray(value) ? '' : String(value);
    if (str.trim() === '' || str === '-') return str;
    const num = parseFloat(str);
    if (Number.isNaN(num)) return str;
    return new Intl.NumberFormat('es-CO', {
        minimumFractionDigits: decimalScale,
        maximumFractionDigits: decimalScale,
    }).format(num);
}

/**
 * Deja solo digitos, un "-" inicial y un separador decimal.
 * Si hay coma, se asume formato agrupado ("1.500.000,50"): la coma es el decimal y los puntos son de miles.
 * Si no hay coma pero hay mas de un punto (ej. pegar "1.500.000"), los puntos tambien se toman como miles.
 * Con un solo punto y sin coma se interpreta como decimal directo (escritura normal, ej. "150.5").
 */
function sanitizeNumericInput(raw: string): string {
    let s = raw.trim();
    const negative = s.startsWith('-');
    s = s.replace(/-/g, '');

    const dotCount = (s.match(/\./g) ?? []).length;
    if (s.includes(',')) {
        s = s.replace(/\./g, '').replace(/,/g, '.');
    } else if (dotCount > 1) {
        s = s.replace(/\./g, '');
    }

    s = s.replace(/[^0-9.]/g, '');
    const firstDot = s.indexOf('.');
    if (firstDot !== -1) {
        s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, '');
    }
    return (negative ? '-' : '') + s;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
    (
        {
            label,
            error,
            description,
            prefix,
            suffix,
            className,
            containerClassName,
            id,
            required,
            type,
            value,
            step,
            inputMode,
            onChange,
            onFocus,
            onBlur,
            ...props
        },
        ref,
    ) => {
        const inputId = id || `input-${Math.random().toString(36).slice(2)}`;
        const isNumeric = type === 'number';
        const [focused, setFocused] = useState(false);
        // Mientras se edita, el texto se guarda aparte del valor numerico del padre: si se deriva
        // del valor ya redondeado/parseado en cada tecla, un separador decimal recien escrito sin
        // digitos despues (ej. "0,") se pierde de inmediato porque parseFloat("0,") vuelve a dar "0".
        const [rawText, setRawText] = useState<string | null>(null);
        const decimalScale = decimalScaleFromStep(step);

        const displayValue = isNumeric
            ? focused
                ? (rawText ?? (value === undefined || value === null ? '' : String(value)))
                : formatNumericDisplay(value, decimalScale)
            : (value ?? '');

        const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
            if (isNumeric) {
                const sanitized = sanitizeNumericInput(e.target.value);
                setRawText(sanitized);
                e.target.value = sanitized;
            }
            onChange?.(e);
        };

        const handleFocus = (e: FocusEvent<HTMLInputElement>) => {
            if (isNumeric) {
                setFocused(true);
                setRawText(value === undefined || value === null ? '' : String(value));
            }
            onFocus?.(e);
        };

        const handleBlur = (e: FocusEvent<HTMLInputElement>) => {
            if (isNumeric) {
                setFocused(false);
                setRawText(null);
            }
            onBlur?.(e);
        };

        return (
            <div className={cn('w-full', containerClassName)}>
                {label && (
                    <label
                        htmlFor={inputId}
                        className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
                    >
                        {label}
                        {required && <span className="ml-0.5 text-rose-500">*</span>}
                    </label>
                )}
                <div
                    className={cn(
                        'relative flex items-center overflow-hidden rounded-lg border bg-white transition-colors',
                        'border-slate-300 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20',
                        'dark:bg-slate-800 dark:border-slate-700 dark:focus-within:border-indigo-400',
                        error && 'border-rose-500 focus-within:border-rose-500 focus-within:ring-rose-500/20',
                        props.disabled && 'bg-slate-50 dark:bg-slate-900 opacity-60',
                    )}
                >
                    {prefix && (
                        <span className="flex h-10 items-center pl-3 text-slate-400 dark:text-slate-500">
                            {prefix}
                        </span>
                    )}
                    <input
                        ref={ref}
                        id={inputId}
                        required={required}
                        type={isNumeric ? 'text' : type}
                        inputMode={isNumeric ? 'decimal' : inputMode}
                        value={displayValue}
                        step={step}
                        onChange={handleChange}
                        onFocus={handleFocus}
                        onBlur={handleBlur}
                        className={cn(
                            // min-w-0: sin esto el ancho intrinseco del input (~20 caracteres) actua
                            // como minimo y desborda cuando vive en una fila flex angosta (ej. el
                            // stepper de cantidad entre dos botones en movil).
                            'min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400',
                            'dark:text-slate-100 dark:placeholder:text-slate-500',
                            prefix && 'pl-2',
                            suffix && 'pr-2',
                            className,
                        )}
                        {...props}
                    />
                    {suffix && (
                        <span className="flex h-10 items-center pr-3 text-slate-400 dark:text-slate-500">
                            {suffix}
                        </span>
                    )}
                </div>
                {description && !error && (
                    <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">{description}</p>
                )}
                {error && <p className="mt-1.5 text-xs text-rose-500">{error}</p>}
            </div>
        );
    },
);

Input.displayName = 'Input';

export default Input;
