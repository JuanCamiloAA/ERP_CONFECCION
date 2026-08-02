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

export function Table({ className, children, ...props }: TableHTMLAttributes<HTMLTableElement>) {
    const headerLabels = useMemo(() => collectHeaderLabels(children), [children]);

    return (
        <TableHeaderLabelsContext.Provider value={headerLabels}>
            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                <table
                    className={cn('responsive-table w-full divide-y divide-slate-200 text-sm dark:divide-slate-700', className)}
                    {...props}
                >
                    {children}
                </table>
            </div>
        </TableHeaderLabelsContext.Provider>
    );
}

export function TableHead({ children, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
    return (
        <thead className="bg-slate-50 dark:bg-slate-900/50" {...props}>
            {children}
        </thead>
    );
}

export function TableBody({ children, className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
    return (
        <InTableBodyContext.Provider value={true}>
            <tbody
                className={cn('divide-y divide-slate-200 bg-white dark:divide-slate-700 dark:bg-slate-800', className)}
                {...props}
            >
                {children}
            </tbody>
        </InTableBodyContext.Provider>
    );
}

export function TableFoot({ children, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
    return (
        <tfoot className="bg-slate-50 dark:bg-slate-900/50 font-semibold" {...props}>
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

    return (
        <tr className={cn('transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/30', className)} {...props}>
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
                'px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400',
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
    'data-label'?: string;
}

export function TableCell({ className, children, align = 'left', ...props }: TableCellProps) {
    return (
        <td
            className={cn(
                'whitespace-nowrap px-4 py-3 text-slate-700 dark:text-slate-300',
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
                            className="px-4 py-12 text-center text-sm text-slate-500 dark:text-slate-400"
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
