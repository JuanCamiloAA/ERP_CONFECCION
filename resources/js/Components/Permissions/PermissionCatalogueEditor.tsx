import { ArrowsInLineVertical, ArrowsOutLineVertical, CaretDown, MagnifyingGlass, Sparkle } from '@phosphor-icons/react';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { PermissionSummaryBar } from '@/Components/Permissions/PermissionSummaryBar';
import {
    actionOf,
    flattenCatalogue,
    ORIGIN_HELP,
    originOf,
    PRESETS,
    VERB_GROUPS,
    type PermissionOrigin,
} from '@/lib/permissions';

export interface PermissionEntry {
    name: string;
    label: string;
}

export interface PermissionGroup {
    key: string;
    display: string;
    permissions: PermissionEntry[];
}

export interface PermissionModule {
    key: string;
    display: string;
    order: number;
    super_admin_only: boolean;
    total: number;
    groups: PermissionGroup[];
}

/** Casilla de tres estados: marcada, a medias (algunos hijos) o vacía. */
export function TriBox({
    state,
    onClick,
    label,
    disabled = false,
    size = 18,
}: {
    state: 'on' | 'partial' | 'off';
    onClick: () => void;
    label: string;
    disabled?: boolean;
    size?: number;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            aria-label={label}
            aria-checked={state === 'on' ? 'true' : state === 'partial' ? 'mixed' : 'false'}
            role="checkbox"
            className="flex shrink-0 items-center justify-center rounded-[5px] disabled:opacity-50"
            style={{
                width: `${size}px`,
                height: `${size}px`,
                border: `1px solid ${state === 'off' ? 'var(--emp-border)' : 'var(--emp-accent)'}`,
                backgroundColor: state === 'off' ? 'transparent' : 'var(--emp-accent)',
                color: 'var(--emp-surface)',
            }}
        >
            {state === 'on' ? (
                <svg viewBox="0 0 16 16" className="h-3 w-3" aria-hidden="true">
                    <path
                        d="M3 8.5l3.2 3.2L13 5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </svg>
            ) : state === 'partial' ? (
                <span className="block h-[2px] w-2.5 rounded-full" style={{ backgroundColor: 'currentColor' }} />
            ) : null}
        </button>
    );
}

type OriginFilter = 'all' | 'template' | 'exceptions';

interface Props {
    catalogue: PermissionModule[];
    value: string[];
    onChange: (next: string[]) => void;
    readonly?: boolean;
    /** 'role' = plantilla del rol; 'user' = permisos de una persona. */
    variant?: 'role' | 'user';
    /** Permisos de la plantilla del rol; necesario para distinguir el origen en 'user'. */
    template?: string[];
    /** Lo guardado hoy; con esto se calcula el resumen de cambios. */
    baseline?: string[];
    /** `permiso => "Módulo · Etiqueta"`, para el resumen. */
    labels?: Record<string, string>;
    onApplyTemplate?: () => void;
    /** Contenido extra a la derecha del buscador. */
    headerRight?: ReactNode;
    /** El resumen se pega abajo en la página del rol; en el modal lo pone el diálogo. */
    summaryPosition?: 'inline' | 'sticky' | 'none';
    /** Filtro de origen inicial; la ficha del usuario abre el modal ya en «Excepciones». */
    initialOriginFilter?: OriginFilter;
}

/** Estilo de una pastilla según de dónde venga el permiso. */
function chipStyle(origin: PermissionOrigin, variant: 'role' | 'user'): React.CSSProperties {
    if (variant === 'role') {
        return origin === 'template' || origin === 'extra'
            ? {
                  border: '1px solid var(--emp-accent)',
                  backgroundColor: 'var(--emp-accent-fill)',
                  color: 'var(--emp-accent-on)',
              }
            : { border: '1px solid var(--emp-border)', color: 'var(--emp-muted)' };
    }

    switch (origin) {
        case 'template':
            return {
                border: '1px solid var(--emp-accent)',
                backgroundColor: 'var(--emp-accent-fill)',
                color: 'var(--emp-accent-on)',
            };
        case 'extra':
            return {
                border: '1px dashed var(--emp-accent-line)',
                backgroundColor: 'var(--emp-accent-fill)',
                color: 'var(--emp-accent-on)',
            };
        case 'removed':
            return { border: '1px solid var(--emp-danger)', color: 'var(--emp-danger)' };
        default:
            return { border: '1px solid var(--emp-border)', color: 'var(--emp-muted)' };
    }
}

