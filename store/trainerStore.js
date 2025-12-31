const fs = require("fs");
const path = require("path");

const Database = require("better-sqlite3");

const DATA_DIR = path.join(__dirname, "..", "data");
const DB_FILE = path.join(DATA_DIR, "users.sqlite");

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function openDb() {
  ensureDir();
  const db = new Database(DB_FILE);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}

const db = openDb();

function init() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS trainers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE,
      name TEXT NOT NULL,
      avatar TEXT NOT NULL,
      overworld_sprite TEXT NOT NULL DEFAULT 'boy',
      starter_pokemon_id INTEGER NOT NULL,
      level INTEGER NOT NULL DEFAULT 1,
      xp INTEGER NOT NULL DEFAULT 0,
      money INTEGER NOT NULL DEFAULT 1000,
      pokeballs INTEGER NOT NULL DEFAULT 10,
      created_at TEXT NOT NULL,
      updated_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_trainers_user_id ON trainers(user_id);

    CREATE TABLE IF NOT EXISTS trainer_pokemons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trainer_id INTEGER NOT NULL,
      pokemon_id INTEGER NOT NULL,
      nickname TEXT,
      level INTEGER NOT NULL DEFAULT 1,
      xp INTEGER NOT NULL DEFAULT 0,
      max_hp INTEGER NOT NULL,
      current_hp INTEGER NOT NULL,
      attack INTEGER NOT NULL,
      defense INTEGER NOT NULL,
      sp_attack INTEGER NOT NULL,
      sp_defense INTEGER NOT NULL,
      speed INTEGER NOT NULL,
      move1 TEXT,
      move2 TEXT,
      move3 TEXT,
      move4 TEXT,
      storage TEXT NOT NULL DEFAULT 'party',
      team_slot INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT,
      FOREIGN KEY (trainer_id) REFERENCES trainers(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_trainer_pokemons_trainer_id ON trainer_pokemons(trainer_id);
    CREATE INDEX IF NOT EXISTS idx_trainer_pokemons_storage ON trainer_pokemons(storage);
    CREATE INDEX IF NOT EXISTS idx_trainer_pokemons_team_slot ON trainer_pokemons(team_slot);

    CREATE TABLE IF NOT EXISTS trainer_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trainer_id INTEGER NOT NULL,
      item_id TEXT NOT NULL,
      qty INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT,
      UNIQUE(trainer_id, item_id),
      FOREIGN KEY (trainer_id) REFERENCES trainers(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_trainer_items_trainer_id ON trainer_items(trainer_id);
    CREATE INDEX IF NOT EXISTS idx_trainer_items_item_id ON trainer_items(item_id);
  `);

  // Migração leve (DBs antigos não tinham o campo de personagem overworld)
  try {
    const cols = db.prepare("PRAGMA table_info(trainers)").all();
    const names = new Set((Array.isArray(cols) ? cols : []).map((c) => String(c?.name || "")));
    if (!names.has("overworld_sprite")) {
      db.exec("ALTER TABLE trainers ADD COLUMN overworld_sprite TEXT NOT NULL DEFAULT 'boy'");
    }
  } catch {
    // ignore
  }
}

const STARTER_ITEMS = [
  { itemId: "potion", qty: 3 },
  { itemId: "revive", qty: 1 },
];

const STARTER_SEED = {
  1: {
    pokemonId: 1,
    level: 5,
    // Base stats: hp:45, atk:49, def:49, spa:65, spd:65, spe:45
    // Level 5 com IV=10: HP=21, outros=(2*base+10)*5/100+5
    maxHp: 21,
    attack: 15,
    defense: 15,
    spAttack: 18,
    spDefense: 18,
    speed: 15,
    moves: ["tackle", "growl"],
  },
  4: {
    pokemonId: 4,
    level: 5,
    // Base stats: hp:39, atk:52, def:43, spa:60, spd:50, spe:65
    maxHp: 20,
    attack: 16,
    defense: 14,
    spAttack: 17,
    spDefense: 16,
    speed: 18,
    moves: ["scratch", "growl"],
  },
  7: {
    pokemonId: 7,
    level: 5,
    // Base stats: hp:44, atk:48, def:65, spa:50, spd:64, spe:43
    maxHp: 21,
    attack: 15,
    defense: 18,
    spAttack: 16,
    spDefense: 18,
    speed: 14,
    moves: ["tackle", "tail-whip"],
  },
  25: {
    pokemonId: 25,
    level: 5,
    // Base stats: hp:35, atk:55, def:40, spa:50, spd:50, spe:90
    maxHp: 19,
    attack: 16,
    defense: 14,
    spAttack: 16,
    spDefense: 16,
    speed: 22,
    moves: ["thunder-shock", "growl"],
  },
};

function sanitizeTrainerName(name) {
  const s = String(name || "").trim();
  return s.slice(0, 40);
}

function sanitizeAvatarFile(filename) {
  const s = String(filename || "").trim();
  // só arquivos simples (ex: 10.png)
  if (!/^[0-9]+\.(png|jpg|jpeg|webp)$/i.test(s)) return "";
  return s;
}

function toInt(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return NaN;
  return Math.trunc(x);
}

function getTrainerByUserId(userId) {
  const uid = toInt(userId);
  if (!Number.isFinite(uid)) return null;
  return (
    db
      .prepare(
        `SELECT
          id,
          user_id as userId,
          name,
          avatar,
          overworld_sprite as overworldSprite,
          starter_pokemon_id as starterPokemonId,
          level,
          xp,
          money,
          pokeballs,
          created_at as createdAt,
          updated_at as updatedAt
        FROM trainers
        WHERE user_id = ?`
      )
      .get(uid) || null
  );
}

function setOverworldSpriteByUserId(userId, overworldSpriteId) {
  const uid = toInt(userId);
  if (!Number.isFinite(uid)) return { ok: false, error: "invalid_user" };
  const sprite = String(overworldSpriteId || "").trim();
  if (!sprite) return { ok: false, error: "invalid_sprite" };

  const now = new Date().toISOString();
  const info = db
    .prepare("UPDATE trainers SET overworld_sprite = ?, updated_at = ? WHERE user_id = ?")
    .run(sprite, now, uid);

  return { ok: Boolean(info?.changes), trainer: getTrainerByUserId(uid) };
}

function addPokeballsByUserId(userId, delta) {
  const uid = toInt(userId);
  const d = toInt(delta);
  if (!Number.isFinite(uid) || !Number.isFinite(d) || d === 0) return { ok: false, error: "invalid_args" };

  const trainer = getTrainerByUserId(uid);
  if (!trainer) return { ok: false, error: "no_trainer" };

  const cur = toInt(trainer.pokeballs);
  const next = Math.max(0, (Number.isFinite(cur) ? cur : 0) + d);
  if (d < 0 && next === cur) return { ok: false, error: "no_pokeballs" };

  const now = new Date().toISOString();
  const info = db
    .prepare("UPDATE trainers SET pokeballs = ?, updated_at = ? WHERE user_id = ?")
    .run(next, now, uid);

  return { ok: Boolean(info?.changes), pokeballs: next };
}

function catchPokemonByUserId(userId, { pokemonId, level, xp, stats, currentHp, moves }) {
  const uid = toInt(userId);
  const pid = toInt(pokemonId);
  const lvl = toInt(level);
  const experience = Number.isFinite(toInt(xp)) ? toInt(xp) : 0;

  if (!Number.isFinite(uid) || !Number.isFinite(pid) || pid < 1) return { ok: false, error: "invalid_pokemon" };
  if (!Number.isFinite(lvl) || lvl < 1) return { ok: false, error: "invalid_level" };

  const { trainer, party, oak } = getTrainerWithPokemonsByUserId(uid);
  if (!trainer) return { ok: false, error: "no_trainer" };

  const partyCount = Array.isArray(party) ? party.length : 0;
  const storage = partyCount < 6 ? "party" : "oak";

  let teamSlot = null;
  if (storage === "party") {
    const used = new Set((party || []).map((p) => toInt(p.teamSlot)).filter((n) => Number.isFinite(n)));
    for (let i = 1; i <= 6; i++) {
      if (!used.has(i)) {
        teamSlot = i;
        break;
      }
    }
    if (!Number.isFinite(teamSlot)) teamSlot = partyCount + 1;
  }

  const s = stats && typeof stats === "object" ? stats : {};
  const maxHp = toInt(s.maxHp);
  const attack = toInt(s.attack);
  const defense = toInt(s.defense);
  const spAttack = toInt(s.spAttack);
  const spDefense = toInt(s.spDefense);
  const speed = toInt(s.speed);

  const safeMaxHp = Number.isFinite(maxHp) ? Math.max(1, maxHp) : 10;
  const safeCurHp = Math.max(1, Math.min(toInt(currentHp) || safeMaxHp, safeMaxHp));

  const mv = Array.isArray(moves) ? moves : [];
  const now = new Date().toISOString();

  const info = db
    .prepare(
      `INSERT INTO trainer_pokemons(
        trainer_id,pokemon_id,nickname,level,xp,max_hp,current_hp,attack,defense,sp_attack,sp_defense,speed,
        move1,move2,move3,move4,storage,team_slot,created_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    )
    .run(
      toInt(trainer.id),
      pid,
      null,
      lvl,
      experience,
      safeMaxHp,
      safeCurHp,
      Number.isFinite(attack) ? attack : 1,
      Number.isFinite(defense) ? defense : 1,
      Number.isFinite(spAttack) ? spAttack : 1,
      Number.isFinite(spDefense) ? spDefense : 1,
      Number.isFinite(speed) ? speed : 1,
      mv[0] || null,
      mv[1] || null,
      mv[2] || null,
      mv[3] || null,
      storage,
      teamSlot,
      now
    );

  return { ok: Boolean(info?.lastInsertRowid), storage, trainerPokemonId: Number(info?.lastInsertRowid) };
}

function listPokemonsByTrainerId(trainerId, storage) {
  const tid = toInt(trainerId);
  if (!Number.isFinite(tid)) return [];
  const whereStorage = storage ? String(storage) : null;

  const q = whereStorage
    ? `SELECT
        id,
        trainer_id as trainerId,
        pokemon_id as pokemonId,
        nickname,
        level,
        xp,
        max_hp as maxHp,
        current_hp as currentHp,
        attack,
        defense,
        sp_attack as spAttack,
        sp_defense as spDefense,
        speed,
        move1,
        move2,
        move3,
        move4,
        storage,
        team_slot as teamSlot,
        created_at as createdAt,
        updated_at as updatedAt
      FROM trainer_pokemons
      WHERE trainer_id = ? AND storage = ?
      ORDER BY CASE WHEN team_slot IS NULL THEN 999 ELSE team_slot END, id ASC`
    : `SELECT
        id,
        trainer_id as trainerId,
        pokemon_id as pokemonId,
        nickname,
        level,
        xp,
        max_hp as maxHp,
        current_hp as currentHp,
        attack,
        defense,
        sp_attack as spAttack,
        sp_defense as spDefense,
        speed,
        move1,
        move2,
        move3,
        move4,
        storage,
        team_slot as teamSlot,
        created_at as createdAt,
        updated_at as updatedAt
      FROM trainer_pokemons
      WHERE trainer_id = ?
      ORDER BY storage ASC, CASE WHEN team_slot IS NULL THEN 999 ELSE team_slot END, id ASC`;

  return whereStorage ? db.prepare(q).all(tid, whereStorage) : db.prepare(q).all(tid);
}

function healPartyByUserId(userId) {
  const trainer = getTrainerByUserId(userId);
  if (!trainer) return { ok: false, error: "no_trainer" };

  const trainerId = toInt(trainer.id);
  if (!Number.isFinite(trainerId)) return { ok: false, error: "no_trainer" };

  const now = new Date().toISOString();
  const info = db
    .prepare(
      `UPDATE trainer_pokemons
       SET current_hp = max_hp, updated_at = ?
       WHERE trainer_id = ? AND storage = 'party'`
    )
    .run(now, trainerId);

  return { ok: true, healedCount: Number(info?.changes ?? 0) };
}

function ensureStarterPokemonForTrainer(trainerRow) {
  if (!trainerRow) return;

  const trainerId = toInt(trainerRow.id);
  if (!Number.isFinite(trainerId)) return;

  const existing = db
    .prepare("SELECT 1 FROM trainer_pokemons WHERE trainer_id = ? LIMIT 1")
    .get(trainerId);
  if (existing) return;

  const starterId = toInt(trainerRow.starterPokemonId);
  const seed = STARTER_SEED[starterId];
  if (!seed) return;

  const now = new Date().toISOString();
  const moves = Array.isArray(seed.moves) ? seed.moves : [];

  db.prepare(
    `INSERT INTO trainer_pokemons(
      trainer_id,pokemon_id,nickname,level,xp,max_hp,current_hp,attack,defense,sp_attack,sp_defense,speed,
      move1,move2,move3,move4,storage,team_slot,created_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(
    trainerId,
    seed.pokemonId,
    null,
    seed.level || 5,  // Nível 5
    0,
    seed.maxHp,
    seed.maxHp,
    seed.attack,
    seed.defense,
    seed.spAttack,
    seed.spDefense,
    seed.speed,
    moves[0] || null,
    moves[1] || null,
    moves[2] || null,
    moves[3] || null,
    "party",
    1,
    now
  );
}

function ensureStarterItemsForTrainer(trainerRow) {
  if (!trainerRow) return;
  const trainerId = toInt(trainerRow.id);
  if (!Number.isFinite(trainerId)) return;

  const existing = db.prepare("SELECT item_id as itemId, qty FROM trainer_items WHERE trainer_id = ?").all(trainerId);
  const have = new Map((existing || []).map((r) => [String(r.itemId), toInt(r.qty) || 0]));

  const now = new Date().toISOString();
  const ins = db.prepare(
    `INSERT INTO trainer_items(trainer_id,item_id,qty,created_at)
     VALUES (?,?,?,?)
     ON CONFLICT(trainer_id,item_id) DO UPDATE SET qty = qty + excluded.qty, updated_at = excluded.created_at`
  );

  for (const it of STARTER_ITEMS) {
    const id = String(it.itemId);
    const qty = Math.max(0, toInt(it.qty) || 0);
    if (!id || qty <= 0) continue;
    if ((have.get(id) || 0) > 0) continue;
    ins.run(trainerId, id, qty, now);
  }
}

function listTrainerItemsByTrainerId(trainerId) {
  const tid = toInt(trainerId);
  if (!Number.isFinite(tid)) return [];
  return db
    .prepare(
      `SELECT item_id as itemId, qty
       FROM trainer_items
       WHERE trainer_id = ? AND qty > 0
       ORDER BY item_id ASC`
    )
    .all(tid);
}

function listTrainerItemsByUserId(userId) {
  const trainer = getTrainerByUserId(userId);
  if (!trainer) return [];
  return listTrainerItemsByTrainerId(trainer.id);
}

function addItemQtyByUserId(userId, itemId, delta) {
  const uid = toInt(userId);
  const d = toInt(delta);
  const id = String(itemId || "").trim().toLowerCase();
  if (!Number.isFinite(uid) || !Number.isFinite(d) || !id || d === 0) return { ok: false, error: "invalid_args" };

  const trainer = getTrainerByUserId(uid);
  if (!trainer) return { ok: false, error: "no_trainer" };
  const trainerId = toInt(trainer.id);
  if (!Number.isFinite(trainerId)) return { ok: false, error: "no_trainer" };

  const row = db
    .prepare("SELECT qty FROM trainer_items WHERE trainer_id = ? AND item_id = ?")
    .get(trainerId, id);
  const cur = toInt(row?.qty);
  const next = Math.max(0, (Number.isFinite(cur) ? cur : 0) + d);
  if (d < 0 && (!Number.isFinite(cur) || cur <= 0)) return { ok: false, error: "insufficient_qty" };
  if (d < 0 && next === cur) return { ok: false, error: "insufficient_qty" };

  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO trainer_items(trainer_id,item_id,qty,created_at)
     VALUES (?,?,?,?)
     ON CONFLICT(trainer_id,item_id) DO UPDATE SET qty = excluded.qty, updated_at = excluded.created_at`
  ).run(trainerId, id, next, now);

  return { ok: true, itemId: id, qty: next };
}

function getTrainerWithPokemonsByUserId(userId) {
  const trainer = getTrainerByUserId(userId);
  if (!trainer) return { trainer: null, party: [], oak: [] };

  // Backfill para bancos antigos: garante que exista pelo menos o inicial.
  ensureStarterPokemonForTrainer(trainer);
  ensureStarterItemsForTrainer(trainer);

  const party = listPokemonsByTrainerId(trainer.id, "party");
  const oak = listPokemonsByTrainerId(trainer.id, "oak");
  return { trainer, party, oak };
}

function resetTrainer(userId) {
  const uid = toInt(userId);
  if (!Number.isFinite(uid)) return { ok: false, error: "userId inválido" };
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM trainers WHERE user_id = ?").run(uid);
  });
  tx();
  return { ok: true };
}

