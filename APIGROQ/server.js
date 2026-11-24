import express from "express";
import Groq from "groq-sdk";
import dotenv from "dotenv";
import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env") });

const app = express();
const port = Number(process.env.PORT) || 3000;
const model = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
const sessionCookieName = "ai_control_session";
const legacyOwnerId = "__legacy_conversations__";
const developmentOrigin = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/;

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(express.json({ limit: "64kb" }));

const configuredDatabasePath = process.env.SQLITE_DB_PATH;
const databasePath = configuredDatabasePath
    ? (path.isAbsolute(configuredDatabasePath)
        ? configuredDatabasePath
        : path.resolve(__dirname, configuredDatabasePath))
    : path.join(__dirname, "conversas.db");

const bundledDatabasePath = path.join(__dirname, "conversas.db");
mkdirSync(path.dirname(databasePath), { recursive: true });

if (
    path.resolve(databasePath) !== path.resolve(bundledDatabasePath) &&
    !existsSync(databasePath) &&
    existsSync(bundledDatabasePath)
) {
    copyFileSync(bundledDatabasePath, databasePath);
}

const database = new DatabaseSync(databasePath);
database.exec([
    "PRAGMA foreign_keys = ON;",
    "PRAGMA journal_mode = WAL;",
    "PRAGMA busy_timeout = 5000;",
    "CREATE TABLE IF NOT EXISTS conversas (",
    "id INTEGER PRIMARY KEY AUTOINCREMENT,",
    "owner_id TEXT NOT NULL,",
    "titulo TEXT NOT NULL DEFAULT 'Nova conversa',",
    "criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,",
    "atualizado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP",
    ");",
    "CREATE TABLE IF NOT EXISTS mensagens (",
    "id INTEGER PRIMARY KEY AUTOINCREMENT,",
    "conversa_id INTEGER NOT NULL,",
    "papel TEXT NOT NULL CHECK (papel IN ('user', 'assistant')),",
    "conteudo TEXT NOT NULL,",
    "criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,",
    "FOREIGN KEY (conversa_id) REFERENCES conversas(id) ON DELETE CASCADE",
    ");"
].join("\n"));

const conversationColumns = database.prepare("PRAGMA table_info(conversas)").all();
if (!conversationColumns.some((column) => column.name === "owner_id")) {
    database.exec("ALTER TABLE conversas ADD COLUMN owner_id TEXT");
    database.prepare(
        "UPDATE conversas SET owner_id = ? WHERE owner_id IS NULL"
    ).run(legacyOwnerId);
}

database.exec([
    "CREATE INDEX IF NOT EXISTS idx_conversas_owner_atualizado",
    "ON conversas(owner_id, atualizado_em DESC, id DESC);",
    "CREATE INDEX IF NOT EXISTS idx_mensagens_conversa_id",
    "ON mensagens(conversa_id, id);"
].join(" "));

const statements = {
    listConversations: database.prepare(
        "SELECT id, titulo, criado_em, atualizado_em FROM conversas " +
        "WHERE owner_id = ? ORDER BY atualizado_em DESC, id DESC"
    ),
    getConversation: database.prepare(
        "SELECT id, titulo, criado_em, atualizado_em FROM conversas " +
        "WHERE id = ? AND owner_id = ?"
    ),
    createConversation: database.prepare(
        "INSERT INTO conversas (owner_id, titulo) VALUES (?, 'Nova conversa')"
    ),
    countMessages: database.prepare(
        "SELECT COUNT(*) AS total FROM mensagens WHERE conversa_id = ?"
    ),
    listMessages: database.prepare(
        "SELECT id, papel, conteudo, criado_em FROM mensagens " +
        "WHERE conversa_id = ? ORDER BY id ASC"
    ),
    recentMessages: database.prepare(
        "SELECT papel, conteudo FROM mensagens " +
        "WHERE conversa_id = ? ORDER BY id DESC LIMIT 30"
    ),
    createMessage: database.prepare(
        "INSERT INTO mensagens (conversa_id, papel, conteudo) VALUES (?, ?, ?)"
    ),
    updateTitle: database.prepare(
        "UPDATE conversas SET titulo = ?, atualizado_em = CURRENT_TIMESTAMP " +
        "WHERE id = ? AND owner_id = ?"
    ),
    touchConversation: database.prepare(
        "UPDATE conversas SET atualizado_em = CURRENT_TIMESTAMP " +
        "WHERE id = ? AND owner_id = ?"
    ),
    deleteMessages: database.prepare(
        "DELETE FROM mensagens WHERE conversa_id = ?"
    ),
    deleteConversation: database.prepare(
        "DELETE FROM conversas WHERE id = ? AND owner_id = ?"
    ),
    claimLegacyConversations: database.prepare(
        "UPDATE conversas SET owner_id = ? WHERE owner_id = ?"
    ),
    hasOwnedConversation: database.prepare(
        "SELECT 1 AS found FROM conversas WHERE owner_id = ? LIMIT 1"
    )
};

