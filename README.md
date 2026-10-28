# Workshop Furacão das Vendas

https://workshop.furacaodasvendas.com.br — duas landing pages em HTML estático + PHP para formulários.

## Estrutura

```
/
├── .htaccess              HTTPS, sem www, URLs limpas, segurança, compressão, cache
├── 404.html
├── robots.txt
├── sitemap.xml
├── llms.txt
├── humans.txt
├── site.webmanifest
├── favicon.ico / favicon.svg / apple-touch-icon.png / icon-*.png
├── clean-cache.php        limpeza de cache pós-deploy (protegido por token)
├── assets/
│   ├── js/antispam.js     token + envio via fetch dos formulários [data-antispam]
│   ├── fonts/             fontes self-hosted compartilhadas
│   └── img/               imagens compartilhadas (logo-branco.svg / logo-preto.svg)
├── api/
│   ├── token.php          emite token assinado do formulário
│   ├── lead.php           recebe o lead → antispam → webhook / CSV
│   ├── includes/          config.php + antispam.php (bloqueado ao público)
│   └── storage/           leads.csv + rate limit (bloqueado ao público)
├── lp1/
│   ├── index.html
│   ├── obrigado/index.html
│   ├── css/  js/  img/    (logos + img/og.jpg 1200x630 para compartilhamento)
└── lp2/                   mesma estrutura
```

Logos originais em `logos/` (LOGO-1 = branca, LOGO-2 = preta). O favicon é o monograma "WM" feito com os traços da própria logo, em branco sobre `#1D1D1B`.

A raiz `/` redireciona (302) para `/lp1/`. Altere no `.htaccess` se houver uma home.

## Antes de publicar

- [ ] Renomear `lp1`/`lp2` para os slugs finais (busca global por `lp1` e `lp2`: pastas, `.htaccess`, `sitemap.xml`, `llms.txt`, `config.php`, `clean-cache.php` e HTMLs)
- [ ] Preencher os `TODO` (title, description, OG) e criar `img/og.jpg` de cada LP
- [ ] Descrever cada LP no `llms.txt`
- [ ] Criar `api/includes/config.php` a partir do `config.example.php` (ele não vai para o Git). Gerar `secret` e `token` com `php -r "echo bin2hex(random_bytes(32));"` e preencher `webhook_url` do CRM/automação; Turnstile e Cloudflare, se usar
- [ ] Definir a cor de destaque das LPs (`--accent` no CSS; o laranja atual é provisório — a logo é monocromática)
- [ ] Ajustar `lastmod` do `sitemap.xml` e `Last update` do `humans.txt`
- [ ] Ativar a CSP do `.htaccess` depois de listar os scripts de terceiros (GTM, Pixel etc.)
- [ ] Enviar o sitemap no Google Search Console

## Deploy

1. Suba os arquivos alterados.
2. Atualize o `?v=AAAAMMDD` dos CSS/JS nos HTMLs que mudaram (CSS/JS ficam 30 dias em cache).
3. Acesse `/clean-cache.php?token=<token do config.php>`. Ele limpa o OPcache, o cache do LiteSpeed, o do Cloudflare (se configurado) e o cache do seu navegador.

## Antispam

Formulário com `data-antispam`, `action="/api/lead.php"` e os campos ocultos `_lp`, `_token` e `website` (honeypot). Veja `lp1/index.html`.

Camadas: origem do domínio, honeypot, token HMAC com tempo mínimo de 3 s e validade de 2 h, rate limit (5 envios / 10 min por IP), filtro de links/palavras/alfabetos, validação de nome, e-mail (com MX) e WhatsApp BR, além de Cloudflare Turnstile opcional.
Quando o bloqueio é por honeypot ou conteúdo, o servidor responde com falso sucesso para não revelar ao bot o que foi detectado. Os bloqueios ficam registrados no `error_log` do PHP.
