const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const db = new sqlite3.Database('./banco.db', (err) => {
  if (err) {
    console.error('Erro ao abrir o banco de dados:', err.message);
  } else {
    console.log('Banco de dados SQLite conectado.');
  }
});

db.run(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    senha_hash TEXT NOT NULL,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

app.post('/api/registrar', async (req, res) => {
  const { nome, email, senha } = req.body;

  if (!nome || !email || !senha) {
    return res.status(400).json({ erro: 'Preencha todos os campos.' });
  }

  try {
    const senhaHash = await bcrypt.hash(senha, 10);
    const sql = `INSERT INTO usuarios (nome, email, senha_hash) VALUES (?, ?, ?)`;

    db.run(sql, [nome.trim(), email.toLowerCase().trim(), senhaHash], function (err) {
      if (err) {
        if (err.message.includes('UNIQUE')) {
          return res.status(400).json({ erro: 'Este e-mail já está cadastrado.' });
        }
        return res.status(500).json({ erro: 'Erro ao salvar no banco de dados.' });
      }
      res.status(201).json({
        mensagem: 'Conta criada com sucesso!',
        id: this.lastID
      });
    });
  } catch (error) {
    res.status(500).json({ erro: 'Erro interno no servidor.' });
  }
});

app.post('/api/login', (req, res) => {
  const { email, senha } = req.body;

  if (!email || !senha) {
    return res.status(400).json({ erro: 'Informe e-mail e senha.' });
  }

  const sql = `SELECT * FROM usuarios WHERE email = ?`;
  db.get(sql, [email.toLowerCase().trim()], async (err, usuario) => {
    if (err) {
      return res.status(500).json({ erro: 'Erro ao consultar o banco.' });
    }
    if (!usuario) {
      return res.status(401).json({ erro: 'E-mail ou senha inválidos.' });
    }

    const senhaCorreta = await bcrypt.compare(senha, usuario.senha_hash);
    if (!senhaCorreta) {
      return res.status(401).json({ erro: 'E-mail ou senha inválidos.' });
    }

    res.json({
      mensagem: 'Login realizado com sucesso!',
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email
      }
    });
  });
});

app.get('/api/usuarios', (req, res) => {
  const sql = `SELECT id, nome, email, criado_em FROM usuarios ORDER BY id DESC`;

  db.all(sql, [], (err, linhas) => {
    if (err) {
      return res.status(500).json({ erro: 'Erro ao buscar usuários no banco.' });
    }
    res.json(linhas);
  });
});

app.delete('/api/usuarios/:id', (req, res) => {
  const { id } = req.params;
  const sql = `DELETE FROM usuarios WHERE id = ?`;

  db.run(sql, [id], function (err) {
    if (err) {
      return res.status(500).json({ erro: 'Erro ao excluir usuário.' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ erro: 'Usuário não encontrado.' });
    }
    res.json({ mensagem: 'Usuário removido do banco com sucesso.' });
  });
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});

// DB.JS