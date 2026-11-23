(() => {
    "use strict";

    if (window.__aiControlSearchInitialized) return;
    const form = document.getElementById("form-pesquisa");
    const input = document.getElementById("campo-pesquisa");
    if (!form || !input) return;

    window.__aiControlSearchInitialized = true;

    function normalize(text) {
        return text
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .trim();
    }

    form.addEventListener("submit", (event) => {
        event.preventDefault();

        const term = normalize(input.value);
        if (!term) return;

        const sections = Array.from(document.querySelectorAll(".app-main > section"));
        const getTitle = (section) => {
            const heading = section.querySelector("h1, h2");
            return heading ? normalize(heading.textContent) : "";
        };

        const target = sections.find((section) =>
            normalize(section.id) === term || getTitle(section) === term
        ) || sections.find((section) =>
            normalize(section.id).includes(term) ||
            term.includes(normalize(section.id)) ||
            getTitle(section).includes(term)
        );

        if (target && typeof window.aiControlNavigateTo === "function") {
            form.classList.remove("ring-2", "ring-red-500");
            window.aiControlNavigateTo(target.id);
            input.value = "";
            return;
        }

        form.classList.add("ring-2", "ring-red-500");
        window.setTimeout(() => form.classList.remove("ring-2", "ring-red-500"), 1000);
    });
})();