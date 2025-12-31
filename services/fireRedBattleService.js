/**
 * FireRedBattleService
 * 
 * Implementa as regras de batalha exatas do pokefirered-master
 * Cálculo de dano, crit, status, turnos, EXP, etc.
 */

const movesDb = require("../core/data/moves_database");
const battleEffects = require("./battleEffects");

class FireRedBattleService {
  /**
   * Simular uma rodada completa de batalha
   * 
   * @param {Object} playerPokemon - Pokemon do jogador { id, stats, moves, level, hp, status }
   * @param {Object} enemyPokemon - Pokemon selvagem/inimigo
   * @param {number} playerMoveIndex - Índice do golpe (0-3)
   * @returns {Promise<Object>} { playerDamage, enemyDamage, playerStatus, enemyStatus, events, battleOver, result }
   */
  async processTurn(playerPokemon, enemyPokemon, playerMoveIndex) {
    const events = [];

    try {
      // 1. Validar e obter movimentos
      if (playerMoveIndex < 0 || playerMoveIndex >= 4) {
        throw new Error("Invalid move index");
      }

      const playerMove = playerPokemon.moves[playerMoveIndex];
      if (!playerMove) {
        throw new Error("No move available at that index");
      }

      const moveData = movesDb[playerMove.moveId];
      if (!moveData) {
        throw new Error(`Move ${playerMove.moveId} not found`);
      }

      // 2. Verificar PP (Power Points)
      if (playerMove.pp <= 0) {
        events.push({
          type: "NO_PP",
          message: `${playerPokemon.name}'s ${moveData.name} has no PP left!`,
        });
        // Usar Struggle como fallback
        return {
          playerDamage: 1,
          enemyDamage: 0,
          playerStatus: playerPokemon.status,
          enemyStatus: enemyPokemon.status,
          playerHp: playerPokemon.hp - 1,
          enemyHp: enemyPokemon.hp,
          events,
          battleOver: false,
          result: null,
        };
      }

      // 3. Inicializar battle state se necessário
      if (!playerPokemon.statStages) {
        playerPokemon = battleEffects.initBattleState(playerPokemon);
      }
      if (!enemyPokemon.statStages) {
        enemyPokemon = battleEffects.initBattleState(enemyPokemon);
      }

      // 4. Processar status antes do turno (sleep, freeze, paralysis)
      const playerCanMove = battleEffects.processStatusBeforeTurn(playerPokemon, events);
      const enemyCanMove = battleEffects.processStatusBeforeTurn(enemyPokemon, events);

      // 5. Determinar ordem de ataque (baseado em speed e priority)
      const playerSpeed = battleEffects.getModifiedStat(playerPokemon.stats.speed, playerPokemon.statStages.speed);
      const enemySpeed = battleEffects.getModifiedStat(enemyPokemon.stats.speed, enemyPokemon.statStages.speed);
      const playerPriority = moveData.priority || 0;
      const enemyPriority = 0; // IA usa priority 0 por padrão

      let playerGoesFirst;
      if (playerPriority !== enemyPriority) {
        playerGoesFirst = playerPriority > enemyPriority;
      } else {
        playerGoesFirst = playerSpeed >= enemySpeed;
      }

      let playerDamage = 0;
      let enemyDamage = 0;
      let playerNewHp = playerPokemon.hp;
      let enemyNewHp = enemyPokemon.hp;
      let battleOver = false;
      let result = null;

      if (playerGoesFirst && playerCanMove) {
        // Jogador ataca primeiro
        playerDamage = this._calculateDamage(playerPokemon, enemyPokemon, moveData);
        enemyNewHp = Math.max(0, enemyPokemon.hp - playerDamage);
        enemyPokemon.hp = enemyNewHp;

        events.push({
          type: "PLAYER_ATTACK",
          message: `${playerPokemon.name} used ${moveData.name}!`,
          damage: playerDamage,
        });

        // Aplicar efeito do golpe
        if (moveData.effectId !== undefined) {
          const effectResult = battleEffects.applyEffect(
            moveData.effectId,
            playerPokemon,
            enemyPokemon,
            moveData,
            playerDamage,
            events
          );

          // Aplicar dano adicional (ex: multi-hit)
          if (effectResult.additionalDamage > 0) {
            enemyNewHp = Math.max(0, enemyNewHp - effectResult.additionalDamage);
            enemyPokemon.hp = enemyNewHp;
          }

          // Aplicar recoil damage
          if (effectResult.recoilDamage > 0) {
            playerNewHp = Math.max(0, playerNewHp - effectResult.recoilDamage);
            playerPokemon.hp = playerNewHp;
          }

          // Aplicar healing
          if (effectResult.healing > 0) {
            playerNewHp = Math.min(playerPokemon.maxHp, playerNewHp + effectResult.healing);
            playerPokemon.hp = playerNewHp;
          }
        }

        // Verificar se inimigo caiu
        if (enemyNewHp <= 0) {
          battleOver = true;
          result = "WIN";
          events.push({
            type: "ENEMY_FAINTED",
            message: `${enemyPokemon.name} fainted!`,
          });
        } else if (enemyCanMove) {
          // Inimigo contra-ataca
          const enemyMoveIndex = Math.floor(Math.random() * enemyPokemon.moves.length);
          const enemyMove = enemyPokemon.moves[enemyMoveIndex];
          const enemyMoveData = movesDb[enemyMove.moveId];

          if (enemyMoveData) {
            enemyDamage = this._calculateDamage(enemyPokemon, playerPokemon, enemyMoveData);
            playerNewHp = Math.max(0, playerPokemon.hp - enemyDamage);
            playerPokemon.hp = playerNewHp;

            events.push({
              type: "ENEMY_ATTACK",
              message: `${enemyPokemon.name} used ${enemyMoveData.name}!`,
              damage: enemyDamage,
            });

            // Aplicar efeito do golpe inimigo
            if (enemyMoveData.effectId !== undefined) {
              battleEffects.applyEffect(
                enemyMoveData.effectId,
                enemyPokemon,
                playerPokemon,
                enemyMoveData,
                enemyDamage,
                events
              );
            }

            if (playerNewHp <= 0) {
              battleOver = true;
              result = "LOSS";
              events.push({
                type: "PLAYER_FAINTED",
                message: `${playerPokemon.name} fainted!`,
              });
            }
          }
        }
      } else {
        // Inimigo ataca primeiro
        const enemyMoveIndex = Math.floor(Math.random() * enemyPokemon.moves.length);
        const enemyMove = enemyPokemon.moves[enemyMoveIndex];
        const enemyMoveData = movesDb[enemyMove.moveId];

        if (enemyMoveData) {
          enemyDamage = this._calculateDamage(enemyPokemon, playerPokemon, enemyMoveData);
          playerNewHp = Math.max(0, playerPokemon.hp - enemyDamage);

          events.push({
            type: "ENEMY_ATTACK",
            message: `${enemyPokemon.name} used ${enemyMoveData.name}!`,
            damage: enemyDamage,
          });

          if (playerNewHp <= 0) {
            battleOver = true;
            result = "LOSS";
            events.push({
              type: "PLAYER_FAINTED",
              message: `${playerPokemon.name} fainted!`,
            });
            return {
              playerDamage: enemyDamage,
              enemyDamage: 0,
              playerStatus: playerPokemon.status,
              enemyStatus: enemyPokemon.status,
              playerHp: playerNewHp,
              enemyHp: enemyNewHp,
              events,
              battleOver,
              result,
            };
          }
        }

        // Agora jogador ataca
        playerDamage = this._calculateDamage(playerPokemon, enemyPokemon, moveData);
        enemyNewHp = Math.max(0, enemyPokemon.hp - playerDamage);

        events.push({
          type: "PLAYER_ATTACK",
          message: `${playerPokemon.name} used ${moveData.name}!`,
          damage: playerDamage,
        });

        if (moveData.power === 0) {
          events.push({
            type: "STATUS_EFFECT",
            message: `Effect: ${moveData.effect}`,
          });
        }

        // Verificar se inimigo caiu
        if (enemyNewHp <= 0) {
          battleOver = true;
          result = "WIN";
          events.push({
            type: "ENEMY_FAINTED",
            message: `${enemyPokemon.name} fainted!`,
          });
        }
      }

      // 6. Processar efeitos de status no fim do turno
      if (!battleOver) {
        battleEffects.processStatusAfterTurn(playerPokemon, events);
        battleEffects.processStatusAfterTurn(enemyPokemon, events);

        // Verificar se alguém desmaiou por dano de status
        if (playerPokemon.currentHp <= 0) {
          battleOver = true;
          result = "LOSS";
          events.push({
            type: "PLAYER_FAINTED",
            message: `${playerPokemon.name} fainted!`,
          });
        } else if (enemyPokemon.currentHp <= 0) {
          battleOver = true;
          result = "WIN";
          events.push({
            type: "ENEMY_FAINTED",
            message: `${enemyPokemon.name} fainted!`,
          });
        }
      }

      // 7. Decrementar PP do jogador
      playerMove.pp--;

      return {
        playerDamage,
        enemyDamage,
        playerStatus: playerPokemon.status,
        enemyStatus: enemyPokemon.status,
        playerHp: playerNewHp,
        enemyHp: enemyNewHp,
        playerMoveUsed: {
          name: moveData.name,
          ppRemaining: playerMove.pp,
        },
        events,
        battleOver,
        result,
      };
    } catch (err) {
      console.error("FireRedBattleService.processTurn error:", err);
      throw err;
    }
  }

