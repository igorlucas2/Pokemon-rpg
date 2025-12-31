const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const mapStore = require("../store/mapStore");
const trainerStore = require("../store/trainerStore");
const gameStore = require("../store/gameStore");
const battleService = require("../services/battleService");
const overworldSprites = require("../services/overworldSprites");
const movesDb = require("../core/data/moves_database");

const CORE_MAPS_DIR = path.join(__dirname, "..", "core", "mapas");
function safeMapFileName(mapId) {
  const base = String(mapId || "").trim();
  if (!base) return null;
  if (!/^[a-zA-Z0-9._-]+$/.test(base)) return null;
  return base.endsWith(".json") ? base : `${base}.json`;
}

function loadCoreMap(mapId) {
  const fileName = safeMapFileName(mapId);
  if (!fileName) return null;
  const filePath = path.join(CORE_MAPS_DIR, fileName);
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function findCoreEvent(mapId, eventId) {
  const map = loadCoreMap(mapId);
  if (!map) return null;
  const events = Array.isArray(map.events) ? map.events : [];
  return events.find((ev) => ev && ev.id === eventId) || null;
}

function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: "not_authenticated" });
  next();
}

function toBattleMoveName(name) {
  return String(name || "").trim().toLowerCase();
}

function lookupLocalMove(name) {
  const n = toBattleMoveName(name);
  for (const mv of Object.values(movesDb || {})) {
    if (toBattleMoveName(mv?.name) === n) return mv;
  }
  return null;
}

// GET /api/battle/backgrounds
router.get("/battle/backgrounds", requireAuth, (req, res) => {
  try {
    const dir = path.join(__dirname, "..", "public", "assets", "mapas-batalhas");
    const files = fs
      .readdirSync(dir)
      .filter((f) => /\.(png|jpg|jpeg|webp)$/i.test(f))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    const urls = files.map((f) => `/assets/mapas-batalhas/${encodeURIComponent(f)}`);
    return res.json({ ok: true, results: urls });
  } catch {
    return res.json({ ok: true, results: [] });
  }
});

// GET /api/map
router.get("/map", requireAuth, (req, res) => {
  const { regions, edges, events } = mapStore.listMap();
  res.json({
    regions,
    edges,
    events: events.filter(e => e.isActive),
  });
});

// POST /api/travel  { toRegionId }
router.post("/travel", requireAuth, (req, res) => {
  const { toRegionId } = req.body || {};
  const user = req.session.user;

  // MVP: posição em memória na sessão (depois você coloca no DB/character)
  const fromRegionId = req.session.currentRegionId || null;

  if (!toRegionId) return res.status(400).json({ error: "missing_toRegionId" });

  // Primeira viagem: deixa livre (spawn) OU exige from? aqui deixo livre
  if (fromRegionId && !mapStore.canTravel(fromRegionId, toRegionId)) {
    return res.status(403).json({ error: "not_connected", fromRegionId, toRegionId });
  }

  req.session.currentRegionId = toRegionId;

  const map = mapStore.listMap();
  const region = map.regions.find(r => r.id === toRegionId);
  const regionEvents = map.events.filter(e => e.isActive && e.regionId === toRegionId);

  res.json({
    ok: true,
    user: { id: user.id, name: user.name },
    fromRegionId,
    toRegionId,
    region,
    events: regionEvents,
  });
});

// GET /api/bag
// Inventário básico do jogador (MVP)
router.get("/bag", requireAuth, (req, res) => {
  const trainer = trainerStore.getTrainerByUserId(req.session.user.id);
  if (!trainer) {
    return res.json({
      ok: true,
      items: [],
      money: 0,
      pokeballs: 0,
    });
  }

  const items = [];
  const pokeballs = Number(trainer.pokeballs ?? 0);
  if (pokeballs > 0) {
    items.push({
      id: "poke-ball",
      name: "Pokébola",
      qty: pokeballs,
      icon: "/assets/itens/pokebola.png",
    });
  }

  const extra = trainerStore.listTrainerItemsByUserId(req.session.user.id);
  for (const row of Array.isArray(extra) ? extra : []) {
    const id = String(row?.itemId || "").trim();
    const qty = Number(row?.qty ?? 0);
    if (!id || !Number.isFinite(qty) || qty <= 0) continue;

    // Nome amigável (MVP)
    const nameMap = {
      potion: "Poção",
      "super-potion": "Super Poção",
      "hyper-potion": "Hiper Poção",
      "max-potion": "Max Poção",
      revive: "Revivir",
      "max-revive": "Max Revivir",
    };

    items.push({
      id,
      name: nameMap[id] || id,
      qty: Math.trunc(qty),
      icon: null,
    });
  }

  return res.json({
    ok: true,
    items,
    money: Number(trainer.money ?? 0),
    pokeballs,
  });
});

// GET /api/trainer
// Retorna dados do treinador + pokémons (time atual e os com o Prof. Carvalho)
router.get("/trainer", requireAuth, (req, res) => {
  const { trainer, party, oak } = trainerStore.getTrainerWithPokemonsByUserId(req.session.user.id);
  if (!trainer) return res.status(404).json({ error: "no_trainer" });
  return res.json({ ok: true, trainer, party, oak });
});

// POST /api/trainer/overworld-sprite  { spriteId }
router.post("/trainer/overworld-sprite", requireAuth, (req, res) => {
  const { spriteId } = req.body || {};
  const id = String(spriteId || "").trim();
  if (!overworldSprites.isValidOverworldSpriteId(id)) {
    return res.status(400).json({ ok: false, error: "invalid_sprite" });
  }

  const out = trainerStore.setOverworldSpriteByUserId(req.session.user.id, id);
  if (!out.ok) {
    return res.status(400).json({ ok: false, error: out.error || "failed" });
  }

  // Mantém a sessão alinhada (socket usa req.session.trainer)
  const t = out.trainer;
  req.session.trainer = t
    ? {
        name: t.name,
        avatar: t.avatar,
        overworldSprite: t.overworldSprite || "boy",
        starterPokemonId: t.starterPokemonId,
      }
    : null;

  return res.json({ ok: true, trainer: t });
});

