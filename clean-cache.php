<?php
/**
 * Limpeza de cache pós-deploy.
 *
 * Uso: https://workshop.furacaodasvendas.com.br/clean-cache.php?token=SEU_TOKEN
 *      &full=1  também apaga localStorage/sessionStorage/IndexedDB deste navegador
 *
 * O que faz:
 *  - Servidor: OPcache do PHP, cache do LiteSpeed (se houver) e Cloudflare (se configurado)
 *  - Navegador de quem acessa: header Clear-Site-Data + remoção de Service Workers e Cache Storage
 */

declare(strict_types=1);

$config = require __DIR__ . '/api/includes/config.php';
$cfg    = $config['clean_cache'];

header('Cache-Control: no-store, max-age=0');
header('X-Robots-Tag: noindex, nofollow');

if (!hash_equals($cfg['token'], (string)($_GET['token'] ?? ''))) {
    http_response_code(404);
    readfile(__DIR__ . '/404.html');
    exit;
}

$full    = isset($_GET['full']);
$results = [];

// Navegador
header('Clear-Site-Data: ' . ($full ? '"cache", "storage"' : '"cache"'));
$results[] = ['Cache do navegador (Clear-Site-Data)', true, $full ? 'cache + storage' : 'cache'];

// LiteSpeed Cache — o próprio servidor intercepta este header.
header('X-LiteSpeed-Purge: *');
$isLiteSpeed = stripos($_SERVER['SERVER_SOFTWARE'] ?? '', 'litespeed') !== false;
$results[] = ['LiteSpeed Cache', $isLiteSpeed, $isLiteSpeed ? 'purge enviado' : 'servidor não é LiteSpeed'];

// OPcache
if (function_exists('opcache_reset') && ini_get('opcache.enable')) {
    $results[] = ['OPcache (PHP)', opcache_reset(), 'reset'];
} else {
    $results[] = ['OPcache (PHP)', false, 'desativado neste servidor'];
}

// Cloudflare
if ($cfg['cloudflare_zone_id'] !== '' && $cfg['cloudflare_api_token'] !== '') {
    $ch = curl_init("https://api.cloudflare.com/client/v4/zones/{$cfg['cloudflare_zone_id']}/purge_cache");
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => json_encode(['purge_everything' => true]),
        CURLOPT_HTTPHEADER     => ['Authorization: Bearer ' . $cfg['cloudflare_api_token'], 'Content-Type: application/json'],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 15,
    ]);
    $response = json_decode((string)curl_exec($ch), true);
    curl_close($ch);
    $ok = !empty($response['success']);
    $results[] = ['Cloudflare', $ok, $ok ? 'purge_everything' : ($response['errors'][0]['message'] ?? 'falha na API')];
} else {
    $results[] = ['Cloudflare', false, 'não configurado'];
}

$time = date('d/m/Y H:i:s');
?>
<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>Limpar cache</title>
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; margin: 0; }
    body { min-height: 100dvh; display: grid; place-items: center; padding: 24px 16px; background: #1D1D1B; color: #F4F5F7; font: 15px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
    main { width: 100%; max-width: 520px; }
    h1 { font-size: 1.4rem; margin-bottom: 4px; }
    .time { color: #A9AFBC; margin-bottom: 20px; }
    ul { list-style: none; padding: 0; border: 1px solid #41413D; border-radius: 12px; overflow: hidden; }
    li { display: flex; justify-content: space-between; gap: 16px; padding: 12px 16px; border-top: 1px solid #41413D; }
    li:first-child { border-top: 0; }
    .detail { color: #A9AFBC; text-align: right; }
    .ok::before { content: "✓ "; color: #3DDC84; }
    .skip::before { content: "– "; color: #A9AFBC; }
    .actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 20px; }
    a { padding: 12px 20px; border-radius: 10px; background: #FF4D1A; color: #1D1D1B; font-weight: 700; text-decoration: none; }
    a.ghost { background: transparent; color: #F4F5F7; border: 1px solid #41413D; }
  </style>
</head>
<body>
  <main>
    <h1>Cache limpo</h1>
    <p class="time"><?= $time ?></p>
    <ul>
      <?php foreach ($results as [$label, $ok, $detail]): ?>
        <li><span class="<?= $ok ? 'ok' : 'skip' ?>"><?= htmlspecialchars($label) ?></span><span class="detail"><?= htmlspecialchars($detail) ?></span></li>
      <?php endforeach; ?>
      <li id="sw"><span class="skip">Service Workers / Cache Storage</span><span class="detail">verificando…</span></li>
    </ul>
    <div class="actions">
      <a href="/lp1/?nocache=<?= time() ?>">Abrir LP 1</a>
      <a href="/quero-comecar/?nocache=<?= time() ?>">Abrir LP 2 (quero-comecar)</a>
      <a class="ghost" href="?token=<?= urlencode($cfg['token']) ?>&amp;full=1">Limpeza completa</a>
    </div>
  </main>
  <script>
    (async () => {
      const row = document.getElementById('sw');
      let workers = 0, caches_ = 0;
      try {
        if ('serviceWorker' in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          workers = (await Promise.all(regs.map((r) => r.unregister()))).length;
        }
        if ('caches' in window) {
          const keys = await caches.keys();
          caches_ = (await Promise.all(keys.map((k) => caches.delete(k)))).length;
        }
        row.firstElementChild.className = 'ok';
        row.lastElementChild.textContent = `${workers} SW, ${caches_} caches removidos`;
      } catch {
        row.lastElementChild.textContent = 'não suportado';
      }
    })();
  </script>
</body>
</html>
