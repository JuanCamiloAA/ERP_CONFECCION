import { Head, Link, router } from '@inertiajs/react';
import { ArrowPathIcon, ArrowRightIcon, PencilSquareIcon, PlusIcon, TagIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useMemo, useState } from 'react';
import { ReferenceExportMenu } from '@/Components/References/ReferenceExportMenu';
import { Badge } from '@/Components/UI/Badge';
import { Button } from '@/Components/UI/Button';
import { Can } from '@/Components/UI/Can';
import { ConfirmDialog } from '@/Components/UI/ConfirmDialog';
import { PageHeader } from '@/Components/UI/PageHeader';
import { Pagination } from '@/Components/UI/Pagination';
import { RowActionsMenu, type RowAction } from '@/Components/UI/RowActionsMenu';
import { cardsViewClass, tableViewClass } from '@/Components/UI/ListViewSwitch';
import { SearchInput } from '@/Components/UI/SearchInput';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/Components/UI/Table';
import { ViewToggle } from '@/Components/UI/ViewToggle';
import { usePermissions } from '@/contexts/PermissionsContext';
import { useViewMode } from '@/hooks/useViewMode';
import AppLayout from '@/Layouts/AppLayout';
import { ZoomableImage } from '@/Components/UI/ImageLightbox';
import { formatCurrency, formatNumber } from '@/lib/utils';
import type { PaginatedResponse, Reference } from '@/types';

type ReferenceRow = Reference & {
    operations_count: number;
    productions_count: number;
    productions_sum_quantity?: number | null;
    productions_max_per_operation?: number | null;
    /** Cuantas de las operaciones de la referencia ya cubren el lote completo. */
    operations_completed_count?: number | null;
    operational_cost_per_unit_fixed?: string | number | null;
};

interface Props {
    references: PaginatedResponse<ReferenceRow>;
    filters: { search: string };
}

/**
 * Avance en OPERACIONES, no en unidades: de las operaciones que tiene la referencia,
 * cuantas ya cubren el lote completo. Con 5 operaciones de 10 unidades se muestra
 * "2 / 5", no "20 / 50". Sin lote definido no hay meta contra la cual medirlas.
 * Se usa igual en la tarjeta movil y en la tabla de escritorio.
 */
function operationsProgress(ref: ReferenceRow) {
    const total = Number(ref.operations_count ?? 0);
    const hasLot = ref.lot_total_quantity != null && Number(ref.lot_total_quantity) > 0;
    const done = Number(ref.operations_completed_count ?? 0);
    const pct = hasLot && total > 0 ? Math.round((done / total) * 100) : null;

    return { total, done, pct, hasLot };
}

/** Formatea un monto opcional; "—" cuando no hay valor configurado. */
function money(value: string | number | null | undefined): string {
    return value != null && value !== '' ? formatCurrency(Number(value)) : '—';
}

