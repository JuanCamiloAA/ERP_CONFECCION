import { CheckIcon } from '@heroicons/react/24/outline';

export interface ItemChecklist {
    label: string;
    listo: boolean;
    /** Se muestra como «— opcional» y no cuenta para el progreso. */
    opcional?: boolean;
}

/**
 * Lo que falta para poder guardar.
 *
 * Es la unica fuente de verdad del progreso: el contador «n de 4» del encabezado y la
 * barra de movil salen de esta misma lista, de modo que nunca puedan discrepar.
 */
export function itemsChecklist(datos: {
    code: string;
    name: string;
    payment: number | '';
    lote: number | '';
    tieneImagen: boolean;
}): ItemChecklist[] {
    return [
        { label: 'Código y nombre', listo: datos.code.trim() !== '' && datos.name.trim() !== '' },
        { label: 'Valor unitario de pago', listo: datos.payment !== '' && Number(datos.payment) > 0 },
        { label: 'Cantidad del lote', listo: datos.lote !== '' && Number(datos.lote) > 0 },
        { label: 'Imagen', listo: datos.tieneImagen, opcional: true },
    ];
}

/** Cuantos requisitos obligatorios estan cumplidos y cuantos hay en total. */
export function progresoChecklist(items: ItemChecklist[]): { hechos: number; total: number } {
    const obligatorios = items.filter((i) => !i.opcional);

    return { hechos: obligatorios.filter((i) => i.listo).length, total: obligatorios.length };
}

export function ReferenceSaveChecklist({ items }: { items: ItemChecklist[] }) {
    return (
        <ul className="space-y-2">
            {items.map((item) => (
                <li key={item.label} className="flex items-center gap-2 text-[12px]">
                    <span
                        className="flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px]"
                        style={{
                            border: `1px solid ${item.listo ? 'var(--ref-accent)' : 'var(--ref-border)'}`,
                            backgroundColor: item.listo ? 'var(--ref-accent-soft)' : 'transparent',
                            color: 'var(--ref-accent-on)',
                        }}
                    >
                        {item.listo ? <CheckIcon className="h-3 w-3" strokeWidth={2.5} /> : null}
                    </span>
                    <span style={{ color: item.listo ? 'var(--ref-text)' : 'var(--ref-muted)' }}>
                        {item.label}
                        {item.opcional ? <span style={{ color: 'var(--ref-subtle)' }}> — opcional</span> : null}
                    </span>
                </li>
            ))}
        </ul>
    );
}
