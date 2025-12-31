/**
 * Battle Routes
 * 
 * Rotas para batalhas contra NPCs
 */

const express = require('express');
const router = express.Router();
const trainerParties = require('../core/data/trainerParties');
const fireRedBattleService = require('../services/fireRedBattleService');

// Mapeamento simples de NPCs para trainers (temporário - depois virá do banco)
const NPC_TO_TRAINER = {
    'npc-ViridianCity-4': 'YoungsterBen',
    'npc-ViridianCity-5': 'BugCatcherRick',
    'npc-PalletTown-1': 'YoungsterCalvin',
    'npc-Route1-1': 'YoungsterJosh',
    'npc-Route1-2': 'BugCatcherSammy',
    'npc-Route2-1': 'LassJanice',
    'npc-Route3-1': 'BugCatcherDoug',
    // Adicione mais mapeamentos conforme necessário
};

/**
 * POST /api/battle/npc/:npcId
 * Iniciar batalha contra um NPC
 */
router.post('/api/battle/npc/:npcId', async (req, res) => {
    try {
        const { npcId } = req.params;

        console.log('🎮 Iniciando batalha contra NPC:', npcId);

        // Buscar trainer party do NPC
        const trainerKey = NPC_TO_TRAINER[npcId] || 'YoungsterBen'; // Fallback
        const trainerData = trainerParties[trainerKey];

        if (!trainerData) {
            return res.status(404).json({
                ok: false,
                error: 'Trainer not found'
            });
        }

        // Buscar Pokémon ativo do jogador (mock por enquanto)
        // TODO: Buscar do banco de dados real
        const playerPokemon = {
            id: 1,
            species: 1, // Bulbasaur
            name: 'Bulbasaur',
            level: 10,
            maxHp: 45,
            hp: 45,
            currentHp: 45,
            stats: {
                attack: 49,
                defense: 49,
                spAttack: 65,
                spDefense: 65,
                speed: 45
            },
            moves: [
                { moveId: 33, name: 'Tackle', pp: 35 },
                { moveId: 45, name: 'Growl', pp: 40 },
                { moveId: 71, name: 'Absorb', pp: 25 },
                { moveId: 77, name: 'Razor Leaf', pp: 25 }
            ]
        };

        // Pegar primeiro Pokémon do trainer
        const enemyPartyData = trainerData.party[0];
        const enemyPokemon = {
            id: enemyPartyData.species,
            species: enemyPartyData.species,
            name: getPokemonName(enemyPartyData.species),
            level: enemyPartyData.level,
            maxHp: calculateHP(enemyPartyData.species, enemyPartyData.level),
            hp: 0, // Será calculado
            currentHp: 0,
            stats: calculateStats(enemyPartyData.species, enemyPartyData.level),
            moves: getDefaultMoves(enemyPartyData.species)
        };

        enemyPokemon.hp = enemyPokemon.maxHp;
        enemyPokemon.currentHp = enemyPokemon.maxHp;

        // Criar estado inicial de batalha
        const battleState = {
            battleId: `battle-${Date.now()}`,
            npcId,
            trainerClass: trainerData.trainerClass,
            trainerName: trainerData.trainerName,
            playerPokemon,
            enemyPokemon,
            enemyParty: trainerData.party,
            currentEnemyIndex: 0,
            turn: 0,
            started: new Date().toISOString()
        };

        console.log('✅ Batalha criada:', {
            trainer: trainerData.trainerName,
            class: trainerData.trainerClass,
            pokemon: enemyPokemon.name,
            level: enemyPokemon.level
        });

        res.json({
            ok: true,
            battleState
        });

    } catch (err) {
        console.error('❌ Erro ao iniciar batalha:', err);
        res.status(500).json({
            ok: false,
            error: err.message
        });
    }
});

/**
 * POST /api/battle/turn
 * Executar um turno de batalha
 */
