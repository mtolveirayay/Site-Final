// Inicia o servidor principal com suporte à API Groq e Banco de dados SQLite persistente
import('./APIGROQ/server.js').catch((err) => {
    console.error("Erro ao iniciar o servidor com IA e SQLite:", err);
});
