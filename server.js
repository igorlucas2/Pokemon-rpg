const path = require("path");
const express = require("express");
const session = require("express-session");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const userStore = require("./store/userStore");
const trainerStore = require("./store/trainerStore");
const gameStore = require("./store/gameStore");  // 📌 Carregador para checkpoints
const overworldSprites = require("./services/overworldSprites");
const { migrateAiStory } = require("./store/aiStoryMigration");

// Migração de IA no boot
try {
  migrateAiStory();
} catch (e) {
  console.error("Erro na migração de IA:", e);
}

// ========================
// Configs básicas
// ========================
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ========================
// Sessão (login)
// ========================
const sessionMiddleware = session({
  secret: "troque-por-uma-chave-bem-grande",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    // secure: true, // habilite quando estiver em HTTPS
    maxAge: 1000 * 60 * 60 * 6, // 6h
  },
});

app.use(sessionMiddleware);

// Compartilhar sessão com o socket.io
io.engine.use(sessionMiddleware);

// ========================
// Middlewares
// ========================
function requireAuth(req, res, next) {
  if (!req.session.user) return res.redirect("/login");
  next();
}

function requireAdmin(req, res, next) {
  if (req.session.user?.role !== "admin") return res.status(403).send("Acesso negado");
  next();
}

// Protege o editor do core (evita acesso direto ao index.html sem admin)
app.get("/core/index.html", requireAuth, requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, "core", "index.html"));
});

// Assets do core (mapas, sprites, engine)
app.use("/core", express.static(path.join(__dirname, "core"), { index: false }));

// Helper para listar sprites (já que o módulo exporta um array ou objeto)
function listAvatarFiles() {
  try {
    const dir = path.join(__dirname, "public", "assets", "personages");
    if (!require("fs").existsSync(dir)) return [];
    const files = require("fs")
      .readdirSync(dir)
      .filter((f) => /^[0-9]+\.(png|jpg|jpeg|webp)$/i.test(f))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    return files;
  } catch {
    return [];
  }
}

function listOverworldSprites() {
  return overworldSprites.listOverworldSprites();
}

// ========================
// Rotas públicas
// ========================
app.get("/", (req, res) => {
  if (req.session.user) return res.redirect("/dashboard");
  return res.redirect("/login");
});

app.get("/login", (req, res) => {
  res.render("login", { error: null, mode: "login" });
});

app.post("/login", (req, res) => {
  const { identifier, password } = req.body;

  const out = userStore.verifyUser(identifier, password);
  if (!out.ok) return res.status(401).render("login", { error: out.error, mode: "login" });
  const user = out.user;

  // ✅ AQUI é onde se cria a sessão (não existe req.session fora de rota!)
  req.session.user = userStore.toSessionUser(user);

  // Carrega treinador (se existir) para uso no socket e UI
  const trainer = trainerStore.getTrainerByUserId(req.session.user.id);
  req.session.trainer = trainer
    ? {
      name: trainer.name,
      avatar: trainer.avatar,
      overworldSprite: trainer.overworldSprite || "boy",
      starterPokemonId: trainer.starterPokemonId,
    }
    : null;

  // (Opcional) posição inicial do jogador por sessão
  if (!req.session.currentRegionId) req.session.currentRegionId = null;

  // Admin vai pro editor, player pro dashboard
  if (user.role === "admin") return res.redirect("/admin/map");
  return res.redirect("/dashboard");
});

app.post("/register", (req, res) => {
  const { email, username, password, passwordConfirm } = req.body;

  if (String(password || "") !== String(passwordConfirm || "")) {
    return res.status(400).render("login", { error: "As senhas não conferem.", mode: "register" });
  }

  const out = userStore.createUser({ email, username, password, name: username, role: "player" });
  if (!out.ok) return res.status(400).render("login", { error: out.error, mode: "register" });

  req.session.user = userStore.toSessionUser(out.user);
  req.session.trainer = null;
  if (!req.session.currentRegionId) req.session.currentRegionId = null;
  return res.redirect("/dashboard");
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.redirect("/login");
  });
});

// ========================
// Rota de Chat com NPC (LLM)
// ========================
const { generateNpcResponse } = require("./services/llm.service");

app.post("/api/chat", async (req, res) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { npcId, message, regionId } = req.body;

  if (!npcId || !message) {
    return res.status(400).json({ error: "Missing npcId or message" });
  }

  try {
    const result = await generateNpcResponse({
      npcId,
      playerId: req.session.user.id,
      playerMessage: message,
      regionId
    });

    res.json(result);
  } catch (err) {
    console.error("Chat Error:", err);
    res.status(500).json({ error: "Failed to generate response" });
  }
});

// ========================
// Rotas Admin (NPCs)
// ========================
const { getDb } = require("./services/db");