// POST /api/pokemon/deposit { trainerPokemonId }
// Envia um Pokémon do time (party) para o Professor Carvalho (oak)
router.post("/pokemon/deposit", requireAuth, (req, res) => {
  const { trainerPokemonId } = req.body || {};
  const out = trainerStore.depositPokemonToOak(req.session.user.id, trainerPokemonId);
  if (!out.ok) return res.status(400).json(out);
  return res.json({ ok: true });
});

// POST /api/pokemon/withdraw { trainerPokemonId, swapWithTrainerPokemonId? }
// Pega um Pokémon do Carvalho (oak) e coloca no time. Se o time estiver cheio (6), exige swap.
router.post("/pokemon/withdraw", requireAuth, (req, res) => {
  const { trainerPokemonId, swapWithTrainerPokemonId } = req.body || {};
  const out = trainerStore.withdrawPokemonFromOak(req.session.user.id, trainerPokemonId, swapWithTrainerPokemonId);
  if (!out.ok) {
    const status = out.error === "party_full" ? 409 : 400;
    return res.status(status).json(out);
  }
  return res.json({ ok: true, swapped: Boolean(out.swapped) });
});

// POST /api/event/use { eventId }
// Executa um evento da região atual (pokecenter / caçar pokémon)
router.post("/event/use", requireAuth, async (req, res) => {
  const { eventId, mapId } = req.body || {};
  if (!eventId) return res.status(400).json({ ok: false, error: "missing_eventId" });

  let ev = null;
  if (mapId) {
    ev = findCoreEvent(mapId, eventId);
  } else {
    const map = mapStore.listMap();
    ev = (Array.isArray(map.events) ? map.events : []).find((e) => e.id === eventId);
    if (ev && ev.isActive === false) {
      return res.status(404).json({ ok: false, error: "event_not_found" });
    }
  }

  if (!ev) return res.status(404).json({ ok: false, error: "event_not_found" });

  const userId = req.session.user.id;

  const serverType = ev.server && typeof ev.server === "object" ? ev.server.eventType : null;
  const rawEventType = String(ev.eventType || serverType || ev.type || "").trim().toLowerCase();
  const eventType = rawEventType === "server" ? "" : rawEventType;
  if (eventType === "pokecenter") {
    const out = trainerStore.healPartyByUserId(userId);
    if (!out.ok) return res.status(404).json(out);
    return res.json({ ok: true, kind: "pokecenter", healedCount: out.healedCount });
  }

  const serverPayload = ev.server && typeof ev.server === "object" ? ev.server.payload : null;
  const payload =
    ev.payload && typeof ev.payload === "object"
      ? ev.payload
      : serverPayload && typeof serverPayload === "object"
        ? serverPayload
        : {};

  if (eventType === "pokemon_hunt") {
    const pool =
      (Array.isArray(payload?.hunt?.pool) ? payload.hunt.pool : null) ||
      (Array.isArray(payload?.encounter?.pool) ? payload.encounter.pool : []) ||
      [];

    const norm = pool
      .map((x) => {
        const pokemonId = Number(x?.pokemonId);
        const level = Number(x?.level);
        const rarity = String(x?.rarity || "common").toLowerCase();
        if (!Number.isFinite(pokemonId) || pokemonId < 1) return null;
        const lvl = Number.isFinite(level) ? Math.max(1, Math.min(100, Math.trunc(level))) : 1;
        return { pokemonId: Math.trunc(pokemonId), level: lvl, rarity };
      })
      .filter(Boolean);

    if (!norm.length) return res.status(400).json({ ok: false, error: "empty_pool" });

    const weightOf = (rarity) => {
      const r = String(rarity || "").toLowerCase();
      if (r === "common" || r === "comum") return 60;
      if (r === "uncommon" || r === "incomum") return 25;
      if (r === "rare" || r === "raro") return 10;
      if (r === "epic" || r === "epico" || r === "épico") return 4;
      if (r === "legendary" || r === "lendario" || r === "lendário") return 1;
      return 10;
    };

    const total = norm.reduce((acc, it) => acc + weightOf(it.rarity), 0);
    let roll = Math.random() * total;
    let pick = norm[norm.length - 1];
    for (const it of norm) {
      roll -= weightOf(it.rarity);
      if (roll <= 0) {
        pick = it;
        break;
      }
    }

    return res.json({ ok: true, kind: "pokemon_hunt", encounter: pick, event: { id: ev.id, name: ev.name } });
  }

  if (eventType === "battle") {
    const b = payload.battle && typeof payload.battle === "object" ? payload.battle : {};

    // Config esperada (MVP): battle.enemy { pokemonId, level }
    // Opcional: battle.pool [{ pokemonId, level }]
    let enemy = b.enemy && typeof b.enemy === "object" ? b.enemy : null;
    const pool = Array.isArray(b.pool) ? b.pool : [];
    if (!enemy && pool.length) {
      enemy = pool[Math.floor(Math.random() * pool.length)];
    }

    const enemyPokemonId = Number(enemy?.pokemonId);
    const enemyLevel = Number(enemy?.level);
    if (!Number.isFinite(enemyPokemonId) || enemyPokemonId < 1) {
      return res.status(400).json({ ok: false, error: "battle_missing_enemy", hint: "payload.battle.enemy.pokemonId" });
    }

    const lvl = Number.isFinite(enemyLevel) ? Math.max(1, Math.min(100, Math.trunc(enemyLevel))) : 5;

    const { trainer, party } = trainerStore.getTrainerWithPokemonsByUserId(userId);
    if (!trainer) return res.status(404).json({ ok: false, error: "no_trainer" });
    const active = Array.isArray(party) && party.length ? party[0] : null;
    if (!active) return res.status(404).json({ ok: false, error: "no_active_pokemon" });

    try {
      const sim = await battleService.simulateBattle({
        player: active,
        enemySpec: { pokemonId: Math.trunc(enemyPokemonId), level: lvl },
      });

      const oldLevel = Number(active.level ?? 1);
      const oldXp = Number(active.xp ?? 0);

      const newLevel = Number(sim.playerAfter?.level ?? oldLevel);
      const newXp = Number(sim.playerAfter?.xp ?? oldXp);

      // Recalcula stats do jogador se subiu de nível (usando base stats via PokeAPI)
      let nextStats = {
        maxHp: Number(active.maxHp),
        attack: Number(active.attack),
        defense: Number(active.defense),
        spAttack: Number(active.spAttack),
        spDefense: Number(active.spDefense),
        speed: Number(active.speed),
      };

      if (newLevel > oldLevel) {
        const p = await battleService.getPokemonDetails(active.pokemonId);
        nextStats = battleService.computeStatsFromBase(p.stats, newLevel);
      }

      // Aprende golpes conforme upa
      const currentMoves = [active.move1, active.move2, active.move3, active.move4].filter(Boolean);
      const learnedOut = await battleService.applyLevelUpLearnset({
        pokemonId: active.pokemonId,
        oldLevel: Number.isFinite(oldLevel) ? oldLevel : 1,
        newLevel: Number.isFinite(newLevel) ? newLevel : oldLevel,
        currentMoves,
      });

      // Ajusta HP atual para novo maxHp (mantém HP atual no mínimo 1 se ainda vivo)
      const rawHp = Number(sim.playerAfter?.currentHp ?? active.currentHp);
      const nextMax = Number(nextStats.maxHp ?? active.maxHp);
      const nextHp = Math.max(0, Math.min(Math.trunc(rawHp), Math.trunc(nextMax)));

      const moneyWin = typeof b.moneyWin === "number" ? Math.trunc(b.moneyWin) : 0;
      const moneyLose = typeof b.moneyLose === "number" ? Math.trunc(b.moneyLose) : 0;
      const moneyDelta = sim.result === "win" ? moneyWin : moneyLose ? -Math.abs(moneyLose) : 0;

      const apply = trainerStore.applyBattleOutcomeToActivePokemon(userId, {
        trainerPokemonId: active.id,
        level: Math.trunc(newLevel),
        xp: Math.trunc(newXp),
        maxHp: Math.trunc(nextMax),
        currentHp: Math.trunc(nextHp),
        attack: Math.trunc(nextStats.attack),
        defense: Math.trunc(nextStats.defense),
        spAttack: Math.trunc(nextStats.spAttack),
        spDefense: Math.trunc(nextStats.spDefense),
        speed: Math.trunc(nextStats.speed),
        moves: learnedOut.moves,
        moneyDelta,
      });

      if (!apply?.ok) return res.status(400).json({ ok: false, error: apply?.error || "apply_failed" });

      return res.json({
        ok: true,
        kind: "battle",
        result: sim.result,
        xpGain: sim.xpGain,
        enemy: sim.enemy,
        learned: learnedOut.learned,
        before: { level: oldLevel, xp: oldXp },
        after: { level: Math.trunc(newLevel), xp: Math.trunc(newXp) },
        log: sim.log,
      });
    } catch (e) {
      return res.status(500).json({ ok: false, error: "battle_failed" });
    }
  }

  return res.status(400).json({ ok: false, error: "unsupported_event_type", eventType });
});

