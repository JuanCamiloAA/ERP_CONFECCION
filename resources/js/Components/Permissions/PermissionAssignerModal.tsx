import axios from 'axios';
import { router } from '@inertiajs/react';
import { ShieldCheck } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import {
    PermissionCatalogueEditor,
    type PermissionModule,
} from '@/Components/Permissions/PermissionCatalogueEditor';
import { PermissionSummaryBar } from '@/Components/Permissions/PermissionSummaryBar';
import { Modal } from '@/Components/UI/Modal';

interface CataloguePayload {
    user: {
        id: number;
        name: string;
        email: string;
        role: string | null;
        role_id: number | null;
        is_super_admin: boolean;
    };
    catalogue: PermissionModule[];
    assigned: string[];
    template: string[];
    labels: Record<string, string>;
    summary: { assigned: number; extra: number; missing: number; template: number };
}

interface Props {
    userId: number | null;
    onClose: () => void;
    /** La ficha del usuario lo abre directamente en «Excepciones». */
    initialOriginFilter?: 'all' | 'template' | 'exceptions';
}

/**
 * Asignador de permisos de un usuario.
 *
 * El rol es solo una plantilla: lo que queda marcado aquí es exactamente lo que la persona
 * puede hacer. Cada pastilla dice además de dónde viene —del rol, extra suya, o quitada—,
 * que es lo que hace falta para decidir si tocarla sin romper lo que alguien ajustó antes.
 */
export function PermissionAssignerModal({ userId, onClose, initialOriginFilter = 'all' }: Props) {
    const [payload, setPayload] = useState<CataloguePayload | null>(null);
    const [assigned, setAssigned] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (userId === null) {
            setPayload(null);
            setError(null);

            return;
        }

        let cancelled = false;
        setLoading(true);
        setError(null);

        axios
            .get<CataloguePayload>(route('users.permissions.show', userId), { headers: { Accept: 'application/json' } })
            .then(({ data }) => {
                if (cancelled) return;
                setPayload(data);
                setAssigned(data.assigned);
            })
            .catch(() => {
                if (! cancelled) setError('No se pudo cargar el catálogo de permisos.');
            })
            .finally(() => {
                if (! cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [userId]);

    const save = () => {
        if (userId === null) return;

        setSaving(true);
        router.put(
            route('users.permissions.update', userId),
            { permissions: assigned },
            {
                preserveScroll: true,
                onSuccess: () => onClose(),
                onFinish: () => setSaving(false),
            },
        );
    };

    const editable = payload !== null && ! payload.user.is_super_admin;

    return (
        <Modal
            open={userId !== null}
            onClose={() => ! saving && onClose()}
            size="4xl"
            sheetOnMobile
            title={
                <span className="flex items-center gap-2">
                    <ShieldCheck size={18} />
                    Permisos de {payload?.user.name ?? 'usuario'}
                </span>
            }
            description="Lo que quede marcado es exactamente lo que esta persona puede hacer."
            footer={
                <div className="emp-scope w-full">
                    {editable && payload ? (
                        <PermissionSummaryBar
                            baseline={payload.assigned}
                            value={assigned}
                            onDiscard={() => setAssigned(payload.assigned)}
                            labels={payload.labels}
                        />
                    ) : null}

                    <div className="flex w-full flex-wrap items-center justify-between gap-3">
                        <span className="max-w-[380px] text-[11.5px]" style={{ color: 'var(--emp-subtle)' }}>
                            Se guarda aparte de los datos del usuario: cambiar su rol no borra estas excepciones.
                        </span>
                        <div className="flex gap-2">
                            <button type="button" className="emp-btn" disabled={saving} onClick={onClose}>
                                Cancelar
                            </button>
                            <button
                                type="button"
                                className="emp-btn emp-btn-primary"
                                disabled={saving || ! editable}
                                onClick={save}
                            >
                                {saving ? 'Guardando…' : 'Guardar permisos'}
                            </button>
                        </div>
                    </div>
                </div>
            }
        >
            <div className="emp-scope">
                {loading ? (
                    <p className="py-10 text-center text-[13px]" style={{ color: 'var(--emp-muted)' }}>
                        Cargando permisos…
                    </p>
                ) : error ? (
                    <p className="py-10 text-center text-[13px]" style={{ color: 'var(--emp-danger)' }}>
                        {error}
                    </p>
                ) : payload?.user.is_super_admin ? (
                    <p className="py-10 text-center text-[13px]" style={{ color: 'var(--emp-muted)' }}>
                        El super administrador tiene todos los permisos por definición; no se le asignan uno a uno.
                    </p>
                ) : payload ? (
                    <PermissionCatalogueEditor
                        catalogue={payload.catalogue}
                        value={assigned}
                        onChange={setAssigned}
                        variant="user"
                        template={payload.template}
                        baseline={payload.assigned}
                        labels={payload.labels}
                        initialOriginFilter={initialOriginFilter}
                        summaryPosition="none"
                        onApplyTemplate={
                            payload.template.length > 0 ? () => setAssigned(payload.template) : undefined
                        }
                        headerRight={
                            payload.user.role ? (
                                <span className="emp-pill emp-pill-accent shrink-0">{payload.user.role}</span>
                            ) : null
                        }
                    />
                ) : null}
            </div>
        </Modal>
    );
}

export default PermissionAssignerModal;
