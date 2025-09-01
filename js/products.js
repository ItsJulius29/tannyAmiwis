// ===== Estado =====
let allProducts = [];
let currentType = "amigurumis";          // "amigurumis" | "pago" | "free"
let currentCategory = "Todos";
let currentDifficulty = "all";
let currentPage = 1;
let currentSource = "products.json";     // "products.json" | "pay.json" | "free.json"

// ===== DOM =====
const container = document.getElementById("products-container");
const tabs = document.querySelectorAll(".category-tab");
const banner = document.getElementById("categoryBanner");
const categoryButtons = document.querySelectorAll(".category-btn");
const difficultySlider = document.getElementById("difficultyRange");
const allDifficultyCheckbox = document.getElementById("allDifficulties");
const paginationUl = document.querySelector(".pagination");
const paginationNav = paginationUl?.closest("nav");
const catCurrent = document.getElementById("catCurrent");

// nodos del bloque de dificultad (para ocultar/mostrar sin cambiar HTML)
// --- nodos del bloque de dificultad para ocultar/mostrar ---
const diffHr = document.querySelector(".sidebar .bg-light hr");
const diffTitle = document.querySelector(".sidebar .bg-light h6.fw-bold");
const diffCheckWrap = document.querySelector(".sidebar .bg-light .form-check");
const diffRangeInput = document.getElementById("difficultyRange");
// ← NUEVO: tomar la fila de etiquetas como el siguiente hermano del input
const getDiffLabels = () => document.getElementById("difficultyRange")?.nextElementSibling;


// ===== Constantes =====
const mm = window.matchMedia("(max-width: 991.98px)");
const getPageSize = () => (mm.matches ? 8 : 9);
const firstNumber = v => { const n = Number(v); return Number.isFinite(n) ? n : null; };

const BANNERS = {
  amigurumis: "assets/images/pruebabanner.jpg",
  pago: "assets/images/pruebabanner.jpg",
  free: "assets/images/pruebabanner.jpg"
};

// Dimensiones para reservar espacio
const CARD_W = 600, CARD_H = 600;
const BANNER_W = 1200, BANNER_H = 675;

// ===== Cache JSON con versionado =====
const DATA_VERSION = "v2";                 // súbelo cuando cambies los JSON
const JSON_CACHE = {};
const SESSION_KEY = (src) => `prod_json_${DATA_VERSION}_${src}`;

// 1×1 transparente válido
const BLANK_IMG = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

// ===== Lazy loader =====
const imgObserver = new IntersectionObserver((entries, obs) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    const img = e.target;
    if (img.dataset.src) { img.src = img.dataset.src; img.removeAttribute("data-src"); }
    if (img.dataset.srcset) { img.srcset = img.dataset.srcset; img.removeAttribute("data-srcset"); }
    if (img.dataset.sizes) { img.sizes = img.dataset.sizes; img.removeAttribute("data-sizes"); }
    img.addEventListener("load", () => img.classList.remove("lazy"), { once: true });
    obs.unobserve(img);
  }
}, { rootMargin: "300px 0px", threshold: 0.01 });

// ===== Mostrar/ocultar UI de dificultad según pestaña =====
function applyDifficultyUI() {
  const show = (currentSource !== "products.json"); // solo en pay/free

  const diffLabels = getDiffLabels(); // obtenerla cada vez (por si cambia el DOM)

  // Ocultar/mostrar el bloque de dificultad
  [diffHr, diffTitle, diffCheckWrap, diffRangeInput, diffLabels]
    .forEach(el => el && el.classList.toggle("d-none", !show));

  // Estados lógicos
  if (!allDifficultyCheckbox || !difficultySlider) return;

  allDifficultyCheckbox.disabled = !show;

  if (!show) {
    allDifficultyCheckbox.checked = true;   // forzar "todas"
    currentDifficulty = "all";
  }
  difficultySlider.disabled = !show || allDifficultyCheckbox.checked;
}



// ===== Carga JSON =====
function loadProductsFromJSON(source) {
  const key = SESSION_KEY(source);

  // Limpia claves antiguas (sin versión) una vez
  try {
    Object.keys(sessionStorage).forEach(k => {
      if (/^prod_json_(products\.json|pay\.json|free\.json)$/.test(k)) sessionStorage.removeItem(k);
    });
  } catch { }

  // 1) Memoria
  if (JSON_CACHE[source]) {
    allProducts = JSON_CACHE[source];
    currentPage = 1;
    renderFilteredProducts();
    return;
  }

  // 2) sessionStorage
  try {
    const cached = sessionStorage.getItem(key);
    if (cached) {
      JSON_CACHE[source] = JSON.parse(cached);
      allProducts = JSON_CACHE[source];
      currentPage = 1;
      renderFilteredProducts();
      idle(() => fetchAndStore(source, true));
      return;
    }
  } catch { }

  // 3) Red
  fetchAndStore(source, false);
}

// fetch con opción "silent" (no re-render)
function fetchAndStore(source, silent = false) {
  const url = `json/${source}?v=${DATA_VERSION}`;
  fetch(url, { cache: "no-store" })
    .then(res => res.json())
    .then(data => {
      JSON_CACHE[source] = data;
      try { sessionStorage.setItem(SESSION_KEY(source), JSON.stringify(data)); } catch { }
      if (!silent) {
        allProducts = data;
        currentPage = 1;
        renderFilteredProducts();
      }
    })
    .catch(err => console.error("Error cargando JSON:", err));
}

// Prefetch en idle de las otras pestañas
function prefetchOthers(current) {
  const others = ["products.json", "pay.json", "free.json"].filter(s => s !== current);
  idle(() => others.forEach(s => {
    if (!JSON_CACHE[s] && !sessionStorage.getItem(SESSION_KEY(s))) fetchAndStore(s, true);
  }));
}