function toBattleMoveName(x) {
  const s = String(x || "").trim().toLowerCase();
  if (!s) return "";
  // Mantém nomes no padrão da PokeAPI: lowercase e com hífen
  return s.replace(/\s+/g, "-");
}

function clampInt(n, min, max, fallback) {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(v)));
}

function ensureBattleSession(req) {
  if (!req.session) return null;
  return req.session.battle && typeof req.session.battle === "object" ? req.session.battle : null;
}

function clearBattleSession(req) {
  if (req.session) req.session.battle = null;
}

// GET /api/battle/state
// Retorna o estado atual da batalha (guardado na sessão), para permitir restaurar a UI após refresh.
router.get("/battle/state", requireAuth, (req, res) => {
  const state = ensureBattleSession(req);
  return res.json({ ok: true, state: state || null });
});

// POST /api/battle/start { encounter: { pokemonId, level, rarity? } }
router.post("/battle/start", requireAuth, async (req, res) => {
  const userId = req.session.user.id;
  const encounter = req.body?.encounter && typeof req.body.encounter === "object" ? req.body.encounter : {};

  const enemyPokemonId = clampInt(encounter.pokemonId, 1, 9999, NaN);
  const enemyLevel = clampInt(encounter.level, 1, 100, 5);

  if (!Number.isFinite(enemyPokemonId)) return res.status(400).json({ ok: false, error: "missing_enemy" });

  const { trainer, party } = trainerStore.getTrainerWithPokemonsByUserId(userId);
  if (!trainer) return res.status(404).json({ ok: false, error: "no_trainer" });
  const active = Array.isArray(party) && party.length ? party[0] : null;
  if (!active) return res.status(404).json({ ok: false, error: "no_active_pokemon" });

  try {
    const enemyDetails = await battleService.getPokemonDetails(enemyPokemonId);
    const enemyStats = battleService.computeStatsFromBase(enemyDetails.stats, enemyLevel);

    const playerSpecies = await battleService.getPokemonDetails(active.pokemonId);

    const playerMoves = [active.move1, active.move2, active.move3, active.move4].filter(Boolean).map(String);
    const movesClean = playerMoves.map(toBattleMoveName).filter(Boolean).slice(0, 4);

    // Se por algum motivo o Pokémon não tem golpes, tenta puxar learnset.
    const learnedOut = movesClean.length
      ? { moves: movesClean, learned: [] }
      : await battleService.applyLevelUpLearnset({
          pokemonId: active.pokemonId,
          oldLevel: 0,
          newLevel: clampInt(active.level, 1, 100, 1),
          currentMoves: [],
        });

    const finalMoves = (Array.isArray(learnedOut.moves) ? learnedOut.moves : []).slice(0, 4);

    const playerMaxHp = clampInt(active.maxHp, 1, 9999, 10);
    const playerCurHp = clampInt(active.currentHp, 0, playerMaxHp, playerMaxHp);

    const enemyMaxHp = clampInt(enemyStats.maxHp, 1, 9999, 10);
    const enemyCurHp = enemyMaxHp;

    const state = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      startedAt: Date.now(),
      ended: false,
      result: null,
      log: [`Um ${enemyDetails.name} selvagem apareceu!`],
      player: {
        trainerPokemonId: active.id,
        pokemonId: active.pokemonId,
        name: String(active.nickname || "").trim() || null,
        level: clampInt(active.level, 1, 100, 1),
        types: playerSpecies.types,
        maxHp: playerMaxHp,
        currentHp: playerCurHp,
        maxHP: playerMaxHp,      // ✅ Compatibilidade frontend
        currentHP: playerCurHp,  // ✅ Compatibilidade frontend
        stats: {
          maxHp: playerMaxHp,
          attack: clampInt(active.attack, 1, 9999, 1),
          defense: clampInt(active.defense, 1, 9999, 1),
          spAttack: clampInt(active.spAttack, 1, 9999, 1),
          spDefense: clampInt(active.spDefense, 1, 9999, 1),
          speed: clampInt(active.speed, 1, 9999, 1),
        },
        moves: finalMoves.map((m) => {
          const info = lookupLocalMove(m);
          const maxPP = info?.pp ?? 35;
          return {
            name: m,
            type: info?.type || null,
            category: info?.category || null,
            effect: info?.effect || null,
            currentPP: maxPP,
            maxPP,
          };
        }),
      },
      enemy: {
        pokemonId: enemyPokemonId,
        name: enemyDetails.name,
        types: enemyDetails.types,
        level: enemyLevel,
        maxHp: enemyMaxHp,
        currentHp: enemyCurHp,
        maxHP: enemyMaxHp,      // ✅ Compatibilidade frontend
        currentHP: enemyCurHp,  // ✅ Compatibilidade frontend
        stats: enemyStats,
      },
      items: [],
    };

    // Itens
    const trainerRow = trainerStore.getTrainerByUserId(userId);
    const pokeballs = Number(trainerRow?.pokeballs ?? 0);
    if (pokeballs > 0) {
      state.items.push({ id: "poke-ball", name: "Pokébola", qty: Math.trunc(pokeballs) });
    }

    const extra = trainerStore.listTrainerItemsByUserId(userId);
    const nameMap = {
      potion: "Poção",
      "super-potion": "Super Poção",
      "hyper-potion": "Hiper Poção",
      "max-potion": "Max Poção",
      revive: "Revivir",
      "max-revive": "Max Revivir",
    };
    for (const row of Array.isArray(extra) ? extra : []) {
      const id = String(row?.itemId || "").trim();
      const qty = Number(row?.qty ?? 0);
      if (!id || !Number.isFinite(qty) || qty <= 0) continue;
      state.items.push({ id, name: nameMap[id] || id, qty: Math.trunc(qty) });
    }

    // Nomes (se não tem nickname)
    state.player.name = state.player.name || playerSpecies.name;

    req.session.battle = state;
    console.log("✅ Battle session created:", state.id);
    return res.json({ ok: true, state });
  } catch (err) {
    console.error("❌ Battle start failed:", err);
    return res.status(500).json({ ok: false, error: "battle_start_failed" });
  }
});

