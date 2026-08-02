<?php

namespace App\Services\DashboardBuilder;

/**
 * Excepcion de validacion de la capa de seguridad del constructor de widgets.
 * Se lanza ANTES de ejecutar cualquier SQL cuando algo no supera la whitelist.
 */
class WidgetQueryException extends \RuntimeException {}
