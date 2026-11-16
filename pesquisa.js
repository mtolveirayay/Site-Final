
        const formPesquisa = document.getElementById('form-pesquisa');
        const campoPesquisa = document.getElementById('campo-pesquisa');

   
        function normalizarTexto(texto) {
            return texto
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .trim();
        }

        formPesquisa.addEventListener('submit', function (e) {
            e.preventDefault();

            const termo = normalizarTexto(campoPesquisa.value);
            if (!termo) return;

            // 1. Tenta encontrar exatamente pelo ID digitado (ex: "sobre", "servicos", "contato", "inicio")
            let destino = document.getElementById(termo);

            // 2. Se não achar exato, procura por IDs de seções que contenham ou estejam contidos no termo (ex: "sobre nos" -> #sobre)
            if (!destino) {
                const secoes = document.querySelectorAll('section[id]');
                for (const secao of secoes) {
                    const idNormalizado = normalizarTexto(secao.id);
                    if (termo.includes(idNormalizado) || idNormalizado.includes(termo)) {
                        destino = secao;
                        break;
                    }
                }
            }

            if (destino) {
                destino.scrollIntoView({ behavior: 'smooth', block: 'start' });
                campoPesquisa.value = '';
            } else {
             
                formPesquisa.classList.add('ring-2', 'ring-red-500');
                setTimeout(() => formPesquisa.classList.remove('ring-2', 'ring-red-500'), 1000);
            }
        });
    