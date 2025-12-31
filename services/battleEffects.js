/**
 * Battle Effects System
 * 
 * Implementa os efeitos de batalha do pokefirered-master
 * Baseado em: pokefirered-master/include/constants/battle_move_effects.h
 */

// ============================================================================
// EFFECT CONSTANTS (baseado no pokefirered-master)
// ============================================================================

const EFFECT_HIT = 0;
const EFFECT_SLEEP = 1;
const EFFECT_POISON_HIT = 2;
const EFFECT_ABSORB = 3;
const EFFECT_BURN_HIT = 4;
const EFFECT_FREEZE_HIT = 5;
const EFFECT_PARALYZE_HIT = 6;
const EFFECT_EXPLOSION = 7;
const EFFECT_DREAM_EATER = 8;
const EFFECT_MIRROR_MOVE = 9;
const EFFECT_ATTACK_UP = 10;
const EFFECT_DEFENSE_UP = 11;
const EFFECT_SPEED_UP = 12;
const EFFECT_SPECIAL_ATTACK_UP = 13;
const EFFECT_SPECIAL_DEFENSE_UP = 14;
const EFFECT_ACCURACY_UP = 15;
const EFFECT_EVASION_UP = 16;
const EFFECT_ALWAYS_HIT = 17;
const EFFECT_ATTACK_DOWN = 18;
const EFFECT_DEFENSE_DOWN = 19;
const EFFECT_SPEED_DOWN = 20;
const EFFECT_SPECIAL_ATTACK_DOWN = 21;
const EFFECT_SPECIAL_DEFENSE_DOWN = 22;
const EFFECT_ACCURACY_DOWN = 23;
const EFFECT_EVASION_DOWN = 24;
const EFFECT_HAZE = 25;
const EFFECT_BIDE = 26;
const EFFECT_RAMPAGE = 27;
const EFFECT_ROAR = 28;
const EFFECT_MULTI_HIT = 29;
const EFFECT_CONVERSION = 30;
const EFFECT_FLINCH_HIT = 31;
const EFFECT_RESTORE_HP = 32;
const EFFECT_TOXIC = 33;
const EFFECT_PAY_DAY = 34;
const EFFECT_LIGHT_SCREEN = 35;
const EFFECT_TRI_ATTACK = 36;
const EFFECT_REST = 37;
const EFFECT_OHKO = 38;
const EFFECT_RAZOR_WIND = 39;
const EFFECT_SUPER_FANG = 40;
const EFFECT_DRAGON_RAGE = 41;
const EFFECT_TRAP = 42;
const EFFECT_HIGH_CRITICAL = 43;
const EFFECT_DOUBLE_HIT = 44;
const EFFECT_RECOIL_IF_MISS = 45;
const EFFECT_MIST = 46;
const EFFECT_FOCUS_ENERGY = 47;
const EFFECT_RECOIL = 48;
const EFFECT_CONFUSE = 49;
const EFFECT_ATTACK_UP_2 = 50;
const EFFECT_DEFENSE_UP_2 = 51;
const EFFECT_SPEED_UP_2 = 52;
const EFFECT_SPECIAL_ATTACK_UP_2 = 53;
const EFFECT_SPECIAL_DEFENSE_UP_2 = 54;
const EFFECT_ACCURACY_UP_2 = 55;
const EFFECT_EVASION_UP_2 = 56;
const EFFECT_TRANSFORM = 57;
const EFFECT_ATTACK_DOWN_2 = 58;
const EFFECT_DEFENSE_DOWN_2 = 59;
const EFFECT_SPEED_DOWN_2 = 60;
const EFFECT_SPECIAL_ATTACK_DOWN_2 = 61;
const EFFECT_SPECIAL_DEFENSE_DOWN_2 = 62;
const EFFECT_ACCURACY_DOWN_2 = 63;
const EFFECT_EVASION_DOWN_2 = 64;
const EFFECT_REFLECT = 65;
const EFFECT_POISON = 66;
const EFFECT_PARALYZE = 67;
const EFFECT_ATTACK_DOWN_HIT = 68;
const EFFECT_DEFENSE_DOWN_HIT = 69;
const EFFECT_SPEED_DOWN_HIT = 70;
const EFFECT_SPECIAL_ATTACK_DOWN_HIT = 71;
const EFFECT_SPECIAL_DEFENSE_DOWN_HIT = 72;
const EFFECT_ACCURACY_DOWN_HIT = 73;
const EFFECT_EVASION_DOWN_HIT = 74;

