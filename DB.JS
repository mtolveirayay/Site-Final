const API_URL = window.location.port === '3001' ? '/api' : 'http://localhost:3001/api';

const mensagemBox = document.getElementById('mensagem');
const formLogin = document.getElementById('form-login');

function mostrarMensagem(texto, tipo = 'erro') {
  mensagemBox.textContent = texto;
  if (tipo === 'sucesso') {
    mensagemBox.className = 'p-3 rounded-lg mb-4 text-sm font-medium border block bg-emerald-50 text-emerald-800 border-emerald-200';
  } else {
    mensagemBox.className = 'p-3 rounded-lg mb-4 text-sm font-medium border block bg-red-50 text-red-800 border-red-200';
  }
}

// Redireciona o usuário para onde ele tentava ir ou para a página principal
function redirecionarAposLogin() {
  const params = new URLSearchParams(window.location.search);
  const redirect = params.get('redirect');

  if (redirect === 'ia') {
    window.location.href = 'APIGROQ/public/index.html';
  } else if (redirect === 'verificador') {
    window.location.href = 'index.html#verificador';
  } else {
    window.location.href = 'index.html';
  }
}

// Se o usuário já estiver logado, redireciona diretamente
const usuarioSalvo = localStorage.getItem('usuarioLogado');
if (usuarioSalvo) {
  redirecionarAposLogin();
}

formLogin.addEventListener('submit', async (e) => {
  e.preventDefault();

  const payload = {
    email: document.getElementById('email').value.trim(),
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

    // Salva o usuário no localStorage para persistir login em todo o site
    localStorage.setItem('usuarioLogado', JSON.stringify(dados.usuario));
    mostrarMensagem('Login realizado com sucesso! Redirecionando...', 'sucesso');

    setTimeout(() => {
      redirecionarAposLogin();
    }, 500);
  } catch (err) {
    mostrarMensagem('Não foi possível conectar ao servidor. Verifique se o DBS.js está rodando na porta 3001.');
  }
});
