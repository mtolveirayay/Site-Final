const API_URL = window.location.port === '3000' ? '/api' : 'http://localhost:3000/api';

const formCadastro = document.getElementById('form-db-cadastro');
const mensagemBox = document.getElementById('mensagem');
const tabelaUsuarios = document.getElementById('tabela-usuarios');
const totalUsuarios = document.getElementById('total-usuarios');
const btnAtualizar = document.getElementById('btn-atualizar');

function mostrarMensagem(texto, tipo) {
  mensagemBox.textContent = texto;
  mensagemBox.className = 'p-3 rounded-lg mb-4 text-sm font-medium border block';

  if (tipo === 'erro') {
    mensagemBox.classList.add('bg-red-50', 'text-red-800', 'border-red-200');
  } else {
    mensagemBox.classList.add('bg-green-50', 'text-green-800', 'border-green-200');
  }
}

async function carregarUsuarios() {
  try {
    const resposta = await fetch(`${API_URL}/usuarios`);
    const usuarios = await resposta.json();

    if (!resposta.ok) {
      throw new Error(usuarios.erro || 'Erro ao carregar dados.');
    }

    totalUsuarios.textContent = usuarios.length;
    tabelaUsuarios.innerHTML = '';

    if (usuarios.length === 0) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 5;
      td.className = 'py-6 text-center text-gray-400';
      td.textContent = 'Nenhum usuário cadastrado no banco ainda.';
      tr.appendChild(td);
      tabelaUsuarios.appendChild(tr);
      return;
    }

    usuarios.forEach((usuario) => {
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-gray-50 transition-colors';

      const tdId = document.createElement('td');
      tdId.className = 'py-3 px-3 font-mono text-xs text-gray-500';
      tdId.textContent = `#${usuario.id}`;

      const tdNome = document.createElement('td');
      tdNome.className = 'py-3 px-3 font-medium text-gray-900';
      tdNome.textContent = usuario.nome;

      const tdEmail = document.createElement('td');
      tdEmail.className = 'py-3 px-3 text-gray-600';
      tdEmail.textContent = usuario.email;

      const tdData = document.createElement('td');
      tdData.className = 'py-3 px-3 text-xs text-gray-500';
      tdData.textContent = usuario.criado_em || '-';

      const tdAcao = document.createElement('td');
      tdAcao.className = 'py-3 px-3 text-right';

      const btnExcluir = document.createElement('button');
      btnExcluir.type = 'button';
      btnExcluir.textContent = 'Excluir';
      btnExcluir.className = 'px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold rounded border border-red-200 transition-colors cursor-pointer';
      btnExcluir.addEventListener('click', () => excluirUsuario(usuario.id, usuario.nome));

      tdAcao.appendChild(btnExcluir);
      tr.append(tdId, tdNome, tdEmail, tdData, tdAcao);
      tabelaUsuarios.appendChild(tr);
    });
  } catch (err) {
    tabelaUsuarios.innerHTML = '';
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 5;
    td.className = 'py-6 text-center text-red-600';
    td.textContent = 'Não foi possível carregar os dados do servidor.';
    tr.appendChild(td);
    tabelaUsuarios.appendChild(tr);
  }
}

async function excluirUsuario(id, nome) {
  if (!confirm(`Deseja realmente remover "${nome}" do banco de dados?`)) {
    return;
  }

  try {
    const resposta = await fetch(`${API_URL}/usuarios/${id}`, {
      method: 'DELETE'
    });

    const dados = await resposta.json();

    if (!resposta.ok) {
      mostrarMensagem(dados.erro || 'Erro ao excluir.', 'erro');
      return;
    }

    mostrarMensagem(dados.mensagem, 'sucesso');
    carregarUsuarios();
  } catch (err) {
    mostrarMensagem('Erro de conexão ao tentar excluir.', 'erro');
  }
}

formCadastro.addEventListener('submit', async (e) => {
  e.preventDefault();

  const payload = {
    nome: document.getElementById('nome').value,
    email: document.getElementById('email').value,
    senha: document.getElementById('senha').value
  };

  try {
    const resposta = await fetch(`${API_URL}/registrar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const dados = await resposta.json();

    if (!resposta.ok) {
      mostrarMensagem(dados.erro || 'Erro ao cadastrar.', 'erro');
      return;
    }

    formCadastro.reset();
    mostrarMensagem('Usuário salvo no banco de dados!', 'sucesso');
    carregarUsuarios();
  } catch (err) {
    mostrarMensagem('Não foi possível conectar ao servidor.', 'erro');
  }
});

btnAtualizar.addEventListener('click', carregarUsuarios);

// Carrega a tabela assim que a página abre
carregarUsuarios();


// DB CADASTRO.JS