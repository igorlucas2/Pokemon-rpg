(() => {
  const $ = (id) => document.getElementById(id);

  const btn = $("btnBag");
  const modal = $("bagModal");
  const closeBtn = $("bagModalClose");
  const grid = $("bagGrid");
  const status = $("bagStatus");

  if (!btn || !modal || !grid || !status) return;

  let items = [];

  function open() {
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    loadAndRender();
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

  async function loadAndRender() {
    status.textContent = "Carregando…";
    grid.innerHTML = `
      <div class="bag-item" style="grid-column: 1 / -1; justify-content:space-between;">
        <div>
          <div class="bag-item__name">Carregando…</div>
          <div class="bag-item__sub">Buscando seus itens.</div>
        </div>
        <img class="bag-item__icon" src="/assets/itens/mochila.png" alt="Mochila" />
      </div>
    `;

    try {
      const resp = await fetch("/api/bag", {
        method: "GET",
        headers: { Accept: "application/json" },
      });

      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      items = Array.isArray(data?.items) ? data.items : [];
      render();
    } catch {
      items = [];
      grid.innerHTML = `
        <div class="bag-item" style="grid-column: 1 / -1; justify-content:space-between;">
          <div>
            <div class="bag-item__name">Erro ao carregar</div>
            <div class="bag-item__sub">Tente novamente.</div>
          </div>
          <img class="bag-item__icon" src="/assets/itens/mochila.png" alt="Mochila" />
        </div>
      `;
      status.textContent = "—";
    }
  }

  function render() {
    if (!items.length) {
      grid.innerHTML = `
        <div class="bag-item" style="grid-column: 1 / -1; justify-content:space-between;">
          <div>
            <div class="bag-item__name">Mochila vazia</div>
            <div class="bag-item__sub">Você ainda não possui itens.</div>
          </div>
          <img class="bag-item__icon" src="/assets/itens/mochila.png" alt="Mochila" />
        </div>
      `;
      status.textContent = "0 itens";
      return;
    }

    grid.innerHTML = items
      .map(
        (it) => `
          <div class="bag-item" title="${escapeHtml(it.name)}">
            <img class="bag-item__icon" src="${escapeHtml(it.icon || "/assets/itens/mochila.png")}" alt="${escapeHtml(it.name)}" onerror="this.style.display='none'" />
            <div>
              <div class="bag-item__name">${escapeHtml(it.name)}</div>
              <div class="bag-item__sub">Qtd: ${Number(it.qty ?? 1)}</div>
            </div>
          </div>
        `
      )
      .join("");

    status.textContent = `${items.length} item(ns)`;
  }

  btn.addEventListener("click", open);
  closeBtn?.addEventListener("click", close);
  modal?.querySelector("[data-bag-modal-close]")?.addEventListener("click", close);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });
})();