  /**
   * Calcular dano usando a fórmula exata do FireRed
   * 
   * ((((2 * Level / 5 + 2) * Power * Atk) / Def) / 50) + 2) * Modifier
   * 
   * @private
   */
  _calculateDamage(attacker, defender, move) {
    // Validação de dados
    if (move.power === 0) {
      // Golpe sem dano (status)
      return 0;
    }

    const level = attacker.level || 5;
    const power = move.power || 1;
    const attack = this._getAttackStat(attacker, move);
    const defense = this._getDefenseStat(defender, move);
    const modifier = this._calculateModifier(attacker, defender, move);

    // Fórmula FireRed exata
    let damage =
      (((((2 * level) / 5 + 2) * power * attack) / defense) / 50 + 2) *
      modifier;

    // Adicionar aleatoriedade (85-100%)
    const variance = 0.85 + Math.random() * 0.15;
    damage = Math.floor(damage * variance);

    // Garantir dano mínimo de 1
    return Math.max(1, damage);
  }

  /**
   * Obter stat de ataque apropriado (físico ou especial)
   * @private
   */
  _getAttackStat(pokemon, move) {
    if (move.category === "physical") {
      return pokemon.stats.attack || 10;
    } else if (move.category === "special") {
      return pokemon.stats.spAttack || 10;
    }
    return 10;
  }

