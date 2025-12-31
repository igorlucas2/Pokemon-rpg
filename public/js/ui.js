(function () {
  const $ = (id) => document.getElementById(id);

  function initUI() {
    console.log("🚀 UI.js Initializing...");
    const settingsWidget = $("settingsWidget");
    const btnSettings = $("btnSettings");
    const btnCloseSettings = $("btnCloseSettings");
    const btnFullScreen = $("btnFullScreen");
    const btnCenter = $("btnCenter");
    const btnHelp = $("btnHelp");

    const btnToggleLeftPanel = $("btnToggleLeftPanel");
    const btnToggleRightPanel = $("btnToggleRightPanel");

    console.log("UI Buttons found:", {
      left: !!btnToggleLeftPanel,
      right: !!btnToggleRightPanel,
      settings: !!btnSettings
    });

    const mapStage = $("mapStage");
    const mapImg = $("mapImg");
    const gameCanvas = $("game");
    const coordsText = $("coordsText");
    const logBox = $("logBox");

    // Widget Toggles
    document.addEventListener("click", (e) => {
      const toggleBtn = e.target.closest(".widget-toggle");
      if (toggleBtn) {
        const widget = toggleBtn.closest(".widget");
        if (widget) {
          widget.classList.toggle("widget--collapsed");
          const isCollapsed = widget.classList.contains("widget--collapsed");
          // Opcional: Salvar estado no localStorage
          const id = widget.id;
          if (id) {
            localStorage.setItem(`widget_collapsed_${id}`, isCollapsed);
          }
        }
      }
    });

    // Restaurar estado dos widgets ao carregar
    ["trainerWidget", "teamWidget", "nearbyWidget"].forEach(id => {
      const isCollapsed = localStorage.getItem(`widget_collapsed_${id}`) === "true";
      const el = document.getElementById(id);
      if (el && isCollapsed) {
        el.classList.add("widget--collapsed");
      }
    });

    // Modal de eventos
    const eventsModal = $("eventsModal");
    const eventsModalClose = $("eventsModalClose");
    const eventsModalSubtitle = $("eventsModalSubtitle");
    const eventsModalBody = $("eventsModalBody");

    // Mobile panels
    const panelTrainer = $("panelTrainer");
    const panelTeam = $("panelTeam");
    const panelSettings = $("panelSettings");

    const mobileTrainerClone = $("mobileTrainerClone");
    const mobileTeamClone = $("mobileTeamClone");
    const mobileSettingsClone = $("mobileSettingsClone");

    // Clonar widgets para mobile (quando necessário)
    function cloneForMobile() {
      const widgets = document.querySelectorAll(".side.left .widget, .side.right .widget");
      const trainerWidget = widgets[0];
      const teamWidget = widgets[1];
      const settings = document.querySelector(".side.right #settingsWidget");

      if (trainerWidget && mobileTrainerClone.children.length === 0) {
        mobileTrainerClone.appendChild(trainerWidget.cloneNode(true));
      }
      if (teamWidget && mobileTeamClone.children.length === 0) {
        mobileTeamClone.appendChild(teamWidget.cloneNode(true));
      }
      if (settings && mobileSettingsClone.children.length === 0) {
        mobileSettingsClone.appendChild(settings.cloneNode(true));
      }
    }

    function openPanel(panel) {
      [panelTrainer, panelTeam, panelSettings].forEach(p => p.classList.remove("is-open"));
      panel.classList.add("is-open");
    }

    function closePanels() {
      [panelTrainer, panelTeam, panelSettings].forEach(p => p.classList.remove("is-open"));
    }

    // ===== Dashboard sidebars (desktop) =====
    function isDashboard() {
      return document.body?.classList?.contains("page-dashboard");
    }

    function notifyMapLayoutChanged() {
      // map-player.js recalcula overlays/tokens no resize
      requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
    }

    function toggleDashLeft() {
      if (!isDashboard()) return;
      document.body.classList.toggle("dash-left-open");
      notifyMapLayoutChanged();
    }

    function toggleDashRight() {
      if (!isDashboard()) return;
      document.body.classList.toggle("dash-right-open");
      notifyMapLayoutChanged();
    }

    function openDashRight() {
      if (!isDashboard()) return;
      document.body.classList.add("dash-right-open");
      notifyMapLayoutChanged();
    }

    function closeDashRight() {
      if (!isDashboard()) return;
      document.body.classList.remove("dash-right-open");
      notifyMapLayoutChanged();
    }

    btnToggleLeftPanel?.addEventListener("click", toggleDashLeft);
    btnToggleRightPanel?.addEventListener("click", toggleDashRight);

    // Mobile nav
    document.querySelectorAll(".mobile-nav__btn").forEach(btn => {
      btn.addEventListener("click", () => {
        cloneForMobile();
        const type = btn.getAttribute("data-panel");
        if (type === "trainer") openPanel(panelTrainer);
        if (type === "team") openPanel(panelTeam);
        if (type === "settings") openPanel(panelSettings);
      });
    });

    document.querySelectorAll("[data-close-panel]").forEach(btn => {
      btn.addEventListener("click", closePanels);
    });

    // Settings widget toggle (desktop)
    btnSettings?.addEventListener("click", () => {
      openDashRight();
      log("⚙️ Configurações abertas.");
    });
    btnCloseSettings?.addEventListener("click", () => {
      closeDashRight();
      log("⚙️ Configurações fechadas.");
    });

    // Fullscreen
    btnFullScreen?.addEventListener("click", async () => {
      try {
        if (!document.fullscreenElement) {
          await document.documentElement.requestFullscreen();
          log("⛶ Tela cheia ativada.");
        } else {
          await document.exitFullscreen();
          log("⛶ Tela cheia desativada.");
        }
      } catch {
        log("⚠️ Não foi possível ativar tela cheia.");
      }
    });

    // Centralizar (simples: dá scroll/ajuste no futuro)
    btnCenter?.addEventListener("click", () => {
      if (window.Game?.getPlayerState) {
        log("?? C?mera segue o jogador automaticamente.");
        return;
      }
      mapStage?.scrollIntoView({ behavior: "smooth", block: "center" });
      log("?? Centralizado.");
    });

    btnHelp?.addEventListener("click", () => {
      log("?? Ajuda: Mover com WASD/setas. Interagir: Z/Espa?o. Menu: Enter/M.");
    });

    // Coordenadas ao mover mouse (normalizadas 0-1)
    mapStage?.addEventListener("mousemove", (e) => {
      if (!coordsText) return;

      if (mapImg) {
        const rect = mapImg.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;

        if (x >= 0 && x <= 1 && y >= 0 && y <= 1) {
          coordsText.textContent = `${x.toFixed(3)}, ${y.toFixed(3)}`;
        } else {
          coordsText.textContent = "-";
        }
        return;
      }

      if (!gameCanvas || typeof window.Game?.getViewState !== "function") {
        coordsText.textContent = "-";
        return;
      }

      const rect = gameCanvas.getBoundingClientRect();
      const view = window.Game.getViewState();
      if (!view || rect.width <= 0 || rect.height <= 0) {
        coordsText.textContent = "-";
        return;
      }

      const inX = e.clientX - rect.left;
      const inY = e.clientY - rect.top;
      if (inX < 0 || inY < 0 || inX > rect.width || inY > rect.height) {
        coordsText.textContent = "-";
        return;
      }

      const scaleX = rect.width / gameCanvas.width;
      const scaleY = rect.height / gameCanvas.height;
      const internalX = inX / (scaleX || 1);
      const internalY = inY / (scaleY || 1);
      const worldX = internalX / view.scale;
      const worldY = internalY / view.scale;
      const tileX = Math.floor((view.cameraX + worldX) / view.tileSize);
      const tileY = Math.floor((view.cameraY + worldY) / view.tileSize);
      coordsText.textContent = `${tileX}, ${tileY}`;
    });

    // Log
    function log(message) {
      if (!logBox) return;
      const line = document.createElement("div");
      line.className = "line";
      const time = new Date().toLocaleTimeString();
      line.innerHTML = `<span class="time">${time}</span>${message}`;
      logBox.prepend(line);
    }

    async function useEvent(ev, options) {
      if (!ev || !ev.id) {
        log("?? Evento inv?lido.");
        return null;
      }

      const body = { eventId: ev.id };
      if (options?.mapId) body.mapId = options.mapId;

      try {
        const r = await fetch("/api/event/use", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await r.json();
        if (!r.ok || !data?.ok) throw new Error(data?.error || "failed");

        if (data.kind === "pokecenter") {
          log(`?? Centro Pok?mon: time curado (${Number(data.healedCount ?? 0)}).`);
          window.dispatchEvent(new Event("trainer:updated"));
        }

        if (data.kind === "pokemon_hunt") {
          const enc = data.encounter || {};
          const lvl = Number(enc.level ?? 1);
          const rarity = String(enc.rarity || "common");
          log(`?? Ca?ar Pok?mon: apareceu um Pok?mon (n?vel ${lvl}, ${rarity}).`);

          window.EncounterModal?.open?.(enc, { event: data.event });
        }

        if (data.kind === "battle") {
          const enemy = data.enemy || {};
          const before = data.before || {};
          const after = data.after || {};
          const xpGain = Number(data.xpGain ?? 0);
          const result = String(data.result || "");

          const enemyName = enemy?.name ? String(enemy.name) : "Pok?mon";
          log(`?? Batalha: ${result === "win" ? "vit?ria" : "derrota"} contra ${enemyName} (Lv ${Number(enemy.level ?? "?")}).`);
          if (xpGain) log(`? XP ganho: +${xpGain}.`);
          if (Number(after.level ?? 0) > Number(before.level ?? 0)) {
            log(`?? Level up! ${Number(before.level ?? 1)} ? ${Number(after.level ?? 1)}.`);
          }

          const learned = Array.isArray(data.learned) ? data.learned : [];
          for (const it of learned) {
            if (it?.move) {
              if (it?.replaced) log(`?? Novo golpe: ${it.move} (substituiu ${it.replaced}).`);
              else log(`?? Novo golpe: ${it.move}.`);
            }
          }

          const lines = Array.isArray(data.log) ? data.log : [];
          for (const line of lines.slice(0, 12)) {
            log(`? ${String(line)}`);
          }

          window.dispatchEvent(new Event("trainer:updated"));

          if (enemy?.pokemonId) {
            window.PokedexModal?.openPokemonDetailsById?.(enemy.pokemonId, {
              subtitle: `Batalha ? Lv ${Number(enemy.level ?? 1)}`,
            });
          }
        }

        return data;
      } catch {
        log("?? N?o foi poss?vel usar este evento.");
        return null;
      }
    }

    function eventLabel(ev) {
      const t = ev?.eventType;
      if (t === "pokemon_encounter") return "Encontro Pokémon";
      if (t === "pokemon_hunt") return "Caçar Pokémon";
      if (t === "gym") return "Ginásio";
      if (t === "shop") return "Loja";
      if (t === "pokecenter") return "Centro Pokémon";
      if (t === "house") return "Casa";
      if (t === "battle") return "Batalha";
      if (t === "npc") return "NPC";
      if (t === "item") return "Item";
      if (t === "quest") return "Quest";
      return t || "Evento";
    }

    function groupEvents(region, events) {
      const regionType = region?.type || "route";
      const groups = new Map();

      // Heurística simples: você pode evoluir depois com um campo payload.kind
      for (const ev of events) {
        const label = eventLabel(ev);
        const key = label;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(ev);
      }

      // Ordenação: para cidade, tenta priorizar serviços; para rota, encontro/casa primeiro
      const preferred =
        regionType === "city"
          ? ["Centro Pokémon", "Loja", "Ginásio"]
          : ["Encontro Pokémon", "Casa"];

      const keys = Array.from(groups.keys());
      keys.sort((a, b) => {
        const ia = preferred.indexOf(a);
        const ib = preferred.indexOf(b);
        if (ia === -1 && ib === -1) return a.localeCompare(b);
        if (ia === -1) return 1;
        if (ib === -1) return -1;
        return ia - ib;
      });

      return { keys, groups };
    }

    function openEventsModal(region, events) {
      if (!eventsModal || !eventsModalBody || !eventsModalSubtitle) return;

      const regionName = region?.name || "Região";
      const regionType = region?.type || "route";

      eventsModalSubtitle.textContent =
        regionType === "city"
          ? `Cidade: ${regionName}`
          : regionType === "dungeon"
            ? `Dungeon: ${regionName}`
            : `Rota: ${regionName}`;

      eventsModalBody.innerHTML = "";

      if (!events || events.length === 0) {
        const p = document.createElement("div");
        p.className = "hint";
        p.textContent = "Nenhum evento ativo nesta região.";
        eventsModalBody.appendChild(p);
      } else {
        const { keys, groups } = groupEvents(region, events);
        for (const key of keys) {
          const box = document.createElement("div");
          box.className = "stat";

          const title = document.createElement("div");
          title.className = "stat__label";
          title.textContent = key;

          const ul = document.createElement("ul");
          ul.style.margin = "8px 0 0";
          ul.style.paddingLeft = "18px";

          for (const ev of groups.get(key)) {
            const li = document.createElement("li");
            const name = ev?.name || key;

            const payload = ev?.payload || {};

            const icon =
              (payload && typeof payload === "object" && typeof payload.icon === "string" ? payload.icon : null) ||
              (ev?.eventType === "pokemon_hunt" ? "/assets/itens/pokebola.png" : null) ||
              (ev?.eventType === "pokecenter" ? "/assets/edificios/pokecenter.png" : null);

            const isActionable =
              ev?.eventType === "pokecenter" ||
              ev?.eventType === "pokemon_hunt" ||
              ev?.eventType === "battle";
            const row = document.createElement("div");
            row.style.display = "flex";
            row.style.alignItems = "center";
            row.style.justifyContent = "space-between";
            row.style.gap = "10px";

            const left = document.createElement("div");
            left.style.flex = "1";
            left.style.display = "flex";
            left.style.alignItems = "flex-start";
            left.style.gap = "10px";

            const right = document.createElement("div");

            const iconWrap = document.createElement("div");
            iconWrap.style.width = "72px";
            iconWrap.style.height = "72px";
            iconWrap.style.flex = "0 0 72px";

            if (icon) {
              const img = document.createElement("img");
              img.src = icon;
              img.alt = "";
              img.width = 72;
              img.height = 72;
              img.style.objectFit = "contain";
              img.onerror = () => {
                img.style.display = "none";
              };
              iconWrap.appendChild(img);
            }

            const textWrap = document.createElement("div");
            textWrap.style.minWidth = "0";

            const title = document.createElement("div");
            title.textContent = name;
            textWrap.appendChild(title);

            const sub = document.createElement("div");
            sub.className = "mini";
            sub.style.marginTop = "4px";

            if (ev?.eventType === "pokemon_encounter") {
              const enc = payload.encounter || {};
              const mons = Array.isArray(enc.pokemon) ? enc.pokemon : [];
              const chances = Array.isArray(enc.chances) ? enc.chances : null;
              const rate = typeof enc.encounterRate === "number" ? enc.encounterRate : null;

              let detail = "";
              if (mons.length) {
                if (chances && chances.length === mons.length) {
                  detail = mons.map((m, i) => `${m} (${chances[i]}%)`).join(", ");
                } else {
                  detail = mons.join(", ");
                }
              }
              if (rate != null) {
                detail = detail ? `${detail} • taxa: ${rate}%` : `taxa: ${rate}%`;
              }
              sub.textContent = detail || "—";
            } else if (ev?.eventType === "pokemon_hunt") {
              const pool =
                (Array.isArray(payload?.hunt?.pool) ? payload.hunt.pool : null) ||
                (Array.isArray(payload?.encounter?.pool) ? payload.encounter.pool : []) ||
                [];
              sub.textContent = pool.length ? `Pool: ${pool.length} Pokémon` : "Pool vazio";
            } else if (ev?.eventType === "pokecenter") {
              sub.textContent = "Cura todo o seu time.";
            } else if (ev?.eventType === "battle") {
              const b = payload.battle || {};
              const t = b.trainer || {};
              const win = typeof b.moneyWin === "number" ? b.moneyWin : null;
              const lose = typeof b.moneyLose === "number" ? b.moneyLose : null;
              const parts = [];
              if (t?.name) parts.push(t.name);
              if (win != null) parts.push(`vence: +${win}`);
              if (lose != null) parts.push(`perde: -${lose}`);
              sub.textContent = parts.length ? parts.join(" • ") : "—";
            } else if (ev?.eventType === "gym") {
              const badge = payload?.gym?.badge;
              sub.textContent = badge ? `Insígnia: ${badge}` : "—";
            } else if (ev?.eventType === "house") {
              const items = payload?.house?.items;
              if (Array.isArray(items) && items.length) sub.textContent = `Itens: ${items.join(", ")}`;
              else sub.textContent = "—";
            } else {
              sub.textContent = "—";
            }

            textWrap.appendChild(sub);

            left.appendChild(iconWrap);
            left.appendChild(textWrap);

            if (isActionable) {
              const btn = document.createElement("button");
              btn.className = "btn btn--small";
              btn.type = "button";
              btn.textContent = "Usar";
              btn.addEventListener("click", async () => {
                btn.disabled = true;
                const old = btn.textContent;
                btn.textContent = "...";
                try {
                  await useEvent(ev);
                } finally {
                  btn.disabled = false;
                  btn.textContent = old;
                }
              });
              right.appendChild(btn);
            }

            row.appendChild(left);
            row.appendChild(right);
            li.appendChild(row);

            ul.appendChild(li);
          }

          box.appendChild(title);
          box.appendChild(ul);
          eventsModalBody.appendChild(box);
        }
      }

      eventsModal.classList.add("is-open");
      eventsModal.setAttribute("aria-hidden", "false");
    }

    function closeEventsModal() {
      if (!eventsModal) return;
      eventsModal.classList.remove("is-open");
      eventsModal.setAttribute("aria-hidden", "true");
    }

    // Fechar modal
    eventsModalClose?.addEventListener("click", closeEventsModal);
    eventsModal?.querySelector("[data-events-modal-close]")?.addEventListener("click", closeEventsModal);
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeEventsModal();
        closeDashRight();
        if (isDashboard()) {
          document.body.classList.remove("dash-left-open");
          notifyMapLayoutChanged();
        }
      }
    });

    // Expor para outros scripts
    window.UI = { log, cloneForMobile, closePanels, openEventsModal, closeEventsModal, useEvent };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initUI);
  } else {
    initUI();
  }
})();
