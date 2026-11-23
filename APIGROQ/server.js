import express from "express";
import Groq from "groq-sdk";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Garante que o .env seja carregado da pasta APIGROQ mesmo se iniciado de outra pasta
dotenv.config({ path: path.join(__dirname, ".env") });

// Banco de dados SQLite persistente em disco (conversas.db)
const dbPath = path.join(__dirname, "conversas.db");
const db = new DatabaseSync(dbPath);

// Criação das tabelas para histórico persistente
db.exec(`
    CREATE TABLE IF NOT EXISTS conversas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        titulo TEXT NOT NULL,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS mensagens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversa_id INTEGER NOT NULL,
        papel TEXT NOT NULL,
        conteudo TEXT NOT NULL,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (conversa_id) REFERENCES conversas(id) ON DELETE CASCADE
    );
`);

console.log("Banco de dados SQLite conectado e persistente em:", dbPath);

const app = express();

app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        res.sendStatus(204);
        return;
    }

    next();
});

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use("/APIGROQ/public", express.static(path.join(__dirname, "public")));
app.use(express.static(path.join(__dirname, "..")));

let groqClient = null;
function getGroqClient() {
    if (!groqClient) {
        const key = process.env.GROQ_API_KEY;
        if (!key) {
            throw new Error("A variável GROQ_API_KEY não está configurada no seu arquivo .env.");
        }
        groqClient = new Groq({ apiKey: key });
    }
    return groqClient;
}

// 1. Listar todas as conversas salvas no banco
app.get("/api/conversas", (req, res) => {
    try {
        const conversas = db.prepare(`
            SELECT id, titulo, criado_em, atualizado_em 
            FROM conversas 
            ORDER BY atualizado_em DESC
        `).all();
        res.json(conversas);
    } catch (err) {
        console.error("Erro ao listar conversas:", err);
        res.status(500).json({ erro: "Erro ao buscar histórico de conversas." });
    }
});

// 2. Criar uma nova conversa vazia
app.post("/api/conversas", (req, res) => {
    try {
        const titulo = req.body?.titulo?.trim() || "Nova conversa";
        const stmt = db.prepare(`INSERT INTO conversas (titulo) VALUES (?)`);
        const resultado = stmt.run(titulo);
        const nova = db.prepare(`SELECT * FROM conversas WHERE id = ?`).get(resultado.lastInsertRowid);
        res.status(201).json(nova);
    } catch (err) {
        console.error("Erro ao criar conversa:", err);
        res.status(500).json({ erro: "Erro ao criar nova conversa." });
    }
});

// 3. Obter mensagens de uma conversa específica
app.get("/api/conversas/:id", (req, res) => {
    try {
        const { id } = req.params;
        const conversa = db.prepare(`SELECT * FROM conversas WHERE id = ?`).get(id);
        if (!conversa) {
            return res.status(404).json({ erro: "Conversa não encontrada." });
        }

        const mensagens = db.prepare(`
            SELECT id, papel, conteudo, criado_em 
            FROM mensagens 
            WHERE conversa_id = ? 
            ORDER BY id ASC
        `).all(id);

        res.json({ ...conversa, mensagens });
    } catch (err) {
        console.error("Erro ao carregar mensagens:", err);
        res.status(500).json({ erro: "Erro ao carregar mensagens da conversa." });
    }
});

// 4. Excluir uma conversa e todas as suas mensagens do banco
app.delete("/api/conversas/:id", (req, res) => {
    try {
        const { id } = req.params;
        db.prepare(`DELETE FROM mensagens WHERE conversa_id = ?`).run(id);
        db.prepare(`DELETE FROM conversas WHERE id = ?`).run(id);
        res.json({ sucesso: true });
    } catch (err) {
        console.error("Erro ao deletar conversa:", err);
        res.status(500).json({ erro: "Erro ao excluir conversa." });
    }
});

