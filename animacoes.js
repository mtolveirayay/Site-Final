const menuButton = document.getElementById('menu-button');
const menuDropdown = document.getElementById('menu-dropdown');

if (menuButton && menuDropdown) {
  menuButton.addEventListener('click', () => {
    const isOpen = !menuDropdown.classList.contains('hidden');
    menuDropdown.classList.toggle('hidden');
    menuDropdown.classList.toggle('flex');
    menuButton.setAttribute('aria-expanded', String(!isOpen));
  });

  document.querySelectorAll('#menu-dropdown a').forEach((link) => {
    link.addEventListener('click', () => {
      menuDropdown.classList.add('hidden');
      menuDropdown.classList.remove('flex');
      menuButton.setAttribute('aria-expanded', 'false');
    });
  });

  document.addEventListener('click', (event) => {
    if (!event.target.closest('#dropdown-container')) {
      menuDropdown.classList.add('hidden');
      menuDropdown.classList.remove('flex');
      menuButton.setAttribute('aria-expanded', 'false');
    }
  });
}

const secoesAnimadas = document.querySelectorAll('[data-animar]');

secoesAnimadas.forEach((secao) => {
  secao.style.opacity = '0';
  secao.style.transform = 'translateY(18px)';
  secao.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
});

const observador = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
        observador.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.1 }
);

secoesAnimadas.forEach((secao) => observador.observe(secao));

const btnAlternarSites = document.getElementById('btn-alternar-sites');
const tituloSites = document.getElementById('titulo-sites');
const listaSites = document.getElementById('lista-sites');
const listaCanais = document.getElementById('lista-canais');

if (btnAlternarSites && tituloSites && listaSites && listaCanais) {
  let mostrandoCanais = false;

  btnAlternarSites.addEventListener('click', () => {
    mostrandoCanais = !mostrandoCanais;

    if (mostrandoCanais) {
      tituloSites.textContent = 'Canais recomendados';
      btnAlternarSites.textContent = 'Sites recomendados';
      listaSites.classList.add('hidden');
      listaSites.classList.remove('flex');
      listaCanais.classList.remove('hidden');
      listaCanais.classList.add('flex');
    } else {
      tituloSites.textContent = 'Sites recomendados';
      btnAlternarSites.textContent = 'Canais do YouTube recomendados';
      listaCanais.classList.add('hidden');
      listaCanais.classList.remove('flex');
      listaSites.classList.remove('hidden');
      listaSites.classList.add('flex');
    }
  });
}

const formVerificador = document.getElementById('form-verificador');
const inputUrl = document.getElementById('input-url-verificador');
const resultadoVerificador = document.getElementById('resultado-verificador');

if (formVerificador && inputUrl && resultadoVerificador) {
  formVerificador.addEventListener('submit', (e) => {
    e.preventDefault();
    const texto = inputUrl.value.trim();

    if (!texto) {
      resultadoVerificador.className = 'mx-auto mt-4 max-w-2xl rounded-xl border border-[#E6A06F] bg-[#242739]/80 p-4 text-center text-white block';
      resultadoVerificador.textContent = 'Digite o endereço de um site para verificar.';
      return;
    }

    const urlFormatada = /^https?:\/\//i.test(texto) ? texto : `https://${texto}`;

    try {
      const url = new URL(urlFormatada);
      const host = url.hostname.toLowerCase();
      const seguro = url.protocol === 'https:';
      const academico = ['.gov', '.edu', '.org', 'scielo', 'capes', 'scholar.google'].some((d) => host.includes(d));

      if (seguro && academico) {
        resultadoVerificador.className = 'mx-auto mt-4 max-w-2xl rounded-xl border border-[#9E9C71] bg-[#242739]/85 p-4 text-center text-white block';
        resultadoVerificador.textContent = `Site confiável (${host}): possui HTTPS ativo e domínio institucional/acadêmico.`;
      } else if (seguro) {
        resultadoVerificador.className = 'mx-auto mt-4 max-w-2xl rounded-xl border border-[#E6A06F] bg-[#242739]/85 p-4 text-center text-white block';
        resultadoVerificador.textContent = `Conexão segura HTTPS (${host}), mas verifique o autor e as referências antes de usar como fonte.`;
      } else {
        resultadoVerificador.className = 'mx-auto mt-4 max-w-2xl rounded-xl border border-[#E6A06F] bg-[#242739]/85 p-4 text-center text-white block';
        resultadoVerificador.textContent = `Atenção (${host}): este site não utiliza conexão segura HTTPS.`;
      }
    } catch {
      resultadoVerificador.className = 'mx-auto mt-4 max-w-2xl rounded-xl border border-[#E6A06F] bg-[#242739]/85 p-4 text-center text-white block';
      resultadoVerificador.textContent = 'Endereço inválido. Tente novamente (ex: https://www.scielo.br).';
    }
  });
}