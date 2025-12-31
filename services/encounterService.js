/**
 * EncounterService
 * 
 * Responsável por gerar encontros selvagens baseado no pokefirered-master
 * Dado um mapa e tipo de terreno, retorna um Pokémon selvagem com nível e moveset apropriados
 */

const wildEncounters = require("../core/data/wild_encounters");
const pokemonDb = require("../core/data/pokemon_database");
const movesDb = require("../core/data/moves_database");
const growthRates = require("../core/data/growth_rates");

class EncounterService {
  /**
   * Gerar um encontro selvagem aleatório
   * 
   * @param {string} mapId - ID do mapa (ex: "ViridianForest")
   * @param {string} terrain - Tipo de terreno (grass, water, fishing, rock_smash, etc.)
   * @param {number} playerLevel - Nível do jogador (para ajuste de dificuldade)
   * @returns {Promise<Object>} Encontro com { species, level, ivs, nature, moves, stats }
   */
  async generateEncounter(mapId, terrain, playerLevel = 1) {
    try {
      // 1. Validar que o mapa e terreno existem
      if (!wildEncounters[mapId]) {
        throw new Error(`Map "${mapId}" not found in wild encounters database`);
      }

      const mapEncounters = wildEncounters[mapId];
      if (!mapEncounters[terrain]) {
        throw new Error(`Terrain "${terrain}" not available in map "${mapId}"`);
      }

      // 2. Obter lista de Pokémon possíveis para esse mapa + terreno
      const possibleEncounters = mapEncounters[terrain].encounters;

      // 3. Selecionar um Pokémon aleatoriamente (com peso de taxa de encontro)
      const selectedPokemon = this._selectRandomEncounter(possibleEncounters);
      const pokemonId = this._getPokemonIdByName(selectedPokemon.species);

      if (!pokemonId || !pokemonDb[pokemonId]) {
        throw new Error(`Pokemon "${selectedPokemon.species}" not found in database`);
      }

      const pokemonData = pokemonDb[pokemonId];

      // 4. Determinar nível dentro da faixa especificada
      const level = this._determineLevelInRange(
        selectedPokemon.min_level,
        selectedPokemon.max_level,
        playerLevel
      );

      // 5. Gerar IVs aleatórios (0-31 cada stat)
      const ivs = this._generateRandomIVs();

      // 6. Gerar natureza aleatória (opcional, mas pronto para expansão)
      const nature = this._generateRandomNature();

      // 7. Calcular stats baseado em level, base stats, IVs
      const stats = this._calculateStats(pokemonData.baseStats, level, ivs);

      // 8. Obter moveset apropriado para o nível
      const moves = this._getMovesForLevel(pokemonData.learnset, level);

      // 9. Retornar encontro completo
      return {
        pokemonId,
        species: pokemonData.name,
        level,
        nature,
        ivs,
        evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
        stats,
        hp: stats.hp,           // HP atual (começa cheio)
        maxHp: stats.hp,         // HP máximo
        moves: moves.map((moveId) => ({
          moveId,
          moveName: movesDb[moveId]?.name || "Unknown",
          pp: movesDb[moveId]?.pp || 10,          // PP atual
          ppMax: movesDb[moveId]?.pp || 10,       // PP máximo
        })),
        baseExp: pokemonData.baseExp,
        growthRate: pokemonData.growthRate,
        type: pokemonData.type,  // Adicionar tipos do Pokémon
      };
    } catch (err) {
      console.error("EncounterService.generateEncounter error:", err);
      throw err;
    }
  }

  /**
   * Selecionar um encontro aleatório baseado nas taxas
   * @private
   */
  _selectRandomEncounter(encounters) {
    // Criar array com pesos normalizados
    const totalRate = encounters.reduce((sum, e) => sum + e.rate, 0);
    const normalized = encounters.map((e) => ({
      ...e,
      normalizedRate: e.rate / totalRate,
    }));

    // Selecionar baseado em distribuição de probabilidade
    let roll = Math.random();
    for (const encounter of normalized) {
      roll -= encounter.normalizedRate;
      if (roll <= 0) {
        return encounter;
      }
    }

    // Fallback (não deveria acontecer)
    return encounters[0];
  }

  /**
   * Obter ID de Pokémon pelo nome
   * @private
   */
  _getPokemonIdByName(speciesName) {
    // Procurar no banco de dados
    const normalized = speciesName.toLowerCase();
    for (const [id, pokemon] of Object.entries(pokemonDb)) {
      if (pokemon.name.toLowerCase() === normalized) {
        return parseInt(id);
      }
    }
    return null;
  }