// 5. Enviar mensagem e receber resposta da IA (salvando no SQLite e gerando título automático na 1ª pergunta)
app.post("/chat", async (req, res) => {
    try {
        let { mensagem, conversaId } = req.body;
        mensagem = mensagem?.trim();

        if (!mensagem) {
            return res.status(400).json({ erro: "Mensagem não pode ser vazia." });
        }

        const isPrimeiraPergunta = !conversaId;

        // Se conversaId não foi informada, cria uma nova conversa no SQLite
        if (isPrimeiraPergunta) {
            const tituloProvisorio = mensagem.length > 32 
                ? mensagem.substring(0, 30) + "..." 
                : mensagem;
            const insertConversa = db.prepare(`INSERT INTO conversas (titulo) VALUES (?)`).run(tituloProvisorio);
            conversaId = Number(insertConversa.lastInsertRowid);
        } else {
            conversaId = Number(conversaId);
        }

        // Salva a mensagem do usuário no banco SQLite
        db.prepare(`INSERT INTO mensagens (conversa_id, papel, conteudo) VALUES (?, 'user', ?)`).run(conversaId, mensagem);
        db.prepare(`UPDATE conversas SET atualizado_em = CURRENT_TIMESTAMP WHERE id = ?`).run(conversaId);

        // Busca o histórico de mensagens dessa conversa para manter o contexto com a IA
        const historico = db.prepare(`
            SELECT papel, conteudo 
            FROM mensagens 
            WHERE conversa_id = ? 
            ORDER BY id ASC
        `).all(conversaId);

        const messagesPayload = [
            {
                role: "system",
                content: "Você é um assistente virtual útil e inteligente do projeto AI Control, focado em apoiar jovens e estudantes no uso consciente da tecnologia e autonomia nos estudos. Responda em português."
            },
            ...historico.map(m => ({
                role: m.papel === "assistant" ? "assistant" : "user",
                content: m.conteudo
            }))
        ];

        const groq = getGroqClient();

        // 1. Requisição da resposta principal ao usuário
        const promessaResposta = groq.chat.completions.create({
            model: "openai/gpt-oss-120b",
            messages: messagesPayload
        });

        // 2. Se for a primeira pergunta, requisita em paralelo à Groq que gere um título curto (invisível para o usuário)
        let promessaTitulo = null;
        if (isPrimeiraPergunta) {
            promessaTitulo = groq.chat.completions.create({
                model: "openai/gpt-oss-120b",
                messages: [
                    {
                        role: "system",
                        content: "Você é um assistente encarregado de criar títulos curtos e elegantes para conversas de chat. Responda EXCLUSIVAMENTE com o título em português, entre 2 e 5 palavras, sem aspas, sem ponto final e sem explicações."
                    },
                    {
                        role: "user",
                        content: `Gere um título curto para uma conversa iniciada com a pergunta: "${mensagem}"`
                    }
                ]
            }).catch(err => {
                console.warn("Aviso: Falha ao gerar título automático com IA:", err.message);
                return null;
            });
        }

        // Executa as consultas em paralelo para máxima velocidade
        const [requisicaoResposta, requisicaoTitulo] = await Promise.all([
            promessaResposta,
            promessaTitulo
        ]);

        const respostaIA = requisicaoResposta.choices[0].message.content;

        // Salva a resposta da IA no banco SQLite
        db.prepare(`INSERT INTO mensagens (conversa_id, papel, conteudo) VALUES (?, 'assistant', ?)`).run(conversaId, respostaIA);
        db.prepare(`UPDATE conversas SET atualizado_em = CURRENT_TIMESTAMP WHERE id = ?`).run(conversaId);

        // Se gerou título na primeira pergunta, atualiza no banco SQLite
        let tituloFinal = null;
        if (isPrimeiraPergunta && requisicaoTitulo?.choices?.[0]?.message?.content) {
            let tituloGerado = requisicaoTitulo.choices[0].message.content
                .replace(/^["'`«»]+|["'`«»]+$/g, '')
                .replace(/[\r\n\t]+/g, ' ')
                .replace(/\.$/, '')
                .trim();

            if (tituloGerado.length > 50) {
                tituloGerado = tituloGerado.substring(0, 47) + "...";
            }

            if (tituloGerado) {
                tituloFinal = tituloGerado;
                db.prepare(`UPDATE conversas SET titulo = ? WHERE id = ?`).run(tituloFinal, conversaId);
            }
        }

        if (!tituloFinal) {
            const conversaRow = db.prepare(`SELECT titulo FROM conversas WHERE id = ?`).get(conversaId);
            tituloFinal = conversaRow ? conversaRow.titulo : "Conversa";
        }

        res.json({
            conversaId,
            titulo: tituloFinal,
            resposta: respostaIA
        });

    } catch (erro) {
        console.error("Erro na Groq ou banco:", erro);
        res.status(500).json({
            erro: "Não foi possível consultar a IA. Verifique se a chave GROQ_API_KEY no arquivo .env é válida."
        });
    }
});

app.listen(3000, () => {
    console.log("Servidor rodando na porta 3000 com SQLite persistente");
});
