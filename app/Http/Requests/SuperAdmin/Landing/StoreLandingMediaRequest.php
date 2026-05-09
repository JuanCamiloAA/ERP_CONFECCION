<?php

namespace App\Http\Requests\SuperAdmin\Landing;

use App\Contracts\ObjectStorageInterface;
use Illuminate\Foundation\Http\FormRequest;

class StoreLandingMediaRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isSuperAdmin() ?? false;
    }

    public function rules(): array
    {
        return [
            'file' => ['required', 'file', 'max:10240', 'mimes:jpg,jpeg,png,gif,webp,svg'],
        ];
    }

    /**
     * @return array{path: string, url: string}
     */
    public function upload(): array
    {
        /** @var ObjectStorageInterface $storage */
        $storage = app(ObjectStorageInterface::class);

        return $storage->upload(
            $this->file('file'),
            'landing/'.now()->format('Y/m')
        );
    }
}