// POST /api/battle/action { type: 'move'|'item'|'run', moveName?, itemId? }
router.post("/battle/action", requireAuth, async (req, res) => {
  const userId = req.session.user.id;
  const state = ensureBattleSession(req);
  if (!state) return res.status(409).json({ ok: false, error: "no_battle" });
  if (state.ended) return res.status(409).json({ ok: false, error: "battle_ended", state });

  const type = String(req.body?.type || "").trim().toLowerCase();

  try {
    async function applyAttack({ attacker, defender, moveName }) {
      const move = await battleService.getMoveDetails(moveName);
      if (!move || !move.power || move.damageClass === "status") {
        return { ok: false, log: `${attacker.name} usou ${moveName}, mas nada aconteceu.` };
      }

      const accuracy = Math.max(1, Math.min(100, Math.trunc(move.accuracy ?? 100)));
      if (Math.random() * 100 > accuracy) {
        return { ok: true, damage: 0, effectiveness: 1, move, log: `${attacker.name} usou ${move.name} e errou!` };
      }

      const atkStat = move.damageClass === "special" ? attacker.stats.spAttack : attacker.stats.attack;
      const defStat = move.damageClass === "special" ? defender.stats.spDefense : defender.stats.defense;
      const stab = Array.isArray(attacker.types) ? attacker.types.includes(move.type) : false;
      const effectiveness = battleService.typeEffectiveness(move.type, defender.types);
      const damage = battleService.calcDamage({
        level: attacker.level,
        power: move.power,
        atk: atkStat,
        def: defStat,
        stab,
        effectiveness,
      });

      let effText = "";
      if (effectiveness >= 2) effText = " (super efetivo)";
      else if (effectiveness > 0 && effectiveness < 1) effText = " (não muito efetivo)";
      else if (effectiveness === 0) effText = " (não teve efeito)";

      return { ok: true, damage, effectiveness, move, log: `${attacker.name} usou ${move.name} e causou ${damage} de dano.${effText}` };
    }

    // Fugir
    if (type === "run") {
      state.ended = true;
      state.result = "run";
      state.log.push("Você fugiu!");

      // Persiste o HP atual do Pokémon ativo ao fugir
      try {
        trainerStore.applyBattleOutcomeToActivePokemon(userId, {
          trainerPokemonId: state.player.trainerPokemonId,
          level: state.player.level,
          xp: null,
          maxHp: state.player.maxHp,
          currentHp: Math.trunc(clampInt(state.player.currentHp, 0, state.player.maxHp, state.player.currentHp)),
          attack: state.player.stats.attack,
          defense: state.player.stats.defense,
          spAttack: state.player.stats.spAttack,
          spDefense: state.player.stats.spDefense,
          speed: state.player.stats.speed,
          moves: state.player.moves.map((m) => m.name),
          moneyDelta: 0,
        });
      } catch {
        // ignore (não deve impedir fugir)
      }

      clearBattleSession(req);
      return res.json({ ok: true, state });
    }

    // Item (Pokébola)
    if (type === "item") {
      const itemId = String(req.body?.itemId || "").trim().toLowerCase();
      const normId = itemId === "pokeball" ? "poke-ball" : itemId;

      const refreshItems = () => {
        const trainerRow = trainerStore.getTrainerByUserId(userId);
        const balls = Number(trainerRow?.pokeballs ?? 0);
        const extra = trainerStore.listTrainerItemsByUserId(userId);
        const nameMap = {
          potion: "Poção",
          "super-potion": "Super Poção",
          "hyper-potion": "Hiper Poção",
          "max-potion": "Max Poção",
          revive: "Revivir",
          "max-revive": "Max Revivir",
        };

        const out = [];
        if (balls > 0) out.push({ id: "poke-ball", name: "Pokébola", qty: Math.trunc(balls) });
        for (const row of Array.isArray(extra) ? extra : []) {
          const id = String(row?.itemId || "").trim();
          const qty = Number(row?.qty ?? 0);
          if (!id || !Number.isFinite(qty) || qty <= 0) continue;
          out.push({ id, name: nameMap[id] || id, qty: Math.trunc(qty) });
        }
        state.items = out;
      };

      // Pokébola (captura)
      if (normId === "poke-ball") {
        const dec = trainerStore.addPokeballsByUserId(userId, -1);
        if (!dec?.ok) return res.status(400).json({ ok: false, error: dec?.error || "no_pokeballs" });

        // chance simples baseada no HP (quanto menos HP, maior chance)
        const hpFrac = state.enemy.maxHp > 0 ? state.enemy.currentHp / state.enemy.maxHp : 1;
        const chance = Math.max(0.15, Math.min(0.85, 0.15 + (1 - hpFrac) * 0.65));
        const captured = Math.random() < chance;

        state.log.push("Você usou uma Pokébola!");

        if (captured) {
          const enemyDetails = await battleService.getPokemonDetails(state.enemy.pokemonId);
          const enemyStats = battleService.computeStatsFromBase(enemyDetails.stats, state.enemy.level);

          const learnedOut = await battleService.applyLevelUpLearnset({
            pokemonId: state.enemy.pokemonId,
            oldLevel: 0,
            newLevel: state.enemy.level,
            currentMoves: [],
          });

          const caught = trainerStore.catchPokemonByUserId(userId, {
            pokemonId: state.enemy.pokemonId,
            level: state.enemy.level,
            xp: 0,
            stats: enemyStats,
            currentHp: clampInt(state.enemy.currentHp, 1, enemyStats.maxHp, enemyStats.maxHp),
            moves: learnedOut.moves,
          });

          if (!caught?.ok) {
            state.log.push("A captura falhou (erro ao salvar). Você perdeu a Pokébola.");
            refreshItems();
            return res.json({ ok: true, state });
          }

          state.log.push(`Pegou! ${state.enemy.name} foi capturado.`);
          state.ended = true;
          state.result = "captured";
          state.caught = { pokemonId: state.enemy.pokemonId, level: state.enemy.level, storage: caught.storage };
          refreshItems();
          clearBattleSession(req);
          return res.json({ ok: true, state });
        }

        state.log.push("Ah não! O Pokémon escapou.");
        // inimigo responde (tackle)
        const enemyMove = "tackle";
        const out = await applyAttack({
          attacker: { name: state.enemy.name, level: state.enemy.level, stats: state.enemy.stats, types: state.enemy.types },
          defender: { name: state.player.name, level: state.player.level, stats: state.player.stats, types: state.player.types },
          moveName: enemyMove,
        });
        const d = out.ok ? (Number(out.damage) || 0) : 0;
        state.player.currentHp = Math.max(0, clampInt(state.player.currentHp, 0, 9999, 0) - d);
        state.player.currentHP = state.player.currentHp; // compat frontend
        state.log.push(out.log || `${state.enemy.name} atacou!`);

        // Persiste HP
        trainerStore.applyBattleOutcomeToActivePokemon(userId, {
          trainerPokemonId: state.player.trainerPokemonId,
          level: state.player.level,
          xp: null,
          maxHp: state.player.maxHp,
          currentHp: Math.trunc(state.player.currentHp),
          attack: state.player.stats.attack,
          defense: state.player.stats.defense,
          spAttack: state.player.stats.spAttack,
          spDefense: state.player.stats.spDefense,
          speed: state.player.stats.speed,
          moves: state.player.moves.map((m) => m.name),
          moneyDelta: 0,
        });

        if (state.player.currentHp <= 0) {
          state.ended = true;
          state.result = "lose";
          state.log.push("Seu Pokémon desmaiou!");
          clearBattleSession(req);
        }

        refreshItems();
        return res.json({ ok: true, state });
      }

      // Itens de cura/revive
      const healMap = {
        potion: 20,
        "super-potion": 50,
        "hyper-potion": 200,
        "max-potion": 999999,
      };

      if (Object.prototype.hasOwnProperty.call(healMap, normId)) {
        const heal = healMap[normId];
        if (state.player.currentHp <= 0) return res.status(400).json({ ok: false, error: "pokemon_fainted" });

        const dec = trainerStore.addItemQtyByUserId(userId, normId, -1);
        if (!dec?.ok) return res.status(400).json({ ok: false, error: "insufficient_item" });

        const before = state.player.currentHp;
        state.player.currentHp = Math.min(state.player.maxHp, state.player.currentHp + heal);
        state.player.currentHP = state.player.currentHp; // compat frontend
        const diff = state.player.currentHp - before;
        state.log.push(`Você usou ${normId}. (+${diff} HP)`);

        trainerStore.applyBattleOutcomeToActivePokemon(userId, {
          trainerPokemonId: state.player.trainerPokemonId,
          level: state.player.level,
          xp: null,
          maxHp: state.player.maxHp,
          currentHp: Math.trunc(state.player.currentHp),
          attack: state.player.stats.attack,
          defense: state.player.stats.defense,
          spAttack: state.player.stats.spAttack,
          spDefense: state.player.stats.spDefense,
          speed: state.player.stats.speed,
          moves: state.player.moves.map((m) => m.name),
          moneyDelta: 0,
        });

        refreshItems();
        return res.json({ ok: true, state });
      }

      if (normId === "revive" || normId === "max-revive") {
        if (state.player.currentHp > 0) return res.status(400).json({ ok: false, error: "pokemon_not_fainted" });

        const dec = trainerStore.addItemQtyByUserId(userId, normId, -1);
        if (!dec?.ok) return res.status(400).json({ ok: false, error: "insufficient_item" });

        const restored = normId === "max-revive" ? state.player.maxHp : Math.max(1, Math.floor(state.player.maxHp / 2));
        state.player.currentHp = restored;
        state.player.currentHP = state.player.currentHp; // compat frontend
        state.log.push(`Você usou ${normId}. (${restored} HP)`);

        trainerStore.applyBattleOutcomeToActivePokemon(userId, {
          trainerPokemonId: state.player.trainerPokemonId,
          level: state.player.level,
          xp: null,
          maxHp: state.player.maxHp,
          currentHp: Math.trunc(state.player.currentHp),
          attack: state.player.stats.attack,
          defense: state.player.stats.defense,
          spAttack: state.player.stats.spAttack,
          spDefense: state.player.stats.spDefense,
          speed: state.player.stats.speed,
          moves: state.player.moves.map((m) => m.name),
          moneyDelta: 0,
        });

        refreshItems();
        return res.json({ ok: true, state });
      }

      return res.status(400).json({ ok: false, error: "unsupported_item" });
    }

    // Ataque
    if (type === "move") {
      const moveName = toBattleMoveName(req.body?.moveName);
      console.log("[BATTLE] Move requested:", moveName);
      if (!moveName) return res.status(400).json({ ok: false, error: "missing_move" });

      const allowed = new Set((state.player.moves || []).map((m) => toBattleMoveName(m?.name)));
      console.log("[BATTLE] Allowed moves:", Array.from(allowed));
      if (!allowed.has(moveName)) {
        console.log("[BATTLE] Move not available:", moveName);
        return res.status(400).json({ ok: false, error: "move_not_available" });
      }

      // Consumir PP do movimento
      const moveIndex = state.player.moves.findIndex(m => toBattleMoveName(m?.name) === moveName);
      if (moveIndex >= 0) {
        const currentMove = state.player.moves[moveIndex];
        if (!currentMove.currentPP) currentMove.currentPP = currentMove.maxPP || 35;
        if (currentMove.currentPP <= 0) {
          console.log("[BATTLE] Move out of PP:", moveName);
          return res.status(400).json({ ok: false, error: "no_pp" });
        }
        currentMove.currentPP -= 1;
        console.log("[BATTLE] PP consumed:", moveName, "->", currentMove.currentPP);
      }

      const events = [];
      const pOut = await applyAttack({
        attacker: { name: state.player.name, level: state.player.level, stats: state.player.stats, types: state.player.types },
        defender: { name: state.enemy.name, level: state.enemy.level, stats: state.enemy.stats, types: state.enemy.types },
        moveName,
      });
      const pd = pOut.ok ? (Number(pOut.damage) || 0) : 0;
      state.log.push(pOut.log || `${state.player.name} atacou!`);
      events.push({ type: "message", text: pOut.log || `${state.player.name} atacou!` });
      // Efeito de tipo
      const eff = Number(pOut.effectiveness) || 1;
      if (eff >= 2) events.push({ type: "super-effective" });
      else if (eff > 0 && eff < 1) events.push({ type: "not-very-effective" });
      else if (eff === 0) events.push({ type: "no-effect" });
      // Efeito descritivo do golpe (pokefirered-master)
      const localInfo = lookupLocalMove(moveName);
      if (localInfo?.effect) {
        events.push({ type: "message", text: `Efeito: ${localInfo.effect}` });
      }
      
      const oldEnemyHp = state.enemy.currentHp;
      state.enemy.currentHp = Math.max(0, clampInt(state.enemy.currentHp, 0, 9999, 0) - pd);
      state.enemy.currentHP = state.enemy.currentHp; // compat frontend
      console.log("[BATTLE] Enemy HP:", oldEnemyHp, "->", state.enemy.currentHp, "(damage:", pd, ")");
      // Informar PP restante para atualizar UI
      if (moveIndex >= 0) {
        const mv = state.player.moves[moveIndex];
        events.push({ type: "pp", move: mv.name, currentPP: mv.currentPP, maxPP: mv.maxPP });
      }

      if (state.enemy.currentHp <= 0) {
        state.ended = true;
        state.result = "win";
        state.log.push(`${state.enemy.name} desmaiou!`);
        events.push({ type: "message", text: `${state.enemy.name} desmaiou!` });

        const { party } = trainerStore.getTrainerWithPokemonsByUserId(userId);
        const activeRow = Array.isArray(party) && party.length ? party[0] : null;

        const xpGain = Math.max(1, clampInt(state.enemy.level, 1, 100, 1) * 20);
        const oldXp = Math.max(0, Math.trunc(Number(activeRow?.xp ?? 0)));
        const newXp = oldXp + xpGain;

        const oldLevel = Number(state.player.level ?? 1);
        const newLevel = battleService.levelFromTotalXp(newXp);

        const playerSpecies = await battleService.getPokemonDetails(state.player.pokemonId);
        let nextStats = state.player.stats;
        if (newLevel > oldLevel) nextStats = battleService.computeStatsFromBase(playerSpecies.stats, newLevel);

        const currentMoves = state.player.moves.map((m) => m.name).filter(Boolean);
        const learnedOut = await battleService.applyLevelUpLearnset({
          pokemonId: state.player.pokemonId,
          oldLevel,
          newLevel,
          currentMoves,
        });

        // Ajusta HP atual para novo max
        const nextMax = Number(nextStats.maxHp ?? state.player.maxHp);
        const nextHp = Math.max(0, Math.min(Math.trunc(state.player.currentHp), Math.trunc(nextMax)));

        trainerStore.applyBattleOutcomeToActivePokemon(userId, {
          trainerPokemonId: state.player.trainerPokemonId,
          level: Math.trunc(newLevel),
          xp: Math.trunc(newXp),
          maxHp: Math.trunc(nextMax),
          currentHp: Math.trunc(nextHp),
          attack: Math.trunc(nextStats.attack),
          defense: Math.trunc(nextStats.defense),
          spAttack: Math.trunc(nextStats.spAttack),
          spDefense: Math.trunc(nextStats.spDefense),
          speed: Math.trunc(nextStats.speed),
          moves: learnedOut.moves,
          moneyDelta: 0,
        });

        state.player.level = Math.trunc(newLevel);
        state.player.maxHp = Math.trunc(nextMax);
        state.player.currentHp = Math.trunc(nextHp);
        state.player.maxHP = state.player.maxHp; // compat frontend
        state.player.currentHP = state.player.currentHp; // compat frontend
        state.player.stats = nextStats;
        state.player.moves = learnedOut.moves.slice(0, 4).map((m) => ({ name: m, currentPP: 35, maxPP: 35 }));
        state.log.push(`XP ganho: +${xpGain}.`);
        events.push({ type: "message", text: `XP ganho: +${xpGain}.` });
        if (newLevel > oldLevel) {
          state.log.push(`Level up! ${oldLevel} → ${newLevel}.`);
          events.push({ type: "message", text: `Level up! ${oldLevel} → ${newLevel}.` });
        }

        clearBattleSession(req);
        console.log("[BATTLE] Player won!");
        return res.json({ ok: true, state, events });
      }

      // inimigo responde (move simples)
      const enemyMove = "tackle";
      const eOut = await applyAttack({
        attacker: { name: state.enemy.name, level: state.enemy.level, stats: state.enemy.stats, types: state.enemy.types },
        defender: { name: state.player.name, level: state.player.level, stats: state.player.stats, types: state.player.types },
        moveName: enemyMove,
      });
      const ed = eOut.ok ? (Number(eOut.damage) || 0) : 0;
      const oldPlayerHp = state.player.currentHp;
      state.player.currentHp = Math.max(0, clampInt(state.player.currentHp, 0, 9999, 0) - ed);
      state.player.currentHP = state.player.currentHp; // compat frontend
      state.log.push(eOut.log || `${state.enemy.name} atacou!`);
      events.push({ type: "message", text: eOut.log || `${state.enemy.name} atacou!` });
      console.log("[BATTLE] Player HP:", oldPlayerHp, "->", state.player.currentHp, "(damage:", ed, ")");

      if (state.player.currentHp <= 0) {
        state.ended = true;
        state.result = "lose";
        state.log.push("Seu Pokémon desmaiou!");
        events.push({ type: "message", text: "Seu Pokémon desmaiou!" });
        trainerStore.applyBattleOutcomeToActivePokemon(userId, {
          trainerPokemonId: state.player.trainerPokemonId,
          level: state.player.level,
          xp: null,
          maxHp: state.player.maxHp,
          currentHp: 0,
          attack: state.player.stats.attack,
          defense: state.player.stats.defense,
          spAttack: state.player.stats.spAttack,
          spDefense: state.player.stats.spDefense,
          speed: state.player.stats.speed,
          moves: state.player.moves.map((m) => m.name),
          moneyDelta: 0,
        });
        clearBattleSession(req);
        console.log("[BATTLE] Player lost!");
      }

      console.log("[BATTLE] Turn complete, returning state");
      return res.json({ ok: true, state, events });
    }

    return res.status(400).json({ ok: false, error: "unsupported_action" });
  } catch {
    return res.status(500).json({ ok: false, error: "battle_action_failed" });
  }
});

