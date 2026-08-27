interface Props {
    checked: boolean;
    onChange: (checked: boolean) => void;
    /** Se lee con lector de pantalla; el texto visible va aparte. */
    label: string;
    disabled?: boolean;
    /** 32×18 en la fila del listado, 38×22 en el formulario. */
    size?: 'sm' | 'md';
}

/**
 * Interruptor real, no una pastilla que hay que ir a cambiar a otra pantalla.
 *
 * Es un `<button role="switch">` con `aria-checked`: el color no es lo único que
 * comunica el estado, y el teclado lo alterna con Espacio como cualquier casilla.
 */
export function WidgetSwitch({ checked, onChange, label, disabled = false, size = 'sm' }: Props) {
    const width = size === 'sm' ? 32 : 38;
    const height = size === 'sm' ? 18 : 22;
    const knob = height - 6;

    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={label}
            disabled={disabled}
            onClick={() => onChange(! checked)}
            className="relative shrink-0 rounded-full transition-colors disabled:opacity-50"
            style={{
                width: `${width}px`,
                height: `${height}px`,
                backgroundColor: checked ? 'var(--emp-accent)' : 'var(--emp-row)',
                border: `1px solid ${checked ? 'var(--emp-accent)' : 'var(--emp-border)'}`,
            }}
        >
            <span
                aria-hidden="true"
                className="absolute top-1/2 block rounded-full transition-all"
                style={{
                    width: `${knob}px`,
                    height: `${knob}px`,
                    transform: 'translateY(-50%)',
                    left: checked ? `${width - knob - 4}px` : '2px',
                    backgroundColor: checked ? 'var(--emp-surface)' : 'var(--emp-subtle)',
                }}
            />
        </button>
    );
}

export default WidgetSwitch;
