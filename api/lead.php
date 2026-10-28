<?php
/**
 * Recebe o formulário das LPs, passa pelo antispam e encaminha o lead.
 *
 * Campos esperados: nome, email, telefone, _lp (lp1|lp2), _token, website (honeypot).
 * UTMs (utm_*) e campos extras são repassados ao webhook.
 */

declare(strict_types=1);

require __DIR__ . '/includes/antispam.php';
$config = require __DIR__ . '/includes/config.php';

header('Cache-Control: no-store, max-age=0');
header('X-Robots-Tag: noindex, nofollow');

$wantsJson = str_contains($_SERVER['HTTP_ACCEPT'] ?? '', 'application/json');
$lp        = (string)($_POST['_lp'] ?? '');
$thanksUrl = $config['lps'][$lp] ?? null;

function respond(bool $ok, string $message, ?string $redirect, bool $json, int $status = 200): never
{
    http_response_code($status);
    if ($json) {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['ok' => $ok, 'message' => $message, 'redirect' => $redirect], JSON_UNESCAPED_UNICODE);
    } elseif ($redirect) {
        header('Location: ' . $redirect, true, 303);
    } else {
        header('Content-Type: text/plain; charset=utf-8');
        echo $message;
    }
    exit;
}

if ($thanksUrl === null) {
    respond(false, 'Formulário inválido.', null, $wantsJson, 400);
}

$reason = (new Antispam($config))->check($_POST);

if ($reason !== null) {
    error_log("[antispam] bloqueado: $reason | ip=" . Antispam::clientIp() . " | lp=$lp");

    // Para bots, finge sucesso (não ensina o que foi detectado).
    if (in_array($reason, ['honeypot', 'too_fast', 'links', 'blocked_word', 'charset'], true)) {
        respond(true, 'Inscrição recebida!', $thanksUrl, $wantsJson);
    }

    $messages = [
        'nome'          => 'Confira o seu nome.',
        'email'         => 'Confira o seu e-mail.',
        'email_domain'  => 'Esse domínio de e-mail não parece válido.',
        'telefone'      => 'Confira o seu WhatsApp com DDD.',
        'rate_limit'    => 'Muitas tentativas. Aguarde alguns minutos.',
        'token_expired' => 'A página ficou aberta muito tempo. Atualize e envie de novo.',
    ];
    respond(false, $messages[$reason] ?? 'Não foi possível enviar. Atualize a página e tente de novo.', null, $wantsJson, 422);
}

// ---------------------------------------------------------------------------
// Lead válido
// ---------------------------------------------------------------------------
$clean = static fn($v) => trim(strip_tags((string)$v));

$lead = [
    'lp'         => $lp,
    'nome'       => $clean($_POST['nome'] ?? ''),
    'email'      => mb_strtolower($clean($_POST['email'] ?? '')),
    'telefone'   => preg_replace('/\D/', '', (string)($_POST['telefone'] ?? '')),
    'data'       => date('c'),
    'ip'         => Antispam::clientIp(),
    'user_agent' => substr((string)($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 255),
    'pagina'     => (string)($_SERVER['HTTP_REFERER'] ?? ''),
];

foreach ($_POST as $key => $value) {
    if (!is_string($value) || $key[0] === '_' || isset($lead[$key]) || $key === Antispam::HONEYPOT_FIELD || $key === 'cf-turnstile-response') {
        continue;
    }
    $lead[preg_replace('/[^a-z0-9_]/i', '', $key)] = mb_substr($clean($value), 0, 500);
}

$delivered = false;

if ($config['leads']['webhook_url'] !== '') {
    $ch = curl_init($config['leads']['webhook_url']);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => json_encode($lead, JSON_UNESCAPED_UNICODE),
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 10,
    ]);
    curl_exec($ch);
    $status    = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $delivered = $status >= 200 && $status < 300;
    if (!$delivered) {
        error_log("[lead] webhook falhou: HTTP $status");
    }
    curl_close($ch);
}

if ($config['leads']['csv_backup']) {
    $file  = __DIR__ . '/storage/leads.csv';
    $isNew = !is_file($file);
    if ($fh = @fopen($file, 'a')) {
        flock($fh, LOCK_EX);
        if ($isNew) {
            fputcsv($fh, array_keys($lead), ';', '"', '');
        }
        // Prefixa valores que o Excel interpretaria como fórmula.
        fputcsv($fh, array_map(fn($v) => preg_match('/^[=+\-@]/', (string)$v) ? "'$v" : $v, $lead), ';', '"', '');
        flock($fh, LOCK_UN);
        fclose($fh);
        $delivered = true;
    }
}

if (!$delivered) {
    respond(false, 'Não conseguimos registrar sua inscrição agora. Tente de novo em instantes.', null, $wantsJson, 500);
}

respond(true, 'Inscrição recebida!', $thanksUrl, $wantsJson);
