function __coreGameBootstrap() {
  "use strict";

  const CORE_CONFIG = window.CORE_CONFIG || {};

  function applyCoreConfig(base) {
    if (!base || typeof base !== "object") return;
    if (CORE_CONFIG.mapsFolder) base.mapsFolder = CORE_CONFIG.mapsFolder;
    if (CORE_CONFIG.pokefireredRoot) base.pokefireredRoot = CORE_CONFIG.pokefireredRoot;
    if (CORE_CONFIG.assetsRoot) base.assetsRoot = CORE_CONFIG.assetsRoot;
  }

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const messageEl = document.getElementById("message");
  const gameWrap = document.getElementById("game-wrap");

  let WORLD = window.WORLD || {};
  applyCoreConfig(WORLD);
  let VIEW = WORLD.view || {};
  let PLAYER_CFG = WORLD.player || {};
  let MOVE_SPEED = Number.isFinite(WORLD.moveSpeed) ? WORLD.moveSpeed : 96;
  let RUN_MULT = Number.isFinite(WORLD.runMultiplier) ? WORLD.runMultiplier : 1.5;
  let TILE_SIZE = 16;
  let VIEW_TILES_X = 20;
  let VIEW_TILES_Y = 15;
  let SCALE = 2;
  let viewportW = 0;
  let viewportH = 0;

  // 🖱️ Interaction Handler (Click/Double Click to Chat)
  function handleMouseClick(e) {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();

    // 📐 Escala do CSS vs Canvas Interno
    // Se o canvas tem width=640 mas está esticado em 1000px na tela, precisamos corrigir.
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;

    let clickedNpc = null;

    // 1. Pixel-perfect detection
    for (const npc of state.npcs) {
      if (!npc) continue;

      // Usar a função global real definida lá embaixo (hoisted)
      // Se não existir (algo deu errado), fallback seguro
      const size = (typeof getNpcSpriteSize === 'function')
        ? getNpcSpriteSize(npc)
        : { width: TILE_SIZE, height: TILE_SIZE * 2 }; // Fallback

      // O jogo renderiza aplicando SCALE nas coordenadas
      // drawX = (world - cam) * SCALE
      const drawX = (npc.x * TILE_SIZE - state.camera.x) * SCALE;
      // drawY tem um offset para pés alinhados
      const drawY = (npc.y * TILE_SIZE - state.camera.y - Math.max(0, size.height - TILE_SIZE)) * SCALE;

      const w = size.width * SCALE;
      const h = size.height * SCALE;

      // Expand a hit box slightly for ease of use (+ half tile tolerance)
      const tolerance = 8;

      if (clickX >= drawX - tolerance && clickX < drawX + w + tolerance &&
        clickY >= drawY - tolerance && clickY < drawY + h + tolerance) {
        clickedNpc = npc;
      }
    }

    // 2. Debug Visual (Red Box - ajustado para escala)
    const ctx = canvas.getContext("2d");
    ctx.save();
    // Como o ctx pode estar escalado, resetamos transform para desenhar em coordenadas puras do canvas
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    ctx.strokeStyle = clickedNpc ? "lime" : "red";
    ctx.lineWidth = 3;
    ctx.strokeRect(clickX - 10, clickY - 10, 20, 20); // Caixa ao redor do clique

    // Restaurar (tentar restaurar o estado anterior é difícil se não sabemos o scale atual.
    // Mas assumindo que o game loop reseta tudo no próximo frame, ok.)
    ctx.restore();

    if (clickedNpc) {
      console.log("🎯 Click acerto NPC:", clickedNpc.name, clickedNpc.id);
      // Use interaction menu instead of opening chat directly
      if (window.npcInteractionMenu && typeof window.npcInteractionMenu.show === 'function') {
        window.npcInteractionMenu.show(clickedNpc);
      } else if (window.openChat) {
        // Fallback to direct chat if menu not loaded yet
        window.openChat(clickedNpc.id, clickedNpc.name || "NPC", state.mapId);
      }
    } else {
      console.log("❌ Click no vazio.",
        "Tela:", (e.clientX - rect.left).toFixed(0),
        "Canvas:", clickX.toFixed(0),
        "Scale:", scaleX.toFixed(2)
      );
    }
  }

  if (canvas) {
    canvas.addEventListener("click", handleMouseClick);
    canvas.addEventListener("dblclick", handleMouseClick);
    // Prevenir seleção de texto duplo clique
    canvas.addEventListener("mousedown", (e) => { if (e.detail > 1) e.preventDefault(); });
  }

  function getEditorSettings() {
    // 🔒 Apenas retornar EditorSettings se existir (modo admin)
    // Caso contrário, retornar configuração vazia (modo jogador)
    if (!window.EditorSettings) {
      return {
        showGrid: false,
        showColliders: false,
        showEvents: false,
        showNpcs: false
      };
    }
    return window.EditorSettings || {};
  }

  function getViewState() {
    return {
      tileSize: TILE_SIZE,
      viewportW,
      viewportH,
      cameraX: state.camera.x,
      cameraY: state.camera.y,
      scale: SCALE,
      mapId: state.mapId,
      tilesX: state.map.tilesX,
      tilesY: state.map.tilesY
    };
  }

  function getPlayerState() {
    return {
      mapId: state.mapId,
      tileX: state.player.tileX,
      tileY: state.player.tileY,
      facing: state.player.facing,
      moving: state.player.moving,
      vx: state.player.vx,
      vy: state.player.vy,
      moveRemaining: state.player.moveRemaining,
      moveTiles: state.player.moveTiles,
      x: state.player.x,
      y: state.player.y
    };
  }

  function setPaused(value) {
    state.paused = Boolean(value);
  }

  function setOtherPlayers(list, selfId) {
    const sid = String(selfId || "");
    const arr = Array.isArray(list) ? list : [];
    const nextIds = new Set();
    for (let i = 0; i < arr.length; i += 1) {
      const p = arr[i];
      if (!p || !p.id) continue;
      if (sid && p.id === sid) continue;

      const id = String(p.id);
      nextIds.add(id);

      const name = String(p.name || "Jogador");
      const spriteId = String(p.spriteId || "boy");

      // Protocolo atual (tile): x/y
      // Protocolo de movimento: fromX/fromY/toX/toY + moving
      const hasMove = Boolean(p.moving) && Number.isFinite(Number(p.fromX)) && Number.isFinite(Number(p.fromY)) && Number.isFinite(Number(p.toX)) && Number.isFinite(Number(p.toY));

      const txRaw = hasMove ? Number(p.toX) : Number(p.x);
      const tyRaw = hasMove ? Number(p.toY) : Number(p.y);
      if (!Number.isFinite(txRaw) || !Number.isFinite(tyRaw)) continue;
      const targetTileX = Math.trunc(txRaw);
      const targetTileY = Math.trunc(tyRaw);

      const existing = state.otherPlayers.get(id);
      if (!existing) {
        const spawnFromX = hasMove ? Math.trunc(Number(p.fromX)) : targetTileX;
        const spawnFromY = hasMove ? Math.trunc(Number(p.fromY)) : targetTileY;
        const ent = {
          id,
          name,
          spriteId,
          tileX: targetTileX,
          tileY: targetTileY,
          facing: String(p.facing || "down"),
          x: spawnFromX * TILE_SIZE,
          y: spawnFromY * TILE_SIZE,
          vx: 0,
          vy: 0,
          moving: false,
          moveRemaining: 0,
          moveTotal: 0,
          animTime: 0,
        };
        // Se já veio um movimento em andamento, inicia.
        if (hasMove) {
          startOtherPlayerMove(ent, spawnFromX, spawnFromY, targetTileX, targetTileY, String(p.facing || ent.facing));
        }
        state.otherPlayers.set(id, ent);
        continue;
      }

      // Merge (sem destruir estado de animação a cada update)
      existing.name = name;
      existing.spriteId = spriteId;

      // Atualiza facing (se veio do servidor) ou deriva da direção.
      const incomingFacing = String(p.facing || "");
      if (incomingFacing) {
        existing.facing = incomingFacing;
      }

      if (hasMove) {
        const fromX = Math.trunc(Number(p.fromX));
        const fromY = Math.trunc(Number(p.fromY));
        // Evita reiniciar o mesmo movimento repetidamente.
        const sameTarget = existing.tileX === targetTileX && existing.tileY === targetTileY && existing.moving;
        if (!sameTarget) {
          startOtherPlayerMove(existing, fromX, fromY, targetTileX, targetTileY, String(p.facing || existing.facing));
        }
        continue;
      }

      // Correção / sync de tile final.
      if (existing.tileX !== targetTileX || existing.tileY !== targetTileY) {
        // Se o servidor só informa o tile final, animamos do ponto atual até o alvo.
        startOtherPlayerMove(existing, Math.round(existing.x / TILE_SIZE), Math.round(existing.y / TILE_SIZE), targetTileX, targetTileY, existing.facing);
      }
    }

    // Remove players que saíram
    for (const id of state.otherPlayers.keys()) {
      if (!nextIds.has(id)) state.otherPlayers.delete(id);
    }
  }

  function facingFromDelta(dx, dy, fallback) {
    const ax = Math.abs(dx);
    const ay = Math.abs(dy);
    if (ax === 0 && ay === 0) return fallback || "down";
    if (ax >= ay) return dx >= 0 ? "right" : "left";
    return dy >= 0 ? "down" : "up";
  }

  function startOtherPlayerMove(ent, fromTileX, fromTileY, toTileX, toTileY, facing) {
    if (!ent) return;
    const fromXpx = fromTileX * TILE_SIZE;
    const fromYpx = fromTileY * TILE_SIZE;
    const toXpx = toTileX * TILE_SIZE;
    const toYpx = toTileY * TILE_SIZE;

    // Se estiver muito fora, “teleporta” para a origem antes de animar.
    const dx0 = toXpx - (Number.isFinite(ent.x) ? ent.x : fromXpx);
    const dy0 = toYpx - (Number.isFinite(ent.y) ? ent.y : fromYpx);
    const dist0 = Math.sqrt(dx0 * dx0 + dy0 * dy0);
    if (!Number.isFinite(dist0) || dist0 > TILE_SIZE * 6) {
      ent.x = fromXpx;
      ent.y = fromYpx;
    }

    // Começa do tile informado (quando disponível) para reduzir delay visual.
    ent.x = Number.isFinite(ent.x) ? ent.x : fromXpx;
    ent.y = Number.isFinite(ent.y) ? ent.y : fromYpx;

    const dx = toXpx - ent.x;
    const dy = toYpx - ent.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (!Number.isFinite(dist) || dist <= 0.001) {
      ent.moving = false;
      ent.vx = 0;
      ent.vy = 0;
      ent.moveRemaining = 0;
      ent.moveTotal = 0;
      ent.tileX = toTileX;
      ent.tileY = toTileY;
      ent.x = toXpx;
      ent.y = toYpx;
      if (facing) ent.facing = facing;
      return;
    }

    ent.tileX = toTileX;
    ent.tileY = toTileY;
    ent.facing = facing || facingFromDelta(dx, dy, ent.facing);
    ent.moving = true;
    ent.vx = dx / dist;
    ent.vy = dy / dist;
    ent.moveRemaining = dist;
    ent.moveTotal = dist;
    ent.animTime = 0;
  }

  function updateOtherPlayers(dt) {
    if (state.paused) return;
    if (!state.otherPlayers || !state.otherPlayers.size) return;

    for (const p of state.otherPlayers.values()) {
      if (!p) continue;
      if (!Number.isFinite(p.x)) p.x = p.tileX * TILE_SIZE;
      if (!Number.isFinite(p.y)) p.y = p.tileY * TILE_SIZE;

      if (p.moving) {
        p.animTime = (Number.isFinite(p.animTime) ? p.animTime : 0) + dt;
        const remaining = Number.isFinite(p.moveRemaining) ? p.moveRemaining : 0;
        const step = Math.min(remaining, MOVE_SPEED * dt);
        p.x += (Number.isFinite(p.vx) ? p.vx : 0) * step;
        p.y += (Number.isFinite(p.vy) ? p.vy : 0) * step;
        p.moveRemaining = remaining - step;
        if (p.moveRemaining <= 0.001) {
          p.moving = false;
          p.vx = 0;
          p.vy = 0;
          p.moveRemaining = 0;
          p.moveTotal = 0;
          p.x = p.tileX * TILE_SIZE;
          p.y = p.tileY * TILE_SIZE;
        }
      }
    }
  }

  const api = {
    onTileSelect: null,
    loadWorld,
    applyEdits,
    setActiveMap,
    getViewState,
    getPlayerState,
    setPaused,
    setOtherPlayers,
    triggerMapDoubleClick,
    loadNpcSpriteMapping  // 🗺️ Função para carregar mapeamento de sprites de NPCs
  };

  const state = {
    ready: false,
    paused: false,
    menuOpen: false,
    mapId: null,
    map: { width: 0, height: 0, tilesX: 0, tilesY: 0, expectedWidth: null, expectedHeight: null },
    mapRenderer: null,
    camera: { x: 0, y: 0 },
    player: {
      x: 0,
      y: 0,
      tileX: 0,
      tileY: 0,
      facing: "down",
      moving: false,
      vx: 0,
      vy: 0,
      moveRemaining: 0,
      moveTiles: 1,
      animTime: 0,
      bumpTime: 0
    },
    playerSprite: null,
    otherPlayers: new Map(),
    colliders: [],
    jumps: [],
    events: [],
    npcs: [],
    triggered: new Set(),
    teleportCooldown: 0,
    npcHold: null,
    animClock: 0,
    input: { run: false },
    checkpointTimer: 0,  // 📌 Para checkpoints automáticos periódicos
    autosaveTimer: 0,    // 💾 Para autosave contínuo a cada 30 segundos
    lastAutosavePos: null,  // 📍 Última posição salva (para detectar mudança)
    cache: {
      canvas: null,
      ctx: null,
      ready: false,
      mapId: null
    }
  };

  const otherPlayerSpriteCache = new Map();

  // 🗺️ Mapeamento de graphics_id do FireRed para arquivos PNG de sprites
  let npcSpriteMapping = null;

  function loadNpcSpriteMapping() {
    if (npcSpriteMapping) {
      return Promise.resolve(npcSpriteMapping);
    }
    const mappingPath = "/core/npc-sprites-mapping.json";
    return fetch(mappingPath)
      .then(res => res.ok ? res.json() : {})
      .then(data => {
        npcSpriteMapping = data || {};
        return npcSpriteMapping;
      })
      .catch(() => {
        npcSpriteMapping = {};
        return npcSpriteMapping;
      });
  }

  function getNpcSpritePath(graphicsId) {
    if (!npcSpriteMapping) {
      return null;
    }
    const file = npcSpriteMapping[graphicsId];
    if (!file) {
      return null;
    }
    const root = getPokefireredRoot();
    return root + "/graphics/object_events/pics/people/" + file;
  }

  function getOverworldSpriteSheetSrc(spriteId) {
    const map = window.OVERWORLD_SPRITES || {};
    const entry = map && map[String(spriteId || "").trim()];
    const file = entry && entry.file ? String(entry.file) : "boy.png";
    const root = getPokefireredRoot();
    return root + "/graphics/object_events/pics/people/" + file;
  }

  function ensureOtherPlayerSprite(spriteId) {
    const key = String(spriteId || "").trim() || "boy";
    const existing = otherPlayerSpriteCache.get(key);
    if (existing && existing.sprite) return existing.sprite;
    if (existing && existing.loading) return null;

    const entry = { loading: true, sprite: null };
    otherPlayerSpriteCache.set(key, entry);

    const src = getOverworldSpriteSheetSrc(key);
    loadPlayerSprite({
      targetHeightTiles: 2,
      sheet: {
        preset: "pokefirered-standard",
        src,
        frameWidth: 16,
        frameHeight: 32,
      },
    })
      .then((sprite) => {
        entry.sprite = sprite;
      })
      .catch(() => {
        entry.sprite = null;
      })
      .finally(() => {
        entry.loading = false;
      });

    return null;
  }

  function drawNameLabel(name, x, y) {
    const label = String(name || "").trim();
    if (!label) return;
    ctx.save();
    ctx.font = "10px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(0,0,0,0.75)";
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.strokeText(label, x, y);
    ctx.fillText(label, x, y);
    ctx.restore();
  }

  const keyToDir = {
    ArrowUp: "up",
    KeyW: "up",
    ArrowDown: "down",
    KeyS: "down",
    ArrowLeft: "left",
    KeyA: "left",
    ArrowRight: "right",
    KeyD: "right"
  };

  const ACTION_KEYS = {
    confirm: ["KeyZ", "Space"],
    cancel: ["KeyX", "Escape", "Backspace"],
    menu: ["Enter", "KeyM"],
    select: ["Tab"],
    run: ["ShiftLeft", "ShiftRight"],
    l: ["KeyQ"],
    r: ["KeyE"]
  };

  const actionKeyMap = (() => {
    const map = {};
    Object.keys(ACTION_KEYS).forEach((action) => {
      const list = ACTION_KEYS[action] || [];
      for (let i = 0; i < list.length; i += 1) {
        map[list[i]] = action;
      }
    });
    return map;
  })();

  const dirStack = [];

  function getActionForKey(code) {
    return actionKeyMap[code] || null;
  }

  function pushDir(dir) {
    const idx = dirStack.indexOf(dir);
    if (idx !== -1) {
      dirStack.splice(idx, 1);
    }
    dirStack.push(dir);
  }

  function popDir(dir) {
    const idx = dirStack.indexOf(dir);
    if (idx !== -1) {
      dirStack.splice(idx, 1);
    }
  }

  function getInputDir() {
    return dirStack.length ? dirStack[dirStack.length - 1] : null;
  }

  const dirVector = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 }
  };

  function fireWorldAction(action, extraData) {
    const base = window.WORLD || WORLD;
    const handler = base && base.onAction;
    if (typeof handler !== "function") {
      return false;
    }
    const actionData = {
      mapId: state.mapId,
      tileX: state.player.tileX,
      tileY: state.player.tileY,
      ...(extraData || {})
    };
    handler.call(base, action, actionData);
    return true;
  }

  function handleConfirmAction() {
    if (state.menuOpen) {
      closeMenu();
      return;
    }
    if (isMessageVisible()) {
      hideMessage();
      return;
    }
    handleInteract();
  }

  function handleCancelAction() {
    if (state.menuOpen) {
      closeMenu();
      return;
    }
    if (isMessageVisible()) {
      hideMessage();
    }
  }

  function handleMenuAction() {
    if (isMessageVisible()) {
      return;
    }
    toggleMenu();
  }

  function handleSelectAction() {
    if (state.menuOpen || isMessageVisible()) {
      return;
    }
    fireWorldAction("select");
  }

  function handleShoulderAction(action) {
    if (state.menuOpen || isMessageVisible()) {
      return;
    }
    fireWorldAction(action);
  }

  window.addEventListener("keydown", (e) => {
    // 🛑 Bloquear inputs do jogo se estiver digitando no chat
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") {
      return;
    }

    const dir = keyToDir[e.code];
    if (dir) {
      if (!e.repeat) {
        pushDir(dir);
      }
      e.preventDefault();
    }
    const action = getActionForKey(e.code);
    if (!action) {
      return;
    }
    if (action === "run") {
      state.input.run = true;
      return;
    }
    if (e.repeat) {
      e.preventDefault();
      return;
    }
    if (action === "confirm") {
      handleConfirmAction();
      e.preventDefault();
      return;
    }
    if (action === "cancel") {
      handleCancelAction();
      e.preventDefault();
      return;
    }
    if (action === "menu") {
      handleMenuAction();
      e.preventDefault();
      return;
    }
    if (action === "select") {
      handleSelectAction();
      e.preventDefault();
      return;
    }
    if (action === "l" || action === "r") {
      handleShoulderAction(action);
      e.preventDefault();
      return;
    }
  });

  window.addEventListener("keyup", (e) => {
    // 🛑 Bloquear inputs do jogo se estiver digitando no chat
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") {
      return;
    }

    const dir = keyToDir[e.code];
    if (dir) {
      popDir(dir);
      e.preventDefault();
    }
    const action = getActionForKey(e.code);
    if (action === "run") {
      state.input.run = false;
    }
  });

  function getTileFromPointer(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = viewportW / rect.width;
    const scaleY = viewportH / rect.height;
    const worldX = state.camera.x + (e.clientX - rect.left) * scaleX;
    const worldY = state.camera.y + (e.clientY - rect.top) * scaleY;
    return {
      x: Math.floor(worldX / TILE_SIZE),
      y: Math.floor(worldY / TILE_SIZE)
    };
  }

  canvas.addEventListener("click", (e) => {
    if (!state.ready) {
      return;
    }
    const tile = getTileFromPointer(e);
    if (typeof api.onTileSelect === "function") {
      api.onTileSelect({ x: tile.x, y: tile.y });
    } else {
      console.log("tile", tile.x, tile.y);
    }
  });

  canvas.addEventListener("dblclick", (e) => {
    if (!state.ready || state.paused) {
      return;
    }
    e.preventDefault();
    const tile = getTileFromPointer(e);
    handleDoubleClick(tile.x, tile.y);
  });

  function normalizeEvents(rawEvents) {
    if (!Array.isArray(rawEvents)) {
      return [];
    }
    const out = [];
    for (let i = 0; i < rawEvents.length; i += 1) {
      const ev = rawEvents[i] || {};
      if (!ev.rect) {
        continue;
      }
      const rawType = String(ev.type || "message");
      const serverTypes = new Set(["pokecenter", "pokemon_hunt", "battle"]);
      const isServer = rawType === "server" || serverTypes.has(rawType);
      const eventType = String(
        ev.eventType || (serverTypes.has(rawType) ? rawType : "") || ""
      ).trim();
      const payload =
        ev.payload && typeof ev.payload === "object"
          ? ev.payload
          : ev.server && typeof ev.server === "object"
            ? ev.server.payload || {}
            : {};
      const name = typeof ev.name === "string" ? ev.name : "";
      const lockFlag = typeof ev.lockFlag === "string" ? ev.lockFlag.trim() : "";
      const lockMessage = typeof ev.lockMessage === "string" ? ev.lockMessage : "";
      const locked = ev.locked === true;
      out.push({
        id: ev.id || "event-" + i,
        rect: ev.rect,
        type: isServer ? "server" : rawType,
        text: ev.text || "",
        dialogId: ev.dialogId || ev.dialog || null,
        trigger:
          typeof ev.trigger === "string"
            ? ev.trigger
            : rawType === "dialog"
              ? "enter"
              : isServer
                ? "interact"
                : null,
        target: ev.target || null,
        once: ev.once !== false,
        eventType,
        payload,
        name,
        lockFlag: lockFlag || null,
        lockMessage,
        locked
      });
    }
    return out;
  }

  function showMessage(text) {
    if (!text) {
      return;
    }
    if (!messageEl) {
      alert(text);
      return;
    }
    messageEl.textContent = text;
    messageEl.classList.remove("hidden");
    state.paused = true;
  }

  function hideMessage() {
    if (!messageEl) {
      return;
    }
    messageEl.classList.add("hidden");
    state.paused = false;
  }

  function isMessageVisible() {
    return messageEl && !messageEl.classList.contains("hidden");
  }

  let menuEl = null;

  function getMenuEl() {
    if (menuEl) {
      return menuEl;
    }
    menuEl = document.getElementById("menu-overlay");
    if (!menuEl) {
      menuEl = document.createElement("div");
      menuEl.id = "menu-overlay";
      menuEl.className = "hidden";
      menuEl.setAttribute("role", "dialog");
      menuEl.setAttribute("aria-live", "polite");
      if (gameWrap) {
        gameWrap.appendChild(menuEl);
      }
    }
    return menuEl;
  }

  function buildMenuText() {
    const mapLabel = state.mapId || "-";
    const posX = Number.isFinite(state.player.tileX) ? state.player.tileX : "-";
    const posY = Number.isFinite(state.player.tileY) ? state.player.tileY : "-";
    return (
      "MENU\n" +
      "Mapa: " +
      mapLabel +
      "\nPosicao: " +
      posX +
      ", " +
      posY +
      "\nA: Z/Espaco  B: X/Esc\nStart: Enter/M  Select: Tab\nL/R: Q/E  Correr: Shift"
    );
  }

  function openMenu() {
    if (state.menuOpen || isMessageVisible()) {
      return;
    }
    const el = getMenuEl();
    if (!el) {
      return;
    }
    state.menuOpen = true;
    state.paused = true;
    el.textContent = buildMenuText();
    el.classList.remove("hidden");
  }

  function closeMenu() {
    if (!state.menuOpen) {
      return;
    }
    const el = getMenuEl();
    if (el) {
      el.classList.add("hidden");
    }
    state.menuOpen = false;
    state.paused = false;
  }

  function toggleMenu() {
    if (state.menuOpen) {
      closeMenu();
    } else {
      openMenu();
    }
  }

  function getDialogById(dialogId) {
    if (!dialogId) {
      return null;
    }
    const base = window.WORLD || WORLD;
    const dialogs = base && base.dialogs;
    if (!Array.isArray(dialogs)) {
      return null;
    }
    for (let i = 0; i < dialogs.length; i += 1) {
      const dialog = dialogs[i];
      if (dialog && dialog.id === dialogId) {
        return dialog;
      }
    }
    return null;
  }

  function getDialogText(dialog) {
    if (!dialog) {
      return "";
    }
    if (Array.isArray(dialog.lines)) {
      return dialog.lines.join("\n");
    }
    if (typeof dialog.text === "string") {
      return dialog.text;
    }
    if (typeof dialog.title === "string") {
      return dialog.title;
    }
    return "";
  }

  function getWorldFlags() {
    const base = window.WORLD || WORLD;
    const flags = base && typeof base.flags === "object" ? base.flags : null;
    return flags || {};
  }

  function isEventLocked(ev) {
    if (!ev) {
      return false;
    }
    if (ev.locked === true) {
      return true;
    }
    const flag = typeof ev.lockFlag === "string" ? ev.lockFlag.trim() : "";
    if (!flag) {
      return false;
    }
    const flags = getWorldFlags();
    return !flags[flag];
  }

  function getEventLockMessage(ev) {
    if (ev && typeof ev.lockMessage === "string" && ev.lockMessage.trim()) {
      return ev.lockMessage.trim();
    }
    return "Portal bloqueado.";
  }

  function resolveConnectionSpawn(target) {
    const connection = target && typeof target.connection === "object" ? target.connection : null;
    if (!connection) {
      return null;
    }
    const mapId = typeof target.mapId === "string" && target.mapId ? target.mapId : null;
    if (!mapId) {
      return null;
    }
    const size = getMapLayoutTiles(null, mapId);
    if (!size) {
      return null;
    }
    const dir = String(connection.direction || "").toLowerCase();
    const offset = Number.isFinite(Number(connection.offset)) ? Math.trunc(Number(connection.offset)) : 0;
    const maxX = Math.max(0, size.width - 1);
    const maxY = Math.max(0, size.height - 1);
    let destX = state.player.tileX;
    let destY = state.player.tileY;

    if (dir === "up") {
      destX = state.player.tileX - offset;
      destY = Math.max(0, size.height - 2);
    } else if (dir === "down") {
      destX = state.player.tileX - offset;
      destY = Math.min(maxY, 1);
    } else if (dir === "left") {
      destX = Math.max(0, size.width - 2);
      destY = state.player.tileY - offset;
    } else if (dir === "right") {
      destX = Math.min(maxX, 1);
      destY = state.player.tileY - offset;
    } else {
      return null;
    }

    destX = clamp(Math.trunc(destX), 0, maxX);
    destY = clamp(Math.trunc(destY), 0, maxY);
    return { mapId, x: destX, y: destY };
  }

  function resolveDoorTarget(ev) {
    const target = ev && typeof ev.target === "object" ? ev.target : {};
    const mapId = typeof target.mapId === "string" && target.mapId ? target.mapId : state.mapId;
    const spawn = {
      x: target.x,
      y: target.y,
      facing: target.facing
    };
    const connection = resolveConnectionSpawn(target);
    if (connection) {
      spawn.x = connection.x;
      spawn.y = connection.y;
      if (!spawn.facing) {
        spawn.facing = state.player.facing;
      }
      return { mapId: connection.mapId, spawn };
    }
    return { mapId, spawn };
  }

  function clamp(value, min, max) {
    if (max < min) {
      return min;
    }
    return Math.max(min, Math.min(max, value));
  }

  function rectWidth(rect) {
    if (typeof rect.w === "number") {
      return rect.w;
    }
    if (typeof rect.width === "number") {
      return rect.width;
    }
    return 1;
  }

  function rectHeight(rect) {
    if (typeof rect.h === "number") {
      return rect.h;
    }
    if (typeof rect.height === "number") {
      return rect.height;
    }
    return 1;
  }

  function pointInRect(x, y, rect) {
    const w = rectWidth(rect);
    const h = rectHeight(rect);
    return x >= rect.x && y >= rect.y && x < rect.x + w && y < rect.y + h;
  }

  function npcBlocks(tileX, tileY) {
    for (let i = 0; i < state.npcs.length; i += 1) {
      const npc = state.npcs[i];
      if (!npc || !npc.solid) {
        continue;
      }
      if (npc.x === tileX && npc.y === tileY) {
        return true;
      }
    }
    return false;
  }

  function isBlocked(tileX, tileY) {
    if (tileX < 0 || tileY < 0 || tileX >= state.map.tilesX || tileY >= state.map.tilesY) {
      return true;
    }
    for (let i = 0; i < state.colliders.length; i += 1) {
      const rect = state.colliders[i];
      if (!rect) {
        continue;
      }
      if (pointInRect(tileX, tileY, rect)) {
        return true;
      }
    }
    if (npcBlocks(tileX, tileY)) {
      return true;
    }
    return false;
  }

  function handleDoorEvent(ev) {
    if (isEventLocked(ev)) {
      showMessage(getEventLockMessage(ev));
      return;
    }
    const resolved = resolveDoorTarget(ev);
    const mapId = resolved.mapId;
    const spawn = resolved.spawn;
    state.teleportCooldown = 0.35;
    if (mapId && mapId !== state.mapId) {
      loadMap(mapId, spawn);
      return;
    }
    if (Number.isFinite(spawn.x) || Number.isFinite(spawn.y)) {
      placePlayer(spawn);
      updateCamera();
    }
  }

  function handleDialogEvent(ev) {
    const dialogId = ev.dialogId || ev.dialog;
    const dialog = getDialogById(dialogId);
    const text = dialog ? getDialogText(dialog) : ev.text || "";
    if (text) {
      showMessage(text);
      return;
    }
    if (dialogId) {
      showMessage("Dialogo nao encontrado: " + dialogId);
      return;
    }
    showMessage("Dialogo");
  }

  function handleServerEvent(ev) {
    const eventType = String(ev?.eventType || "").trim();
    if (!eventType || !ev?.id) {
      return;
    }

    if (typeof window.UI?.useEvent === "function") {
      window.UI.useEvent(
        { id: ev.id, name: ev.name, eventType, payload: ev.payload || {} },
        { mapId: state.mapId }
      );
      return;
    }

    fetch("/api/event/use", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId: ev.id, mapId: state.mapId }),
    }).catch(() => { });
  }

  function handleActionEvent(ev) {
    if (!ev || !ev.action) {
      return;
    }
    const actionName = String(ev.action);
    const actionData = ev.data || {};
    console.log("🎮 Disparando ação:", actionName, actionData);
    fireWorldAction(actionName, actionData);
  }

  function handleInteract() {
    if (state.paused || state.teleportCooldown > 0) {
      return;
    }
    const vec = dirVector[state.player.facing] || { x: 0, y: 0 };
    const targetX = state.player.tileX + vec.x;
    const targetY = state.player.tileY + vec.y;
    const npc = getNpcAt(targetX, targetY) || getNpcAt(state.player.tileX, state.player.tileY);
    if (npc) {
      triggerNpcDialog(npc);
      return;
    }
    const tiles = [
      { x: targetX, y: targetY },
      { x: state.player.tileX, y: state.player.tileY }
    ];
    for (let i = 0; i < state.events.length; i += 1) {
      const ev = state.events[i];
      if (!ev || !ev.rect) {
        continue;
      }
      if (ev.once && state.triggered.has(ev.id)) {
        continue;
      }
      if (ev.trigger !== "interact" && ev.trigger !== "dblclick" && ev.type !== "door") {
        continue;
      }
      for (let j = 0; j < tiles.length; j += 1) {
        if (!pointInRect(tiles[j].x, tiles[j].y, ev.rect)) {
          continue;
        }
        if (ev.type === "message") {
          showMessage(ev.text || "Evento");
        } else if (ev.type === "door") {
          handleDoorEvent(ev);
        } else if (ev.type === "server") {
          handleServerEvent(ev);
        } else if (ev.type === "action") {
          handleActionEvent(ev);
        } else {
          handleDialogEvent(ev);
        }
        if (ev.once) {
          state.triggered.add(ev.id);
        }
        return;
      }
    }
  }

  function getNpcAt(tileX, tileY) {
    for (let i = 0; i < state.npcs.length; i += 1) {
      const npc = state.npcs[i];
      if (!npc) {
        continue;
      }
      if (npc.x === tileX && npc.y === tileY) {
        return npc;
      }
    }
    return null;
  }

  function getJumpDirAt(tileX, tileY) {
    if (!Array.isArray(state.jumps) || !state.jumps.length) {
      return null;
    }
    for (let i = 0; i < state.jumps.length; i += 1) {
      const jump = state.jumps[i];
      if (!jump) {
        continue;
      }
      const x = Number(jump.x);
      const y = Number(jump.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        continue;
      }
      if (x !== tileX || y !== tileY) {
        continue;
      }
      const dir = String(jump.dir || jump.direction || "").toLowerCase();
      if (dir && dirVector[dir]) {
        return dir;
      }
    }
    return null;
  }

  function triggerNpcDialog(npc) {
    if (!npc) {
      return;
    }
    if (npc.dialogId) {
      const dialog = getDialogById(npc.dialogId);
      const text = dialog ? getDialogText(dialog) : "";
      showMessage(text || "Dialogo");
      return;
    }
    if (npc.text) {
      showMessage(npc.text);
    }
  }

  function checkNpc() {
    if (state.paused) {
      return;
    }
    const npc = getNpcAt(state.player.tileX, state.player.tileY);
    if (!npc) {
      state.npcHold = null;
      return;
    }
    if (npc.trigger === "dblclick") {
      state.npcHold = npc.id;
      return;
    }
    if (state.npcHold === npc.id) {
      return;
    }
    state.npcHold = npc.id;
    triggerNpcDialog(npc);
  }

  // ========== WILD ENCOUNTER SYSTEM ==========
  async function checkWildEncounter() {
    if (state.paused || state.teleportCooldown > 0) {
      return;
    }

    // Se estiver em um terreno com encontros, tenta disparar
    const terrain = getMapTerrainType(state.mapId, state.player.tileX, state.player.tileY);
    if (!terrain) {
      return; // Não é terreno de encontro
    }

    // Probabilidade baseada no terreno (60% para grama, 40% para água, etc.)
    const encounterChance = getTerrainEncounterChance(terrain);
    const roll = Math.random();
    if (roll > encounterChance) {
      return; // Sem encontro desta vez
    }

    // Encontro disparado! Chama a API
    try {
      const response = await fetch(`/firered-api/encounter?mapId=${encodeURIComponent(state.mapId)}&terrain=${encodeURIComponent(terrain)}&playerLevel=5`);
      if (!response.ok) {
        console.warn("Encounter API error:", response.status);
        return;
      }

      const encounter = await response.json();
      if (encounter && encounter.encounter) {
        // Dispara evento de encontro no mundo
        fireWorldAction("wildencounter", {
          encounter: encounter.encounter,
          terrain: terrain
        });
      }
    } catch (error) {
      console.warn("Encounter request failed:", error);
    }
  }

  function getMapTerrainType(mapId, tileX, tileY) {
    // Mapa de terrenos por ID de mapa (conforme wild_encounters.js)
    const terrainMap = {
      "ViridianForest": "grass",
      "Route2": "grass",
      "Route3": "grass",
      "Route4": "grass",
      "Route5": "grass",
      "Route6": "grass",
      "Route7": "grass",
      "Route8": "grass",
      "Route9": "grass",
      "Route10": "grass",
      "Route11": "grass",
      "Route12": "grass",
      "Route13": "grass",
      "Route14": "grass",
      "Route15": "grass",
      "Route16": "grass",
      "Route17": "grass",
      "Route18": "grass",
      "Route19": "water",
      "Route20": "water",
      "Route21": "water",
      "Route22": "grass",
      "Route23": "grass",
      "Route24": "grass",
      "Route25": "grass",
      "LavenderTown": "grass",
      "CeruleanCave": "rock_smash"
    };

    return terrainMap[mapId] || null;
  }

  function getTerrainEncounterChance(terrain) {
    // Chance de encontro a cada passo (em %)
    const chances = {
      "grass": 0.15,        // 15%
      "water": 0.10,        // 10%
      "fishing": 0.20,      // 20%
      "rock_smash": 0.05    // 5%
    };

    return chances[terrain] || 0;
  }

  function checkEvents() {
    if (state.paused || state.teleportCooldown > 0) {
      return;
    }

    // Verifica encontro selvagem ANTES de eventos (encontro tem prioridade)
    checkWildEncounter();

    for (let i = 0; i < state.events.length; i += 1) {
      const ev = state.events[i];
      if (!ev || !ev.rect) {
        continue;
      }
      if (ev.once && state.triggered.has(ev.id)) {
        continue;
      }
      if (ev.trigger === "dblclick" || ev.trigger === "interact") {
        continue;
      }
      if (pointInRect(state.player.tileX, state.player.tileY, ev.rect)) {
        if (ev.type === "message") {
          showMessage(ev.text || "Evento");
        }
        if (ev.type === "door") {
          handleDoorEvent(ev);
        }
        if (ev.type === "server") {
          handleServerEvent(ev);
        }
        if (ev.type === "dialog") {
          handleDialogEvent(ev);
        }
        if (ev.type === "action") {
          handleActionEvent(ev);
        }
        if (ev.once) {
          state.triggered.add(ev.id);
        }
        break;
      }
    }
  }

  function handleDoubleClick(tileX, tileY) {
    if (state.paused || state.teleportCooldown > 0) {
      return;
    }
    const npc = getNpcAt(tileX, tileY);
    if (npc && npc.trigger === "dblclick") {
      triggerNpcDialog(npc);
      return;
    }
    for (let i = 0; i < state.events.length; i += 1) {
      const ev = state.events[i];
      if (!ev || !ev.rect) {
        continue;
      }
      if (ev.trigger !== "dblclick") {
        continue;
      }
      if (ev.once && state.triggered.has(ev.id)) {
        continue;
      }
      if (pointInRect(tileX, tileY, ev.rect)) {
        if (ev.type === "dialog") {
          handleDialogEvent(ev);
        } else if (ev.type === "message") {
          showMessage(ev.text || "Evento");
        } else if (ev.type === "door") {
          handleDoorEvent(ev);
        } else if (ev.type === "server") {
          handleServerEvent(ev);
        } else if (ev.type === "action") {
          handleActionEvent(ev);
        }
        if (ev.once) {
          state.triggered.add(ev.id);
        }
        break;
      }
    }
  }

  function triggerMapDoubleClick(tile) {
    if (!tile || typeof tile.x !== "number" || typeof tile.y !== "number") {
      return;
    }
    handleDoubleClick(tile.x, tile.y);
  }

  function tryMove(dir) {
    const vec = dirVector[dir];
    if (!vec) {
      return;
    }
    if (state.player.moving) {
      return;
    }

    // FireRed/LG: primeiro input em uma nova direção só vira o avatar.
    // Só começa a andar quando já está virado para aquela direção.
    if (state.player.facing !== dir) {
      state.player.facing = dir;
      return;
    }

    const nextTileX = state.player.tileX + vec.x;
    const nextTileY = state.player.tileY + vec.y;
    const jumpDir = getJumpDirAt(nextTileX, nextTileY);
    if (jumpDir === dir) {
      const landingX = nextTileX + vec.x;
      const landingY = nextTileY + vec.y;
      if (isBlocked(landingX, landingY)) {
        if (state.player.bumpTime <= 0) {
          state.player.bumpTime = 0.12;
        }
        return;
      }
      state.player.moving = true;
      state.player.vx = vec.x;
      state.player.vy = vec.y;
      state.player.moveTiles = 2;
      state.player.moveRemaining = TILE_SIZE * state.player.moveTiles;
      state.player.animTime = 0;
      return;
    }
    const npc = getNpcAt(nextTileX, nextTileY);
    if (npc && npc.solid) {
      if (state.player.bumpTime <= 0) {
        state.player.bumpTime = 0.12;
      }
      if (npc.trigger !== "dblclick" && state.npcHold !== npc.id) {
        state.npcHold = npc.id;
        triggerNpcDialog(npc);
      }
      return;
    }
    if (isBlocked(nextTileX, nextTileY)) {
      if (state.player.bumpTime <= 0) {
        state.player.bumpTime = 0.12;
      }
      return;
    }
    state.player.moving = true;
    state.player.vx = vec.x;
    state.player.vy = vec.y;
    state.player.moveTiles = 1;
    state.player.moveRemaining = TILE_SIZE;
    state.player.animTime = 0;
  }

  function updatePlayer(dt) {
    state.animClock = (state.animClock || 0) + dt;
    if (state.teleportCooldown > 0) {
      state.teleportCooldown = Math.max(0, state.teleportCooldown - dt);
    }
    if (state.player.bumpTime > 0) {
      state.player.bumpTime = Math.max(0, state.player.bumpTime - dt);
    }
    if (state.paused) {
      return;
    }
    const speedScale = state.input && state.input.run ? RUN_MULT : 1;
    if (state.player.moving) {
      state.player.animTime += dt * speedScale;
      const moveTiles = Number.isFinite(state.player.moveTiles)
        ? Math.max(1, Math.trunc(state.player.moveTiles))
        : 1;
      const step = Math.min(state.player.moveRemaining, MOVE_SPEED * speedScale * dt);
      state.player.x += state.player.vx * step;
      state.player.y += state.player.vy * step;
      state.player.moveRemaining -= step;
      if (state.player.moveRemaining <= 0.001) {
        state.player.moving = false;
        state.player.tileX += state.player.vx * moveTiles;
        state.player.tileY += state.player.vy * moveTiles;
        state.player.x = state.player.tileX * TILE_SIZE;
        state.player.y = state.player.tileY * TILE_SIZE;
        state.player.vx = 0;
        state.player.vy = 0;
        state.player.moveRemaining = 0;
        state.player.moveTiles = 1;
        checkEvents();
        checkNpc();
      }
    } else {
      const dir = getInputDir();
      if (dir) {
        tryMove(dir);
      }
    }
  }

  function resolveAssetPath(src) {
    const raw = String(src || "");
    if (!raw) return raw;
    if (/^(?:https?:)?\/\//i.test(raw) || raw.startsWith("data:") || raw.startsWith("/")) {
      return raw;
    }
    const root = String(CORE_CONFIG.assetsRoot || WORLD.assetsRoot || "").replace(/\/$/, "");
    if (!root) return raw;
    return `${root}/${raw.replace(/^\.?\//, "")}`;
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Failed to load image: " + src));
      img.src = resolveAssetPath(src);
    });
  }

  const imageCache = {};
  const binaryCache = {};
  const binaryOptionalCache = {};
  const transparentImageCache = {};
  const pngPaletteKeyCache = {};
  const tilesetCache = {};
  const layoutCache = { root: null, promise: null, map: null };

  const PRIMARY_METATILES = 640;
  const TILE_INDEX_MASK = 0x03ff;
  const TILE_HFLIP = 0x0400;
  const TILE_VFLIP = 0x0800;
  const LAYER_TYPE_COVERED = 1;
  const NUM_PALS_IN_PRIMARY = 7;
  const NUM_PALS_TOTAL = 13;
  const MAX_PALETTES = 16;
  const GRAY_RAMP = [255, 238, 222, 205, 189, 172, 156, 139, 115, 98, 82, 65, 49, 32, 16, 0];
  const GRAY_INDEX = (() => {
    const map = new Map();
    for (let i = 0; i < GRAY_RAMP.length; i += 1) {
      map.set(GRAY_RAMP[i], i);
    }
    return map;
  })();

  function getPokefireredRoot() {
    const base = window.WORLD || WORLD;
    const root = base && typeof base.pokefireredRoot === "string" ? base.pokefireredRoot : "";
    return root ? root.replace(/\/$/, "") : "pokefirered-master/pokefirered-master";
  }

  function loadImageCached(src) {
    if (!src) {
      return Promise.resolve(null);
    }
    if (imageCache[src]) {
      return imageCache[src];
    }
    const promise = loadImage(src).catch((err) => {
      console.warn(err);
      return null;
    });
    imageCache[src] = promise;
    return promise;
  }

  function fetchBinary(path) {
    if (!path) {
      return Promise.resolve(null);
    }
    if (binaryCache[path]) {
      return binaryCache[path];
    }
    const promise = fetch(path)
      .then((res) => {
        if (!res.ok) {
          throw new Error("HTTP " + res.status);
        }
        return res.arrayBuffer();
      })
      .catch((err) => {
        console.warn(err);
        return null;
      });
    binaryCache[path] = promise;
    return promise;
  }

  function fetchBinaryOptional(path) {
    if (!path) {
      return Promise.resolve(null);
    }
    if (binaryOptionalCache[path]) {
      return binaryOptionalCache[path];
    }
    const promise = fetch(path)
      .then((res) => (res.ok ? res.arrayBuffer() : null))
      .catch(() => null);
    binaryOptionalCache[path] = promise;
    return promise;
  }

  function parsePngPaletteKey(buffer) {
    if (!buffer || buffer.byteLength < 16) {
      return null;
    }
    const bytes = new Uint8Array(buffer);
    const signature = [137, 80, 78, 71, 13, 10, 26, 10];
    for (let i = 0; i < signature.length; i += 1) {
      if (bytes[i] !== signature[i]) {
        return null;
      }
    }
    const view = new DataView(buffer);
    let offset = 8;
    while (offset + 8 <= buffer.byteLength) {
      const length = view.getUint32(offset, false);
      offset += 4;
      const type =
        String.fromCharCode(bytes[offset]) +
        String.fromCharCode(bytes[offset + 1]) +
        String.fromCharCode(bytes[offset + 2]) +
        String.fromCharCode(bytes[offset + 3]);
      offset += 4;
      if (offset + length > buffer.byteLength) {
        return null;
      }
      if (type === "PLTE" && length >= 3) {
        return [bytes[offset], bytes[offset + 1], bytes[offset + 2]];
      }
      offset += length + 4;
    }
    return null;
  }

  function getPngPaletteKey(src) {
    if (!src) {
      return Promise.resolve(null);
    }
    if (pngPaletteKeyCache[src]) {
      return pngPaletteKeyCache[src];
    }
    const promise = fetchBinary(src)
      .then((buf) => parsePngPaletteKey(buf))
      .catch(() => null);
    pngPaletteKeyCache[src] = promise;
    return promise;
  }

  function ensureTransparentIndex0(img, keyColor) {
    if (!img || !img.width || !img.height) {
      return img;
    }
    const src = img.src || "";
    const cacheKey = src && keyColor ? src + "|" + keyColor.join(",") : src;
    if (cacheKey && transparentImageCache[cacheKey]) {
      return transparentImageCache[cacheKey];
    }
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx2d = canvas.getContext("2d");
    ctx2d.imageSmoothingEnabled = false;
    ctx2d.drawImage(img, 0, 0);
    const imageData = ctx2d.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    let hasAlpha = false;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 255) {
        hasAlpha = true;
        break;
      }
    }
    if (hasAlpha) {
      return img;
    }
    const counts = new Map();
    const total = canvas.width * canvas.height;
    for (let i = 0; i < data.length; i += 4) {
      const key = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
      counts.set(key, (counts.get(key) || 0) + 1);
      if (counts.size > 64) {
        return img;
      }
    }
    let targetKey = null;
    if (Array.isArray(keyColor) && keyColor.length >= 3) {
      targetKey = (keyColor[0] << 16) | (keyColor[1] << 8) | keyColor[2];
      if (!counts.has(targetKey)) {
        targetKey = null;
      }
    }
    if (targetKey === null) {
      const magicColors = [
        [255, 0, 255],
        [255, 0, 0],
        [0, 255, 0],
        [0, 0, 255],
        [0, 0, 0]
      ];
      for (let i = 0; i < magicColors.length; i += 1) {
        const color = magicColors[i];
        const key = (color[0] << 16) | (color[1] << 8) | color[2];
        if (counts.has(key)) {
          targetKey = key;
          break;
        }
      }
    }
    if (targetKey === null) {
      let maxKey = null;
      let maxCount = 0;
      counts.forEach((count, key) => {
        if (count > maxCount) {
          maxCount = count;
          maxKey = key;
        }
      });
      if (maxKey === null || maxCount < total * 0.5) {
        return img;
      }
      targetKey = maxKey;
    }
    for (let i = 0; i < data.length; i += 4) {
      const key = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
      if (key === targetKey) {
        data[i + 3] = 0;
      }
    }
    ctx2d.putImageData(imageData, 0, 0);
    if (cacheKey) {
      transparentImageCache[cacheKey] = canvas;
    }
    return canvas;
  }

  function loadLayouts(root) {
    const base = root || getPokefireredRoot();
    if (layoutCache.promise && layoutCache.root === base) {
      return layoutCache.promise;
    }
    layoutCache.root = base;
    layoutCache.promise = fetch(base + "/data/layouts/layouts.json")
      .then((res) => {
        if (!res.ok) {
          throw new Error("HTTP " + res.status);
        }
        return res.json();
      })
      .then((data) => {
        const map = {};
        const list = data && Array.isArray(data.layouts) ? data.layouts : [];
        for (let i = 0; i < list.length; i += 1) {
          const layout = list[i];
          if (layout && layout.id) {
            map[layout.id] = layout;
          }
        }
        layoutCache.map = map;
        return map;
      })
      .catch((err) => {
        console.warn(err);
        layoutCache.map = {};
        return {};
      });
    return layoutCache.promise;
  }

  function getLayoutById(layoutId, root) {
    if (!layoutId) {
      return Promise.resolve(null);
    }
    return loadLayouts(root).then((map) => map[layoutId] || null);
  }

  function tilesetNameToFolder(name) {
    if (!name) {
      return "";
    }
    let base = name.replace(/^gTileset_/, "");
    base = base.replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2");
    base = base.replace(/([a-z0-9])([A-Z])/g, "$1_$2");
    base = base.replace(/([a-zA-Z])([0-9])/g, "$1_$2");
    base = base.replace(/([0-9])([a-zA-Z])/g, "$1_$2");
    return base.toLowerCase();
  }

  function getTilesetPaths(tilesetName, kind, root) {
    const folder = tilesetNameToFolder(tilesetName);
    if (!folder) {
      return null;
    }
    const base = root + "/data/tilesets/" + kind + "/" + folder;
    let tilesFolder = folder;
    if (tilesetName === "gTileset_SilphCo") {
      tilesFolder = "condominiums";
    }
    const tilesBase = root + "/data/tilesets/" + kind + "/" + tilesFolder;
    return {
      tilesPath: tilesBase + "/tiles.png",
      metatilesPath: base + "/metatiles.bin",
      attrsPath: base + "/metatile_attributes.bin",
      palettesBase: tilesBase + "/palettes"
    };
  }

  function parsePaletteBuffer(buffer) {
    if (!buffer) {
      return null;
    }
    const bytes = new Uint8Array(buffer);
    let text = null;
    if (typeof TextDecoder !== "undefined") {
      text = new TextDecoder("utf-8").decode(bytes);
    } else {
      const limit = Math.min(bytes.length, 2048);
      let tmp = "";
      for (let i = 0; i < limit; i += 1) {
        tmp += String.fromCharCode(bytes[i]);
      }
      text = tmp;
    }
    if (text) {
      const cleaned = text.replace(/^\uFEFF/, "").trim();
      if (cleaned.startsWith("JASC-PAL")) {
        const lines = cleaned.split(/\r?\n/);
        const count = Number.parseInt(lines[2], 10);
        const colors = [];
        for (let i = 3; i < lines.length && colors.length < 16; i += 1) {
          if (Number.isFinite(count) && colors.length >= count) {
            break;
          }
          const parts = lines[i].trim().split(/\s+/);
          if (parts.length < 3) {
            continue;
          }
          const r = Number.parseInt(parts[0], 10);
          const g = Number.parseInt(parts[1], 10);
          const b = Number.parseInt(parts[2], 10);
          if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) {
            continue;
          }
          colors.push([clamp(r, 0, 255), clamp(g, 0, 255), clamp(b, 0, 255)]);
        }
        while (colors.length < 16) {
          colors.push([0, 0, 0]);
        }
        return colors;
      }
    }
    const view = new DataView(buffer);
    const colors = [];
    const count = Math.min(16, Math.floor(view.byteLength / 2));
    for (let i = 0; i < count; i += 1) {
      const value = view.getUint16(i * 2, true);
      const r = Math.round(((value & 0x1f) * 255) / 31);
      const g = Math.round((((value >> 5) & 0x1f) * 255) / 31);
      const b = Math.round((((value >> 10) & 0x1f) * 255) / 31);
      colors.push([r, g, b]);
    }
    while (colors.length < 16) {
      colors.push([0, 0, 0]);
    }
    return colors;
  }

  function loadTilesetPalettes(base) {
    if (!base) {
      return Promise.resolve([]);
    }
    const tasks = [];
    for (let i = 0; i < MAX_PALETTES; i += 1) {
      const name = String(i).padStart(2, "0");
      const path = base + "/" + name + ".pal";
      tasks.push(fetchBinaryOptional(path).then((buf) => parsePaletteBuffer(buf)));
    }
    return Promise.all(tasks);
  }

  function mergePalettes(primary, secondary) {
    const primaryList = Array.isArray(primary) ? primary : [];
    const secondaryList = Array.isArray(secondary) ? secondary : [];
    const combined = [];
    for (let i = 0; i < NUM_PALS_IN_PRIMARY; i += 1) {
      combined[i] = primaryList[i] || primaryList[0] || null;
    }
    for (let i = NUM_PALS_IN_PRIMARY; i < NUM_PALS_TOTAL; i += 1) {
      combined[i] = secondaryList[i] || secondaryList[NUM_PALS_IN_PRIMARY] || combined[0] || null;
    }
    for (let i = combined.length; i < MAX_PALETTES; i += 1) {
      combined[i] = combined[0] || null;
    }
    const hasAny = combined.some((pal) => pal && pal.length);
    return hasAny ? combined : [];
  }

  function buildPaletteSheets(img, palettes) {
    if (!img || !Array.isArray(palettes) || !palettes.length) {
      return null;
    }
    const basePalette = palettes.find((pal) => pal && pal.length);
    if (!basePalette) {
      return null;
    }
    const width = img.width;
    const height = img.height;
    if (!width || !height) {
      return null;
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx2d = canvas.getContext("2d");
    ctx2d.imageSmoothingEnabled = false;
    ctx2d.drawImage(img, 0, 0);
    const imageData = ctx2d.getImageData(0, 0, width, height);
    const data = imageData.data;
    let isGray = true;
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      if (a === 0) {
        continue;
      }
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (Math.abs(r - g) > 2 || Math.abs(g - b) > 2) {
        isGray = false;
        break;
      }
    }
    if (!isGray) {
      return null;
    }

    const getGrayIndex = (value) => {
      const direct = GRAY_INDEX.get(value);
      if (direct !== undefined) {
        return direct;
      }
      let best = 0;
      let bestDist = Infinity;
      for (let i = 0; i < GRAY_RAMP.length; i += 1) {
        const dist = Math.abs(GRAY_RAMP[i] - value);
        if (dist < bestDist) {
          bestDist = dist;
          best = i;
        }
      }
      return best;
    };

    const pixelCount = width * height;
    const indexData = new Uint8Array(pixelCount);
    for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
      const a = data[i + 3];
      if (a === 0) {
        indexData[p] = 0;
        continue;
      }
      indexData[p] = getGrayIndex(data[i]);
    }

    const sheets = new Array(palettes.length);
    for (let p = 0; p < palettes.length; p += 1) {
      const palette = palettes[p];
      if (!palette || palette.length < 16) {
        sheets[p] = null;
        continue;
      }
      const out = ctx2d.createImageData(width, height);
      const outData = out.data;
      for (let i = 0, px = 0; px < pixelCount; px += 1, i += 4) {
        const idx = indexData[px];
        if (idx === 0) {
          outData[i + 3] = 0;
          continue;
        }
        const color = palette[idx] || palette[0] || [0, 0, 0];
        outData[i] = color[0];
        outData[i + 1] = color[1];
        outData[i + 2] = color[2];
        outData[i + 3] = 255;
      }
      const sheet = document.createElement("canvas");
      sheet.width = width;
      sheet.height = height;
      const sheetCtx = sheet.getContext("2d");
      sheetCtx.imageSmoothingEnabled = false;
      sheetCtx.putImageData(out, 0, 0);
      sheets[p] = sheet;
    }
    return sheets;
  }

  function loadTilesetAssets(tilesetName, kind, root) {
    if (!tilesetName) {
      return Promise.resolve(null);
    }
    const key = [root, kind, tilesetName].join("|");
    if (tilesetCache[key]) {
      return tilesetCache[key];
    }
    const paths = getTilesetPaths(tilesetName, kind, root);
    if (!paths) {
      return Promise.resolve(null);
    }
    const promise = Promise.all([
      loadImageCached(paths.tilesPath),
      fetchBinary(paths.metatilesPath),
      fetchBinary(paths.attrsPath),
      loadTilesetPalettes(paths.palettesBase)
    ]).then(([img, metatilesBuf, attrsBuf, palettes]) => {
      if (!img || !metatilesBuf) {
        return null;
      }
      const cols = Math.floor(img.width / 8);
      const rows = Math.floor(img.height / 8);
      const count = cols * rows;
      return {
        name: tilesetName,
        kind,
        img,
        cols,
        rows,
        count,
        metatiles: new Uint16Array(metatilesBuf),
        attrs: attrsBuf ? new Uint32Array(attrsBuf) : new Uint32Array(0),
        palettes: Array.isArray(palettes) ? palettes : [],
        paletteSheets: null
      };
    });
    tilesetCache[key] = promise;
    return promise;
  }

  function buildFramePaths(base, count) {
    const frames = [];
    for (let i = 0; i < count; i += 1) {
      frames.push(base + i + ".png");
    }
    return frames;
  }

  function buildAnimConfigs(root, primaryName, secondaryName) {
    const configs = [];
    if (primaryName === "gTileset_General") {
      configs.push({
        id: "general_flower",
        offset: 508,
        count: 4,
        stepFrames: 16,
        frames: buildFramePaths(root + "/data/tilesets/primary/general/anim/flower/", 5)
      });
      configs.push({
        id: "general_water_current",
        offset: 416,
        count: 48,
        stepFrames: 16,
        frames: buildFramePaths(root + "/data/tilesets/primary/general/anim/water_current_landwatersedge/", 8)
      });
      configs.push({
        id: "general_sand_edge",
        offset: 464,
        count: 18,
        stepFrames: 8,
        frames: buildFramePaths(root + "/data/tilesets/primary/general/anim/sandwatersedge/", 8)
      });
    }
    if (secondaryName === "gTileset_CeladonCity") {
      configs.push({
        id: "celadon_city_fountain",
        offset: 744,
        count: 8,
        stepFrames: 12,
        frames: buildFramePaths(root + "/data/tilesets/secondary/celadon_city/anim/fountain/", 5)
      });
    }
    if (secondaryName === "gTileset_SilphCo") {
      configs.push({
        id: "silph_co_fountain",
        offset: 976,
        count: 8,
        stepFrames: 10,
        frames: buildFramePaths(root + "/data/tilesets/secondary/silph_co/anim/fountain/", 4)
      });
    }
    if (secondaryName === "gTileset_MtEmber") {
      configs.push({
        id: "mt_ember_steam",
        offset: 896,
        count: 8,
        stepFrames: 16,
        frames: buildFramePaths(root + "/data/tilesets/secondary/mt_ember/anim/steam/", 4)
      });
    }
    if (secondaryName === "gTileset_VermilionGym") {
      configs.push({
        id: "vermilion_gym_door",
        offset: 880,
        count: 7,
        stepFrames: 2,
        frames: buildFramePaths(root + "/data/tilesets/secondary/vermilion_gym/anim/motorizeddoor/", 2)
      });
    }
    if (secondaryName === "gTileset_CeladonGym") {
      configs.push({
        id: "celadon_gym_flowers",
        offset: 739,
        count: 4,
        stepFrames: 16,
        sequence: [0, 1, 2, 1],
        frames: buildFramePaths(root + "/data/tilesets/secondary/celadon_gym/anim/flowers/", 3)
      });
    }
    return configs;
  }

  async function loadTilesetAnimations(primaryName, secondaryName, root, palettes) {
    const configs = buildAnimConfigs(root, primaryName, secondaryName);
    if (!configs.length) {
      return [];
    }
    const tasks = configs.map(async (config) => {
      const images = await Promise.all(config.frames.map(loadImageCached));
      if (images.some((img) => !img)) {
        return null;
      }
      const cols = Math.floor(images[0].width / 8);
      const rows = Math.floor(images[0].height / 8);
      if (!cols || !rows) {
        return null;
      }
      let paletteFrames = null;
      if (Array.isArray(palettes) && palettes.length) {
        paletteFrames = [];
        for (let f = 0; f < images.length; f += 1) {
          const frame = images[f];
          if (!frame) {
            continue;
          }
          const sheets = buildPaletteSheets(frame, palettes);
          if (!sheets) {
            paletteFrames = null;
            break;
          }
          for (let p = 0; p < sheets.length; p += 1) {
            if (!paletteFrames[p]) {
              paletteFrames[p] = [];
            }
            paletteFrames[p][f] = sheets[p];
          }
        }
      }
      if (!paletteFrames) {
        const paletteKeys = await Promise.all(config.frames.map(getPngPaletteKey));
        for (let i = 0; i < images.length; i += 1) {
          images[i] = ensureTransparentIndex0(images[i], paletteKeys[i]);
        }
      }
      const sequence =
        Array.isArray(config.sequence) && config.sequence.length
          ? config.sequence.slice()
          : images.map((_, idx) => idx);
      return {
        id: config.id,
        offset: config.offset,
        count: config.count,
        stepFrames: config.stepFrames,
        frames: images,
        paletteFrames,
        sequence,
        frameCols: cols,
        frameTileCount: cols * rows
      };
    });
    const list = await Promise.all(tasks);
    return list.filter(Boolean);
  }

  function buildAnimTileIndex(anims) {
    const map = {};
    for (let i = 0; i < anims.length; i += 1) {
      const anim = anims[i];
      for (let j = 0; j < anim.count; j += 1) {
        map[anim.offset + j] = { anim, index: j };
      }
    }
    return map;
  }

  function getAnimFrame(anim, tick) {
    const sequence = anim.sequence;
    if (!sequence || !sequence.length) {
      return 0;
    }
    const step = Number.isFinite(anim.stepFrames) && anim.stepFrames > 0 ? anim.stepFrames : 1;
    const idx = Math.floor(tick / step) % sequence.length;
    const frame = sequence[idx];
    return Number.isFinite(frame) ? frame : 0;
  }

  function getTilesetImage(tileset, paletteIndex) {
    if (!tileset) {
      return null;
    }
    const sheets = tileset.paletteSheets;
    if (Array.isArray(sheets) && sheets.length) {
      const idx = Number.isFinite(paletteIndex) ? paletteIndex : 0;
      return sheets[idx] || sheets[0] || tileset.img;
    }
    if (!tileset.transparentImg) {
      tileset.transparentImg = ensureTransparentIndex0(tileset.img);
    }
    return tileset.transparentImg || tileset.img;
  }

  function getAnimFrameImage(anim, paletteIndex, tick) {
    if (!anim) {
      return null;
    }
    const frameIdx = getAnimFrame(anim, tick);
    const paletteFrames = anim.paletteFrames;
    if (paletteFrames && paletteFrames.length) {
      const idx = Number.isFinite(paletteIndex) ? paletteIndex : 0;
      const frames = paletteFrames[idx];
      if (frames && frames[frameIdx]) {
        return frames[frameIdx];
      }
    }
    if (anim.frames && anim.frames[frameIdx]) {
      return anim.frames[frameIdx];
    }
    return null;
  }

  function applyPalettesToTileset(tileset, palettes) {
    if (!tileset || !tileset.img || !Array.isArray(palettes) || !palettes.length) {
      return;
    }
    const sheets = buildPaletteSheets(tileset.img, palettes);
    if (sheets && sheets.length) {
      tileset.paletteSheets = sheets;
    }
  }

  async function buildMapRenderer(mapData) {
    const meta = mapData && mapData.meta;
    const layoutId = meta && meta.layoutId;
    if (!layoutId) {
      return null;
    }
    const root = getPokefireredRoot();
    const layout = await getLayoutById(layoutId, root);
    if (!layout) {
      return null;
    }
    const width = Number(layout.width) || 0;
    const height = Number(layout.height) || 0;
    if (!width || !height) {
      return null;
    }
    const blockPath = layout.blockdata_filepath ? root + "/" + layout.blockdata_filepath : "";
    if (!blockPath) {
      return null;
    }
    const primaryName = layout.primary_tileset || (meta && meta.primaryTileset) || "";
    const secondaryName = layout.secondary_tileset || (meta && meta.secondaryTileset) || "";

    console.log(`📦 Carregando tilesets para mapa "${layoutId}":`, {
      primary: primaryName,
      secondary: secondaryName,
      blockPath,
      dimensions: `${width}x${height}`
    });

    const [blockBuf, primary, secondary] = await Promise.all([
      fetchBinary(blockPath),
      loadTilesetAssets(primaryName, "primary", root),
      loadTilesetAssets(secondaryName, "secondary", root)
    ]);

    // ✅ Validação com logs detalhados
    if (!blockBuf) {
      console.error(`❌ Falha ao carregar block data: ${blockPath}`);
      return null;
    }
    if (!primary) {
      console.error(`❌ Falha ao carregar tileset PRIMARY: "${primaryName}"`);
      console.warn(`⚠️ Tentando continuar apenas com secondary tileset...`);
    }
    if (!secondary) {
      console.error(`❌ Falha ao carregar tileset SECONDARY: "${secondaryName}"`);
      console.warn(`⚠️ Tentando continuar apenas com primary tileset...`);
    }
    if (!primary && !secondary) {
      console.error(`❌ ERRO CRÍTICO: Nenhum tileset foi carregado!`);
      return null;
    }

    const palettes = mergePalettes(primary?.palettes, secondary?.palettes);
    if (!palettes || palettes.length === 0) {
      console.warn(`⚠️ Nenhuma paleta encontrada, usando paleta padrão`);
    }

    applyPalettesToTileset(primary, palettes);
    applyPalettesToTileset(secondary, palettes);
    const blocks = new Uint16Array(blockBuf);
    const tileSize = Number.isFinite(mapData.tileSize) ? mapData.tileSize : 16;

    console.log(`✅ Tilesets carregados com sucesso:`, {
      primaryTiles: primary?.count || 0,
      secondaryTiles: secondary?.count || 0,
      palettes: palettes?.length || 0,
      blocks: blocks.length
    });

    const renderer = {
      tileSize,
      tilesX: width,
      tilesY: height,
      width: width * tileSize,
      height: height * tileSize,
      blocks,
      blocksLength: Math.min(blocks.length, width * height),
      primary,
      secondary,
      animTiles: {},
      animations: [],
      palettes
    };
    try {
      const animations = await loadTilesetAnimations(primaryName, secondaryName, root, palettes);
      if (animations.length) {
        renderer.animations = animations;
        renderer.animTiles = buildAnimTileIndex(animations);
        console.log(`🎬 Animações de tiles carregadas: ${animations.length}`);
      }
    } catch (err) {
      console.warn(`⚠️ Erro ao carregar animações:`, err);
    }
    return renderer;
  }

  function loadPlayerSprite(spriteCfg) {
    if (!spriteCfg) {
      return Promise.resolve(null);
    }

    function sliceSpriteFrame(img, frameWidth, frameHeight, frameIndex, flipX) {
      if (!img || !img.width || !img.height) return null;
      const fw = Number(frameWidth);
      const fh = Number(frameHeight);
      const idx = Number(frameIndex);
      if (!Number.isFinite(fw) || !Number.isFinite(fh) || fw <= 0 || fh <= 0) return null;
      if (!Number.isFinite(idx) || idx < 0) return null;
      const framesPerRow = Math.max(1, Math.floor(img.width / fw));
      const rows = Math.max(1, Math.floor(img.height / fh));
      const total = framesPerRow * rows;
      if (!total || idx >= total) return null;

      const sx = (idx % framesPerRow) * fw;
      const sy = Math.floor(idx / framesPerRow) * fh;

      const canvas = document.createElement("canvas");
      canvas.width = fw;
      canvas.height = fh;
      const ctx2d = canvas.getContext("2d");
      ctx2d.imageSmoothingEnabled = false;
      if (flipX) {
        ctx2d.translate(fw, 0);
        ctx2d.scale(-1, 1);
      }
      ctx2d.drawImage(img, sx, sy, fw, fh, 0, 0, fw, fh);
      return canvas;
    }

    function normalizeFrameList(value) {
      if (Array.isArray(value)) {
        return value.map((n) => Number(n)).filter((n) => Number.isFinite(n) && n >= 0);
      }
      if (Number.isFinite(value)) {
        return [Number(value)];
      }
      return [];
    }

    const sprite = {
      fps: Number.isFinite(spriteCfg.fps) ? spriteCfg.fps : 6,
      targetHeightTiles: Number.isFinite(spriteCfg.targetHeightTiles) ? spriteCfg.targetHeightTiles : 3,
      idle: {},
      walk: {}
    };

    const dirs = ["up", "down", "left", "right"];
    const pending = [];

    // Suporte a spritesheet (ex.: pokefirered-master boy.png)
    const sheetCfg = spriteCfg.sheet && typeof spriteCfg.sheet === "object" ? spriteCfg.sheet : null;
    if (sheetCfg && typeof sheetCfg.src === "string" && sheetCfg.src) {
      const fw = Number.isFinite(sheetCfg.frameWidth) ? sheetCfg.frameWidth : 16;
      const fh = Number.isFinite(sheetCfg.frameHeight) ? sheetCfg.frameHeight : 32;
      const preset = String(sheetCfg.preset || "").trim().toLowerCase();

      // mapping: { idle: {down:0,...}, walk:{down:[1,2],...} }
      const idleMap = sheetCfg.idle && typeof sheetCfg.idle === "object" ? sheetCfg.idle : null;
      const walkMap = sheetCfg.walk && typeof sheetCfg.walk === "object" ? sheetCfg.walk : null;

      pending.push(
        loadImage(sheetCfg.src)
          .then((img) => {
            const toIdleIndex = (dir) => {
              if (idleMap && Number.isFinite(idleMap[dir])) return Number(idleMap[dir]);
              if (preset === "pokefirered-boy" || preset === "pokefirered-standard") {
                // FireRed (sAnimTable_Standard):
                // face south=0, face north=1, face west=2, face east=2 (hFlip)
                if (dir === "down") return 0;
                if (dir === "up") return 1;
                if (dir === "left") return 2;
                if (dir === "right") return 2;
              }
              return null;
            };

            const toWalkIndices = (dir) => {
              if (walkMap && (Array.isArray(walkMap[dir]) || Number.isFinite(walkMap[dir]))) {
                return normalizeFrameList(walkMap[dir]);
              }
              if (preset === "pokefirered-boy" || preset === "pokefirered-standard") {
                // FireRed (sAnimTable_Standard) usa estes frames para andar:
                // go south: 3,0,4,0
                // go north: 5,1,6,1
                // go west:  7,2,8,2
                // go east:  7,2,8,2 (hFlip)
                if (dir === "down") return [3, 4];
                if (dir === "up") return [5, 6];
                if (dir === "left") return [7, 8];
                if (dir === "right") return [7, 8];
              }
              return [];
            };

            for (let i = 0; i < dirs.length; i += 1) {
              const dir = dirs[i];
              const idleIdx = toIdleIndex(dir);
              const flipX = (preset === "pokefirered-boy" || preset === "pokefirered-standard") && dir === "right";
              if (Number.isFinite(idleIdx)) {
                const frame = sliceSpriteFrame(img, fw, fh, idleIdx, flipX);
                if (frame) sprite.idle[dir] = frame;
              }
              const walkIdxs = toWalkIndices(dir);
              if (walkIdxs.length) {
                sprite.walk[dir] = [];
                // FireRed/LG: durante o deslocamento o avatar alterna "pé" e "parado".
                // Para o nosso movimento 1-tile, usamos 4 fases: step -> idle -> step2 -> idle.
                // (left/right só tem 1 frame de passo; repetimos.)
                const expanded = [];
                expanded.push(walkIdxs[0]);
                if (Number.isFinite(idleIdx)) {
                  expanded.push(idleIdx);
                }
                expanded.push(walkIdxs.length > 1 ? walkIdxs[1] : walkIdxs[0]);
                if (Number.isFinite(idleIdx)) {
                  expanded.push(idleIdx);
                }

                for (let j = 0; j < expanded.length; j += 1) {
                  const frame = sliceSpriteFrame(img, fw, fh, expanded[j], flipX);
                  if (frame) sprite.walk[dir].push(frame);
                }
              }
            }
          })
          .catch((err) => {
            console.warn(err);
          })
      );
    }

    for (let i = 0; i < dirs.length; i += 1) {
      const dir = dirs[i];
      const idleSrc = spriteCfg.idle && spriteCfg.idle[dir];
      if (typeof idleSrc === "string" && idleSrc) {
        pending.push(
          loadImage(idleSrc)
            .then((img) => {
              sprite.idle[dir] = img;
            })
            .catch((err) => {
              console.warn(err);
            })
        );
      }

      const walkSrc = spriteCfg.walk && spriteCfg.walk[dir];
      const walkList = Array.isArray(walkSrc) ? walkSrc : typeof walkSrc === "string" ? [walkSrc] : [];
      if (walkList.length) {
        sprite.walk[dir] = [];
        for (let j = 0; j < walkList.length; j += 1) {
          const src = walkList[j];
          if (typeof src !== "string" || !src) {
            continue;
          }
          pending.push(
            loadImage(src)
              .then((img) => {
                sprite.walk[dir].push(img);
              })
              .catch((err) => {
                console.warn(err);
              })
          );
        }
      }
    }

    return Promise.all(pending).then(() => {
      const hasIdle = Object.keys(sprite.idle).length > 0;
      const hasWalk = Object.keys(sprite.walk).some((k) => Array.isArray(sprite.walk[k]) && sprite.walk[k].length);
      if (!hasIdle && !hasWalk) {
        return null;
      }
      return sprite;
    });
  }

  const npcSpriteCache = {};

  function preloadNpcSprites(npcs) {
    if (!Array.isArray(npcs)) {
      return;
    }

    // 🗺️ Garantir que o mapeamento esteja carregado antes de processar NPCs
    loadNpcSpriteMapping().then(() => {
      for (let i = 0; i < npcs.length; i += 1) {
        const npc = npcs[i];
        let src = npc && npc.sprite;
        if (typeof src !== "string" || !src) {
          continue;
        }

        // 🔄 Se o sprite ainda é um graphics_id (ex: OBJ_EVENT_GFX_*), converter para path
        if (src.startsWith("OBJ_EVENT_GFX_") || src === "0") {
          const convertedPath = getNpcSpritePath(src);
          if (convertedPath) {
            src = convertedPath;
            // Atualizar o NPC com o path correto para cache futuro
            npc.sprite = src;
            if (!npc.spriteSize) {
              npc.spriteSize = { w: 16, h: 32 };
            }
          } else {
            console.warn(`[NPC] Sprite não encontrado no mapeamento: ${src}`);
            continue;
          }
        }

        if (npcSpriteCache[src]) {
          continue;
        }

        const img = new Image();
        npcSpriteCache[src] = { img, ready: false, error: false };
        img.onload = () => {
          npcSpriteCache[src].ready = true;
        };
        img.onerror = () => {
          npcSpriteCache[src].error = true;
          console.error(`[NPC] Erro ao carregar sprite: ${src}`);
        };
        // NPCs usam paths relativos (ex.: pokefirered-master/...). Precisam respeitar assetsRoot (/core).
        img.src = resolveAssetPath(src);
      }
    }).catch((err) => {
      console.error("[NPC] Erro ao carregar mapeamento de sprites:", err);
    });
  }

  function getNpcSpriteImage(npc) {
    const src = npc && npc.sprite;
    if (typeof src !== "string" || !src) {
      return null;
    }
    const entry = npcSpriteCache[src];
    if (!entry) {
      preloadNpcSprites([npc]);
      return null;
    }
    if (!entry.ready || !entry.img || !entry.img.naturalWidth) {
      return null;
    }
    return entry.img;
  }

  function getNpcSpriteSize(npc) {
    const size = npc && npc.spriteSize;
    const width =
      (size && Number.isFinite(size.w) && size.w) ||
      (size && Number.isFinite(size.width) && size.width) ||
      TILE_SIZE;
    const height =
      (size && Number.isFinite(size.h) && size.h) ||
      (size && Number.isFinite(size.height) && size.height) ||
      TILE_SIZE;
    return { width, height };
  }

  function getNpcFrameBase(npc, totalFrames) {
    const movement = npc && npc.meta && npc.meta.movementType;
    if (!movement || !Number.isFinite(totalFrames) || totalFrames <= 1) {
      return 0;
    }
    let base = 0;
    if (movement.indexOf("FACE_UP") !== -1) {
      base = 3;
    } else if (movement.indexOf("FACE_LEFT") !== -1) {
      base = 6;
    } else if (movement.indexOf("FACE_RIGHT") !== -1) {
      base = 8;
    }
    if (base >= totalFrames) {
      base = 0;
    }
    return base;
  }

  function drawNpcSprite(npc) {
    const img = getNpcSpriteImage(npc);
    const size = getNpcSpriteSize(npc);
    const drawX = npc.x * TILE_SIZE - state.camera.x;
    const drawY = npc.y * TILE_SIZE - state.camera.y - Math.max(0, size.height - TILE_SIZE);
    if (drawX + size.width < 0 || drawY + size.height < 0 || drawX > viewportW || drawY > viewportH) {
      return;
    }
    if (!img) {
      ctx.save();
      ctx.fillStyle = "rgba(110, 231, 183, 0.8)";
      ctx.strokeStyle = "rgba(110, 231, 183, 0.95)";
      ctx.lineWidth = 1 / SCALE;
      const boxSize = TILE_SIZE * 0.9;
      const offset = TILE_SIZE * 0.05;
      ctx.fillRect(drawX + offset, drawY + offset, boxSize, boxSize);
      ctx.strokeRect(drawX + offset, drawY + offset, boxSize, boxSize);
      ctx.restore();
      return;
    }
    const framesPerRow = Math.max(1, Math.floor(img.width / size.width));
    const rows = Math.max(1, Math.floor(img.height / size.height));
    const totalFrames = framesPerRow * rows;
    const base = getNpcFrameBase(npc, totalFrames);
    let frame = base;

    // 🎭 NPCs estáticos não devem animar - apenas mostrar frame idle
    // Apenas NPCs com movimento (npc.moving === true) devem animar
    const isMoving = npc && npc.moving === true;
    if (isMoving && totalFrames > base + 1) {
      const animOffset = Math.floor(state.animClock * 2) % 2;
      frame = base + animOffset;
      if (frame >= totalFrames) {
        frame = base;
      }
    }

    const frameX = frame % framesPerRow;
    const frameY = Math.floor(frame / framesPerRow);
    const sx = frameX * size.width;
    const sy = frameY * size.height;
    ctx.drawImage(img, sx, sy, size.width, size.height, drawX, drawY, size.width, size.height);
  }

  function drawNpcs() {
    for (let i = 0; i < state.npcs.length; i += 1) {
      const npc = state.npcs[i];
      if (!npc) {
        continue;
      }
      drawNpcSprite(npc);
    }
  }

  // 🎨 Função para desenhar placeholder visual para tiles ausentes
  function drawMissingTilePlaceholder(dx, dy, size, tilesetType, tileIndex) {
    ctx.save();

    // Cor baseada no tipo de tileset
    const colors = {
      'primary': 'rgba(100, 100, 100, 0.3)',     // Cinza para primary
      'secondary': 'rgba(150, 100, 50, 0.3)',    // Marrom para secondary  
      'unknown': 'rgba(200, 50, 50, 0.3)'        // Vermelho para desconhecido
    };

    // Fundo semi-transparente
    ctx.fillStyle = colors[tilesetType] || colors['unknown'];
    ctx.fillRect(dx, dy, size, size);

    // Grid pattern para facilitar visualização
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(dx, dy, size, size);

    // X diagonal para indicar tile ausente (apenas se tile > 4x4 para não poluir)
    if (size >= 4) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(dx, dy);
      ctx.lineTo(dx + size, dy + size);
      ctx.moveTo(dx + size, dy);
      ctx.lineTo(dx, dy + size);
      ctx.stroke();
    }

    ctx.restore();
  }

  function getMetatileLayerType(renderer, metatileId) {
    if (!renderer) {
      return 0;
    }
    let attrs = renderer.primary && renderer.primary.attrs;
    let idx = metatileId;
    if (metatileId >= PRIMARY_METATILES) {
      attrs = renderer.secondary && renderer.secondary.attrs;
      idx = metatileId - PRIMARY_METATILES;
    }
    if (!attrs || idx < 0 || idx >= attrs.length) {
      return 0;
    }
    return (attrs[idx] >>> 29) & 0x3;
  }

  function drawTileEntry(renderer, entry, dx, dy, size, tick) {
    const tileIndex = entry & TILE_INDEX_MASK;
    const hFlip = (entry & TILE_HFLIP) !== 0;
    const vFlip = (entry & TILE_VFLIP) !== 0;
    const paletteIndex = (entry >>> 12) & 0x0f;
    let img = null;
    let cols = 0;
    let srcIndex = tileIndex;

    const animInfo = renderer.animTiles && renderer.animTiles[tileIndex];
    if (animInfo && animInfo.anim && animInfo.anim.frames && animInfo.anim.frames.length) {
      const anim = animInfo.anim;
      const frame = getAnimFrameImage(anim, paletteIndex, tick);
      if (frame && anim.frameCols && animInfo.index < anim.frameTileCount) {
        img = frame;
        cols = anim.frameCols;
        srcIndex = animInfo.index;
      }
    }

    if (!img) {
      if (tileIndex >= PRIMARY_METATILES) {
        const localIndex = tileIndex - PRIMARY_METATILES;
        const tileset = renderer.secondary;
        img = getTilesetImage(tileset, paletteIndex);
        cols = tileset && tileset.cols;
        if (!img || !cols || (tileset && tileset.count && localIndex >= tileset.count)) {
          // 🎨 Fallback: desenhar placeholder para tiles ausentes
          drawMissingTilePlaceholder(dx, dy, size, 'secondary', localIndex);
          return;
        }
        srcIndex = localIndex;
      } else {
        const tileset = renderer.primary;
        img = getTilesetImage(tileset, paletteIndex);
        cols = tileset && tileset.cols;
        if (!img || !cols || (tileset && tileset.count && tileIndex >= tileset.count)) {
          // 🎨 Fallback: desenhar placeholder para tiles ausentes
          drawMissingTilePlaceholder(dx, dy, size, 'primary', tileIndex);
          return;
        }
        srcIndex = tileIndex;
      }
    }

    if (!img || !cols) {
      // 🎨 Fallback final: placeholder genérico
      drawMissingTilePlaceholder(dx, dy, size, 'unknown', tileIndex);
      return;
    }
    const sx = (srcIndex % cols) * 8;
    const sy = Math.floor(srcIndex / cols) * 8;
    if (!hFlip && !vFlip) {
      ctx.drawImage(img, sx, sy, 8, 8, dx, dy, size, size);
      return;
    }
    ctx.save();
    ctx.translate(dx + (hFlip ? size : 0), dy + (vFlip ? size : 0));
    ctx.scale(hFlip ? -1 : 1, vFlip ? -1 : 1);
    ctx.drawImage(img, sx, sy, 8, 8, 0, 0, size, size);
    ctx.restore();
  }

  function drawMapBase(renderer, tick) {
    if (!renderer || !renderer.blocks) {
      return;
    }
    const tileSize = renderer.tileSize;
    if (!tileSize) {
      return;
    }
    const half = tileSize / 2;
    const startX = Math.floor(state.camera.x / tileSize);
    const startY = Math.floor(state.camera.y / tileSize);
    const endX = Math.min(renderer.tilesX, startX + Math.ceil(viewportW / tileSize) + 1);
    const endY = Math.min(renderer.tilesY, startY + Math.ceil(viewportH / tileSize) + 1);
    for (let y = startY; y < endY; y += 1) {
      if (y < 0) {
        continue;
      }
      const row = y * renderer.tilesX;
      // 🎯 Arredondar para evitar sub-pixel rendering (linhas pretas)
      const dy = Math.floor(y * tileSize - state.camera.y);
      for (let x = startX; x < endX; x += 1) {
        if (x < 0) {
          continue;
        }
        const idx = row + x;
        if (idx < 0 || idx >= renderer.blocksLength) {
          continue;
        }
        const block = renderer.blocks[idx];
        const metatileId = block & TILE_INDEX_MASK;
        if (metatileId === TILE_INDEX_MASK) {
          continue;
        }
        const layerType = getMetatileLayerType(renderer, metatileId);
        const isCovered = layerType === LAYER_TYPE_COVERED;
        let tiles = renderer.primary && renderer.primary.metatiles;
        let metatileIndex = metatileId;
        if (metatileId >= PRIMARY_METATILES) {
          tiles = renderer.secondary && renderer.secondary.metatiles;
          metatileIndex = metatileId - PRIMARY_METATILES;
        }
        if (!tiles) {
          continue;
        }
        const base = metatileIndex * 8;
        if (base + 7 >= tiles.length) {
          continue;
        }
        // 🎯 Arredondar para evitar sub-pixel rendering (linhas pretas)
        const dx = Math.floor(x * tileSize - state.camera.x);
        drawTileEntry(renderer, tiles[base], dx, dy, half, tick);
        drawTileEntry(renderer, tiles[base + 1], dx + half, dy, half, tick);
        drawTileEntry(renderer, tiles[base + 2], dx, dy + half, half, tick);
        drawTileEntry(renderer, tiles[base + 3], dx + half, dy + half, half, tick);
        if (isCovered) {
          drawTileEntry(renderer, tiles[base + 4], dx, dy, half, tick);
          drawTileEntry(renderer, tiles[base + 5], dx + half, dy, half, tick);
          drawTileEntry(renderer, tiles[base + 6], dx, dy + half, half, tick);
          drawTileEntry(renderer, tiles[base + 7], dx + half, dy + half, half, tick);
        }
      }
    }
  }

  function drawMapOverlay(renderer, tick) {
    if (!renderer || !renderer.blocks) {
      return;
    }
    const tileSize = renderer.tileSize;
    if (!tileSize) {
      return;
    }
    const half = tileSize / 2;
    const startX = Math.floor(state.camera.x / tileSize);
    const startY = Math.floor(state.camera.y / tileSize);
    const endX = Math.min(renderer.tilesX, startX + Math.ceil(viewportW / tileSize) + 1);
    const endY = Math.min(renderer.tilesY, startY + Math.ceil(viewportH / tileSize) + 1);
    for (let y = startY; y < endY; y += 1) {
      if (y < 0) {
        continue;
      }
      const row = y * renderer.tilesX;
      const dy = y * tileSize - state.camera.y;
      for (let x = startX; x < endX; x += 1) {
        if (x < 0) {
          continue;
        }
        const idx = row + x;
        if (idx < 0 || idx >= renderer.blocksLength) {
          continue;
        }
        const block = renderer.blocks[idx];
        const metatileId = block & TILE_INDEX_MASK;
        if (metatileId === TILE_INDEX_MASK) {
          continue;
        }
        const layerType = getMetatileLayerType(renderer, metatileId);
        if (layerType === LAYER_TYPE_COVERED) {
          continue;
        }
        let tiles = renderer.primary && renderer.primary.metatiles;
        let metatileIndex = metatileId;
        if (metatileId >= PRIMARY_METATILES) {
          tiles = renderer.secondary && renderer.secondary.metatiles;
          metatileIndex = metatileId - PRIMARY_METATILES;
        }
        if (!tiles) {
          continue;
        }
        const base = metatileIndex * 8;
        if (base + 7 >= tiles.length) {
          continue;
        }
        const dx = x * tileSize - state.camera.x;
        drawTileEntry(renderer, tiles[base + 4], dx, dy, half, tick);
        drawTileEntry(renderer, tiles[base + 5], dx + half, dy, half, tick);
        drawTileEntry(renderer, tiles[base + 6], dx, dy + half, half, tick);
        drawTileEntry(renderer, tiles[base + 7], dx + half, dy + half, half, tick);
      }
    }
  }

  function updateCamera() {
    const camX = state.player.x + TILE_SIZE / 2 - viewportW / 2;
    const camY = state.player.y + TILE_SIZE / 2 - viewportH / 2;

    // 🎯 Para mapas menores que o viewport, manter câmera em (0,0)
    // A centralização é feita pelo offset na função render()
    const mapWidth = state.map.width || 0;
    const mapHeight = state.map.height || 0;

    let maxX = 0;
    let maxY = 0;

    if (mapWidth > viewportW) {
      maxX = mapWidth - viewportW;
    }
    if (mapHeight > viewportH) {
      maxY = mapHeight - viewportH;
    }

    state.camera.x = clamp(Math.round(camX), 0, maxX);
    state.camera.y = clamp(Math.round(camY), 0, maxY);
  }

  function drawPlayer() {
    const drawX = Math.round(state.player.x - state.camera.x);
    const drawY = Math.round(state.player.y - state.camera.y);

    if (state.playerSprite) {
      const dir = state.player.facing;
      const sprite = state.playerSprite;
      let img = null;

      const walkFrames = sprite.walk && sprite.walk[dir];
      if (state.player.moving && Array.isArray(walkFrames) && walkFrames.length) {
        // No FireRed/LG, o frame do passo é acoplado ao deslocamento dentro do tile.
        // Aqui o movimento sempre percorre 1 tile (TILE_SIZE), então usamos moveRemaining
        // para derivar uma fase 0..3 (step/idle/step/idle) quando disponível.
        if (walkFrames.length >= 4 && Number.isFinite(state.player.moveRemaining) && TILE_SIZE > 0) {
          const moveTiles = Number.isFinite(state.player.moveTiles)
            ? Math.max(1, Math.trunc(state.player.moveTiles))
            : 1;
          const moveTotal = TILE_SIZE * moveTiles;
          const progress = clamp(1 - state.player.moveRemaining / moveTotal, 0, 0.999999);
          const phase = Math.max(0, Math.min(3, Math.floor(progress * 4)));
          img = walkFrames[phase] || walkFrames[0];
        } else {
          const fps = Number.isFinite(sprite.fps) ? sprite.fps : 6;
          const idx = Math.floor(state.player.animTime * fps) % walkFrames.length;
          img = walkFrames[idx];
        }
      }

      // "Bump" curto ao tentar andar contra algo (sem deslocar).
      if (!img && !state.player.moving && state.player.bumpTime > 0 && Array.isArray(walkFrames) && walkFrames.length) {
        if (walkFrames.length >= 4) {
          // Com o ciclo [step, idle, step2, idle], mostramos "step" e voltamos pro idle.
          img = state.player.bumpTime > 0.06 ? walkFrames[0] : walkFrames[1] || walkFrames[0];
        } else {
          img = walkFrames[0];
        }
      }

      if (!img) {
        img = (sprite.idle && sprite.idle[dir]) || (sprite.idle && sprite.idle.down) || null;
      }

      if (img) {
        const targetHeightTiles = Number.isFinite(sprite.targetHeightTiles) ? sprite.targetHeightTiles : 3;
        const targetH = TILE_SIZE * targetHeightTiles;
        const scale = targetH / img.height;
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);

        const px = Math.round(drawX + TILE_SIZE / 2 - w / 2);
        const py = Math.round(drawY + TILE_SIZE - h);
        ctx.drawImage(img, px, py, w, h);

        const label = PLAYER_CFG && PLAYER_CFG.name;
        drawNameLabel(label, Math.round(drawX + TILE_SIZE / 2), Math.round(py - 2));
        return;
      }
    }

    ctx.fillStyle = PLAYER_CFG.color || "#e6d45a";
    ctx.fillRect(drawX, drawY, TILE_SIZE, TILE_SIZE);
    drawNameLabel(PLAYER_CFG && PLAYER_CFG.name, Math.round(drawX + TILE_SIZE / 2), Math.round(drawY - 2));
  }

  function drawOtherPlayers() {
    if (!state.otherPlayers || !state.otherPlayers.size) return;

    for (const p of state.otherPlayers.values()) {
      if (!p) continue;

      const worldX = Number.isFinite(p.x) ? p.x : p.tileX * TILE_SIZE;
      const worldY = Number.isFinite(p.y) ? p.y : p.tileY * TILE_SIZE;
      const drawX = Math.round(worldX - state.camera.x);
      const drawY = Math.round(worldY - state.camera.y);

      // dispara preload do sprite (cache)
      const sprite = ensureOtherPlayerSprite(p.spriteId);
      if (!sprite) {
        // placeholder simples
        ctx.fillStyle = "rgba(255,255,255,0.25)";
        ctx.fillRect(drawX, drawY, TILE_SIZE, TILE_SIZE);
        drawNameLabel(p.name, Math.round(drawX + TILE_SIZE / 2), Math.round(drawY - 2));
        continue;
      }

      const dir = p.facing || "down";
      let img = null;

      const walkFrames = sprite.walk && sprite.walk[dir];
      if (p.moving && Array.isArray(walkFrames) && walkFrames.length) {
        if (walkFrames.length >= 4 && Number.isFinite(p.moveRemaining) && Number.isFinite(p.moveTotal) && p.moveTotal > 0) {
          const progress = clamp(1 - p.moveRemaining / p.moveTotal, 0, 0.999999);
          const phase = Math.max(0, Math.min(3, Math.floor(progress * 4)));
          img = walkFrames[phase] || walkFrames[0];
        } else {
          const fps = Number.isFinite(sprite.fps) ? sprite.fps : 6;
          const t = Number.isFinite(p.animTime) ? p.animTime : 0;
          const idx = Math.floor(t * fps) % walkFrames.length;
          img = walkFrames[idx];
        }
      }

      if (!img) {
        img = (sprite.idle && (sprite.idle[dir] || sprite.idle.down)) || null;
      }
      if (!img) {
        ctx.fillStyle = "rgba(255,255,255,0.25)";
        ctx.fillRect(drawX, drawY, TILE_SIZE, TILE_SIZE);
        drawNameLabel(p.name, Math.round(drawX + TILE_SIZE / 2), Math.round(drawY - 2));
        continue;
      }

      const targetHeightTiles = Number.isFinite(sprite.targetHeightTiles) ? sprite.targetHeightTiles : 2;
      const targetH = TILE_SIZE * targetHeightTiles;
      const scale = targetH / img.height;
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);

      const px = Math.round(drawX + TILE_SIZE / 2 - w / 2);
      const py = Math.round(drawY + TILE_SIZE - h);
      ctx.drawImage(img, px, py, w, h);
      drawNameLabel(p.name, Math.round(drawX + TILE_SIZE / 2), Math.round(py - 2));
    }
  }

  function drawGridOverlay() {
    const lineWidth = 1 / SCALE;
    const offsetX = -(state.camera.x % TILE_SIZE);
    const offsetY = -(state.camera.y % TILE_SIZE);
    ctx.save();
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = "rgba(0, 0, 0, 0.35)";
    for (let x = offsetX; x <= viewportW; x += TILE_SIZE) {
      ctx.beginPath();
      ctx.moveTo(x + lineWidth, 0);
      ctx.lineTo(x + lineWidth, viewportH);
      ctx.stroke();
    }
    for (let y = offsetY; y <= viewportH; y += TILE_SIZE) {
      ctx.beginPath();
      ctx.moveTo(0, y + lineWidth);
      ctx.lineTo(viewportW, y + lineWidth);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawOverlayRect(rect, strokeStyle, fillStyle) {
    const width = rectWidth(rect) * TILE_SIZE;
    const height = rectHeight(rect) * TILE_SIZE;
    const x = rect.x * TILE_SIZE - state.camera.x;
    const y = rect.y * TILE_SIZE - state.camera.y;
    ctx.save();
    ctx.lineWidth = 1 / SCALE;
    ctx.strokeStyle = strokeStyle;
    if (fillStyle) {
      ctx.fillStyle = fillStyle;
      ctx.fillRect(x, y, width, height);
    }
    ctx.strokeRect(x, y, width, height);
    ctx.restore();
  }

  function drawCollidersOverlay() {
    for (let i = 0; i < state.colliders.length; i += 1) {
      const rect = state.colliders[i];
      if (!rect) {
        continue;
      }
      drawOverlayRect(rect, "rgba(255, 120, 120, 0.8)", "rgba(255, 120, 120, 0.18)");
    }
  }

  function drawEventsOverlay() {
    const colors = {
      message: { stroke: "rgba(244, 192, 79, 0.85)", fill: "rgba(244, 192, 79, 0.2)" },
      door: { stroke: "rgba(114, 189, 255, 0.85)", fill: "rgba(114, 189, 255, 0.2)" },
      dialog: { stroke: "rgba(129, 230, 217, 0.85)", fill: "rgba(129, 230, 217, 0.2)" },
      fallback: { stroke: "rgba(255, 255, 255, 0.6)", fill: "rgba(255, 255, 255, 0.12)" }
    };
    for (let i = 0; i < state.events.length; i += 1) {
      const ev = state.events[i];
      if (!ev || !ev.rect) {
        continue;
      }
      const color = colors[ev.type] || colors.fallback;
      drawOverlayRect(ev.rect, color.stroke, color.fill);
    }
  }

  function drawNpcsOverlay() {
    ctx.save();
    ctx.fillStyle = "rgba(110, 231, 183, 0.8)";
    ctx.strokeStyle = "rgba(110, 231, 183, 0.95)";
    ctx.lineWidth = 1 / SCALE;
    for (let i = 0; i < state.npcs.length; i += 1) {
      const npc = state.npcs[i];
      if (!npc) {
        continue;
      }
      const x = npc.x * TILE_SIZE - state.camera.x;
      const y = npc.y * TILE_SIZE - state.camera.y;
      const size = TILE_SIZE * 0.9;
      const offset = TILE_SIZE * 0.05;
      ctx.fillRect(x + offset, y + offset, size, size);
      ctx.strokeRect(x + offset, y + offset, size, size);
    }
    ctx.restore();
  }

  function drawSelectedTile(tile) {
    if (!tile || tile.x === null || tile.y === null) {
      return;
    }
    const x = tile.x * TILE_SIZE - state.camera.x;
    const y = tile.y * TILE_SIZE - state.camera.y;
    if (x + TILE_SIZE < 0 || y + TILE_SIZE < 0 || x > viewportW || y > viewportH) {
      return;
    }
    ctx.save();
    ctx.lineWidth = 2 / SCALE;
    ctx.strokeStyle = "rgba(244, 192, 79, 0.95)";
    ctx.strokeRect(x + 1, y + 1, TILE_SIZE - 2, TILE_SIZE - 2);
    ctx.restore();
  }

  // 🎨 Cache Logic for Optimizing Render
  function updateMapCache(renderer) {
    if (!renderer || !renderer.tileSize) return;

    // Check if we need to invalidade cache
    if (state.cache.ready && state.cache.mapId === state.mapId && state.cache.canvas) {
      return; // Cache valid
    }

    // console.time("MapCache"); // Removed debug log
    const mapW = renderer.width;
    const mapH = renderer.height;

    // Create or resize canvas
    if (!state.cache.canvas) {
      state.cache.canvas = document.createElement("canvas");
      state.cache.ctx = state.cache.canvas.getContext("2d", { alpha: false }); // Optimization
    }

    // Safety check for huge maps (browser limit usually around 16k or 32k)
    // If map is huge, we might need chunking, but for now let's hope it fits.
    // > 4096 is common, > 8092 rare for single images.

    state.cache.canvas.width = mapW;
    state.cache.canvas.height = mapH;

    const cctx = state.cache.ctx;
    const tileSize = renderer.tileSize;
    const half = tileSize / 2;

    // Draw Background Color
    const palette = renderer.palettes && renderer.palettes[0];
    const backdrop = palette && palette[0];
    if (backdrop) {
      cctx.fillStyle = "rgb(" + backdrop[0] + "," + backdrop[1] + "," + backdrop[2] + ")";
      cctx.fillRect(0, 0, mapW, mapH);
    } else {
      cctx.fillStyle = "#000000";
      cctx.fillRect(0, 0, mapW, mapH);
    }

    // Static Draw of all tiles (ignoring camera)
    // Duplicate simplified logic from drawMapBase but with loops 0..tilesX

    const tilesX = renderer.tilesX;
    const tilesY = renderer.tilesY;
    // We pass a fake "tick" 0 for static cache. 
    // Animated tiles will be static in cache, and we can layer dynamic ones later if needed.
    const tick = 0;

    // Helper to draw tile to cache
    function drawCacheTile(entry, dx, dy, size) {
      // Reusing drawTileEntry logic but passing context
      // Since drawTileEntry uses global 'ctx', we need to temporarily swap utils or pass context
      // Refactoring drawTileEntry is cleaner.
      // For now, let's use a trick: save global ctx, overwrite with cached, restore.
      // Not thread safe but JS is single thread.
      // Actually, let's refactor drawTileEntry slightly to accept ctx?
      // No, drawTileEntry is too deep.
      // Let's implement a specific drawTileToCtx inside updateMapCache to be safe and fast.

      const tileIndex = entry & TILE_INDEX_MASK;
      const hFlip = (entry & TILE_HFLIP) !== 0;
      const vFlip = (entry & TILE_VFLIP) !== 0;
      const paletteIndex = (entry >>> 12) & 0x0f;

      let img = null;
      let cols = 0;
      let srcIndex = tileIndex;

      // Skip animation logic for static cache (or take frame 0)

      if (tileIndex >= PRIMARY_METATILES) {
        const localIndex = tileIndex - PRIMARY_METATILES;
        const tileset = renderer.secondary;
        img = getTilesetImage(tileset, paletteIndex);
        cols = tileset && tileset.cols;
        srcIndex = localIndex;
      } else {
        const tileset = renderer.primary;
        img = getTilesetImage(tileset, paletteIndex);
        cols = tileset && tileset.cols;
        srcIndex = tileIndex;
      }

      if (!img || !cols) return;

      // 🚨 CRITICAL: Se a imagem não carregou ainda, abortar cache
      if (!img.complete || img.naturalWidth === 0) {
        state.cache.ready = false; // Invalidate
        return;
      }

      const sx = (srcIndex % cols) * 8;
      const sy = Math.floor(srcIndex / cols) * 8;

      if (!hFlip && !vFlip) {
        cctx.drawImage(img, sx, sy, 8, 8, dx, dy, size, size);
        return;
      }
      cctx.save();
      cctx.translate(dx + (hFlip ? size : 0), dy + (vFlip ? size : 0));
      cctx.scale(hFlip ? -1 : 1, vFlip ? -1 : 1);
      cctx.drawImage(img, sx, sy, 8, 8, 0, 0, size, size);
      cctx.restore();
    }

    // Check blocks
    for (let y = 0; y < tilesY; y++) {
      const row = y * tilesX;
      const dy = y * tileSize;
      for (let x = 0; x < tilesX; x++) {
        const idx = row + x;
        if (idx >= renderer.blocksLength) continue;

        const block = renderer.blocks[idx];
        const metatileId = block & TILE_INDEX_MASK;
        if (metatileId === TILE_INDEX_MASK) continue;

        const layerType = (getMetatileLayerType(renderer, metatileId));
        const isCovered = layerType === LAYER_TYPE_COVERED;
        // getMetatileLayerType relies on renderer.primary...

        let tiles = renderer.primary && renderer.primary.metatiles;
        let metatileIndex = metatileId;
        if (metatileId >= PRIMARY_METATILES) {
          tiles = renderer.secondary && renderer.secondary.metatiles;
          metatileIndex = metatileId - PRIMARY_METATILES;
        }
        if (!tiles) continue;

        const base = metatileIndex * 8;
        if (base + 7 >= tiles.length) continue;

        const dx = x * tileSize;

        // Draw Bottom Layers
        drawCacheTile(tiles[base], dx, dy, half);
        drawCacheTile(tiles[base + 1], dx + half, dy, half);
        drawCacheTile(tiles[base + 2], dx, dy + half, half);
        drawCacheTile(tiles[base + 3], dx + half, dy + half, half);

        // Draw Top Layers (Covered) immediately on cache?
        // If the layer is 'covered', it should obscure the player, so it CANNOT be in the base cache.
        // It must be drawn AFTER the player in the main render loop.
        // So we ONLY draw 'Background' layers here.

        // But wait, the original drawMapBase handles 'covered' logic by checking 'isCovered'.
        // if (isCovered) it draws base+4..7.
        // Actually, drawMapBase draws EVERYTHING.
        // And 'drawMapOverlay' draws the TOP layers?
        // Let's check drawMapOverlay (line 2858):
        // It iterates AGAIN and if (layerType !== LAYER_TYPE_COVERED) continue.
        // Ah, wait. drawMapBase ALSO draws covered layers?
        // Lines 2848-2853 in drawMapBase: if (isCovered) draw...
        // So drawMapBase draws BOTH bottom and top layers if covered?
        // That means the player would be behind the covered layer if drawn after?
        // No, drawMapBase is called BEFORE drawPlayer.
        // So if drawMapBase draws covered layer, the player is drawn ON TOP of it.
        // That seems wrong for 'covered'.
        // FireRed logic:
        // Bg -> Player -> Foreground (Covered)

        // Let's look at render():
        // drawMapBase()
        // drawNpcs()
        // drawOtherPlayers()
        // drawPlayer()
        // drawMapOverlay()

        // So:
        // drawMapBase SHOULD NOT draw covered layers typically, or it draws them as background?
        // If isCovered is true, `drawMapBase` draws the Upper Layer tiles (4-7) AT THE SAME TIME.
        // This means those tiles are effectively background tiles that just happen to use the "upper" slot in metatile definition.
        // BUT `drawMapOverlay` logic loops again and finds `LAYER_TYPE_COVERED` and draws tiles 4-7.
        // So `drawMapOverlay` draws them AGAIN on top of player?
        // No, `drawMapOverlay` checks: `if (layerType === LAYER_TYPE_COVERED) continue;`.
        // Wait, line 2891: `if (layerType === LAYER_TYPE_COVERED) continue;` -> IT SKIPS COVERED!
        // It seems `drawMapOverlay` draws NON-covered layers? That's confusing.
        // Actually let's re-read line 2891 in `drawMapOverlay`:
        /*
         const layerType = getMetatileLayerType(renderer, metatileId);
         if (layerType === LAYER_TYPE_COVERED) {
           continue;
         }
        */
        // So `drawMapOverlay` skips covered tiles.
        // `drawMapBase` draws everything (bottom 0-3) and optionally (top 4-7 if covered).

        // Wait, if `drawMapOverlay` skips covered, what does it draw?
        // It draws tiles 4-7 for non-covered?
        // Ah, maybe "Covered" means "Player is covered by it" (Foreground).
        // Usually LayerType 1 = Covered (Over hero), LayerType 2 = Normal.

        // If I want to cache the "Background" (everything below player), I should cache what `drawMapBase` draws.
        // Does `drawMapBase` draw the "Foreground" (Covering player)?
        // If `drawMapBase` draws tiles 4-7 when `isCovered`, and `drawPlayer` is called AFTER, then Player is ON TOP of "Covered" tiles.
        // This suggests "isCovered" in `drawMapBase` context might mean "Has second layer" but not necessarily "Above player".

        // However, looking at standard FireRed map rendering:
        // "Triple Layer": Bottom, Middle (Player sits here), Top (Over player).

        // If `drawMapBase` draws everything, and then Player is drawn, the Player is always on top.
        // Except `drawMapOverlay`.
        // `drawMapOverlay` draws tiles 4-7 for *non-covered*? That sounds weird.
        // Unless `layerType === LAYER_TYPE_COVERED` means "This metatile acts as a block/wall" or something else?

        // Let's trust `drawMapBase` as "The thing that draws underneath the player".
        // If I cache what `drawMapBase` does, I'm safe for the background.
        // `drawMapOverlay` is called AFTER `drawPlayer`.

        // So my `updateMapCache` should replicate `drawMapBase`.

        // REPLICATING drawMapBase LOGIC:
        if (isCovered) {
          drawCacheTile(tiles[base + 4], dx, dy, half);
          drawCacheTile(tiles[base + 5], dx + half, dy, half);
          drawCacheTile(tiles[base + 6], dx, dy + half, half);
          drawCacheTile(tiles[base + 7], dx + half, dy + half, half);
        }
      }
    }

    // Se chegamos aqui sem abortar, o cache está pronto (exceto se invalidado dentro do loop)
    if (state.cache.ready !== false) {
      state.cache.ready = true;
      state.cache.mapId = state.mapId;
    }
    // console.timeEnd("MapCache"); // Removed debug log
  }


  function render() {
    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);

    // 🎨 Sempre preencher fundo com preto primeiro (padrão consistente)
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, viewportW, viewportH);

    const renderer = state.mapRenderer;
    const animTick = renderer ? Math.floor(state.animClock * 60) : 0;

    // 🎯 Calcular offset para centralizar mapas menores que o viewport
    let offsetX = 0;
    let offsetY = 0;

    if (renderer) {
      const mapPixelWidth = renderer.width || 0;
      const mapPixelHeight = renderer.height || 0;

      // Se o mapa for menor que o viewport, centralizar
      if (mapPixelWidth > 0 && mapPixelWidth < viewportW) {
        offsetX = Math.floor((viewportW - mapPixelWidth) / 2);
      }
      if (mapPixelHeight > 0 && mapPixelHeight < viewportH) {
        offsetY = Math.floor((viewportH - mapPixelHeight) / 2);
      }
    }

    // Aplicar offset de centralização
    if (offsetX !== 0 || offsetY !== 0) {
      ctx.translate(offsetX, offsetY);
    }

    if (renderer) {
      // ⚡ OTIMIZAÇÃO: Usar Cache se disponível
      if (!state.cache.ready || state.cache.mapId !== state.mapId) {
        updateMapCache(renderer);
      }

      if (state.cache.ready && state.cache.canvas) {
        // Source: cameraX, cameraY
        let sx = Math.floor(state.camera.x);
        let sy = Math.floor(state.camera.y);

        // Dimensões do Viewport (em pixels lógicos)
        const vw = viewportW;
        const vh = viewportH;

        // Dimensões do Mapa
        const mw = state.cache.canvas.width;
        const mh = state.cache.canvas.height;

        // 🎯 Clipping: Garantir que não tentamos ler fora do canvas do cache
        // Se o mapa for menor que o viewport, desenhamos o mapa todo no destino
        let sw = Math.min(vw, mw - sx);
        let sh = Math.min(vh, mh - sy);

        // Se por algum motivo sx/sy for negativo ou maior que o mapa após o clamp
        if (sw <= 0 || sh <= 0) {
          // Fallback brute force se o clipping der ruim
          drawMapBase(renderer, animTick);
        } else {
          // Desenhar do Cache para o Canvas principal
          // dx, dy em 0,0 porque o translate de centralização já foi aplicado
          ctx.drawImage(state.cache.canvas, sx, sy, sw, sh, 0, 0, sw, sh);
        }
      } else {
        // Fallback se cache falhar
        drawMapBase(renderer, animTick);
      }
    } else if (mapImg && mapImg.complete && mapImg.naturalWidth) {
      ctx.drawImage(
        mapImg,
        state.camera.x,
        state.camera.y,
        viewportW,
        viewportH,
        0,
        0,
        viewportW,
        viewportH
      );
    }
    drawNpcs();
    drawOtherPlayers();
    drawPlayer();

    if (renderer) {
      drawMapOverlay(renderer, animTick);
    }

    // Resetar translate antes de desenhar overlays
    if (offsetX !== 0 || offsetY !== 0) {
      ctx.translate(-offsetX, -offsetY);
    }

    const settings = getEditorSettings();
    if (settings.showGrid !== false) {
      drawGridOverlay();
    }
    drawOverlays(settings);
  }

  function drawOverlays(settings) {
    const showColliders = settings.showColliders === true;
    const showEvents = settings.showEvents !== false;
    const showNpcs = settings.showNpcs !== false;
    if (showColliders) {
      drawCollidersOverlay();
    }
    if (showEvents) {
      drawEventsOverlay();
    }
    if (showNpcs) {
      drawNpcsOverlay();
    }
    if (settings.selectedTile) {
      drawSelectedTile(settings.selectedTile);
    }
  }

  // � Autosave contínuo (a cada 30 segundos)
  async function maybeAutosave() {
    if (!state.ready || state.paused || state.menuOpen) {
      return;
    }

    // Incrementar timer
    state.autosaveTimer = (state.autosaveTimer || 0) + 1;

    // A cada 30 frames em 60fps = ~0.5 segundos (suavizar mais)
    // Mas efetivamente a cada 1800 frames = 30 segundos
    const AUTOSAVE_INTERVAL = 1800;  // 30 segundos em 60fps
    if (state.autosaveTimer < AUTOSAVE_INTERVAL) {
      return;
    }

    // Reset timer
    state.autosaveTimer = 0;

    // Verificar se posição mudou
    const currentPos = {
      mapId: state.mapId,
      tileX: state.player.tileX,
      tileY: state.player.tileY,
      facing: state.player.facing
    };

    const lastPos = state.lastAutosavePos;
    const posChanged = !lastPos ||
      lastPos.mapId !== currentPos.mapId ||
      lastPos.tileX !== currentPos.tileX ||
      lastPos.tileY !== currentPos.tileY;

    // Se posição mudou ou primeira vez, salvar
    if (posChanged) {
      state.lastAutosavePos = { ...currentPos };

      try {
        // Usar autosave via API (não cria checkpoint, apenas atualiza save)
        const gameState = {
          mapId: state.mapId,
          position: {
            x: state.player.tileX,  // Salvar em TILES, não pixels
            y: state.player.tileY,
            facing: state.player.facing
          },
          timestamp: Date.now()
        };

        // Fazer autosave silenciosamente
        await fetch("/api/game/save", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json"
          },
          body: JSON.stringify(gameState)
        }).catch(() => {
          // Falha silenciosa
        });

        console.log("💾 Autosave: " + state.mapId + " (" + state.player.tileX + ", " + state.player.tileY + ")");
      } catch (err) {
        console.warn("Erro ao autosalvar:", err);
      }
    }
  }

  // 📌 Criar checkpoint automático periodicamente (a cada 5 minutos em estado idle)
  async function maybeCreateAutoCheckpoint() {
    if (!state.ready || state.paused || state.menuOpen) {
      return;
    }

    // Incrementar timer
    state.checkpointTimer = (state.checkpointTimer || 0) + 1;

    // A cada 300 frames (5 minutos em 60fps) em estado idle
    const CHECKPOINT_INTERVAL = 300 * 60;
    if (state.checkpointTimer < CHECKPOINT_INTERVAL) {
      return;
    }

    // Reset timer
    state.checkpointTimer = 0;

    // Criar checkpoint silenciosamente
    try {
      if (window.SaveGameModal?.createAutoCheckpoint) {
        await window.SaveGameModal.createAutoCheckpoint('idle');
      }
    } catch (err) {
      console.warn("Erro ao criar checkpoint automático:", err);
    }
  }

  let lastTime = 0;
  function loop(time) {
    if (!state.ready) {
      return;
    }
    const dt = Math.min(0.05, (time - lastTime) / 1000) || 0;
    lastTime = time;
    updatePlayer(dt);
    updateOtherPlayers(dt);
    updateCamera();
    maybeAutosave();  // 💾 Autosave contínuo
    maybeCreateAutoCheckpoint();  // 📌 Checkpoints periódicos
    render();
    requestAnimationFrame(loop);
  }

  let mapImg = new Image();
  let mapLoadSeq = 0;

  function finalizeMapLoad(start) {
    const expectedWidth = Number.isFinite(state.map.expectedWidth) ? state.map.expectedWidth : null;
    const expectedHeight = Number.isFinite(state.map.expectedHeight) ? state.map.expectedHeight : null;
    const renderer = state.mapRenderer;
    const rawWidth = renderer ? renderer.width : mapImg.width;
    const rawHeight = renderer ? renderer.height : mapImg.height;
    const width = expectedWidth ? Math.min(rawWidth, expectedWidth) : rawWidth;
    const height = expectedHeight ? Math.min(rawHeight, expectedHeight) : rawHeight;
    state.map.width = width;
    state.map.height = height;
    state.map.tilesX = Math.floor(width / TILE_SIZE);
    state.map.tilesY = Math.floor(height / TILE_SIZE);
    placePlayer(start);
    state.ready = true;
    lastTime = 0;
    updateCamera();
    requestAnimationFrame(loop);
  }

  function getMapsList(world) {
    const maps = world && world.maps;
    if (Array.isArray(maps)) {
      return maps.filter(Boolean);
    }
    if (maps && typeof maps === "object") {
      return Object.keys(maps).map((key) => maps[key]).filter(Boolean);
    }
    return [];
  }

  function getMapById(world, mapId) {
    const maps = world && world.maps;
    if (!maps) {
      return null;
    }
    if (Array.isArray(maps)) {
      return maps.find((map) => map && map.id === mapId) || null;
    }
    if (typeof maps === "object") {
      return maps[mapId] || null;
    }
    return null;
  }

  function getMapIndexEntry(mapId) {
    const base = window.WORLD || WORLD;
    const index = base && Array.isArray(base.mapIndex) ? base.mapIndex : [];
    if (!mapId || !index.length) {
      return null;
    }
    return index.find((entry) => entry && entry.id === mapId) || null;
  }

  function getMapIndexImage(mapId) {
    const entry = getMapIndexEntry(mapId);
    if (entry && entry.image) {
      return entry.image;
    }
    return null;
  }

  function getMapLayoutTiles(mapData, mapId) {
    const meta = mapData && mapData.meta;
    let width =
      (mapData && Number.isFinite(mapData.width) && mapData.width) ||
      (mapData && Number.isFinite(mapData.tilesX) && mapData.tilesX) ||
      (meta && Number.isFinite(meta.width) && meta.width) ||
      null;
    let height =
      (mapData && Number.isFinite(mapData.height) && mapData.height) ||
      (mapData && Number.isFinite(mapData.tilesY) && mapData.tilesY) ||
      (meta && Number.isFinite(meta.height) && meta.height) ||
      null;
    if (!width || !height) {
      const entry = getMapIndexEntry(mapId);
      if (entry) {
        width = width || entry.width;
        height = height || entry.height;
      }
    }
    if (!Number.isFinite(width) || width <= 0) {
      width = null;
    }
    if (!Number.isFinite(height) || height <= 0) {
      height = null;
    }
    if (!width || !height) {
      return null;
    }
    return { width, height };
  }

  function isMapStub(mapData, mapId) {
    if (!mapData) {
      return false;
    }
    if (mapData.partial) {
      return true;
    }
    const base = window.WORLD || WORLD;
    const hasFile = base && base.mapFiles && mapId && base.mapFiles[mapId];
    if (!hasFile) {
      return false;
    }
    const indexImage = getMapIndexImage(mapId);
    if ((mapData.image === "mapa.png" || !mapData.image) && indexImage && indexImage !== "mapa.png") {
      return true;
    }
    const hasContent =
      (Array.isArray(mapData.colliders) && mapData.colliders.length) ||
      (Array.isArray(mapData.npcs) && mapData.npcs.length) ||
      (Array.isArray(mapData.events) && mapData.events.length);
    if (hasContent) {
      return false;
    }
    return mapData.image === "mapa.png" || !mapData.image;
  }

  function resolveMapData(mapId, allowMissing) {
    const base = window.WORLD || WORLD;
    const mapData = getMapById(base, mapId);
    if (mapData) {
      if (isMapStub(mapData, mapId)) {
        return allowMissing ? null : mapData;
      }
      return mapData;
    }
    if (allowMissing) {
      return null;
    }
    const fallback = base.map || {};
    return {
      id: "default",
      name: "Default",
      image: fallback.image || "mapa.png",
      tileSize: fallback.tileSize || 16,
      start: base.start || {},
      colliders: base.colliders || [],
      npcs: base.npcs || [],
      events: base.events || []
    };
  }

  function mergeDialogs(list) {
    if (!Array.isArray(list) || !list.length) {
      return;
    }
    const base = window.WORLD || WORLD;
    if (!Array.isArray(base.dialogs)) {
      base.dialogs = [];
    }
    list.forEach((dialog) => {
      if (!dialog || !dialog.id) {
        return;
      }
      const idx = base.dialogs.findIndex((entry) => entry && entry.id === dialog.id);
      if (idx === -1) {
        base.dialogs.push(dialog);
      } else {
        base.dialogs[idx] = Object.assign({}, base.dialogs[idx], dialog);
      }
    });
  }

  function normalizeLoadedMap(mapId, data) {
    const raw = data && data.map && !data.id ? data.map : data;
    const mapData = raw && typeof raw === "object" ? raw : {};
    mapData.id = mapData.id || mapId || "default";
    mapData.name = mapData.name || mapData.id;
    mapData.image = mapData.image || "mapa.png";
    mapData.tileSize = Number.isFinite(mapData.tileSize) ? mapData.tileSize : 16;
    mapData.start = mapData.start || { x: 0, y: 0 };
    mapData.colliders = Array.isArray(mapData.colliders) ? mapData.colliders : [];
    mapData.npcs = Array.isArray(mapData.npcs) ? mapData.npcs : [];
    mapData.events = Array.isArray(mapData.events) ? mapData.events : [];
    mapData.jumps = Array.isArray(mapData.jumps) ? mapData.jumps : [];

    // 🗺️ Converter graphics_id dos NPCs para paths de sprites
    if (mapData.npcs && mapData.npcs.length && npcSpriteMapping) {
      mapData.npcs = mapData.npcs.map(npc => {
        if (npc && npc.sprite && typeof npc.sprite === "string") {
          const spritePath = getNpcSpritePath(npc.sprite);
          if (spritePath) {
            return {
              ...npc,
              sprite: spritePath,
              spriteSize: { w: 16, h: 32 }  // Tamanho padrão dos sprites de NPC
            };
          }
        }
        return npc;
      });
    }

    return mapData;
  }

  function registerMapData(mapData) {
    if (!mapData || !mapData.id) {
      return;
    }
    const base = window.WORLD || WORLD;
    if (!base.maps || typeof base.maps !== "object") {
      base.maps = {};
    }
    if (Array.isArray(base.maps)) {
      const idx = base.maps.findIndex((entry) => entry && entry.id === mapData.id);
      if (idx === -1) {
        base.maps.push(mapData);
      } else {
        base.maps[idx] = mapData;
      }
    } else {
      base.maps[mapData.id] = mapData;
    }
    if (Array.isArray(mapData.dialogs)) {
      mergeDialogs(mapData.dialogs);
      delete mapData.dialogs;
    }
  }

  function getMapFilePath(mapId) {
    const base = window.WORLD || WORLD;
    const folder = (base && (base.mapsFolder || base.mapFolder)) || "mapas";
    const files = base && base.mapFiles;
    const fileName = (files && files[mapId]) || (mapId + ".json");
    const trimmed = folder.replace(/\/$/, "");
    return trimmed + "/" + fileName;
  }

  function loadMapImage(imgSrc, start, requestId) {
    mapImg.onerror = () => {
      if (requestId !== mapLoadSeq) {
        return;
      }
      showMessage("Falha ao carregar a imagem do mapa.");
    };

    const finalSrc = resolveAssetPath(imgSrc);
    if (mapImg.complete && mapImg.src && mapImg.src.indexOf(finalSrc) !== -1) {
      finalizeMapLoad(start);
      return;
    }

    mapImg.onload = () => {
      if (requestId !== mapLoadSeq) {
        return;
      }
      finalizeMapLoad(start);
    };
    mapImg.src = finalSrc;
  }

  function startMapLoad(mapData, mapId, spawn, requestId) {
    state.mapId = mapData.id || mapId || "default";
    applyViewSettings(mapData);
    state.colliders = Array.isArray(mapData.colliders) ? mapData.colliders : [];
    state.events = normalizeEvents(mapData.events);
    state.npcs = Array.isArray(mapData.npcs) ? mapData.npcs : [];
    state.jumps = Array.isArray(mapData.jumps) ? mapData.jumps : [];
    state.npcHold = null;
    state.mapRenderer = null;
    const layout = getMapLayoutTiles(mapData, mapId);
    if (layout) {
      state.map.expectedWidth = layout.width * TILE_SIZE;
      state.map.expectedHeight = layout.height * TILE_SIZE;
    } else {
      state.map.expectedWidth = null;
      state.map.expectedHeight = null;
    }
    preloadNpcSprites(state.npcs);

    // Garantir que spawn seja um objeto válido
    let start = {};
    if (spawn && typeof spawn === 'object' && (Number.isFinite(spawn.x) || Number.isFinite(spawn.y))) {
      start = spawn;
      console.log("✅ Usando spawn salvo:", spawn);
    } else if (mapData.start && typeof mapData.start === 'object') {
      start = mapData.start;
      console.log("✅ Usando start do mapa:", mapData.start);
    } else if (WORLD.start && typeof WORLD.start === 'object') {
      start = WORLD.start;
      console.log("✅ Usando start do world:", WORLD.start);
    }

    state.ready = false;

    const indexImage = getMapIndexImage(mapData.id || mapId);
    const fallbackImage = mapData.image || (WORLD.map && WORLD.map.image) || "mapa.png";
    const imgSrc =
      (fallbackImage === "mapa.png" || !fallbackImage) && indexImage && indexImage !== "mapa.png"
        ? indexImage
        : fallbackImage;

    buildMapRenderer(mapData)
      .then((renderer) => {
        if (requestId !== mapLoadSeq) {
          return;
        }
        if (renderer) {
          state.mapRenderer = renderer;
          finalizeMapLoad(start);
          return;
        }
        loadMapImage(imgSrc, start, requestId);
      })
      .catch((err) => {
        console.warn(err);
        if (requestId !== mapLoadSeq) {
          return;
        }
        loadMapImage(imgSrc, start, requestId);
      });
  }

  function getActiveMapId(world) {
    if (world && typeof world.activeMapId === "string" && world.activeMapId) {
      return world.activeMapId;
    }
    const maps = getMapsList(world);
    if (maps.length && maps[0].id) {
      return maps[0].id;
    }
    return "default";
  }

  function applyViewSettings(mapData) {
    TILE_SIZE = Number.isFinite(mapData.tileSize) ? mapData.tileSize : 16;
    VIEW_TILES_X = Number.isFinite(VIEW.tilesX) ? VIEW.tilesX : 20;
    VIEW_TILES_Y = Number.isFinite(VIEW.tilesY) ? VIEW.tilesY : 15;
    SCALE = Number.isFinite(VIEW.scale) ? VIEW.scale : 2;
    viewportW = VIEW_TILES_X * TILE_SIZE;
    viewportH = VIEW_TILES_Y * TILE_SIZE;
    canvas.width = viewportW * SCALE;
    canvas.height = viewportH * SCALE;
    ctx.imageSmoothingEnabled = false;
  }

  function placePlayer(start) {
    // Garantir que start é um objeto válido
    if (!start || typeof start !== 'object') {
      start = { x: undefined, y: undefined, facing: 'down' };
    }

    const tileX = Number.isFinite(start.x) ? start.x : Math.floor(state.map.tilesX / 2);
    const tileY = Number.isFinite(start.y) ? start.y : Math.floor(state.map.tilesY / 2);
    console.log("📍 Posicionando player em:", tileX, ",", tileY, "mapa:", state.mapId);
    state.player.tileX = tileX;
    state.player.tileY = tileY;
    state.player.x = tileX * TILE_SIZE;
    state.player.y = tileY * TILE_SIZE;
    if (start.facing && dirVector[start.facing]) {
      state.player.facing = start.facing;
    }
    state.player.moving = false;
    state.player.vx = 0;
    state.player.vy = 0;
    state.player.moveRemaining = 0;
    state.player.moveTiles = 1;
  }

  function loadMap(mapId, spawn) {
    WORLD = window.WORLD || WORLD;
    const requestId = (mapLoadSeq += 1);
    const mapData = resolveMapData(mapId, true);
    if (mapData) {
      startMapLoad(mapData, mapId, spawn, requestId);
      return;
    }
    if (!mapId) {
      const fallback = resolveMapData(mapId, false);
      if (fallback) {
        startMapLoad(fallback, mapId, spawn, requestId);
      }
      return;
    }
    state.ready = false;
    const filePath = getMapFilePath(mapId);
    fetch(filePath)
      .then((res) => {
        if (!res.ok) {
          throw new Error("HTTP " + res.status);
        }
        return res.json();
      })
      .then((data) => {
        if (requestId !== mapLoadSeq) {
          return;
        }
        const loadedMap = normalizeLoadedMap(mapId, data);
        registerMapData(loadedMap);
        startMapLoad(loadedMap, mapId, spawn, requestId);
      })
      .catch((err) => {
        console.warn(err);
        if (requestId !== mapLoadSeq) {
          return;
        }
        const fallback = resolveMapData(mapId, false);
        if (fallback) {
          showMessage("Falha ao carregar o mapa " + mapId + ".");
          startMapLoad(fallback, mapId, spawn, requestId);
        } else {
          showMessage("Falha ao carregar o mapa.");
        }
      });
  }

  async function loadSavedGame() {
    try {
      // 📌 Primeiro, verificar se há checkpoint de recuperação (crash recovery)
      const checkpointRes = await fetch("/api/game/checkpoint", {
        method: "GET",
        headers: { Accept: "application/json" }
      });

      let checkpoint = null;
      if (checkpointRes.ok) {
        const checkpointData = await checkpointRes.json();
        if (checkpointData.ok && checkpointData.checkpoint) {
          checkpoint = checkpointData.checkpoint;
          console.log("📌 Checkpoint de recuperação encontrado:", checkpoint);
        }
      }

      // 💾 Agora, carregar o save regular
      const saveRes = await fetch("/api/game/save", {
        method: "GET",
        headers: { Accept: "application/json" }
      });

      if (!saveRes.ok) {
        // Se não tem save mas tem checkpoint, usar o checkpoint
        if (checkpoint) {
          console.log("⚠️ Sem save regular, usando checkpoint de recuperação");
          return checkpoint.gameState;
        }
        return null;
      }

      const saveData = await saveRes.json();
      const hasSave = saveData.ok && saveData.hasSave && saveData.gameState;

      if (!hasSave) {
        // Se não tem save mas tem checkpoint, usar o checkpoint
        if (checkpoint) {
          console.log("⚠️ Sem save regular, usando checkpoint de recuperação");
          return checkpoint.gameState;
        }
        return null;
      }

      // Se tem checkpoint mais novo que o save, oferecer opção de recuperação
      if (checkpoint && checkpoint.createdAt > saveData.gameState.timestamp) {
        console.log("⏳ Checkpoint mais recente que save regular. Estado do checkpoint:", checkpoint.state);

        // Se o checkpoint está em estado de batalha ou evento, usar o checkpoint
        if (checkpoint.state === 'battle' || checkpoint.state === 'event') {
          console.log("🎮 Recuperando de", checkpoint.state, "- usando checkpoint");
          // Mostrar mensagem visual ao usuário
          const msg = document.getElementById("message");
          if (msg) {
            msg.textContent = `🔄 Recuperando de ${checkpoint.state === 'battle' ? 'batalha' : 'evento'}...`;
          }
          return checkpoint.gameState;
        }
      }

      // Usar o save regular
      console.log("💾 Save encontrado:", saveData.gameState);
      return saveData.gameState;

    } catch (error) {
      console.warn("Erro ao carregar save/checkpoint:", error);
      return null;
    }
  }

  function loadWorld(world) {
    WORLD = world || {};
    applyCoreConfig(WORLD);
    window.WORLD = WORLD;
    VIEW = WORLD.view || {};
    PLAYER_CFG = WORLD.player || {};
    MOVE_SPEED = Number.isFinite(WORLD.moveSpeed) ? WORLD.moveSpeed : 96;
    RUN_MULT = Number.isFinite(WORLD.runMultiplier) ? WORLD.runMultiplier : 1.5;
    state.triggered = new Set();
    state.paused = false;

    return loadPlayerSprite(PLAYER_CFG.sprite)
      .then((sprite) => {
        state.playerSprite = sprite;
      })
      .then(() => loadSavedGame())
      .then((savedGame) => {
        let mapId = getActiveMapId(WORLD);
        let spawn = null;

        if (savedGame && savedGame.mapId) {
          console.log("✅ Carregando save: mapa", savedGame.mapId, "posição", savedGame.position);
          mapId = savedGame.mapId;
          // Garantir que position tem x e y válidos
          if (savedGame.position && typeof savedGame.position === 'object' &&
            (Number.isFinite(savedGame.position.x) || Number.isFinite(savedGame.position.y))) {

            // Converter de pixels para tiles se necessário (valores > 200 indicam pixels)
            let x = savedGame.position.x;
            let y = savedGame.position.y;

            if (x > 200 || y > 200) {
              // Está em pixels, converter para tiles (dividir por TILE_SIZE=16)
              x = Math.floor(x / 16);
              y = Math.floor(y / 16);
              console.log("🔄 Convertendo posição de PIXELS para TILES:", savedGame.position.x, savedGame.position.y, "->", x, y);
            }

            spawn = {
              x: x,
              y: y,
              facing: savedGame.position.facing || 'down'
            };
            console.log("📍 Spawn definido para:", spawn);
          } else {
            console.log("⚠️ Position inválida, usando spawn padrão do mapa");
            spawn = null;
          }
        }

        loadMap(mapId, spawn);
      })
      .catch((error) => {
        console.error("Erro ao inicializar mundo:", error);
        const mapId = getActiveMapId(WORLD);
        loadMap(mapId, null);
      });
  }

  function setActiveMap(mapId, spawn) {
    if (!mapId) {
      return;
    }
    loadMap(mapId, spawn || null);
  }

  function applyEdits(payload) {
    if (!payload) {
      return;
    }
    if (payload.mapId && payload.mapId !== state.mapId) {
      return;
    }
    if (Array.isArray(payload.colliders)) {
      state.colliders = payload.colliders;
    }
    if (Array.isArray(payload.events)) {
      state.events = normalizeEvents(payload.events);
    }
    if (Array.isArray(payload.jumps)) {
      state.jumps = payload.jumps;
    }
    if (Array.isArray(payload.npcs)) {
      state.npcs = payload.npcs;
    }
  }

  window.Game = api;
  loadWorld(WORLD);

}


__coreGameBootstrap();