// POST /api/game/save - Salva o estado do jogo (PERSISTENTE em BD)
router.post("/game/save", requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { mapId, position, timestamp } = req.body || {};

    if (!mapId) {
      return res.status(400).json({ 
        ok: false, 
        error: "missing_mapId" 
      });
    }

    // Salva no banco de dados (persistente)
    const savedGame = gameStore.saveGame(userId, {
      mapId,
      position: position || { x: 0, y: 0, facing: "down" },
      timestamp: timestamp || Date.now()
    });

    // Também salva na sessão para compatibilidade
    req.session.gameState = {
      mapId: savedGame.mapId,
      position: savedGame.position,
      timestamp: savedGame.timestamp,
      savedAt: savedGame.savedAt
    };

    return res.json({
      ok: true,
      message: "Jogo salvo com sucesso!",
      savedAt: savedGame.savedAt,
      gameState: {
        mapId: savedGame.mapId,
        position: savedGame.position
      }
    });
  } catch (error) {
    console.error("❌ Erro ao salvar jogo:", error);
    return res.status(500).json({ 
      ok: false, 
      error: "save_failed",
      message: error.message || "Falha ao salvar o jogo" 
    });
  }
});

// GET /api/game/save - Recupera o estado salvo do jogo (do BD)
router.get("/game/save", requireAuth, (req, res) => {
  try {
    const userId = req.session.user.id;

    // Tenta carregar do banco de dados primeiro
    const gameState = gameStore.loadGame(userId);
    
    if (!gameState) {
      // Se não houver save, retorna informação
      return res.json({
        ok: true,
        hasSave: false,
        message: "Nenhum save encontrado"
      });
    }

    return res.json({
      ok: true,
      hasSave: true,
      gameState: {
        mapId: gameState.mapId,
        position: gameState.position,
        savedAt: gameState.savedAt
      }
    });
  } catch (error) {
    console.error("❌ Erro ao carregar save:", error);
    return res.status(500).json({ 
      ok: false, 
      error: "load_failed",
      message: error.message || "Falha ao carregar o save"
    });
  }
});

