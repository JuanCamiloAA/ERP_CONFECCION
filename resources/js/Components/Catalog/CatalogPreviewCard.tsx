import { EmployeeAsideCard } from '@/Components/Employees/EmployeeFormLayout';
import type { CatalogSibling } from '@/Components/Catalog/CatalogOrderField';

interface Props {
    /** «Selector de categoría al registrar un gasto», por ejemplo. */
    subtitle: string;
    siblings: CatalogSibling[];
    currentId: number | null;
    currentName: string;
    position: number;
}

const MAX_VISIBLE = 6;

/**
 * Como se vera el catalogo donde de verdad se usa.
 *
 * Al crear una categoria no hay forma de anticipar el resultado sin ir a registrar un
 * gasto; esta tarjeta pinta las mismas pastillas del selector, con la nueva resaltada.
 */
export function CatalogPreviewCard({ subtitle, siblings, currentId, currentName, position }: Props) {
    const others = siblings.filter((sibling) => sibling.id !== currentId && sibling.is_active);
    const list: { key: string; name: string; current: boolean }[] = others.map((sibling) => ({
        key: String(sibling.id),
        name: sibling.name,
        current: false,
    }));

    list.splice(Math.max(0, Math.min(position, list.length)), 0, {
        key: 'current',
        name: currentName || 'Sin nombre todavía',
        current: true,
    });

    const visible = list.slice(0, MAX_VISIBLE);
    const hidden = list.length - visible.length;

    return (
        <EmployeeAsideCard title="Cómo se verá" subtitle={subtitle}>
            <div className="mt-2 flex flex-wrap gap-1.5">
                {visible.map((item) => (
                    <span key={item.key} className={`emp-pill ${item.current ? 'emp-pill-accent' : ''}`}>
                        {item.name}
                    </span>
                ))}
            </div>

            {hidden > 0 ? (
                <p className="mt-2 text-[11px]" style={{ color: 'var(--emp-subtle)' }}>
                    y {hidden} {hidden === 1 ? 'más' : 'más'} en la lista.
                </p>
            ) : null}
        </EmployeeAsideCard>
    );
}

export default CatalogPreviewCard;
