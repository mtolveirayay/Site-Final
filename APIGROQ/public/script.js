(() => {
    "use strict";

    if (window.__aiControlChatInitialized) return;

    const form = document.getElementById("form-chat");
    const input = document.getElementById("chat-pergunta");
    const sendButton = form ? form.querySelector(".btn") : null;
    const list = document.getElementById("lista-conversas");
    const newConversationButton = document.getElementById("nova-conversa");
    const conversationCount = document.getElementById("contador-conversas");
    const historyStatus = document.getElementById("historico-status");
    const currentTitle = document.getElementById("chat-titulo-atual");
    const messagesContainer = document.getElementById("chat-mensagens");
    const chatStatus = document.getElementById("chat-status");

    if (
        !form || !input || !sendButton || !list || !newConversationButton ||
        !conversationCount || !historyStatus || !currentTitle ||
        !messagesContainer || !chatStatus
    ) return;

    window.__aiControlChatInitialized = true;

    const localHost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
    const needsLocalApi = localHost && window.location.port !== "3000";
    const apiBase = needsLocalApi
        ? window.location.protocol + "//" + window.location.hostname + ":3000"
        : "";

    let activeConversationId = null;
    let isSending = false;

    async function api(path, options = {}) {
        const headers = new Headers(options.headers || {});
        if (options.body && !headers.has("Content-Type")) {
            headers.set("Content-Type", "application/json");
        }

        const response = await fetch(apiBase + path, {
            ...options,
            headers,
            credentials: "include"
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            const error = new Error(data.erro || "A solicita\u00e7\u00e3o n\u00e3o foi conclu\u00edda.");
            error.data = data;
            error.status = response.status;
            throw error;
        }

        return data;
    }

    function setHistoryStatus(message, isError = false) {
        historyStatus.textContent = message;
        historyStatus.classList.toggle("text-rose-200", isError);
        historyStatus.classList.toggle("text-white/60", !isError);
    }

    function makeMessage(papel, conteudo) {
        const wrapper = document.createElement("article");
        wrapper.className = papel === "user"
            ? "rounded-xl bg-[#242739]/80 p-4"
            : "rounded-xl border border-[#E6A06F]/40 bg-[#242739]/80 p-4";

        const label = document.createElement("p");
        label.className = papel === "user"
            ? "text-xs font-bold uppercase tracking-wide text-[#9E9C71]"
            : "text-xs font-bold uppercase tracking-wide text-[#E6A06F]";
        label.textContent = papel === "user" ? "Voc\u00ea" : "AI Control";

        const text = document.createElement("p");
        text.className = "mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-white";
        text.textContent = conteudo;

        wrapper.append(label, text);
        return wrapper;
    }

    function showEmptyConversation() {
        messagesContainer.replaceChildren();
        const empty = document.createElement("p");
        empty.className = "rounded-xl border border-dashed border-[#9E9C71]/50 p-5 text-center text-sm text-white/70";
        empty.textContent = "Comece uma conversa enviando sua primeira pergunta.";
        messagesContainer.append(empty);
        currentTitle.textContent = "Nova conversa";
    }

    function renderMessages(messages) {
        messagesContainer.replaceChildren();
        if (!messages.length) {
            showEmptyConversation();
            return;
        }

        for (const message of messages) {
            messagesContainer.append(makeMessage(message.papel, message.conteudo));
        }
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    function renderConversationList(conversations) {
        list.replaceChildren();
        conversationCount.textContent = String(conversations.length);

        if (conversations.length === 0) {
            const empty = document.createElement("p");
            empty.className = "rounded-lg px-3 py-4 text-center text-sm text-white/60";
            empty.textContent = "Seu hist\u00f3rico aparecer\u00e1 aqui.";
            list.append(empty);
            return;
        }

        for (const conversation of conversations) {
            const row = document.createElement("div");
            row.setAttribute("role", "listitem");
            row.className = "flex items-center gap-2";

            const selectButton = document.createElement("button");
            selectButton.type = "button";
            selectButton.dataset.conversationId = String(conversation.id);
            selectButton.className = "min-w-0 flex-1 truncate rounded-lg border px-3 py-2 text-left text-sm transition hover:border-[#E6A06F] hover:bg-white/10";
            selectButton.classList.add(
                Number(activeConversationId) === Number(conversation.id)
                    ? "border-[#E6A06F]"
                    : "border-transparent"
            );
            selectButton.setAttribute(
                "aria-current",
                Number(activeConversationId) === Number(conversation.id) ? "true" : "false"
            );
            selectButton.textContent = conversation.titulo || "Nova conversa";

            const deleteButton = document.createElement("button");
            deleteButton.type = "button";
            deleteButton.dataset.deleteConversation = String(conversation.id);
            deleteButton.className = "shrink-0 rounded-lg px-2 py-2 text-xs text-white/60 transition hover:bg-rose-500/20 hover:text-rose-200";
            deleteButton.setAttribute(
                "aria-label",
                "Excluir conversa " + (conversation.titulo || conversation.id)
            );
            deleteButton.textContent = "Excluir";

            row.append(selectButton, deleteButton);
            list.append(row);
        }
    }

    async function loadConversations({ openMostRecent = false } = {}) {
        const data = await api("/api/conversas");
        const conversations = Array.isArray(data.conversas) ? data.conversas : [];
        renderConversationList(conversations);

        const activeStillExists = conversations.some(
            (conversation) => Number(conversation.id) === Number(activeConversationId)
        );

        if (activeConversationId && activeStillExists) {
            return;
        }

        if (openMostRecent && conversations.length > 0) {
            await openConversation(conversations[0].id);
        } else if (!activeStillExists) {
            activeConversationId = null;
            showEmptyConversation();
        }
    }

    async function openConversation(id) {
        const data = await api("/api/conversas/" + encodeURIComponent(id));
        activeConversationId = data.conversa.id;
        currentTitle.textContent = data.conversa.titulo || "Nova conversa";
        renderMessages(Array.isArray(data.mensagens) ? data.mensagens : []);
        setHistoryStatus("");
        await loadConversations();
    }

    async function createNewConversation() {
        if (isSending) return;

        activeConversationId = null;
        showEmptyConversation();
        await loadConversations();
        setHistoryStatus("Nova conversa pronta.");
        chatStatus.textContent = "";
        input.focus();
    }

    async function deleteConversation(id) {
        if (isSending) return;

        await api("/api/conversas/" + encodeURIComponent(id), { method: "DELETE" });
        if (Number(activeConversationId) === Number(id)) {
            activeConversationId = null;
            showEmptyConversation();
        }
        await loadConversations();
        setHistoryStatus("Conversa exclu\u00edda.");
    }

    list.addEventListener("click", async (event) => {
        if (isSending) return;
        const deleteButton = event.target.closest("[data-delete-conversation]");
        if (deleteButton) {
            try {
                await deleteConversation(deleteButton.dataset.deleteConversation);
            } catch (error) {
                setHistoryStatus(error.message, true);
            }
            return;
        }

        const selectButton = event.target.closest("[data-conversation-id]");
        if (!selectButton) return;

        try {
            await openConversation(selectButton.dataset.conversationId);
        } catch (error) {
            setHistoryStatus(error.message, true);
        }
    });

    newConversationButton.addEventListener("click", () => {
        createNewConversation().catch((error) => setHistoryStatus(error.message, true));
    });

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (isSending) return;

        const mensagem = input.value.trim();
        if (!mensagem) {
            input.focus();
            return;
        }

        isSending = true;
        input.disabled = true;
        sendButton.disabled = true;
        newConversationButton.disabled = true;
        chatStatus.textContent = "Enviando sua pergunta...";
        messagesContainer.append(makeMessage("user", mensagem));

        const pendingMessage = makeMessage("assistant", "Aguarde, estou preparando uma resposta...");
        pendingMessage.dataset.pending = "true";
        messagesContainer.append(pendingMessage);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        try {
            const data = await api("/chat", {
                method: "POST",
                body: JSON.stringify({
                    mensagem,
                    conversaId: activeConversationId
                })
            });

            activeConversationId = data.conversaId;
            currentTitle.textContent = data.titulo || "Nova conversa";
            input.value = "";
            chatStatus.textContent = "Resposta recebida.";

            await loadConversations();
            await openConversation(activeConversationId);
        } catch (error) {
            if (error.data && error.data.conversaId) {
                activeConversationId = error.data.conversaId;
                await loadConversations().catch(() => {});
                await openConversation(activeConversationId).catch(() => {});
            } else {
                pendingMessage.querySelector("p:last-child").textContent = error instanceof TypeError
                    ? "N\u00e3o foi poss\u00edvel conectar ao servidor. Abra o site pela porta 3000 ou confira a conexao."
                    : error.message;
            }
            chatStatus.textContent = "N\u00e3o foi poss\u00edvel obter a resposta.";
            setHistoryStatus(error.message, true);
        } finally {
            isSending = false;
            input.disabled = false;
            sendButton.disabled = false;
            newConversationButton.disabled = false;
            input.focus();
        }
    });

    loadConversations({ openMostRecent: true }).catch((error) => {
        setHistoryStatus(
            "N\u00e3o foi poss\u00edvel carregar o hist\u00f3rico. Abra o AI Control pelo servidor na porta 3000.",
            true
        );
        chatStatus.textContent = error.message;
        showEmptyConversation();
    });
})();
