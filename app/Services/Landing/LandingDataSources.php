<?php

namespace App\Services\Landing;

use App\Models\Company;
use App\Models\MembershipPlan;
use App\Services\Files\MediaUrlResolver;
use RuntimeException;

/**
 * Origenes de datos del bloque «Seccion de datos» de la landing.
 *
 * Vive en una clase y no en config/ a proposito: los resolutores son codigo, y un archivo
 * de configuracion con closures no sobrevive a `config:cache` en el servidor.
 *
 * Cada origen devuelve filas ya presentadas (solo los campos que se pintan), de modo que
 * ninguna columna que no se haya elegido aqui puede llegar por accidente a la pagina.
 */
class LandingDataSources
{
    public const CUSTOM = 'custom';

    public function __construct(
        private readonly SafeQueryRunner $queryRunner,
        private readonly MediaUrlResolver $media,
    ) {}

    /**
     * Metadatos para el editor: que origenes hay y con que presentacion combinan.
     *
     * @return array<string, array{label: string, description: string, presentations: list<string>}>
     */
    public function catalog(): array
    {
        return [
            'membership_plans' => [
                'label' => 'Planes de membresía',
                'description' => 'Los planes activos, con su precio y sus límites. Se actualizan solos.',
                'presentations' => ['plans'],
            ],
            'companies' => [
                'label' => 'Empresas (clientes y aliados)',
                'description' => 'Empresas activas con su logo. Puedes elegir cuáles se muestran.',
                'presentations' => ['logos', 'cards'],
            ],
            'stats' => [
                'label' => 'Cifras del sistema',
                'description' => 'Totales agregados. Nunca datos de un taller concreto.',
                'presentations' => ['stats'],
            ],
            self::CUSTOM => [
                'label' => 'Consulta personalizada',
                'description' => 'Un SELECT que escribes tú. Recuerda que la landing es pública.',
                'presentations' => ['cards', 'stats', 'logos'],
            ],
        ];
    }

    /**
     * Opciones que el editor necesita para pintar los selectores.
     *
     * @return array<string, list<array{value: string|int, label: string}>>
     */
    public function editorOptions(): array
    {
        return [
            'data_sources' => collect($this->catalog())
                ->map(fn (array $meta, string $key) => ['value' => $key, 'label' => $meta['label']])
                ->values()
                ->all(),
            'companies' => Company::query()
                ->orderBy('name')
                ->get(['id', 'name'])
                ->map(fn (Company $c) => ['value' => $c->id, 'label' => $c->name])
                ->values()
                ->all(),
        ];
    }

    /**
     * Resuelve el origen configurado en un bloque.
     *
     * Nunca lanza: un origen roto no debe tumbar la landing publica. El error viaja en la
     * respuesta para que el editor lo muestre y el visitante no vea nada.
     *
     * @param  array<string, mixed>  $data  Contenido del bloque.
     * @return array{rows: list<array<string, mixed>>, error: string|null}
     */
    public function resolve(array $data): array
    {
        $source = is_string($data['source'] ?? null) ? $data['source'] : '';

        try {
            return ['rows' => $this->rowsFor($source, $data), 'error' => null];
        } catch (RuntimeException $e) {
            return ['rows' => [], 'error' => $e->getMessage()];
        } catch (\Throwable $e) {
            report($e);

            return ['rows' => [], 'error' => 'No se pudieron obtener los datos.'];
        }
    }

    /**
     * @param  array<string, mixed>  $data
     * @return list<array<string, mixed>>
     */
    private function rowsFor(string $source, array $data): array
    {
        return match ($source) {
            'membership_plans' => $this->membershipPlans(),
            'companies' => $this->companies($data),
            'stats' => $this->stats(),
            self::CUSTOM => $this->queryRunner->run((string) ($data['query'] ?? '')),
            default => [],
        };
    }

    /** @return list<array<string, mixed>> */
    private function membershipPlans(): array
    {
        return MembershipPlan::query()
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get()
            ->map(fn (MembershipPlan $plan) => [
                'id' => $plan->id,
                'name' => $plan->name,
                'price' => $plan->price_monthly !== null ? (float) $plan->price_monthly : null,
                'lines' => array_values(array_filter([
                    $plan->max_staff_users !== null
                        ? 'Hasta '.$plan->max_staff_users.' usuarios de escritorio (staff)'
                        : 'Usuarios de escritorio: ilimitados',
                    $plan->max_employees !== null
                        ? 'Hasta '.$plan->max_employees.' empleados en nómina'
                        : 'Empleados en nómina: ilimitados',
                    ...array_map(fn ($f) => is_string($f) ? $f : null, $plan->features_json ?? []),
                ])),
            ])
            ->values()
            ->all();
    }

    /**
     * @param  array<string, mixed>  $data
     * @return list<array<string, mixed>>
     */
    private function companies(array $data): array
    {
        $chosen = collect($data['company_ids'] ?? [])
            ->filter(fn ($id) => is_numeric($id))
            ->map(fn ($id) => (int) $id);

        return Company::query()
            ->where('is_active', true)
            ->when($chosen->isNotEmpty(), fn ($q) => $q->whereIn('id', $chosen->all()))
            ->orderBy('name')
            ->get()
            ->map(fn (Company $c) => [
                'id' => $c->id,
                'name' => $c->name,
                'logo_url' => $this->media->url($c->getAttributes()['logo'] ?? null),
            ])
            ->values()
            ->all();
    }

    /**
     * Solo totales: una cifra agregada no identifica a ningun taller ni a ninguna persona.
     *
     * @return list<array<string, mixed>>
     */
    private function stats(): array
    {
        return [
            ['label' => 'Talleres conectados', 'value' => Company::query()->where('is_active', true)->count()],
            ['label' => 'Planes disponibles', 'value' => MembershipPlan::query()->where('is_active', true)->count()],
        ];
    }
}
