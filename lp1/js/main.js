// Máscara de telefone BR: (11) 91234-5678 / (11) 1234-5678
document.querySelectorAll('input[type="tel"]').forEach((input) => {
  input.addEventListener('input', () => {
    const d = input.value.replace(/\D/g, '').slice(0, 11);
    input.value =
      d.length > 10 ? d.replace(/^(\d{2})(\d{5})(\d{0,4}).*/, '($1) $2-$3')
      : d.length > 6 ? d.replace(/^(\d{2})(\d{4})(\d{0,4}).*/, '($1) $2-$3')
      : d.length > 2 ? d.replace(/^(\d{2})(\d{0,5})/, '($1) $2')
      : d.replace(/^(\d*)/, '($1');
  });
});

// Dias até o evento (24/11, horário de Brasília)
const countdown = document.querySelector('[data-countdown]');
if (countdown) {
  const days = Math.ceil((new Date('2026-11-24T00:00:00-03:00') - Date.now()) / 864e5);
  if (days > 1) countdown.textContent = `faltam ${days} dias`;
  else if (days === 1) countdown.textContent = 'é amanhã!';
  else if (days === 0) countdown.textContent = 'é hoje!';
  countdown.hidden = days < 0;
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

// CTA fixo no celular: aparece depois do hero e some quando o formulário está na tela
const mcta = document.querySelector('[data-mcta]');
if (mcta) {
  const hero = document.querySelector('.hero');
  const form = document.querySelector('#inscricao');
  let pastHero = false;
  let onForm = false;
  const update = () => mcta.classList.toggle('is-on', pastHero && !onForm);
  new IntersectionObserver(([e]) => { pastHero = !e.isIntersecting; update(); }).observe(hero);
  new IntersectionObserver(([e]) => { onForm = e.isIntersecting; update(); }).observe(form);
}

// Leva os UTMs do anúncio para o checkout da Eduzz
const utms = [...new URLSearchParams(location.search)].filter(([k]) => k.startsWith('utm_'));
if (utms.length) {
  document.querySelectorAll('a[href*="chk.eduzz.com"]').forEach((a) => {
    const url = new URL(a.href);
    utms.forEach(([k, v]) => url.searchParams.set(k, v));
    a.href = url;
  });
}

// Vídeo: só baixa o arquivo no clique
document.querySelectorAll('[data-video]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const video = document.createElement('video');
    video.src = btn.dataset.video;
    video.poster = btn.querySelector('img')?.src || '';
    video.controls = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.setAttribute('aria-label', btn.getAttribute('aria-label'));
    btn.replaceWith(video);
    video.play().catch(() => {});
  }, { once: true });
});

// Simulador de faturamento
const sim = document.querySelector('[data-sim]');
if (sim) {
  const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  const num = (name) => Math.max(0, parseFloat(sim.querySelector(`[name="${name}"]`).value.replace(',', '.')) || 0);
  const out = (key) => sim.querySelector(`[data-res="${key}"]`);
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

  // Melhorias fixas: +15% de visitas, +15% de vendas sobre as visitas, +10% por compra
  const FACTOR = 1.15 * 1.15 * 1.10;
  const field = sim.querySelector('[name="fat"]');
  const chips = sim.querySelectorAll('[data-fat]');

  const calc = () => {
    const base = num('fat');
    const total = base * FACTOR;
    tween('atual', base);
    tween('novo', total);
    tween('ano', (total - base) * 12, true);
    out('pct').textContent = `+${Math.round((FACTOR - 1) * 100)}%`;
    chips.forEach((c) => c.classList.toggle('is-on', Number(c.dataset.fat) === base));
  };

  chips.forEach((chip) => chip.addEventListener('click', () => {
    field.value = chip.dataset.fat;
    calc();
  }));
  field.addEventListener('input', calc);
  calc();
}

// Contagem dos números (+36%, 438 milhões, +235 bi).
// O +36% acompanha a barra: mesmo atraso (250ms), duração e curva do CSS.
const counters = document.querySelectorAll("[data-count]");
if (counters.length && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  const easeOut = (t) => 1 - Math.pow(1 - t, 4);
  const fmt = new Intl.NumberFormat("pt-BR");
  counters.forEach((el) => {
    const target = Number(el.dataset.count);
    const { prefix = "", suffix = "" } = el.dataset;
    const inBar = !!el.closest(".market__chart");
    const render = (n) => { el.textContent = prefix + fmt.format(Math.round(n)) + suffix; };
    render(0);
    const run = () => {
      const start = performance.now() + (inBar ? 250 : 0);
      const duration = inBar ? 1400 : 1600;
      const tick = (now) => {
        const t = Math.min(Math.max((now - start) / duration, 0), 1);
        render(target * easeOut(t));
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };
    new IntersectionObserver((entries, obs) => {
      if (!entries[0].isIntersecting) return;
      run();
      obs.disconnect();
    }, { rootMargin: "0px 0px -10% 0px" }).observe(el.closest(".market__chart, .figures div") || el);
  });
}

// Rodapé: entrada em sequência quando aparece
const footer = document.querySelector('.footer');
if (footer) {
  new IntersectionObserver(([entry], obs) => {
    if (!entry.isIntersecting) return;
    footer.classList.add('is-in');
    obs.disconnect();
  }, { rootMargin: '0px 0px -100px 0px' }).observe(footer);
}
