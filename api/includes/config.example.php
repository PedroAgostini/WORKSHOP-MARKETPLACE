<?php
/**
 * Configuração central — Copie para config.php e preencha. O config.php não vai para o Git.
 */

date_default_timezone_set('America/Sao_Paulo');

return [
    'site_url' => 'https://workshop.furacaodasvendas.com.br',

    // Chave do HMAC dos tokens do formulário. Trocar invalida tokens em aberto.
    'secret' => 'GERAR_64_CARACTERES_HEX',

    // LPs válidas (slug => página de obrigado).
    'lps' => [
        'lp1' => '/lp1/obrigado/',
        'lp2' => '/quero-comecar/obrigado/',
    ],

    'antispam' => [
        'min_seconds'   => 3,     // envio mais rápido que isso = bot
        'max_seconds'   => 7200,  // token expira em 2h
        'rate_limit'    => 5,     // envios por IP...
        'rate_window'   => 600,   // ...a cada 10 min
        'max_links'     => 0,     // links permitidos nos campos de texto
        'check_mx'      => true,  // valida se o domínio do e-mail recebe e-mails
        'blocked_words' => ['viagra', 'casino', 'crypto', 'bitcoin', 'seo services', 'backlinks', 'porn', 'loan'],
        // Cloudflare Turnstile (opcional). Deixe vazio para desativar.
        'turnstile_secret' => '',
    ],

    'leads' => [
        // Webhook que recebe o lead em JSON (n8n, Make, Zapier, RD Station, CRM...).
        'webhook_url' => '',
        // Cópia de segurança em api/storage/leads.csv (pasta bloqueada ao público).
        'csv_backup'  => true,
    ],

    'clean_cache' => [
        // Acesse: /clean-cache.php?token=ESTE_TOKEN
        'token' => 'GERAR_32_CARACTERES_HEX',
        // Cloudflare (opcional) — purge de todo o cache da zona.
        'cloudflare_zone_id'   => '',
        'cloudflare_api_token' => '',
    ],
];
