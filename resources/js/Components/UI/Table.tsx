import { HTMLAttributes, ReactNode, TableHTMLAttributes, ThHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export function Table({ className, children, ...props }: TableHTMLAttributes<HTMLTableElement>) {
    return (
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
            <table
                className={cn('w-full divide-y divide-slate-200 text-sm dark:divide-slate-700', className)}
                {...props}
            >
                {children}
            </table>
        </div>
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
        <tbody
            className={cn('divide-y divide-slate-200 bg-white dark:divide-slate-700 dark:bg-slate-800', className)}
            {...props}
        >
            {children}
        </tbody>
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
    return (
        <tr
            className={cn('transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/30', className)}
            {...props}
        >
            {children}
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
