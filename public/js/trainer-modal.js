(() => {
  const $ = (id) => document.getElementById(id);

  const modal = $("trainerModal");
  const openBtn = $("btnCreateTrainer");
  const recreateBtn = $("btnRecreateTrainer");
  const closeBtn = $("trainerModalClose");
  // const backdrop foi removido acima.

  const starterGrid = $("starterGrid");
  const starterStatus = $("starterStatus");
  const teamList = $("pokeList");
  const teamHint = $("teamHint");

  // Reutiliza o modal de detalhes da Pokédex (mesmo layout/estilo)
  const detailsModal = $("pokedexDetailsModal");
  const detailsTitle = $("pokedexDetailsTitle");
  const detailsBody = $("pokedexDetailsBody");

  const body = document.body;
  const hasTrainer = body?.dataset?.hasTrainer === "1";
  const starterId = body?.dataset?.starter ? Number(body.dataset.starter) : null;

  const STARTERS = [25, 4, 7, 1];
  const TEAM_SIZE = 6;

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

  function typeEmoji(type) {
    const t = String(type || "").toLowerCase();
    if (t === "electric") return "⚡";
    if (t === "fire") return "🔥";
    if (t === "water") return "💧";
    if (t === "grass") return "🌿";
    if (t === "ice") return "❄️";
    if (t === "fighting") return "🥊";
    if (t === "poison") return "☠️";
    if (t === "ground") return "⛰️";
    if (t === "flying") return "🪽";
    if (t === "psychic") return "🔮";
    if (t === "bug") return "🐛";
    if (t === "rock") return "🪨";
    if (t === "ghost") return "👻";
    if (t === "dragon") return "🐉";
    if (t === "dark") return "🌙";
    if (t === "steel") return "⚙️";
    if (t === "fairy") return "✨";
    return "⚪";
  }

  function openModal() {
    if (!modal) return;
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    ensureStartersLoaded();
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
  }

  async function fetchPokemon(id) {
    const res = await fetch(`/api/pokedex/pokemon/${encodeURIComponent(String(id))}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || "failed");
    return data;
  }

  async function fetchTrainerState() {
    const res = await fetch("/api/trainer", {
      method: "GET",
      headers: { Accept: "application/json" },
    });
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

  function openDetailsModal() {
    if (!detailsModal) return;
    detailsModal.classList.add("is-open");
    detailsModal.setAttribute("aria-hidden", "false");
  }

  function closeDetailsModal() {
    if (!detailsModal) return;
    detailsModal.classList.remove("is-open");
    detailsModal.setAttribute("aria-hidden", "true");
  }

  // const FALLBACK_STARTERS = ... (removido, já está no HTML)

  let startersLoaded = true; // Já começa loaded pois está no HTML
  async function ensureStartersLoaded() {
    // No-op: Starters agora são estáticos no dashboard.ejs para garantir carregamento.
    if (starterStatus) starterStatus.innerText = "Escolha seu inicial.";
    return;
  }

  function clamp01(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return 0;
    return Math.max(0, Math.min(1, x));
  }

  let cachedParty = [];
  const cachedPokemonDetails = new Map();

  function renderTeamList(party) {
    if (!teamList) return;
    const list = Array.isArray(party) ? party : [];

    // Time é sempre uma vitrine fixa de 6 slots (teamSlot é 1-based).
    const slots = Array.from({ length: TEAM_SIZE }, (_, idx) => ({ slot: idx + 1, stored: null }));

    for (const stored of list) {
      const s = Number(stored?.teamSlot);
      if (Number.isFinite(s) && s >= 1 && s <= TEAM_SIZE) {
        if (!slots[s - 1].stored) slots[s - 1].stored = stored;
      }
    }

    teamList.innerHTML = slots
      .map(({ slot, stored }) => {
        if (!stored) {
          return `
            <li class="poke-slot poke-slot--empty" data-team-slot="${escapeHtml(slot)}" title="Slot ${escapeHtml(slot)} vazio">
              <span class="poke-slot__badge">⚪</span>
              <div class="poke-slot__name">Slot ${escapeHtml(slot)}</div>
              <div class="poke-slot__emptylabel">Vazio</div>
            </li>
          `;
        }

        const trainerPokemonId = Number(stored?.id);
        const pokemonId = Number(stored?.pokemonId);
        const p = cachedPokemonDetails.get(pokemonId) || null;

        const name = p?.name ? cap(p.name) : `#${pokemonId}`;
        const img = (p?.gif || p?.artwork) ? (p.gif || p.artwork) : "";

        const level = Number(stored?.level ?? 1);

        return `
          <li class="poke-slot poke-slot--filled poke-item" data-trainer-pokemon-id="${escapeHtml(trainerPokemonId)}" data-team-slot="${escapeHtml(slot)}" data-pokemon-id="${escapeHtml(pokemonId)}" title="Clique para ver detalhes">
            <span class="poke-slot__badge">
              ${img ? `<img src="${escapeHtml(img)}" alt="${escapeHtml(name)}" loading="lazy" onerror="this.style.display='none'">` : "⚪"}
            </span>
            <div class="poke-slot__name">${escapeHtml(name)}</div>
            <div class="poke-slot__sub">Lv ${Number.isFinite(level) ? level : 1}</div>
            <button class="btn btn--small btn--ghost" type="button" data-action="deposit" data-trainer-pokemon-id="${escapeHtml(trainerPokemonId)}" title="Enviar ao Professor Carvalho">Enviar</button>
          </li>
        `;
      })
      .join("");
  }

  function renderTeamPokemonDetails(p, stored) {
    if (!detailsBody || !detailsTitle) return;

    const pokemonId = Number(stored?.pokemonId ?? p?.id ?? 0);
    const name = p?.name ? cap(p.name) : `#${pokemonId}`;
    detailsTitle.textContent = `${escapeHtml(name)} (#${pokemonId})`;

    const art = p?.gif || p?.artwork || "";
    const types = (p?.types || []).map((t) => `<span class="pokedex-badge">${escapeHtml(t)}</span>`).join("");

    const maxHp = Number(stored?.maxHp ?? 0);
    const curHp = Number(stored?.currentHp ?? 0);
    const hpRatio = Number.isFinite(maxHp) && maxHp > 0 && Number.isFinite(curHp) ? clamp01(curHp / maxHp) : 0;
    const hpPct = Math.round(hpRatio * 100);
    const hpLow = hpRatio <= 0.25;

    const level = Number(stored?.level ?? 1);
    const xp = Number(stored?.xp ?? 0);
    const slot = stored?.teamSlot ?? "-";

    const moves = [stored?.move1, stored?.move2, stored?.move3, stored?.move4]
      .map((m) => String(m || "").trim())
      .filter(Boolean);
    const movesHtml = moves.length
      ? moves.map((m) => `<span class="pokedex-badge">${escapeHtml(m)}</span>`).join("")
      : `<span class="pokedex-details__sub">—</span>`;

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
          <div class="pokedex-details__stat">
            <div class="pokedex-details__statname">${escapeHtml(label)}</div>
            <div class="pokedex-details__statvalue">${escapeHtml(text)}</div>
          </div>
        `;
      })
      .join("");

    detailsBody.innerHTML = `
      <div class="pokedex-details__hero">
        ${art ? `<img class="pokedex-details__art" src="${escapeHtml(art)}" alt="${escapeHtml(name)}" onerror="this.style.display='none'">` : ""}
        <div class="pokedex-details__meta">
          <div class="pokedex-details__name">${escapeHtml(name)}</div>
          <div class="pokedex-details__sub">Slot ${escapeHtml(slot)} • Lv ${Number.isFinite(level) ? level : 1} • XP ${Number.isFinite(xp) ? xp : 0}</div>
          <div class="pokedex-details__list">${types}</div>
        </div>
      </div>

      <div class="hpbar" aria-label="Vida atual do Pokémon">
        <div class="hpbar__top">
          <span class="hpbar__label">HP</span>
          <span class="hpbar__value">${escapeHtml(`${curHp}/${maxHp}`)}</span>
        </div>
        <div class="hpbar__track">
          <div class="hpbar__fill ${hpLow ? "is-low" : ""}" style="width:${hpPct}%"></div>
        </div>
      </div>

      <div class="pokedex-details__section">
        <div class="pokedex-details__label">Ataques</div>
        <div class="pokedex-details__list">${movesHtml}</div>
      </div>

      <div class="pokedex-details__section">
        <div class="pokedex-details__label">Status (salvos no seu time)</div>
        <div class="pokedex-details__stats">${statsHtml}</div>
      </div>
    `;
  }

  async function loadTeamIfTrainer() {
    if (!hasTrainer || !starterId || !Number.isFinite(starterId)) return;
    if (!teamHint || !teamList) return;

    teamHint.textContent = "Carregando seu time...";

    try {
      const state = await fetchTrainerState();
      const party = Array.isArray(state?.party) ? state.party : [];

      cachedParty = party;

      const ids = Array.from(
        new Set(
          party
            .map((x) => Number(x?.pokemonId))
            .filter((n) => Number.isFinite(n) && n > 0)
        )
      );

      const details = await Promise.all(ids.map((id) => fetchPokemon(id).catch(() => null)));
      cachedPokemonDetails.clear();
      for (const p of details) {
        if (p && Number.isFinite(Number(p.id))) cachedPokemonDetails.set(Number(p.id), p);
      }

      renderTeamList(party);
      teamHint.textContent = party.length ? "Clique em um Pokémon para ver detalhes." : "Seu time está vazio.";
    } catch {
      try {
        const p = await fetchPokemon(starterId);
        cachedParty = [{ pokemonId: starterId, level: 1, xp: 0, maxHp: 0, currentHp: 0, teamSlot: 1 }];
        cachedPokemonDetails.clear();
        cachedPokemonDetails.set(Number(p.id), p);
        renderTeamList(cachedParty);
        teamHint.textContent = "Clique no Pokémon para ver detalhes.";
      } catch {
        teamHint.textContent = "Não foi possível carregar o Pokémon inicial.";
      }
    }
  }

  async function depositToOak(trainerPokemonId) {
    await postJson("/api/pokemon/deposit", { trainerPokemonId });
    await loadTeamIfTrainer();
    window.dispatchEvent(new CustomEvent("trainer:updated"));
  }

  teamList?.addEventListener("click", async (e) => {
    const target = e.target;

    const depositBtn = target && target.closest ? target.closest("[data-action='deposit']") : null;
    if (depositBtn) {
      e.preventDefault();
      e.stopPropagation();
      const tpid = Number(depositBtn.getAttribute("data-trainer-pokemon-id"));
      if (!Number.isFinite(tpid)) return;

      try {
        await depositToOak(tpid);
      } catch {
        // silêncio (MVP)
      }
      return;
    }

    const item = target && target.closest ? target.closest(".poke-item") : null;
    if (!item) return;

    const pokemonId = Number(item.getAttribute("data-pokemon-id"));
    const teamSlot = item.getAttribute("data-team-slot");
    const stored = cachedParty.find((x) => String(x?.teamSlot ?? "") === String(teamSlot)) || cachedParty.find((x) => Number(x?.pokemonId) === pokemonId) || null;

    if (!detailsBody || !detailsTitle) return;
    detailsTitle.textContent = "Carregando…";
    detailsBody.innerHTML = `<div class="pokedex-details__sub">Buscando dados do Pokémon…</div>`;
    openDetailsModal();

    try {
      const p = cachedPokemonDetails.get(pokemonId) || (await fetchPokemon(pokemonId));
      cachedPokemonDetails.set(pokemonId, p);
      renderTeamPokemonDetails(p, stored);
    } catch {
      detailsBody.innerHTML = `<div class="pokedex-details__sub">Não foi possível carregar os detalhes.</div>`;
    }
  });

  // Sincroniza com outros modais (ex.: Carvalho) quando ocorrer movimentação
  window.addEventListener("trainer:updated", () => {
    void loadTeamIfTrainer();
  });

  // Bind modal events
  openBtn?.addEventListener("click", openModal);
  recreateBtn?.addEventListener("click", openModal);
  closeBtn?.addEventListener("click", closeModal);

  // Bind close buttons (backdrop e botoes internos)
  if (modal) {
    const closeTriggers = modal.querySelectorAll("[data-trainer-modal-close]");
    closeTriggers.forEach(btn => btn.addEventListener("click", closeModal));
  }
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });

  // ESC fecha o modal de detalhes também (se aberto)
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && detailsModal?.classList.contains("is-open")) closeDetailsModal();
  });

  // Se veio com erro de criação, abre o modal automaticamente
  if (body?.dataset?.trainerModalOpen === "1") {
    openModal();
  } else if (hasTrainer) {
    // Se já tem treinador e não tem erro, garante fechado (preventiva contra bugs visuais)
    if (modal) {
      modal.classList.remove("is-open");
      modal.setAttribute("aria-hidden", "true");
    }
  }

  // Render do time
  loadTeamIfTrainer();
})();