app.get("/admin/npcs", requireAuth, requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const npcs = db.prepare(`
      SELECT npcs.*, regions.map_image 
      FROM npcs 
      LEFT JOIN regions ON npcs.region_id = regions.region_id 
      ORDER BY npcs.region_id, npcs.name
    `).all();

    // Carregar mapeamento de sprites para resolver OBJ_EVENT_GFX_*
    let spriteMapping = {};
    try {
      const mappingPath = path.join(__dirname, "core", "npc-sprites-mapping.json");
      if (require("fs").existsSync(mappingPath)) {
        spriteMapping = JSON.parse(require("fs").readFileSync(mappingPath, "utf-8"));
      }
    } catch (e) {
      console.error("Erro ao carregar sprite mapping:", e);
    }

    res.render("admin_npcs", { npcs, spriteMapping });
  } catch (err) {
    console.error("Erro CRITICO em GET /admin/npcs:", err);
    res.status(500).send("Erro interno no servidor: " + err.message);
  }
});

app.post("/api/admin/npcs/:id", requireAuth, requireAdmin, (req, res) => {
  const { id } = req.params;
  const { name, role, persona_prompt, traits_json } = req.body;

  const db = getDb();
  try {
    const stmt = db.prepare(`
      UPDATE npcs 
      SET name = ?, role = ?, persona_prompt = ?, traits_json = ?, updated_at = (datetime('now'))
      WHERE npc_id = ?
    `);
    stmt.run(name, role, persona_prompt, traits_json, id);
    res.json({ success: true });
  } catch (err) {
    console.error("Admin Update Error:", err);
    res.status(500).json({ error: "DB Error" });
  }
});

// ========================
// Rotas protegidas (views)
// ========================
app.get("/dashboard", requireAuth, (req, res) => {
  const { trainer, party, oak } = trainerStore.getTrainerWithPokemonsByUserId(req.session.user.id);

  const debugInfo = `User ID: ${req.session.user.id} | Trainer Found: ${!!trainer} | DB ID: ${trainer?.id}`;

  const avatars = listAvatarFiles();
  const overworldSprites = listOverworldSprites();
  res.render("dashboard", { user: req.session.user, trainer, party, oak, avatars, overworldSprites, debugInfo });
});

app.post("/trainer/create", requireAuth, (req, res) => {
  const { name, avatar, starterPokemonId, overworldSprite } = req.body || {};
  const spriteId = String(overworldSprite || "").trim();
  if (spriteId && !overworldSprites.isValidOverworldSpriteId(spriteId)) {
    const trainer = trainerStore.getTrainerByUserId(req.session.user.id);
    const avatars = listAvatarFiles();
    const overworldSprites = listOverworldSprites();
    return res
      .status(400)
      .render("dashboard", { user: req.session.user, trainer, avatars, overworldSprites, trainerError: "Personagem do mapa inválido." });
  }

  const out = trainerStore.createOrResetTrainer({
    userId: req.session.user.id,
    name,
    avatar,
    starterPokemonId,
    overworldSprite: spriteId || "boy",
  });
  console.log("[Server] createOrResetTrainer result:", out);

  if (!out.ok) {
    const trainer = trainerStore.getTrainerByUserId(req.session.user.id);
    const avatars = listAvatarFiles();
    const overworldSprites = listOverworldSprites();
    return res
      .status(400)
      .render("dashboard", { user: req.session.user, trainer, avatars, overworldSprites, trainerError: out.error });
  }

  req.session.trainer = {
    name: out.trainer?.name,
    avatar: out.trainer?.avatar,
    overworldSprite: out.trainer?.overworldSprite || "boy",
    starterPokemonId: out.trainer?.starterPokemonId,
  };

  return res.redirect("/dashboard");
});

app.post("/trainer/reset", requireAuth, (req, res) => {
  trainerStore.resetTrainer(req.session.user.id);
  req.session.trainer = null;
  return res.redirect("/dashboard");
});

// ========================
// Database Migration (FireRed Integration)
// ========================
const { migrateFireRedTables } = require("./store/fireRedMigration");
try {
  migrateFireRedTables();
  console.log("✓ FireRed database tables initialized");
} catch (err) {
  console.error("Warning: FireRed migration encountered an issue:", err.message);
  // Não bloquear startup, apenas avisar
}

// ========================
// Rotas de API/Admin (arquivos separados)
// ========================
const adminRoutes = require("./routes/admin");
const apiRoutes = require("./routes/api");
const fireRedApiRoutes = require("./routes/fireRedApi");

// ✅ Registre UMA vez só.
// /api exige login
app.use("/api", requireAuth, apiRoutes);
// Rotas FireRed sem auth (fora de /api)
app.use("/firered-api", fireRedApiRoutes);

