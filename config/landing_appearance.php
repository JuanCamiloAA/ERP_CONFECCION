<?php

/**
 * Catalogo de apariencia de los bloques de la landing — tamano, fondo y animacion.
 *
 * Es el equivalente de config/landing_blocks.php para lo que NO es contenido: aplica
 * igual a todos los tipos de bloque, se guarda en `data.appearance` y se valida con el
 * mismo recorrido generico del FormRequest. El editor pinta la pestana «Diseno» a partir
 * de estos grupos, asi que agregar un ajuste aqui no obliga a tocar React.
 *
 * Los valores de cada opcion son los que traduce a CSS
 * resources/js/Components/Public/appearance.ts; si se agrega uno hay que darle su
 * equivalente alli. Los valores por defecto de cada tipo de bloque viven en la clave
 * `appearance` de config/landing_blocks.php.
 *
 * Tipos de campo propios de este archivo: color (token del lenguaje o hex), range
 * (numero con min/max/step) y toggle (si/no). `show_if.value` admite una lista.
 */
return [
    'size' => [
        'label' => 'Tamaño y espacio',
        'icon' => 'ph-arrows-out',
        'fields' => [
            'height' => [
                'type' => 'select',
                'label' => 'Alto de la sección',
                'help' => 'El alto mínimo; si el contenido es más largo, la sección crece.',
                'options' => [
                    ['value' => 'auto', 'label' => 'Según el contenido'],
                    ['value' => 'third', 'label' => 'Franja (38% de la pantalla)'],
                    ['value' => 'half', 'label' => 'Media pantalla (55%)'],
                    ['value' => 'tall', 'label' => 'Casi completa (78%)'],
                    ['value' => 'screen', 'label' => 'Pantalla completa (100%)'],
                ],
            ],
            'align' => [
                'type' => 'select',
                'label' => 'Contenido en vertical',
                'help' => 'Manda cuando el alto es mayor que el contenido.',
                'options' => [
                    ['value' => 'start', 'label' => 'Arriba'],
                    ['value' => 'center', 'label' => 'Centrado'],
                    ['value' => 'end', 'label' => 'Abajo'],
                ],
            ],
            'width' => [
                'type' => 'select',
                'label' => 'Ancho del contenido',
                'help' => 'El fondo siempre ocupa todo el ancho de la pantalla.',
                'options' => [
                    ['value' => 'narrow', 'label' => 'Angosto (lectura)'],
                    ['value' => 'normal', 'label' => 'Normal'],
                    ['value' => 'wide', 'label' => 'Amplio'],
                    ['value' => 'full', 'label' => 'Completo (100% del ancho)'],
                ],
            ],
            'pad_top' => [
                'type' => 'select',
                'label' => 'Espacio arriba',
                'options' => [
                    ['value' => 'none', 'label' => 'Sin espacio'],
                    ['value' => 'xs', 'label' => 'Mínimo'],
                    ['value' => 'sm', 'label' => 'Corto'],
                    ['value' => 'md', 'label' => 'Normal'],
                    ['value' => 'lg', 'label' => 'Amplio'],
                    ['value' => 'xl', 'label' => 'Muy amplio'],
                ],
            ],
            'pad_bottom' => [
                'type' => 'select',
                'label' => 'Espacio abajo',
                'options' => [
                    ['value' => 'none', 'label' => 'Sin espacio'],
                    ['value' => 'xs', 'label' => 'Mínimo'],
                    ['value' => 'sm', 'label' => 'Corto'],
                    ['value' => 'md', 'label' => 'Normal'],
                    ['value' => 'lg', 'label' => 'Amplio'],
                    ['value' => 'xl', 'label' => 'Muy amplio'],
                ],
            ],
        ],
    ],

    'background' => [
        'label' => 'Fondo',
        'icon' => 'ph-image-square',
        'fields' => [
            'bg_type' => [
                'type' => 'select',
                'label' => 'Tipo de fondo',
                'options' => [
                    ['value' => 'none', 'label' => 'Sin fondo propio'],
                    ['value' => 'color', 'label' => 'Color'],
                    ['value' => 'image', 'label' => 'Imagen'],
                    ['value' => 'texture', 'label' => 'Textura'],
                    ['value' => 'gradient', 'label' => 'Degradado'],
                ],
            ],
            'bg_color' => [
                'type' => 'color',
                'label' => 'Color',
                'help' => 'Con textura o degradado es el color de base que va debajo.',
                'show_if' => ['field' => 'bg_type', 'value' => ['color', 'texture', 'gradient']],
            ],
            'bg_image' => [
                'type' => 'image',
                'label' => 'Imagen de fondo',
                'help' => 'Con 1920 px de ancho basta para pantalla completa; mas grande solo hace lenta la pagina.',
                'show_if' => ['field' => 'bg_type', 'value' => 'image'],
            ],
            'bg_fit' => [
                'type' => 'select',
                'label' => 'Ajuste',
                'options' => [
                    ['value' => 'cover', 'label' => 'Cubrir (recorta si hace falta)'],
                    ['value' => 'contain', 'label' => 'Contener (se ve completa)'],
                    ['value' => 'repeat', 'label' => 'Repetir en mosaico'],
                ],
                'show_if' => ['field' => 'bg_type', 'value' => 'image'],
            ],
            'bg_position' => [
                'type' => 'select',
                'label' => 'Encuadre',
                'options' => [
                    ['value' => 'center', 'label' => 'Centro'],
                    ['value' => 'top', 'label' => 'Arriba'],
                    ['value' => 'bottom', 'label' => 'Abajo'],
                    ['value' => 'left', 'label' => 'Izquierda'],
                    ['value' => 'right', 'label' => 'Derecha'],
                ],
                'show_if' => ['field' => 'bg_type', 'value' => 'image'],
            ],
            'bg_fixed' => [
                'type' => 'toggle',
                'label' => 'Fondo fijo al desplazar',
                'help' => 'La imagen se queda quieta mientras el contenido pasa por encima.',
                'show_if' => ['field' => 'bg_type', 'value' => 'image'],
            ],
            'bg_blur' => [
                'type' => 'range',
                'label' => 'Desenfoque de la imagen',
                'min' => 0,
                'max' => 24,
                'step' => 2,
                'unit' => 'px',
                'show_if' => ['field' => 'bg_type', 'value' => 'image'],
            ],
            'bg_texture' => [
                'type' => 'select',
                'label' => 'Textura',
                'options' => [
                    ['value' => 'dots', 'label' => 'Puntos'],
                    ['value' => 'grid', 'label' => 'Cuadrícula'],
                    ['value' => 'lines', 'label' => 'Líneas diagonales'],
                    ['value' => 'noise', 'label' => 'Grano'],
                    ['value' => 'glow', 'label' => 'Resplandor'],
                    ['value' => 'mesh', 'label' => 'Manchas de color'],
                    ['value' => 'rays', 'label' => 'Rayos'],
                ],
                'show_if' => ['field' => 'bg_type', 'value' => 'texture'],
            ],
            'bg_gradient' => [
                'type' => 'select',
                'label' => 'Degradado',
                'options' => [
                    ['value' => 'accent', 'label' => 'Fondo → acento'],
                    ['value' => 'band', 'label' => 'Banda → fondo'],
                    ['value' => 'dusk', 'label' => 'Superficie → fondo'],
                    ['value' => 'deep', 'label' => 'Profundo'],
                    ['value' => 'halo', 'label' => 'Halo central'],
                ],
                'show_if' => ['field' => 'bg_type', 'value' => 'gradient'],
            ],
            'overlay' => [
                'type' => 'range',
                'label' => 'Velo sobre el fondo',
                'help' => 'Oscurece el fondo para que el texto se siga leyendo.',
                'min' => 0,
                'max' => 90,
                'step' => 5,
                'unit' => '%',
                'show_if' => ['field' => 'bg_type', 'value' => ['image', 'texture', 'gradient']],
            ],
            'parallax' => [
                'type' => 'select',
                'label' => 'Paralaje al hacer scroll',
                'help' => 'El fondo se mueve más despacio que el contenido.',
                'options' => [
                    ['value' => 'none', 'label' => 'Sin paralaje'],
                    ['value' => 'soft', 'label' => 'Suave'],
                    ['value' => 'medium', 'label' => 'Medio'],
                    ['value' => 'strong', 'label' => 'Marcado'],
                ],
                'show_if' => ['field' => 'bg_type', 'value' => 'image'],
            ],
        ],
    ],

    'animation' => [
        'label' => 'Animación al aparecer',
        'icon' => 'ph-magic-wand',
        'help' => 'Se aplica al bloque y a cada pieza (título, párrafo, botones, tarjetas) cuando entra en pantalla.',
        'fields' => [
            'anim' => [
                'type' => 'select',
                'label' => 'Entrada',
                'options' => [
                    ['value' => 'none', 'label' => 'Sin animación'],
                    ['value' => 'fade', 'label' => 'Aparecer'],
                    ['value' => 'up', 'label' => 'Subir'],
                    ['value' => 'down', 'label' => 'Bajar'],
                    ['value' => 'left', 'label' => 'Entrar desde la derecha'],
                    ['value' => 'right', 'label' => 'Entrar desde la izquierda'],
                    ['value' => 'zoom', 'label' => 'Acercar'],
                    ['value' => 'zoom_out', 'label' => 'Alejar'],
                    ['value' => 'blur', 'label' => 'Enfocar'],
                    ['value' => 'rise', 'label' => 'Subir y crecer'],
                ],
            ],
            'anim_speed' => [
                'type' => 'select',
                'label' => 'Velocidad',
                'options' => [
                    ['value' => 'fast', 'label' => 'Rápida'],
                    ['value' => 'normal', 'label' => 'Normal'],
                    ['value' => 'slow', 'label' => 'Lenta'],
                ],
                'show_if' => ['field' => 'anim', 'value' => ['fade', 'up', 'down', 'left', 'right', 'zoom', 'zoom_out', 'blur', 'rise']],
            ],
            'anim_stagger' => [
                'type' => 'select',
                'label' => 'Escalonado entre piezas',
                'help' => 'Cuánto espera cada pieza respecto a la anterior.',
                'options' => [
                    ['value' => 'none', 'label' => 'Todas a la vez'],
                    ['value' => 'subtle', 'label' => 'Leve'],
                    ['value' => 'normal', 'label' => 'Normal'],
                    ['value' => 'wide', 'label' => 'Marcado'],
                ],
                'show_if' => ['field' => 'anim', 'value' => ['fade', 'up', 'down', 'left', 'right', 'zoom', 'zoom_out', 'blur', 'rise']],
            ],
            'anim_delay' => [
                'type' => 'range',
                'label' => 'Retraso inicial',
                'min' => 0,
                'max' => 800,
                'step' => 50,
                'unit' => 'ms',
                'show_if' => ['field' => 'anim', 'value' => ['fade', 'up', 'down', 'left', 'right', 'zoom', 'zoom_out', 'blur', 'rise']],
            ],
            'anim_once' => [
                'type' => 'toggle',
                'label' => 'Animar solo la primera vez',
                'help' => 'Apagado, la sección vuelve a animarse cada vez que entra en pantalla.',
                'show_if' => ['field' => 'anim', 'value' => ['fade', 'up', 'down', 'left', 'right', 'zoom', 'zoom_out', 'blur', 'rise']],
            ],
        ],
    ],
];
