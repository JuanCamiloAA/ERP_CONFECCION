<?php

namespace App\Models;

use App\Models\Concerns\ResolvesMediaUrlsInArray;
use App\Models\Scopes\CompanyScope;
use Illuminate\Database\Eloquent\Attributes\ScopedBy;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

#[ScopedBy([CompanyScope::class])]
class Bank extends Model
{
    use ResolvesMediaUrlsInArray, SoftDeletes;

    /** Tipos de entidad, con la etiqueta que ve el usuario. */
    public const TYPES = [
        'bank' => 'Banco',
        'wallet' => 'Billetera digital',
        'coop' => 'Cooperativa',
    ];

    protected $fillable = [
        'company_id',
        'code',
        'name',
        'logo_path',
        'brand_color',
        'type',
        'account_format',
        'account_hint',
        'requires_key',
        'notes',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'requires_key' => 'boolean',
    ];

    /** `logo_path` guarda la ruta; al serializar sale ya como URL utilizable. */
    protected array $mediaUrlAttributes = ['logo_url'];

    protected $appends = ['logo_url', 'initials', 'type_label'];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    /** Empleados con este banco (histórico: incluye registros si el banco queda inactivo). */
    public function employees(): HasMany
    {
        return $this->hasMany(Employee::class, 'bank_id');
    }

    /**
     * Ruta cruda del logo. `ResolvesMediaUrlsInArray` la convierte en URL al serializar, de
     * modo que el front nunca ve la ruta interna ni tiene que resolverla.
     */
    public function getLogoUrlAttribute(): ?string
    {
        $path = $this->attributes['logo_path'] ?? null;

        return $path === null || $path === '' ? null : (string) $path;
    }

    /**
     * Monograma de respaldo: dos letras del codigo, o del nombre si no hay codigo.
     *
     * Es lo que se pinta cuando el banco no tiene logo, y por eso no puede devolver vacio:
     * un recuadro en blanco parece un error de carga.
     */
    public function getInitialsAttribute(): string
    {
        $base = (string) ($this->attributes['code'] ?? '');
        if (trim($base) === '') {
            $base = (string) ($this->attributes['name'] ?? '');
        }

        $letters = preg_replace('/[^\p{L}\p{N}]/u', '', $base) ?? '';

        if ($letters === '') {
            return '??';
        }

        return mb_strtoupper(mb_substr($letters, 0, 2));
    }

    public function getTypeLabelAttribute(): string
    {
        return self::TYPES[$this->attributes['type'] ?? 'bank'] ?? self::TYPES['bank'];
    }
}
