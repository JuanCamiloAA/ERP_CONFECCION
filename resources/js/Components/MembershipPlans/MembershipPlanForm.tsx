import { Link, useForm } from '@inertiajs/react';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { type FormEvent, useMemo } from 'react';
import { Button } from '@/Components/UI/Button';
import { Card, CardHeader } from '@/Components/UI/Card';
import { Input } from '@/Components/UI/Input';
import { PageHeader } from '@/Components/UI/PageHeader';
import { StickySaveBar } from '@/Components/UI/StickySaveBar';
import { Switch } from '@/Components/UI/Switch';
import { Textarea } from '@/Components/UI/Textarea';
import { PlanCard } from '@/Components/MembershipPlans/PlanCard';

export interface PlanFormPlan {
    id: number;
    name: string;
    slug: string;
    max_staff_users: number | null;
    max_employees: number | null;
    price_monthly: string | null;
    features_json: string[] | null;
    is_active: boolean;
    sort_order: number;
}

interface Props {
    /** Ausente al crear. */
    plan?: PlanFormPlan;
}

type FormFields = {
    name: string;
    slug: string;
    max_staff_users: string;
    max_employees: string;
    price_monthly: string;
    features_text: string;
    is_active: boolean;
    sort_order: string;
};

/** `Plan Pro` → `plan-pro`. El slug viaja en la URL de Empresas, de ahi el guion medio. */
function slugify(value: string): string {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60);
}

function featureLines(text: string): string[] {
    return text
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
}

/**
 * Formulario unico de crear y editar plan, con la ficha del plan a la derecha.
 *
 * La previsualizacion no es adorno: los limites vacios significan «ilimitado» y el precio se
 * escribe en crudo, dos cosas que solo se entienden viendo como quedan escritas.
 */
