import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
    animates,
    backgroundStyle,
    colorValue,
    overlayStyle,
    parallaxFactor,
    resolveAppearance,
    shellStyle,
    type Appearance,
} from '@/Components/Public/appearance';

/**
 * Envoltura común de las secciones de la landing pública.
 *
 * Los bloques solo dibujan su contenido; el alto, el ancho, el espacio, el fondo
 * y la animación de entrada los pone este componente a partir de la apariencia
 * que definió el super usuario. Así cualquier bloque —incluidos los que se
 * agreguen después— queda parametrizado sin tocar su propio código.
 */

type Dict = Record<string, unknown>;

interface Props {
    /** Valores por defecto del tipo de bloque (config/landing_blocks.php). */
    defaults?: Dict;
    /** Lo guardado en `data.appearance`. */
    appearance?: unknown;
    id?: string;
    children: ReactNode;
    /** En la vista previa del editor el revelado se repite al cambiar ajustes. */
    replayKey?: string;
}

/** El bloque se considera visible cuando ha entrado un 15% en la pantalla. */
const OBSERVER: IntersectionObserverInit = { threshold: 0.15, rootMargin: '0px 0px -8% 0px' };

/*
 * Marca que hay JavaScript. La regla que esconde las piezas antes de revelarlas cuelga
 * de esta clase, asi que sin este modulo cargado el contenido nunca queda invisible.
 */
if (typeof document !== 'undefined') {
    document.documentElement.classList.add('pub-js');
}

export function BlockShell({ defaults, appearance, id, children, replayKey }: Props) {
    const a = resolveAppearance(defaults, appearance);
    const conAnimacion = animates(a);
    const ref = useRef<HTMLElement | null>(null);
    const capa = useRef<HTMLDivElement | null>(null);
    const [visible, setVisible] = useState(!conAnimacion);

    /* Revelado al entrar en pantalla. Sin IntersectionObserver el bloque se
       muestra de una vez: nunca puede quedar contenido invisible. */
    useEffect(() => {
        if (!conAnimacion) {
            setVisible(true);

            return;
        }

        const el = ref.current;
        if (!el || typeof IntersectionObserver === 'undefined') {
            setVisible(true);

            return;
        }

        setVisible(false);

        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) {
                setVisible(true);
                // `anim_once` deja la sección quieta después de la primera vez.
                if (a.anim_once) observer.disconnect();
            } else if (!a.anim_once) {
                setVisible(false);
            }
        }, OBSERVER);

        observer.observe(el);

        return () => observer.disconnect();
    }, [conAnimacion, a.anim_once, replayKey]);

    /* Paralaje del fondo: desplaza la capa según lo recorrido, en un frame de
       animación para no bloquear el scroll. */
    const factor = parallaxFactor(a);

    useEffect(() => {
        if (!factor || typeof window === 'undefined') return;
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

        let frame = 0;

        const update = () => {
            frame = 0;
            const el = ref.current;
            const layer = capa.current;
            if (!el || !layer) return;

            const rect = el.getBoundingClientRect();
            const alto = window.innerHeight || 1;
            // Dónde está el centro del bloque respecto al de la pantalla, acotado a
            // -0.5…0.5 para que el desplazamiento nunca pase de la mitad del factor y
            // el margen extra de la capa siempre alcance a taparlo.
            const bruto = (rect.top + rect.height / 2 - alto / 2) / alto;
            const avance = Math.max(-0.5, Math.min(0.5, bruto));
            layer.style.transform = `translate3d(0, ${(-avance * factor).toFixed(1)}px, 0)`;
        };

        const onScroll = () => {
            if (!frame) frame = window.requestAnimationFrame(update);
        };

        update();
        // En captura: el evento `scroll` no burbujea, y en el editor la página vive
        // dentro de un panel con su propio desplazamiento.
        window.addEventListener('scroll', onScroll, { passive: true, capture: true });
        window.addEventListener('resize', onScroll, { passive: true });

        return () => {
            if (frame) window.cancelAnimationFrame(frame);
            window.removeEventListener('scroll', onScroll, true);
            window.removeEventListener('resize', onScroll);
        };
    }, [factor, a.bg_image, a.bg_type]);

    const fondo = backgroundStyle(a);
    const velo = overlayStyle(a);
    const textura = a.bg_type === 'texture' ? a.bg_texture : null;
    const degradado = a.bg_type === 'gradient' ? a.bg_gradient : null;
    // Con textura o degradado el color elegido sirve de base debajo de la capa.
    const base = a.bg_type !== 'color' ? colorValue(a.bg_color) : null;

    return (
        <section
            ref={ref}
            id={id}
            className={`pub-block${conAnimacion ? ' pub-reveal' : ''}`}
            data-visible={visible ? 'true' : 'false'}
            style={{ ...shellStyle(a), ...(base ? { backgroundColor: base } : null) }}
        >
            {fondo ? (
                <div
                    ref={capa}
                    className="pub-block-layer"
                    data-parallax={factor ? 'on' : undefined}
                    style={fondo}
                    aria-hidden="true"
                />
            ) : null}

            {textura ? <div className="pub-block-layer pub-texture" data-texture={textura} aria-hidden="true" /> : null}

            {degradado ? (
                <div className="pub-block-layer pub-gradient" data-gradient={degradado} aria-hidden="true" />
            ) : null}

            {velo ? <div className="pub-block-layer" style={velo} aria-hidden="true" /> : null}

            <div className="pub-block-inner">{children}</div>
        </section>
    );
}

/**
 * Estilo de una pieza animable dentro del bloque: `--pub-part` es su turno en el
 * escalonado. Las piezas no se anidan; si una envuelve a otra, ambas se moverían.
 */
export function part(index: number, style?: React.CSSProperties): React.CSSProperties {
    return { ...style, ['--pub-part' as string]: index } as React.CSSProperties;
}

export type { Appearance };