export default function ReferencesIndex({ references, filters }: Props) {
    const [view, setView] = useViewMode('references');

    const perms = usePermissions();
    const [search, setSearch] = useState(filters.search ?? '');
    const [confirmDelete, setConfirmDelete] = useState<Reference | null>(null);
    const [confirmRecalc, setConfirmRecalc] = useState(false);
    /**
     * Referencias marcadas para exportar. El estado activo no entra en la cuenta: se
     * exporta lo que se marque, activo o inactivo, que es justo lo que se necesita para
     * archivar una referencia cerrada o volver a cotizarla.
     */
    const [selected, setSelected] = useState<number[]>([]);

    const pageIds = useMemo(() => references.data.map((ref) => ref.id), [references.data]);
    const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.includes(id));
    const somePageSelected = pageIds.some((id) => selected.includes(id));

    const toggleOne = (id: number) => {
        setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    };

    const togglePage = () => {
        setSelected((prev) => (allPageSelected ? prev.filter((id) => !pageIds.includes(id)) : [...new Set([...prev, ...pageIds])]));
    };

    const updateFilters = (s: string) => {
        const params: Record<string, string> = {};
        if (s) params.search = s;
        // La busqueda cambia el universo de la lista; arrastrar marcas de un resultado
        // anterior haria exportar referencias que ya no se ven en pantalla.
        setSelected([]);
        router.get(route('references.index'), params, { preserveState: true, preserveScroll: true, replace: true });
    };

    const exportHint =
        selected.length > 0
            ? `Se exportan las ${selected.length} referencias marcadas.`
            : search
              ? 'Sin marcar ninguna se exporta todo lo que coincide con la búsqueda.'
              : 'Sin marcar ninguna se exporta el catálogo completo (activas e inactivas).';

    const checkboxClass =
        'h-4 w-4 shrink-0 cursor-pointer rounded border-slate-300 text-indigo-600 focus:ring-2 focus:ring-indigo-500/40 dark:border-slate-600 dark:bg-slate-800';

    const rowActions = (ref: ReferenceRow): RowAction[] => {
        const actions: RowAction[] = [];
        actions.push({
            key: 'show',
            label: 'Ver referencia',
            icon: <ArrowRightIcon className="h-4 w-4" />,
            href: route('references.show', ref.id),
        });
        if (perms.can('references.index.edit')) {
            actions.push({
                key: 'edit',
                label: 'Editar',
                icon: <PencilSquareIcon className="h-4 w-4" />,
                href: route('references.edit', ref.id),
            });
        }
        if (perms.can('references.index.delete')) {
            actions.push({
                key: 'delete',
                label: 'Eliminar',
                icon: <TrashIcon className="h-4 w-4" />,
                danger: true,
                onClick: () => setConfirmDelete(ref),
            });
        }
        return actions;
    };

    return (
        <AppLayout title="Referencias">
            <Head title="Referencias" />
            <div className="space-y-6 pb-24 lg:pb-0">
                <PageHeader
                    title="Referencias"
                    description="Catalogo de prendas con sus operaciones y precios."
                    action={
                        <div className="flex items-center gap-2">
                            <ReferenceExportMenu
                                ids={selected}
                                search={search}
                                hint={exportHint}
                                label={selected.length > 0 ? `Exportar (${selected.length})` : 'Exportar'}
                            />
                            <Can permission="references.index.edit">
                                <Button
                                    variant="outline"
                                    className="min-h-11"
                                    icon={<ArrowPathIcon className="h-4 w-4" />}
                                    onClick={() => setConfirmRecalc(true)}
                                >
                                    <span className="hidden sm:inline">Recalcular dificultades</span>
                                    <span className="sm:hidden">Dificultades</span>
                                </Button>
                            </Can>
                            <Can permission="references.index.create">
                                <Link href={route('references.create')} className="hidden lg:block">
                                    <Button icon={<PlusIcon className="h-4 w-4" />}>Nueva referencia</Button>
                                </Link>
                            </Can>
                        </div>
                    }
                />

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <SearchInput
                        value={search}
                        onChange={(v) => {
                            setSearch(v);
                            updateFilters(v);
                        }}
                        placeholder="Buscar por codigo o nombre..."
                        className="sm:max-w-md [&_input]:h-11 lg:[&_input]:h-10"
                    />

                    <ViewToggle value={view} onChange={setView} className="sm:ml-auto" />
                </div>

                {/* Barra de seleccion: aparece al marcar la primera referencia. */}
                {selected.length > 0 ? (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 dark:border-indigo-800 dark:bg-indigo-900/20">
                        <p className="text-sm text-indigo-900 dark:text-indigo-200">
                            <span className="font-semibold">
                                {selected.length} {selected.length === 1 ? 'referencia marcada' : 'referencias marcadas'}
                            </span>
                            <span className="ml-1 text-indigo-700/80 dark:text-indigo-300/80">
                                · se exportan con imagen, operaciones y costo operacional
                            </span>
                        </p>
                        <div className="flex items-center gap-2">
                            <ReferenceExportMenu ids={selected} hint={exportHint} label="Exportar selección" />
                            <Button variant="ghost" className="min-h-11" onClick={() => setSelected([])}>
                                Limpiar
                            </Button>
                        </div>
                    </div>
                ) : null}

                {/* Movil: tarjeta con avance del lote y las dos cifras clave legibles. */}
                <div className={cardsViewClass(view, 'gap-3')}>
                    {references.data.length === 0 ? (
                        <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                            No hay referencias.
                        </div>
                    ) : (
                        references.data.map((ref) => {
                            const { total: opsTotal, done: opsDone, pct, hasLot } = operationsProgress(ref);

                            return (
                                <div
                                    key={ref.id}
                                    className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800"
                                >
                                    <div className="flex items-start gap-3">
                                        <input
                                            type="checkbox"
                                            className={`${checkboxClass} mt-1`}
                                            checked={selected.includes(ref.id)}
                                            onChange={() => toggleOne(ref.id)}
                                            aria-label={`Seleccionar ${ref.code} para exportar`}
                                        />
                                        <div className="flex h-13 w-13 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
                                            {ref.image ? (
                                                <ZoomableImage src={ref.image} alt={ref.name} title={`${ref.code} — ${ref.name}`} className="h-full w-full object-cover" />
                                            ) : (
                                                <TagIcon className="h-6 w-6" />
                                            )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <Link
                                                href={route('references.show', ref.id)}
                                                className="block truncate text-base font-semibold text-slate-900 dark:text-slate-100"
                                            >
                                                {ref.code}
                                            </Link>
                                            <p className="truncate text-xs text-slate-500 dark:text-slate-400">{ref.name}</p>
                                        </div>
                                        <div className="flex shrink-0 items-center gap-1">
                                            <Badge variant={ref.is_active ? 'success' : 'danger'}>
                                                {ref.is_active ? 'Activa' : 'Inactiva'}
                                            </Badge>
                                            <RowActionsMenu actions={rowActions(ref)} />
                                        </div>
                                    </div>

                                    {/* Avance del lote segun la operacion mas adelantada. */}
                                    <div className="mt-3">
                                        <div className="flex items-baseline justify-between gap-2">
                                            <span className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                                Operaciones completadas
                                            </span>
                                            <span className="text-xs font-semibold tabular-nums text-slate-700 dark:text-slate-200">
                                                {hasLot ? `${formatNumber(opsDone)} / ${formatNumber(opsTotal)}` : 'Sin lote definido'}
                                            </span>
                                        </div>
                                        {pct != null ? (
                                            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                                                <div className="h-full rounded-full bg-indigo-500" style={{ width: `${pct}%` }} />
                                            </div>
                                        ) : null}
                                    </div>

                                    <div className="mt-3 grid grid-cols-2 gap-2">
                                        <div className="rounded-lg bg-slate-50 p-2.5 dark:bg-slate-900/40">
                                            <p className="text-[11px] text-slate-500 dark:text-slate-400">Pago por unidad</p>
                                            <p className="text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                                                {money(ref.payment_per_unit)}
                                            </p>
                                        </div>
                                        <div className="rounded-lg bg-slate-50 p-2.5 dark:bg-slate-900/40">
                                            <p className="text-[11px] text-slate-500 dark:text-slate-400">Costo operativo</p>
                                            <p className="text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                                                {money(ref.operational_cost_per_unit_fixed)}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 dark:border-slate-700">
                                        <span className="text-xs text-slate-500 dark:text-slate-400">
                                            {formatNumber(ref.operations_count)}{' '}
                                            {ref.operations_count === 1 ? 'operación' : 'operaciones'} ·{' '}
                                            {formatNumber(ref.productions_count)}{' '}
                                            {ref.productions_count === 1 ? 'producción' : 'producciones'}
                                        </span>
                                        <Link
                                            href={route('references.show', ref.id)}
                                            className="flex h-11 items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400"
                                        >
                                            Ver referencia
                                            <ArrowRightIcon className="h-4 w-4" />
                                        </Link>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                <div className={tableViewClass(view)}>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableHeader className="w-10 pr-0">
                                    <input
                                        type="checkbox"
                                        className={checkboxClass}
                                        checked={allPageSelected}
                                        ref={(el) => {
                                            // Marca «hay algo, pero no todo» en la casilla del encabezado.
                                            if (el) el.indeterminate = !allPageSelected && somePageSelected;
                                        }}
                                        onChange={togglePage}
                                        aria-label="Seleccionar todas las referencias de esta página"
                                    />
                                </TableHeader>
                                <TableHeader>Referencia</TableHeader>
                                <TableHeader align="right">Pago u.</TableHeader>
                                <TableHeader align="right">Costo op.</TableHeader>
                                <TableHeader align="center">Operaciones</TableHeader>
                                <TableHeader align="center">Producciones</TableHeader>
                                <TableHeader align="right">Operaciones completadas</TableHeader>
                                <TableHeader align="center">Estado</TableHeader>
                                <TableHeader align="right">Acciones</TableHeader>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {references.data.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="px-4 py-12 text-center text-sm text-slate-500">
                                        No hay referencias.
                                    </td>
                                </tr>
                            ) : (
                                references.data.map((ref) => (
                                    <TableRow key={ref.id} className={selected.includes(ref.id) ? 'bg-indigo-50/60 dark:bg-indigo-900/10' : undefined}>
                                        <TableCell className="w-10 pr-0">
                                            <input
                                                type="checkbox"
                                                className={checkboxClass}
                                                checked={selected.includes(ref.id)}
                                                onChange={() => toggleOne(ref.id)}
                                                aria-label={`Seleccionar ${ref.code} para exportar`}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40">
                                                    {ref.image ? (
                                                        <ZoomableImage src={ref.image} alt={ref.name} title={`${ref.code} — ${ref.name}`} className="h-10 w-10 rounded-lg object-cover" />
                                                    ) : (
                                                        <TagIcon className="h-5 w-5" />
                                                    )}
                                                </div>
                                                <div>
                                                    <Link
                                                        href={route('references.show', ref.id)}
                                                        className="font-medium text-slate-900 hover:text-indigo-600 dark:text-slate-100"
                                                    >
                                                        {ref.code}
                                                    </Link>
                                                    <p className="text-xs text-slate-500">{ref.name}</p>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell align="right" className="whitespace-nowrap text-xs tabular-nums">
                                            {ref.payment_per_unit != null && ref.payment_per_unit !== ''
                                                ? formatCurrency(Number(ref.payment_per_unit))
                                                : '—'}
                                        </TableCell>
                                        <TableCell align="right" className="whitespace-nowrap text-xs tabular-nums">
                                            {ref.operational_cost_per_unit_fixed != null && ref.operational_cost_per_unit_fixed !== ''
                                                ? formatCurrency(Number(ref.operational_cost_per_unit_fixed))
                                                : '—'}
                                        </TableCell>
                                        <TableCell align="center">{ref.operations_count}</TableCell>
                                        <TableCell align="center">{ref.productions_count}</TableCell>
                                        <TableCell align="right" className="whitespace-nowrap text-xs tabular-nums">
                                            {(() => {
                                                const { total: opsTotal, done: opsDone, pct, hasLot } = operationsProgress(ref);
                                                if (!hasLot) return '—';
                                                return (
                                                    <div className="ml-auto w-32">
                                                        <span className="block">
                                                            {formatNumber(opsDone)} / {formatNumber(opsTotal)}
                                                        </span>
                                                        <span className="mt-1 block h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                                                            <span
                                                                className="block h-full rounded-full bg-indigo-500"
                                                                style={{ width: `${pct ?? 0}%` }}
                                                            />
                                                        </span>
                                                    </div>
                                                );
                                            })()}
                                        </TableCell>
                                        <TableCell align="center">
                                            <Badge variant={ref.is_active ? 'success' : 'danger'}>
                                                {ref.is_active ? 'Activa' : 'Inactiva'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell align="right">
                                            <div className="flex justify-end gap-1">
                                                <Can permission="references.index.edit">
                                                    <Link href={route('references.edit', ref.id)}>
                                                        <Button variant="ghost" size="sm" icon={<PencilSquareIcon className="h-4 w-4" />} />
                                                    </Link>
                                                </Can>
                                                <Can permission="references.index.delete">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        icon={<TrashIcon className="h-4 w-4 text-rose-500" />}
                                                        onClick={() => setConfirmDelete(ref)}
                                                    />
                                                </Can>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>

                <Pagination links={references.links} from={references.from} to={references.to} total={references.total} />
            </div>

            <Can permission="references.index.create">
                <div className="fixed inset-x-0 bottom-[var(--tabbar-h)] z-30 border-t border-slate-200 bg-white px-4 pb-5 pt-3 lg:hidden dark:border-slate-700 dark:bg-slate-800">
                    <Link href={route('references.create')} className="block">
                        <Button icon={<PlusIcon className="h-5 w-5" />} fullWidth className="min-h-12 text-base">
                            Nueva referencia
                        </Button>
                    </Link>
                </div>
            </Can>

            <ConfirmDialog
                open={!!confirmDelete}
                onClose={() => setConfirmDelete(null)}
                onConfirm={() => {
                    if (!confirmDelete) return;
                    router.delete(route('references.destroy', confirmDelete.id), {
                        onFinish: () => setConfirmDelete(null),
                    });
                }}
                title="Eliminar referencia"
                message={`Eliminar la referencia ${confirmDelete?.code}?`}
                variant="danger"
            />

            <ConfirmDialog
                open={confirmRecalc}
                onClose={() => setConfirmRecalc(false)}
                onConfirm={() => {
                    router.post(route('references.recalculate-difficulty'), {}, {
                        preserveScroll: true,
                        onFinish: () => setConfirmRecalc(false),
                    });
                }}
                title="Recalcular dificultades"
                message="Se vuelve a calcular el grado de dificultad de las lineas de todas las referencias con los rangos de Mi empresa > Dificultad por minutos. Los precios y los minutos no cambian."
                confirmText="Recalcular"
            />
        </AppLayout>
    );
}
