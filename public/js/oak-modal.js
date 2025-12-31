(() => {
  const $ = (id) => document.getElementById(id);

  const btn = $("btnOak");
  const modal = $("oakModal");
  const closeBtn = $("oakModalClose");
  const listEl = $("oakList");
  const status = $("oakStatus");

  // Reusa modal de detalhes da Pokédex (dashboard)
  const detailsModal = $("pokedexDetailsModal");
  const detailsTitle = $("pokedexDetailsTitle");
  const detailsBody = $("pokedexDetailsBody");

  if (!btn || !modal || !listEl || !status) return;

  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function cap(s) {
    const str = String(s || "");
    return str ? str.slice(0, 1).toUpperCase() + str.slice(1) : str;
  }

  function clamp01(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return 0;
    return Math.max(0, Math.min(1, x));
  }

  function open() {
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    void load();
  }

  function close() {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
  }

  function openDetailsModal() {
    if (!detailsModal) return;
    detailsModal.classList.add("is-open");
    detailsModal.setAttribute("aria-hidden", "false");
  }

  async function fetchTrainerState() {
    const res = await fetch("/api/trainer", { method: "GET", headers: { Accept: "application/json" } });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || "failed");
    return data;
  }

  async function fetchPokemon(id) {
    const res = await fetch(`/api/pokedex/pokemon/${encodeURIComponent(String(id))}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || "failed");
    return data;
  }

  async function postJson(url, bodyObj) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(bodyObj || {}),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data?.error || "failed"), { status: res.status, data });
    return data;
  }

  function renderDetails(p, stored) {
    if (!detailsTitle || !detailsBody) return;

    const pokemonId = Number(stored?.pokemonId ?? p?.id ?? 0);
    const name = p?.name ? cap(p.name) : `#${pokemonId}`;

    detailsTitle.textContent = `${escapeHtml(name)} (#${pokemonId})`;

    const art = p?.gif || p?.artwork || "";
    const types = (p?.types || []).map((t) => `<span class=\"pokedex-badge\">${escapeHtml(t)}</span>`).join("");

    const maxHp = Number(stored?.maxHp ?? 0);
    const curHp = Number(stored?.currentHp ?? 0);
    const hpRatio = Number.isFinite(maxHp) && maxHp > 0 && Number.isFinite(curHp) ? clamp01(curHp / maxHp) : 0;
    const hpPct = Math.round(hpRatio * 100);
    const hpLow = hpRatio <= 0.25;

    const level = Number(stored?.level ?? 1);
    const xp = Number(stored?.xp ?? 0);

    const moves = [stored?.move1, stored?.move2, stored?.move3, stored?.move4]
      .map((m) => String(m || "").trim())
      .filter(Boolean);

    const movesHtml = moves.length
      ? moves.map((m) => `<span class=\"pokedex-badge\">${escapeHtml(m)}</span>`).join("")
      : `<span class=\"pokedex-details__sub\">—</span>`;

    const statsHtml = [
      ["HP", `${curHp}/${maxHp}`],
      ["Atk", stored?.attack],
      ["Def", stored?.defense],
      ["Sp. Atk", stored?.spAttack],
      ["Sp. Def", stored?.spDefense],
      ["Speed", stored?.speed],
    ]
      .map(([label, value]) => {
        const v = Number(value);
        const text = label === "HP" ? String(value) : (Number.isFinite(v) ? String(v) : "-");
        return `
          <div class=\"pokedex-details__stat\">
            <div class=\"pokedex-details__statname\">${escapeHtml(label)}</div>
            <div class=\"pokedex-details__statvalue\">${escapeHtml(text)}</div>
          </div>
        `;
      })
      .join("");

    detailsBody.innerHTML = `
      <div class=\"pokedex-details__hero\">
        ${art ? `<img class=\"pokedex-details__art\" src=\"${escapeHtml(art)}\" alt=\"${escapeHtml(name)}\" onerror=\"this.style.display='none'\">` : ""}
        <div class=\"pokedex-details__meta\">
          <div class=\"pokedex-details__name\">${escapeHtml(name)}</div>
          <div class=\"pokedex-details__sub\">Professor Carvalho • Lv ${Number.isFinite(level) ? level : 1} • XP ${Number.isFinite(xp) ? xp : 0}</div>
          <div class=\"pokedex-details__list\">${types}</div>
        </div>
      </div>

      <div class=\"hpbar\" aria-label=\"Vida atual do Pokémon\">
        <div class=\"hpbar__top\">
          <span class=\"hpbar__label\">HP</span>
          <span class=\"hpbar__value\">${escapeHtml(`${curHp}/${maxHp}`)}</span>
        </div>
        <div class=\"hpbar__track\">
          <div class=\"hpbar__fill ${hpLow ? "is-low" : ""}\" style=\"width:${hpPct}%\"></div>
        </div>
      </div>

      <div class=\"pokedex-details__section\">
        <div class=\"pokedex-details__label\">Ataques</div>
        <div class=\"pokedex-details__list\">${movesHtml}</div>
      </div>

      <div class=\"pokedex-details__section\">
        <div class=\"pokedex-details__label\">Status (salvos no professor)</div>
        <div class=\"pokedex-details__stats\">${statsHtml}</div>
      </div>
    `;
  }

  let cachedOak = [];
  let cachedParty = [];
  const cachedPokemonDetails = new Map();

  function renderList() {
    if (!cachedOak.length) {
      listEl.innerHTML = `
        <div class=\"bag-item\" style=\"grid-column: 1 / -1; justify-content:space-between;\">
          <div>
            <div class=\"bag-item__name\">Vazio</div>
            <div class=\"bag-item__sub\">Você não deixou nenhum Pokémon com o Professor Carvalho.</div>
          </div>
          <img class=\"bag-item__icon\" src=\"/assets/itens/pasta.png\" alt=\"Professor Carvalho\" />
        </div>
      `;
      status.textContent = "0 Pokémon";
      return;
    }

    listEl.innerHTML = cachedOak
      .map((stored) => {
        const trainerPokemonId = Number(stored?.id);
        const pokemonId = Number(stored?.pokemonId);
        const p = cachedPokemonDetails.get(pokemonId) || null;

        const name = p?.name ? cap(p.name) : `#${pokemonId}`;
        const img = (p?.gif || p?.artwork) ? (p.gif || p.artwork) : "";

        const maxHp = Number(stored?.maxHp ?? 0);
        const curHp = Number(stored?.currentHp ?? 0);
        const hpRatio = Number.isFinite(maxHp) && maxHp > 0 && Number.isFinite(curHp) ? clamp01(curHp / maxHp) : 0;
        const widthPct = Math.round(hpRatio * 100);
        const low = hpRatio <= 0.25;

        const level = Number(stored?.level ?? 1);

        return `
          <div class=\"bag-item\" data-trainer-pokemon-id=\"${escapeHtml(trainerPokemonId)}\" data-pokemon-id=\"${escapeHtml(pokemonId)}\" style=\"cursor:pointer;\" title=\"Clique para ver detalhes\">
            <img class=\"bag-item__icon\" src=\"${escapeHtml(img || "/assets/itens/pasta.png")}\" alt=\"${escapeHtml(name)}\" onerror=\"this.style.display='none'\" />
            <div style=\"flex:1; min-width:0;\">
              <div class=\"bag-item__name\">${escapeHtml(name)}</div>
              <div class=\"bag-item__sub\">Lv ${Number.isFinite(level) ? level : 1} • HP ${escapeHtml(`${curHp}/${maxHp}`)}</div>
              <div class=\"hpbar hpbar--compact\" aria-label=\"Vida atual\" style=\"margin-top:6px;\">
                <div class=\"hpbar__track\">
                  <div class=\"hpbar__fill ${low ? "is-low" : ""}\" style=\"width:${widthPct}%\"></div>
                </div>
              </div>
            </div>
            <div style=\"display:flex; align-items:center;\">
              <button class=\"btn btn--small btn--ghost\" type=\"button\" data-action=\"withdraw\" data-trainer-pokemon-id=\"${escapeHtml(trainerPokemonId)}\" title=\"Pegar do Professor\">Pegar</button>
            </div>
          </div>
        `;
      })
      .join("");

    status.textContent = `${cachedOak.length} Pokémon`;
  }

  async function load() {
    status.textContent = "Carregando…";
    listEl.innerHTML = "";

    try {
      const state = await fetchTrainerState();
      const oak = Array.isArray(state?.oak) ? state.oak : [];
      const party = Array.isArray(state?.party) ? state.party : [];

      cachedOak = oak;
      cachedParty = party;

      const ids = Array.from(
        new Set(
          oak
            .map((x) => Number(x?.pokemonId))
            .filter((n) => Number.isFinite(n) && n > 0)
        )
      );

      const details = await Promise.all(ids.map((id) => fetchPokemon(id).catch(() => null)));
      cachedPokemonDetails.clear();
      for (const p of details) {
        if (p && Number.isFinite(Number(p.id))) cachedPokemonDetails.set(Number(p.id), p);
      }

      renderList();
    } catch {
      status.textContent = "Falha ao carregar.";
      listEl.innerHTML = "";
    }
  }

  async function withdrawFromOak(trainerPokemonId) {
    const partyCount = Array.isArray(cachedParty) ? cachedParty.length : 0;

    if (partyCount < 6) {
      await postJson("/api/pokemon/withdraw", { trainerPokemonId });
      await load();
      window.dispatchEvent(new CustomEvent("trainer:updated"));
      return;
    }

    const slotStr = window.prompt("Seu time está cheio (6). Digite o número do slot (1-6) para trocar:");
    const slot = Number(slotStr);
    if (!Number.isFinite(slot) || slot < 1 || slot > 6) return;

    const swap = cachedParty.find((p) => Number(p?.teamSlot) === slot) || null;
    const swapId = Number(swap?.id);
    if (!Number.isFinite(swapId)) {
      window.alert("Slot inválido. Escolha um slot com Pokémon no time.");
      return;
    }

    await postJson("/api/pokemon/withdraw", { trainerPokemonId, swapWithTrainerPokemonId: swapId });
    await load();
    window.dispatchEvent(new CustomEvent("trainer:updated"));
  }

  btn.addEventListener("click", open);
  closeBtn?.addEventListener("click", close);
  modal?.querySelector("[data-oak-modal-close]")?.addEventListener("click", close);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });

  listEl.addEventListener("click", async (e) => {
    const target = e.target;

    const withdrawBtn = target && target.closest ? target.closest("[data-action='withdraw']") : null;
    if (withdrawBtn) {
      e.preventDefault();
      e.stopPropagation();
      const tpid = Number(withdrawBtn.getAttribute("data-trainer-pokemon-id"));
      if (!Number.isFinite(tpid)) return;
      try {
        await withdrawFromOak(tpid);
      } catch {
        // silêncio (MVP)
      }
      return;
    }

    const row = target && target.closest ? target.closest("[data-trainer-pokemon-id]") : null;
    if (!row) return;

    const trainerPokemonId = Number(row.getAttribute("data-trainer-pokemon-id"));
    const pokemonId = Number(row.getAttribute("data-pokemon-id"));
    if (!Number.isFinite(pokemonId)) return;

    const stored =
      cachedOak.find((x) => Number(x?.id) === trainerPokemonId) ||
      cachedOak.find((x) => Number(x?.pokemonId) === pokemonId) ||
      null;
    if (!detailsTitle || !detailsBody) return;

    detailsTitle.textContent = "Carregando…";
    detailsBody.innerHTML = `<div class=\"pokedex-details__sub\">Buscando dados do Pokémon…</div>`;
    openDetailsModal();

    try {
      const p = cachedPokemonDetails.get(pokemonId) || (await fetchPokemon(pokemonId));
      cachedPokemonDetails.set(pokemonId, p);
      renderDetails(p, stored);
    } catch {
      detailsBody.innerHTML = `<div class=\"pokedex-details__sub\">Não foi possível carregar os detalhes.</div>`;
    }
  });

  window.addEventListener("trainer:updated", () => {
    if (modal?.classList.contains("is-open")) void load();
  });
})();
