import type { CSSProperties } from 'react';
import { phosphorIcon } from '@/Components/Public/phosphorIcon';

/** Logo del producto tal como lo resuelve App\Support\LandingBrandLogo. */
export interface BrandLogo {
    type?: string | null;
    /** Nombre Phosphor ("ph-needle"); es lo que se dibuja cuando no hay imagen. */
    icon?: string | null;
    /** URL de la imagen subida, solo cuando `type` es "image". */
    url?: string | null;
}

interface Props {
    logo?: BrandLogo | null;
    /** Clases del recuadro cuando el logo es un ícono; debe centrar su contenido. */
    className?: string;
    /** Clases de la imagen cuando el logo es una imagen; por defecto, las del recuadro. */
    imageClassName?: string;
    style?: CSSProperties;
    /** Tamaño del ícono en píxeles. Sin efecto sobre la imagen, que la dimensiona su clase. */
    size?: number;
}

/**
 * Marca del producto: el logo que el super usuario elige en el editor de la landing.
 *
 * Se dibuja donde no hay logo de empresa — el banner de acceso y la barra lateral sin
 * contexto de empresa —, así que un cambio en la landing se ve en toda la aplicación.
 * Los dos casos llevan clases distintas porque el ícono va dentro de un recuadro y la
 * imagen ocupa el espacio ella misma.
 */
export function BrandMark({ logo, className = '', imageClassName, style, size = 18 }: Props) {
    if (logo?.type === 'image' && logo.url) {
        return <img src={logo.url} alt="" className={`object-contain ${imageClassName ?? className}`} style={style} />;
    }

    return (
        <span className={className} style={style}>
            {phosphorIcon(logo?.icon || 'ph-needle', size)}
        </span>
    );
}
