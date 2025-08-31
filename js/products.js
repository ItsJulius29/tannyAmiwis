/* products.js — Render rápido con placeholders válidos, prefetch y render incremental */

/* ===== Estado ===== */
let allProducts = [];
let currentType = "amigurumis";          // "amigurumis" | "pago" | "free"
let currentCategory = "Todos";
let currentDifficulty = "all";
let currentPage = 1;
let currentSource = "products.json";     // "products.json" | "pay.json" | "free.json"
let renderToken = 0;                      // para cancelar renders antiguos

/* ===== DOM ===== */
const container = document.getElementById("products-container");
const tabs = document.querySelectorAll(".category-tab");
const banner = document.getElementById("categoryBanner");
const categoryButtons = document.querySelectorAll(".category-btn");
const difficultySlider = document.getElementById("difficultyRange");
const allDifficultyCheckbox = document.getElementById("allDifficulties");
const paginationUl = document.querySelector(".pagination");
const paginationNav = paginationUl?.closest("nav");
const catCurrent = document.getElementById("catCurrent");

/* ===== Constantes ===== */
const mm = window.matchMedia("(max-width: 991.98px)");
const getPageSize = () => (mm.matches ? 8 : 9);
const firstNumber = v => { const n = Number(v); return Number.isFinite(n) ? n : null; };

const BANNERS = {
  amigurumis: "assets/images/pruebabanner.jpg",
  pago: "assets/images/pruebabanner.jpg",
  free: "assets/images/pruebabanner.jpg"
};

// dimensiones lógicas para reservar espacio
const CARD_W = 600, CARD_H = 600;          // cards cuadradas
const BANNER_W = 1200, BANNER_H = 675;     // ~16:9

// 1x1 GIF transparente válido
const BLANK_IMG = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';

/* ===== Caché de JSON con versionado ===== */
const DATA_VERSION = "v3";                 // súbelo cuando cambies los JSON
const JSON_CACHE = {};
const SESSION_KEY = (src) => `prod_json_${DATA_VERSION}_${src}`;

/* ===== Lazy loader (src/srcset/sizes) ===== */
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
}, { rootMargin: "600px 0px", threshold: 0.01 });

/* ===== Skeletons ===== */
function showSkeleton(n) {
  const cards = Array.from({ length: n }, () => `
    <div class="col product-item fade-in">
      <div class="card h-100 position-relative">
        <img src="${BLANK_IMG}" class="card-img-top lazy" alt="" width="${CARD_W}" height="${CARD_H}">
        <div class="card-body text-center">
          <p class="card-text small text-muted">&nbsp;</p>
          <h5 class="card-title">&nbsp;</h5>
          <p class="fw-bold">&nbsp;</p>
        </div>
      </div>
    </div>
  `).join("");
  container.innerHTML = cards;
}

/* ===== Carga JSON ===== */
function loadProductsFromJSON(source) {
  const key = SESSION_KEY(source);

  // limpia claves antiguas (sin versión) una vez
  try {
    Object.keys(sessionStorage).forEach(k => {
      if (/^prod_json_(products\.json|pay\.json|free\.json)$/.test(k)) sessionStorage.removeItem(k);
    });
  } catch { }

  // 1) memoria
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
      // refresca en idle
      (window.requestIdleCallback || setTimeout)(() => fetchAndStore(source), 0);
      return;
    }
  } catch { }

  // 3) red (muestra skeleton breve)
  showSkeleton(getPageSize());
  fetchAndStore(source);
}

function fetchAndStore(source) {
  const url = `json/${source}?v=${DATA_VERSION}`;
  fetch(url, { cache: "no-store" })
    .then(res => res.json())
    .then(data => {
      JSON_CACHE[source] = data;
      try { sessionStorage.setItem(SESSION_KEY(source), JSON.stringify(data)); } catch { }
      allProducts = data;
      currentPage = 1;
      renderFilteredProducts();
    })
    .catch(err => {
      console.error("Error cargando JSON:", err);
      container.innerHTML = `<div class="col-12 no-products-message">No se pudo cargar el catálogo.</div>`;
    });
}

