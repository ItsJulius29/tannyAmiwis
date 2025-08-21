let allProducts = [];
let currentType = "amigurumis";          // "amigurumis" | "patrones" | "free"
let currentCategory = "Todos";
let currentDifficulty = "all";
let currentPage = 1;
let currentSource = "products.json";     // "products.json" | "patterns.json" | "free.json"

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

// helpers
const mm = window.matchMedia("(max-width: 991.98px)");
const getPageSize = () => (mm.matches ? 8 : 9);
const slugify = s => s.toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

const BANNERS = {
  amigurumis: "assets/images/amigurumis/18.jpg",
  patrones:   "assets/images/amigurumis/19.jpg",
  free:       "assets/images/amigurumis/18.jpg" // pon aquí el banner que quieras para Free
};

// ===== Carga JSON
function loadProductsFromJSON(source) {
  fetch(`json/${source}`)
    .then((res) => res.json())
    .then((data) => {
      allProducts = data;
      currentPage = 1;
      renderFilteredProducts();
    })
    .catch((err) => console.error("Error cargando JSON:", err));
}

// ===== Render con filtros + paginación
function renderFilteredProducts() {
  container.innerHTML = "";

  // Si la fuente es free.json, no filtramos por type.
  const mustMatchType = (currentSource === "products.json" || currentSource === "patterns.json");

  const filtered = allProducts.filter((p) => {
    const matchType = mustMatchType ? (p.type === currentType) : true;
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

    // Si price es 0/null/undefined mostramos "Gratis"
    const priceHtml = (product.price && Number(product.price) > 0)
      ? `$${product.price}`
      : 'Gratis';

    const card = document.createElement("div");
    card.className = "col product-item fade-in";
    card.innerHTML = `
      <div class="card h-100 position-relative">
        <img src="${cover}" class="card-img-top" alt="${product.name}">
        <div class="card-body text-center">
          <p class="card-text small text-muted">${product.category ?? ""}</p>
          <h5 class="card-title">${product.name}</h5>
          <p class="fw-bold">${priceHtml}</p>
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
      document.querySelector("#products-container")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    li.appendChild(a);
    paginationUl.appendChild(li);
  }
}

// ===== Tabs (Amigurumis / Patrones / Free)
function setupTabs() {
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelector(".active-tab")?.classList.remove("active-tab");
      tab.classList.add("active-tab");

      currentType = tab.dataset.tab;       // "amigurumis" | "patrones" | "free"
      currentSource = tab.dataset.source;  // "products.json" | "patterns.json" | "free.json"

      // Banner por tipo
      banner.src = BANNERS[currentType] || BANNERS.amigurumis;

      // Reset filtros visibles
      currentCategory = "Todos";
      catCurrent && (catCurrent.textContent = "(Todos)");
      categoryButtons.forEach((b) => b.classList.remove("active-category"));
      document.querySelector('.category-btn[data-category="Todos"]')?.classList.add("active-category");

      // (opcional) Desactivar dificultad para Free si no la usas
      const usingDifficulty = (currentSource !== "free.json");
      allDifficultyCheckbox.disabled = !usingDifficulty;
      allDifficultyCheckbox.checked  = usingDifficulty;
      difficultySlider.disabled = !usingDifficulty || allDifficultyCheckbox.checked;

      currentDifficulty = "all";

      currentPage = 1;
      loadProductsFromJSON(currentSource);
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

// ===== Cambios de viewport
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
  loadProductsFromJSON("products.json"); // inicio por defecto
  catCurrent && (catCurrent.textContent = "(Todos)");
});