// ============================================================================
// STATUS CONDITIONS
// ============================================================================

const STATUS_NONE = 0;
const STATUS_BURN = 1;
const STATUS_FREEZE = 2;
const STATUS_PARALYSIS = 3;
const STATUS_POISON = 4;
const STATUS_SLEEP = 5;
const STATUS_TOXIC = 6; // Badly poisoned
const STATUS_CONFUSION = 7;

// ============================================================================
// STAT STAGE MULTIPLIERS
// ============================================================================

// Stages vão de -6 a +6, índice 0 = stage -6, índice 12 = stage +6
const STAT_STAGE_MULTIPLIERS = [
    2 / 8,  // -6
    2 / 7,  // -5
    2 / 6,  // -4
    2 / 5,  // -3
    2 / 4,  // -2
    2 / 3,  // -1
    2 / 2,  // 0 (normal)
    3 / 2,  // +1
    4 / 2,  // +2
    5 / 2,  // +3
    6 / 2,  // +4
    7 / 2,  // +5
    8 / 2,  // +6
];

// ============================================================================
// BATTLE STATE HELPERS
// ============================================================================

/**
 * Inicializar estado de batalha para um Pokémon
 */
function initBattleState(pokemon) {
    return {
        ...pokemon,
        status: pokemon.status || STATUS_NONE,
        statusTurns: 0, // Contador de turnos para sleep, confusion, etc.
        statStages: {
            attack: 6,      // Stage 0 (normal) = índice 6
            defense: 6,
            spAttack: 6,
            spDefense: 6,
            speed: 6,
            accuracy: 6,
            evasion: 6,
        },
        volatileStatus: {
            flinch: false,
            confusion: false,
            confusionTurns: 0,
            leechSeed: false,
            trapped: false,
        },
    };
}

/**
 * Obter stat modificado por stages
 */
function getModifiedStat(baseStat, stage) {
    const clampedStage = Math.max(0, Math.min(12, stage));
    return Math.floor(baseStat * STAT_STAGE_MULTIPLIERS[clampedStage]);
}

/**
 * Modificar stage de uma stat
 */
function modifyStatStage(battleState, stat, change) {
    const currentStage = battleState.statStages[stat];
    const newStage = Math.max(0, Math.min(12, currentStage + change));
    const actualChange = newStage - currentStage;

    battleState.statStages[stat] = newStage;

    return {
        success: actualChange !== 0,
        change: actualChange,
        atMax: newStage === 12,
        atMin: newStage === 0,
    };
}

// ============================================================================
// STATUS CONDITION HANDLERS
// ============================================================================

/**
 * Aplicar condição de status
 */
