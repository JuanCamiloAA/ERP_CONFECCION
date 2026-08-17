type Dict = Record<string, unknown>;

const n = (v: unknown): number => (Array.isArray(v) ? v.length : 0);
const plural = (c: number, one: string, many: string) => `${c} ${c === 1 ? one : many}`;

/**
 * Resumen del contenido de un bloque para la lista del editor
 * ("Marca · 5 enlaces · 1 botón", "4 pasos con ícono", …).
 */
export function summarize(type: string, data: Dict | null | undefined): string {
    const d = data ?? {};

    switch (type) {
        case 'header':
            return `Marca · ${plural(n(d.links), 'enlace', 'enlaces')} · 1 botón`;
        case 'hero':
            return `Etiqueta · título · 2 botones · ${plural(n(d.trust), 'sello', 'sellos')}`;
        case 'flow':
            return `${plural(n(d.steps), 'paso', 'pasos')} con ícono`;
        case 'band':
            return `Título · ${plural(n(d.items), 'promesa', 'promesas')}`;
        case 'virtues':
            return `${plural(n(d.cards), 'tarjeta', 'tarjetas')} · rejilla de 3`;
        case 'audience': {
            const roles = Array.isArray(d.roles) ? (d.roles as Dict[]) : [];
            const pts = roles[0] ? n(roles[0].points) : 0;
            return `${plural(roles.length, 'rol', 'roles')} · ${pts} puntos cada uno`;
        }
        case 'steps_media':
            return `${plural(n(d.steps), 'paso', 'pasos')} · 1 imagen`;
        case 'quote':
            return d.text ? 'Cita con autor' : 'Sin testimonio cargado';
        case 'closing':
            return 'Título · 2 botones';
        case 'footer':
            return `Aviso · ${plural(n(d.links), 'enlace', 'enlaces')}`;
        default:
            return '';
    }
}
