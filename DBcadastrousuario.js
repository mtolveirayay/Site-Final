const API_URL = window.location.port === '3001' ? '/api' : 'http://localhost:3001/api';

const formCadastro = document.getElementById('form-cadastro');
const mensagemBox = document.getElementById('mensagem');

function mostrarMensagem(texto, tipo = 'erro') {
  mensagemBox.textContent = texto;
  if (tipo === 'sucesso') {
    mensagemBox.className = 'p-3 rounded-lg mb-4 text-sm font-medium border block bg-emerald-50 text-emerald-800 border-emerald-200';
  } else {
    mensagemBox.className = 'p-3 rounded-lg mb-4 text-sm font-medium border block bg-red-50 text-red-800 border-red-200';
  }
}

formCadastro.addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = document.getElementById('email').value.trim();
  const senha = document.getElementById('senha').value;

  // Como o DB.sql exige a coluna "nome NOT NULL" e o DBS.js valida esse campo,
  // extraímos automaticamente o prefixo do e-mail para manter o formulário só com e-mail e senha.
  const nome = email.split('@')[0] || 'Usuário';

  try {
    const resposta = await fetch(`${API_URL}/registrar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, email, senha })
    });

    const dados = await resposta.json();

    if (!resposta.ok) {
      mostrarMensagem(dados.erro || 'Não foi possível concluir o cadastro.');
      return;
    }

    mostrarMensagem('Cadastro realizado com sucesso! Redirecionando...', 'sucesso');
    setTimeout(() => {
      window.location.href = 'DB.html';
    }, 800);
  } catch (err) {
    mostrarMensagem('Não foi possível conectar ao servidor.');
  }
});