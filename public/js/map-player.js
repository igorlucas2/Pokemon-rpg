(() => {
  const $ = (id) => document.getElementById(id);

  const mapStage = $("mapStage");
  const mapCanvas = $("mapCanvas");
  const mapImg = $("mapImg");
  const tokensLayer = $("tokensLayer");

  const btnZoomIn = $("btnZoomIn");
  const btnZoomOut = $("btnZoomOut");

  let mapData = { regions: [], events: [] };

  // Zoom do dashboard: replica os botões do admin (Zoom +/-)
  // Importante: aqui a gente muda o tamanho de layout do canvas/imagem (não usa transform)
  // para manter o cálculo de posições (socket.js e overlays) consistente.
  let zoomFactor = 1;
  let baseCanvasWidth = null;

  function clampZoom(z) {
    const n = Number(z);
    if (!Number.isFinite(n)) return zoomFactor;
    return Math.max(0.5, Math.min(2.5, n));
  }

  function ensureBaseCanvasWidth() {
    if (baseCanvasWidth && Number.isFinite(baseCanvasWidth)) return baseCanvasWidth;
    const w = mapCanvas?.getBoundingClientRect?.().width;
    baseCanvasWidth = Number.isFinite(w) && w > 0 ? w : 1600;
    // garante que o "100%" começa no mínimo esperado
    if (baseCanvasWidth < 1600) baseCanvasWidth = 1600;
    return baseCanvasWidth;
  }

  function applyZoom(nextZoom) {
    if (!mapCanvas || !mapImg) return;
    ensureBaseCanvasWidth();

    zoomFactor = clampZoom(nextZoom);
    const targetW = Math.round(baseCanvasWidth * zoomFactor);

    // força o canvas a ter um tamanho determinístico e a imagem seguir 100%
    mapCanvas.style.width = `${targetW}px`;
    mapImg.style.width = "100%";
    mapImg.style.maxWidth = "none";

    // dispara recalculo em socket.js (tokens) e no render de overlays
    window.dispatchEvent(new Event("resize"));
    window.UI?.log?.(`🔎 Zoom: ${Math.round(zoomFactor * 100)}%`);
  }

  const hexToRgba = (hex, alpha) => {
    const h = String(hex || "").trim();
    const m = /^#?([0-9a-f]{6})$/i.exec(h);
    const a = Math.max(0, Math.min(1, Number(alpha)));
    if (!m) return `rgba(250,204,21,${a})`;
    const v = m[1];
    const r = parseInt(v.slice(0, 2), 16);
    const g = parseInt(v.slice(2, 4), 16);
    const b = parseInt(v.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
  };

  function applyStyle(el, style, fallbackColor = "#3b82f6", fallbackOpacity = 0.12) {
    if (!el) return;
    const color = style?.color || fallbackColor;
    const opacity = typeof style?.opacity === "number" ? style.opacity : fallbackOpacity;
    const o = Math.max(0, Math.min(1, opacity));
    el.style.borderColor = hexToRgba(color, Math.max(0.35, Math.min(0.9, o + 0.35)));
    el.style.background = hexToRgba(color, Math.max(0.05, o));
  }

  function getImageBox(imgEl, relativeToEl) {
    const imgRect = imgEl.getBoundingClientRect();
    const relRect = relativeToEl.getBoundingClientRect();
    return {
      left: imgRect.left - relRect.left,
      top: imgRect.top - relRect.top,
      width: imgRect.width,
      height: imgRect.height,
    };
  }

  function ensureOverlayLayer() {
    if (!tokensLayer) return null;
    let overlay = document.getElementById("mapOverlays");
    if (overlay) return overlay;

    overlay = document.createElement("div");
    overlay.id = "mapOverlays";
    overlay.style.position = "absolute";
    overlay.style.inset = "0";
    overlay.style.pointerEvents = "none";
    // fica atrás dos tokens (tokenSelf e outros)
    tokensLayer.prepend(overlay);
    return overlay;
  }

  function normFromClick(e) {
    const box = getImageBox(mapImg, tokensLayer);
    const layerRect = tokensLayer.getBoundingClientRect();
    const cx = e.clientX - layerRect.left;
    const cy = e.clientY - layerRect.top;
    const x = (cx - box.left) / box.width;
    const y = (cy - box.top) / box.height;
    return { x, y };
  }

  function findRegionAt(nx, ny) {
    const regions = Array.isArray(mapData.regions) ? mapData.regions : [];
    for (let i = regions.length - 1; i >= 0; i--) {
      const r = regions[i];
      const d = r?.data;
      if (!d) continue;

      const shape = r?.shape === "rect" ? "rect" : "circle";
      if (shape === "rect") {
        if (![d.x, d.y, d.w, d.h].every((n) => typeof n === "number")) continue;
        const inside = nx >= d.x && nx <= d.x + d.w && ny >= d.y && ny <= d.y + d.h;
        if (inside) return r;
      } else {
        if (![d.x, d.y, d.r].every((n) => typeof n === "number")) continue;
        const dx = nx - d.x;
        const dy = ny - d.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= d.r) return r;
      }
    }
    return null;
  }

  function render() {
    if (!tokensLayer || !mapImg) return;
    const overlay = ensureOverlayLayer();
    if (!overlay) return;

    overlay.innerHTML = "";

    const box = getImageBox(mapImg, tokensLayer);
    const events = Array.isArray(mapData.events) ? mapData.events : [];
    const regions = Array.isArray(mapData.regions) ? mapData.regions : [];

    // ===== Regiões (apenas visual, sem capturar clique) =====
    for (const r of regions) {
      const d = r?.data;
      if (!d) continue;

      const shape = r?.shape === "rect" ? "rect" : "circle";
      const style = r?.style || null;

      if (shape === "rect") {
        if (![d.x, d.y, d.w, d.h].every((n) => typeof n === "number")) continue;
        const left = box.left + d.x * box.width;
        const top = box.top + d.y * box.height;
        const width = d.w * box.width;
        const height = d.h * box.height;

        const el = document.createElement("div");
        el.className = "map-overlay__shape map-overlay__region map-overlay__region--rect";
        el.style.position = "absolute";
        el.style.left = `${left}px`;
        el.style.top = `${top}px`;
        el.style.width = `${width}px`;
        el.style.height = `${height}px`;
        el.style.boxSizing = "border-box";
        applyStyle(el, style, "#3b82f6", 0.12);
        overlay.appendChild(el);
        continue;
      }

      if (![d.x, d.y, d.r].every((n) => typeof n === "number")) continue;
      const radiusPx = d.r * box.width;
      const left = box.left + d.x * box.width - radiusPx;
      const top = box.top + d.y * box.height - radiusPx;

      const el = document.createElement("div");
      el.className = "map-overlay__shape map-overlay__region map-overlay__region--circle";
      el.style.position = "absolute";
      el.style.left = `${left}px`;
      el.style.top = `${top}px`;
      el.style.width = `${radiusPx * 2}px`;
      el.style.height = `${radiusPx * 2}px`;
      el.style.boxSizing = "border-box";
      applyStyle(el, style, "#3b82f6", 0.12);
      overlay.appendChild(el);
    }

    for (const ev of events) {
      const shape = ev?.payload?.shape;
      const style = ev?.payload?.style || null;
      if (!shape || !shape.type || !shape.data) continue;

      const applyEventStyle = (el) => {
        if (!el) return;
        applyStyle(el, style, "#facc15", 0.2);
      };

      if (shape.type === "circle") {
        const { x, y, r } = shape.data;
        if (![x, y, r].every((n) => typeof n === "number")) continue;

        const radiusPx = r * box.width;
        const left = box.left + (x * box.width) - radiusPx;
        const top = box.top + (y * box.height) - radiusPx;

        const el = document.createElement("div");
        el.className = "map-overlay__shape map-overlay__event map-overlay__event--circle";
        el.style.position = "absolute";
        el.style.left = `${left}px`;
        el.style.top = `${top}px`;
        el.style.width = `${radiusPx * 2}px`;
        el.style.height = `${radiusPx * 2}px`;
        el.style.boxSizing = "border-box";
        applyEventStyle(el);
        overlay.appendChild(el);
        continue;
      }

      if (shape.type === "rect") {
        const { x, y, w, h } = shape.data;
        if (![x, y, w, h].every((n) => typeof n === "number")) continue;

        const left = box.left + (x * box.width);
        const top = box.top + (y * box.height);
        const width = w * box.width;
        const height = h * box.height;

        const el = document.createElement("div");
        el.className = "map-overlay__shape map-overlay__event map-overlay__event--rect";
        el.style.position = "absolute";
        el.style.left = `${left}px`;
        el.style.top = `${top}px`;
        el.style.width = `${width}px`;
        el.style.height = `${height}px`;
        el.style.boxSizing = "border-box";
        applyEventStyle(el);
        overlay.appendChild(el);
      }
    }
  }

  async function fetchMap() {
    try {
      const res = await fetch("/api/map");
      if (!res.ok) return;
      const next = await res.json();
      mapData = next && typeof next === "object" ? next : { regions: [], events: [] };
      render();
    } catch {
      // ignora
    }
  }

  // Clique em região abre modal (captura para evitar mover token)
  mapStage?.addEventListener(
    "click",
    (e) => {
      if (!tokensLayer || !mapImg) return;
      const { x, y } = normFromClick(e);
      if (x < 0 || x > 1 || y < 0 || y > 1) return;

      const region = findRegionAt(x, y);
      if (!region) return;

      // impede o handler do socket.js (movimento) quando clicar em região
      e.preventDefault();
      e.stopImmediatePropagation();
      e.stopPropagation();

      const events = (Array.isArray(mapData.events) ? mapData.events : []).filter((ev) => ev.regionId === region.id);
      window.UI?.openEventsModal?.(region, events);
    },
    true
  );

  // Recalcula no resize/scroll/load
  window.addEventListener("resize", render);
  mapStage?.addEventListener("scroll", render);
  mapImg.addEventListener("load", render);

  // Zoom (+/-)
  // (os botões existem no dashboard; no admin a lógica fica no próprio admin-map.ejs)
  btnZoomIn?.addEventListener("click", () => applyZoom(zoomFactor + 0.15));
  btnZoomOut?.addEventListener("click", () => applyZoom(zoomFactor - 0.15));

  // Tempo real (se socket.js expuser window.socket)
  if (window.socket && typeof window.socket.on === "function") {
    window.socket.on("map:update", (next) => {
      mapData = next && typeof next === "object" ? next : mapData;
      render();
    });
    window.socket.emit?.("map:get");
  } else {
    fetchMap();
  }
})();