/* ===== Prefetch inteligente (reduce espera al cambiar de pestaña) ===== */
function prefetchIfNeeded(src) {
  if (JSON_CACHE[src] || sessionStorage.getItem(SESSION_KEY(src))) return;
  fetchAndStore(src); // reutiliza el mismo flujo y guarda en sessionStorage
}
function warmPrefetchOthers() {
  if (currentSource !== "pay.json") prefetchIfNeeded("pay.json");
  if (currentSource !== "free.json") prefetchIfNeeded("free.json");
}
tabs.forEach(t => {
  const src = t.dataset.source;
  t.addEventListener("mouseenter", () => prefetchIfNeeded(src));
});

/* ===== Render + filtros + paginación ===== */
function renderFilteredProducts() {
  const myToken = ++renderToken;

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
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  const start = (currentPage - 1) * pageSize;
  const slice = filtered.slice(start, start + pageSize);

  // 1) pinta HTML en bloque (rápido) — las 2 primeras imágenes en eager
  let html = "";
  for (let i = 0; i < slice.length; i++) {
    const p = slice[i];
    const cover = Array.isArray(p.images) && p.images.length ? p.images[0] : p.image;
    const href = p.id != null
      ? `detalle.html?src=${encodeURIComponent(currentSource)}&id=${encodeURIComponent(p.id)}`
      : `detalle.html?src=${encodeURIComponent(currentSource)}&idx=${allProducts.indexOf(p)}`;
    const usd = firstNumber(p.price ?? p.price_usd ?? p.usd);
    const priceHtml = (usd != null && usd > 0) ? `$${usd.toFixed(2)}` : "Gratis";

    const eager = (currentPage === 1 && i < 2); // 2 primeras por página
    const imgAttrs = eager
      ? `src="${cover || ""}" loading="eager" fetchpriority="high"`
      : `src="${BLANK_IMG}" data-src="${cover || ""}" loading="lazy"`;

    html += `
      <div class="col product-item fade-in">
        <div class="card h-100 position-relative">
          <img ${imgAttrs}
               class="card-img-top ${eager ? "" : "lazy"}"
               alt="${p.name || ""}"
               decoding="async" width="${CARD_W}" height="${CARD_H}">
          <div class="card-body text-center">
            <p class="card-text small text-muted">${p.category ?? ""}</p>
            <h5 class="card-title">${p.name || ""}</h5>
            <p class="fw-bold">${priceHtml}</p>
          </div>
          <a class="stretched-link" href="${href}" aria-label="Ver ${p.name}"></a>
        </div>
      </div>`;
  }
  container.innerHTML = html;

  // 2) activa lazy para el resto (si nadie canceló este render)
  if (myToken === renderToken) {
    container.querySelectorAll("img[data-src]").forEach(img => imgObserver.observe(img));
  }

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

/* ===== Tabs ===== */
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

      const usingDifficulty = (currentSource !== "free.json");
      allDifficultyCheckbox.disabled = !usingDifficulty;
      allDifficultyCheckbox.checked = usingDifficulty;
      difficultySlider.disabled = !usingDifficulty || allDifficultyCheckbox.checked;

      currentDifficulty = "all";
      currentPage = 1;

      // skeleton muy corto para feedback instantáneo
      showSkeleton(getPageSize());
      loadProductsFromJSON(currentSource);
      // y calienta las otras
      warmPrefetchOthers();
    });
  });
}

/* ===== Categoría ===== */
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

/* ===== Dificultad ===== */
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

/* ===== Viewport ===== */
mm.addEventListener("change", () => {
  currentPage = 1;
  renderFilteredProducts();
});

/* ===== Init ===== */
document.addEventListener("DOMContentLoaded", () => {
  setupTabs();
  setupCategoryFilters();
  setupDifficultyFilter();
  document.querySelector('.category-btn[data-category="Todos"]')?.classList.add("active-category");
  updateBannerForType();
  loadProductsFromJSON("products.json");
  warmPrefetchOthers();
  if (catCurrent) catCurrent.textContent = "(Todos)";
});
