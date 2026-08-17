import { Head } from '@inertiajs/react';
import { List, Needle, X } from '@phosphor-icons/react';
import { useState } from 'react';
import {
    AudienceBlock,
    BandBlock,
    ClosingBlock,
    FlowBlock,
    HeroBlock,
    QuoteBlock,
    StepsMediaBlock,
    VirtuesBlock,
} from '@/Components/Public/Blocks';
import '../../../css/public.css';

type Dict = Record<string, unknown>;

interface Block {
    type: string;
    data: Dict;
}

interface Props {
    blocks: Block[];
    meta?: { title?: string; description?: string; favicon_url?: string | null };
    preview?: boolean;
}

const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);
const list = (v: unknown): Dict[] => (Array.isArray(v) ? (v as Dict[]) : []);

/**
 * Ancla de la seccion, para que los enlaces del menu (#flow, #virtues…) funcionen.
 * Un tipo repetido en la pagina numera las apariciones siguientes (#virtues-2) para
 * no dejar dos elementos con el mismo id.
 */
function anchorFor(type: string, ocurrencia: number): string {
    return ocurrencia === 0 ? type : `${type}-${ocurrencia + 1}`;
}

function PublicHeader({ data }: { data: Dict }) {
    const links = list(data.links);
    const cta = (data.cta ?? {}) as Dict;
    const [open, setOpen] = useState(false);

    return (
        <header className="sticky top-0 z-40" style={{ backgroundColor: 'var(--pub-bg)' }}>
            <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 lg:px-10">
                <a href="/" className="flex items-center gap-2.5">
                    <span
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm"
                        style={{ border: '1px solid var(--pub-accent)', color: 'var(--pub-accent)' }}
                    >
                        <Needle size={15} />
                    </span>
                    <span className="text-[15px]" style={{ color: 'var(--pub-text)' }}>
                        {str(data.brand)}
                    </span>
                </a>

                <nav className="hidden items-center gap-7 lg:flex">
                    {links.map((l, i) => (
                        <a key={i} href={str(l.url, '#')} className="text-[13px]" style={{ color: 'var(--pub-gray-2)' }}>
                            {str(l.label)}
                        </a>
                    ))}
                    {str(cta.label) ? (
                        <a href={str(cta.url, '#')} className="pub-btn h-10 px-4 text-[13px]">
                            {str(cta.label)}
                        </a>
                    ) : null}
                </nav>

                {/* Movil: un solo boton de 44px que abre el menu a pantalla completa. */}
                <button
                    type="button"
                    onClick={() => setOpen(true)}
                    className="flex h-11 w-11 items-center justify-center rounded-md lg:hidden"
                    style={{ border: '1px solid var(--pub-gray-6)', color: 'var(--pub-text)' }}
                    aria-label="Abrir menú"
                >
                    <List size={20} />
                </button>
            </div>
            <hr className="pub-rule" />

            {open ? (
                <div className="fixed inset-0 z-50 flex flex-col px-5 py-4 lg:hidden" style={{ backgroundColor: 'var(--pub-bg)' }}>
                    <div className="flex h-16 items-center justify-between">
                        <span className="text-[15px]" style={{ color: 'var(--pub-text)' }}>
                            {str(data.brand)}
                        </span>
                        <button
                            type="button"
                            onClick={() => setOpen(false)}
                            className="flex h-11 w-11 items-center justify-center rounded-md"
                            style={{ border: '1px solid var(--pub-gray-6)', color: 'var(--pub-text)' }}
                            aria-label="Cerrar menú"
                        >
                            <X size={20} />
                        </button>
                    </div>
                    <nav className="mt-4 flex flex-col">
                        {links.map((l, i) => (
                            <a
                                key={i}
                                href={str(l.url, '#')}
                                onClick={() => setOpen(false)}
                                className="flex min-h-14 items-center text-[17px]"
                                style={{ color: 'var(--pub-text)', borderBottom: '1px solid var(--pub-divider)' }}
                            >
                                {str(l.label)}
                            </a>
                        ))}
                    </nav>
                    {str(cta.label) ? (
                        <a href={str(cta.url, '#')} className="pub-btn mt-6 h-[50px] w-full text-[15px]">
                            {str(cta.label)}
                        </a>
                    ) : null}
                </div>
            ) : null}
        </header>
    );
}

function PublicFooter({ data }: { data: Dict }) {
    const links = list(data.links);

    return (
        <footer className="px-5 lg:px-10">
            <hr className="pub-rule" />
            <div className="mx-auto flex max-w-6xl flex-col gap-3 py-7 text-xs sm:flex-row sm:items-center sm:justify-between">
                <p style={{ color: 'var(--pub-gray-4)' }}>{str(data.copyright)}</p>
                <div className="flex flex-wrap gap-5">
                    {links.map((l, i) => (
                        <a key={i} href={str(l.url, '#')} style={{ color: 'var(--pub-gray-3)' }}>
                            {str(l.label)}
                        </a>
                    ))}
                </div>
            </div>
        </footer>
    );
}

/**
 * Landing publica: recorre los bloques publicados y despacha por tipo. Un tipo que no
 * reconozca se ignora en silencio. Todo el texto sale del contenido editable.
 */
export default function PublicLanding({ blocks, meta = {}, preview = false }: Props) {
    const header = blocks.find((b) => b.type === 'header');
    const footer = blocks.find((b) => b.type === 'footer');

    // El flujo se dibuja al costado del hero, como en el diseno; por eso no se recorre suelto.
    const flow = blocks.find((b) => b.type === 'flow');
    const body = blocks.filter((b) => !['header', 'footer', 'flow'].includes(b.type));

    const render = (block: Block) => {
        switch (block.type) {
            case 'hero_public':
            case 'hero':
                return <HeroBlock data={block.data} aside={flow ? <FlowBlock data={flow.data} /> : undefined} />;
            case 'band':
                return <BandBlock data={block.data} />;
            case 'virtues':
                return <VirtuesBlock data={block.data} />;
            case 'audience':
                return <AudienceBlock data={block.data} />;
            case 'steps_media':
                return <StepsMediaBlock data={block.data} />;
            case 'quote':
                return <QuoteBlock data={block.data} />;
            case 'closing':
                return <ClosingBlock data={block.data} />;
            default:
                return null;
        }
    };

    return (
        <div className="public-scope min-h-screen">
            <Head title={meta.title ?? ''}>
                {meta.description ? <meta name="description" content={meta.description} /> : null}
                {meta.favicon_url ? <link rel="icon" href={meta.favicon_url} /> : null}
            </Head>

            {preview ? (
                <p className="px-5 py-2 text-center text-xs" style={{ backgroundColor: 'var(--pub-accent-fill)', color: 'var(--pub-accent-on-band-soft)' }}>
                    Vista previa del borrador — no es lo que ven los visitantes.
                </p>
            ) : null}

            {header ? <PublicHeader data={header.data} /> : null}

            <main>
                {body.map((block, i) => {
                    const node = render(block);
                    if (!node) return null;

                    const ocurrencia = body.slice(0, i).filter((b) => b.type === block.type).length;

                    return (
                        <div key={`${block.type}-${i}`} id={anchorFor(block.type, ocurrencia)}>
                            {node}
                        </div>
                    );
                })}
            </main>

            {footer ? <PublicFooter data={footer.data} /> : null}
        </div>
    );
}
