(() => {
    "use strict";

    if (window.__aiControlHudController) return;

    const main = document.querySelector(".app-main");
    const hud = document.getElementById("hud-secoes");
    const dotsContainer = document.getElementById("hud-bolinhas");
    const previousButton = document.getElementById("hud-subir");
    const nextButton = document.getElementById("hud-descer");

    if (!main || !hud || !dotsContainer || !previousButton || !nextButton) return;

    const sections = Array.from(main.querySelectorAll(":scope > section"));
    if (!sections.length) return;

    const indexesById = new Map(sections.map((section, index) => [section.id, index]));
    const dots = sections.map((section, index) => {
        const heading = section.querySelector("h1, h2");
        const label = heading ? heading.textContent.trim().replace(/\s+/g, " ") : "Seção " + (index + 1);
        const button = document.createElement("button");

        button.type = "button";
        button.className = "hud-dot";
        button.setAttribute("aria-label", "Ir para " + label);
        button.setAttribute("aria-controls", section.id);
        button.addEventListener("click", () => activate(index, true));

        return button;
    });

    dotsContainer.replaceChildren(...dots);

    let activeIndex = -1;

    function idFromLocation() {
        try {
            return decodeURIComponent(window.location.hash.slice(1));
        } catch {
            return "";
        }
    }

    function activate(target, updateHistory) {
        const nextIndex = typeof target === "number" ? target : indexesById.get(target);
        if (!Number.isInteger(nextIndex) || nextIndex < 0 || nextIndex >= sections.length) return false;

        const changed = nextIndex !== activeIndex;
        activeIndex = nextIndex;

        sections.forEach((section, index) => {
            const active = index === activeIndex;
            section.hidden = !active;
            section.classList.toggle("is-active", active);
            section.setAttribute("aria-hidden", String(!active));
            if (active && changed) section.scrollTop = 0;
        });

        dots.forEach((dot, index) => {
            if (index === activeIndex) {
                dot.setAttribute("aria-current", "step");
            } else {
                dot.removeAttribute("aria-current");
            }
        });

        previousButton.disabled = activeIndex === 0;
        nextButton.disabled = activeIndex === sections.length - 1;

        const sectionId = sections[activeIndex].id;
        if (updateHistory && window.location.hash !== "#" + sectionId) {
            window.history.pushState({ aiControlSection: sectionId }, "", "#" + sectionId);
        }

        const dropdown = document.getElementById("menu-dropdown");
        const menuButton = document.getElementById("menu-button");
        if (dropdown && menuButton) {
            dropdown.classList.add("hidden");
            dropdown.classList.remove("flex");
            menuButton.setAttribute("aria-expanded", "false");
        }

        return true;
    }

    previousButton.addEventListener("click", () => activate(activeIndex - 1, true));
    nextButton.addEventListener("click", () => activate(activeIndex + 1, true));

    document.addEventListener("click", (event) => {
        if (!(event.target instanceof Element)) return;
        const link = event.target.closest('a[href^="#"]');
        if (!link) return;

        const targetId = link.hash ? idFromLink(link.hash) : "";
        if (!indexesById.has(targetId)) return;

        event.preventDefault();
        activate(targetId, true);
    });

    function idFromLink(hash) {
        try {
            return decodeURIComponent(hash.slice(1));
        } catch {
            return "";
        }
    }

    function syncFromLocation() {
        const targetId = idFromLocation();
        if (indexesById.has(targetId)) activate(targetId, false);
    }

    window.addEventListener("popstate", syncFromLocation);
    window.addEventListener("hashchange", syncFromLocation);

    window.aiControlNavigateTo = (sectionId) => activate(sectionId, true);

    const menuButton = document.getElementById("menu-button");
    const dropdown = document.getElementById("menu-dropdown");
    const dropdownContainer = document.getElementById("dropdown-container");

    if (menuButton && dropdown && dropdownContainer) {
        menuButton.addEventListener("click", () => {
            const isOpen = menuButton.getAttribute("aria-expanded") !== "true";
            menuButton.setAttribute("aria-expanded", String(isOpen));
            dropdown.classList.toggle("hidden", !isOpen);
            dropdown.classList.toggle("flex", isOpen);
        });

        document.addEventListener("click", (event) => {
            if (event.target instanceof Node && !dropdownContainer.contains(event.target)) {
                menuButton.setAttribute("aria-expanded", "false");
                dropdown.classList.add("hidden");
                dropdown.classList.remove("flex");
            }
        });

        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape") {
                menuButton.setAttribute("aria-expanded", "false");
                dropdown.classList.add("hidden");
                dropdown.classList.remove("flex");
                menuButton.focus();
            }
        });
    }

    const toggleSitesButton = document.getElementById("btn-alternar-sites");
    const sitesList = document.getElementById("lista-sites");
    const channelsList = document.getElementById("lista-canais");

    if (toggleSitesButton && sitesList && channelsList) {
        toggleSitesButton.addEventListener("click", () => {
            const showChannels = channelsList.classList.contains("hidden");
            channelsList.classList.toggle("hidden", !showChannels);
            channelsList.classList.toggle("flex", showChannels);
            sitesList.classList.toggle("hidden", showChannels);
            sitesList.classList.toggle("flex", !showChannels);
            toggleSitesButton.textContent = showChannels
                ? "Sites educativos recomendados"
                : "Canais do YouTube recomendados";
        });
    }

    activate(indexesById.has(idFromLocation()) ? idFromLocation() : 0, false);

    if (sections.length !== 9) {
        console.warn("O HUD foi sincronizado com " + sections.length + " seções; o esperado para o AI Control são 9.");
    }

    window.__aiControlHudController = {
        activate,
        sections,
        dots
    };
})();