function applyStatusCondition(defender, status, events = []) {
    // Pokémon já tem status? (não pode ter múltiplos status principais)
    if (defender.status !== STATUS_NONE && defender.status !== STATUS_CONFUSION) {
        events.push({
            type: 'STATUS_FAILED',
            message: `${defender.name || 'Defender'} already has a status condition!`,
        });
        return false;
    }

    defender.status = status;

    switch (status) {
        case STATUS_BURN:
            events.push({
                type: 'STATUS_APPLIED',
                status: 'burn',
                message: `${defender.name || 'Defender'} was burned!`,
            });
            break;

        case STATUS_FREEZE:
            events.push({
                type: 'STATUS_APPLIED',
                status: 'freeze',
                message: `${defender.name || 'Defender'} was frozen solid!`,
            });
            break;

        case STATUS_PARALYSIS:
            events.push({
                type: 'STATUS_APPLIED',
                status: 'paralysis',
                message: `${defender.name || 'Defender'} is paralyzed! It may be unable to move!`,
            });
            break;

        case STATUS_POISON:
            events.push({
                type: 'STATUS_APPLIED',
                status: 'poison',
                message: `${defender.name || 'Defender'} was poisoned!`,
            });
            break;

        case STATUS_SLEEP:
            defender.statusTurns = 1 + Math.floor(Math.random() * 3); // 1-3 turnos
            events.push({
                type: 'STATUS_APPLIED',
                status: 'sleep',
                message: `${defender.name || 'Defender'} fell asleep!`,
            });
            break;

        case STATUS_TOXIC:
            defender.statusTurns = 1; // Contador de dano tóxico
            events.push({
                type: 'STATUS_APPLIED',
                status: 'toxic',
                message: `${defender.name || 'Defender'} was badly poisoned!`,
            });
            break;
    }

    return true;
}

/**
 * Processar efeitos de status no início do turno
 */
function processStatusBeforeTurn(pokemon, events = []) {
    let canMove = true;

    switch (pokemon.status) {
        case STATUS_SLEEP:
            if (pokemon.statusTurns > 0) {
                pokemon.statusTurns--;
                events.push({
                    type: 'STATUS_EFFECT',
                    message: `${pokemon.name || 'Pokemon'} is fast asleep!`,
                });
                canMove = false;

                if (pokemon.statusTurns === 0) {
                    pokemon.status = STATUS_NONE;
                    events.push({
                        type: 'STATUS_CURED',
                        message: `${pokemon.name || 'Pokemon'} woke up!`,
                    });
                }
            }
            break;

        case STATUS_FREEZE:
            // 20% chance de descongelar
            if (Math.random() < 0.2) {
                pokemon.status = STATUS_NONE;
                events.push({
                    type: 'STATUS_CURED',
                    message: `${pokemon.name || 'Pokemon'} thawed out!`,
                });
            } else {
                events.push({
                    type: 'STATUS_EFFECT',
                    message: `${pokemon.name || 'Pokemon'} is frozen solid!`,
                });
                canMove = false;
            }
            break;

        case STATUS_PARALYSIS:
            // 25% chance de não conseguir atacar
            if (Math.random() < 0.25) {
                events.push({
                    type: 'STATUS_EFFECT',
                    message: `${pokemon.name || 'Pokemon'} is paralyzed! It can't move!`,
                });
                canMove = false;
            }
            break;
    }

    // Confusion (volatile status)
    if (pokemon.volatileStatus.confusion) {
        if (pokemon.volatileStatus.confusionTurns > 0) {
            pokemon.volatileStatus.confusionTurns--;

            // 50% chance de se machucar
            if (Math.random() < 0.5) {
                const confusionDamage = Math.floor(pokemon.maxHp * 0.125); // ~12.5% do HP
                pokemon.currentHp = Math.max(0, pokemon.currentHp - confusionDamage);
                events.push({
                    type: 'CONFUSION_DAMAGE',
                    damage: confusionDamage,
                    message: `${pokemon.name || 'Pokemon'} hurt itself in confusion!`,
                });
                canMove = false;
            }

            if (pokemon.volatileStatus.confusionTurns === 0) {
                pokemon.volatileStatus.confusion = false;
                events.push({
                    type: 'STATUS_CURED',
                    message: `${pokemon.name || 'Pokemon'} snapped out of confusion!`,
                });
            }
        }
    }

    return canMove;
}

/**
 * Processar efeitos de status no fim do turno
 */
