let allProducts = [];
let currentType = "amigurumis";
let currentCategory = "Todos";
let currentDifficulty = "all";

// estado de paginación
let currentPage = 1;

// DOM
const container = document.getElementById("products-container");
const tabs = document.querySelectorAll(".category-tab");
const banner = document.getElementById("categoryBanner");
const categoryButtons = document.querySelectorAll(".category-btn");
const difficultySlider = document.getElementById("difficultyRange");
const allDifficultyCheckbox = document.getElementById("allDifficulties");
const paginationUl = document.querySelector(".pagination");
const paginationNav = paginationUl?.closest("nav");
const catCurrent = document.getElementById("catCurrent");
let currentSource = "products.json"; // <— products o patterns


// helpers
const mm = window.matchMedia("(max-width: 991.98px)");
const getPageSize = () => (mm.matches ? 8 : 9);
const slugify = s => s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quita acentos
    .replace(/[^a-z0-9]+/g, '-')                     // separa no-alfanum
    .replace(/(^-|-$)/g, '');                        // bordes


// ===== Carga JSON
function loadProductsFromJSON(source) {
    fetch(`json/${source}`)
        .then((res) => res.json())
        .then((data) => {
            allProducts = data;
            currentPage = 1; // reset
            renderFilteredProducts();
        })
        .catch((err) => console.error("Error cargando JSON:", err));
}

// ===== Render con filtros + paginación
function renderFilteredProducts() {
    container.innerHTML = "";

    const filtered = allProducts.filter((p) => {
        const matchType = p.type === currentType;
        const matchCategory = currentCategory === "Todos" || p.category === currentCategory;
        const matchDifficulty = currentDifficulty === "all" || p.difficulty === Number(currentDifficulty);
        return matchType && matchCategory && matchDifficulty;
    });

    if (filtered.length === 0) {
        container.innerHTML = `
      <div class="col-12 no-products-message">
        No hay productos disponibles con los<br>filtros seleccionados.
      </div>`;
        if (paginationNav) paginationNav.style.display = "none";
        return;
    }

    const pageSize = getPageSize();
    const totalPages = Math.ceil(filtered.length / pageSize) || 1;

    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const start = (currentPage - 1) * pageSize;
    const slice = filtered.slice(start, start + pageSize);

    slice.forEach((product) => {
        const cover = Array.isArray(product.images) && product.images.length
            ? product.images[0]
            : product.image;

        const href = product.id != null
            ? `detalle.html?src=${encodeURIComponent(currentSource)}&id=${encodeURIComponent(product.id)}`
            : `detalle.html?src=${encodeURIComponent(currentSource)}&idx=${allProducts.indexOf(product)}`;

        const card = document.createElement("div");
        card.className = "col product-item fade-in";
        card.innerHTML = `
    <div class="card h-100 position-relative">
      <img src="${cover}" class="card-img-top" alt="${product.name}">
      <div class="card-body text-center">
        <p class="card-text small text-muted">${product.category}</p>
        <h5 class="card-title">${product.name}</h5>
        <p class="fw-bold">$${product.price}</p>
      </div>
      <a class="stretched-link" href="${href}" aria-label="Ver ${product.name}"></a>
    </div>`;
        container.appendChild(card);
    });


    renderPagination(totalPages);
}

function renderPagination(totalPages) {
    if (!paginationUl) return;

    if (totalPages <= 1) {
        if (paginationNav) paginationNav.style.display = "none";
        paginationUl.innerHTML = "";
        return;
    }

    if (paginationNav) paginationNav.style.display = "";

    paginationUl.innerHTML = "";
    for (let i = 1; i <= totalPages; i++) {
        const li = document.createElement("li");
        li.className = "page-item" + (i === currentPage ? " active" : "");
        const a = document.createElement("a");
        a.className = "page-link";
        a.href = "#";
        a.textContent = i;
        a.addEventListener("click", (e) => {
            e.preventDefault();
            if (currentPage === i) return;
            currentPage = i;
            renderFilteredProducts();
            // opcional: subir hacia la grilla tras cambiar de página
            document.querySelector("#products-container")?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
        li.appendChild(a);
        paginationUl.appendChild(li);
    }
}

// ===== Tabs (Amigurumis / Patrones)
function setupTabs() {
    tabs.forEach((tab) => {
        tab.addEventListener("click", () => {
            document.querySelector(".active-tab")?.classList.remove("active-tab");
            tab.classList.add("active-tab");

            currentType = tab.dataset.tab;
            currentSource = tab.dataset.source;     // <— guarda el JSON activo
            const source = tab.dataset.source;

            banner.src = currentType === "amigurumis"
                ? "assets/images/amigurumis/18.jpg"
                : "assets/images/amigurumis/19.jpg";

            currentPage = 1;
            loadProductsFromJSON(source);
        });
    });
}


// ===== Categoría
function setupCategoryFilters() {
    categoryButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
            categoryButtons.forEach((b) => b.classList.remove("active-category"));
            btn.classList.add("active-category");

            currentCategory = btn.dataset.category;
            if (catCurrent) catCurrent.textContent = `(${currentCategory})`;

            currentPage = 1;
            renderFilteredProducts();

            // cerrar el desplegable en móvil para ver productos
            if (window.innerWidth < 992) {
                const el = document.getElementById("catCollapse");
                if (el) bootstrap.Collapse.getOrCreateInstance(el).hide();
            }
        });
    });
}


// ===== Dificultad
function setupDifficultyFilter() {
    allDifficultyCheckbox.addEventListener("change", () => {
        if (allDifficultyCheckbox.checked) {
            difficultySlider.disabled = true;
            currentDifficulty = "all";
        } else {
            difficultySlider.disabled = false;
            currentDifficulty = difficultySlider.value;
        }
        currentPage = 1;
        renderFilteredProducts();
    });

    difficultySlider.addEventListener("input", () => {
        if (!allDifficultyCheckbox.checked) {
            currentDifficulty = difficultySlider.value;
            currentPage = 1;
            renderFilteredProducts();
        }
    });
}

// ===== Cambios de viewport (recalcula 10/12 items)
mm.addEventListener("change", () => {
    currentPage = 1;
    renderFilteredProducts();
});

// ===== Init
document.addEventListener("DOMContentLoaded", () => {
    setupTabs();
    setupCategoryFilters();
    setupDifficultyFilter();
    document.querySelector('.category-btn[data-category="Todos"]')?.classList.add("active-category");
    loadProductsFromJSON("products.json"); // inicio
    catCurrent && (catCurrent.textContent = "(Todos)");
});
