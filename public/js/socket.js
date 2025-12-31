(function () {
  const $ = (id) => document.getElementById(id);

  const tokensLayer = $("tokensLayer");
  const tokenSelf = $("tokenSelf");
  const tokenSelfName = $("tokenSelfName");
  const playerNameEl = $("playerName");
  const playersCount = $("playersCount");
  const roomName = $("roomName");
  const pingValue = $("pingValue");

  const mapImg = $("mapImg");
  const mapStage = $("mapStage");

  const ROOM = "kanto-01";
  const players = new Map(); // id -> { id, name, x, y }

  function setPlayersCount() {
    playersCount.textContent = `Players na sala: ${players.size}`;
  }

  // Retorna a box real do <img> relativo ao tokensLayer (funciona com scroll)
  function getImageBox(imgEl, relativeToEl) {
    const imgRect = imgEl.getBoundingClientRect();
    const relRect = relativeToEl.getBoundingClientRect();

    return {
      left: imgRect.left - relRect.left,
      top: imgRect.top - relRect.top,
      width: imgRect.width,
      height: imgRect.height,
    };
  }

  // Posiciona token por coords normalizadas (0..1) dentro do <img>
  function placeToken(el, x, y) {
    const box = getImageBox(mapImg, tokensLayer);

    const px = box.left + (x * box.width);
    const py = box.top + (y * box.height);

    el.style.left = `${px}px`;
    el.style.top = `${py}px`;

    el.dataset.x = String(x);
    el.dataset.y = String(y);
  }

  function refreshAllTokens() {
    if (tokenSelf?.dataset?.x && tokenSelf?.dataset?.y) {
      placeToken(tokenSelf, Number(tokenSelf.dataset.x), Number(tokenSelf.dataset.y));
    }

    document.querySelectorAll(".token[data-id]").forEach((el) => {
      if (el.dataset.x && el.dataset.y) {
        placeToken(el, Number(el.dataset.x), Number(el.dataset.y));
      }
    });
  }

  function ensureOtherToken(player) {
    let el = document.querySelector(`.token[data-id="${player.id}"]`);
    if (el) return el;

    el = document.createElement("div");
    el.className = "token token--other";
    el.dataset.id = player.id;

    const avatarSrc = player?.avatar ? `/assets/personages/${encodeURIComponent(player.avatar)}` : "";
    const iconHtml = avatarSrc
      ? `<img src="${avatarSrc}" alt="Avatar" />`
      : "🧑";

    el.innerHTML = `
      <div class="token__icon">${iconHtml}</div>
      <div class="token__name"></div>
    `;
    tokensLayer.appendChild(el);
    return el;
  }

  function setSelfAvatar(avatar) {
    if (!tokenSelf) return;
    if (!avatar) return;
    const src = `/assets/personages/${encodeURIComponent(avatar)}`;
    const icon = tokenSelf.querySelector(".token__icon");
    if (!icon) return;
    icon.innerHTML = `<img src="${src}" alt="Avatar" />`;
  }

  function removeToken(id) {
    const el = document.querySelector(`.token[data-id="${id}"]`);
    if (el) el.remove();
  }

  // Clique no mapa => normaliza dentro da imagem real
  mapStage.addEventListener("click", (e) => {
    const box = getImageBox(mapImg, tokensLayer);

    const layerRect = tokensLayer.getBoundingClientRect();
    const cx = e.clientX - layerRect.left;
    const cy = e.clientY - layerRect.top;

    const x = (cx - box.left) / box.width;
    const y = (cy - box.top) / box.height;

    // clique fora do mapa? ignora
    if (x < 0 || x > 1 || y < 0 || y > 1) return;

    placeToken(tokenSelf, x, y);
    socket.emit("move_player", { room: ROOM, x, y });
    window.UI?.log?.(`📍 Movimento enviado: ${x.toFixed(3)}, ${y.toFixed(3)}`);
  });

  // Socket.io
  const socket = io({
    transports: ["websocket", "polling"],
  });

  // Expor para outros scripts (ex: map-player.js)
  window.socket = socket;

  let lastPingAt = 0;
  setInterval(() => {
    lastPingAt = Date.now();
    socket.emit("ping_check");
  }, 3000);

  socket.on("pong_check", () => {
    const ms = Date.now() - lastPingAt;
    pingValue.textContent = `${ms}ms`;
  });

  socket.on("connect", () => {
    roomName.textContent = `Sala: ${ROOM}`;
    window.UI?.log?.(`✅ Conectado: ${socket.id}`);
    socket.emit("join_room", { room: ROOM });
  });

  socket.on("room_state", (payload) => {
    const { self, players: list } = payload;

    if (self?.name) {
      playerNameEl.textContent = self.name;
      tokenSelfName.textContent = "Você";
    }

    if (self?.avatar) {
      setSelfAvatar(self.avatar);
    }

    players.clear();
    list.forEach((p) => players.set(p.id, p));

    list.forEach((p) => {
      if (p.id === socket.id) {
        placeToken(tokenSelf, p.x, p.y);
      } else {
        const el = ensureOtherToken(p);
        el.querySelector(".token__name").textContent = p.name || "Jogador";
        placeToken(el, p.x, p.y);
      }
    });

    setPlayersCount();
    window.UI?.log?.(`🗺️ Estado da sala carregado (${list.length} players).`);

    refreshAllTokens();
  });

  socket.on("player_joined", (p) => {
    players.set(p.id, p);

    if (p.id !== socket.id) {
      const el = ensureOtherToken(p);
      el.querySelector(".token__name").textContent = p.name || "Jogador";
      placeToken(el, p.x, p.y);
    }

    setPlayersCount();
    window.UI?.log?.(`➕ ${p.name || "Jogador"} entrou.`);
    refreshAllTokens();
  });

  socket.on("player_moved", (p) => {
    players.set(p.id, p);

    if (p.id === socket.id) {
      placeToken(tokenSelf, p.x, p.y);
    } else {
      const el = ensureOtherToken(p);
      el.querySelector(".token__name").textContent = p.name || "Jogador";
      placeToken(el, p.x, p.y);
    }
  });

  socket.on("player_left", ({ id, name }) => {
    players.delete(id);
    removeToken(id);
    setPlayersCount();
    window.UI?.log?.(`➖ ${name || "Jogador"} saiu.`);
  });

  socket.on("disconnect", () => {
    window.UI?.log?.("❌ Desconectado.");
    pingValue.textContent = "—";
  });

  // Recalcula token quando a imagem carrega, resize e quando rolar (por segurança)
  mapImg.addEventListener("load", refreshAllTokens);
  window.addEventListener("resize", refreshAllTokens);
  mapStage.addEventListener("scroll", refreshAllTokens);
})();
