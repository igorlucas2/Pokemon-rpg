(() => {
  const $ = (id) => document.getElementById(id);

  const playerNameEl = $("playerName");
  const playersCount = $("playersCount");
  const roomName = $("roomName");
  const pingValue = $("pingValue");
  const gameCanvas = $("game");

  if (!gameCanvas || typeof io !== "function") return;

  const players = new Map(); // id -> { id, name, spriteId, x, y }
  let currentRoom = null;
  let lastSent = { mapId: null, x: null, y: null };
  let lastPingAt = 0;
  let otherPlayersDirty = true;
  let prevMoving = false;

  function setPlayersCount() {
    if (!playersCount) return;
    playersCount.textContent = `Players na sala: ${players.size}`;
  }

  function syncCoreOtherPlayers(socketId) {
    const list = Array.from(players.values());
    window.Game?.setOtherPlayers?.(list, socketId);
  }

  function getView() {
    return window.Game?.getViewState?.() || null;
  }

  function getSelf() {
    return window.Game?.getPlayerState?.() || null;
  }

  function syncRoom(self) {
    const mapId = self?.mapId || "default";
    const room = `map:${mapId}`;
    if (room === currentRoom) return;

    currentRoom = room;
    players.clear();
    otherPlayersDirty = true;

    if (roomName) roomName.textContent = `Mapa: ${mapId}`;

    socket.emit("join_room", {
      room,
      mapId,
      x: self?.tileX ?? self?.x,
      y: self?.tileY ?? self?.y,
    });
  }

  function tick() {
    const view = getView();
    const self = getSelf();

    if (view && self) {
      syncRoom(self);

      const mapId = self.mapId || "default";
      const x = Number(self.tileX);
      const y = Number(self.tileY);

      // Envia início do movimento (pra outros clientes animarem já no começo)
      const moving = Boolean(self.moving);
      if (moving && !prevMoving && currentRoom) {
        const vx = Number(self.vx);
        const vy = Number(self.vy);
        const fromX = Number(self.tileX);
        const fromY = Number(self.tileY);
        const moveTiles = Number(self.moveTiles);
        const tileStep = Number.isFinite(moveTiles) ? Math.max(1, Math.trunc(moveTiles)) : 1;
        const dx = Number.isFinite(vx) ? Math.trunc(vx) : 0;
        const dy = Number.isFinite(vy) ? Math.trunc(vy) : 0;
        const toX = fromX + dx * tileStep;
        const toY = fromY + dy * tileStep;
        const facing = String(self.facing || "down");
        socket.emit("start_move", { room: currentRoom, mapId, fromX, fromY, toX, toY, facing });
      }
      prevMoving = moving;

      if (
        mapId !== lastSent.mapId ||
        x !== lastSent.x ||
        y !== lastSent.y
      ) {
        lastSent = { mapId, x, y };
        socket.emit("move_player", { room: currentRoom, mapId, x, y, facing: String(self.facing || "down") });
      }

      if (otherPlayersDirty) {
        otherPlayersDirty = false;
        syncCoreOtherPlayers(socket.id);
      }
    }

    requestAnimationFrame(tick);
  }

  const socket = io({ transports: ["websocket", "polling"] });
  window.socket = socket;

  setInterval(() => {
    lastPingAt = Date.now();
    socket.emit("ping_check");
  }, 3000);

  socket.on("pong_check", () => {
    const ms = Date.now() - lastPingAt;
    if (pingValue) pingValue.textContent = `${ms}ms`;
  });

  socket.on("connect", () => {
    window.UI?.log?.(`✅ Conectado: ${socket.id}`);
  });

  socket.on("room_state", (payload) => {
    const { self, players: list } = payload || {};
    if (self?.name && playerNameEl) playerNameEl.textContent = self.name;

    players.clear();
    (Array.isArray(list) ? list : []).forEach((p) => players.set(p.id, p));
    setPlayersCount();
    otherPlayersDirty = true;
  });

  socket.on("player_joined", (p) => {
    if (!p || p.id === socket.id) return;
    players.set(p.id, p);
    setPlayersCount();
    otherPlayersDirty = true;
    window.UI?.log?.(`➕ ${p.name || "Jogador"} entrou.`);
  });

  socket.on("player_moved", (p) => {
    if (!p || p.id === socket.id) return;
    players.set(p.id, p);
    otherPlayersDirty = true;
  });

  socket.on("player_started_move", (p) => {
    if (!p || p.id === socket.id) return;
    players.set(p.id, p);
    otherPlayersDirty = true;
  });

  socket.on("player_left", ({ id, name }) => {
    players.delete(id);
    setPlayersCount();
    otherPlayersDirty = true;
    window.UI?.log?.(`➖ ${name || "Jogador"} saiu.`);
  });

  socket.on("disconnect", () => {
    if (pingValue) pingValue.textContent = "-";
    window.UI?.log?.("⚠️ Desconectado.");
  });

  requestAnimationFrame(tick);
})();
