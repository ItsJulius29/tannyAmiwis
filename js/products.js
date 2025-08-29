let allProducts = [];
let currentType = "amigurumis";          // "amigurumis" | "pago" | "free"
let currentCategory = "Todos";
let currentDifficulty = "all";
let currentPage = 1;
let currentSource = "products.json";     // "products.json" | "pay.json" | "free.json"

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
const firstNumber = v => { const n = Number(v); return Number.isFinite(n) ? n : null; };

const BANNERS = {
  amigurumis: "assets/images/amigurumis/18.jpg",
  pago: "assets/images/amigurumis/19.jpg",
  free: "assets/images/amigurumis/18.jpg"
};

// ===== Cache JSON con versionado =====
const DATA_VERSION = 'v2';                    // súbelo cuando cambies los JSON
const JSON_CACHE = {};
const SESSION_KEY = (src) => `prod_json_${DATA_VERSION}_${src}`;


// Pixel transparente para placeholder
const BLANK_IMG = 'data:image/gif;base64,R0lGLAAQABAAAAACwAAAAAAQABAAACAkQBADs=';

// Lazy loader de imágenes
const imgObserver = new IntersectionObserver((entries, obs) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    const img = e.target;
    const src = img.dataset.src;
    if (src) {
      img.src = src;
      img.removeAttribute('data-src');
      img.addEventListener('load', () => img.classList.remove('lazy'), { once: true });
    }
    obs.unobserve(img);
  }
}, { rootMargin: '300px 0px', threshold: 0.01 });


// ===== Carga JSON (sin autollenado de descripción)
function loadProductsFromJSON(source) {
  const key = SESSION_KEY(source);

  // Limpia claves antiguas (sin versión) una sola vez
  try {
    Object.keys(sessionStorage).forEach(k => {
      if (/^prod_json_(products\.json|pay\.json|free\.json)$/.test(k)) {
        sessionStorage.removeItem(k);
      }
    });
  } catch { }

  // 1) Memoria
  if (JSON_CACHE[source]) {
    allProducts = JSON_CACHE[source];
    currentPage = 1;
    renderFilteredProducts();
    return;
  }

  // 2) sessionStorage (con versión)
  try {
    const cached = sessionStorage.getItem(key);
    if (cached) {
      JSON_CACHE[source] = JSON.parse(cached);
      allProducts = JSON_CACHE[source];
      currentPage = 1;
      renderFilteredProducts();
      // Refresca desde red en idle
      (window.requestIdleCallback || setTimeout)(() => fetchAndStore(source), 0);
      return;
    }
  } catch { }

  // 3) Red
  fetchAndStore(source);
}


function fetchAndStore(source) {
  const url = `json/${source}?v=${DATA_VERSION}`;   // bust de caché
  fetch(url, { cache: 'no-store' })                 // NO usar force-cache
    .then(res => res.json())
    .then(data => {
      JSON_CACHE[source] = data;
      try { sessionStorage.setItem(SESSION_KEY(source), JSON.stringify(data)); } catch { }
      allProducts = data;
      currentPage = 1;
      renderFilteredProducts();
    })
    .catch(err => console.error("Error cargando JSON:", err));
}



// ===== Render con filtros + paginación
function renderFilteredProducts() {
  container.innerHTML = "";

  const mustMatchType = (currentSource === "products.json" || currentSource === "pay.json");

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

  slice.forEach((product, i) => {
    const cover = Array.isArray(product.images) && product.images.length ? product.images[0] : product.image;

    const href = product.id != null
      ? `detalle.html?src=${encodeURIComponent(currentSource)}&id=${encodeURIComponent(product.id)}`
      : `detalle.html?src=${encodeURIComponent(currentSource)}&idx=${allProducts.indexOf(product)}`;

    const usd = firstNumber(product.price ?? product.price_usd ?? product.usd);
    const priceHtml = (usd != null && usd > 0) ? `$${usd.toFixed(2)}` : 'Gratis';

    const priority = (currentPage === 1 && i < 3) ? 'high' : 'low'; // prioriza arriba del fold

    const col = document.createElement("div");
    col.className = "col product-item fade-in";
    col.innerHTML = `
      <div class="card h-100 position-relative">
        <img src="${BLANK_IMG}" data-src="${cover || ''}"
             class="card-img-top lazy"
             alt="${product.name || ''}"
             loading="lazy" decoding="async" fetchpriority="${priority}">
        <div class="card-body text-center">
          <p class="card-text small text-muted">${product.category ?? ""}</p>
          <h5 class="card-title">${product.name}</h5>
          <p class="fw-bold">${priceHtml}</p>
        </div>
        <a class="stretched-link" href="${href}" aria-label="Ver ${product.name}"></a>
      </div>`;
    container.appendChild(col);

    const img = col.querySelector('img');
    if (img) imgObserver.observe(img);
  });

  renderPagination(totalPages);
}