export function MembershipPlanForm({ plan }: Props) {
    const editing = plan !== undefined;

    const initial: FormFields = useMemo(
        () => ({
            name: plan?.name ?? '',
            slug: plan?.slug ?? '',
            max_staff_users: plan?.max_staff_users != null ? String(plan.max_staff_users) : '',
            max_employees: plan?.max_employees != null ? String(plan.max_employees) : '',
            price_monthly: plan?.price_monthly != null ? String(plan.price_monthly) : '',
            features_text: (plan?.features_json ?? []).join('\n'),
            is_active: plan?.is_active ?? true,
            sort_order: String(plan?.sort_order ?? 0),
        }),
        [plan],
    );

    const { data, setData, post, put, transform, processing, errors, reset } = useForm<FormFields>(initial);

    const changes = useMemo(
        () => (Object.keys(initial) as (keyof FormFields)[]).filter((key) => data[key] !== initial[key]).length,
        [data, initial],
    );

    const submit = (e: FormEvent) => {
        e.preventDefault();

        // El servidor espera numeros y un array; el formulario guarda cadenas para poder
        // distinguir «vacio» (ilimitado) de «cero».
        transform((d) => ({
            name: d.name,
            slug: slugify(d.slug),
            max_staff_users: d.max_staff_users === '' ? null : Number(d.max_staff_users),
            max_employees: d.max_employees === '' ? null : Number(d.max_employees),
            price_monthly: d.price_monthly === '' ? null : Number(d.price_monthly),
            features_json: featureLines(d.features_text).length ? featureLines(d.features_text) : null,
            is_active: d.is_active,
            sort_order: Number(d.sort_order) || 0,
        }));

        if (editing) {
            put(route('super-admin.membership-plans.update', plan.id), { preserveScroll: true });

            return;
        }

        post(route('super-admin.membership-plans.store'));
    };

    return (
        <form onSubmit={submit} className="space-y-6">
            <PageHeader
                title={editing ? `Editar ${plan.name}` : 'Nuevo plan'}
                breadcrumbs={[
                    { label: 'Planes', href: route('super-admin.membership-plans.index') },
                    { label: editing ? plan.name : 'Nuevo' },
                ]}
                action={
                    <Link href={route('super-admin.membership-plans.index')} className="shrink-0">
                        <Button
                            type="button"
                            variant="ghost"
                            icon={<ArrowLeftIcon className="h-4 w-4" />}
                            className="whitespace-nowrap shrink-0"
                        >
                            Volver al listado
                        </Button>
                    </Link>
                }
            />

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr,320px]">
                <div className="min-w-0 space-y-6">
                    <Card>
                        <CardHeader title="Datos" />
                        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <Input
                                label="Nombre"
                                value={data.name}
                                onChange={(e) => {
                                    // Al crear, el slug sigue al nombre; al editar no, porque ya
                                    // hay enlaces y filtros guardados que lo usan.
                                    setData((current) => ({
                                        ...current,
                                        name: e.target.value,
                                        slug: editing ? current.slug : slugify(e.target.value),
                                    }));
                                }}
                                error={errors.name}
                                required
                            />
                            <Input
                                label="Slug"
                                value={data.slug}
                                onChange={(e) => setData('slug', e.target.value)}
                                onBlur={() => setData('slug', slugify(data.slug))}
                                error={errors.slug}
                                description="Se usa en la URL del filtro de Empresas"
                                required
                            />
                            <Input
                                type="number"
                                label="Orden"
                                value={data.sort_order}
                                onChange={(e) => setData('sort_order', e.target.value)}
                                error={errors.sort_order}
                                description="Menor primero, en listados y selectores"
                            />
                            <Input
                                type="number"
                                label="Precio mensual"
                                value={data.price_monthly}
                                onChange={(e) => setData('price_monthly', e.target.value)}
                                error={errors.price_monthly}
                                description="Vacío = sin precio publicado"
                            />
                        </div>
                    </Card>

                    <Card>
                        <CardHeader title="Límites" description="Vacío = ilimitado." />
                        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <Input
                                type="number"
                                min={0}
                                label="Máximo de usuarios staff"
                                value={data.max_staff_users}
                                onChange={(e) => setData('max_staff_users', e.target.value)}
                                error={errors.max_staff_users}
                                description="Vacío = ilimitado"
                            />
                            <Input
                                type="number"
                                min={0}
                                label="Máximo de empleados"
                                value={data.max_employees}
                                onChange={(e) => setData('max_employees', e.target.value)}
                                error={errors.max_employees}
                                description="Vacío = ilimitado"
                            />
                        </div>
                    </Card>

                    <Card>
                        <CardHeader title="Características" description="Una por línea." />
                        <div className="mt-4 space-y-4">
                            <Textarea
                                label="Caracteristicas"
                                value={data.features_text}
                                onChange={(e) => setData('features_text', e.target.value)}
                                error={(errors as Record<string, string>).features_json}
                                rows={6}
                            />
                            <Switch
                                checked={data.is_active}
                                onChange={(v) => setData('is_active', v)}
                                label="Plan activo"
                                description="Los inactivos no se ofrecen al asignar plan a una empresa"
                            />
                        </div>
                    </Card>
                </div>

                <div className="min-w-0">
                    <p className="mb-2 text-[10px] uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">
                        Vista previa
                    </p>
                    <PlanCard
                        plan={{
                            name: data.name,
                            slug: data.slug,
                            max_staff_users: data.max_staff_users === '' ? null : Number(data.max_staff_users),
                            max_employees: data.max_employees === '' ? null : Number(data.max_employees),
                            price_monthly: data.price_monthly === '' ? null : data.price_monthly,
                            features_json: featureLines(data.features_text),
                            is_active: data.is_active,
                        }}
                        className="lg:sticky lg:top-6"
                    />
                </div>
            </div>

            <StickySaveBar
                changes={changes}
                processing={processing}
                onCancel={() => reset()}
                submitLabel={editing ? 'Guardar cambios' : 'Crear plan'}
            />
        </form>
    );
}

export default MembershipPlanForm;