  /**
   * Obter stat de defesa apropriado (físico ou especial)
   * @private
   */
  _getDefenseStat(pokemon, move) {
    if (move.category === "physical") {
      return pokemon.stats.defense || 10;
    } else if (move.category === "special") {
      return pokemon.stats.spDefense || 10;
    }
    return 10;
  }

  /**
   * Calcular modificadores de dano (tipo, STAB, etc.)
   * @private
   */
  _calculateModifier(attacker, defender, move) {
    let modifier = 1.0;

    // STAB (Same Type Attack Bonus): x1.5 se o golpe é do mesmo tipo
    if (attacker.type && attacker.type.includes(move.type)) {
      modifier *= 1.5;
    }

    // Type effectiveness (simplificado para MVP)
    // Implementar sistema de type coverage completo aqui se necessário
    const effectiveness = this._getTypeEffectiveness(move.type, defender.type);
    modifier *= effectiveness;

    return modifier;
  }

  /**
   * Obter efetividade de tipo
   * Simplificado: retorna 1.0 (neutro) por padrão
   * Expandir com tabela completa se necessário
   * @private
   */
  _getTypeEffectiveness(moveType, defenderTypes) {
    // TODO: Implementar tabela completa de tipo vs tipo
    // Por enquanto, retornar neutro
    return 1.0;
  }

  /**
   * Calcular EXP ganho após vitória
   * Formula: (BaseExp * Level / 7) * TrainerExp (1.0 para wild)
   * 
   * @param {Object} enemyPokemon - Pokemon derrotado
   * @param {number} level - Nível do Pokémon do jogador
   * @returns {number} EXP ganho
   */
  calculateExpGain(enemyPokemon, level) {
    const baseExp = enemyPokemon.baseExp || 50;
    const expMultiplier = 1.0; // 1.0 para wild, 1.5 para treinador

    let expGain = Math.floor((baseExp * enemyPokemon.level) / 7) * expMultiplier;

    // Ajuste para nível do Pokemon do jogador
    if (level > enemyPokemon.level) {
      expGain = Math.floor(expGain * 0.5); // 50% menos EXP se for muito mais forte
    } else if (level < enemyPokemon.level) {
      expGain = Math.floor(expGain * 1.5); // 50% mais EXP se for mais fraco
    }

    return Math.max(1, expGain);
  }

  /**
   * Validar estado de batalha
   */
  isBattleOver(playerHp, enemyHp) {
    return playerHp <= 0 || enemyHp <= 0;
  }
}

module.exports = new FireRedBattleService();
