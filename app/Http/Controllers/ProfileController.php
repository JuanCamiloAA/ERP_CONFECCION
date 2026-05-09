<?php

namespace App\Http\Controllers;

use App\Contracts\ObjectStorageInterface;
use App\Http\Requests\Profile\ChangePasswordRequest;
use App\Http\Requests\Profile\UpdateProfileRequest;
use App\Services\Files\StoredFileDeleter;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Inertia\Inertia;
use Inertia\Response;

class ProfileController extends Controller
{
    public function __construct(
        protected ObjectStorageInterface $objectStorage,
        protected StoredFileDeleter $storedFileDeleter,
    ) {}

    public function edit(Request $request): Response
    {
        return Inertia::render('Profile/Edit', [
            'user' => $request->user()->load('roles'),
        ]);
    }

    public function update(UpdateProfileRequest $request): RedirectResponse
    {
        $user = $request->user();
        $data = $request->validated();
        unset($data['avatar']);

        if ($request->hasFile('avatar')) {
            $this->storedFileDeleter->deleteIfPresent($user->getAttributes()['avatar'] ?? null);
            $dir = $user->company_id
                ? "companies/{$user->company_id}/users/{$user->id}/avatars"
                : "misc/users/{$user->id}/avatars";
            $uploaded = $this->objectStorage->upload($request->file('avatar'), $dir);
            $data['avatar'] = $uploaded['path'];
        }

        $user->update($data);

        return back()->with('success', 'Perfil actualizado.');
    }

    public function showChangePassword(): Response
    {
        return Inertia::render('Profile/ChangePassword');
    }

    public function changePassword(ChangePasswordRequest $request): RedirectResponse
    {
        $user = $request->user();
        $user->password = Hash::make($request->input('password'));
        $user->password_change_required = false;
        $user->save();

        return redirect()->route('dashboard')->with('success', 'Contrasena actualizada.');
    }
}
