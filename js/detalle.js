// -------- utilidades --------
const $ = s => document.querySelector(s);
const qs = new URLSearchParams(location.search);

const rawSrc = qs.get('src') || 'products.json';
// acepta rutas con o sin carpeta "json/"
const srcParam = /\/|\\.json$/i.test(rawSrc) ? rawSrc : `json/${rawSrc}`;
const idParam = qs.get('id');
const idxParam = qs.get('idx');
const slugParam = (qs.get('slug') || '').toLowerCase();

const slugify = s => String(s || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

const DIFF = { 1: "Fácil", 2: "Intermedio", 3: "Difícil" };
const diffLabel = d => DIFF[d] || "—";
const firstNumber = v => { const n = Number(v); return Number.isFinite(n) ? n : null; };

// --- FX USD→PEN con caché 12h ---
const FX_TTL_MS = 12 * 60 * 60 * 1000;
async function getUsdPenRate() {
    try {
        const c = JSON.parse(localStorage.getItem('fx_usd_pen') || 'null');
        if (c && Date.now() - c.t < FX_TTL_MS && Number.isFinite(c.v)) return c.v;
    } catch { }
    const tryFetch = async (url, pick) => {
        const r = await fetch(url, { cache: 'no-store' });
        if (!r.ok) throw 0;
        const j = await r.json();
        const v =
            pick === 'fawaz' ? Number(j.usd?.pen) :
                pick === 'host' ? Number(j.rates?.PEN) :
                    pick === 'erapi' ? Number(j.rates?.PEN) : NaN;
        if (!Number.isFinite(v)) throw 0;
        localStorage.setItem('fx_usd_pen', JSON.stringify({ v, t: Date.now() }));
        return v;
    };
    try { return await tryFetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json', 'fawaz'); } catch { }
    try { return await tryFetch('https://api.exchangerate.host/latest?base=USD&symbols=PEN', 'host'); } catch { }
    try { return await tryFetch('https://open.er-api.com/v6/latest/USD', 'erapi'); } catch { }
    return 3.70; // fallback
}

// -------- carga y búsqueda --------
(async function init() {
    try {
        const res = await fetch(srcParam, { cache: 'no-store' });
        const data = await res.json();

        let prod = null;
        if (idParam != null) {
            prod = data.find(p => String(p.id) === String(idParam));
        } else if (idxParam != null) {
            const i = Number(idxParam);
            if (!Number.isNaN(i) && i >= 0 && i < data.length) prod = data[i];
        } else if (slugParam) {
            prod = data.find(p => slugify(p.name) === slugParam);
        }
        if (!prod) return showStatus('No se encontró el producto.');

        const fx = await getUsdPenRate();
        renderDetail(prod, data, fx);
    } catch (e) {
        console.error(e);
        showStatus('Error cargando datos.');
    }
})();

// -------- UI --------
function showStatus(msg) {
    $('#statusBox').innerHTML = `<div class="alert alert-warning text-center">${msg}</div>`;
}

function renderDetail(p, all, fx) {
    // migas
    const typeTitle = capitalize(p.type || '');
    $('#crumbTrail').textContent = `Productos / ${typeTitle} / ${p.category || '—'}`;

    // título
    $('#title').textContent = p.name || '';

    // precios: JSON trae solo "price" en USD
    let usd = firstNumber(p.price ?? p.price_usd ?? p.usd);
    let pen = (usd != null) ? +(usd * fx).toFixed(2) : null;

    const isFree = (usd === 0) || (usd == null);
    const priceBox = $('#price');
    priceBox.innerHTML = '';

    if (isFree) {
        priceBox.innerHTML = `<span class="price-free">Gratis</span>`;
    } else {
        priceBox.appendChild(priceRow('🇺🇸', `$${usd.toFixed(2)}`));
        if (pen != null) priceBox.appendChild(priceRow('🇵🇪', `S/${pen.toFixed(2)}`));
    }

    // tipo y CTA
    const isPatternType = String(p.type || '').toLowerCase() === 'patrones';
    const hasPattern = !!p.hasPattern || isPatternType;
    $('#patternPill').hidden = !hasPattern;

    const cta = $('#primaryBtn');
    cta.textContent = isPatternType ? 'Comprar patrón' : 'Solicitar amigurumi';
    cta.href = p.cta || '#';

    // imágenes
    const imgs = Array.isArray(p.images) && p.images.length ? p.images : [p.image].filter(Boolean);
    const main = $('#mainImg');
    main.src = imgs[0] || '';
    main.alt = p.name || '';

    const thumbs = $('#thumbs');
    thumbs.innerHTML = '';
    imgs.forEach((src, i) => {
        const im = document.createElement('img');
        im.src = src; im.alt = p.name || '';
        if (i === 0) im.classList.add('active');
        im.addEventListener('click', () => {
            main.src = src;
            thumbs.querySelectorAll('img').forEach(x => x.classList.remove('active'));
            im.classList.add('active');
        });
        thumbs.appendChild(im);
    });

    // volver
    $('#backBtn').addEventListener('click', (e) => {
        e.preventDefault();
        history.length ? history.back() : location.href = 'products.html';
    });

    // relacionados: calcula PEN desde USD
    const related = all
        .filter(x => x !== p && x.type === p.type && x.category === p.category)
        .slice(0, 4);

    const relBox = $('#related');
    if (!related.length) {
        relBox.innerHTML = '<p class="text-muted mb-0">No hay relacionados.</p>';
    } else {
        relBox.innerHTML = related.map(r => {
            const cover = (Array.isArray(r.images) && r.images[0]) || r.image || '';
            const link = r.id != null
                ? `detalle.html?src=${encodeURIComponent(rawSrc)}&id=${encodeURIComponent(r.id)}`
                : `detalle.html?src=${encodeURIComponent(rawSrc)}&idx=${all.indexOf(r)}`;
            const usdR = firstNumber(r.price ?? r.price_usd ?? r.usd);
            const penR = (usdR != null && usdR > 0) ? +(usdR * fx).toFixed(2) : null;
            return `
        <div class="col-6 col-md-4 col-lg-3">
          <a class="text-decoration-none" href="${link}">
            <div class="card card-related">
              <img src="${cover}" alt="${r.name || ''}">
              <div class="p-2">
                <div class="small text-muted">${r.category || ''}</div>
                <div class="title">${r.name || ''}</div>
                ${penR != null ? `<div class="mt-2"><button class="btn-more">Ver más</button> <span class="ms-2 small">S/${penR.toFixed(2)}</span></div>` : `<div class="mt-2"><button class="btn-more">Ver más</button></div>`}
              </div>
            </div>
          </a>
        </div>`;
        }).join('');
    }

    // zoom modal
    initZoomWith(main);

    $('#detail-root').hidden = false;
}

function priceRow(flag, text) {
    const row = document.createElement('div');
    row.className = 'price-row';
    const f = document.createElement('span'); f.className = 'price-flag'; f.textContent = flag;
    const t = document.createElement('span'); t.textContent = text;
    row.appendChild(f); row.appendChild(t);
    return row;
}

function capitalize(s) { return s ? s[0].toUpperCase() + s.slice(1) : s; }

// --- Zoom modal ---
const zoomModalEl = document.querySelector('#zoomModal');
const zoomImg = document.querySelector('#zoomImg');
const zoomModal = new bootstrap.Modal(zoomModalEl, { backdrop: true });

function initZoomWith(mainImgEl) {
    mainImgEl.addEventListener('click', () => {
        zoomImg.src = mainImgEl.src;
        resetZoom();
        zoomModal.show();
    });
}

let scale = 1, tx = 0, ty = 0, startX = 0, startY = 0, panning = false;
const MIN = 1, MAX = 5;
function apply() { zoomImg.style.transform = `translate(${tx}px,${ty}px) scale(${scale})`; }
function resetZoom() { scale = 1; tx = 0; ty = 0; apply(); }

zoomModalEl.addEventListener('wheel', (e) => {
    e.preventDefault();
    const d = e.deltaY < 0 ? 0.12 : -0.12;
    scale = Math.max(MIN, Math.min(MAX, scale + d));
    apply();
}, { passive: false });

zoomImg.addEventListener('mousedown', (e) => {
    panning = true; startX = e.clientX - tx; startY = e.clientY - ty; zoomImg.classList.add('grabbing');
});
window.addEventListener('mousemove', (e) => {
    if (!panning) return; tx = e.clientX - startX; ty = e.clientY - startY; apply();
});
window.addEventListener('mouseup', () => { panning = false; zoomImg.classList.remove('grabbing'); });

let pinchStart = null;
const dist = t => Math.hypot(t[0].pageX - t[1].pageX, t[0].pageY - t[1].pageY);
zoomImg.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) { pinchStart = dist(e.touches); }
    else if (e.touches.length === 1) { panning = true; startX = e.touches[0].clientX - tx; startY = e.touches[0].clientY - ty; }
}, { passive: false });
zoomImg.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (e.touches.length === 2 && pinchStart) {
        const d = dist(e.touches); const delta = (d - pinchStart) / 300;
        scale = Math.max(MIN, Math.min(MAX, scale + delta)); pinchStart = d; apply();
    } else if (panning && e.touches.length === 1) {
        tx = e.touches[0].clientX - startX; ty = e.touches[0].clientY - startY; apply();
    }
}, { passive: false });
zoomImg.addEventListener('touchend', () => { pinchStart = null; panning = false; });
zoomModalEl.addEventListener('hidden.bs.modal', resetZoom);
