import * as HeroIcons from '@heroicons/react/24/outline';
import { MagnifyingGlass, Prohibit } from '@phosphor-icons/react';
import { useMemo, useState } from 'react';
import { Modal } from '@/Components/UI/Modal';
import { iconLabel, KPI_ICON_OPTIONS } from '@/lib/dashboard-widgets';

/** Cuántos iconos se ven sin abrir el catálogo completo. */
const INLINE_COUNT = 6;

type HeroIconComponent = typeof HeroIcons.SparklesIcon;

function resolve(name: string): HeroIconComponent | null {
    return (HeroIcons as unknown as Record<string, HeroIconComponent>)[name] ?? null;
}

interface Props {
    value: string;
    onChange: (icon: string) => void;
}

/**
 * Selector del icono del KPI.
 *
 * Los nombres que se guardan son de Heroicons porque es lo que resuelve el Dashboard al
 * pintar la tarjeta (ver `lib/dashboard-widgets.ts`); lo que cambia es que aquí se elige
 * **viendo** el icono y no leyendo `ClipboardDocumentListIcon`.
 */
export function IconPicker({ value, onChange }: Props) {
    const [open, setOpen] = useState(false);
    const [term, setTerm] = useState('');

    /** El elegido va siempre entre los visibles, aunque esté al final del catálogo. */
    const inline = useMemo(() => {
        const head = KPI_ICON_OPTIONS.slice(0, INLINE_COUNT) as unknown as string[];

        if (value && ! head.includes(value)) {
            return [value, ...head.slice(0, INLINE_COUNT - 1)];
        }

        return head;
    }, [value]);

    const extra = KPI_ICON_OPTIONS.length - inline.length;

    const filtered = useMemo(() => {
        const needle = term.trim().toLowerCase();
        if (needle === '') return KPI_ICON_OPTIONS as unknown as string[];

        return (KPI_ICON_OPTIONS as unknown as string[]).filter((name) =>
            iconLabel(name).toLowerCase().includes(needle),
        );
    }, [term]);

    const tile = (name: string, size = 38) => {
        const Icon = resolve(name);
        const active = value === name;

        if (! Icon) return null;

        return (
            <button
                key={name}
                type="button"
                onClick={() => {
                    onChange(name);
                    setOpen(false);
                }}
                aria-pressed={active}
                aria-label={iconLabel(name)}
                title={iconLabel(name)}
                className="flex items-center justify-center rounded-[10px]"
                style={{
                    width: `${size}px`,
                    height: `${size}px`,
                    border: `1px solid ${active ? 'var(--emp-accent)' : 'var(--emp-border)'}`,
                    backgroundColor: active ? 'var(--emp-accent-fill)' : 'transparent',
                    color: active ? 'var(--emp-accent-on)' : 'var(--emp-muted)',
                }}
            >
                <Icon className="h-[18px] w-[18px]" />
            </button>
        );
    };

    return (
        <div>
            <div className="flex flex-wrap items-center gap-2">
                <button
                    type="button"
                    onClick={() => onChange('')}
                    aria-pressed={value === ''}
                    aria-label="Sin icono"
                    title="Sin icono"
                    className="flex items-center justify-center rounded-[10px]"
                    style={{
                        width: '38px',
                        height: '38px',
                        border: `1px solid ${value === '' ? 'var(--emp-accent)' : 'var(--emp-border)'}`,
                        backgroundColor: value === '' ? 'var(--emp-accent-fill)' : 'transparent',
                        color: value === '' ? 'var(--emp-accent-on)' : 'var(--emp-subtle)',
                    }}
                >
                    <Prohibit size={16} />
                </button>

                {inline.map((name) => tile(name))}

                {extra > 0 ? (
                    <button
                        type="button"
                        onClick={() => setOpen(true)}
                        className="flex items-center justify-center rounded-[10px] text-[12px]"
                        style={{
                            height: '38px',
                            minWidth: '44px',
                            padding: '0 8px',
                            border: '1px solid var(--emp-border)',
                            color: 'var(--emp-muted)',
                        }}
                    >
                        +{extra}
                    </button>
                ) : null}
            </div>

            <p className="emp-help">Se elige viendo el icono, no su nombre en inglés.</p>

            <Modal open={open} onClose={() => setOpen(false)} title="Elegir icono" size="lg">
                <div className="emp-scope">
                    <div className="relative">
                        <MagnifyingGlass
                            size={15}
                            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2"
                            style={{ color: 'var(--emp-subtle)' }}
                        />
                        <input
                            value={term}
                            onChange={(e) => setTerm(e.target.value)}
                            placeholder="Buscar icono…"
                            aria-label="Buscar icono"
                            className="emp-field pl-8"
                        />
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                        {filtered.length === 0 ? (
                            <p className="text-[12.5px]" style={{ color: 'var(--emp-muted)' }}>
                                Ningún icono coincide con «{term}».
                            </p>
                        ) : (
                            filtered.map((name) => tile(name, 44))
                        )}
                    </div>
                </div>
            </Modal>
        </div>
    );
}

export default IconPicker;