function processStatusAfterTurn(pokemon, events = []) {
    switch (pokemon.status) {
        case STATUS_BURN:
            const burnDamage = Math.floor(pokemon.maxHp / 16); // 1/16 do HP máximo
            pokemon.currentHp = Math.max(0, pokemon.currentHp - burnDamage);
            events.push({
                type: 'STATUS_DAMAGE',
                status: 'burn',
                damage: burnDamage,
                message: `${pokemon.name || 'Pokemon'} was hurt by its burn!`,
            });
            break;

        case STATUS_POISON:
            const poisonDamage = Math.floor(pokemon.maxHp / 8); // 1/8 do HP máximo
            pokemon.currentHp = Math.max(0, pokemon.currentHp - poisonDamage);
            events.push({
                type: 'STATUS_DAMAGE',
                status: 'poison',
                damage: poisonDamage,
                message: `${pokemon.name || 'Pokemon'} was hurt by poison!`,
            });
            break;

        case STATUS_TOXIC:
            // Dano aumenta a cada turno: (1/16) * N
            const toxicDamage = Math.floor((pokemon.maxHp / 16) * pokemon.statusTurns);
            pokemon.currentHp = Math.max(0, pokemon.currentHp - toxicDamage);
            pokemon.statusTurns++;
            events.push({
                type: 'STATUS_DAMAGE',
                status: 'toxic',
                damage: toxicDamage,
                message: `${pokemon.name || 'Pokemon'} was hurt by poison!`,
            });
            break;
    }

    // Leech Seed
    if (pokemon.volatileStatus.leechSeed && pokemon.leechSeedTarget) {
        const leechDamage = Math.floor(pokemon.maxHp / 8);
        pokemon.currentHp = Math.max(0, pokemon.currentHp - leechDamage);
        pokemon.leechSeedTarget.currentHp = Math.min(
            pokemon.leechSeedTarget.maxHp,
            pokemon.leechSeedTarget.currentHp + leechDamage
        );
        events.push({
            type: 'LEECH_SEED_DAMAGE',
            damage: leechDamage,
            message: `${pokemon.name || 'Pokemon'}'s health is sapped by Leech Seed!`,
        });
    }
}

// ============================================================================
// EFFECT HANDLERS
// ============================================================================

/**
 * Aplicar efeito de batalha
 * 
 * @param {number} effectId - ID do efeito
 * @param {Object} attacker - Pokémon atacante
 * @param {Object} defender - Pokémon defensor
 * @param {Object} move - Dados do golpe
 * @param {number} damage - Dano causado
 * @param {Array} events - Array de eventos para log
 * @returns {Object} Resultado do efeito
 */
