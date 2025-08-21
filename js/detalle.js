// -------- utilidades --------
const $ = s => document.querySelector(s);
const qs = new URLSearchParams(location.search);

const srcParam = qs.get('src') || 'products.json';
const idParam = qs.get('id');              // ej: detalle.html?src=...&id=123
const idxParam = qs.get('idx');             // ej: detalle.html?src=...&idx=7
const slugParam = (qs.get('slug') || '').toLowerCase();

const slugify = s => s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

const diffLabel = d => ({ 1: "Fácil", 2: "Intermedio", 3: "Difícil" }[d] || "—");

// -------- carga y búsqueda --------
(async function init() {
    try {
        const res = await fetch(`json/${srcParam}`);
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

        renderDetail(prod, data);
    } catch (err) {
        console.error(err);
        showStatus('Error cargando datos.');
    }
})();

// -------- UI --------
function showStatus(msg) {
    $('#statusBox').innerHTML =
        `<div class="alert alert-warning text-center">${msg}</div>`;
}

function renderDetail(p, all) {
    // migas
    $('#breadcrumbs').textContent =
        `Productos / ${capitalize(p.type || '')} / ${p.category || '—'}`;

    // datos básicos
    $('#title').textContent = p.name || '';
    $('#price').textContent = p.price ? `$${p.price}` : '';
    $('#cat').textContent = p.category || '—';
    $('#diff').textContent = diffLabel(p.difficulty);

    // tipo/botón
    const isPattern = String(p.type || '').toLowerCase() === 'patrones';
    $('#badgeType').textContent = isPattern ? 'Patrón' : 'Amigurumi';
    const cta = $('#primaryBtn');
    cta.textContent = isPattern ? 'Comprar patrón' : 'Solicitar amigurumi';
    cta.href = '#'; // pon tu destino real

    // imágenes
    const imgs = Array.isArray(p.images) && p.images.length ? p.images : [p.image];
    const main = $('#mainImg');
    main.src = imgs[0]; main.alt = p.name || '';

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
    $('#backBtn').addEventListener('click', () =>
        history.length ? history.back() : location.href = 'products.html'
    );

    // relacionados (misma categoría y tipo, excluyendo actual)
    const related = all
        .filter(x => x !== p && x.type === p.type && x.category === p.category)
        .slice(0, 4);

    const relBox = $('#related');
    if (!related.length) {
        relBox.innerHTML = '<p class="text-muted">No hay relacionados.</p>';
    } else {
        relBox.innerHTML = related.map(r => {
            // arma el enlace usando id si existe; si no, usa idx; si no, slug (respaldo)
            let link;
            if (r.id != null) {
                link = `detalle.html?src=${encodeURIComponent(srcParam)}&id=${encodeURIComponent(r.id)}`;
            } else {
                const idx = all.indexOf(r);
                link = `detalle.html?src=${encodeURIComponent(srcParam)}&idx=${idx}`;
            }

            const cover = (Array.isArray(r.images) && r.images[0]) || r.image || '';
            return `
                <div class="col-6 col-md-4 col-lg-3">
                    <a class="text-decoration-none" href="${link}">
                    <div class="card card-related">
                        <img src="${cover}" alt="${r.name || ''}">
                        <div class="p-2">
                        <div class="small text-muted">${r.category || ''}</div>
                        <div class="title">${r.name || ''}</div>
                        ${r.price ? `<div class="small fw-bold mt-1">$${r.price}</div>` : ''}
                        </div>
                    </div>
                    </a>
                </div>`;
        }).join('');
    }

    $('#detail-root').hidden = false;
}

// --- Zoom en modal ---
const zoomModalEl = document.querySelector('#zoomModal');
const zoomImg = document.querySelector('#zoomImg');
const zoomModal = new bootstrap.Modal(zoomModalEl, { backdrop: true });

function initZoomWith(mainImgEl) {
    // abrir modal con la imagen actual
    mainImgEl.addEventListener('click', () => {
        zoomImg.src = mainImgEl.src;
        resetZoom();
        zoomModal.show();
    });
}

// Llama a esto dentro de renderDetail, después de setear #mainImg.src:
initZoomWith(document.querySelector('#mainImg'));

// Estado de zoom/pan
let scale = 1, tx = 0, ty = 0, startX = 0, startY = 0, panning = false;
const MIN = 1, MAX = 5;

function apply() { zoomImg.style.transform = `translate(${tx}px,${ty}px) scale(${scale})`; }
function resetZoom() { scale = 1; tx = 0; ty = 0; apply(); }

// rueda del mouse
zoomModalEl.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.12 : -0.12;
    scale = Math.max(MIN, Math.min(MAX, scale + delta));
    apply();
}, { passive: false });

// arrastrar con mouse
zoomImg.addEventListener('mousedown', (e) => {
    panning = true;
    startX = e.clientX - tx;
    startY = e.clientY - ty;
    zoomImg.classList.add('grabbing');
});
window.addEventListener('mousemove', (e) => {
    if (!panning) return;
    tx = e.clientX - startX;
    ty = e.clientY - startY;
    apply();
});
window.addEventListener('mouseup', () => {
    panning = false;
    zoomImg.classList.remove('grabbing');
});

// touch: pinch-zoom + pan
let pinchStartDist = null;
const dist = (t) => Math.hypot(t[0].pageX - t[1].pageX, t[0].pageY - t[1].pageY);

zoomImg.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) { pinchStartDist = dist(e.touches); }
    else if (e.touches.length === 1) {
        panning = true;
        startX = e.touches[0].clientX - tx;
        startY = e.touches[0].clientY - ty;
    }
}, { passive: false });

zoomImg.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (e.touches.length === 2 && pinchStartDist) {
        const d = dist(e.touches);
        const delta = (d - pinchStartDist) / 300;  // sensibilidad
        scale = Math.max(MIN, Math.min(MAX, scale + delta));
        pinchStartDist = d;
        apply();
    } else if (panning && e.touches.length === 1) {
        tx = e.touches[0].clientX - startX;
        ty = e.touches[0].clientY - startY;
        apply();
    }
}, { passive: false });

zoomImg.addEventListener('touchend', () => {
    pinchStartDist = null;
    panning = false;
});

// reset cuando se cierra
zoomModalEl.addEventListener('hidden.bs.modal', resetZoom);



function capitalize(s) { return s ? s[0].toUpperCase() + s.slice(1) : s; }
