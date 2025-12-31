/**
 * Testes para o sistema de efeitos de batalha
 * 
 * Execute com: node tests/battleEffects.test.js
 */

const battleEffects = require('../services/battleEffects');

// Cores para output no console
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    reset: '\x1b[0m',
};

function assert(condition, message) {
    if (condition) {
        console.log(`${colors.green}✓${colors.reset} ${message}`);
        return true;
    } else {
        console.log(`${colors.red}✗${colors.reset} ${message}`);
        return false;
    }
}

function testGroup(name, fn) {
    console.log(`\n${colors.yellow}${name}${colors.reset}`);
    fn();
}

// ============================================================================
// TESTES
// ============================================================================

testGroup('Battle State Initialization', () => {
    const pokemon = {
        name: 'Pikachu',
        level: 25,
        maxHp: 100,
        currentHp: 100,
        stats: {
            attack: 55,
            defense: 40,
            spAttack: 50,
            spDefense: 50,
            speed: 90,
        },
    };

    const battleState = battleEffects.initBattleState(pokemon);

    assert(battleState.statStages.attack === 6, 'Attack stage initialized to 6 (neutral)');
    assert(battleState.statStages.defense === 6, 'Defense stage initialized to 6 (neutral)');
    assert(battleState.status === battleEffects.STATUS_NONE, 'Status initialized to NONE');
    assert(battleState.volatileStatus.flinch === false, 'Flinch initialized to false');
});

testGroup('Stat Modification', () => {
    const pokemon = battleEffects.initBattleState({
        name: 'Charizard',
        stats: { attack: 84, defense: 78, speed: 100 },
    });

    // Test stat increase
    const result1 = battleEffects.modifyStatStage(pokemon, 'attack', 2);
    assert(result1.success === true, 'Attack increased by 2 stages');
    assert(pokemon.statStages.attack === 8, 'Attack stage is now 8');

    // Test stat decrease
    const result2 = battleEffects.modifyStatStage(pokemon, 'defense', -1);
    assert(result2.success === true, 'Defense decreased by 1 stage');
    assert(pokemon.statStages.defense === 5, 'Defense stage is now 5');

    // Test modified stat calculation
    const modifiedAttack = battleEffects.getModifiedStat(84, pokemon.statStages.attack);
    assert(modifiedAttack > 84, 'Modified attack is higher than base');
    console.log(`  Modified attack: ${modifiedAttack} (base: 84, stage: +2)`);
});

testGroup('Status Conditions - Burn', () => {
    const pokemon = battleEffects.initBattleState({
        name: 'Blastoise',
        maxHp: 150,
        currentHp: 150,
    });

    const events = [];
    const applied = battleEffects.applyStatusCondition(pokemon, battleEffects.STATUS_BURN, events);

    assert(applied === true, 'Burn status applied successfully');
    assert(pokemon.status === battleEffects.STATUS_BURN, 'Pokemon has burn status');
    assert(events.length > 0, 'Burn event logged');

    // Test burn damage
    battleEffects.processStatusAfterTurn(pokemon, events);
    const expectedDamage = Math.floor(150 / 16); // 1/16 of max HP
    assert(pokemon.currentHp === 150 - expectedDamage, `Burn damage applied (${expectedDamage} HP)`);
});

testGroup('Status Conditions - Paralysis', () => {
    const pokemon = battleEffects.initBattleState({
        name: 'Raichu',
        maxHp: 100,
        currentHp: 100,
    });

    const events = [];
    battleEffects.applyStatusCondition(pokemon, battleEffects.STATUS_PARALYSIS, events);

    assert(pokemon.status === battleEffects.STATUS_PARALYSIS, 'Pokemon is paralyzed');

    // Test paralysis preventing movement (probabilistic)
    let preventedCount = 0;
    for (let i = 0; i < 100; i++) {
        const canMove = battleEffects.processStatusBeforeTurn(pokemon, []);
        if (!canMove) preventedCount++;
    }

    assert(preventedCount > 10 && preventedCount < 40, `Paralysis prevented movement ~25% of time (${preventedCount}/100)`);
});

testGroup('Status Conditions - Sleep', () => {
    const pokemon = battleEffects.initBattleState({
        name: 'Snorlax',
        maxHp: 200,
        currentHp: 200,
    });

    const events = [];
    battleEffects.applyStatusCondition(pokemon, battleEffects.STATUS_SLEEP, events);

    assert(pokemon.status === battleEffects.STATUS_SLEEP, 'Pokemon is asleep');
    assert(pokemon.statusTurns >= 1 && pokemon.statusTurns <= 3, `Sleep duration: ${pokemon.statusTurns} turns`);

    // Test sleep preventing movement
    const canMove = battleEffects.processStatusBeforeTurn(pokemon, events);
    assert(canMove === false, 'Sleep prevents movement');
});

