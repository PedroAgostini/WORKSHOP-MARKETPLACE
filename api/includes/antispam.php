<?php
/**
 * Antispam para formulários das LPs.
 *
 * Camadas:
 *  1. Origem da requisição (Origin/Referer do próprio domínio)
 *  2. Honeypot (campo invisível que humanos não preenchem)
 *  3. Token HMAC com timestamp (bloqueia envio rápido demais, replay antigo e POST direto sem JS)
 *  4. Rate limit por IP
 *  5. Conteúdo (links, palavras bloqueadas, alfabetos estranhos, e-mail/telefone válidos)
 *  6. Cloudflare Turnstile (opcional)
 */

final class Antispam
{
    public const HONEYPOT_FIELD = 'website';
    public const TOKEN_FIELD    = '_token';

    private array $cfg;
    private string $secret;
    private string $siteUrl;
    private string $storage;

    public function __construct(array $config)
    {
        $this->cfg     = $config['antispam'];
        $this->secret  = $config['secret'];
        $this->siteUrl = rtrim($config['site_url'], '/');
        $this->storage = dirname(__DIR__) . '/storage';
    }

    /** Gera token "timestamp.nonce.assinatura". */
    public function issueToken(): string
    {
        $payload = time() . '.' . bin2hex(random_bytes(8));
        return $payload . '.' . $this->sign($payload);
    }

    /**
     * Valida a requisição. Retorna null se ok, ou o código do motivo da rejeição.
     */
    public function check(array $post): ?string
    {
        if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
            return 'method';
        }
        if (!$this->checkOrigin()) {
            return 'origin';
        }
        if (trim((string)($post[self::HONEYPOT_FIELD] ?? '')) !== '') {
            return 'honeypot';
        }
        if (($reason = $this->checkToken((string)($post[self::TOKEN_FIELD] ?? ''))) !== null) {
            return $reason;
        }
        if (!$this->checkRateLimit()) {
            return 'rate_limit';
        }
        if (($reason = $this->checkContent($post)) !== null) {
            return $reason;
        }
        if ($this->cfg['turnstile_secret'] !== '' && !$this->checkTurnstile((string)($post['cf-turnstile-response'] ?? ''))) {
            return 'turnstile';
        }
        return null;
    }

    public static function clientIp(): string
    {
        // CF-Connecting-IP só é confiável atrás do Cloudflare.
        $ip = $_SERVER['HTTP_CF_CONNECTING_IP'] ?? $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
        return filter_var($ip, FILTER_VALIDATE_IP) ? $ip : '0.0.0.0';
    }

    private function sign(string $payload): string
    {
        return hash_hmac('sha256', $payload, $this->secret);
    }

    private function checkOrigin(): bool
    {
        $source = $_SERVER['HTTP_ORIGIN'] ?? $_SERVER['HTTP_REFERER'] ?? '';
        if ($source === '') {
            return false;
        }
        $host = parse_url($source, PHP_URL_HOST);
        return $host !== null && strcasecmp($host, (string)parse_url($this->siteUrl, PHP_URL_HOST)) === 0;
    }

    private function checkToken(string $token): ?string
    {
        $parts = explode('.', $token);
        if (count($parts) !== 3) {
            return 'token_missing';
        }
        [$ts, $nonce, $sig] = $parts;
        if (!hash_equals($this->sign("$ts.$nonce"), $sig)) {
            return 'token_invalid';
        }
        $age = time() - (int)$ts;
        if ($age < $this->cfg['min_seconds']) {
            return 'too_fast';
        }
        if ($age > $this->cfg['max_seconds']) {
            return 'token_expired';
        }
        return null;
    }

    private function checkRateLimit(): bool
    {
        $dir = $this->storage . '/ratelimit';
        if (!is_dir($dir) && !@mkdir($dir, 0755, true)) {
            return true; // sem storage não bloqueia o lead
        }

        $file   = $dir . '/' . hash('sha256', self::clientIp() . $this->secret) . '.json';
        $now    = time();
        $window = $this->cfg['rate_window'];

        $hits = is_file($file) ? (json_decode((string)file_get_contents($file), true) ?: []) : [];
        $hits = array_values(array_filter($hits, fn($t) => $t > $now - $window));

        if (count($hits) >= $this->cfg['rate_limit']) {
            return false;
        }
        $hits[] = $now;
        file_put_contents($file, json_encode($hits), LOCK_EX);

        // Limpeza ocasional de arquivos antigos.
        if (random_int(1, 50) === 1) {
            foreach (glob($dir . '/*.json') ?: [] as $f) {
                if (filemtime($f) < $now - $window) {
                    @unlink($f);
                }
            }
        }
        return true;
    }

    private function checkContent(array $post): ?string
    {
        $fields = array_filter(
            $post,
            fn($v, $k) => is_string($v) && $k[0] !== '_' && $k !== self::HONEYPOT_FIELD && $k !== 'cf-turnstile-response',
            ARRAY_FILTER_USE_BOTH
        );
        $text = mb_strtolower(implode(' ', $fields));

        if (preg_match_all('~(https?://|www\.|\[url|<a\s)~i', $text) > $this->cfg['max_links']) {
            return 'links';
        }
        foreach ($this->cfg['blocked_words'] as $word) {
            if (str_contains($text, $word)) {
                return 'blocked_word';
            }
        }
        // Cirílico, CJK, árabe etc. não são esperados em LP pt-BR.
        if (preg_match('/[\p{Cyrillic}\p{Han}\p{Hiragana}\p{Katakana}\p{Hangul}\p{Arabic}\p{Thai}]/u', $text)) {
            return 'charset';
        }

        if (isset($post['nome'])) {
            $nome = trim((string)$post['nome']);
            if (mb_strlen($nome) < 2 || mb_strlen($nome) > 80 || preg_match('/[0-9@<>{}]/', $nome)) {
                return 'nome';
            }
        }
        if (isset($post['email'])) {
            $email = trim((string)$post['email']);
            if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
                return 'email';
            }
            if ($this->cfg['check_mx'] && function_exists('checkdnsrr')) {
                $domain = substr(strrchr($email, '@'), 1);
                if (!checkdnsrr($domain, 'MX') && !checkdnsrr($domain, 'A')) {
                    return 'email_domain';
                }
            }
        }
        if (isset($post['telefone'])) {
            $digits = preg_replace('/\D/', '', (string)$post['telefone']);
            $digits = preg_replace('/^55(?=\d{10,11}$)/', '', $digits);
            // DDD válido (11–99) + 8 ou 9 dígitos; celular começa com 9.
            if (!preg_match('/^[1-9][1-9](9\d{8}|[2-5]\d{7})$/', $digits) || preg_match('/^(\d)\1+$/', substr($digits, 2))) {
                return 'telefone';
            }
        }
        return null;
    }

    private function checkTurnstile(string $response): bool
    {
        if ($response === '') {
            return false;
        }
        $ch = curl_init('https://challenges.cloudflare.com/turnstile/v0/siteverify');
        curl_setopt_array($ch, [
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => http_build_query([
                'secret'   => $this->cfg['turnstile_secret'],
                'response' => $response,
                'remoteip' => self::clientIp(),
            ]),
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 8,
        ]);
        $result = json_decode((string)curl_exec($ch), true);
        curl_close($ch);
        return !empty($result['success']);
    }
}
