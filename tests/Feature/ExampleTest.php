<?php

namespace Tests\Feature;

// use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ExampleTest extends TestCase
{
    /**
     * La raiz es la landing publica: el visitante sin sesion la ve.
     */
    public function test_the_root_shows_the_public_landing_for_guests(): void
    {
        $response = $this->get('/');

        $response->assertOk();
    }
}