function renderPagination(totalPages) {
  if (!paginationUl) return;

  // ocultar si no hace falta
  if (totalPages <= 1) {
    if (paginationNav) paginationNav.style.display = "none";
    paginationUl.innerHTML = "";
    return;
  }
  if (paginationNav) paginationNav.style.display = "";

  const scrollTop = () =>
    document.querySelector("#products-container")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });

  const addPage = (n, { label = String(n), active = false, disabled = false, isArrow = false } = {}) => {
    const li = document.createElement("li");
    li.className = "page-item" + (active ? " active" : "") + (disabled ? " disabled" : "");
    const a = document.createElement("a");
    a.className = "page-link";
    a.href = "#";
    a.innerHTML = label; // permite iconos <i>
    a.addEventListener("click", (e) => {
      e.preventDefault();
      if (disabled || active) return;
      currentPage = n;
      renderFilteredProducts();
      scrollTop();
    });
    li.appendChild(a);
    paginationUl.appendChild(li);
  };

  const addEllipsis = () => {
    const li = document.createElement("li");
    li.className = "page-item disabled ellipsis";
    const span = document.createElement("span");
    span.className = "page-link";
    span.textContent = "…";
    li.appendChild(span);
    paginationUl.appendChild(li);
  };

  // reset
  paginationUl.innerHTML = "";

  // Flecha anterior
  addPage(Math.max(1, currentPage - 1), {
    label: '<i class="bi bi-chevron-left"></i>',
    disabled: currentPage === 1,
    isArrow: true
  });

  // Ventana de 3 números + último
  const WINDOW = 3;

  if (totalPages <= WINDOW + 1) {
    // pocos: muestra todos
    for (let n = 1; n <= totalPages; n++) {
      addPage(n, { active: n === currentPage });
    }
  } else {
    // calcula el inicio de la ventana
    let start = currentPage;
    if (start < 1) start = 1;
    if (start > totalPages - WINDOW) start = totalPages - WINDOW;

    // páginas de la ventana (NO incluye el último)
    const end = Math.min(start + WINDOW - 1, totalPages - 1);
    for (let n = start; n <= end; n++) {
      addPage(n, { active: n === currentPage });
    }

    // puntos + último si hace falta
    if (end < totalPages - 1) addEllipsis();
    addPage(totalPages, { active: currentPage === totalPages });
  }

  // Flecha siguiente
  addPage(Math.min(totalPages, currentPage + 1), {
    label: '<i class="bi bi-chevron-right"></i>',
    disabled: currentPage === totalPages,
    isArrow: true
  });
}


// ===== Tabs
function setupTabs() {
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelector(".active-tab")?.classList.remove("active-tab");
      tab.classList.add("active-tab");

      currentType = tab.dataset.tab;
      currentSource = tab.dataset.source;

      banner.src = BANNERS[currentType] || BANNERS.amigurumis;

      currentCategory = "Todos";
      catCurrent && (catCurrent.textContent = "(Todos)");
      categoryButtons.forEach((b) => b.classList.remove("active-category"));
      document.querySelector('.category-btn[data-category="Todos"]')?.classList.add("active-category");

      const usingDifficulty = (currentSource !== "free.json");
      allDifficultyCheckbox.disabled = !usingDifficulty;
      allDifficultyCheckbox.checked = usingDifficulty;
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

// ===== Viewport change
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
  loadProductsFromJSON("products.json");
  catCurrent && (catCurrent.textContent = "(Todos)");
});
