// Verificação de autenticação: apenas usuários logados têm acesso à IA
const usuarioLogadoRaw = localStorage.getItem('usuarioLogado');
if (!usuarioLogadoRaw) {
    alert('Acesso restrito: Por favor, faça login para acessar o assistente de IA.');
    window.location.href = '../../DB.html?redirect=ia';
}

// Configuração do usuário no cabeçalho do chat
try {
    const usuarioLogado = usuarioLogadoRaw ? JSON.parse(usuarioLogadoRaw) : null;
    const nomeUsuarioChat = document.getElementById('nome-usuario-chat');
    const usuarioBadge = document.getElementById('usuario-badge');
    const btnSairChat = document.getElementById('btn-sair-chat');

    if (usuarioLogado) {
        if (nomeUsuarioChat) nomeUsuarioChat.textContent = usuarioLogado.nome || usuarioLogado.email.split('@')[0];
        if (usuarioBadge) usuarioBadge.classList.remove('hidden');
    }

    if (btnSairChat) {
        btnSairChat.addEventListener('click', () => {
            localStorage.removeItem('usuarioLogado');
            sessionStorage.removeItem('conversaAtualId');
            window.location.href = '../../index.html';
        });
    }
} catch (e) {
    console.error('Erro ao ler usuário logado:', e);
}

// Estado da aplicação (com persistência de sessão para não perder a conversa ao recarregar)
const conversaSalva = sessionStorage.getItem('conversaAtualId');
let conversaAtualId = conversaSalva ? Number(conversaSalva) : null;

// Elementos da Interface
const chatContainer = document.getElementById('chat-container');
const chatForm = document.getElementById('chat-form');
const campoPergunta = document.getElementById('campo-pergunta');
const btnEnviar = document.getElementById('btn-enviar');
const listaConversas = document.getElementById('lista-conversas');
const contadorConversas = document.getElementById('contador-conversas');
const tituloConversaAtiva = document.getElementById('titulo-conversa-ativa');
const btnNovaConversa = document.getElementById('btn-nova-conversa');
const btnNovoChatTopo = document.getElementById('btn-novo-chat-topo');
const sidebar = document.getElementById('sidebar');
const btnToggleSidebar = document.getElementById('btn-toggle-sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay');

// Determina a URL base para as requisições à API
function getApiUrl(path) {
    if (window.location.origin && window.location.origin.includes('3000')) {
        return path;
    }
    return `http://localhost:3000${path}`;
}

// Alterna a visualização da barra lateral no mobile
function toggleSidebar(abrir = null) {
    const estaAberta = !sidebar.classList.contains('-translate-x-full');
    const novoEstado = abrir !== null ? abrir : !estaAberta;

    if (novoEstado) {
        sidebar.classList.remove('-translate-x-full');
        sidebarOverlay.classList.remove('hidden');
    } else {
        sidebar.classList.add('-translate-x-full');
        sidebarOverlay.classList.add('hidden');
    }
}

