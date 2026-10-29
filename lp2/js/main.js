// Destino de todos os botões "Garanta sua vaga!" (checkout, WhatsApp, Sympla…).
// TODO: preencher com o link de inscrição.
const CTA_URL = '';
if (CTA_URL) {
  document.querySelectorAll('[data-cta]').forEach((a) => {
    a.href = CTA_URL;
    if (/^https?:/.test(CTA_URL)) {
      a.target = '_blank';
      a.rel = 'noopener';
    }
  });
}

// Dias até o evento (24/11, 8h às 16h, horário de Brasília)
const countdown = document.querySelector('[data-countdown]');
if (countdown) {
  const days = Math.ceil((new Date('2026-11-24T00:00:00-03:00') - Date.now()) / 864e5);
  const ended = Date.now() > new Date('2026-11-24T16:00:00-03:00');
  if (days > 1) countdown.textContent = `faltam ${days} dias`;
  else if (days === 1) countdown.textContent = 'é amanhã!';
  else if (days === 0) countdown.textContent = 'é hoje!';
  countdown.hidden = days < 0 || ended;
}

// Entrada das seções ao rolar
const revealer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add('is-in');
    revealer.unobserve(entry.target);
  });
}, { rootMargin: '0px 0px -10% 0px' });
document.querySelectorAll('.reveal').forEach((el) => revealer.observe(el));

// CTA fixo no celular: aparece depois do hero e some ao chegar no rodapé
const mcta = document.querySelector('[data-mcta]');
if (mcta) {
  const hero = document.querySelector('.hero');
  const footer = document.querySelector('.footer');
  let pastHero = false;
  let onFooter = false;
  const update = () => mcta.classList.toggle('is-on', pastHero && !onFooter);
  new IntersectionObserver(([e]) => { pastHero = !e.isIntersecting; update(); }).observe(hero);
  new IntersectionObserver(([e]) => { onFooter = e.isIntersecting; update(); }).observe(footer);
}

// Vídeo hospedado no site: troca a capa pelo player só no clique
document.querySelectorAll('[data-video]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const video = document.createElement('video');
    video.src = btn.dataset.video;
    video.poster = btn.querySelector('img')?.src || '';
    video.controls = true;
    video.autoplay = true;
    video.playsInline = true;
    video.setAttribute('aria-label', btn.getAttribute('aria-label'));
    btn.replaceWith(video);
    video.play().catch(() => {});
  }, { once: true });
});

// Vídeo: só carrega o YouTube no clique
document.querySelectorAll('[data-yt]').forEach((btn) => {
  const id = btn.dataset.yt.trim();
  if (!id) {
    btn.classList.add('is-empty');
    return;
  }
  btn.addEventListener('click', () => {
    const iframe = document.createElement('iframe');
    iframe.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0`;
    iframe.title = btn.getAttribute('aria-label');
    iframe.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    iframe.allowFullscreen = true;
    btn.replaceWith(iframe);
  }, { once: true });
});

// Simulador de faturamento (simplificado): só o faturamento mensal entra;
// as melhorias são fixas e se somam em cadeia (tráfego → conversão → ticket)
const sim = document.querySelector('[data-sim]');
if (sim) {
  const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  const input = sim.querySelector('[name="fat"]');
  const out = (key) => sim.querySelector(`[data-res="${key}"]`);
  const factor = [...sim.querySelectorAll('[data-gain]')]
    .reduce((acc, el) => acc * (1 + Number(el.dataset.gain) / 100), 1);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Valores em R$ animam do número atual até o novo
  const shown = {};
  const tween = (key, to, plus) => {
    const el = out(key);
    const from = shown[key] ?? to;
    shown[key] = to;
    const fmt = (n) => (plus ? '+' : '') + brl.format(n);
    if (reduced || from === to) { el.textContent = fmt(to); return; }
    const t0 = performance.now();
    const step = (now) => {
      const t = Math.min((now - t0) / 450, 1);
      const k = 1 - Math.pow(1 - t, 3);
      el.textContent = fmt(from + (to - from) * k);
      if (t < 1 && shown[key] === to) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  const calc = () => {
    const base = Math.max(0, parseFloat(input.value.replace(',', '.')) || 0);
    const total = base * factor;
    tween('atual', base);
    tween('novo', total);
    tween('ano', (total - base) * 12, true);
    out('pct').textContent = `+${Math.round((factor - 1) * 100)}%`;
  };

  input.addEventListener('input', calc);
  calc();
}