// POST /api/game/checkpoint - Cria checkpoint automático (para recuperação de crashes)
router.post("/game/checkpoint", requireAuth, (req, res) => {
  try {
    const userId = req.session.user.id;
    const { mapId, position, state } = req.body || {};

    if (!mapId) {
      return res.status(400).json({ 
        ok: false, 
        error: "missing_mapId" 
      });
    }

    // Cria checkpoint (não sobrescreve o save)
    const success = gameStore.createCheckpoint(userId, {
      mapId,
      position: position || { x: 0, y: 0, facing: "down" }
    }, state || "idle");

    if (!success) {
      return res.status(400).json({
        ok: false,
        error: "checkpoint_failed"
      });
    }

    // Limpa checkpoints antigos periodicamente
    if (Math.random() < 0.1) { // 10% de chance
      gameStore.cleanOldCheckpoints(userId);
    }

    return res.json({
      ok: true,
      message: "Checkpoint criado"
    });
  } catch (error) {
    console.error("❌ Erro ao criar checkpoint:", error);
    return res.status(500).json({ 
      ok: false, 
      error: "checkpoint_failed",
      message: error.message
    });
  }
});

// GET /api/game/checkpoint - Obtém último checkpoint
router.get("/game/checkpoint", requireAuth, (req, res) => {
  try {
    const userId = req.session.user.id;
    const checkpoint = gameStore.getLastCheckpoint(userId);

    if (!checkpoint) {
      return res.json({
        ok: true,
        hasCheckpoint: false,
        message: "Nenhum checkpoint encontrado"
      });
    }

    return res.json({
      ok: true,
      hasCheckpoint: true,
      checkpoint: {
        mapId: checkpoint.mapId,
        position: checkpoint.position,
        state: checkpoint.state,
        createdAt: checkpoint.createdAt
      }
    });
  } catch (error) {
    console.error("❌ Erro ao carregar checkpoint:", error);
    return res.status(500).json({ 
      ok: false, 
      error: "checkpoint_load_failed"
    });
  }
});

// DELETE /api/game/save - Deleta o save do usuário
router.delete("/game/save", requireAuth, (req, res) => {
  try {
    const userId = req.session.user.id;
    const success = gameStore.deleteGameSave(userId);

    if (!success) {
      return res.json({
        ok: true,
        message: "Nenhum save para deletar"
      });
    }

    // Também limpa da sessão
    delete req.session.gameState;

    return res.json({
      ok: true,
      message: "Save deletado com sucesso"
    });
  } catch (error) {
    console.error("❌ Erro ao deletar save:", error);
    return res.status(500).json({ 
      ok: false, 
      error: "delete_failed"
    });
  }
});

// GET /api/game/stats - Obtém estatísticas do save
router.get("/game/stats", requireAuth, (req, res) => {
  try {
    const userId = req.session.user.id;
    const stats = gameStore.getSaveStats(userId);

    return res.json({
      ok: true,
      hasSave: stats !== null,
      stats: stats || null
    });
  } catch (error) {
    console.error("❌ Erro ao obter stats:", error);
    return res.status(500).json({ 
      ok: false, 
      error: "stats_failed"
    });
  }
});

module.exports = router;
