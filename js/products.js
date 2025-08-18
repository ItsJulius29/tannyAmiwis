let allProducts = [];
let currentType = "amigurumis";
let currentCategory = "Todos";
let currentDifficulty = "all";

// Referencias a elementos del DOM
const container = document.getElementById("products-container");
const tabs = document.querySelectorAll(".category-tab");
const banner = document.getElementById("categoryBanner");
const categoryButtons = document.querySelectorAll(".category-btn");
const difficultySlider = document.getElementById("difficultyRange");
const allDifficultyCheckbox = document.getElementById("allDifficulties");

// Carga dinámica del JSON (productos o patrones)
function loadProductsFromJSON(source) {
    fetch(`json/${source}`)
        .then(res => res.json())
        .then(data => {
            allProducts = data;
            renderFilteredProducts();
        })
        .catch(err => console.error("Error cargando JSON:", err));
}

// Renderizado con todos los filtros aplicados
function renderFilteredProducts() {
    container.innerHTML = "";

    const filtered = allProducts.filter(p => {
        const matchType = p.type === currentType;
        const matchCategory = currentCategory === "Todos" || p.category === currentCategory;
        const matchDifficulty = currentDifficulty === "all" || p.difficulty === Number(currentDifficulty);
        return matchType && matchCategory && matchDifficulty;
    });

    if (filtered.length === 0) {
        container.innerHTML = `
        <div class="col-12 no-products-message">
            No hay productos disponibles con los<br>filtros seleccionados.
        </div>
    `;
        return;
    }

    filtered.forEach(product => {
        const card = document.createElement("div");
        card.className = "col product-item fade-in";

        card.innerHTML = `
            <div class="card h-100">
                <img src="${product.image}" class="card-img-top" alt="${product.name}">
                <div class="card-body text-center">
                    <p class="card-text small text-muted">${product.category}</p>
                    <h5 class="card-title">${product.name}</h5>
                    <p class="fw-bold">$${product.price}</p>
                </div>
            </div>
        `;

        container.appendChild(card);
    });
}

// Cambio entre Amigurumis y Patrones
function setupTabs() {
    tabs.forEach(tab => {
        tab.addEventListener("click", () => {
            document.querySelector(".active-tab")?.classList.remove("active-tab");
            tab.classList.add("active-tab");

            currentType = tab.dataset.tab;
            const source = tab.dataset.source;

            banner.src = currentType === "amigurumis"
                ? "assets/images/amigurumis-banner.jpg"
                : "assets/images/patrones-banner.jpg";

            loadProductsFromJSON(source);
        });
    });
}

// Filtro por categoría
function setupCategoryFilters() {
    categoryButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            // Quitar clase activa a todos
            categoryButtons.forEach(b => b.classList.remove("active-category"));

            // Agregar clase activa al clicado
            btn.classList.add("active-category");

            currentCategory = btn.dataset.category;
            renderFilteredProducts();
        });
    });
}


// Filtro por dificultad
function setupDifficultyFilter() {
    allDifficultyCheckbox.addEventListener("change", () => {
        if (allDifficultyCheckbox.checked) {
            difficultySlider.disabled = true;
            currentDifficulty = "all";
        } else {
            difficultySlider.disabled = false;
            currentDifficulty = difficultySlider.value;
        }
        renderFilteredProducts();
    });

    difficultySlider.addEventListener("input", () => {
        if (!allDifficultyCheckbox.checked) {
            currentDifficulty = difficultySlider.value;
            renderFilteredProducts();
        }
    });
}

document.addEventListener("DOMContentLoaded", () => {
    setupTabs();
    setupCategoryFilters();
    setupDifficultyFilter();
    document.querySelector('.category-btn[data-category="Todos"]')?.classList.add("active-category");
    loadProductsFromJSON("products.json"); // Inicio con Amigurumis
});