/**
 * Asignador de permisos: un módulo por acordeón y una pastilla por acción.
 *
 * Sustituye a la tabla de columnas fijas que solo sabía pintar cinco verbos y dejaba
 * invisibles acciones como «agregar operación a la referencia» o «reordenar». Lo comparten
 * la plantilla del rol y el modal por usuario; en el segundo, cada pastilla dice además de
 * dónde viene —del rol, extra de la persona, o quitada—, que es lo que hace falta saber
 * para decidir si tocarla.
 */
export function PermissionCatalogueEditor({
    catalogue,
    value,
    onChange,
    readonly = false,
    variant = 'role',
    template = [],
    baseline,
    labels = {},
    onApplyTemplate,
    headerRight,
    summaryPosition = 'inline',
    initialOriginFilter = 'all',
}: Props) {
    const [term, setTerm] = useState('');
    const [origin, setOrigin] = useState<OriginFilter>(initialOriginFilter);
    const [collapsed, setCollapsed] = useState<Set<string>>(
        () => new Set(catalogue.slice(1).map((m) => m.key)),
    );

    const assigned = useMemo(() => new Set(value), [value]);
    const templateSet = useMemo(() => new Set(template), [template]);
    const baselineSet = useMemo(() => new Set(baseline ?? value), [baseline, value]);

    const namesOf = useCallback(
        (module: PermissionModule) => module.groups.flatMap((g) => g.permissions.map((p) => p.name)),
        [],
    );

    const allNames = useMemo(() => flattenCatalogue(catalogue), [catalogue]);

    const matchesOrigin = useCallback(
        (name: string) => {
            if (variant !== 'user' || origin === 'all') return true;

            const kind = originOf(name, assigned, templateSet);

            return origin === 'template' ? kind === 'template' : kind === 'extra' || kind === 'removed';
        },
        [variant, origin, assigned, templateSet],
    );

    /** Lo que el buscador y el filtro de origen dejan a la vista. */
    const visible = useMemo(() => {
        const needle = term.trim().toLowerCase();
        const textMatches = (module: PermissionModule, group: PermissionGroup, entry: PermissionEntry) =>
            needle === '' ||
            module.display.toLowerCase().includes(needle) ||
            group.display.toLowerCase().includes(needle) ||
            entry.label.toLowerCase().includes(needle) ||
            entry.name.toLowerCase().includes(needle);

        return catalogue
            .map((module) => {
                const groups = module.groups
                    .map((group) => {
                        const permissions = group.permissions.filter(
                            (entry) => textMatches(module, group, entry) && matchesOrigin(entry.name),
                        );

                        return permissions.length > 0 ? { ...group, permissions } : null;
                    })
                    .filter(Boolean) as PermissionGroup[];

                return groups.length > 0 ? { ...module, groups } : null;
            })
            .filter(Boolean) as PermissionModule[];
    }, [catalogue, term, matchesOrigin]);

    const visibleNames = useMemo(() => flattenCatalogue(visible), [visible]);

    /**
     * Conceder una acción arrastra el «ver» de su módulo y de su página.
     *
     * Las rutas siguen exigiendo el permiso de acceso al módulo además del fino: sin esta
     * regla se podría marcar «Crear anticipo» sin «Ver listado» y el permiso quedaría
     * muerto —guardado, pero sin efecto— sin que nada lo avisara.
     */
    const withImpliedViews = useCallback(
        (next: Set<string>, name: string) => {
            const [moduleKey, pageKey] = name.split('.');
            const moduleEntry = catalogue.find((m) => m.key === moduleKey);
            if (! moduleEntry) return;

            const names = namesOf(moduleEntry);
            if (names.includes(`${moduleKey}.index.view`)) next.add(`${moduleKey}.index.view`);
            if (pageKey && names.includes(`${moduleKey}.${pageKey}.view`)) next.add(`${moduleKey}.${pageKey}.view`);
        },
        [catalogue, namesOf],
    );

    const commit = (next: Set<string>) => onChange([...next]);

    const setMany = useCallback(
        (names: string[], on: boolean) => {
            if (readonly) return;

            const next = new Set(assigned);
            names.forEach((n) => {
                if (on) {
                    next.add(n);
                    withImpliedViews(next, n);
                } else {
                    next.delete(n);
                }
            });

            commit(next);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [readonly, assigned, withImpliedViews],
    );

    const toggle = (name: string) => {
        if (readonly) return;

        const next = new Set(assigned);
        if (next.has(name)) {
            next.delete(name);
        } else {
            next.add(name);
            withImpliedViews(next, name);
        }

        commit(next);
    };

    const stateOf = (names: string[]): 'on' | 'partial' | 'off' => {
        const hits = names.filter((n) => assigned.has(n)).length;
        if (hits === 0) return 'off';

        return hits === names.length ? 'on' : 'partial';
    };

    const changedIn = (names: string[]) =>
        names.filter((n) => assigned.has(n) !== baselineSet.has(n)).length;

    const originFilters: { value: OriginFilter; label: string }[] = [
        { value: 'all', label: 'Todos' },
        { value: 'template', label: 'Del rol' },
        { value: 'exceptions', label: 'Excepciones' },
    ];

    return (
        <div>
            {/* ------------------------------------------- barra de herramientas */}
            <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-0 flex-1 sm:max-w-[340px]">
                    <MagnifyingGlass
                        size={15}
                        className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2"
                        style={{ color: 'var(--emp-subtle)' }}
                    />
                    <input
                        value={term}
                        onChange={(e) => setTerm(e.target.value)}
                        placeholder="Buscar módulo, página o permiso"
                        aria-label="Buscar módulo, página o permiso"
                        className="emp-field pl-8"
                    />
                </div>

                {! readonly ? (
                    <>
                        <button
                            type="button"
                            onClick={() => setMany(visibleNames, true)}
                            className="emp-btn emp-btn-sm"
                        >
                            Marcar lo visible
                        </button>
                        <button
                            type="button"
                            onClick={() => setMany(visibleNames, false)}
                            className="emp-btn emp-btn-sm"
                        >
                            Quitar lo visible
                        </button>
                    </>
                ) : null}

                <button
                    type="button"
                    onClick={() =>
                        setCollapsed((prev) => (prev.size === 0 ? new Set(catalogue.map((m) => m.key)) : new Set()))
                    }
                    className="emp-btn emp-btn-sm"
                >
                    {collapsed.size === 0 ? <ArrowsInLineVertical size={13} /> : <ArrowsOutLineVertical size={13} />}
                    {collapsed.size === 0 ? 'Contraer todo' : 'Expandir todo'}
                </button>

                {headerRight}

                <span className="ml-auto shrink-0 text-[12px] tabular-nums" style={{ color: 'var(--emp-subtle)' }}>
                    {assigned.size} de {allNames.length} permisos
                </span>
            </div>

            {/* --------------------------------------------------- atajos (rol) */}
            {variant === 'role' && ! readonly ? (
                <div
                    className="mt-3 rounded-[10px] p-[10px_12px]"
                    style={{ backgroundColor: 'var(--emp-field-alt)' }}
                >
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                        <span className="emp-kicker shrink-0">Por verbo</span>
                        {VERB_GROUPS.map((verb) => {
                            const names = allNames.filter((n) => verb.matches(actionOf(n)));
                            const hits = names.filter((n) => assigned.has(n)).length;
                            const on = hits === names.length && names.length > 0;

                            return (
                                <button
                                    key={verb.key}
                                    type="button"
                                    onClick={() => setMany(names, ! on)}
                                    aria-pressed={on}
                                    className="h-[26px] rounded-full px-2.5 text-[12px] tabular-nums"
                                    style={{
                                        border: `1px solid ${on ? 'var(--emp-accent)' : 'var(--emp-border)'}`,
                                        backgroundColor: on ? 'var(--emp-accent-fill)' : 'transparent',
                                        color: on ? 'var(--emp-accent-on)' : 'var(--emp-muted)',
                                    }}
                                >
                                    {verb.label} {hits}/{names.length}
                                </button>
                            );
                        })}
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
                        <span className="emp-kicker shrink-0">Plantilla base</span>
                        {PRESETS.map((preset) => (
                            <button
                                key={preset.key}
                                type="button"
                                title={preset.description}
                                onClick={() => onChange(preset.build(allNames))}
                                className="h-[26px] rounded-full px-2.5 text-[12px]"
                                style={{ border: '1px solid var(--emp-border)', color: 'var(--emp-muted)' }}
                            >
                                {preset.label}
                            </button>
                        ))}
                    </div>
                </div>
            ) : null}

            {/* -------------------------------------------- origen (por usuario) */}
            {variant === 'user' ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                    <div className="emp-seg sm:w-[280px]">
                        {originFilters.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => setOrigin(option.value)}
                                className={`emp-seg-item ${origin === option.value ? 'emp-seg-on' : ''}`}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>

                    {onApplyTemplate && ! readonly ? (
                        <button type="button" onClick={onApplyTemplate} className="emp-btn emp-btn-sm">
                            <Sparkle size={13} />
                            Volver a la plantilla del rol
                        </button>
                    ) : null}

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]" style={{ color: 'var(--emp-subtle)' }}>
                        <span className="flex items-center gap-1.5">
                            <span
                                aria-hidden="true"
                                className="block h-3 w-3 rounded-[4px]"
                                style={{ backgroundColor: 'var(--emp-accent)' }}
                            />
                            Del rol
                        </span>
                        <span className="flex items-center gap-1.5">
                            <span
                                aria-hidden="true"
                                className="block h-3 w-3 rounded-[4px]"
                                style={{ border: '1px dashed var(--emp-accent-line)' }}
                            />
                            Extra de esta persona
                        </span>
                        <span className="flex items-center gap-1.5">
                            <span
                                aria-hidden="true"
                                className="block h-3 w-3 rounded-[4px]"
                                style={{ border: '1px solid var(--emp-danger)' }}
                            />
                            Quitado del rol
                        </span>
                    </div>
                </div>
            ) : null}

            {/* ------------------------------------------------------- modulos */}
            <div className="mt-3 flex flex-col gap-2">
                {visible.length === 0 ? (
                    <p className="py-8 text-center text-[13px]" style={{ color: 'var(--emp-muted)' }}>
                        Ningún permiso coincide con «{term}».
                    </p>
                ) : (
                    visible.map((module) => {
                        const names = namesOf(module);
                        const state = stateOf(names);
                        const open = ! collapsed.has(module.key) || term.trim() !== '';
                        const count = names.filter((n) => assigned.has(n)).length;
                        const changed = changedIn(names);

                        return (
                            <section
                                key={module.key}
                                className="overflow-hidden rounded-[12px]"
                                style={{ border: '1px solid var(--emp-border)' }}
                            >
                                <header
                                    className="flex items-center gap-2.5 px-3 py-2.5"
                                    style={{ backgroundColor: 'var(--emp-field-alt)' }}
                                >
                                    <TriBox
                                        state={state}
                                        onClick={() => setMany(names, state !== 'on')}
                                        label={`Todos los permisos de ${module.display}`}
                                        disabled={readonly}
                                    />

                                    <button
                                        type="button"
                                        onClick={() =>
                                            setCollapsed((prev) => {
                                                const next = new Set(prev);
                                                if (next.has(module.key)) next.delete(module.key);
                                                else next.add(module.key);

                                                return next;
                                            })
                                        }
                                        aria-expanded={open}
                                        className="flex min-w-0 flex-1 items-center gap-2 text-left"
                                    >
                                        <span className="text-[14px]" style={{ color: 'var(--emp-text)' }}>
                                            {module.display}
                                        </span>
                                        <span className="emp-pill shrink-0 tabular-nums">
                                            {count} / {names.length}
                                        </span>
                                        {changed > 0 ? (
                                            <span className="emp-pill emp-pill-accent shrink-0">
                                                {changed} cambiado{changed === 1 ? '' : 's'}
                                            </span>
                                        ) : null}
                                        {module.super_admin_only ? (
                                            <span className="emp-pill shrink-0">Solo super admin</span>
                                        ) : null}
                                        <CaretDown
                                            size={13}
                                            className="ml-auto shrink-0"
                                            style={{
                                                color: 'var(--emp-subtle)',
                                                transform: open ? 'rotate(180deg)' : undefined,
                                                transition: 'transform 120ms ease-out',
                                            }}
                                        />
                                    </button>
                                </header>

                                {open ? (
                                    <div className="flex flex-col gap-3 p-3">
                                        {module.groups.map((group) => {
                                            const groupNames = group.permissions.map((p) => p.name);
                                            const groupState = stateOf(groupNames);

                                            return (
                                                <div key={group.key}>
                                                    <div className="flex items-center gap-2">
                                                        <TriBox
                                                            state={groupState}
                                                            onClick={() => setMany(groupNames, groupState !== 'on')}
                                                            label={`Todo en ${group.display}`}
                                                            disabled={readonly}
                                                        />
                                                        <span className="text-[13px]" style={{ color: 'var(--emp-text)' }}>
                                                            {group.display}
                                                        </span>
                                                        {! readonly ? (
                                                            <button
                                                                type="button"
                                                                onClick={() => setMany(groupNames, groupState !== 'on')}
                                                                className="emp-btn emp-btn-sm ml-auto shrink-0"
                                                            >
                                                                Todo
                                                            </button>
                                                        ) : null}
                                                    </div>

                                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                                        {group.permissions.map((permission) => {
                                                            const kind =
                                                                variant === 'user'
                                                                    ? originOf(permission.name, assigned, templateSet)
                                                                    : assigned.has(permission.name)
                                                                      ? 'template'
                                                                      : 'none';

                                                            return (
                                                                <button
                                                                    key={permission.name}
                                                                    type="button"
                                                                    onClick={() => toggle(permission.name)}
                                                                    disabled={readonly}
                                                                    aria-pressed={assigned.has(permission.name)}
                                                                    title={`${permission.name} — ${ORIGIN_HELP[kind]}`}
                                                                    className="rounded-full px-2.5 py-1 text-[12px] disabled:cursor-default"
                                                                    style={chipStyle(kind, variant)}
                                                                >
                                                                    {permission.label}
                                                                    {variant === 'user' && kind === 'extra' ? (
                                                                        <span className="ml-1 text-[10px]">extra</span>
                                                                    ) : null}
                                                                    {variant === 'user' && kind === 'removed' ? (
                                                                        <span className="ml-1 text-[10px]">quitado</span>
                                                                    ) : null}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : null}
                            </section>
                        );
                    })
                )}
            </div>

            {summaryPosition !== 'none' && baseline && ! readonly ? (
                <PermissionSummaryBar
                    baseline={baseline}
                    value={value}
                    onDiscard={() => onChange([...baseline])}
                    labels={labels}
                    sticky={summaryPosition === 'sticky'}
                />
            ) : null}
        </div>
    );
}

export default PermissionCatalogueEditor;
