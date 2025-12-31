const POKEAPI_BASE = "https://pokeapi.co/api/v2";

// Cache simples em memória (igual pokedexApi)
const pokemonCache = new Map();
const moveCache = new Map();
const learnsetCache = new Map();

function clampInt(n, min, max) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, Math.trunc(x)));
}

function pickRandom(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

function xpForLevel(level) {
  // Simplificação inspirada em curvas de experiência clássicas.
  // XP total necessária para alcançar o nível L.
  const L = clampInt(level, 1, 100);
  return L * L * L * 10;
}

function levelFromTotalXp(totalXp) {
  const xp = Math.max(0, Math.trunc(Number(totalXp) || 0));
  let level = 1;
  while (level < 100 && xp >= xpForLevel(level + 1)) level += 1;
  return level;
}

function computeStatsFromBase(baseStats, level) {
  // Fórmula simplificada (estilo GB/Gen1+), usando IV fixo e EV zero.
  const L = clampInt(level, 1, 100);
  const iv = 10;
  const ev = 0;
  const evTerm = Math.floor(ev / 4);

  const hpBase = baseStats.hp;
  const atkBase = baseStats.attack;
  const defBase = baseStats.defense;
  const spaBase = baseStats.spAttack;
  const spdBase = baseStats.spDefense;
  const speBase = baseStats.speed;

  const hp = Math.floor(((2 * hpBase + iv + evTerm) * L) / 100) + L + 10;
  const attack = Math.floor(((2 * atkBase + iv + evTerm) * L) / 100) + 5;
  const defense = Math.floor(((2 * defBase + iv + evTerm) * L) / 100) + 5;
  const spAttack = Math.floor(((2 * spaBase + iv + evTerm) * L) / 100) + 5;
  const spDefense = Math.floor(((2 * spdBase + iv + evTerm) * L) / 100) + 5;
  const speed = Math.floor(((2 * speBase + iv + evTerm) * L) / 100) + 5;

  return { maxHp: hp, attack, defense, spAttack, spDefense, speed };
}

// Tabela de efetividade (Gen 1-ish) — suficiente para MVP.
const TYPE_CHART = {
  normal: { rock: 0.5, ghost: 0 },
  fire: { fire: 0.5, water: 0.5, grass: 2, ice: 2, bug: 2, rock: 0.5, dragon: 0.5 },
  water: { fire: 2, water: 0.5, grass: 0.5, ground: 2, rock: 2, dragon: 0.5 },
  electric: { water: 2, electric: 0.5, grass: 0.5, ground: 0, flying: 2, dragon: 0.5 },
  grass: { fire: 0.5, water: 2, grass: 0.5, poison: 0.5, ground: 2, flying: 0.5, bug: 0.5, rock: 2, dragon: 0.5 },
  ice: { fire: 0.5, water: 0.5, grass: 2, ground: 2, flying: 2, dragon: 2 },
  fighting: { normal: 2, ice: 2, rock: 2, poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, ghost: 0 },
  poison: { grass: 2, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5 },
  ground: { fire: 2, electric: 2, grass: 0.5, poison: 2, flying: 0, bug: 0.5, rock: 2 },
  flying: { electric: 0.5, grass: 2, fighting: 2, bug: 2, rock: 0.5 },
  psychic: { fighting: 2, poison: 2, psychic: 0.5 },
  bug: { fire: 0.5, grass: 2, fighting: 0.5, poison: 2, flying: 0.5, psychic: 2, ghost: 0.5 },
  rock: { fire: 2, ice: 2, flying: 2, bug: 2, fighting: 0.5, ground: 0.5 },
  ghost: { normal: 0, psychic: 0, ghost: 2 },
  dragon: { dragon: 2 },
};

function typeEffectiveness(moveType, defenderTypes) {
  const atk = String(moveType || "").toLowerCase();
  const defs = (Array.isArray(defenderTypes) ? defenderTypes : []).map((t) => String(t || "").toLowerCase());
  let mult = 1;
  for (const d of defs) {
    const row = TYPE_CHART[atk];
    const m = row && Object.prototype.hasOwnProperty.call(row, d) ? row[d] : 1;
    mult *= m;
  }
  return mult;
}

async function fetchJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`fetch_failed:${r.status}`);
  return r.json();
}