function applyEffect(effectId, attacker, defender, move, damage, events = []) {
    const result = {
        success: false,
        additionalDamage: 0,
        recoilDamage: 0,
        healing: 0,
    };

    // Verificar chance de efeito secundário
    const secondaryChance = move.secondaryEffectChance || 0;
    if (secondaryChance > 0 && Math.random() * 100 > secondaryChance) {
        return result; // Efeito secundário falhou
    }

    switch (effectId) {
        // ========== HIT EFFECTS ==========
        case EFFECT_HIT:
            // Golpe normal, sem efeito adicional
            result.success = true;
            break;

        // ========== STATUS HIT EFFECTS ==========
        case EFFECT_BURN_HIT:
            result.success = applyStatusCondition(defender, STATUS_BURN, events);
            break;

        case EFFECT_FREEZE_HIT:
            result.success = applyStatusCondition(defender, STATUS_FREEZE, events);
            break;

        case EFFECT_PARALYZE_HIT:
            result.success = applyStatusCondition(defender, STATUS_PARALYSIS, events);
            break;

        case EFFECT_POISON_HIT:
            result.success = applyStatusCondition(defender, STATUS_POISON, events);
            break;

        case EFFECT_SLEEP:
            result.success = applyStatusCondition(defender, STATUS_SLEEP, events);
            break;

        case EFFECT_POISON:
            result.success = applyStatusCondition(defender, STATUS_POISON, events);
            break;

        case EFFECT_PARALYZE:
            result.success = applyStatusCondition(defender, STATUS_PARALYSIS, events);
            break;

        case EFFECT_TOXIC:
            result.success = applyStatusCondition(defender, STATUS_TOXIC, events);
            break;

        case EFFECT_CONFUSE:
            defender.volatileStatus.confusion = true;
            defender.volatileStatus.confusionTurns = 1 + Math.floor(Math.random() * 4); // 1-4 turnos
            events.push({
                type: 'CONFUSION_APPLIED',
                message: `${defender.name || 'Defender'} became confused!`,
            });
            result.success = true;
            break;

        // ========== STAT MODIFICATION EFFECTS ==========
        case EFFECT_ATTACK_UP:
            result.success = modifyStatStage(attacker, 'attack', 1).success;
            if (result.success) {
                events.push({
                    type: 'STAT_CHANGE',
                    stat: 'attack',
                    change: 1,
                    message: `${attacker.name || 'Attacker'}'s Attack rose!`,
                });
            }
            break;

        case EFFECT_ATTACK_UP_2:
            result.success = modifyStatStage(attacker, 'attack', 2).success;
            if (result.success) {
                events.push({
                    type: 'STAT_CHANGE',
                    stat: 'attack',
                    change: 2,
                    message: `${attacker.name || 'Attacker'}'s Attack sharply rose!`,
                });
            }
            break;

        case EFFECT_DEFENSE_UP:
            result.success = modifyStatStage(attacker, 'defense', 1).success;
            if (result.success) {
                events.push({
                    type: 'STAT_CHANGE',
                    stat: 'defense',
                    change: 1,
                    message: `${attacker.name || 'Attacker'}'s Defense rose!`,
                });
            }
            break;

        case EFFECT_DEFENSE_UP_2:
            result.success = modifyStatStage(attacker, 'defense', 2).success;
            if (result.success) {
                events.push({
                    type: 'STAT_CHANGE',
                    stat: 'defense',
                    change: 2,
                    message: `${attacker.name || 'Attacker'}'s Defense sharply rose!`,
                });
            }
            break;

        case EFFECT_SPEED_UP:
            result.success = modifyStatStage(attacker, 'speed', 1).success;
            if (result.success) {
                events.push({
                    type: 'STAT_CHANGE',
                    stat: 'speed',
                    change: 1,
                    message: `${attacker.name || 'Attacker'}'s Speed rose!`,
                });
            }
            break;

        case EFFECT_SPEED_UP_2:
            result.success = modifyStatStage(attacker, 'speed', 2).success;
            if (result.success) {
                events.push({
                    type: 'STAT_CHANGE',
                    stat: 'speed',
                    change: 2,
                    message: `${attacker.name || 'Attacker'}'s Speed sharply rose!`,
                });
            }
            break;

        case EFFECT_ATTACK_DOWN:
            result.success = modifyStatStage(defender, 'attack', -1).success;
            if (result.success) {
                events.push({
                    type: 'STAT_CHANGE',
                    stat: 'attack',
                    change: -1,
                    message: `${defender.name || 'Defender'}'s Attack fell!`,
                });
            }
            break;

        case EFFECT_DEFENSE_DOWN:
            result.success = modifyStatStage(defender, 'defense', -1).success;
            if (result.success) {
                events.push({
                    type: 'STAT_CHANGE',
                    stat: 'defense',
                    change: -1,
                    message: `${defender.name || 'Defender'}'s Defense fell!`,
                });
            }
            break;

        case EFFECT_SPEED_DOWN:
            result.success = modifyStatStage(defender, 'speed', -1).success;
            if (result.success) {
                events.push({
                    type: 'STAT_CHANGE',
                    stat: 'speed',
                    change: -1,
                    message: `${defender.name || 'Defender'}'s Speed fell!`,
                });
            }
            break;

        // ========== SPECIAL EFFECTS ==========
        case EFFECT_RECOIL:
            // Recoil de 1/4 do dano causado
            result.recoilDamage = Math.floor(damage / 4);
            attacker.currentHp = Math.max(0, attacker.currentHp - result.recoilDamage);
            events.push({
                type: 'RECOIL_DAMAGE',
                damage: result.recoilDamage,
                message: `${attacker.name || 'Attacker'} was hurt by recoil!`,
            });
            result.success = true;
            break;

        case EFFECT_ABSORB:
            // Drena 50% do dano causado
            result.healing = Math.floor(damage / 2);
            attacker.currentHp = Math.min(attacker.maxHp, attacker.currentHp + result.healing);
            events.push({
                type: 'HP_DRAIN',
                healing: result.healing,
                message: `${attacker.name || 'Attacker'} drained HP from ${defender.name || 'Defender'}!`,
            });
            result.success = true;
            break;

        case EFFECT_FLINCH_HIT:
            defender.volatileStatus.flinch = true;
            events.push({
                type: 'FLINCH',
                message: `${defender.name || 'Defender'} flinched!`,
            });
            result.success = true;
            break;

        case EFFECT_RESTORE_HP:
            // Restaura 50% do HP máximo
            result.healing = Math.floor(attacker.maxHp / 2);
            attacker.currentHp = Math.min(attacker.maxHp, attacker.currentHp + result.healing);
            events.push({
                type: 'HP_RESTORE',
                healing: result.healing,
                message: `${attacker.name || 'Attacker'} restored HP!`,
            });
            result.success = true;
            break;

        case EFFECT_DRAGON_RAGE:
            // Dano fixo de 40
            result.additionalDamage = 40 - damage; // Ajustar para dano total de 40
            events.push({
                type: 'FIXED_DAMAGE',
                damage: 40,
                message: `${defender.name || 'Defender'} took 40 damage!`,
            });
            result.success = true;
            break;

        default:
            // Efeito não implementado ainda
            console.warn(`Effect ${effectId} not implemented yet`);
            result.success = false;
    }

    return result;
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    // Constants
    EFFECT_HIT,
    EFFECT_SLEEP,
    EFFECT_POISON_HIT,
    EFFECT_ABSORB,
    EFFECT_BURN_HIT,
    EFFECT_FREEZE_HIT,
    EFFECT_PARALYZE_HIT,
    EFFECT_ATTACK_UP,
    EFFECT_DEFENSE_UP,
    EFFECT_SPEED_UP,
    EFFECT_ATTACK_DOWN,
    EFFECT_DEFENSE_DOWN,
    EFFECT_SPEED_DOWN,
    EFFECT_ATTACK_UP_2,
    EFFECT_DEFENSE_UP_2,
    EFFECT_SPEED_UP_2,
    EFFECT_MULTI_HIT,
    EFFECT_FLINCH_HIT,
    EFFECT_RECOIL,
    EFFECT_CONFUSE,
    EFFECT_POISON,
    EFFECT_PARALYZE,
    EFFECT_TOXIC,
    EFFECT_RESTORE_HP,
    EFFECT_DRAGON_RAGE,
    EFFECT_HIGH_CRITICAL,
    EFFECT_DOUBLE_HIT,

    // Status
    STATUS_NONE,
    STATUS_BURN,
    STATUS_FREEZE,
    STATUS_PARALYSIS,
    STATUS_POISON,
    STATUS_SLEEP,
    STATUS_TOXIC,
    STATUS_CONFUSION,

    // Functions
    initBattleState,
    getModifiedStat,
    modifyStatStage,
    applyStatusCondition,
    processStatusBeforeTurn,
    processStatusAfterTurn,
    applyEffect,
};
