/**
 * ProgressionService
 * 
 * Responsável por:
 * - Aplicar ganho de experiência
 * - Level up automático
 * - Aprendizado de golpes
 * - Evolução automática
 * - Persistência em banco de dados
 */

const growthRates = require("../core/data/growth_rates");
const pokemonDb = require("../core/data/pokemon_database");
const movesDb = require("../core/data/moves_database");

class ProgressionService {
  /**
   * Aplicar experiência para um Pokémon específico
   * 
   * @param {Object} pokemonRecord - Registro do banco de dados do Pokémon
   * @param {number} expGain - EXP a adicionar
   * @param {Object} db - Referência ao banco de dados (better-sqlite3)
   * @returns {Promise<Object>} { leveledUp, newLevel, newMoves, evolved, newSpecies }
   */
  async applyExp(pokemonRecord, expGain, db) {
    const results = {
      leveledUp: false,
      levelUpFrom: pokemonRecord.level,
      levelUpTo: pokemonRecord.level,
      newMoves: [],
      evolved: false,
      newSpecies: null,
      statsUpdated: false,
    };

    try {
      // 1. Adicionar EXP ao Pokémon
      let newTotalExp = (pokemonRecord.current_exp || 0) + expGain;
      let newLevel = this._getLevelFromExp(
        newTotalExp,
        pokemonRecord.growth_rate
      );

      results.newTotalExp = newTotalExp;

      // 2. Processar level ups (pode haver múltiplos se ganhar muito EXP)
      if (newLevel > pokemonRecord.level) {
        results.leveledUp = true;
        results.levelUpTo = newLevel;

        // Processar cada nível intermediário
        for (let lvl = pokemonRecord.level + 1; lvl <= newLevel; lvl++) {
          // Aprender novos golpes
          const newMoves = this._getNewMovesOnLevelUp(pokemonRecord.pokedex_id, lvl);
          if (newMoves.length > 0) {
            results.newMoves.push(...newMoves);
          }

          // Verificar evolução
          const evolution = this._checkEvolution(pokemonRecord.pokedex_id, lvl);
          if (evolution) {
            results.evolved = true;
            results.newSpecies = evolution;
            pokemonRecord.pokedex_id = evolution.id;
            pokemonRecord.is_evolved = 1;
          }
        }

        results.statsUpdated = true;
      }

      // 3. Atualizar moveset (máximo 4 golpes)
      if (results.newMoves.length > 0) {
        const updatedMoves = this._updateMoveset(
          pokemonRecord,
          results.newMoves,
          db
        );
        results.updatedMoveSlots = updatedMoves;
      }

      // 4. Persistir mudanças no banco
      this._persistPokemonChanges(pokemonRecord, newTotalExp, newLevel, db);

      return results;
    } catch (err) {
      console.error("ProgressionService.applyExp error:", err);
      throw err;
    }
  }

  /**
   * Aplicar EXP para todo o time do jogador
   * 
   * @param {number} trainerId - ID do treinador
   * @param {number} totalExp - EXP total a distribuir
   * @param {Object} db - Banco de dados
   * @returns {Promise<Array>} Array de resultados por Pokémon
   */
  async applyExpToTeam(trainerId, totalExp, db) {
    const results = [];

    try {
      // Obter todos os Pokémon vivos do time
      const teamMembers = db
        .prepare(
          `SELECT * FROM trainer_pokemon 
           WHERE trainer_id = ? AND hp > 0 
           ORDER BY pokedex_id ASC`
        )
        .all(trainerId);

      if (teamMembers.length === 0) {
        throw new Error("No alive Pokemon in team");
      }

      // Distribuir EXP igualmente
      const expPerMember = Math.floor(totalExp / teamMembers.length);

      for (const pokemon of teamMembers) {
        const result = await this.applyExp(pokemon, expPerMember, db);
        results.push({
          pokemonId: pokemon.id,
          ...result,
        });
      }

      return results;
    } catch (err) {
      console.error("ProgressionService.applyExpToTeam error:", err);
      throw err;
    }
  }

  /**
   * Obter nível correspondente ao EXP total
   * @private
   */
  _getLevelFromExp(totalExp, growthRate) {
    const curve = growthRates[growthRate] || growthRates["GROWTH_MEDIUM_SLOW"];

    for (let level = 100; level >= 1; level--) {
      if (totalExp >= (curve[level] || 0)) {
        return Math.min(level, 100);
      }
    }

    return 1;
  }

  /**
   * Obter novo golpe a aprender neste nível
   * @private
   */
  _getNewMovesOnLevelUp(pokemonId, level) {
    const pokemon = pokemonDb[pokemonId];
    if (!pokemon) return [];

    const newMoves = pokemon.learnset
      .filter((l) => l.level === level)
      .map((l) => ({
        moveId: l.moveId,
        moveName: l.moveName,
        pp: movesDb[l.moveId]?.pp || 10,
      }));

    return newMoves;
  }

  /**
   * Verificar se o Pokémon evolui neste nível
   * @private
   */
  _checkEvolution(pokemonId, level) {
    const pokemon = pokemonDb[pokemonId];
    if (!pokemon || pokemon.evolutions.length === 0) {
      return null;
    }

    for (const evo of pokemon.evolutions) {
      if (evo.triggeredBy === "level" && evo.level === level) {
        return pokemonDb[evo.evolvesInto];
      }
    }

    return null;
  }