// requestIdleCallback fallback
function idle(fn) {
  (window.requestIdleCallback || ((cb) => setTimeout(cb, 0)))(fn);
}

// ===== Render + filtros + paginación =====
function renderFilteredProducts() {
  container.innerHTML = "";

  const mustMatchType = (currentSource === "products.json" || currentSource === "pay.json");

  const filtered = allProducts.filter(p => {
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
  currentPage = Math.min(Math.max(currentPage, 1), totalPages);

  const start = (currentPage - 1) * pageSize;
  const slice = filtered.slice(start, start + pageSize);

  // Render rápido (HTML en bloque)
  const html = slice.map((product, i) => {
    const cover = Array.isArray(product.images) && product.images.length ? product.images[0] : product.image;
    const href = product.id != null
      ? `detalle.html?src=${encodeURIComponent(currentSource)}&id=${encodeURIComponent(product.id)}`
      : `detalle.html?src=${encodeURIComponent(currentSource)}&idx=${allProducts.indexOf(product)}`;
    const usd = firstNumber(product.price ?? product.price_usd ?? product.usd);
    const priceHtml = (usd != null && usd > 0) ? `$${usd.toFixed(2)}` : "Gratis";
    const priority = (currentPage === 1 && i < 3) ? "high" : "low";

    return `
      <div class="col product-item fade-in">
        <div class="card h-100 position-relative">
          <img src="${BLANK_IMG}" data-src="${cover || ""}"
               class="card-img-top lazy"
               alt="${product.name || ""}"
               loading="lazy" decoding="async" fetchpriority="${priority}"
               width="${CARD_W}" height="${CARD_H}">
          <div class="card-body text-center">
            <p class="card-text small text-muted">${product.category ?? ""}</p>
            <h5 class="card-title">${product.name}</h5>
            <p class="fw-bold">${priceHtml}</p>
          </div>
          <a class="stretched-link" href="${href}" aria-label="Ver ${product.name}"></a>
        </div>
      </div>`;
  }).join("");

  container.innerHTML = html;
  container.querySelectorAll("img.lazy").forEach(img => imgObserver.observe(img));

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

  const scrollTop = () =>
    document.querySelector("#products-container")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });

  const addPage = (n, { label = String(n), active = false, disabled = false } = {}) => {
    const li = document.createElement("li");
    li.className = "page-item" + (active ? " active" : "") + (disabled ? " disabled" : "");
    const a = document.createElement("a");
    a.className = "page-link";
    a.href = "#";
    a.innerHTML = label;
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

  paginationUl.innerHTML = "";

  addPage(Math.max(1, currentPage - 1), {
    label: '<i class="bi bi-chevron-left"></i>',
    disabled: currentPage === 1
  });

  const WINDOW = 3;
  if (totalPages <= WINDOW + 1) {
    for (let n = 1; n <= totalPages; n++) addPage(n, { active: n === currentPage });
  } else {
    let start = currentPage;
    if (start < 1) start = 1;
    if (start > totalPages - WINDOW) start = totalPages - WINDOW;

    const end = Math.min(start + WINDOW - 1, totalPages - 1);
    for (let n = start; n <= end; n++) addPage(n, { active: n === currentPage });

    if (end < totalPages - 1) addEllipsis();
    addPage(totalPages, { active: currentPage === totalPages });
  }

  addPage(Math.min(totalPages, currentPage + 1), {
    label: '<i class="bi bi-chevron-right"></i>',
    disabled: currentPage === totalPages
  });
}

// ===== Tabs =====
function updateBannerForType() {
  const src = BANNERS[currentType] || BANNERS.amigurumis;
  if (!banner) return;
  banner.src = src;
  banner.setAttribute("width", BANNER_W);
  banner.setAttribute("height", BANNER_H);
  banner.decoding = "async";
  banner.loading = "eager";
  banner.alt =
    currentType === "pago" ? "Patrones de pago" :
      currentType === "free" ? "Patrones gratuitos" :
        "Productos a pedido";
}

function setupTabs() {
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelector(".active-tab")?.classList.remove("active-tab");
      tab.classList.add("active-tab");

      currentType = tab.dataset.tab;
      currentSource = tab.dataset.source;

      updateBannerForType();

      currentCategory = "Todos";
      if (catCurrent) catCurrent.textContent = "(Todos)";
      categoryButtons.forEach((b) => b.classList.remove("active-category"));
      document.querySelector('.category-btn[data-category="Todos"]')?.classList.add("active-category");

      // mostrar/ocultar dificultad según pestaña
      applyDifficultyUI();

      currentDifficulty = "all";
      currentPage = 1;

      loadProductsFromJSON(currentSource);
      prefetchOthers(currentSource); // calienta otras pestañas
    });
  });
}

// ===== Categoría =====
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

// ===== Dificultad =====
function setupDifficultyFilter() {
  if (!allDifficultyCheckbox || !difficultySlider) return;

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

// ===== Viewport change =====
mm.addEventListener("change", () => {
  currentPage = 1;
  renderFilteredProducts();
});

// ===== Init =====
document.addEventListener("DOMContentLoaded", () => {
  setupTabs();
  setupCategoryFilters();
  setupDifficultyFilter();
  document.querySelector('.category-btn[data-category="Todos"]')?.classList.add("active-category");
  updateBannerForType();

  // estado inicial: products.json => ocultar dificultad
  applyDifficultyUI();

  loadProductsFromJSON("products.json");
  prefetchOthers("products.json");
  if (catCurrent) catCurrent.textContent = "(Todos)";
});
