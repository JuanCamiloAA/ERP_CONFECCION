import { ArrowDownTrayIcon, MagnifyingGlassMinusIcon, MagnifyingGlassPlusIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ImgHTMLAttributes,
    type PointerEvent as ReactPointerEvent,
    type ReactNode,
} from 'react';
import { cn } from '@/lib/utils';

/** Imagen que se esta viendo en grande. */
export interface ImagenAmpliada {
    src: string;
    alt?: string;
    /** Encabezado del visor; por defecto, el texto alternativo. */
    title?: string;
    /** URL de descarga si es distinta de la que se muestra. */
    downloadUrl?: string;
}

const ESCALA_MIN = 1;
const ESCALA_MAX = 8;

const acotar = (valor: number, min: number, max: number): number => Math.min(max, Math.max(min, valor));

interface Contexto {
    abrir: (imagen: ImagenAmpliada) => void;
}

const ImageLightboxContext = createContext<Contexto | null>(null);

/**
 * Da acceso al visor de imagenes a cualquier pantalla que cuelgue del proveedor.
 *
 * Devuelve null fuera de el, para que un componente compartido pueda usarse tambien donde
 * no hay visor montado (la landing publica, por ejemplo) sin romperse.
 */
export function useImageLightbox(): Contexto | null {
    return useContext(ImageLightboxContext);
}

/**
 * Monta un unico visor para toda la aplicacion.
 *
 * Va en el layout: asi cualquier imagen puede abrirse en grande sin que cada pantalla
 * tenga que llevar su propio estado ni su propio modal.
 */
export function ImageLightboxProvider({ children }: { children: ReactNode }) {
    const [imagen, setImagen] = useState<ImagenAmpliada | null>(null);

    const valor = useMemo<Contexto>(() => ({ abrir: setImagen }), []);

    return (
        <ImageLightboxContext.Provider value={valor}>
            {children}
            <ImageLightbox imagen={imagen} onClose={() => setImagen(null)} />
        </ImageLightboxContext.Provider>
    );
}

/**
 * Imagen que al pulsarla se abre en el visor.
 *
 * Reemplaza a un `<img>` normal y acepta sus mismas props. Si no hay visor montado se
 * comporta exactamente como el `<img>` de siempre.
 */
export function ZoomableImage({
    src,
    alt,
    title,
    downloadUrl,
    className,
    onClick,
    ...props
}: ImgHTMLAttributes<HTMLImageElement> & { src: string; downloadUrl?: string }) {
    const visor = useImageLightbox();

    return (
        <img
            {...props}
            src={src}
            alt={alt ?? ''}
            className={cn(visor && 'cursor-zoom-in', className)}
            onClick={(e) => {
                onClick?.(e);
                if (!visor) return;

                // La imagen puede estar dentro de una fila o un enlace: el clic es para
                // verla en grande, no para navegar.
                e.preventDefault();
                e.stopPropagation();
                visor.abrir({ src, alt: alt ?? '', title: title ?? alt ?? '', downloadUrl });
            }}
        />
    );
}

/**
 * Visor a pantalla completa con acercamiento y arrastre.
 *
 * El acercamiento es del visor, no del navegador: la rueda se escucha con
 * `passive: false` para poder cancelarla, de modo que ni la pagina se desplaza ni
 * Ctrl+rueda amplia toda la interfaz. En tactil, dos dedos acercan y uno arrastra.
 */
