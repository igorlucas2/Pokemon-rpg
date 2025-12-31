(() => {
  const $ = (id) => document.getElementById(id);

  const btn = $("btnShop");
  const modal = $("shopModal");
  const closeBtn = $("shopModalClose");
  const grid = $("shopGrid");
  const status = $("shopStatus");

  if (!btn || !modal || !grid || !status) return;

  let loaded = false;
  let items = [];

  function open() {
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    if (!loaded) void load();
    render();
  }

  function close() {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function render() {
    if (!items.length) {
      grid.innerHTML = `
        <div class="shop-item" style="grid-column: 1 / -1; justify-content:space-between;">
          <div>
            <div class="shop-item__name">Loja</div>
            <div class="shop-item__desc">Abra para carregar itens da PokéAPI.</div>
          </div>
          <img class="shop-item__icon" src="/assets/itens/moeda.png" alt="Moeda" />
        </div>
      `;
      return;
    }

    grid.innerHTML = items
      .map(
        (it) => `
          <div class="shop-item" title="${escapeHtml(it.name)}">
            <img class="shop-item__icon" src="${escapeHtml(it.icon || "/assets/itens/moeda.png")}" alt="${escapeHtml(it.name)}" loading="lazy" onerror="this.style.display='none'" />
            <div class="shop-item__body">
              <div class="shop-item__top">
                <div class="shop-item__name">${escapeHtml(it.name)}</div>
                <div class="shop-item__price">₽ ${Number(it.price || 0).toLocaleString("pt-BR")}</div>
              </div>
              <div class="shop-item__desc">${escapeHtml(it.description || "Sem descrição.")}</div>
            </div>
          </div>
        `
      )
      .join("");
  }

  async function load() {
    status.textContent = "Carregando…";
    try {
      const res = await fetch("/api/shop/items?limit=24&offset=0");
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "failed");

      items = Array.isArray(data.results) ? data.results : [];
      loaded = true;
      status.textContent = `${items.length} item(ns)`;
      render();
    } catch {
      items = [];
      loaded = false;
      status.textContent = "Falha ao carregar.";
      grid.innerHTML = "";
    }
  }

  btn.addEventListener("click", open);
  closeBtn?.addEventListener("click", close);
  modal?.querySelector("[data-shop-modal-close]")?.addEventListener("click", close);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });
})();
