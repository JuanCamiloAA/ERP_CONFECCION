import { Menu, MenuButton, MenuItem, MenuItems, Transition } from '@headlessui/react';
import { CaretDown, DownloadSimple, FileDoc, FileXls } from '@phosphor-icons/react';
import { Fragment } from 'react';

interface Props {
    /** Los mismos parametros que la pantalla: el archivo sale con el filtro puesto. */
    params: Record<string, string>;
}

/**
 * Menu de exportacion del ranking: Excel o Word, la misma informacion en los dos.
 *
 * Sigue el patron de Referencias —elegir formato, no elegir contenido— pero con la piel
 * `emp-*` del modulo de Produccion. Los dos destinos son enlaces normales, no visitas de
 * Inertia: descargan un archivo y no deben mover la pagina de quien exporta.
 */
export function RankingExportMenu({ params }: Props) {
    const excelUrl = route('productions.ranking.export.excel', params);
    const wordUrl = route('productions.ranking.export.word', params);

    const item = 'flex w-full items-start gap-2.5 px-3 py-2.5 text-left data-focus:bg-[color:var(--emp-accent-tint)]';

    const label = (title: string, description: string) => (
        <span className="min-w-0">
            <span className="block text-[13px]" style={{ color: 'var(--emp-text)' }}>
                {title}
            </span>
            <span className="mt-0.5 block text-[11px]" style={{ color: 'var(--emp-subtle)' }}>
                {description}
            </span>
        </span>
    );

    return (
        <Menu as="div" className="relative shrink-0">
            <MenuButton className="emp-btn emp-btn-sm">
                <DownloadSimple size={15} />
                Exportar
                <CaretDown size={12} />
            </MenuButton>

            <Transition
                as={Fragment}
                enter="transition ease-out duration-100"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="transition ease-in duration-75"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
            >
                <MenuItems
                    anchor="bottom end"
                    className="emp-card z-50 w-72 py-1 focus:outline-none"
                    style={{ backgroundColor: 'var(--emp-surface)' }}
                >
                    <MenuItem>
                        <a href={excelUrl} className={item}>
                            <FileXls size={19} className="mt-0.5 shrink-0" style={{ color: 'var(--emp-muted)' }} />
                            {label('Excel (.xlsx)', 'Con los números como números: se puede sumar y ordenar.')}
                        </a>
                    </MenuItem>

                    <MenuItem>
                        <a href={wordUrl} className={item}>
                            <FileDoc size={19} className="mt-0.5 shrink-0" style={{ color: 'var(--emp-muted)' }} />
                            {label('Word (.docx)', 'Listo para imprimir o pegar en un informe.')}
                        </a>
                    </MenuItem>
                </MenuItems>
            </Transition>
        </Menu>
    );
}

export default RankingExportMenu;