async function getPokemonDetails(pokemonId) {
  const id = clampInt(pokemonId, 1, 100000);
  const key = `pokemon:${id}`;
  if (pokemonCache.has(key)) return pokemonCache.get(key);

  const d = await fetchJson(`${POKEAPI_BASE}/pokemon/${id}`);
  const out = {
    id: d.id,
    name: d.name,
    types: (d.types || []).map((t) => t.type.name),
    stats: {
      hp: d.stats.find((s) => s.stat.name === "hp")?.base_stat ?? 1,
      attack: d.stats.find((s) => s.stat.name === "attack")?.base_stat ?? 1,
      defense: d.stats.find((s) => s.stat.name === "defense")?.base_stat ?? 1,
      spAttack: d.stats.find((s) => s.stat.name === "special-attack")?.base_stat ?? 1,
      spDefense: d.stats.find((s) => s.stat.name === "special-defense")?.base_stat ?? 1,
      speed: d.stats.find((s) => s.stat.name === "speed")?.base_stat ?? 1,
    },
    artwork: d.sprites?.other?.["official-artwork"]?.front_default || null,
    gif: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/${d.id}.gif`,
  };

  pokemonCache.set(key, out);
  return out;
}

async function getMoveDetails(moveName) {
  const name = String(moveName || "").trim().toLowerCase();
  if (!name) return null;
  const key = `move:${name}`;
  if (moveCache.has(key)) return moveCache.get(key);

  const d = await fetchJson(`${POKEAPI_BASE}/move/${encodeURIComponent(name)}`);
  const out = {
    name: d.name,
    power: d.power == null ? 0 : Number(d.power),
    accuracy: d.accuracy == null ? 100 : Number(d.accuracy),
    type: d.type?.name || "normal",
    damageClass: d.damage_class?.name || "physical", // physical|special|status
  };

  moveCache.set(key, out);
  return out;
}

function normalizeMoveList(moves) {
  const arr = (Array.isArray(moves) ? moves : []).map((m) => String(m || "").trim().toLowerCase()).filter(Boolean);
  // sem duplicatas mantendo ordem
  const out = [];
  const seen = new Set();
  for (const m of arr) {
    if (seen.has(m)) continue;
    seen.add(m);
    out.push(m);
  }
  return out.slice(0, 4);
}

async function getLearnset(pokemonId) {
  const id = clampInt(pokemonId, 1, 100000);
  const key = `learnset:${id}`;
  if (learnsetCache.has(key)) return learnsetCache.get(key);

  const d = await fetchJson(`${POKEAPI_BASE}/pokemon/${id}`);
  const out = [];

  const allowedGroups = new Set(["red-blue", "yellow"]);

  for (const m of d.moves || []) {
    const moveName = m.move?.name;
    if (!moveName) continue;

    const details = Array.isArray(m.version_group_details) ? m.version_group_details : [];
    // PokeAPI traz múltiplos grupos; pegamos o menor level_learned_at dentro dos grupos permitidos
    let best = null;
    for (const vd of details) {
      if (vd.move_learn_method?.name !== "level-up") continue;
      const vg = vd.version_group?.name;
      if (!allowedGroups.has(vg)) continue;
      const lvl = Number(vd.level_learned_at);
      if (!Number.isFinite(lvl) || lvl <= 0) continue;
      if (best == null || lvl < best) best = lvl;
    }

    if (best != null) out.push({ level: best, move: String(moveName).toLowerCase() });
  }

  out.sort((a, b) => (a.level - b.level) || a.move.localeCompare(b.move));
  learnsetCache.set(key, out);
  return out;
}

async function buildMovesForLevel(pokemonId, level) {
  const learnset = await getLearnset(pokemonId);
  const learned = learnset.filter((x) => x.level <= level);
  if (learned.length === 0) return [];

  // pega os últimos 4 aprendidos
  const last = learned.slice(-8); // margem
  const moves = normalizeMoveList(last.map((x) => x.move)).slice(-4);
  return moves;
}

function damageRoll() {
  // fator aleatório 0.85..1.00
  return 0.85 + Math.random() * 0.15;
}

function calcDamage({ level, power, atk, def, stab, effectiveness }) {
  const L = clampInt(level, 1, 100);
  const P = Math.max(0, Math.trunc(Number(power) || 0));
  const A = Math.max(1, Math.trunc(Number(atk) || 1));
  const D = Math.max(1, Math.trunc(Number(def) || 1));

  // Base: ((2L/5+2) * P * A / D) / 50 + 2
  const base = Math.floor((Math.floor(((2 * L) / 5) + 2) * P * A) / D);
  const dmg0 = Math.floor(base / 50) + 2;

  const mod = (stab ? 1.5 : 1) * (Number(effectiveness) || 1) * damageRoll();
  const dmg = Math.max(1, Math.floor(dmg0 * mod));
  return dmg;
}

async function chooseMove(attackerMoves) {
  const list = normalizeMoveList(attackerMoves);
  if (list.length === 0) return null;
  // MVP: escolhe aleatório
  return pickRandom(list);
}

async function simulateBattle({ player, enemySpec }) {
  // player: trainer_pokemons row
  const playerLevel = clampInt(player.level ?? 1, 1, 100);
  const playerMoves = normalizeMoveList([player.move1, player.move2, player.move3, player.move4]);

  const enemyPokemonId = clampInt(enemySpec.pokemonId, 1, 100000);
  const enemyLevel = clampInt(enemySpec.level ?? 1, 1, 100);

  const enemyDetails = await getPokemonDetails(enemyPokemonId);
  const enemyStats = computeStatsFromBase(enemyDetails.stats, enemyLevel);
  const enemyMoves = await buildMovesForLevel(enemyPokemonId, enemyLevel);

  const state = {
    player: {
      trainerPokemonId: player.id,
      pokemonId: player.pokemonId,
      level: playerLevel,
      name: null,
      types: null, // opcional
      maxHp: Number(player.maxHp),
      currentHp: Number(player.currentHp),
      attack: Number(player.attack),
      defense: Number(player.defense),
      spAttack: Number(player.spAttack),
      spDefense: Number(player.spDefense),
      speed: Number(player.speed),
      moves: playerMoves,
    },
    enemy: {
      pokemonId: enemyDetails.id,
      name: enemyDetails.name,
      types: enemyDetails.types,
      level: enemyLevel,
      maxHp: enemyStats.maxHp,
      currentHp: enemyStats.maxHp,
      attack: enemyStats.attack,
      defense: enemyStats.defense,
      spAttack: enemyStats.spAttack,
      spDefense: enemyStats.spDefense,
      speed: enemyStats.speed,
      moves: enemyMoves,
      artwork: enemyDetails.artwork,
      gif: enemyDetails.gif,
    },
    log: [],
  };

  if (!state.player.currentHp || state.player.currentHp <= 0) {
    state.player.currentHp = state.player.maxHp;
  }

  const turnOrder = () => {
    const ps = Number(state.player.speed) || 1;
    const es = Number(state.enemy.speed) || 1;
    if (ps === es) return Math.random() < 0.5 ? ["player", "enemy"] : ["enemy", "player"];
    return ps > es ? ["player", "enemy"] : ["enemy", "player"];
  };

  const describe = (side) => (side === "player" ? "Seu Pokémon" : `Wild ${state.enemy.name}`);

  while (state.player.currentHp > 0 && state.enemy.currentHp > 0) {
    const [first, second] = turnOrder();
    for (const side of [first, second]) {
      const atkSide = side;
      const defSide = side === "player" ? "enemy" : "player";
      const attacker = state[atkSide];
      const defender = state[defSide];

      if (attacker.currentHp <= 0 || defender.currentHp <= 0) continue;

      const moveName = await chooseMove(attacker.moves);
      if (!moveName) {
        state.log.push(`${describe(atkSide)} não tem golpes!`);
        continue;
      }

      const move = await getMoveDetails(moveName);
      if (!move || !move.power || move.damageClass === "status") {
        state.log.push(`${describe(atkSide)} usou ${moveName}, mas nada aconteceu.`);
        continue;
      }

      const accuracy = Math.max(1, Math.min(100, Math.trunc(move.accuracy ?? 100)));
      if (Math.random() * 100 > accuracy) {
        state.log.push(`${describe(atkSide)} usou ${move.name} e errou!`);
        continue;
      }

      const atkStat = move.damageClass === "special" ? attacker.spAttack : attacker.attack;
      const defStat = move.damageClass === "special" ? defender.spDefense : defender.defense;
      const stab = Array.isArray(attacker.types) ? attacker.types.includes(move.type) : false;
      const effectiveness = typeEffectiveness(move.type, defender.types);
      const dmg = calcDamage({ level: attacker.level, power: move.power, atk: atkStat, def: defStat, stab, effectiveness });

      defender.currentHp = Math.max(0, Math.trunc(defender.currentHp - dmg));

      let effText = "";
      if (effectiveness >= 2) effText = " (super efetivo)";
      else if (effectiveness > 0 && effectiveness < 1) effText = " (não muito efetivo)";
      else if (effectiveness === 0) effText = " (não teve efeito)";

      state.log.push(`${describe(atkSide)} usou ${move.name} e causou ${dmg} de dano.${effText}`);

      if (defender.currentHp <= 0) {
        state.log.push(`${describe(defSide)} desmaiou!`);
        break;
      }
    }
  }

  const playerWon = state.enemy.currentHp <= 0 && state.player.currentHp > 0;

  const xpGain = playerWon ? Math.max(1, enemyLevel * 20) : 0;
  const playerXpBefore = Math.max(0, Math.trunc(Number(player.xp) || 0));
  const playerXpAfter = playerXpBefore + xpGain;

  const playerLevelAfter = levelFromTotalXp(playerXpAfter);

  return {
    ok: true,
    result: playerWon ? "win" : "lose",
    xpGain,
    playerAfter: {
      trainerPokemonId: player.id,
      pokemonId: player.pokemonId,
      xp: playerXpAfter,
      level: playerLevelAfter,
      currentHp: state.player.currentHp,
    },
    enemy: state.enemy,
    log: state.log,
  };
}

async function applyLevelUpLearnset({ pokemonId, oldLevel, newLevel, currentMoves }) {
  const moves = normalizeMoveList(currentMoves);
  if (newLevel <= oldLevel) return { moves, learned: [] };

  const learnset = await getLearnset(pokemonId);
  const learned = [];

  for (let lvl = oldLevel + 1; lvl <= newLevel; lvl += 1) {
    const atLevel = learnset.filter((x) => x.level === lvl);
    for (const entry of atLevel) {
      const mv = entry.move;
      if (!mv) continue;
      if (moves.includes(mv)) continue;

      if (moves.length < 4) {
        moves.push(mv);
        learned.push({ move: mv, replaced: null });
      } else {
        const replaced = moves[0];
        moves.shift();
        moves.push(mv);
        learned.push({ move: mv, replaced });
      }
    }
  }

  return { moves, learned };
}

module.exports = {
  xpForLevel,
  levelFromTotalXp,
  computeStatsFromBase,
  getPokemonDetails,
  getMoveDetails,
  typeEffectiveness,
  calcDamage,
  simulateBattle,
  applyLevelUpLearnset,
};
