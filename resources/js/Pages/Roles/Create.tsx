import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowLeft, CaretDown, FloppyDisk } from '@phosphor-icons/react';
import { FormEvent } from 'react';
import { PermissionCatalogueEditor, type PermissionModule } from '@/Components/Permissions/PermissionCatalogueEditor';
import AppLayout from '@/Layouts/AppLayout';
import { ROLE_COLOR_PRESETS } from '@/lib/permissions';
import { formatNumber, slugify } from '@/lib/utils';
import '../../../css/module-ui.css';

interface CompanyOption {
    id: number;
    name: string;
}

interface Props {
    catalogue: PermissionModule[];
    companies?: CompanyOption[];
    permissionLabels?: Record<string, string>;
}

export default function RoleCreate({ catalogue, companies = [], permissionLabels = {} }: Props) {
    const { data, setData, post, processing, errors } = useForm({
        display_name: '',
        name: '',
        description: '',
        color: ROLE_COLOR_PRESETS[0],
        permissions: [] as string[],
        company_id: '' as number | '',
    });

    const total = catalogue.reduce(
        (sum, module) => sum + module.groups.reduce((n, group) => n + group.permissions.length, 0),
        0,
    );

    const submit = (e: FormEvent) => {
        e.preventDefault();
        post(route('roles.store'));
    };

    return (
        <AppLayout title="Nuevo rol">
            <Head title="Nuevo rol" />

            <form
                onSubmit={submit}
                className="emp-form emp-bleed min-h-screen px-4 pb-28 pt-5 sm:px-[34px] sm:pb-8 lg:pb-8"
            >
                {/* -------------------------------------------------- cabecera */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                        <p className="emp-kicker flex flex-wrap items-center gap-1.5">
                            <Link href={route('roles.index')} className="hover:underline">
                                Roles
                            </Link>
                            <span aria-hidden="true">›</span>
                            <span>Nuevo</span>
                        </p>

                        <h1 className="mt-1 flex items-center gap-2 text-[24px]" style={{ color: 'var(--emp-text)' }}>
                            <span
                                aria-hidden="true"
                                className="h-2.5 w-2.5 shrink-0 rounded-full"
                                style={{ backgroundColor: data.color }}
                            />
                            {data.display_name || 'Nuevo rol'}
                        </h1>
                        <p className="mt-1 text-[13px]" style={{ color: 'var(--emp-muted)' }}>
                            Plantilla · todavía no la usa nadie
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 max-sm:hidden">
                        <Link href={route('roles.index')} className="emp-btn emp-btn-sm">
                            <ArrowLeft size={14} />
                            Cancelar
                        </Link>
                        <button type="submit" disabled={processing} className="emp-btn emp-btn-sm emp-btn-primary">
                            <FloppyDisk size={14} />
                            {processing ? 'Creando…' : 'Crear rol'}
                        </button>
                    </div>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
                    {/* ------------------------------------------ datos del rol */}
                    <section className="emp-card p-[18px]">
                        <p className="emp-kicker">Datos del rol</p>

                        <div className="mt-3 flex flex-col gap-[14px]">
                            <div>
                                <label className="emp-label" htmlFor="role-display-name">
                                    Nombre visible <span className="emp-req">*</span>
                                </label>
                                <input
                                    id="role-display-name"
                                    value={data.display_name}
                                    onChange={(e) => {
                                        setData((current) => ({
                                            ...current,
                                            display_name: e.target.value,
                                            // El identificador se deriva mientras no se toque a mano.
                                            name: slugify(e.target.value),
                                        }));
                                    }}
                                    className={`emp-field ${errors.display_name ? 'emp-field-error' : ''}`}
                                    required
                                />
                                {errors.display_name ? <p className="emp-error">{errors.display_name}</p> : null}
                            </div>

                            <div>
                                <label className="emp-label" htmlFor="role-name">
                                    Identificador interno <span className="emp-req">*</span>
                                </label>
                                <input
                                    id="role-name"
                                    value={data.name}
                                    onChange={(e) => setData('name', slugify(e.target.value))}
                                    className={`emp-field ${errors.name ? 'emp-field-error' : ''}`}
                                    style={{ fontFamily: 'ui-monospace, monospace', fontSize: '12px' }}
                                    required
                                />
                                {errors.name ? <p className="emp-error">{errors.name}</p> : null}
                                <p className="emp-help">Se genera del nombre; cámbialo solo si sabes lo que hace.</p>
                            </div>

                            <div>
                                <label className="emp-label" htmlFor="role-description">
                                    Para qué sirve este rol
                                </label>
                                <textarea
                                    id="role-description"
                                    rows={2}
                                    value={data.description}
                                    onChange={(e) => setData('description', e.target.value)}
                                    className="emp-field"
                                />
                                <p className="emp-help">Se lee en el selector de rol al crear un usuario.</p>
                            </div>

                            {companies.length > 0 ? (
                                <div>
                                    <label className="emp-label" htmlFor="role-company">
                                        Empresa <span className="emp-req">*</span>
                                    </label>
                                    <div className="relative">
                                        <select
                                            id="role-company"
                                            value={data.company_id}
                                            onChange={(e) =>
                                                setData('company_id', e.target.value === '' ? '' : Number(e.target.value))
                                            }
                                            className={`emp-field ${errors.company_id ? 'emp-field-error' : ''}`}
                                        >
                                            <option value="">Selecciona la empresa</option>
                                            {companies.map((company) => (
                                                <option key={company.id} value={company.id}>
                                                    {company.name}
                                                </option>
                                            ))}
                                        </select>
                                        <CaretDown
                                            size={13}
                                            className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2"
                                            style={{ color: 'var(--emp-subtle)' }}
                                        />
                                    </div>
                                    {errors.company_id ? <p className="emp-error">{errors.company_id}</p> : null}
                                </div>
                            ) : null}

                            <div>
                                <span className="emp-label">Color de la etiqueta</span>
                                <div className="flex flex-wrap items-center gap-2">
                                    {ROLE_COLOR_PRESETS.map((color) => (
                                        <button
                                            key={color}
                                            type="button"
                                            onClick={() => setData('color', color)}
                                            aria-label={`Color ${color}`}
                                            aria-pressed={data.color === color}
                                            className="h-[26px] w-[26px] rounded-full"
                                            style={{
                                                backgroundColor: color,
                                                border:
                                                    data.color === color
                                                        ? '2px solid var(--emp-accent-line)'
                                                        : '2px solid transparent',
                                            }}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* ------------------------------------------------- ayuda */}
                    <section className="emp-card p-[18px]">
                        <p className="emp-kicker">Cómo funciona</p>
                        <p className="mt-2 text-[12.5px]" style={{ color: 'var(--emp-muted)' }}>
                            El rol es una plantilla: al asignárselo a alguien se le copian estos permisos. A partir de
                            ahí, cada persona puede ajustarse por separado sin que el rol la vuelva a pisar.
                        </p>
                        <div className="emp-note mt-3">
                            Empieza por una plantilla base (Solo lectura, Operario, Supervisor o Administrador) y
                            afina desde ahí; los atajos están sobre el catálogo.
                        </div>
                    </section>
                </div>

                {/* ------------------------------------ permisos de la plantilla */}
                <section className="emp-card mt-4 p-[18px]">
                    <header className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="emp-kicker">Permisos de la plantilla</p>
                        <span className="text-[12px] tabular-nums" style={{ color: 'var(--emp-subtle)' }}>
                            {formatNumber(data.permissions.length)} de {formatNumber(total)}
                        </span>
                    </header>

                    <div className="mt-3">
                        <PermissionCatalogueEditor
                            catalogue={catalogue}
                            value={data.permissions}
                            onChange={(perms) => setData('permissions', perms)}
                            variant="role"
                            baseline={[]}
                            labels={permissionLabels}
                            summaryPosition="none"
                        />
                    </div>

                    {errors.permissions ? <p className="emp-error">{errors.permissions}</p> : null}
                </section>

                {/* Movil: crear al alcance del pulgar. */}
                <div
                    className="fixed inset-x-0 bottom-[var(--tabbar-h)] z-30 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:hidden"
                    style={{ backgroundColor: 'var(--emp-bar)', borderTop: '1px solid var(--emp-border)' }}
                >
                    <button type="submit" disabled={processing} className="emp-btn emp-btn-primary w-full">
                        <FloppyDisk size={17} />
                        {processing ? 'Creando…' : 'Crear rol'}
                    </button>
                </div>
            </form>
        </AppLayout>
    );
}
