(() => {
  const $ = (id) => document.getElementById(id);

  const btn = $("btnPokedex");
  const modal = $("pokedexModal");
  const closeBtn = $("pokedexModalClose");
  const search = $("pokedexSearch");
  const status = $("pokedexStatus");
  const grid = $("pokedexGrid");

  const detailsModal = $("pokedexDetailsModal");
  const detailsCloseBtn = $("pokedexDetailsModalClose");
  const detailsTitle = $("pokedexDetailsTitle");
  const detailsSubtitle = $("pokedexDetailsSubtitle");
  const detailsBody = $("pokedexDetailsBody");

  if (!btn || !modal || !grid || !search || !status) return;

  let all = [];
  let loaded = false;

  function open() {
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    search.focus();
    if (!loaded) void load();
  }

  function close() {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
  }

  function openDetails() {
    if (!detailsModal) return;
    detailsModal.classList.add("is-open");
    detailsModal.setAttribute("aria-hidden", "false");
  }

  function closeDetails() {
    if (!detailsModal) return;
    detailsModal.classList.remove("is-open");
    detailsModal.setAttribute("aria-hidden", "true");
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function typeClass(type) {
    const t = String(type || "normal").toLowerCase();
    const known = new Set([
      "normal",
      "fire",
      "water",
      "electric",
      "grass",
      "ice",
      "fighting",
      "poison",
      "ground",
      "flying",
      "psychic",
      "bug",
      "rock",
      "ghost",
      "dragon",
      "dark",
      "steel",
      "fairy",
    ]);
    return `type-${known.has(t) ? t : "normal"}`;
  }

  function render(list) {
    grid.innerHTML = list
      .map(
        (p) => `
          <div class="pokedex-card ${typeClass((p.types || [])[0])}" data-id="${p.id}" title="${escapeHtml(p.name)}">
            <div class="pokedex-card__number">#${p.id}</div>
            <div class="pokedex-card__imgwrap">
              <img src="${escapeHtml(p.gif)}" alt="${escapeHtml(p.name)}" loading="lazy" onerror="this.style.display='none'" />
            </div>
            <div class="pokedex-card__name">${escapeHtml(p.name)}</div>
            <div class="pokedex-card__types">
              ${(p.types || []).map((t) => `<span class="pokedex-badge">${escapeHtml(t)}</span>`).join("")}
            </div>
          </div>
        `
      )
      .join("");
  }

  function applyFilter() {
    const term = search.value.trim().toLowerCase();
    const filtered = term ? all.filter((p) => p.name.includes(term)) : all;
    render(filtered);
    status.textContent = term ? `${filtered.length} resultado(s)` : `${all.length} Pokémon`;
  }

  function cap(s) {
    const str = String(s || "");
    return str ? str.slice(0, 1).toUpperCase() + str.slice(1) : str;
  }

  function renderDetails(p) {
    if (!detailsBody || !detailsTitle) return;
    detailsTitle.textContent = `${cap(p.name)} (#${p.id})`;

    const art = p.gif || p.artwork || "";
    const types = (p.types || []).map((t) => `<span class="pokedex-badge">${escapeHtml(t)}</span>`).join("");
    const abilities = (p.abilities || []).map((a) => `<span class="pokedex-badge">${escapeHtml(a)}</span>`).join("");
    const stats = (p.stats || [])
      .map((s) => {
        const n = escapeHtml(s.name);
        const v = Number(s.value ?? 0);
        return `
          <div class="pokedex-details__stat">
            <div class="pokedex-details__statname">${n}</div>
            <div class="pokedex-details__statvalue">${Number.isFinite(v) ? v : "-"}</div>
          </div>
        `;
      })
      .join("");

    detailsBody.innerHTML = `
      <div class="pokedex-details__hero">
        ${art ? `<img class="pokedex-details__art" src="${escapeHtml(art)}" alt="${escapeHtml(p.name)}" onerror="this.style.display='none'">` : ""}
        <div class="pokedex-details__meta">
          <div class="pokedex-details__name">${escapeHtml(p.name)}</div>
          <div class="pokedex-details__sub">Altura: ${escapeHtml(p.height)} • Peso: ${escapeHtml(p.weight)}</div>
          <div class="pokedex-details__list">${types}</div>
        </div>
      </div>

      <div class="pokedex-details__section">
        <div class="pokedex-details__label">Habilidades</div>
        <div class="pokedex-details__list">${abilities || `<span class="pokedex-details__sub">—</span>`}</div>
      </div>

      <div class="pokedex-details__section">
        <div class="pokedex-details__label">Status base</div>
        <div class="pokedex-details__stats">${stats || ""}</div>
      </div>
    `;
  }

  async function openPokemonDetailsById(id, opts) {
    if (!detailsBody || !detailsTitle) return;
    const subtitle = opts && typeof opts === "object" ? opts.subtitle : null;
    if (detailsSubtitle) detailsSubtitle.textContent = subtitle || "Detalhes";
    detailsTitle.textContent = "Carregando…";
    detailsBody.innerHTML = `<div class="pokedex-details__sub">Buscando dados do Pokémon…</div>`;
    openDetails();

    try {
      const res = await fetch(`/api/pokedex/pokemon/${encodeURIComponent(String(id))}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "failed");
      renderDetails(data);
    } catch {
      detailsBody.innerHTML = `<div class="pokedex-details__sub">Não foi possível carregar os detalhes.</div>`;
    }
  }

  async function load() {
    status.textContent = "Carregando…";
    try {
      const res = await fetch("/api/pokedex/list?limit=151&offset=0");
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "failed");

      all = Array.isArray(data.results) ? data.results : [];
      loaded = true;
      applyFilter();
    } catch {
      status.textContent = "Falha ao carregar.";
      grid.innerHTML = "";
    }
  }

  btn.addEventListener("click", open);
  closeBtn?.addEventListener("click", close);
  modal?.querySelector("[data-pokedex-modal-close]")?.addEventListener("click", close);
  detailsCloseBtn?.addEventListener("click", closeDetails);
  detailsModal?.querySelector("[data-pokedex-details-close]")?.addEventListener("click", closeDetails);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (detailsModal?.classList.contains("is-open")) return closeDetails();
      close();
    }
  });
  search.addEventListener("input", applyFilter);

  grid.addEventListener("click", (e) => {
    const target = e.target;
    const card = target && target.closest ? target.closest(".pokedex-card") : null;
    if (!card) return;
    const id = card.getAttribute("data-id");
    if (!id) return;
    void openPokemonDetailsById(id);
  });

  // Expor para outros scripts (ex: eventos do mapa)
  window.PokedexModal = {
    openPokemonDetailsById,
  };
})();