app.use((req, res, next) => {
    const origin = req.get("origin");
    const sameOrigin = origin === req.protocol + "://" + req.get("host");

    if (origin && !sameOrigin && !developmentOrigin.test(origin)) {
        return res.status(403).json({ erro: "Origem n\u00e3o permitida." });
    }

    if (origin && developmentOrigin.test(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Access-Control-Allow-Credentials", "true");
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");
        res.setHeader("Vary", "Origin");
    }

    if (req.method === "OPTIONS") {
        return res.sendStatus(204);
    }

    next();
});

app.use((req, res, next) => {
    const cookieHeader = req.headers.cookie || "";
    const match = cookieHeader.match(
        new RegExp("(?:^|;\\s*)" + sessionCookieName + "=([a-f0-9-]{36})(?:;|$)", "i")
    );

    if (match) {
        req.ownerId = match[1];
    } else {
        req.ownerId = randomUUID();
        const secure = process.env.NODE_ENV === "production" || req.secure;
        const cookie = [
            sessionCookieName + "=" + req.ownerId,
            "Path=/",
            "HttpOnly",
            "SameSite=Lax",
            "Max-Age=31536000",
            ...(secure ? ["Secure"] : [])
        ].join("; ");
        res.append("Set-Cookie", cookie);

        if (!statements.hasOwnedConversation.get(req.ownerId)) {
            statements.claimLegacyConversations.run(req.ownerId, legacyOwnerId);
        }
    }

    next();
});

app.use(express.static(path.join(__dirname, "public")));

let groqClient;

function getGroqClient() {
    if (!process.env.GROQ_API_KEY) {
        const error = new Error("Configure GROQ_API_KEY no arquivo .env.");
        error.statusCode = 503;
        throw error;
    }

    if (!groqClient) {
        groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
    }

    return groqClient;
}

function fallbackTitle(question) {
    const words = question
        .replace(/[?!.,;:]+/g, " ")
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 5);

    if (words.length === 0) return "Nova conversa";
    if (words.length === 1) words.push("geral");
    return words.join(" ");
}

