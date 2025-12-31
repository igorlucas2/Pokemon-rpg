/**
 * API Routes: Encounter e Battle Integration
 * 
 * GET  /api/encounter - Gerar encontro selvagem
 * POST /api/battle/turn - Processar rodada de batalha
 * GET  /api/battle/:battleId - Obter estado atual da batalha
 * POST /api/progression/exp - Aplicar EXP e processar level up/evolução
 */

const express = require("express");
const router = express.Router();

const encounterService = require("../services/encounterService");
const fireRedBattleService = require("../services/fireRedBattleService");
const progressionService = require("../services/progressionService");
const spriteService = require("../services/spriteService");
const Database = require("better-sqlite3");
const path = require("path");

// Abrir banco de dados
function getDb() {
  const DB_FILE = path.join(__dirname, "..", "data", "users.sqlite");
  const db = new Database(DB_FILE);
  db.pragma("foreign_keys = ON");
  return db;
}

// ========== ENCOUNTER ENDPOINTS ==========

/**
 * GET /api/encounter?mapId=ViridianForest&terrain=grass&playerLevel=5
 * 
 * Gerar um encontro selvagem aleatório
 */
router.get("/encounter", async (req, res) => {
  try {
    const { mapId, terrain, playerLevel = 5 } = req.query;

    if (!mapId || !terrain) {
      return res.status(400).json({
        error: "mapId and terrain are required",
        example: "/api/encounter?mapId=ViridianForest&terrain=grass&playerLevel=5"
      });
    }

    // Gerar encontro
    const encounter = await encounterService.generateEncounter(
      mapId,
      terrain,
      parseInt(playerLevel) || 5
    );

    // Obter sprite do Pokémon
    const spriteUrl = await spriteService.getSpriteUrl(
      encounter.pokemonId,
      "official-artwork"
    );

    return res.json({
      success: true,
      encounter: {
        ...encounter,
        spriteUrl,
      },
    });
  } catch (err) {
    console.error("GET /api/encounter error:", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/encounter/available
 * 
 * Listar todos os mapas/terrenos com encontros disponíveis
 */
router.get("/encounter/available", (req, res) => {
  try {
    const maps = encounterService.getAvailableMaps();
    res.json({
      success: true,
      maps,
      total: maps.length,
    });
  } catch (err) {
    console.error("GET /api/encounter/available error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ========== BATTLE ENDPOINTS ==========

// Armazenar batalhas em memória (para um projeto real, usar banco)
const activeBattles = new Map();

/**
 * POST /api/battle/start
 * 
 * Iniciar uma batalha selvagem
 * Body: { trainerId, playerPokemonId, enemyEncounter }
 */
router.post("/battle/start", async (req, res) => {
  try {
    const { trainerId, playerPokemonId, enemyEncounter } = req.body;

    if (!trainerId || !playerPokemonId || !enemyEncounter) {
      return res.status(400).json({
        error: "trainerId, playerPokemonId, and enemyEncounter are required",
      });
    }

    const db = getDb();

    // Obter Pokémon do jogador
    const playerPokemon = db
      .prepare("SELECT * FROM trainer_pokemon WHERE id = ? AND trainer_id = ?")
      .get(playerPokemonId, trainerId);

    if (!playerPokemon) {
      return res.status(404).json({ error: "Player Pokemon not found" });
    }

    // Converter moves do banco para formato esperado
    const playerMoves = [];
    for (let i = 1; i <= 4; i++) {
      const moveId = playerPokemon[`move_${i}_id`];
      const pp = playerPokemon[`move_${i}_pp`];
      if (moveId) {
        playerMoves.push({
          moveId,
          moveName: "Unknown", // Carregar do banco depois
          pp: pp || 10,
          ppMax: pp || 10,
        });
      }
    }

    const battleId = `battle_${Date.now()}_${trainerId}`;

    const battle = {
      battleId,
      trainerId,
      playerPokemon: {
        id: playerPokemon.id,
        name: playerPokemon.nickname || "Pokemon",
        pokemonId: playerPokemon.pokedex_id,
        level: playerPokemon.level,
        hp: playerPokemon.hp || playerPokemon.current_hp || playerPokemon.max_hp,  // HP atual
        maxHp: playerPokemon.max_hp || playerPokemon.hp,  // HP máximo
        stats: {
          attack: playerPokemon.attack,
          defense: playerPokemon.defense,
          spAttack: playerPokemon.sp_attack,
          spDefense: playerPokemon.sp_defense,
          speed: playerPokemon.speed,
        },
        moves: playerMoves,
        status: playerPokemon.status,
        type: ["normal"], // Carregar do banco
      },
      enemyPokemon: {
        pokemonId: enemyEncounter.pokemonId,
        name: enemyEncounter.species,
        level: enemyEncounter.level,
        hp: enemyEncounter.hp || enemyEncounter.stats.hp,  // HP atual
        maxHp: enemyEncounter.maxHp || enemyEncounter.stats.hp,  // HP máximo
        stats: enemyEncounter.stats,
        moves: enemyEncounter.moves,
        status: null,
        type: enemyEncounter.type || ["normal"],
        baseExp: enemyEncounter.baseExp,
      },
      turn: 0,
      events: [],
      battleOver: false,
      result: null,
    };

    activeBattles.set(battleId, battle);

    // Obter sprite do inimigo
    const enemySpriteUrl = await spriteService.getSpriteUrl(
      enemyEncounter.pokemonId,
      "official-artwork"
    );

    db.close();

    return res.json({
      success: true,
      battle: {
        battleId,
        playerPokemon: battle.playerPokemon,
        enemyPokemon: {
          ...battle.enemyPokemon,
          spriteUrl: enemySpriteUrl,
        },
      },
    });
  } catch (err) {
    console.error("POST /api/battle/start error:", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/battle/turn
 * 
 * Processar uma rodada de batalha
 * Body: { battleId, moveIndex }
 */
router.post("/battle/turn", async (req, res) => {
  try {
    const { battleId, moveIndex } = req.body;

    if (!battleId || moveIndex === undefined) {
      return res.status(400).json({
        error: "battleId and moveIndex are required",
      });
    }

    const battle = activeBattles.get(battleId);
    if (!battle) {
      return res.status(404).json({ error: "Battle not found" });
    }

    if (battle.battleOver) {
      return res.status(400).json({ error: "Battle already over" });
    }

    // Processar turno
    const turnResult = await fireRedBattleService.processTurn(
      battle.playerPokemon,
      battle.enemyPokemon,
      moveIndex
    );

    // Atualizar HP
    battle.playerPokemon.hp = Math.max(0, turnResult.playerHp);
    battle.enemyPokemon.hp = Math.max(0, turnResult.enemyHp);

    // Adicionar eventos
    battle.events.push(...turnResult.events);
    battle.turn++;

    // Verificar se batalha terminou
    if (turnResult.battleOver) {
      battle.battleOver = true;
      battle.result = turnResult.result;

      // Se ganhou, calcular EXP
      if (turnResult.result === "WIN") {
        const expGain = fireRedBattleService.calculateExpGain(
          battle.enemyPokemon,
          battle.playerPokemon.level
        );

        battle.expGain = expGain;
      }
    }

    return res.json({
      success: true,
      battle: {
        battleId,
        turn: battle.turn,
        playerHp: battle.playerPokemon.hp,
        playerMaxHp: battle.playerPokemon.maxHp,
        enemyHp: battle.enemyPokemon.hp,
        enemyMaxHp: battle.enemyPokemon.maxHp,
        events: turnResult.events,
        battleOver: battle.battleOver,
        result: battle.result,
        expGain: battle.expGain || null,
      },
    });
  } catch (err) {
    console.error("POST /api/battle/turn error:", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/battle/:battleId
 * 
 * Obter estado atual da batalha
 */
router.get("/battle/:battleId", (req, res) => {
  try {
    const { battleId } = req.params;
    const battle = activeBattles.get(battleId);

    if (!battle) {
      return res.status(404).json({ error: "Battle not found" });
    }

    return res.json({
      success: true,
      battle: {
        battleId,
        turn: battle.turn,
        playerPokemon: {
          name: battle.playerPokemon.name,
          hp: battle.playerPokemon.hp,
          maxHp: battle.playerPokemon.maxHp,
          level: battle.playerPokemon.level,
        },
        enemyPokemon: {
          name: battle.enemyPokemon.name,
          hp: battle.enemyPokemon.hp,
          maxHp: battle.enemyPokemon.maxHp,
          level: battle.enemyPokemon.level,
        },
        battleOver: battle.battleOver,
        result: battle.result,
      },
    });
  } catch (err) {
    console.error("GET /api/battle/:battleId error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ========== PROGRESSION ENDPOINTS ==========

/**
 * POST /api/progression/exp
 * 
 * Aplicar EXP após batalha
 * Body: { trainerId, pokemonId, expGain }
 */
router.post("/progression/exp", async (req, res) => {
  try {
    const { trainerId, pokemonId, expGain } = req.body;

    if (!trainerId || !pokemonId || !expGain) {
      return res.status(400).json({
        error: "trainerId, pokemonId, and expGain are required",
      });
    }

    const db = getDb();

    // Obter Pokémon do banco
    const pokemon = db
      .prepare("SELECT * FROM trainer_pokemon WHERE id = ? AND trainer_id = ?")
      .get(pokemonId, trainerId);

    if (!pokemon) {
      db.close();
      return res.status(404).json({ error: "Pokemon not found" });
    }

    // Aplicar EXP
    const progressionResult = await progressionService.applyExp(
      pokemon,
      expGain,
      db
    );

    db.close();

    return res.json({
      success: true,
      progression: {
        pokemonId,
        leveledUp: progressionResult.leveledUp,
        levelUpFrom: progressionResult.levelUpFrom,
        levelUpTo: progressionResult.levelUpTo,
        expGain,
        newTotalExp: progressionResult.newTotalExp,
        newMoves: progressionResult.newMoves,
        evolved: progressionResult.evolved,
        newSpecies: progressionResult.newSpecies,
      },
    });
  } catch (err) {
    console.error("POST /api/progression/exp error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ========== HEALING ENDPOINT ==========

/**
 * POST /api/pokemon/heal
 * 
 * Restaurar HP e PP de um ou mais Pokémon
 * Body: { trainerId, pokemonIds: [1, 2, 3] } ou { trainerId, healAll: true }
 */
router.post("/pokemon/heal", async (req, res) => {
  try {
    const { trainerId, pokemonIds, healAll } = req.body;

    if (!trainerId) {
      return res.status(400).json({ error: "trainerId is required" });
    }

    const db = getDb();
    const movesDb = require("../core/data/moves_database");

    let updatedCount = 0;
    let where = "trainer_id = ?";
    let params = [trainerId];

    if (healAll) {
      // Curar todos os Pokémon do treinador
    } else if (pokemonIds && Array.isArray(pokemonIds) && pokemonIds.length > 0) {
      // Curar apenas Pokémon específicos
      where += ` AND id IN (${pokemonIds.map(() => "?").join(",")})`;
      params.push(...pokemonIds);
    } else {
      db.close();
      return res.status(400).json({ 
        error: "pokemonIds array or healAll flag required" 
      });
    }

    // Buscar Pokémon que serão curados
    const pokemons = db
      .prepare(`SELECT * FROM trainer_pokemon WHERE ${where}`)
      .all(...params);

    if (pokemons.length === 0) {
      db.close();
      return res.status(404).json({ error: "No Pokemon found to heal" });
    }

    // Curar cada Pokémon
    const updateStmt = db.prepare(`
      UPDATE trainer_pokemon
      SET hp = ?,
          move_1_pp = ?,
          move_2_pp = ?,
          move_3_pp = ?,
          move_4_pp = ?,
          status = NULL,
          updated_at = ?
      WHERE id = ?
    `);

    const now = new Date().toISOString();

    for (const pokemon of pokemons) {
      // Restaurar HP para máximo
      const maxHp = pokemon.hp;

      // Restaurar PP para máximo de cada golpe
      const move1MaxPP = pokemon.move_1_id ? (movesDb[pokemon.move_1_id]?.pp || 10) : null;
      const move2MaxPP = pokemon.move_2_id ? (movesDb[pokemon.move_2_id]?.pp || 10) : null;
      const move3MaxPP = pokemon.move_3_id ? (movesDb[pokemon.move_3_id]?.pp || 10) : null;
      const move4MaxPP = pokemon.move_4_id ? (movesDb[pokemon.move_4_id]?.pp || 10) : null;

      updateStmt.run(
        maxHp,
        move1MaxPP,
        move2MaxPP,
        move3MaxPP,
        move4MaxPP,
        now,
        pokemon.id
      );

      updatedCount++;
    }

    db.close();

    return res.json({
      success: true,
      message: `Healed ${updatedCount} Pokémon`,
      healed: updatedCount,
    });
  } catch (err) {
    console.error("POST /api/pokemon/heal error:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