// Processa texto em Markdown mantendo e renderizando expressões matemáticas em LaTeX com KaTeX
function processarMarkdownComKaTeX(texto) {
    if (!texto) return '';

    // Extrai fórmulas matemáticas antes do parser Markdown para que caracteres como _, *, \, [ e ] não sejam desconfigurados
    const mathMap = [];
    let mathIndex = 0;

    const salvarMath = (latex, display) => {
        const placeholder = `%%%KATEX_MATH_TOKEN_${mathIndex}%%%`;
        mathMap.push({ placeholder, latex: latex.trim(), display });
        mathIndex++;
        return display ? `\n\n${placeholder}\n\n` : placeholder;
    };

    let textoNormalizado = texto;

    // 1. Detecta blocos com delimitador $$ ... $$
    textoNormalizado = textoNormalizado.replace(/\$\$([\s\S]+?)\$\$/g, (_, math) => salvarMath(math, true));

    // 2. Detecta blocos com delimitador \[ ... \]
    textoNormalizado = textoNormalizado.replace(/\\\[([\s\S]+?)\\\]/g, (_, math) => salvarMath(math, true));

    // 3. Detecta ambientes LaTeX em bloco (\begin{equation}...\end{equation}, matrix, align, etc.)
    textoNormalizado = textoNormalizado.replace(/(\\begin\{(?:equation|align|gather|matrix|bmatrix|pmatrix|cases|aligned)\*?\}[\s\S]+?\\end\{(?:equation|align|gather|matrix|bmatrix|pmatrix|cases|aligned)\*?\})/g, (_, math) => salvarMath(math, true));

    // 4. Detecta blocos gerados com [ \n math \n ] (muito comum em respostas de LLMs contendo \boxed ou fórmulas em linhas isoladas)
    textoNormalizado = textoNormalizado.replace(/(?:^|\n)\s*\[\s*\n([\s\S]*?\\(?:boxed|frac|sqrt|sum|int|prod|alpha|beta|theta|Delta|neq|pm|times|div|approx)[\s\S]*?)\n\s*\](?:\s*|\n|$)/g, (_, math) => salvarMath(math, true));

    // 5. Detecta inline com \( ... \)
    textoNormalizado = textoNormalizado.replace(/\\\(([\s\S]+?)\\\)/g, (_, math) => salvarMath(math, false));

    // 6. Detecta inline com $ ... $ (sem quebra de linha interna)
    textoNormalizado = textoNormalizado.replace(/(?<!\\)\$(?!\s)([^\$\n]+?)(?<!\s)\$(?!\d)/g, (_, math) => salvarMath(math, false));

    // 7. Detecta expressões matemáticas entre parênteses contendo comandos LaTeX com barra (ex: (a\neq 0) ou (\alpha > 0))
    textoNormalizado = textoNormalizado.replace(/\(([^\(\)\n]*?\\[a-zA-Z]+[^\(\)\n]*?)\)/g, (_, math) => salvarMath(math, false));

    // Converte Markdown para HTML
    let html = textoNormalizado;
    if (typeof marked !== 'undefined') {
        try {
            marked.setOptions({
                gfm: true,
                breaks: true
            });
            html = marked.parse(textoNormalizado);
        } catch (err) {
            console.warn('Erro ao processar Markdown:', err);
        }
    }

    // Sanitiza HTML
    if (typeof DOMPurify !== 'undefined') {
        html = DOMPurify.sanitize(html);
    }

    // Reinsere e renderiza cada fórmula matemática com KaTeX
    mathMap.forEach(({ placeholder, latex, display }) => {
        let mathHtml = '';
        if (typeof katex !== 'undefined') {
            try {
                mathHtml = katex.renderToString(latex, {
                    displayMode: display,
                    throwOnError: false
                });
            } catch (err) {
                console.warn('Erro ao renderizar KaTeX:', err);
                mathHtml = display ? `<div class="katex-display-wrapper"><code>${latex}</code></div>` : `<code>${latex}</code>`;
            }
        } else {
            mathHtml = display ? `<pre class="katex-display-wrapper">${latex}</pre>` : `<code>${latex}</code>`;
        }

        // Se o placeholder estiver envolvido em uma tag de parágrafo criada pelo marked no modo display, substitui o parágrafo
        if (display) {
            const pRegex = new RegExp(`<p>\\s*${placeholder}\\s*<\\/p>`, 'g');
            if (pRegex.test(html)) {
                html = html.replace(pRegex, `<div class="katex-display-wrapper">${mathHtml}</div>`);
            }
        }

        html = html.replaceAll(placeholder, mathHtml);
    });

    return html;
}

// Adiciona uma mensagem visualmente no container do chat
function renderizarMensagem(texto, remetente = 'usuario') {
    const wrapper = document.createElement('div');
    wrapper.className = remetente === 'usuario' 
        ? 'flex justify-end' 
        : 'flex items-start gap-3';

    if (remetente === 'usuario') {
        wrapper.innerHTML = `
            <div class="max-w-[85%] rounded-2xl rounded-tr-sm border border-[#E6A06F]/50 bg-[#E6A06F] px-5 py-3 shadow-md text-[#242739]">
                <p class="whitespace-pre-line text-sm font-medium leading-relaxed sm:text-base"></p>
            </div>
        `;
        wrapper.querySelector('p').textContent = texto;
    } else {
        wrapper.innerHTML = `
            <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#E6A06F] text-sm font-bold text-[#242739]">
                IA
            </div>
            <div class="max-w-[85%] overflow-x-auto rounded-2xl rounded-tl-sm border border-[#9E9C71]/40 bg-[#242739]/80 px-5 py-3.5 shadow-md">
                <div class="markdown-content"></div>
            </div>
        `;
        const contentDiv = wrapper.querySelector('.markdown-content');

        try {
            contentDiv.innerHTML = processarMarkdownComKaTeX(texto);
        } catch (err) {
            console.error('Erro na renderização:', err);
            contentDiv.textContent = texto;
        }
    }

    chatContainer.appendChild(wrapper);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    return wrapper;
}

