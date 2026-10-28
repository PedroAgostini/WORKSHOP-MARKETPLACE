/**
 * Antispam dos formulários — use em <form data-antispam action="/api/lead.php" method="post">.
 * Busca o token assinado em /api/token.php na primeira interação e envia via fetch.
 * Sem JS o envio é recusado no servidor (token ausente).
 */
(() => {
  const TOKEN_URL = '/api/token.php';

  const fetchToken = async () => {
    const res = await fetch(TOKEN_URL, { cache: 'no-store', credentials: 'same-origin' });
    if (!res.ok) throw new Error('token');
    return (await res.json()).token;
  };

  // Repassa UTMs da URL para campos ocultos do formulário.
  const fillUtms = (form) => {
    const params = new URLSearchParams(location.search);
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid'].forEach((key) => {
      if (!params.has(key) || form.elements[key]) return;
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = key;
      input.value = params.get(key);
      form.appendChild(input);
    });
  };

  const setStatus = (form, message, isError) => {
    const status = form.querySelector('[data-form-status]');
    if (!status) return;
    status.textContent = message;
    status.dataset.state = isError ? 'error' : 'ok';
  };

  const init = (form) => {
    const tokenInput = form.elements._token;
    const submit = form.querySelector('[type="submit"]');
    let tokenPromise = null;

    const ensureToken = () => {
      if (!tokenPromise) {
        tokenPromise = fetchToken()
          .then((token) => (tokenInput.value = token))
          .catch((err) => {
            tokenPromise = null;
            throw err;
          });
      }
      return tokenPromise;
    };

    fillUtms(form);
    ['focusin', 'pointerdown', 'keydown'].forEach((evt) =>
      form.addEventListener(evt, () => ensureToken().catch(() => {}), { once: true })
    );

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!form.reportValidity() || form.dataset.sending) return;

      form.dataset.sending = '1';
      submit && (submit.disabled = true);
      setStatus(form, 'Enviando…', false);

      try {
        await ensureToken();
        const res = await fetch(form.action, {
          method: 'POST',
          body: new FormData(form),
          headers: { Accept: 'application/json' },
          credentials: 'same-origin',
        });
        const data = await res.json();

        if (data.ok && data.redirect) {
          window.location.href = data.redirect;
          return;
        }
        setStatus(form, data.message || 'Não foi possível enviar.', true);
      } catch {
        setStatus(form, 'Falha de conexão. Tente de novo.', true);
      }

      delete form.dataset.sending;
      submit && (submit.disabled = false);
    });
  };

  document.querySelectorAll('form[data-antispam]').forEach(init);
})();
