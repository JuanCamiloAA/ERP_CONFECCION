<?php

/**
 * Catalogo de tipos de bloque de la landing publica — fuente unica de verdad.
 *
 * El editor genera el formulario a partir de este archivo y el FormRequest valida
 * contra el mismo esquema, asi que agregar un tipo nuevo requiere solo una entrada
 * aqui mas su componente de render en la landing; no hay que tocar React.
 *
 * Tipos de campo admitidos: text, textarea, link ({label,url}), icon, image, repeater.
 */
return [
    'header' => [
        'label' => 'Encabezado y menú',
        'icon' => 'ph-squares-four',
        'singleton' => true,
        'fields' => [
            'brand' => ['type' => 'text', 'label' => 'Marca', 'max' => 40],
            'links' => [
                'type' => 'repeater',
                'label' => 'Enlaces del menú',
                'singular' => 'enlace',
                'max_items' => 6,
                'item' => [
                    'label' => ['type' => 'text', 'label' => 'Texto', 'max' => 30],
                    'url' => ['type' => 'text', 'label' => 'Destino', 'max' => 200],
                ],
            ],
            'cta' => ['type' => 'link', 'label' => 'Botón principal'],
        ],
    ],

    'hero' => [
        'label' => 'Hero',
        'icon' => 'ph-needle',
        'singleton' => true,
        'fields' => [
            'tag' => ['type' => 'text', 'label' => 'Etiqueta', 'max' => 60],
            'title' => ['type' => 'textarea', 'label' => 'Título', 'max' => 120, 'rows' => 2],
            'body' => ['type' => 'textarea', 'label' => 'Párrafo', 'max' => 320, 'rows' => 3],
            'primary' => ['type' => 'link', 'label' => 'Botón principal'],
            'secondary' => ['type' => 'link', 'label' => 'Botón secundario'],
            'trust' => [
                'type' => 'repeater',
                'label' => 'Sellos de confianza',
                'singular' => 'sello',
                'max_items' => 4,
                'item' => [
                    'label' => ['type' => 'text', 'label' => 'Texto', 'max' => 40],
                ],
            ],
        ],
    ],

    'flow' => [
        'label' => 'Esquema del flujo',
        'icon' => 'ph-seal-check',
        'singleton' => true,
        'fields' => [
            'kicker' => ['type' => 'text', 'label' => 'Antetítulo', 'max' => 60],
            'steps' => [
                'type' => 'repeater',
                'label' => 'Pasos',
                'singular' => 'paso',
                'max_items' => 6,
                'item' => [
                    'icon' => ['type' => 'icon', 'label' => 'Ícono'],
                    'title' => ['type' => 'text', 'label' => 'Título', 'max' => 60],
                    'body' => ['type' => 'text', 'label' => 'Descripción', 'max' => 120],
                ],
            ],
            'caption' => ['type' => 'text', 'label' => 'Leyenda', 'max' => 120],
        ],
    ],

    'band' => [
        'label' => 'Banda multiempresa',
        'icon' => 'ph-buildings',
        'singleton' => false,
        'fields' => [
            'title' => ['type' => 'text', 'label' => 'Título', 'max' => 60],
            'items' => [
                'type' => 'repeater',
                'label' => 'Promesas',
                'singular' => 'promesa',
                'max_items' => 5,
                'item' => [
                    'icon' => ['type' => 'icon', 'label' => 'Ícono'],
                    'label' => ['type' => 'text', 'label' => 'Texto', 'max' => 48],
                ],
            ],
        ],
    ],

    'virtues' => [
        'label' => 'Virtudes',
        'icon' => 'ph-shield-check',
        'singleton' => false,
        'fields' => [
            'kicker' => ['type' => 'text', 'label' => 'Antetítulo', 'max' => 60],
            'title' => ['type' => 'textarea', 'label' => 'Título', 'max' => 120, 'rows' => 2],
            'cards' => [
                'type' => 'repeater',
                'label' => 'Tarjetas',
                'singular' => 'tarjeta',
                'max_items' => 9,
                'item' => [
                    'icon' => ['type' => 'icon', 'label' => 'Ícono'],
                    'title' => ['type' => 'text', 'label' => 'Título', 'max' => 60],
                    'body' => ['type' => 'textarea', 'label' => 'Descripción', 'max' => 240, 'rows' => 3],
                ],
            ],
        ],
    ],

    'audience' => [
        'label' => 'Para quién',
        'icon' => 'ph-users-three',
        'singleton' => false,
        'fields' => [
            'kicker' => ['type' => 'text', 'label' => 'Antetítulo', 'max' => 60],
            'title' => ['type' => 'textarea', 'label' => 'Título', 'max' => 120, 'rows' => 2],
            'roles' => [
                'type' => 'repeater',
                'label' => 'Roles',
                'singular' => 'rol',
                'max_items' => 4,
                'item' => [
                    'tag' => ['type' => 'text', 'label' => 'Etiqueta', 'max' => 24],
                    'title' => ['type' => 'text', 'label' => 'Título', 'max' => 60],
                    'points' => [
                        'type' => 'repeater',
                        'label' => 'Puntos',
                        'singular' => 'punto',
                        'max_items' => 5,
                        'item' => [
                            'label' => ['type' => 'text', 'label' => 'Texto', 'max' => 90],
                        ],
                    ],
                ],
            ],
        ],
    ],

    'steps_media' => [
        'label' => 'Pasos + foto',
        'icon' => 'ph-package',
        'singleton' => false,
        'fields' => [
            'kicker' => ['type' => 'text', 'label' => 'Antetítulo', 'max' => 60],
            'steps' => [
                'type' => 'repeater',
                'label' => 'Pasos',
                'singular' => 'paso',
                'max_items' => 5,
                'item' => [
                    'number' => ['type' => 'text', 'label' => 'Número', 'max' => 4],
                    'title' => ['type' => 'text', 'label' => 'Título', 'max' => 60],
                    'body' => ['type' => 'textarea', 'label' => 'Descripción', 'max' => 200, 'rows' => 2],
                ],
            ],
            'image' => ['type' => 'image', 'label' => 'Imagen'],
            'image_caption' => ['type' => 'text', 'label' => 'Leyenda del marco', 'max' => 120],
        ],
    ],

    'quote' => [
        'label' => 'Testimonio',
        'icon' => 'ph-clipboard-text',
        'singleton' => false,
        'fields' => [
            'text' => ['type' => 'textarea', 'label' => 'Cita', 'max' => 280, 'rows' => 3],
            'source' => ['type' => 'text', 'label' => 'Autor', 'max' => 80],
        ],
    ],

    'closing' => [
        'label' => 'Cierre',
        'icon' => 'ph-check-circle',
        'singleton' => false,
        'fields' => [
            'title' => ['type' => 'textarea', 'label' => 'Título', 'max' => 120, 'rows' => 2],
            'body' => ['type' => 'textarea', 'label' => 'Párrafo', 'max' => 240, 'rows' => 3],
            'primary' => ['type' => 'link', 'label' => 'Botón principal'],
            'secondary' => ['type' => 'link', 'label' => 'Botón secundario'],
        ],
    ],

    'footer' => [
        'label' => 'Pie de página',
        'icon' => 'ph-clock',
        'singleton' => true,
        'fields' => [
            'copyright' => ['type' => 'text', 'label' => 'Aviso de copyright', 'max' => 80],
            'links' => [
                'type' => 'repeater',
                'label' => 'Enlaces',
                'singular' => 'enlace',
                'max_items' => 6,
                'item' => [
                    'label' => ['type' => 'text', 'label' => 'Texto', 'max' => 30],
                    'url' => ['type' => 'text', 'label' => 'Destino', 'max' => 200],
                ],
            ],
        ],
    ],
];