// /admin exige login + admin
app.use("/admin", requireAuth, requireAdmin, adminRoutes);

const pokedexRoutes = require("./routes/pokedex");
app.use("/pokedex", requireAuth, pokedexRoutes);

const pokedexApi = require("./routes/pokedexApi");
app.use("/api/pokedex", requireAuth, pokedexApi);

const shopApi = require("./routes/shopApi");
app.use("/api/shop", requireAuth, shopApi);

const battleRoutes = require("./routes/battleRoutes");
app.use(battleRoutes); // Battle routes já incluem /api prefix

// Pokemon list API (for admin encounters dropdown)
app.get("/api/pokemon", requireAuth, (req, res) => {
  try {
    const db = require("./services/db").getDb();
    const pokemon = db.prepare('SELECT id, name FROM pokemon ORDER BY id').all();
    res.json({ ok: true, pokemon });
  } catch (err) {
    console.error('Error fetching Pokemon:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});



// ========================
// Socket.io
// ========================

// Estado em memória por sala
const rooms = new Map();
function getRoom(roomName) {
  if (!rooms.has(roomName)) rooms.set(roomName, new Map());
  return rooms.get(roomName);
}

function randomSpawn() {
  return { x: 5, y: 5 };
}

io.on("connection", (socket) => {
  const sess = socket.request.session;
  const user = sess?.user;
  const trainer = sess?.trainer;

  if (!user) {
    socket.disconnect(true);
    return;
  }

  socket.on("ping_check", () => socket.emit("pong_check"));

  socket.on("join_room", ({ room, x, y, mapId }) => {
    if (!room) return;

    for (const r of socket.rooms) {
      if (r !== socket.id) socket.leave(r);
    }

    socket.join(room);

    const roomState = getRoom(room);

    const nx = Number(x);
    const ny = Number(y);
    const spawn =
      Number.isFinite(nx) && Number.isFinite(ny)
        ? { x: Math.trunc(nx), y: Math.trunc(ny) }
        : randomSpawn();
    const player = {
      id: socket.id,
      name: trainer?.name || user.name || "Jogador",
      spriteId: trainer?.overworldSprite || "boy",
      x: spawn.x,
      y: spawn.y,
      room,
      mapId: mapId || null,
      facing: "down",
    };

    roomState.set(socket.id, player);

    socket.emit("room_state", {
      self: player,
      players: Array.from(roomState.values()),
    });

    socket.to(room).emit("player_joined", player);
  });

  socket.on("start_move", ({ room, mapId, fromX, fromY, toX, toY, facing }) => {
    if (!room) return;

    const roomState = getRoom(room);
    const player = roomState.get(socket.id);
    if (!player) return;

    const fx = Number(fromX);
    const fy = Number(fromY);
    const tx = Number(toX);
    const ty = Number(toY);
    if ([fx, fy, tx, ty].some((n) => Number.isNaN(n))) return;

    // Apenas repassa para animação imediata nos outros clientes.
    player.facing = String(facing || player.facing || "down");
    if (mapId) player.mapId = mapId;

    io.to(room).emit("player_started_move", {
      id: player.id,
      name: player.name,
      spriteId: player.spriteId,
      mapId: player.mapId || null,
      facing: player.facing,
      moving: true,
      fromX: Math.trunc(fx),
      fromY: Math.trunc(fy),
      toX: Math.trunc(tx),
      toY: Math.trunc(ty),
    });
  });

  socket.on("move_player", ({ room, x, y, mapId, facing }) => {
    if (!room) return;

    const roomState = getRoom(room);
    const player = roomState.get(socket.id);
    if (!player) return;

    const nx = Number(x);
    const ny = Number(y);
    if (Number.isNaN(nx) || Number.isNaN(ny)) return;

    player.x = Math.trunc(nx);
    player.y = Math.trunc(ny);
    if (mapId) player.mapId = mapId;
    if (facing) player.facing = String(facing);

    io.to(room).emit("player_moved", player);
  });

  socket.on("disconnect", () => {
    for (const [roomName, roomState] of rooms.entries()) {
      if (roomState.has(socket.id)) {
        const p = roomState.get(socket.id);
        roomState.delete(socket.id);

        socket.to(roomName).emit("player_left", {
          id: socket.id,
          name: p?.name,
        });

        if (roomState.size === 0) rooms.delete(roomName);
      }
    }
  });
});

// ========================
// Start
// ========================
const PORT = process.env.PORT || 3000;

// 📌 Inicializar banco de dados de saves/checkpoints
try {
  gameStore.init();
  console.log("✅ Game Store (saves/checkpoints) inicializado");
} catch (err) {
  console.warn("⚠️ Erro ao inicializar Game Store:", err.message);
}

server.listen(PORT, () => {
  console.log(`✅ Server rodando em http://localhost:${PORT}`);
});
