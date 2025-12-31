(() => {
  const $ = (id) => document.getElementById(id);

  // ============================================================
  // UTILITY FUNCTIONS
  // ============================================================

  function safeText(s) {
    return String(s ?? "");
  }

  function clamp01(x) {
    const n = Number(x);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(1, n));
  }

  function hpPct(current, max) {
    const c = Number(current);
    const m = Number(max);
    if (!Number.isFinite(c) || !Number.isFinite(m) || m <= 0) return 0;
    return clamp01(c / m);
  }

  function setHpBar(fillEl, current, max) {
    const pct = hpPct(current, max);
    if (!fillEl) return;
    
    fillEl.style.width = `${Math.round(pct * 100)}%`;
    
    // Color coding: green > 50%, yellow 20-50%, red < 20%
    if (pct > 0.5) {
      fillEl.removeAttribute('data-percent');
    } else if (pct > 0.2) {
      fillEl.setAttribute('data-percent', 'mid');
    } else {
      fillEl.setAttribute('data-percent', 'low');
    }
  }

  function pickSprite(sprites, kind) {
    if (!sprites || typeof sprites !== "object") return null;
    const animatedBW = sprites?.versions?.["generation-v"]?.["black-white"]?.animated || {};
    const showdown = sprites?.other?.showdown || {};
    const officialArt = sprites?.other?.["official-artwork"] || {};

    const frontCandidates = [
      animatedBW.front_default,
      showdown.front_default,
      officialArt.front_default,
      sprites.front_default,
    ].filter(Boolean);

    const backCandidates = [
      animatedBW.back_default,
      showdown.back_default,
      sprites.back_default,
      // fallback: some species lack back sprites; use front as last resort
      sprites.front_default,
    ].filter(Boolean);

    const list = kind === "back" ? backCandidates : frontCandidates;
    return list.length ? String(list[0]) : null;
  }

  async function fetchPokeApiPokemon(idOrName) {
    const r = await fetch(`https://pokeapi.co/api/v2/pokemon/${encodeURIComponent(String(idOrName))}`);
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error("pokeapi_failed");
    return data;
  }

  // ============================================================
  // MODAL ELEMENTS
  // ============================================================

  const battleModal = $("battleModal");
  
  // Enemy
  const battleEnemyName = $("battleEnemyName");
  const battleEnemyLevel = $("battleEnemyLevel");
  const battleEnemySprite = $("battleEnemySprite");
  const battleEnemyHpFill = $("battleEnemyHpFill");

  // Player
  const battlePlayerName = $("battlePlayerName");
  const battlePlayerNameShort = $("battlePlayerNameShort");
  const battlePlayerLevel = $("battlePlayerLevel");
  const battlePlayerSprite = $("battlePlayerSprite");
  const battlePlayerHpFill = $("battlePlayerHpFill");
  const battlePlayerHpCurrent = $("battlePlayerHpCurrent");
  const battlePlayerHpMax = $("battlePlayerHpMax");
  const battlePlayerExpFill = $("battlePlayerExpFill");

  // Message
  const battleMessage = $("battleMessage");
  const battleTextbox = $("battleTextbox");

  // Menus
  const battleMainMenu = $("battleMainMenu");
  const battleMovesMenu = $("battleMovesMenu");
  const battleMovesBack = $("battleMovesBack");

  // Actions
  const battleActionFight = $("battleActionFight");
  const battleActionBag = $("battleActionBag");
  const battleActionPokemon = $("battleActionPokemon");
  const battleActionRun = $("battleActionRun");

  // Move buttons
  const battleMove0 = $("battleMove0");
  const battleMove1 = $("battleMove1");
  const battleMove2 = $("battleMove2");
  const battleMove3 = $("battleMove3");

  // ============================================================
  // STATE
  // ============================================================

  let battleState = null;
  let currentEncounter = null;
  let isBusy = false;
  let typewriterInterval = null;  // Para controlar efeito de digitação
  const TYPEWRITER_MS = 45;       // Velocidade do typewriter (ms por caractere)
  const EVENT_BASE_DELAY = 1600;  // Atraso base entre eventos (ms)

  // ============================================================
  // MODAL CONTROLS
  // ============================================================

  function openModal(modalEl) {
    if (!modalEl) return;
    // Remove aria-hidden primeiro para evitar warnings de acessibilidade
    modalEl.removeAttribute("aria-hidden");
    modalEl.classList.add("is-open");
    
    // Pequeno delay para garantir que o modal está visível antes de focar
    requestAnimationFrame(() => {
      const firstButton = modalEl.querySelector("button:not(:disabled)");
      if (firstButton) {
        firstButton.focus();
      }
    });
  }

  function closeModal(modalEl) {
    if (!modalEl) return;
    
    // Remover foco de qualquer botão dentro do modal antes de fechar
    const focusedElement = document.activeElement;
    if (focusedElement && modalEl.contains(focusedElement)) {
      focusedElement.blur();
    }
    
    modalEl.classList.remove("is-open");
    modalEl.setAttribute("aria-hidden", "true");
    
    // Limpar typewriter se ainda estiver rodando
    if (typewriterInterval) {
      clearInterval(typewriterInterval);
      typewriterInterval = null;
    }
  }

  function setBusy(v) {
    isBusy = Boolean(v);
    const dis = isBusy;
    if (battleActionFight) battleActionFight.disabled = dis;
    if (battleActionBag) battleActionBag.disabled = dis;
    if (battleActionPokemon) battleActionPokemon.disabled = dis;
    if (battleActionRun) battleActionRun.disabled = dis;
    
    [battleMove0, battleMove1, battleMove2, battleMove3].forEach(btn => {
      if (btn) btn.disabled = dis;
    });
  }

  // ============================================================
  // MENU NAVIGATION
  // ============================================================

  function showMainMenu() {
    if (battleMainMenu) battleMainMenu.hidden = false;
    if (battleMovesMenu) battleMovesMenu.hidden = true;
    updateMessage("O que " + (battleState?.player?.name || "seu Pokémon") + " deve fazer?");
  }

  function showMovesMenu() {
    if (battleMainMenu) battleMainMenu.hidden = true;
    if (battleMovesMenu) battleMovesMenu.hidden = false;
    // Renderizar os ataques do estado da batalha
    if (battleState && battleState.player && battleState.player.moves) {
      renderMoves(battleState.player.moves);
    }
    updateMessage("Escolha um ataque");
  }

  function updateMessage(text) {
    if (!battleMessage) return;
    
    // Cancelar efeito anterior se ainda estiver rodando
    if (typewriterInterval) {
      clearInterval(typewriterInterval);
      typewriterInterval = null;
    }
    
    // Apply typewriter effect
    const fullText = String(text);
    battleMessage.textContent = "";
    
    let charIndex = 0;
    typewriterInterval = setInterval(() => {
      if (charIndex < fullText.length) {
        battleMessage.textContent += fullText[charIndex];
        charIndex++;
      } else {
        clearInterval(typewriterInterval);
        typewriterInterval = null;
      }
    }, TYPEWRITER_MS);
  }

  // ============================================================
  // RENDER BATTLE STATE
  // ============================================================

  async function renderBattle(state) {
    if (!state || typeof state !== "object") return;
    battleState = state;

    const enemy = state.enemy || {};
    const player = state.player || {};

    // Enemy info
    if (battleEnemyName) battleEnemyName.textContent = safeText(enemy.name).toUpperCase();
    if (battleEnemyLevel) battleEnemyLevel.textContent = enemy.level || 1;
    if (battleEnemySprite && enemy.pokemonId) {
      try {
        const p = await fetchPokeApiPokemon(enemy.pokemonId);
        const url = pickSprite(p?.sprites, "front");
        if (url) battleEnemySprite.src = url;
      } catch {}
    }
    const enemyCurHp = Number(enemy.currentHp ?? enemy.currentHP ?? 0);
    const enemyMaxHp = Number(enemy.maxHp ?? enemy.maxHP ?? 1);
    setHpBar(battleEnemyHpFill, enemyCurHp, enemyMaxHp);

    // Player info
    const playerName = safeText(player.name).toUpperCase();
    if (battlePlayerName) battlePlayerName.textContent = playerName;
    if (battlePlayerNameShort) battlePlayerNameShort.textContent = playerName;
    if (battlePlayerLevel) battlePlayerLevel.textContent = player.level || 1;
    if (battlePlayerSprite && player.pokemonId) {
      try {
        const p = await fetchPokeApiPokemon(player.pokemonId);
        const url = pickSprite(p?.sprites, "back");
        if (url) battlePlayerSprite.src = url;
      } catch {}
    }
    const playerCurHp = Number(player.currentHp ?? player.currentHP ?? 0);
    const playerMaxHp = Number(player.maxHp ?? player.maxHP ?? 1);
    setHpBar(battlePlayerHpFill, playerCurHp, playerMaxHp);
    
    // Atualizar texto numérico do HP
    if (battlePlayerHpCurrent) {
      battlePlayerHpCurrent.textContent = Math.max(0, Math.floor(playerCurHp));
    }
    if (battlePlayerHpMax) {
      battlePlayerHpMax.textContent = Math.max(0, Math.floor(playerMaxHp));
    }
    
    // Atualizar display de HP (se existir elemento combinado)
    const battlePlayerHpText = document.getElementById("battlePlayerHpText");
    if (battlePlayerHpText) {
      const currentHP = Math.max(0, Math.floor(playerCurHp));
      const maxHP = Math.max(0, Math.floor(playerMaxHp));
      battlePlayerHpText.textContent = `${currentHP}/${maxHP}`;
    }

    // Show main menu (moves will be rendered when LUTA is clicked)
    showMainMenu();
    // Mostrar último log da batalha, se houver
    const lastLog = Array.isArray(state.log) && state.log.length ? state.log[state.log.length - 1] : null;
    if (lastLog) updateMessage(lastLog);
  }

  function renderMoves(moves) {
    const grid = document.getElementById("battleMovesGrid");
    if (!grid) return;
    
    grid.innerHTML = "";
    
    const moveList = Array.isArray(moves) ? moves : [];
    
    for (let i = 0; i < 4; i++) {
      const move = moveList[i];
      const btn = document.createElement("button");
      btn.className = "battle-firered__btn";
      btn.type = "button";
      
      if (!move) {
        btn.textContent = "—";
        btn.disabled = true;
        grid.appendChild(btn);
        continue;
      }

      const name = safeText(move.name).toUpperCase();
      const pp = `${move.currentPP || 0}/${move.maxPP || 0}`;
      const type = String(move.type || "?").toUpperCase();
      const cat = String(move.category || "?").toUpperCase();
      btn.textContent = `${name}\n${type} • ${cat}\nPP: ${pp}`;
      
      btn.addEventListener("click", () => {
        if (!isBusy) useMove(i);
      });
      
      grid.appendChild(btn);
    }
  }

  // ============================================================
  // BATTLE ACTIONS
  // ============================================================

  async function startBattle(encounter) {
    console.log("=== Starting Battle ===");
    console.log("Encounter:", encounter);
    
    try {
      setBusy(true);
      currentEncounter = encounter;
      
      console.log("Fetching /api/battle/start...");
      const r = await fetch("/api/battle/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ encounter }),
      });
      
      console.log("Response status:", r.status);
      const data = await r.json().catch((err) => {
        console.error("JSON parse error:", err);
        return {};
      });
      console.log("Response data:", data);
      
      if (!r.ok) {
        console.error("Response not OK. Status:", r.status);
        updateMessage(`Erro: HTTP ${r.status}`);
        setBusy(false);
        return;
      }

      if (!data?.ok) {
        console.error("Battle start failed:", data?.error);
        updateMessage(data?.error || "Erro ao iniciar batalha");
        setBusy(false);
        return;
      }

      battleState = data.state;
      console.log("Battle state:", battleState);
      
      // 📌 Criar checkpoint automático antes de entrar na batalha
      if (window.SaveGameModal?.createAutoCheckpoint) {
        console.log("⚔️ Criando checkpoint automático de batalha...");
        await window.SaveGameModal.createAutoCheckpoint('battle');
      }
      
      console.log("Opening modal...");
      openModal(battleModal);
      
      // Background da batalha (mapeado por terreno)
      try {
        const arena = document.querySelector('.battle-firered__arena');
        const terrain = String(currentEncounter?.terrain || '').toLowerCase();
        const pickFrom = async () => {
          const bgRes = await fetch("/api/battle/backgrounds", { credentials: "include" });
          if (!bgRes.ok) return [];
          const bgData = await bgRes.json().catch(() => ({ results: [] }));
          return Array.isArray(bgData?.results) ? bgData.results : [];
        };
        const list = await pickFrom();
        let candidates = list;
        if (terrain) {
          const map = {
            grass: ["2.jpg", "3.jpg", "7.jpg"],
            cave: ["6.jpg"],
            mountain: ["6.jpg"],
            sand: ["4.jpg"],
            water: ["5.jpg"],
            pond: ["5.jpg"],
            building: ["1.jpg"],
            indoor: ["1.jpg"],
          };
          const allow = new Set(map[terrain] || []);
          const byName = list.filter((url) => allow.size === 0 ? true : allow.has(url.split('/').pop()));
          if (byName.length) candidates = byName;
        }
        const pick = candidates.length ? candidates[Math.floor(Math.random() * candidates.length)] : null;
        if (arena && pick) {
          // Preencher toda a arena mantendo posicionamento central
          arena.style.background = `linear-gradient(180deg, rgba(200,240,255,0.30) 0%, rgba(136,208,240,0.25) 40%, rgba(80,176,128,0.20) 70%, rgba(48,160,80,0.20) 100%), url('${pick}') center / cover no-repeat`;
        }
      } catch (e) {
        console.warn("Battle background fetch failed:", e);
      }
      
      await renderBattle(battleState);
      setBusy(false);
      
    } catch (err) {
      console.error("Battle start failed:", err);
      updateMessage("Erro ao iniciar batalha");
      setBusy(false);
    }
  }

  async function useMove(moveIndex) {
    if (!battleState || isBusy) {
      console.log("useMove blocked: battleState=", battleState, "isBusy=", isBusy);
      return;
    }
    
    console.log("=== useMove called ===");
    console.log("Move index:", moveIndex);
    console.log("Battle state:", battleState);
    
    try {
      setBusy(true);
      
      // Get the move name from the player's moves array
      const move = battleState?.player?.moves?.[moveIndex];
      console.log("Selected move:", move);
      
      if (!move || !move.name) {
        updateMessage("Erro: Movimento não encontrado");
        setBusy(false);
        return;
      }
      
      console.log("Sending POST /api/battle/action with move:", move.name);
      const r = await fetch("/api/battle/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          type: "move",
          moveName: move.name
        }),
      });
      
      console.log("Response status:", r.status);
      const data = await r.json().catch(() => ({}));
      console.log("Response data:", data);
      
      if (!r.ok || !data?.ok) {
        updateMessage(data?.error || "Erro ao processar turno");
        setBusy(false);
        return;
      }

      // Process turn events
      if (data.events && Array.isArray(data.events)) {
        console.log("Processing events:", data.events);
        await processBattleEvents(data.events);
      }

      // Update state
      battleState = data.state;
      console.log("Updated battle state:", battleState);
      await renderBattle(battleState);

      // Check if battle ended
      if (battleState.ended) {
        await handleBattleEnd(battleState);
      } else {
        // Voltar ao menu de golpes para mostrar PP atualizado
        showMovesMenu();
      }
      
    } catch (err) {
      console.error("Turn failed:", err);
      updateMessage("Erro ao processar turno");
    } finally {
      setBusy(false);
    }
  }

  async function runFromBattle() {
    if (isBusy) return;
    
    try {
      setBusy(true);
      updateMessage("Tentando fugir...");
      
      // Chamar API para encerrar a batalha
      const r = await fetch("/api/battle/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ type: "run" }),
      });
      const data = await r.json().catch(() => ({}));
      
      if (r.ok && data?.ok) {
        updateMessage("Você fugiu com sucesso!");
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        closeModal(battleModal);
        battleState = null;
        
        // Unpause game
        if (window.GAME?.setPaused) {
          window.GAME.setPaused(false);
        }
        
        if (window.UI?.log) {
          window.UI.log("🏃 Você fugiu da batalha.");
        }
      } else {
        updateMessage("Não foi possível fugir!");
        await new Promise(resolve => setTimeout(resolve, 1500));
        showMainMenu();
      }
      
    } catch (err) {
      console.error("Run failed:", err);
      updateMessage("Erro ao tentar fugir");
      await new Promise(resolve => setTimeout(resolve, 1500));
      showMainMenu();
    } finally {
      setBusy(false);
    }
  }

  // ============================================================
  // BATTLE EVENTS
  // ============================================================

  async function processBattleEvents(events) {
    for (const event of events) {
      // Processa evento e calcula atraso com base no tamanho do texto + atraso base
      const text = event?.text || event?.message || "";
      const approxTypeTime = Math.min(6000, Math.max(0, text.length * TYPEWRITER_MS));
      const pause = Math.max(EVENT_BASE_DELAY, approxTypeTime + 600);
      await processBattleEvent(event);
      await new Promise(resolve => setTimeout(resolve, pause));
    }
  }

  async function processBattleEvent(event) {
    if (!event || !event.type) return;

    switch (event.type) {
      case "message": {
        const text = event.text || event.message || "";
        if (text) updateMessage(text);
        break;
      }
      case "damage":
        updateMessage(event.message || "Ataque acertou!");
        if (event.target === "enemy") {
          animateDamage(battleEnemySprite);
        } else {
          animateDamage(battlePlayerSprite);
        }
        break;

      case "miss":
        updateMessage(event.message || "O ataque errou!");
        break;

      case "super-effective":
        updateMessage("É super efetivo!");
        break;

      case "not-very-effective":
        updateMessage("Não é muito efetivo...");
        break;

      case "no-effect":
        updateMessage("Não teve efeito!");
        break;

      case "pp":
        // Re-renderiza os golpes para refletir PP atual
        if (battleState?.player?.moves) {
          renderMoves(battleState.player.moves);
        }
        break;

      default:
        if (event.message || event.text) {
          updateMessage(event.message || event.text);
        }
    }
  }

  function animateDamage(spriteEl) {
    if (!spriteEl) return;
    spriteEl.style.animation = "none";
    setTimeout(() => {
      spriteEl.style.animation = "shake 0.4s ease-in-out";
    }, 10);
  }

  async function handleBattleEnd(state) {
    if (state.winner === "player") {
      updateMessage("Você venceu a batalha!");
      
      // EXP gain animation
      if (state.expGained) {
        await new Promise(resolve => setTimeout(resolve, 1500));
        updateMessage(`Ganhou ${state.expGained} pontos de experiência!`);
      }
    } else {
      updateMessage("Você perdeu a batalha!");
    }

    await new Promise(resolve => setTimeout(resolve, 3000));
    
    closeModal(battleModal);
    battleState = null;
    
    // Unpause game
    if (window.GAME?.setPaused) {
      window.GAME.setPaused(false);
    }
  }

  // ============================================================
  // EVENT LISTENERS
  // ============================================================

  if (battleActionFight) {
    battleActionFight.addEventListener("click", () => {
      if (!isBusy) showMovesMenu();
    });
  }

  if (battleActionRun) {
    battleActionRun.addEventListener("click", () => {
      if (!isBusy) runFromBattle();
    });
  }

  if (battleActionBag) {
    battleActionBag.addEventListener("click", () => {
      if (!isBusy) {
        // Abrir modal da mochila
        const bagBtn = document.getElementById("btnBag");
        if (bagBtn) {
          bagBtn.click();
        } else {
          updateMessage("Mochila não disponível");
        }
      }
    });
  }

  if (battleActionPokemon) {
    battleActionPokemon.addEventListener("click", () => {
      if (!isBusy) {
        // Abrir modal do time de Pokémon
        const teamBtn = document.getElementById("btnTeam");
        if (teamBtn) {
          teamBtn.click();
        } else {
          updateMessage("Time não disponível");
        }
      }
    });
  }

  if (battleMovesBack) {
    battleMovesBack.addEventListener("click", () => {
      if (!isBusy) showMainMenu();
    });
  }

  // Move buttons
  [battleMove0, battleMove1, battleMove2, battleMove3].forEach((btn, idx) => {
    if (btn) {
      btn.addEventListener("click", () => {
        if (!isBusy && !btn.disabled) {
          showMainMenu();
          useMove(idx);
        }
      });
    }
  });

  // Close modal on backdrop click
  if (battleModal) {
    battleModal.addEventListener("click", (e) => {
      if (e.target.classList.contains("modal__backdrop")) {
        runFromBattle();
      }
    });
  }

  // ============================================================
  // GLOBAL API
  // ============================================================

  window.BattleModal = {
    open: startBattle,
    close: () => {
      closeModal(battleModal);
      battleState = null;
      if (window.GAME?.setPaused) window.GAME.setPaused(false);
    },
  };

  // ============================================================
  // ADD SHAKE ANIMATION TO CSS IF NOT EXISTS
  // ============================================================

  const style = document.createElement('style');
  style.textContent = `
    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(-8px); }
      50% { transform: translateX(8px); }
      75% { transform: translateX(-8px); }
    }
  `;
  document.head.appendChild(style);

})();
