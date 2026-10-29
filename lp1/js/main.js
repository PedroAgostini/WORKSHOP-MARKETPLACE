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

  const fill = (input) => {
    const p = ((input.value - input.min) / (input.max - input.min)) * 100;
    input.style.setProperty('--p', `${p}%`);
  };

  const calc = () => {
    const base = num('visitas') * (num('conversao') / 100) * num('ticket');
    const t = num('t') / 100;
    const c = num('c') / 100;
    const k = num('k') / 100;

    // Cada alavanca soma sobre o resultado da anterior: tráfego → conversão → ticket
    const afterT = base * (1 + t);
    const afterC = afterT * (1 + c);
    const total = afterC * (1 + k);
    const gains = { t: afterT - base, c: afterC - afterT, k: total - afterC };
    const max = Math.max(gains.t, gains.c, gains.k, 1);

    tween('atual', base);
    tween('novo', total);
    tween('ano', (total - base) * 12, true);
    out('pct').textContent = `+${base ? Math.round((total / base - 1) * 100) : 0}%`;
    ['t', 'c', 'k'].forEach((key) => {
      tween(key, gains[key], true);
      sim.querySelector(`[data-out="${key}"]`).textContent = `+${num(key)}%`;
      sim.querySelector(`[data-bar="${key}"]`).style.width = `${(gains[key] / max) * 100}%`;
    });
    sim.querySelectorAll('input[type="range"]').forEach(fill);
  };

  sim.addEventListener('input', calc);
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