function createOrResetTrainer({ userId, name, avatar, starterPokemonId, overworldSprite }) {
  const uid = toInt(userId);
  if (!Number.isFinite(uid)) return { ok: false, error: "userId inválido" };

  const trainerName = sanitizeTrainerName(name);
  if (!trainerName) return { ok: false, error: "Nome do treinador inválido." };

  const avatarFile = sanitizeAvatarFile(avatar);
  if (!avatarFile) return { ok: false, error: "Avatar inválido." };

  const starterId = toInt(starterPokemonId);
  if (![1, 4, 7, 25].includes(starterId)) return { ok: false, error: "Pokémon inicial inválido." };

  const seed = STARTER_SEED[starterId];
  if (!seed) return { ok: false, error: "Seed do Pokémon inicial não encontrado." };

  const overworld = String(overworldSprite || "").trim() || "boy";

  const now = new Date().toISOString();

  const insertPokemon = db.prepare(
    `INSERT INTO trainer_pokemons(
      trainer_id,pokemon_id,nickname,level,xp,max_hp,current_hp,attack,defense,sp_attack,sp_defense,speed,
      move1,move2,move3,move4,storage,team_slot,created_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  );

  const upsertItem = db.prepare(
    `INSERT INTO trainer_items(trainer_id,item_id,qty,created_at)
     VALUES (?,?,?,?)
     ON CONFLICT(trainer_id,item_id) DO UPDATE SET qty = qty + excluded.qty, updated_at = excluded.created_at`
  );

  const tx = db.transaction(() => {
    db.prepare("DELETE FROM trainers WHERE user_id = ?").run(uid);
    const info = db.prepare(
      `INSERT INTO trainers(user_id,name,avatar,overworld_sprite,starter_pokemon_id,level,xp,money,pokeballs,created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?)`
    ).run(uid, trainerName, avatarFile, overworld, starterId, 1, 0, 1000, 10, now);

    const trainerId = Number(info.lastInsertRowid);

    // Itens iniciais (além das pokébolas do campo pokeballs)
    for (const it of STARTER_ITEMS) {
      const itemId = String(it.itemId);
      const qty = Math.max(0, toInt(it.qty) || 0);
      if (!itemId || qty <= 0) continue;
      upsertItem.run(trainerId, itemId, qty, now);
    }

    const moves = Array.isArray(seed.moves) ? seed.moves : [];
    insertPokemon.run(
      trainerId,
      seed.pokemonId,
      null,
      1,
      0,
      seed.maxHp,
      seed.maxHp,
      seed.attack,
      seed.defense,
      seed.spAttack,
      seed.spDefense,
      seed.speed,
      moves[0] || null,
      moves[1] || null,
      moves[2] || null,
      moves[3] || null,
      "party",
      1,
      now
    );
  });
  tx();

  return { ok: true, trainer: getTrainerByUserId(uid) };
}

function normalizeTeamSlots(trainerId) {
  const tid = toInt(trainerId);
  if (!Number.isFinite(tid)) return;

  const rows = db
    .prepare(
      `SELECT id, team_slot as teamSlot
       FROM trainer_pokemons
       WHERE trainer_id = ? AND storage = 'party'
       ORDER BY CASE WHEN team_slot IS NULL THEN 999 ELSE team_slot END, id ASC`
    )
    .all(tid);

  let slot = 1;
  for (const r of rows) {
    db.prepare("UPDATE trainer_pokemons SET team_slot = ?, updated_at = ? WHERE id = ?").run(
      slot,
      new Date().toISOString(),
      r.id
    );
    slot += 1;
    if (slot > 6) break;
  }
}

function depositPokemonToOak(userId, trainerPokemonId) {
  const uid = toInt(userId);
  const tpid = toInt(trainerPokemonId);
  if (!Number.isFinite(uid) || !Number.isFinite(tpid)) return { ok: false, error: "invalid_params" };

  const trainer = getTrainerByUserId(uid);
  if (!trainer) return { ok: false, error: "no_trainer" };

  const tx = db.transaction(() => {
    const row = db
      .prepare(
        `SELECT id, storage, team_slot as teamSlot
         FROM trainer_pokemons
         WHERE id = ? AND trainer_id = ?`
      )
      .get(tpid, trainer.id);

    if (!row) return { ok: false, error: "not_found" };
    if (row.storage !== "party") return { ok: false, error: "not_in_party" };

    const now = new Date().toISOString();
    db.prepare("UPDATE trainer_pokemons SET storage = 'oak', team_slot = NULL, updated_at = ? WHERE id = ?")
      .run(now, tpid);

    // Reorganiza slots para não ficar buraco
    normalizeTeamSlots(trainer.id);
    return { ok: true };
  });

  return tx();
}

function withdrawPokemonFromOak(userId, trainerPokemonId, swapWithTrainerPokemonId) {
  const uid = toInt(userId);
  const tpid = toInt(trainerPokemonId);
  const swapId = swapWithTrainerPokemonId == null ? null : toInt(swapWithTrainerPokemonId);
  if (!Number.isFinite(uid) || !Number.isFinite(tpid)) return { ok: false, error: "invalid_params" };
  if (swapWithTrainerPokemonId != null && !Number.isFinite(swapId)) return { ok: false, error: "invalid_swap" };

  const trainer = getTrainerByUserId(uid);
  if (!trainer) return { ok: false, error: "no_trainer" };

  const tx = db.transaction(() => {
    const oakRow = db
      .prepare(
        `SELECT id, storage
         FROM trainer_pokemons
         WHERE id = ? AND trainer_id = ?`
      )
      .get(tpid, trainer.id);

    if (!oakRow) return { ok: false, error: "not_found" };
    if (oakRow.storage !== "oak") return { ok: false, error: "not_in_oak" };

    const partyRows = db
      .prepare(
        `SELECT id, team_slot as teamSlot
         FROM trainer_pokemons
         WHERE trainer_id = ? AND storage = 'party'
         ORDER BY team_slot ASC, id ASC`
      )
      .all(trainer.id);

    const partyCount = partyRows.length;
    const now = new Date().toISOString();

    if (partyCount >= 6) {
      if (!swapId) return { ok: false, error: "party_full" };

      const swapRow = db
        .prepare(
          `SELECT id, storage, team_slot as teamSlot
           FROM trainer_pokemons
           WHERE id = ? AND trainer_id = ?`
        )
        .get(swapId, trainer.id);

      if (!swapRow) return { ok: false, error: "swap_not_found" };
      if (swapRow.storage !== "party") return { ok: false, error: "swap_not_in_party" };

      // Troca: time -> oak, oak -> time (mantém o slot escolhido)
      db.prepare("UPDATE trainer_pokemons SET storage = 'oak', team_slot = NULL, updated_at = ? WHERE id = ?")
        .run(now, swapRow.id);

      db.prepare("UPDATE trainer_pokemons SET storage = 'party', team_slot = ?, updated_at = ? WHERE id = ?")
        .run(Number(swapRow.teamSlot ?? 1), now, oakRow.id);

      normalizeTeamSlots(trainer.id);
      return { ok: true, swapped: true };
    }

    // Time tem espaço: coloca no menor slot disponível (1..6)
    const used = new Set(partyRows.map((r) => Number(r.teamSlot)).filter((n) => Number.isFinite(n) && n > 0));
    let slot = 1;
    while (used.has(slot) && slot <= 6) slot += 1;
    if (slot > 6) return { ok: false, error: "party_full" };

    db.prepare("UPDATE trainer_pokemons SET storage = 'party', team_slot = ?, updated_at = ? WHERE id = ?")
      .run(slot, now, oakRow.id);

    normalizeTeamSlots(trainer.id);
    return { ok: true, swapped: false };
  });

  return tx();
}

function addMoneyByUserId(userId, delta) {
  const uid = toInt(userId);
  const d = toInt(delta);
  if (!Number.isFinite(uid) || !Number.isFinite(d)) return { ok: false, error: "invalid_params" };

  const trainer = getTrainerByUserId(uid);
  if (!trainer) return { ok: false, error: "no_trainer" };

  const now = new Date().toISOString();
  db.prepare("UPDATE trainers SET money = money + ?, updated_at = ? WHERE user_id = ?").run(d, now, uid);
  return { ok: true };
}

function applyBattleOutcomeToActivePokemon(userId, outcome) {
  const uid = toInt(userId);
  if (!Number.isFinite(uid)) return { ok: false, error: "invalid_user" };

  const trainer = getTrainerByUserId(uid);
  if (!trainer) return { ok: false, error: "no_trainer" };

  const trainerPokemonId = toInt(outcome?.trainerPokemonId);
  if (!Number.isFinite(trainerPokemonId)) return { ok: false, error: "invalid_pokemon" };

  const level = toInt(outcome?.level);
  const xp = toInt(outcome?.xp);
  const currentHp = toInt(outcome?.currentHp);
  const maxHp = toInt(outcome?.maxHp);

  const attack = toInt(outcome?.attack);
  const defense = toInt(outcome?.defense);
  const spAttack = toInt(outcome?.spAttack);
  const spDefense = toInt(outcome?.spDefense);
  const speed = toInt(outcome?.speed);

  const moves = Array.isArray(outcome?.moves) ? outcome.moves.map((m) => String(m || "").trim()).filter(Boolean) : [];

  const moneyDelta = toInt(outcome?.moneyDelta ?? 0);

  const tx = db.transaction(() => {
    const row = db
      .prepare(
        `SELECT id
         FROM trainer_pokemons
         WHERE id = ? AND trainer_id = ?`
      )
      .get(trainerPokemonId, trainer.id);

    if (!row) return { ok: false, error: "not_found" };

    const now = new Date().toISOString();

    db.prepare(
      `UPDATE trainer_pokemons
       SET level = ?, xp = ?,
           max_hp = ?, current_hp = ?,
           attack = ?, defense = ?, sp_attack = ?, sp_defense = ?, speed = ?,
           move1 = ?, move2 = ?, move3 = ?, move4 = ?,
           updated_at = ?
       WHERE id = ?`
    ).run(
      Number.isFinite(level) ? level : 1,
      Number.isFinite(xp) ? xp : 0,
      Number.isFinite(maxHp) ? maxHp : 1,
      Number.isFinite(currentHp) ? Math.max(0, Math.min(currentHp, Number.isFinite(maxHp) ? maxHp : currentHp)) : 0,
      Number.isFinite(attack) ? attack : 1,
      Number.isFinite(defense) ? defense : 1,
      Number.isFinite(spAttack) ? spAttack : 1,
      Number.isFinite(spDefense) ? spDefense : 1,
      Number.isFinite(speed) ? speed : 1,
      moves[0] || null,
      moves[1] || null,
      moves[2] || null,
      moves[3] || null,
      now,
      trainerPokemonId
    );

    if (Number.isFinite(moneyDelta) && moneyDelta !== 0) {
      db.prepare("UPDATE trainers SET money = money + ?, updated_at = ? WHERE user_id = ?").run(moneyDelta, now, uid);
    }

    return { ok: true };
  });

  return tx();
}

init();

module.exports = {
  init,
  getTrainerByUserId,
  getTrainerWithPokemonsByUserId,
  listPokemonsByTrainerId,
  listTrainerItemsByUserId,
  addItemQtyByUserId,
  healPartyByUserId,
  createOrResetTrainer,
  resetTrainer,
  setOverworldSpriteByUserId,
  depositPokemonToOak,
  withdrawPokemonFromOak,
  addMoneyByUserId,
  applyBattleOutcomeToActivePokemon,
  addPokeballsByUserId,
  catchPokemonByUserId,
};
