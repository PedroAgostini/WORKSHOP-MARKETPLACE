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
  const set = (key, text) => { sim.querySelector(`[data-res="${key}"]`).textContent = text; };

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

    set('atual', brl.format(base));
    set('novo', brl.format(total));
    set('ano', `+${brl.format((total - base) * 12)}`);
    ['t', 'c', 'k'].forEach((key) => {
      set(key, `+${brl.format(gains[key])}`);
      sim.querySelector(`[data-out="${key}"]`).textContent = `+${num(key)}%`;
      sim.querySelector(`[data-bar="${key}"]`).style.width = `${(gains[key] / max) * 100}%`;
    });
  };

  sim.addEventListener('input', calc);
  calc();
}
