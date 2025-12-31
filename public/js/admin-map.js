(() => {
  const $ = (id) => document.getElementById(id);

  const mapStage = $("mapStage");
  const mapImg = $("mapImg");
  const tokensLayer = $("tokensLayer");

  const modeRegion = $("modeRegion");
  const modeEdge = $("modeEdge");
  const modeEvent = $("modeEvent");
  const modeTip = $("modeTip");

  const selectedText = $("selectedText");
  const regionsCount = $("regionsCount");
  const edgesCount = $("edgesCount");
  const toast = $("toast");

  let MODE = "region"; // region | edge | event
  let mapData = { regions: [], edges: [], events: [] };
  let edgeFrom = null;

  function showToast(msg) {
    toast.textContent = msg;
    toast.style.opacity = "1";
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => (toast.style.opacity = "0.75"), 1200);
  }

  function setMode(m) {
    MODE = m;
    modeRegion.classList.toggle("btn--ghost", m !== "region");
    modeEdge.classList.toggle("btn--ghost", m !== "edge");
    modeEvent.classList.toggle("btn--ghost", m !== "event");

    if (m === "region") modeTip.textContent = "Clique no mapa para criar uma região (círculo).";
    if (m === "edge") modeTip.textContent = "Clique na região ORIGEM e depois na DESTINO para conectar.";
    if (m === "event") modeTip.textContent = "Clique em uma região para criar um evento nela.";
    edgeFrom = null;
    selectedText.textContent = "—";
  }

  modeRegion.addEventListener("click", () => setMode("region"));
  modeEdge.addEventListener("click", () => setMode("edge"));
  modeEvent.addEventListener("click", () => setMode("event"));

  async function fetchMap() {
    const res = await fetch("/api/map");
    mapData = await res.json();
    render();
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

  function clickToNorm(e) {
    const box = getImageBox(mapImg, tokensLayer);
    const layerRect = tokensLayer.getBoundingClientRect();
    const cx = e.clientX - layerRect.left;
    const cy = e.clientY - layerRect.top;

    const x = (cx - box.left) / box.width;
    const y = (cy - box.top) / box.height;
    return { x, y, box };
  }

  function findRegionAt(nx, ny) {
    // circle hit test
    for (let i = mapData.regions.length - 1; i >= 0; i--) {
      const r = mapData.regions[i];
      if (r.shape !== "circle") continue;
      const dx = nx - r.data.x;
      const dy = ny - r.data.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist <= r.data.r) return r;
    }
    return null;
  }

  function render() {
    tokensLayer.innerHTML = "";
    regionsCount.textContent = String(mapData.regions.length);
    edgesCount.textContent = String(mapData.edges.length);

    // Edges (linhas)
    const box = getImageBox(mapImg, tokensLayer);
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", box.width);
    svg.setAttribute("height", box.height);
    svg.style.position = "absolute";
    svg.style.left = `${box.left}px`;
    svg.style.top = `${box.top}px`;
    svg.style.pointerEvents = "none";

    mapData.edges.forEach((e) => {
      const a = mapData.regions.find(r => r.id === e.from);
      const b = mapData.regions.find(r => r.id === e.to);
      if (!a || !b) return;

      const x1 = a.data.x * box.width;
      const y1 = a.data.y * box.height;
      const x2 = b.data.x * box.width;
      const y2 = b.data.y * box.height;

      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", x1);
      line.setAttribute("y1", y1);
      line.setAttribute("x2", x2);
      line.setAttribute("y2", y2);
      line.setAttribute("stroke", "rgba(250,204,21,0.45)");
      line.setAttribute("stroke-width", "4");
      line.setAttribute("stroke-linecap", "round");
      svg.appendChild(line);
    });

    tokensLayer.appendChild(svg);

    // Regions (círculos)
    mapData.regions.forEach((r) => {
      const el = document.createElement("div");
      el.className = "token token--other";
      el.dataset.id = r.id;

      el.innerHTML = `
        <div class="token__icon">📍</div>
        <div class="token__name">${r.name}</div>
      `;

      // “desenha” pelo centro (x,y)
      const px = box.left + (r.data.x * box.width);
      const py = box.top + (r.data.y * box.height);
      el.style.left = `${px}px`;
      el.style.top = `${py}px`;
      tokensLayer.appendChild(el);

      // circulo visual
      const ring = document.createElement("div");
      ring.style.position = "absolute";
      ring.style.left = `${box.left + (r.data.x * box.width) - (r.data.r * box.width)}px`;
      ring.style.top  = `${box.top + (r.data.y * box.height) - (r.data.r * box.width)}px`;
      ring.style.width = `${(r.data.r * box.width) * 2}px`;
      ring.style.height = `${(r.data.r * box.width) * 2}px`;
      ring.style.borderRadius = "999px";
      ring.style.border = "2px solid rgba(59,130,246,0.35)";
      ring.style.background = "rgba(59,130,246,0.08)";
      ring.style.pointerEvents = "none";
      tokensLayer.appendChild(ring);
    });
  }

  async function createRegion(nx, ny) {
    const name = prompt("Nome da região (ex: Route 3 / Pewter City):", "Nova Região");
    if (!name) return;

    const type = prompt("Tipo (city/route/dungeon):", "route") || "route";
    const description = prompt("Descrição (opcional):", "") || "";

    // raio normalizado (ajuste simples)
    const r = 0.03;

    const res = await fetch("/admin/regions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, type, description, data: { x: nx, y: ny, r } }),
    });

    const out = await res.json();
    if (!out.ok) return showToast("Erro ao criar região.");
    showToast("Região criada!");
    await fetchMap();
  }

  async function createEdge(fromId, toId) {
    const res = await fetch("/admin/edges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from: fromId, to: toId }),
    });
    const out = await res.json();
    if (!out.ok) return showToast("Conexão inválida/duplicada.");
    showToast("Conexão criada!");
    await fetchMap();
  }

  async function createEvent(region) {
    const name = prompt("Nome do evento:", "Evento");
    if (!name) return;

    const eventType = prompt("Tipo (battle/npc/item/quest/cutscene):", "npc") || "npc";
    const payloadRaw = prompt("Payload JSON (opcional):", "{}") || "{}";

    let payload = {};
    try { payload = JSON.parse(payloadRaw); } catch { payload = {}; }

    const res = await fetch("/admin/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ regionId: region.id, name, eventType, payload, isActive: true }),
    });

    const out = await res.json();
    if (!out.ok) return showToast("Erro ao criar evento.");
    showToast("Evento criado!");
  }

  mapStage.addEventListener("click", async (e) => {
    const { x, y } = clickToNorm(e);
    if (x < 0 || x > 1 || y < 0 || y > 1) return;

    const region = findRegionAt(x, y);

    if (MODE === "region") {
      // se clicou numa região existente, não cria outra em cima
      if (region) return showToast(`Já existe: ${region.name}`);
      return createRegion(x, y);
    }

    if (MODE === "edge") {
      if (!region) return showToast("Clique em cima de uma região.");
      if (!edgeFrom) {
        edgeFrom = region;
        selectedText.textContent = `Origem: ${region.name}`;
        showToast("Origem selecionada. Agora clique no destino.");
        return;
      }
      // destino
      const edgeTo = region;
      selectedText.textContent = `Ligando: ${edgeFrom.name} -> ${edgeTo.name}`;
      await createEdge(edgeFrom.id, edgeTo.id);
      edgeFrom = null;
      selectedText.textContent = "—";
      return;
    }

    if (MODE === "event") {
      if (!region) return showToast("Clique em cima de uma região.");
      selectedText.textContent = `Evento em: ${region.name}`;
      await createEvent(region);
      return;
    }
  });

  window.addEventListener("resize", render);
  mapStage.addEventListener("scroll", render);
  mapImg.addEventListener("load", render);

  fetchMap();
  setMode("region");
})();
