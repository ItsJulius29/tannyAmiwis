// index.js — cada slide del hero es un enlace “invisible” con el filtro correcto
(() => {
    "use strict";

    // Construye la URL hacia products con hash para caer directo en la lista
    const buildHref = (tab, category) => {
        const usp = new URLSearchParams();
        if (tab) usp.set("tab", tab);                 // "amigurumis" | "pago" | "free"
        if (category) usp.set("category", category);  // coincide con data-category en products.html
        return `products.html?${usp.toString()}#products-top`;
    };

    // Destinos por slide (ajusta categorías si cambias los nombres)
    const LINKS = [
        { sel: ".slide-bg-1", href: buildHref("pago", "Reversibles"), label: "Rosas Reversibles" },
        { sel: ".slide-bg-2", href: buildHref("free", ""), label: "Patrones Gratuitos" },
        { sel: ".slide-bg-3", href: buildHref("pago", "Navidad"), label: "Patrones de Pago – Navidad" },
    ];

    function ensureSlideLink(slide, href, label) {
        let a = slide.querySelector(".slide-link");
        if (!a) {
            a = document.createElement("a");
            a.className = "slide-link";
            Object.assign(a.style, { position: "absolute", inset: 0, zIndex: 3, display: "block" });
            slide.style.position = "relative";
            slide.appendChild(a);
        }
        a.href = href;
        a.setAttribute("aria-label", label || "Ver más");
        a.setAttribute("tabindex", "-1");

        // accesibilidad con teclado sobre todo el slide
        slide.setAttribute("role", "link");
        slide.setAttribute("tabindex", "0");
        slide.style.cursor = "pointer";
        slide.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                location.href = href;
            }
        });
    }

    document.addEventListener("DOMContentLoaded", () => {
        LINKS.forEach(({ sel, href, label }) => {
            const slide = document.querySelector(sel);
            if (slide) ensureSlideLink(slide, href, label);
        });
    });
})();