  /**
   * Determinar nível dentro da faixa, com ajuste baseado no jogador
   * @private
   */
  _determineLevelInRange(minLevel, maxLevel, playerLevel) {
    // Se o jogador é muito fraco, ajustar nível para baixo
    const adjustedMin = Math.max(minLevel, Math.floor(playerLevel * 0.7));
    const adjustedMax = Math.min(maxLevel, Math.ceil(playerLevel * 1.3));

    // Garantir que min <= max
    const actualMin = Math.min(adjustedMin, adjustedMax);
    const actualMax = Math.max(adjustedMin, adjustedMax);

    return Math.floor(Math.random() * (actualMax - actualMin + 1)) + actualMin;
  }

  /**
   * Gerar IVs aleatórios (Individual Values: 0-31 cada)
   * @private
   */
  _generateRandomIVs() {
    return {
      hp: Math.floor(Math.random() * 32),
      atk: Math.floor(Math.random() * 32),
      def: Math.floor(Math.random() * 32),
      spa: Math.floor(Math.random() * 32),
      spd: Math.floor(Math.random() * 32),
      spe: Math.floor(Math.random() * 32),
    };
  }

  /**
   * Gerar natureza aleatória (25 tipos)
   * @private
   */
  _generateRandomNature() {
    const natures = [
      "Hardy",
      "Lonely",
      "Brave",
      "Adamant",
      "Naughty",
      "Bold",
      "Docile",
      "Relaxed",
      "Impish",
      "Lax",
      "Timid",
      "Hasty",
      "Serious",
      "Jolly",
      "Naive",
      "Modest",
      "Mild",
      "Quiet",
      "Bashful",
      "Rash",
      "Calm",
      "Gentle",
      "Sassy",
      "Careful",
      "Quirky",
    ];
    return natures[Math.floor(Math.random() * natures.length)];
  }

  /**
   * Calcular stats baseado em fórmula FireRed
   * HP = ((2*Base+IV+(EV/4))*Level/100)+Level+10
   * Outros = ((2*Base+IV+(EV/4))*Level/100)+5
   * @private
   */
  _calculateStats(baseStats, level, ivs, evs = {}) {
    const calculateStat = (base, iv, ev, statLevel, isHP = false) => {
      const evTerm = Math.floor((ev || 0) / 4);
      const formula = (2 * base + iv + evTerm) * statLevel / 100;
      return isHP 
        ? Math.floor(formula) + statLevel + 10 
        : Math.floor(formula) + 5;
    };

    return {
      hp: calculateStat(
        baseStats.hp,
        ivs.hp || 10,
        evs.hp || 0,
        level,
        true
      ),
      attack: calculateStat(
        baseStats.attack,
        ivs.atk || 10,
        evs.atk || 0,
        level
      ),
      defense: calculateStat(
        baseStats.defense,
        ivs.def || 10,
        evs.def || 0,
        level
      ),
      spAttack: calculateStat(
        baseStats.spAttack,
        ivs.spa || 10,
        evs.spa || 0,
        level
      ),
      spDefense: calculateStat(
        baseStats.spDefense,
        ivs.spd || 10,
        evs.spd || 0,
        level
      ),
      speed: calculateStat(
        baseStats.speed,
        ivs.spe || 10,
        evs.spe || 0,
        level
      ),
    };
  }

  /**
   * Obter golpes que o Pokémon conhece no nível especificado
   * Retorna até 4 golpes (os últimos aprendidos)
   * @private
   */
  _getMovesForLevel(learnset, level) {
    // Filtrar apenas golpes que devem ser conhecidos neste nível
    const availableMoves = learnset
      .filter((l) => l.level <= level)
      .sort((a, b) => b.level - a.level) // Ordenar por nível descendente
      .slice(0, 4) // Pegar até 4 últimos golpes
      .map((l) => l.moveId);

    return availableMoves;
  }

  /**
   * Obter todos os mapa + terrenos disponíveis
   */
  getAvailableMaps() {
    const maps = [];
    for (const [mapId, terrains] of Object.entries(wildEncounters)) {
      for (const [terrain] of Object.entries(terrains)) {
        maps.push({ mapId, terrain });
      }
    }
    return maps;
  }

  /**
   * Validar se um mapa + terreno é válido
   */
  isValidEncounter(mapId, terrain) {
    return !!(
      wildEncounters[mapId] && 
      wildEncounters[mapId][terrain]
    );
  }
}

module.exports = new EncounterService();
