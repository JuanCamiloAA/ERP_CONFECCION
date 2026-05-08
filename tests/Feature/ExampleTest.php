<?php

namespace Tests\Feature;

// use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ExampleTest extends TestCase
{
    /**
     * La raiz redirige a login o dashboard segun sesión (Inertia / ERP).
     */
    public function test_the_root_redirects_for_guests(): void
    {
        $response = $this->get('/');

        $response->assertRedirect(route('login', [], false));
    }
}