// Cria animação de "digitando..."
function adicionarIndicadorCarregamento() {
    const loadingId = 'loading-' + Date.now();
    const wrapper = document.createElement('div');
    wrapper.id = loadingId;
    wrapper.className = 'flex items-start gap-3';
    wrapper.innerHTML = `
        <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#E6A06F] text-sm font-bold text-[#242739]">
            IA
        </div>
        <div class="rounded-2xl rounded-tl-sm border border-[#9E9C71]/40 bg-[#242739]/80 px-5 py-3.5 shadow-md">
            <div class="flex items-center gap-1.5 py-1">
                <span class="h-2 w-2 rounded-full bg-[#E6A06F] animate-bounce"></span>
                <span class="h-2 w-2 rounded-full bg-[#E6A06F] animate-bounce [animation-delay:0.2s]"></span>
                <span class="h-2 w-2 rounded-full bg-[#E6A06F] animate-bounce [animation-delay:0.4s]"></span>
            </div>
        </div>
    `;
    chatContainer.appendChild(wrapper);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    return loadingId;
}

// Renderiza a tela limpa de nova conversa
function telaInicialNovaConversa() {
    conversaAtualId = null;
    sessionStorage.removeItem('conversaAtualId');
    tituloConversaAtiva.textContent = 'Nova Conversa';
    chatContainer.innerHTML = `
        <div class="flex items-start gap-3">
            <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#E6A06F] text-sm font-bold text-[#242739]">
                IA
            </div>
            <div class="max-w-[85%] rounded-2xl rounded-tl-sm border border-[#9E9C71]/40 bg-[#242739]/80 px-5 py-3.5 shadow-md">
                <p class="whitespace-pre-line text-sm leading-relaxed text-white/95 sm:text-base">
                    Olá! Eu sou o assistente do <strong>AI Control</strong>. Suas conversas ficam salvas no histórico lateral com títulos gerados automaticamente pela IA.<br><br>Como posso te orientar nos seus estudos hoje?
                </p>
            </div>
        </div>
    `;
    carregarListaConversas();
    campoPergunta.focus();
}

// Carrega todas as conversas do banco de dados SQLite
async function carregarListaConversas() {
    try {
        const res = await fetch(getApiUrl('/api/conversas'));
        if (!res.ok) throw new Error(`Falha ${res.status}`);

        const conversas = await res.json();
        contadorConversas.textContent = conversas.length;
        listaConversas.innerHTML = '';

        if (!Array.isArray(conversas) || conversas.length === 0) {
            listaConversas.innerHTML = `
                <div class="p-4 text-center text-xs text-[#9E9C71]/80">
                    Nenhuma conversa salva ainda.<br>Envie uma pergunta para começar!
                </div>
            `;
            return;
        }

        conversas.forEach((conversa) => {
            const item = document.createElement('div');
            const estaAtiva = conversaAtualId === conversa.id;

            item.className = `group flex items-center justify-between rounded-xl p-3 text-sm transition cursor-pointer ${
                estaAtiva 
                    ? 'bg-[#E6A06F] text-[#242739] font-bold shadow-md' 
                    : 'text-white/85 hover:bg-[#33454E] hover:text-white'
            }`;

            item.innerHTML = `
                <div class="flex items-center gap-2.5 truncate mr-2 flex-1">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 shrink-0 ${estaAtiva ? 'text-[#242739]' : 'text-[#E6A06F]'}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <span class="truncate font-medium">${conversa.titulo}</span>
                </div>
                <button
                    type="button"
                    title="Excluir conversa"
                    class="btn-excluir shrink-0 p-1.5 rounded-lg opacity-60 hover:opacity-100 transition ${estaAtiva ? 'hover:bg-black/15 text-[#242739]' : 'hover:bg-red-500/20 text-red-400'}"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                </button>
            `;

            // Clique para carregar e alternar para a conversa
            item.addEventListener('click', (e) => {
                if (e.target.closest('.btn-excluir')) return;
                selecionarConversa(conversa.id);
                if (window.innerWidth < 768) toggleSidebar(false);
            });

            // Botão para excluir conversa do SQLite
            const btnExcluir = item.querySelector('.btn-excluir');
            btnExcluir.addEventListener('click', (e) => {
                e.stopPropagation();
                excluirConversa(conversa.id);
            });

            listaConversas.appendChild(item);
        });

    } catch (err) {
        console.error('Erro ao carregar lista de conversas:', err);
        listaConversas.innerHTML = `
            <div class="p-3 text-center text-xs text-red-400/90 bg-red-950/30 rounded-lg m-2">
                Não foi possível conectar ao servidor.<br>Inicie o <code>node server.js</code> na porta 3000.
            </div>
        `;
    }
}

