const API_URL = window.location.port === '3001' ? '/api' : 'http://localhost:3001/api';

const telaAuth = document.getElementById('tela-auth');
const telaPainel = document.getElementById('tela-painel');
const mensagemBox = document.getElementById('mensagem');
const formLogin = document.getElementById('form-login');
const btnSair = document.getElementById('btn-sair');
const boasVindas = document.getElementById('boas-vindas');
const infoEmail = document.getElementById('info-email');

function mostrarMensagem(texto) {
  mensagemBox.textContent = texto;
  mensagemBox.className = 'p-3 rounded-lg mb-4 text-sm font-medium border block bg-red-50 text-red-800 border-red-200';
}

function exibirPainel(usuario) {
  telaAuth.classList.add('hidden');
  telaPainel.classList.remove('hidden');
  boasVindas.textContent = `Olá, ${usuario.nome}!`;
  infoEmail.textContent = `E-mail conectado: ${usuario.email} (ID #${usuario.id})`;
}

btnSair.addEventListener('click', () => {
  localStorage.removeItem('usuarioLogado');
  telaPainel.classList.add('hidden');
  telaAuth.classList.remove('hidden');
  formLogin.reset();
  mensagemBox.className = 'hidden';
});

formLogin.addEventListener('submit', async (e) => {
  e.preventDefault();

  const payload = {
    email: document.getElementById('email').value,
    senha: document.getElementById('senha').value
  };

  try {
    const resposta = await fetch(`${API_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const dados = await resposta.json();

    if (!resposta.ok) {
      mostrarMensagem(dados.erro || 'E-mail ou senha inválidos.');
      return;
    }

    localStorage.setItem('usuarioLogado', JSON.stringify(dados.usuario));
    exibirPainel(dados.usuario);
  } catch (err) {
    mostrarMensagem('Não foi possível conectar ao servidor.');
  }
});

const usuarioSalvo = localStorage.getItem('usuarioLogado');
if (usuarioSalvo) {
  exibirPainel(JSON.parse(usuarioSalvo));
}

// DB.JS