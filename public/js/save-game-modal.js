(() => {
  const $ = (id) => document.getElementById(id);

  const modal = $("saveGameModal");
  const closeBtn = $("saveGameModalClose");
  const cancelBtn = $("saveGameCancelBtn");
  const saveBtn = $("saveGameBtn");
  const status = $("saveGameStatus");
  const mapEl = $("saveCurrentMap");
  const playTimeEl = $("savePlayTime");
  const pokemonCountEl = $("savePokemonCount");

  if (!modal || !closeBtn || !cancelBtn || !saveBtn || !status) {
    console.warn("SaveGameModal: elementos necessários não encontrados");
    return;
  }

  // Expõe a API global
  window.SaveGameModal = {
    open,
    close,
    createAutoCheckpoint,
  };

  // Limpa mensagem de status
  function clearStatus() {
    if (status) {
      status.textContent = "—";
      status.style.color = "";
    }
  }

  // Define mensagem de status
  function setStatus(message, isError = false) {
    if (status) {
      status.textContent = message;
      status.style.color = isError ? "var(--color-error, red)" : "var(--color-success, green)";
    }
  }

  // Abre o modal
  function open() {
    if (!modal) return;

    modal.classList.add("is-open");
    const ariaHidden = modal.getAttribute("aria-hidden");
    if (ariaHidden === "true") {
      modal.removeAttribute("aria-hidden");
      requestAnimationFrame(() => {
        modal.setAttribute("aria-hidden", "false");
      });
    } else {
      modal.setAttribute("aria-hidden", "false");
    }

    clearStatus();
    loadGameInfo();

    // Pausa o jogo
    if (window.GAME?.setPaused) {
      window.GAME.setPaused(true);
    }

    console.log("💾 Modal de Save aberto");
  }

  // Fecha o modal
  function close() {
    if (!modal) return;

    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");

    // Despausa o jogo
    if (window.GAME?.setPaused) {
      window.GAME.setPaused(false);
    }

    console.log("💾 Modal de Save fechado");
  }

  // Carrega informações do jogo para exibir no modal
  async function loadGameInfo() {
    try {
      // Busca dados do treinador
      const res = await fetch("/api/trainer", {
        method: "GET",
        headers: { Accept: "application/json" },
      });

      if (!res.ok) {
        throw new Error("Erro ao carregar dados do treinador");
      }

      const data = await res.json();

      // Atualiza informações no modal
      if (mapEl) {
        const mapName = window.GAME?.activeMapId || "Desconhecido";
        mapEl.textContent = formatMapName(mapName);
      }

      if (playTimeEl) {
        const playTime = data.playTime || 0;
        playTimeEl.textContent = formatPlayTime(playTime);
      }

      if (pokemonCountEl) {
        const count = data.pokemonCount || 0;
        pokemonCountEl.textContent = `${count}/6`;
      }
    } catch (err) {
      console.error("Erro ao carregar info do jogo:", err);
      if (mapEl) mapEl.textContent = "—";
      if (playTimeEl) playTimeEl.textContent = "—";
      if (pokemonCountEl) pokemonCountEl.textContent = "—";
    }
  }

  // Formata nome do mapa (remove underscores e capitaliza)
  function formatMapName(mapId) {
    return mapId
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  // Formata tempo de jogo (segundos para hh:mm:ss)
  function formatPlayTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }

  // Cria checkpoint automático (para recuperação de crashes)
  async function createAutoCheckpoint(state = "idle") {
    try {
      const gameState = {
        mapId: window.GAME?.activeMapId || null,
        position: window.GAME?.player
          ? {
              x: window.GAME.player.tileX,  // TILES, não pixels
              y: window.GAME.player.tileY,
              facing: window.GAME.player.facing || "down",
            }
          : null,
      };

      const res = await fetch("/api/game/checkpoint", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          mapId: gameState.mapId,
          position: gameState.position,
          state: state
        }),
      });

      if (res.ok) {
        console.log(`📌 Checkpoint automático criado: estado ${state}`);
        return true;
      } else {
        const errorData = await res.json().catch(() => ({}));
        console.warn("Erro ao criar checkpoint automático:", errorData);
        return false;
      }
    } catch (err) {
      console.warn("Erro ao criar checkpoint:", err);
      return false;
    }
  }

  // Salva o jogo
  async function saveGame() {
    if (!saveBtn) return;

    // Desabilita botão durante salvamento
    saveBtn.disabled = true;
    saveBtn.textContent = "⏳ Salvando...";
    clearStatus();

    try {
      // Coleta dados do estado do jogo
      const gameState = {
        mapId: window.GAME?.activeMapId || null,
        position: window.GAME?.player
          ? {
              x: window.GAME.player.tileX,  // TILES, não pixels!
              y: window.GAME.player.tileY,
              facing: window.GAME.player.facing || "down",
            }
          : null,
        timestamp: Date.now(),
      };

      // Envia para o servidor (salva em BD persistente)
      const res = await fetch("/api/game/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(gameState),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData?.error || "Erro ao salvar o jogo");
      }

      const data = await res.json();
      console.log("✅ Jogo salvo com sucesso:", data);

      setStatus("✅ Jogo salvo com sucesso!", false);

      // Fecha o modal após 1.5 segundos
      setTimeout(() => {
        close();
      }, 1500);
    } catch (err) {
      console.error("❌ Erro ao salvar jogo:", err);
      setStatus(`❌ Erro: ${err.message}`, true);
    } finally {
      // Reabilita botão
      saveBtn.disabled = false;
      saveBtn.textContent = "✅ Salvar Jogo";
    }
  }

  // Event Listeners
  if (closeBtn) {
    closeBtn.addEventListener("click", close);
  }

  if (cancelBtn) {
    cancelBtn.addEventListener("click", close);
  }

  if (saveBtn) {
    saveBtn.addEventListener("click", saveGame);
  }

  // Fecha ao clicar no backdrop
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal || e.target.classList.contains("modal__backdrop")) {
        close();
      }
    });
  }

  // Fecha com tecla ESC
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal?.classList.contains("is-open")) {
      close();
    }
  });

  console.log("💾 SaveGameModal carregado com sistema de checkpoints automáticos");
})();
