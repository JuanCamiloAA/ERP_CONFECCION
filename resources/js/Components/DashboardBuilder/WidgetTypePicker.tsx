import type { WidgetType } from '@/Components/DashboardBuilder/dashboard-builder-types';
import { TYPE_ICONS, TYPE_LONG_LABELS, WIDGET_TYPES } from '@/lib/dashboard-widgets';

interface Props {
    value: WidgetType;
    onChange: (type: WidgetType) => void;
}

/**
 * El tipo de widget, viéndolo.
 *
 * Era un `<select>` con cinco nombres; elegir entre «barras» y «líneas» leyendo una lista
 * desplegable es más lento que verlas.
 */
export function WidgetTypePicker({ value, onChange }: Props) {
    return (
        <div className="grid grid-cols-3 gap-2 lg:grid-cols-5">
            {WIDGET_TYPES.map((type) => {
                const Icon = TYPE_ICONS[type];
                const active = value === type;

                return (
                    <button
                        key={type}
                        type="button"
                        onClick={() => onChange(type)}
                        aria-pressed={active}
                        className="flex flex-col items-center justify-center gap-1.5 rounded-[10px]"
                        style={{
                            height: '66px',
                            border: `1px solid ${active ? 'var(--emp-accent)' : 'var(--emp-border)'}`,
                            backgroundColor: active ? 'var(--emp-accent-fill)' : 'transparent',
                            color: active ? 'var(--emp-accent-on)' : 'var(--emp-muted)',
                        }}
                    >
                        <Icon size={20} />
                        <span className="px-1 text-center text-[12px] leading-tight">{TYPE_LONG_LABELS[type]}</span>
                    </button>
                );
            })}
        </div>
    );
}

export default WidgetTypePicker;