function ImageLightbox({ imagen, onClose }: { imagen: ImagenAmpliada | null; onClose: () => void }) {
    const lienzo = useRef<HTMLDivElement>(null);
    const marco = useRef<HTMLDivElement>(null);
    const [escala, setEscala] = useState(1);
    const [desplazamiento, setDesplazamiento] = useState({ x: 0, y: 0 });

    /** Punteros activos: uno arrastra, dos acercan. */
    const punteros = useRef(new Map<number, { x: number; y: number }>());
    const pellizco = useRef<{ distancia: number; escala: number } | null>(null);
    const arrastre = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

    const abierto = imagen !== null;

    const reiniciar = useCallback(() => {
        setEscala(1);
        setDesplazamiento({ x: 0, y: 0 });
    }, []);

    useEffect(() => {
        if (abierto) reiniciar();
    }, [abierto, imagen?.src, reiniciar]);

    /**
     * Impide que la imagen se arrastre fuera de la vista: solo puede moverse lo que
     * sobresale del lienzo.
     */
    const acotarDesplazamiento = useCallback((x: number, y: number, s: number) => {
        const caja = lienzo.current?.getBoundingClientRect();
        const img = marco.current?.firstElementChild?.getBoundingClientRect();
        if (!caja || !img) return { x, y };

        // Tamano base (sin acercar) a partir del que hay dibujado ahora.
        const anchoBase = img.width / escala;
        const altoBase = img.height / escala;
        const margenX = Math.max(0, (anchoBase * s - caja.width) / 2);
        const margenY = Math.max(0, (altoBase * s - caja.height) / 2);

        return { x: acotar(x, -margenX, margenX), y: acotar(y, -margenY, margenY) };
    }, [escala]);

    /** Acerca manteniendo bajo el cursor el mismo punto de la imagen. */
    const acercarEn = useCallback(
        (nuevaEscala: number, puntoX?: number, puntoY?: number) => {
            const caja = lienzo.current?.getBoundingClientRect();
            const s = acotar(nuevaEscala, ESCALA_MIN, ESCALA_MAX);

            setEscala((anterior) => {
                setDesplazamiento((off) => {
                    if (!caja || s === anterior) return acotarDesplazamiento(off.x, off.y, s);

                    const cx = caja.left + caja.width / 2;
                    const cy = caja.top + caja.height / 2;
                    const dx = (puntoX ?? cx) - cx;
                    const dy = (puntoY ?? cy) - cy;
                    const k = s / anterior;

                    return acotarDesplazamiento(dx - k * (dx - off.x), dy - k * (dy - off.y), s);
                });

                return s;
            });
        },
        [acotarDesplazamiento],
    );

    // La rueda se escucha a mano porque React la registra como pasiva y ahi
    // preventDefault no surte efecto: sin esto, Ctrl+rueda ampliaria la pagina entera.
    useEffect(() => {
        const nodo = lienzo.current;
        if (!abierto || !nodo) return;

        const alRodar = (e: WheelEvent) => {
            e.preventDefault();
            const factor = Math.exp(-e.deltaY / 400);
            acercarEn(escala * factor, e.clientX, e.clientY);
        };

        nodo.addEventListener('wheel', alRodar, { passive: false });

        return () => nodo.removeEventListener('wheel', alRodar);
    }, [abierto, escala, acercarEn]);

    // Mientras el visor esta abierto, la pagina de atras no se desplaza.
    useEffect(() => {
        if (!abierto) return;

        const previo = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        return () => {
            document.body.style.overflow = previo;
        };
    }, [abierto]);

    useEffect(() => {
        if (!abierto) return;

        const alPulsar = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            if (e.key === '+' || e.key === '=') acercarEn(escala * 1.25);
            if (e.key === '-') acercarEn(escala / 1.25);
            if (e.key === '0') reiniciar();
        };

        window.addEventListener('keydown', alPulsar);

        return () => window.removeEventListener('keydown', alPulsar);
    }, [abierto, escala, acercarEn, onClose, reiniciar]);

    if (!abierto) return null;

    const distanciaEntrePunteros = (): number => {
        const [a, b] = Array.from(punteros.current.values());
        if (!a || !b) return 0;

        return Math.hypot(a.x - b.x, a.y - b.y);
    };

    const alBajarPuntero = (e: ReactPointerEvent<HTMLDivElement>) => {
        punteros.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

        if (punteros.current.size === 2) {
            pellizco.current = { distancia: distanciaEntrePunteros(), escala };
            arrastre.current = null;

            return;
        }

        if (escala > 1) {
            arrastre.current = { x: e.clientX, y: e.clientY, ox: desplazamiento.x, oy: desplazamiento.y };
        }
    };

    const alMoverPuntero = (e: ReactPointerEvent<HTMLDivElement>) => {
        if (!punteros.current.has(e.pointerId)) return;

        punteros.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

        if (pellizco.current && punteros.current.size === 2) {
            const distancia = distanciaEntrePunteros();
            if (distancia > 0 && pellizco.current.distancia > 0) {
                const [a, b] = Array.from(punteros.current.values());
                acercarEn(
                    (pellizco.current.escala * distancia) / pellizco.current.distancia,
                    (a.x + b.x) / 2,
                    (a.y + b.y) / 2,
                );
            }

            return;
        }

        if (arrastre.current) {
            const x = arrastre.current.ox + (e.clientX - arrastre.current.x);
            const y = arrastre.current.oy + (e.clientY - arrastre.current.y);
            setDesplazamiento(acotarDesplazamiento(x, y, escala));
        }
    };

    const alSoltarPuntero = (e: ReactPointerEvent<HTMLDivElement>) => {
        punteros.current.delete(e.pointerId);
        if (punteros.current.size < 2) pellizco.current = null;
        if (punteros.current.size === 0) arrastre.current = null;
    };

    const titulo = imagen.title || imagen.alt || 'Imagen';
    const descarga = imagen.downloadUrl ?? imagen.src;

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label={titulo}
            className="fixed inset-0 z-[60] flex flex-col bg-slate-900/90 backdrop-blur-sm"
        >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
                <p className="min-w-0 truncate text-sm font-medium text-white" title={titulo}>
                    {titulo}
                </p>
                <button
                    type="button"
                    onClick={onClose}
                    className="flex h-11 shrink-0 items-center rounded-lg bg-white/10 px-4 text-sm font-medium text-white hover:bg-white/20"
                >
                    Cerrar
                </button>
            </div>

            {/*
              * `touch-none` cede los gestos al visor: sin esto el navegador se queda el
              * arrastre y el pellizco, y acaba desplazando o ampliando la pagina.
              */}
            <div
                ref={lienzo}
                onPointerDown={alBajarPuntero}
                onPointerMove={alMoverPuntero}
                onPointerUp={alSoltarPuntero}
                onPointerCancel={alSoltarPuntero}
                onDoubleClick={(e) => (escala > 1 ? reiniciar() : acercarEn(2.5, e.clientX, e.clientY))}
                className={cn(
                    'flex min-h-0 flex-1 touch-none select-none items-center justify-center overflow-hidden',
                    escala > 1 ? 'cursor-grab active:cursor-grabbing' : 'cursor-zoom-in',
                )}
            >
                <div
                    ref={marco}
                    style={{
                        transform: `translate(${desplazamiento.x}px, ${desplazamiento.y}px) scale(${escala})`,
                        transition: arrastre.current || pellizco.current ? 'none' : 'transform 120ms ease-out',
                    }}
                >
                    <img
                        src={imagen.src}
                        alt={imagen.alt ?? ''}
                        draggable={false}
                        className="max-h-[78vh] max-w-[92vw] object-contain"
                    />
                </div>
            </div>

            <div className="flex shrink-0 items-center justify-between gap-3 border-t border-white/10 px-4 py-3">
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        onClick={() => acercarEn(escala / 1.25)}
                        disabled={escala <= ESCALA_MIN}
                        aria-label="Alejar"
                        className="flex h-11 w-11 items-center justify-center rounded-lg text-white hover:bg-white/10 disabled:opacity-40"
                    >
                        <MagnifyingGlassMinusIcon className="h-5 w-5" />
                    </button>
                    <button
                        type="button"
                        onClick={reiniciar}
                        aria-label="Restablecer tamaño"
                        className="flex h-11 items-center gap-1.5 rounded-lg px-2 text-sm tabular-nums text-white hover:bg-white/10"
                    >
                        <ArrowPathIcon className="h-4 w-4" />
                        {Math.round(escala * 100)}%
                    </button>
                    <button
                        type="button"
                        onClick={() => acercarEn(escala * 1.25)}
                        disabled={escala >= ESCALA_MAX}
                        aria-label="Acercar"
                        className="flex h-11 w-11 items-center justify-center rounded-lg text-white hover:bg-white/10 disabled:opacity-40"
                    >
                        <MagnifyingGlassPlusIcon className="h-5 w-5" />
                    </button>
                </div>

                <a
                    href={descarga}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-white hover:bg-white/10"
                >
                    <ArrowDownTrayIcon className="h-4 w-4" />
                    Descargar
                </a>
            </div>
        </div>
    );
}