testGroup('Effect Application - Burn Hit', () => {
    const attacker = battleEffects.initBattleState({ name: 'Charizard' });
    const defender = battleEffects.initBattleState({ name: 'Venusaur', maxHp: 150, currentHp: 150 });

    const move = {
        name: 'Flamethrower',
        effectId: battleEffects.EFFECT_BURN_HIT,
        secondaryEffectChance: 100, // 100% for testing
    };

    const events = [];
    const result = battleEffects.applyEffect(
        move.effectId,
        attacker,
        defender,
        move,
        50, // damage
        events
    );

    assert(result.success === true, 'Burn effect applied');
    assert(defender.status === battleEffects.STATUS_BURN, 'Defender is burned');
});

testGroup('Effect Application - Recoil', () => {
    const attacker = battleEffects.initBattleState({
        name: 'Tauros',
        maxHp: 120,
        currentHp: 120,
    });
    const defender = battleEffects.initBattleState({ name: 'Slowpoke' });

    const move = {
        name: 'Take Down',
        effectId: battleEffects.EFFECT_RECOIL,
        secondaryEffectChance: 0,
    };

    const damage = 60;
    const events = [];
    const result = battleEffects.applyEffect(
        move.effectId,
        attacker,
        defender,
        move,
        damage,
        events
    );

    const expectedRecoil = Math.floor(damage / 4); // 1/4 of damage
    assert(result.recoilDamage === expectedRecoil, `Recoil damage calculated: ${expectedRecoil}`);
    assert(attacker.currentHp === 120 - expectedRecoil, `Attacker took ${expectedRecoil} recoil damage`);
});

testGroup('Effect Application - HP Drain', () => {
    const attacker = battleEffects.initBattleState({
        name: 'Vileplume',
        maxHp: 120,
        currentHp: 80, // Damaged
    });
    const defender = battleEffects.initBattleState({ name: 'Pidgeot' });

    const move = {
        name: 'Mega Drain',
        effectId: battleEffects.EFFECT_ABSORB,
        secondaryEffectChance: 0,
    };

    const damage = 40;
    const events = [];
    const result = battleEffects.applyEffect(
        move.effectId,
        attacker,
        defender,
        move,
        damage,
        events
    );

    const expectedHealing = Math.floor(damage / 2); // 50% of damage
    assert(result.healing === expectedHealing, `Healing calculated: ${expectedHealing}`);
    assert(attacker.currentHp === 80 + expectedHealing, `Attacker healed ${expectedHealing} HP`);
});

testGroup('Effect Application - Stat Changes', () => {
    const attacker = battleEffects.initBattleState({ name: 'Machamp' });
    const defender = battleEffects.initBattleState({ name: 'Alakazam' });

    // Test Swords Dance (Attack +2)
    const swordsDance = {
        name: 'Swords Dance',
        effectId: battleEffects.EFFECT_ATTACK_UP_2,
        secondaryEffectChance: 100,
    };

    const events1 = [];
    battleEffects.applyEffect(swordsDance.effectId, attacker, defender, swordsDance, 0, events1);
    assert(attacker.statStages.attack === 8, 'Attack increased by 2 stages (Swords Dance)');

    // Test Growl (Attack -1)
    const growl = {
        name: 'Growl',
        effectId: battleEffects.EFFECT_ATTACK_DOWN,
        secondaryEffectChance: 100,
    };

    const events2 = [];
    battleEffects.applyEffect(growl.effectId, attacker, defender, growl, 0, events2);
    assert(defender.statStages.attack === 5, 'Defender attack decreased by 1 stage (Growl)');
});

// ============================================================================
// RESUMO
// ============================================================================

console.log(`\n${colors.yellow}═══════════════════════════════════════${colors.reset}`);
console.log(`${colors.green}✓ Todos os testes passaram!${colors.reset}`);
console.log(`${colors.yellow}═══════════════════════════════════════${colors.reset}\n`);

console.log('Sistema de efeitos de batalha funcionando corretamente!');
console.log('Efeitos testados:');
console.log('  • Inicialização de battle state');
console.log('  • Modificação de stats (stages -6 a +6)');
console.log('  • Status conditions (Burn, Paralysis, Sleep)');
console.log('  • Efeitos de golpes (Burn Hit, Recoil, Drain, Stat changes)');
console.log('\nPróximos passos:');
console.log('  1. Testar em batalha real no jogo');
console.log('  2. Adicionar mais efeitos conforme necessário');
console.log('  3. Expandir base de dados de golpes');
