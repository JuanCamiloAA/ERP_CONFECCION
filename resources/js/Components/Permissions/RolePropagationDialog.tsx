import { router } from '@inertiajs/react';
import { useMemo, useState } from 'react';
import { TriBox } from '@/Components/Permissions/PermissionCatalogueEditor';
import { Modal } from '@/Components/UI/Modal';
import { formatNumber } from '@/lib/utils';

export interface PendingDiff {
    added: string[];
    removed: string[];
}

export interface AffectedUser {
    id: number;
    name: string;
    email: string;
    is_active: boolean;
    permissions_count: number;
    will_gain: number;
    will_lose: number;
}

interface Props {
    roleId: number;
    roleName: string;
    diff: PendingDiff | null;
    users: AffectedUser[];
    /** `permiso => "Módulo · Etiqueta"`, para no enseñar el nombre técnico. */
    labels: Record<string, string>;
}

/**
 * A quién se le aplica el cambio de la plantilla.
 *
 * El rol dejó de propagarse solo: tocar «Auxiliar contable» ya no altera en silencio lo que
 * pueden hacer diez personas. Se guarda la plantilla, y aquí se decide, usuario por usuario,
 * quién recibe el cambio. Lo que viaja es la diferencia —no la plantilla entera— para no
 * borrar los ajustes que cada uno tuviera por su cuenta.
 */
