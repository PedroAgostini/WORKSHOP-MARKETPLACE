<?php
/**
 * Emite o token antispam para o formulário (chamado pelo assets/js/antispam.js).
 */

declare(strict_types=1);

require __DIR__ . '/includes/antispam.php';
$config = require __DIR__ . '/includes/config.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, max-age=0');
header('X-Robots-Tag: noindex, nofollow');

echo json_encode(['token' => (new Antispam($config))->issueToken()]);
