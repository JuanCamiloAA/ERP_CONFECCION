import {
    Children,
    cloneElement,
    createContext,
    isValidElement,
    useContext,
    useMemo,
    type HTMLAttributes,
    type ReactElement,
    type ReactNode,
    type TableHTMLAttributes,
    type ThHTMLAttributes,
} from 'react';
import { cn } from '@/lib/utils';

/**
 * Contexto interno para la vista de tarjetas en movil: guarda las etiquetas de columna
 * (extraidas de <TableHeader>) y si el <tr> actual esta dentro de <TableBody>, para que
 * cada <TableCell> reciba automaticamente su data-label sin que cada pagina lo declare.
 * Ver reglas CSS ".responsive-table" en resources/css/app.css.
 */
const TableHeaderLabelsContext = createContext<string[]>([]);
const InTableBodyContext = createContext(false);

function flattenToText(node: ReactNode): string {
    return Children.toArray(node)
        .map((child) => {
            if (typeof child === 'string' || typeof child === 'number') {
                return String(child);
            }
            if (isValidElement(child)) {
                return flattenToText((child.props as { children?: ReactNode }).children);
            }
            return '';
        })
        .join('')
        .trim();
}

function extractHeaderLabels(node: ReactNode): string[] {
    const labels: string[] = [];
    Children.forEach(node, (child) => {
        if (!isValidElement(child)) return;
        if (child.type === TableHeader) {
            labels.push(flattenToText((child.props as { children?: ReactNode }).children));
            return;
        }
        const childProps = child.props as { children?: ReactNode } | undefined;
        if (childProps?.children) {
            labels.push(...extractHeaderLabels(childProps.children));
        }
    });
    return labels;
}

function collectHeaderLabels(children: ReactNode): string[] {
    let labels: string[] = [];
    Children.forEach(children, (child) => {
        if (isValidElement(child) && child.type === TableHead) {
            labels = extractHeaderLabels((child.props as { children?: ReactNode }).children);
        }
    });
    return labels;
}

/**
 * Tabla de listado, con la piel compartida `emp-*`.
 *
 * Sin caja: la tabla se apoya en el fondo de la pagina y las filas se separan con una
 * linea, igual que en Empleados, Produccion y Nomina. Antes iba dentro de un recuadro con
 * la cabecera rellena, y al abrir dos modulos seguidos parecian dos aplicaciones.
 */
export function Table({ className, children, ...props }: TableHTMLAttributes<HTMLTableElement>) {
    const headerLabels = useMemo(() => collectHeaderLabels(children), [children]);

    return (
        <TableHeaderLabelsContext.Provider value={headerLabels}>
            {/* El scroll horizontal se queda: en escritorio hay listados mas anchos que la
              * pantalla. Lo que se va es el borde y el fondo, que son los que hacian caja. */}
            <div className="overflow-x-auto">
                <table className={cn('responsive-table w-full text-left', className)} {...props}>
                    {children}
                </table>
            </div>
        </TableHeaderLabelsContext.Provider>
    );
}

export function TableHead({ children, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
    return <thead {...props}>{children}</thead>;
}

export function TableBody({ children, className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
    return (
        <InTableBodyContext.Provider value={true}>
            <tbody className={className} {...props}>
                {children}
            </tbody>
        </InTableBodyContext.Provider>
    );
}

export function TableFoot({ children, className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
    return (
        <tfoot className={cn('emp-strip', className)} {...props}>
            {children}
        </tfoot>
    );
}

export function TableRow({ className, children, ...props }: HTMLAttributes<HTMLTableRowElement>) {
    const headerLabels = useContext(TableHeaderLabelsContext);
    const inBody = useContext(InTableBodyContext);

    const content = inBody
        ? Children.map(children, (child, index) => {
              if (isValidElement(child) && child.type === TableCell) {
                  const cell = child as ReactElement<TableCellProps>;
                  return cloneElement(cell, {
                      'data-label': cell.props['data-label'] ?? headerLabels[index] ?? '',
                  });
              }
              return child;
          })
        : children;

    // El separador y el realce son de las filas de datos: en la cabecera sobran, y en
    // movil cada fila ya se pinta como tarjeta (ver `.responsive-table` en app.css).
    return (
        <tr className={cn(inBody && 'emp-row-sep emp-hover-row transition-colors', className)} {...props}>
            {content}
        </tr>
    );
}

interface TableHeaderProps extends ThHTMLAttributes<HTMLTableCellElement> {
    align?: 'left' | 'right' | 'center';
}

export function TableHeader({ className, children, align = 'left', ...props }: TableHeaderProps) {
    return (
        <th
            scope="col"
            className={cn(
                // La linea va en cada celda y no en el <tr>: con `border-collapse`, el borde
                // de una fila entera lo ignoran algunos navegadores, y el de las celdas no.
                'border-b border-b-[color:var(--emp-border)] px-3 pb-2 text-[11px] font-medium uppercase',
                'tracking-[0.09em] text-[color:var(--emp-subtle)]',
                align === 'left' && 'text-left',
                align === 'right' && 'text-right',
                align === 'center' && 'text-center',
                className,
            )}
            {...props}
        >
            {children}
        </th>
    );
}

export interface TableCellProps extends HTMLAttributes<HTMLTableCellElement> {
    align?: 'left' | 'right' | 'center';
    colSpan?: number;
    rowSpan?: number;
    'data-label'?: string;
}

export function TableCell({ className, children, align = 'left', ...props }: TableCellProps) {
    return (
        <td
            className={cn(
                // El color va como clase y no en `style`: asi `cn` (tailwind-merge) deja que
                // la pagina lo sustituya cuando pasa el suyo. En linea siempre ganaria este.
                'whitespace-nowrap px-3 py-2.5 text-[13px] text-[color:var(--emp-text)]',
                align === 'left' && 'text-left',
                align === 'right' && 'text-right',
                align === 'center' && 'text-center',
                className,
            )}
            {...props}
        >
            {children}
        </td>
    );
}

interface DataTableProps<T> {
    data: T[];
    columns: {
        key: string;
        header: ReactNode;
        accessor: (row: T) => ReactNode;
        align?: 'left' | 'right' | 'center';
        className?: string;
    }[];
    emptyMessage?: string;
    loading?: boolean;
    onRowClick?: (row: T) => void;
}

export function DataTable<T extends { id: number | string }>({
    data,
    columns,
    emptyMessage = 'No hay datos para mostrar',
    onRowClick,
}: DataTableProps<T>) {
    return (
        <Table>
            <TableHead>
                <TableRow>
                    {columns.map((col) => (
                        <TableHeader key={col.key} align={col.align} className={col.className}>
                            {col.header}
                        </TableHeader>
                    ))}
                </TableRow>
            </TableHead>
            <TableBody>
                {data.length === 0 ? (
                    <tr>
                        <td
                            colSpan={columns.length}
                            className="px-3 py-12 text-center text-[13px] text-[color:var(--emp-muted)]"
                        >
                            {emptyMessage}
                        </td>
                    </tr>
                ) : (
                    data.map((row) => (
                        <TableRow
                            key={row.id}
                            onClick={() => onRowClick?.(row)}
                            className={onRowClick ? 'cursor-pointer' : ''}
                        >
                            {columns.map((col) => (
                                <TableCell key={col.key} align={col.align} className={col.className}>
                                    {col.accessor(row)}
                                </TableCell>
                            ))}
                        </TableRow>
                    ))
                )}
            </TableBody>
        </Table>
    );
}

export default Table;