router.post('/api/battle/turn', async (req, res) => {
    try {
        const { battleState, moveIndex } = req.body;

        if (!battleState || moveIndex === undefined) {
            return res.status(400).json({
                ok: false,
                error: 'Missing battleState or moveIndex'
            });
        }

        console.log('⚔️ Processando turno:', {
            turn: battleState.turn + 1,
            move: battleState.playerPokemon.moves[moveIndex]?.name
        });

        // Processar turno usando fireRedBattleService (singleton)
        const result = await fireRedBattleService.processTurn(
            battleState.playerPokemon,
            battleState.enemyPokemon,
            moveIndex
        );

        // Atualizar estado
        battleState.playerPokemon.hp = result.playerHp;
        battleState.playerPokemon.currentHp = result.playerHp;
        battleState.enemyPokemon.hp = result.enemyHp;
        battleState.enemyPokemon.currentHp = result.enemyHp;
        battleState.turn++;

        // Verificar vitória/derrota
        let battleOver = result.battleOver;
        let battleResult = result.result;

        if (battleOver) {
            console.log('🏁 Batalha finalizada:', battleResult);

            if (battleResult === 'WIN') {
                // TODO: Aplicar recompensas
                const reward = {
                    xp: battleState.enemyPokemon.level * 20,
                    money: battleState.enemyPokemon.level * 10
                };

                console.log('💰 Recompensas:', reward);
            }
        }

        res.json({
            ok: true,
            result,
            battleState,
            battleOver,
            battleResult
        });

    } catch (err) {
        console.error('❌ Erro ao processar turno:', err);
        res.status(500).json({
            ok: false,
            error: err.message
        });
    }
});

// ========== HELPER FUNCTIONS ==========

function getPokemonName(speciesId) {
    const names = {
        1: 'Bulbasaur', 4: 'Charmander', 7: 'Squirtle', 10: 'Caterpie',
        13: 'Weedle', 16: 'Pidgey', 19: 'Rattata', 21: 'Spearow',
        23: 'Ekans', 25: 'Pikachu', 27: 'Sandshrew', 29: 'Nidoran♀',
        39: 'Jigglypuff', 41: 'Zubat', 43: 'Oddish', 54: 'Psyduck',
        58: 'Growlithe', 66: 'Machop', 69: 'Bellsprout', 72: 'Tentacool',
        74: 'Geodude', 77: 'Ponyta', 90: 'Shellder', 92: 'Gastly',
        95: 'Onix', 96: 'Drowzee', 98: 'Krabby', 100: 'Voltorb',
        109: 'Koffing', 111: 'Rhyhorn', 116: 'Horsea', 120: 'Staryu',
        129: 'Magikarp'
    };
    return names[speciesId] || `Pokemon #${speciesId}`;
}

function calculateHP(speciesId, level) {
    // Fórmula simplificada de HP
    const baseHP = 45; // Valor padrão
    return Math.floor(((2 * baseHP + 31) * level) / 100) + level + 10;
}

function calculateStats(speciesId, level) {
    // Stats base simplificados (usar valores reais depois)
    const baseStats = {
        attack: 50,
        defense: 50,
        spAttack: 50,
        spDefense: 50,
        speed: 50
    };

    return {
        attack: Math.floor(((2 * baseStats.attack + 31) * level) / 100) + 5,
        defense: Math.floor(((2 * baseStats.defense + 31) * level) / 100) + 5,
        spAttack: Math.floor(((2 * baseStats.spAttack + 31) * level) / 100) + 5,
        spDefense: Math.floor(((2 * baseStats.spDefense + 31) * level) / 100) + 5,
        speed: Math.floor(((2 * baseStats.speed + 31) * level) / 100) + 5
    };
}

function getDefaultMoves(speciesId) {
    // Movimentos padrão simples (melhorar depois)
    return [
        { moveId: 33, name: 'Tackle', pp: 35 },
        { moveId: 45, name: 'Growl', pp: 40 }
    ];
}

module.exports = router;
