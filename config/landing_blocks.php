<?php

/**
 * Catalogo de tipos de bloque de la landing publica — fuente unica de verdad.
 *
 * El editor genera el formulario a partir de este archivo y el FormRequest valida
 * contra el mismo esquema, asi que agregar un tipo nuevo requiere solo una entrada
 * aqui mas su componente de render en la landing; no hay que tocar React.
 *
 * Tipos de campo admitidos: text, textarea, link ({label,url}), icon, image, repeater,
 * select, multiselect y sql. Los tres ultimos admiten `options` fijas u `options_from`
 * (listas que sirve el servidor) y `show_if` para depender de otro campo del bloque.
 *
 * La clave `appearance` de cada tipo es su tamano, fondo y animacion por defecto: lo que
 * ve el visitante mientras el bloque no pase por la pestana «Diseno» del editor. Los
 * ajustes disponibles estan en config/landing_appearance.php y se guardan en
 * `data.appearance`. Un tipo con `appearance => false` dibuja su propio marco (el
 * encabezado, el pie y el flujo, que va dentro del hero) y no admite estos ajustes.
 */
return [
    'header' => [
        'label' => 'Encabezado y menú',
        'icon' => 'ph-squares-four',
        'singleton' => true,
        'appearance' => false,
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
        'appearance' => [
            'pad_top' => 'md',
            'pad_bottom' => 'md',
            'anim' => 'up',
            'anim_stagger' => 'normal',
        ],
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
        'appearance' => false,
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
        'appearance' => [
            'pad_top' => 'xs',
            'pad_bottom' => 'xs',
            'bg_type' => 'color',
            'bg_color' => 'band',
            'anim' => 'fade',
            'anim_stagger' => 'subtle',
        ],
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
        'appearance' => [
            'pad_top' => 'md',
            'pad_bottom' => 'md',
            'anim' => 'up',
        ],
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
        'appearance' => [
            'pad_top' => 'md',
            'pad_bottom' => 'md',
            'anim' => 'up',
        ],
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
        'appearance' => [
            'pad_top' => 'md',
            'pad_bottom' => 'md',
            'anim' => 'up',
        ],
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
        'appearance' => [
            'pad_top' => 'md',
            'pad_bottom' => 'md',
            'width' => 'narrow',
            'anim' => 'fade',
        ],
        'fields' => [
            'text' => ['type' => 'textarea', 'label' => 'Cita', 'max' => 280, 'rows' => 3],
            'source' => ['type' => 'text', 'label' => 'Autor', 'max' => 80],
        ],
    ],

    /*
     * Seccion de datos: no es una plantilla con textos fijos, sino una vista de informacion
     * que ya vive en la base. Se elige un origen y una presentacion; el contenido se
     * actualiza solo. Es lo que devuelve a la landing los planes y los clientes.
     */
    'data' => [
        'label' => 'Sección de datos',
        'icon' => 'ph-buildings',
        'singleton' => false,
        'appearance' => [
            'pad_top' => 'lg',
            'pad_bottom' => 'lg',
            'anim' => 'up',
        ],
        'fields' => [
            'title' => ['type' => 'text', 'label' => 'Título', 'max' => 80],
            'subtitle' => ['type' => 'textarea', 'label' => 'Descripción', 'max' => 240, 'rows' => 2],
            'source' => [
                'type' => 'select',
                'label' => 'Origen de los datos',
                'options_from' => 'data_sources',
            ],
            'presentation' => [
                'type' => 'select',
                'label' => 'Presentación',
                'options' => [
                    ['value' => 'plans', 'label' => 'Tarjetas de plan (precio y límites)'],
                    ['value' => 'logos', 'label' => 'Rejilla de logos'],
                    ['value' => 'cards', 'label' => 'Tarjetas simples'],
                    ['value' => 'stats', 'label' => 'Cifras'],
                ],
            ],
            'company_ids' => [
                'type' => 'multiselect',
                'label' => 'Empresas a mostrar',
                'help' => 'Sin marcar ninguna se muestran todas las activas.',
                'options_from' => 'companies',
                'show_if' => ['field' => 'source', 'value' => 'companies'],
            ],
            'query' => [
                'type' => 'sql',
                'label' => 'Consulta SELECT',
                'help' => 'Solo lectura. La landing es pública: no consultes datos de personas ni de nómina.',
                'max' => 1000,
                'show_if' => ['field' => 'source', 'value' => 'custom'],
            ],
            'cta_label' => [
                'type' => 'text',
                'label' => 'Texto del botón',
                'help' => 'Solo en tarjetas de plan. Vacío para no mostrarlo.',
                'max' => 40,
            ],
            'note' => ['type' => 'textarea', 'label' => 'Nota al pie', 'max' => 240, 'rows' => 2],
        ],
    ],

    'closing' => [
        'label' => 'Cierre',
        'icon' => 'ph-check-circle',
        'singleton' => false,
        'appearance' => [
            'pad_top' => 'none',
            'pad_bottom' => 'md',
            'anim' => 'up',
        ],
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
        'appearance' => false,
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