export function RolePropagationDialog({ roleId, roleName, diff, users, labels }: Props) {
    const hasDiff = Boolean(diff && (diff.added.length > 0 || diff.removed.length > 0));

    const [open, setOpen] = useState(hasDiff && users.length > 0);
    const [selected, setSelected] = useState<Set<number>>(() => new Set(users.map((u) => u.id)));
    const [mode, setMode] = useState<'delta' | 'replace'>('delta');
    const [saving, setSaving] = useState(false);

    const changed = useMemo(() => users.filter((u) => u.will_gain > 0 || u.will_lose > 0), [users]);

    if (! hasDiff || users.length === 0) {
        return null;
    }

    const label = (name: string) => labels[name] ?? name;

    const toggle = (id: number) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);

            return next;
        });
    };

    const apply = () => {
        setSaving(true);
        router.post(
            route('roles.propagate', roleId),
            { user_ids: [...selected], mode },
            { onFinish: () => setSaving(false) },
        );
    };

    const allState: 'on' | 'partial' | 'off' =
        selected.size === 0 ? 'off' : selected.size === users.length ? 'on' : 'partial';

    return (
        <Modal
            open={open}
            onClose={() => ! saving && setOpen(false)}
            size="3xl"
            sheetOnMobile
            title="Plantilla guardada. ¿A quién se le aplica?"
            description={`«${roleName}» cambió. Nadie pierde ni gana permisos hasta que lo confirmes aquí.`}
            footer={
                <div className="emp-scope flex w-full flex-wrap items-center justify-between gap-3">
                    <span className="text-[12px]" style={{ color: 'var(--emp-subtle)' }}>
                        {formatNumber(selected.size)} de {formatNumber(users.length)} usuarios seleccionados
                    </span>
                    <div className="flex gap-2">
                        <button type="button" className="emp-btn" disabled={saving} onClick={() => setOpen(false)}>
                            Ahora no
                        </button>
                        <button
                            type="button"
                            className="emp-btn emp-btn-primary"
                            disabled={saving || selected.size === 0}
                            onClick={apply}
                        >
                            {saving ? 'Aplicando…' : 'Aplicar a los seleccionados'}
                        </button>
                    </div>
                </div>
            }
        >
            <div className="emp-scope">
                {/* ------------------------------------------------ qué cambió */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                        <p className="emp-kicker">Se agregan ({diff!.added.length})</p>
                        <div className="mt-1 flex max-h-24 flex-wrap gap-1.5 overflow-auto">
                            {diff!.added.length === 0 ? (
                                <span className="text-[11.5px]" style={{ color: 'var(--emp-faint)' }}>
                                    Nada
                                </span>
                            ) : (
                                diff!.added.map((name) => (
                                    <span key={name} className="emp-pill emp-pill-accent" title={name}>
                                        {label(name)}
                                    </span>
                                ))
                            )}
                        </div>
                    </div>

                    <div>
                        <p className="emp-kicker">Se quitan ({diff!.removed.length})</p>
                        <div className="mt-1 flex max-h-24 flex-wrap gap-1.5 overflow-auto">
                            {diff!.removed.length === 0 ? (
                                <span className="text-[11.5px]" style={{ color: 'var(--emp-faint)' }}>
                                    Nada
                                </span>
                            ) : (
                                diff!.removed.map((name) => (
                                    <span key={name} className="emp-pill emp-pill-warn" title={name}>
                                        {label(name)}
                                    </span>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* ------------------------------------------------------ modo */}
                <div className="emp-seg mt-4 sm:w-[420px]">
                    <button
                        type="button"
                        onClick={() => setMode('delta')}
                        className={`emp-seg-item ${mode === 'delta' ? 'emp-seg-on' : ''}`}
                    >
                        Solo este cambio
                    </button>
                    <button
                        type="button"
                        onClick={() => setMode('replace')}
                        className={`emp-seg-item ${mode === 'replace' ? 'emp-seg-on' : ''}`}
                    >
                        Reemplazar por la plantilla
                    </button>
                </div>
                <p className="emp-help">
                    {mode === 'delta'
                        ? 'Suma y resta solo lo que acabas de cambiar; el resto de permisos de cada usuario queda como está.'
                        : 'Descarta los permisos propios de cada usuario y los deja exactamente como la plantilla.'}
                </p>

                {/* -------------------------------------------------- usuarios */}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <TriBox
                            state={allState}
                            onClick={() => setSelected(allState === 'on' ? new Set() : new Set(users.map((u) => u.id)))}
                            label="Seleccionar todos los usuarios"
                            size={17}
                        />
                        <span className="emp-kicker">Usuarios con este rol</span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={() => setSelected(new Set(users.map((u) => u.id)))}
                            className="emp-btn emp-btn-sm"
                        >
                            Todos
                        </button>
                        <button
                            type="button"
                            onClick={() => setSelected(new Set(changed.map((u) => u.id)))}
                            className="emp-btn emp-btn-sm"
                        >
                            Solo a quienes cambia
                        </button>
                        <button type="button" onClick={() => setSelected(new Set())} className="emp-btn emp-btn-sm">
                            Ninguno
                        </button>
                    </div>
                </div>

                <div className="mt-2 flex flex-col">
                    {users.map((user) => {
                        const noChange = mode === 'delta' && user.will_gain === 0 && user.will_lose === 0;

                        return (
                            <div
                                key={user.id}
                                className="emp-hover-row emp-row-sep flex items-center gap-3 px-2 py-2.5"
                            >
                                <TriBox
                                    state={selected.has(user.id) ? 'on' : 'off'}
                                    onClick={() => toggle(user.id)}
                                    label={`Aplicar a ${user.name}`}
                                    size={17}
                                />

                                <span
                                    aria-hidden="true"
                                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px]"
                                    style={{ backgroundColor: 'var(--emp-accent-fill)', color: 'var(--emp-accent-on)' }}
                                >
                                    {user.name.slice(0, 1).toUpperCase()}
                                </span>

                                <span className="min-w-0 flex-1">
                                    <span className="flex flex-wrap items-center gap-1.5">
                                        <span className="text-[13.5px]" style={{ color: 'var(--emp-text)' }}>
                                            {user.name}
                                        </span>
                                        {! user.is_active ? <span className="emp-pill">Inactivo</span> : null}
                                    </span>
                                    <span className="block truncate text-[11.5px]" style={{ color: 'var(--emp-subtle)' }}>
                                        {user.email} · {formatNumber(user.permissions_count)} permisos hoy
                                    </span>
                                </span>

                                <span className="flex shrink-0 items-center gap-1.5">
                                    {user.will_gain > 0 ? (
                                        <span className="emp-pill emp-pill-accent">+{user.will_gain}</span>
                                    ) : null}
                                    {user.will_lose > 0 ? (
                                        <span className="emp-pill emp-pill-warn">−{user.will_lose}</span>
                                    ) : null}
                                    {noChange ? (
                                        <span className="text-[11.5px]" style={{ color: 'var(--emp-faint)' }}>
                                            sin cambios
                                        </span>
                                    ) : null}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </Modal>
    );
}

export default RolePropagationDialog;
