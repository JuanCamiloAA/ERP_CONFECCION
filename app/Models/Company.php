<?php

namespace App\Models;

use App\Models\Concerns\ResolvesMediaUrlsInArray;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Company extends Model
{
    use HasFactory, ResolvesMediaUrlsInArray, SoftDeletes;

    /**
     * @var list<string>
     */
    protected array $mediaUrlAttributes = ['logo'];

    protected $fillable = [
        'name',
        'nit',
        'address',
        'phone',
        'email',
        'logo',
        'is_active',
        'settings',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'settings' => 'array',
    ];

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    public function employees(): HasMany
    {
        return $this->hasMany(Employee::class);
    }

    public function references(): HasMany
    {
        return $this->hasMany(Reference::class);
    }

    public function operations(): HasMany
    {
        return $this->hasMany(Operation::class);
    }

    public function productions(): HasMany
    {
        return $this->hasMany(Production::class);
    }

    public function payrolls(): HasMany
    {
        return $this->hasMany(Payroll::class);
    }

    public function advances(): HasMany
    {
        return $this->hasMany(Advance::class);
    }

    public function settings(): HasMany
    {
        return $this->hasMany(Setting::class);
    }

    public function roles(): HasMany
    {
        return $this->hasMany(Role::class);
    }
}
