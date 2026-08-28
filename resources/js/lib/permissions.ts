import type { PermissionModule } from '@/Components/Permissions/PermissionCatalogueEditor';

/** `modulo.pagina.accion` → `accion`. */
export function actionOf(name: string): string {
    const parts = name.split('.');

    return parts.length >= 3 ? parts.slice(2).join('.') : '';
}

export function moduleOf(name: string): string {
    return name.split('.')[0] ?? '';
}

export interface VerbGroup {
    key: string;
    label: string;
    matches: (action: string) => boolean;
}

/**
 * Atajos por verbo.
 *
 * «Exportar» agrupa todas las variantes (`export`, `export_excel`, `export_pdf`): quien
 * quiere dar permiso de exportar no está pensando en el formato del archivo.
 */
export const VERB_GROUPS: VerbGroup[] = [
    { key: 'view', label: 'Ver', matches: (a) => a === 'view' },
    { key: 'create', label: 'Crear', matches: (a) => a === 'create' },
    { key: 'edit', label: 'Editar', matches: (a) => a === 'edit' },
    { key: 'delete', label: 'Eliminar', matches: (a) => a === 'delete' },
    { key: 'export', label: 'Exportar', matches: (a) => a.startsWith('export') },
];

export interface PresetDefinition {
    key: string;
    label: string;
    description: string;
    build: (all: string[]) => string[];
}

const OPERATOR_PERMISSIONS = [
    'dashboard.index.view',
    'productions.index.view',
    'productions.index.create',
    'productions.index.workday_start',
    'productions.index.workday_close',
    'productions.report.view',
    'productions.ranking.view',
    'payrolls.index.view',
    'payrolls.show.view',
    'payrolls.employee.view',
    'payrolls.employee.receipt',
];

const SUPERVISOR_EXCLUDED_MODULES = ['users', 'roles', 'settings'];
const SUPERVISOR_EXCLUDED_ACTIONS = ['delete', 'approve', 'pay'];

/**
 * Plantillas base. Antes vivían en un bloque suelto encima del editor; ahora son chips
 * dentro de él, porque el efecto de pulsarlas se ve en el mismo sitio donde se aplica.
 */
export const PRESETS: PresetDefinition[] = [
    {
        key: 'read_only',
        label: 'Solo lectura',
        description: 'Solo los permisos de ver, en todos los módulos.',
        build: (all) => all.filter((name) => actionOf(name) === 'view'),
    },
    {
        key: 'operator',
        label: 'Operario',
        description: 'Acceso mínimo: registrar su producción y consultar su nómina.',
        build: (all) => OPERATOR_PERMISSIONS.filter((name) => all.includes(name)),
    },
    {
        key: 'supervisor',
        label: 'Supervisor',
        description: 'Todo el día a día menos eliminar, aprobar o pagar; sin usuarios ni ajustes.',
        build: (all) =>
            all.filter(
                (name) =>
                    ! SUPERVISOR_EXCLUDED_MODULES.includes(moduleOf(name)) &&
                    ! SUPERVISOR_EXCLUDED_ACTIONS.includes(actionOf(name)),
            ),
    },
    {
        key: 'admin',
        label: 'Administrador',
        description: 'Todos los permisos asignables de la empresa.',
        build: (all) => [...all],
    },
];

/** Todos los nombres de permiso que contiene un catálogo. */
export function flattenCatalogue(catalogue: PermissionModule[]): string[] {
    return catalogue.flatMap((module) => module.groups.flatMap((group) => group.permissions.map((p) => p.name)));
}

export type PermissionOrigin = 'template' | 'extra' | 'removed' | 'none';

/**
 * De dónde sale (o por qué falta) un permiso en la vista por usuario.
 *
 * Sin esto, una pastilla encendida no dice si viene del rol o si alguien la añadió a mano,
 * que es justo lo que hace falta saber para decidir si tocarla.
 */
export function originOf(name: string, assigned: Set<string>, template: Set<string>): PermissionOrigin {
    const has = assigned.has(name);
    const inTemplate = template.has(name);

    if (has && inTemplate) return 'template';
    if (has && ! inTemplate) return 'extra';
    if (! has && inTemplate) return 'removed';

    return 'none';
}

export const ORIGIN_HELP: Record<PermissionOrigin, string> = {
    template: 'Viene de la plantilla del rol',
    extra: 'Extra: se le dio a esta persona, no está en su rol',
    removed: 'Está en la plantilla del rol pero se le quitó a esta persona',
    none: 'No asignado',
};

/**
 * Paleta de la etiqueta de rol.
 *
 * Es la única excepción a usar solo variables `--emp-*`: lo elige quien crea el rol y es su
 * seña de identidad en toda la aplicación.
 */
export const ROLE_COLOR_PRESETS = [
    '#6366f1',
    '#10b981',
    '#f59e0b',
    '#ef4444',
    '#06b6d4',
    '#8b5cf6',
    '#ec4899',
    '#14b8a6',
];