// Seleciona uma conversa e carrega suas mensagens do banco SQLite
async function selecionarConversa(id) {
    conversaAtualId = Number(id);
    sessionStorage.setItem('conversaAtualId', conversaAtualId);

    try {
        const res = await fetch(getApiUrl(`/api/conversas/${id}`));
        if (!res.ok) throw new Error('Falha ao carregar a conversa');

        const conversa = await res.json();
        tituloConversaAtiva.textContent = conversa.titulo || 'Conversa';
        chatContainer.innerHTML = '';

        if (!conversa.mensagens || conversa.mensagens.length === 0) {
            chatContainer.innerHTML = `
                <div class="text-center py-8 text-sm text-white/50">
                    Nenhuma mensagem registrada nesta conversa.
                </div>
            `;
        } else {
            conversa.mensagens.forEach((msg) => {
                const remetente = msg.papel === 'assistant' ? 'ia' : 'usuario';
                renderizarMensagem(msg.conteudo, remetente);
            });
        }

        carregarListaConversas();
        campoPergunta.focus();

    } catch (err) {
        console.error('Erro ao carregar conversa:', err);
        renderizarMensagem('Não foi possível carregar o histórico desta conversa.', 'ia');
    }
}

// Exclui uma conversa do banco
async function excluirConversa(id) {
    if (!confirm('Deseja realmente excluir esta conversa do histórico?')) return;

    try {
        const res = await fetch(getApiUrl(`/api/conversas/${id}`), {
            method: 'DELETE'
        });

        if (!res.ok) throw new Error('Falha ao excluir conversa');

        if (conversaAtualId === id) {
            telaInicialNovaConversa();
        }

        await carregarListaConversas();

    } catch (err) {
        console.error('Erro ao excluir conversa:', err);
        alert('Erro ao excluir a conversa.');
    }
}

// Envia mensagem para a IA e persiste no SQLite
async function enviarMensagem(event) {
    if (event) event.preventDefault();

    const texto = campoPergunta.value.trim();
    if (!texto) return;

    // 1. Mostra a mensagem do usuário no chat
    renderizarMensagem(texto, 'usuario');
    campoPergunta.value = '';

    // 2. Trava o envio para evitar disparos simultâneos
    campoPergunta.disabled = true;
    btnEnviar.disabled = true;

    // 3. Adiciona indicador de "pensando / digitando"
    const loadingId = adicionarIndicadorCarregamento();

    try {
        const resposta = await fetch(getApiUrl('/chat'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                mensagem: texto,
                conversaId: conversaAtualId
            })
        });

        // Remove o indicador de carregamento
        const loadingElement = document.getElementById(loadingId);
        if (loadingElement) loadingElement.remove();

        if (!resposta.ok) {
            const erroJson = await resposta.json().catch(() => ({}));
            throw new Error(erroJson.erro || `Erro do servidor: ${resposta.status}`);
        }

        const dados = await resposta.json();

        // Se criou uma nova conversa, atualiza o ID ativo
        if (dados.conversaId) {
            conversaAtualId = Number(dados.conversaId);
            sessionStorage.setItem('conversaAtualId', conversaAtualId);
        }

        // Se a IA gerou um novo título no backend, atualiza o título ativo
        if (dados.titulo) {
            tituloConversaAtiva.textContent = dados.titulo;
        }

        // Exibe a resposta retornada pela IA
        renderizarMensagem(dados.resposta, 'ia');

        // Atualiza a sidebar com o novo título gerado automaticamente
        await carregarListaConversas();

    } catch (erro) {
        console.error('Erro na comunicação com o servidor:', erro);
        const loadingElement = document.getElementById(loadingId);
        if (loadingElement) loadingElement.remove();

        renderizarMensagem(`Erro: ${erro.message || 'Verifique se o servidor node server.js está rodando na porta 3000.'}`, 'ia');
    } finally {
        campoPergunta.disabled = false;
        btnEnviar.disabled = false;
        campoPergunta.focus();
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }
}

// Event Listeners
chatForm.addEventListener('submit', enviarMensagem);
btnNovaConversa.addEventListener('click', telaInicialNovaConversa);
btnNovoChatTopo.addEventListener('click', () => {
    telaInicialNovaConversa();
    if (window.innerWidth < 768) toggleSidebar(false);
});

btnToggleSidebar.addEventListener('click', () => toggleSidebar());
sidebarOverlay.addEventListener('click', () => toggleSidebar(false));

// Inicialização: carrega o histórico e restaura conversa ativa se houver
async function inicializarChat() {
    await carregarListaConversas();
    if (conversaAtualId) {
        selecionarConversa(conversaAtualId);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializarChat);
} else {
    inicializarChat();
}
