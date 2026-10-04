import { Head, Link } from '@inertiajs/react';
import { ArrowLeft } from '@phosphor-icons/react';
import { ProductionListing, type ProductionListingProps } from '@/Components/Productions/ProductionListing';
import { Can } from '@/Components/UI/Can';
import AppLayout from '@/Layouts/AppLayout';
import '../../../css/module-ui.css';

interface Props extends Omit<ProductionListingProps, 'scope'> {
    scope: 'unpaid' | 'paid';
}

const COPY = {
    unpaid: {
        tab: 'Detalle',
        title: 'Detalle de producción',
        lead: 'Lo que todavía no entra en una nómina pagada: registros por confirmar y confirmados.',
    },
    paid: {
        tab: 'Historial',
        title: 'Historial de producción',
        lead: 'Lo que ya se pagó en una nómina.',
    },
} as const;

/**
 * Detalle (sin pagar) e Historial (pagado) de la produccion.
 *
 * Es la misma pantalla con dos cortes: el servidor filtra por el pago y aqui cambian los
 * textos. Las pestañas de arriba saltan de un lado al otro, cada una con su permiso.
 */
export default function ProductionRecords({ scope, workerMode = false, ...listing }: Props) {
    const copy = COPY[scope];

    return (
        <AppLayout title={copy.title}>
            <Head title={copy.title} />

            <div className="emp-form emp-bleed min-h-screen px-4 pb-8 pt-5 sm:px-[34px]">
                {/* -------------------------------------------------- cabecera */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-2">
                        <Link
                            href={route('productions.index')}
                            className="emp-btn emp-btn-ghost mt-0.5 shrink-0 px-2"
                            aria-label="Volver a producción"
                        >
                            <ArrowLeft size={17} />
                        </Link>
                        <div className="min-w-0">
                            <nav className="hidden items-center gap-1.5 text-[12px] sm:flex" style={{ color: 'var(--emp-subtle)' }}>
                                <Link href={route('productions.index')} className="hover:underline">
                                    {workerMode ? 'Mi producción' : 'Producción'}
                                </Link>
                                <span>/</span>
                                <span>{copy.tab}</span>
                            </nav>
                            <h1 className="text-[24px]" style={{ color: 'var(--emp-text)' }}>
                                {copy.title}
                            </h1>
                            <p className="mt-1 text-[13px]" style={{ color: 'var(--emp-muted)' }}>
                                {copy.lead}
                            </p>
                        </div>
                    </div>

                    <nav aria-label="Producción por estado de pago" className="emp-seg w-full sm:w-auto">
                        <Can permission="productions.detail.view">
                            <Link
                                href={route('productions.detail')}
                                aria-current={scope === 'unpaid' ? 'page' : undefined}
                                className={`emp-seg-item inline-flex items-center justify-center sm:min-w-24 ${scope === 'unpaid' ? 'emp-seg-on' : ''}`}
                            >
                                Detalle
                            </Link>
                        </Can>
                        <Can permission="productions.history.view">
                            <Link
                                href={route('productions.history')}
                                aria-current={scope === 'paid' ? 'page' : undefined}
                                className={`emp-seg-item inline-flex items-center justify-center sm:min-w-24 ${scope === 'paid' ? 'emp-seg-on' : ''}`}
                            >
                                Historial
                            </Link>
                        </Can>
                    </nav>
                </div>

                {/* `key`: al cambiar de pestaña los filtros locales arrancan de nuevo. */}
                <ProductionListing key={scope} {...listing} workerMode={workerMode} scope={scope} />
            </div>
        </AppLayout>
    );
}