  /**
   * Atualizar moveset quando aprende novo golpe
   * Se já tem 4, substituir o mais antigo
   * @private
   */
  _updateMoveset(pokemonRecord, newMoves, db) {
    const updatedSlots = [];
    const moveSlots = [
      { slot: 1, moveId: "move_1_id", ppId: "move_1_pp" },
      { slot: 2, moveId: "move_2_id", ppId: "move_2_pp" },
      { slot: 3, moveId: "move_3_id", ppId: "move_3_pp" },
      { slot: 4, moveId: "move_4_id", ppId: "move_4_pp" },
    ];

    let slotIndex = 0;

    // Preencher slots vazios primeiro
    for (const slot of moveSlots) {
      if (!pokemonRecord[slot.moveId]) {
        if (slotIndex < newMoves.length) {
          const newMove = newMoves[slotIndex];
          pokemonRecord[slot.moveId] = newMove.moveId;
          pokemonRecord[slot.ppId] = newMove.pp;
          updatedSlots.push({ slot: slot.slot, moveId: newMove.moveId });
          slotIndex++;
        }
      }
    }

    // Se ainda houver novos golpes, substituir os antigos
    for (const slot of moveSlots) {
      if (slotIndex < newMoves.length && pokemonRecord[slot.moveId]) {
        const newMove = newMoves[slotIndex];
        pokemonRecord[slot.moveId] = newMove.moveId;
        pokemonRecord[slot.ppId] = newMove.pp;
        updatedSlots.push({ slot: slot.slot, moveId: newMove.moveId });
        slotIndex++;
      }
    }

    return updatedSlots;
  }

  /**
   * Persistir mudanças no banco de dados (transação atômica)
   * @private
   */
  _persistPokemonChanges(pokemonRecord, newTotalExp, newLevel, db) {
    try {
      const transaction = db.transaction(() => {
        // Recalcular stats
        const pokemon = pokemonDb[pokemonRecord.pokedex_id];
        if (pokemon) {
          const newStats = this._calculateStats(
            pokemon.baseStats,
            newLevel,
            pokemonRecord
          );

          db.prepare(
            `UPDATE trainer_pokemon 
             SET current_exp = ?, 
                 level = ?,
                 hp = ?,
                 attack = ?,
                 defense = ?,
                 sp_attack = ?,
                 sp_defense = ?,
                 speed = ?,
                 move_1_id = ?,
                 move_1_pp = ?,
                 move_2_id = ?,
                 move_2_pp = ?,
                 move_3_id = ?,
                 move_3_pp = ?,
                 move_4_id = ?,
                 move_4_pp = ?,
                 pokedex_id = ?,
                 is_evolved = ?,
                 updated_at = ?
             WHERE id = ?`
          ).run(
            newTotalExp,
            newLevel,
            newStats.hp,
            newStats.attack,
            newStats.defense,
            newStats.spAttack,
            newStats.spDefense,
            newStats.speed,
            pokemonRecord.move_1_id,
            pokemonRecord.move_1_pp,
            pokemonRecord.move_2_id,
            pokemonRecord.move_2_pp,
            pokemonRecord.move_3_id,
            pokemonRecord.move_3_pp,
            pokemonRecord.move_4_id,
            pokemonRecord.move_4_pp,
            pokemonRecord.pokedex_id,
            pokemonRecord.is_evolved,
            new Date().toISOString(),
            pokemonRecord.id
          );
        }
      });

      transaction();
    } catch (err) {
      console.error("ProgressionService._persistPokemonChanges error:", err);
      throw err;
    }
  }

  /**
   * Calcular stats using FireRed formula
   * @private
   */
  _calculateStats(baseStats, level, pokemonRecord) {
    const calculateStat = (base, iv, ev, statLevel, isHP = false) => {
      const evTerm = Math.floor(ev / 4);
      const formula = (2 * base + iv + evTerm) * statLevel / 100;
      return isHP
        ? Math.floor(formula) + statLevel + 10
        : Math.floor(formula) + 5;
    };

    return {
      hp: calculateStat(
        baseStats.hp,
        pokemonRecord.iv_hp || 10,
        pokemonRecord.ev_hp || 0,
        level,
        true
      ),
      attack: calculateStat(
        baseStats.attack,
        pokemonRecord.iv_atk || 10,
        pokemonRecord.ev_atk || 0,
        level
      ),
      defense: calculateStat(
        baseStats.defense,
        pokemonRecord.iv_def || 10,
        pokemonRecord.ev_def || 0,
        level
      ),
      spAttack: calculateStat(
        baseStats.spAttack,
        pokemonRecord.iv_spa || 10,
        pokemonRecord.ev_spa || 0,
        level
      ),
      spDefense: calculateStat(
        baseStats.spDefense,
        pokemonRecord.iv_spd || 10,
        pokemonRecord.ev_spd || 0,
        level
      ),
      speed: calculateStat(
        baseStats.speed,
        pokemonRecord.iv_spe || 10,
        pokemonRecord.ev_spe || 0,
        level
      ),
    };
  }
}

module.exports = new ProgressionService();