function normalizeTitle(rawTitle, question) {
    const words = String(rawTitle || "")
        .replace(/["'“”‘’]/g, "")
        .replace(/[^\p{L}\p{N}\s-]/gu, " ")
        .trim()
        .split(/\s+/)
        .filter(Boolean);

    if (words.length < 2) return fallbackTitle(question);
    return words.slice(0, 5).join(" ");
}

async function generateAndSaveTitle(question, conversationId, ownerId) {
    try {
        const response = await getGroqClient().chat.completions.create({
            model,
            temperature: 0.2,
            max_completion_tokens: 30,
            messages: [
                {
                    role: "system",
                    content: "Crie um t\u00edtulo curto em portugu\u00eas com 2 a 5 palavras para a conversa. Use apenas o t\u00edtulo, sem aspas, explica\u00e7\u00f5es ou pontua\u00e7\u00e3o final."
                },
                {
                    role: "user",
                    content: question
                }
            ]
        });

        const title = normalizeTitle(
            response.choices?.[0]?.message?.content,
            question
        );
        statements.updateTitle.run(title, conversationId, ownerId);
        return title;
    } catch (error) {
        console.error("Falha ao gerar titulo da conversa:", error.message);
        const title = fallbackTitle(question);
        statements.updateTitle.run(title, conversationId, ownerId);
        return title;
    }
}

function parseConversationId(value) {
    if (value === undefined || value === null || value === "") return null;
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : NaN;
}

app.get("/api/health", (req, res) => {
    res.json({ status: "ok", database: "sqlite" });
});

app.get("/api/conversas", (req, res) => {
    res.json({ conversas: statements.listConversations.all(req.ownerId) });
});

app.post("/api/conversas", (req, res) => {
    const result = statements.createConversation.run(req.ownerId);
    const conversa = statements.getConversation.get(
        Number(result.lastInsertRowid),
        req.ownerId
    );
    res.status(201).json({ conversa });
});

app.get("/api/conversas/:id", (req, res) => {
    const id = parseConversationId(req.params.id);
    if (!Number.isSafeInteger(id)) {
        return res.status(400).json({ erro: "ID de conversa inv\u00e1lido." });
    }

    const conversa = statements.getConversation.get(id, req.ownerId);
    if (!conversa) {
        return res.status(404).json({ erro: "Conversa n\u00e3o encontrada." });
    }

    res.json({
        conversa,
        mensagens: statements.listMessages.all(id)
    });
});

app.delete("/api/conversas/:id", (req, res) => {
    const id = parseConversationId(req.params.id);
    if (!Number.isSafeInteger(id)) {
        return res.status(400).json({ erro: "ID de conversa inv\u00e1lido." });
    }

    const conversa = statements.getConversation.get(id, req.ownerId);
    if (!conversa) {
        return res.status(404).json({ erro: "Conversa n\u00e3o encontrada." });
    }

    statements.deleteMessages.run(id);
    statements.deleteConversation.run(id, req.ownerId);
    res.json({ ok: true });
});

app.post("/chat", async (req, res) => {
    const mensagem = typeof req.body?.mensagem === "string"
        ? req.body.mensagem.trim()
        : "";
    const conversaId = parseConversationId(req.body?.conversaId);

    if (!mensagem) {
        return res.status(400).json({ erro: "Digite uma mensagem." });
    }
    if (mensagem.length > 2000) {
        return res.status(400).json({ erro: "A mensagem excede o limite de 2000 caracteres." });
    }
    if (Number.isNaN(conversaId)) {
        return res.status(400).json({ erro: "ID de conversa inv\u00e1lido." });
    }

    let conversa;
    if (conversaId === null) {
        const result = statements.createConversation.run(req.ownerId);
        conversa = statements.getConversation.get(
            Number(result.lastInsertRowid),
            req.ownerId
        );
    } else {
        conversa = statements.getConversation.get(conversaId, req.ownerId);
        if (!conversa) {
            return res.status(404).json({ erro: "Conversa n\u00e3o encontrada." });
        }
    }

    const messageCount = statements.countMessages.get(conversa.id).total;
    statements.createMessage.run(conversa.id, "user", mensagem);
    statements.touchConversation.run(conversa.id, req.ownerId);

    const history = statements.recentMessages
        .all(conversa.id)
        .reverse()
        .map((item) => ({ role: item.papel, content: item.conteudo }));

    const answerPromise = Promise.resolve().then(() =>
        getGroqClient().chat.completions.create({
            model,
            messages: [
                {
                    role: "system",
                    content: "Voc\u00ea \u00e9 um assistente virtual \u00fatil e inteligente. Responda em portugu\u00eas e ajude o usu\u00e1rio a estudar."
                },
                ...history
            ]
        })
    );

    const titlePromise = messageCount === 0
        ? generateAndSaveTitle(mensagem, conversa.id, req.ownerId)
        : Promise.resolve(conversa.titulo);

    const [answerResult, titleResult] = await Promise.allSettled([
        answerPromise,
        titlePromise
    ]);

    if (answerResult.status === "rejected") {
        const error = answerResult.reason;
        console.error("Erro ao responder pelo Groq:", error.message);
        return res.status(error.statusCode || 502).json({
            erro: error.statusCode === 503
                ? error.message
                : "N\u00e3o foi poss\u00edvel consultar a IA. Tente novamente.",
            conversaId: conversa.id
        });
    }

    const resposta = answerResult.value.choices?.[0]?.message?.content;
    if (typeof resposta !== "string" || !resposta.trim()) {
        return res.status(502).json({
            erro: "A Groq retornou uma resposta vazia.",
            conversaId: conversa.id
        });
    }

    statements.createMessage.run(conversa.id, "assistant", resposta);
    statements.touchConversation.run(conversa.id, req.ownerId);

    res.json({
        conversaId: conversa.id,
        titulo: titleResult.status === "fulfilled" ? titleResult.value : conversa.titulo,
        resposta
    });
});

app.use("/api", (req, res) => {
    res.status(404).json({ erro: "Rota da API nao encontrada." });
});

app.use((error, req, res, next) => {
    console.error("Erro no servidor:", error);
    if (res.headersSent) return next(error);
    res.status(500).json({ erro: "Erro interno do servidor." });
});

const server = app.listen(port, "0.0.0.0", () => {
    console.log("AI Control ouvindo na porta " + port);
});

function shutdown() {
    server.close(() => {
        database.close();
    });
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
