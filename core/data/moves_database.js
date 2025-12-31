/**
 * Base de dados de golpes (Moves) do pokefirered-master
 * Todos os golpes com power, accuracy, PP e efeitos
 * 
 * effectId: ID do efeito baseado em battle_move_effects.h
 * secondaryEffectChance: Chance de efeito secundário (0-100)
 * priority: Prioridade do golpe (-6 a +6)
 * flags: Flags do golpe (contact, protect, etc.)
 */

module.exports = {
  "1": {
    "id": 1,
    "name": "Pound",
    "type": "normal",
    "category": "physical",
    "power": 40,
    "accuracy": 100,
    "pp": 35,
    "effect": "Physical attack",
    "effectId": 0, // EFFECT_HIT
    "secondaryEffectChance": 0,
    "priority": 0,
    "flags": ["contact", "protect"]
  },

  "7": {
    "id": 7,
    "name": "Fire Punch",
    "type": "fire",
    "category": "physical",
    "power": 75,
    "accuracy": 100,
    "pp": 15,
    "effect": "May burn foe",
    "effectId": 4, // EFFECT_BURN_HIT
    "secondaryEffectChance": 10,
    "priority": 0,
    "flags": ["contact", "protect"]
  },

  "8": {
    "id": 8,
    "name": "Ice Punch",
    "type": "ice",
    "category": "physical",
    "power": 75,
    "accuracy": 100,
    "pp": 15,
    "effect": "May freeze foe",
    "effectId": 5, // EFFECT_FREEZE_HIT
    "secondaryEffectChance": 10,
    "priority": 0,
    "flags": ["contact", "protect"]
  },

  "9": {
    "id": 9,
    "name": "Thunder Punch",
    "type": "electric",
    "category": "physical",
    "power": 75,
    "accuracy": 100,
    "pp": 15,
    "effect": "May paralyze foe",
    "effectId": 6, // EFFECT_PARALYZE_HIT
    "secondaryEffectChance": 10,
    "priority": 0,
    "flags": ["contact", "protect"]
  },

  "10": {
    "id": 10,
    "name": "Scratch",
    "type": "normal",
    "category": "physical",
    "power": 40,
    "accuracy": 100,
    "pp": 35,
    "effect": "Physical attack",
    "effectId": 0, // EFFECT_HIT
    "secondaryEffectChance": 0,
    "priority": 0,
    "flags": ["contact", "protect"]
  },

  "14": {
    "id": 14,
    "name": "Swords Dance",
    "type": "normal",
    "category": "status",
    "power": 0,
    "accuracy": 0,
    "pp": 30,
    "effect": "Sharply raises user's Attack",
    "effectId": 50, // EFFECT_ATTACK_UP_2
    "secondaryEffectChance": 100,
    "priority": 0,
    "flags": []
  },

  "20": {
    "id": 20,
    "name": "Poison Sting",
    "type": "poison",
    "category": "physical",
    "power": 15,
    "accuracy": 100,
    "pp": 35,
    "effect": "May poison foe",
    "effectId": 2, // EFFECT_POISON_HIT
    "secondaryEffectChance": 30,
    "priority": 0,
    "flags": ["protect"]
  },

  "31": {
    "id": 31,
    "name": "Peck",
    "type": "flying",
    "category": "physical",
    "power": 35,
    "accuracy": 100,
    "pp": 35,
    "effect": "Physical attack",
    "effectId": 0, // EFFECT_HIT
    "secondaryEffectChance": 0,
    "priority": 0,
    "flags": ["contact", "protect"]
  },

  "33": {
    "id": 33,
    "name": "Tackle",
    "type": "normal",
    "category": "physical",
    "power": 40,
    "accuracy": 100,
    "pp": 35,
    "effect": "Physical attack",
    "effectId": 0, // EFFECT_HIT
    "secondaryEffectChance": 0,
    "priority": 0,
    "flags": ["contact", "protect"]
  },

  "36": {
    "id": 36,
    "name": "Take Down",
    "type": "normal",
    "category": "physical",
    "power": 90,
    "accuracy": 85,
    "pp": 20,
    "effect": "User receives recoil damage",
    "effectId": 48, // EFFECT_RECOIL
    "secondaryEffectChance": 0,
    "priority": 0,
    "flags": ["contact", "protect"]
  },

  "38": {
    "id": 38,
    "name": "Double-Edge",
    "type": "normal",
    "category": "physical",
    "power": 120,
    "accuracy": 100,
    "pp": 15,
    "effect": "User receives recoil damage",
    "effectId": 48, // EFFECT_RECOIL
    "secondaryEffectChance": 0,
    "priority": 0,
    "flags": ["contact", "protect"]
  },

  "39": {
    "id": 39,
    "name": "Smokescreen",
    "type": "normal",
    "category": "status",
    "power": 0,
    "accuracy": 100,
    "pp": 20,
    "effect": "Reduces foe's accuracy",
    "effectId": 23, // EFFECT_ACCURACY_DOWN
    "secondaryEffectChance": 100,
    "priority": 0,
    "flags": ["protect"]
  },

  "44": {
    "id": 44,
    "name": "Bite",
    "type": "dark",
    "category": "physical",
    "power": 60,
    "accuracy": 100,
    "pp": 25,
    "effect": "May cause flinching",
    "effectId": 31, // EFFECT_FLINCH_HIT
    "secondaryEffectChance": 30,
    "priority": 0,
    "flags": ["contact", "protect"]
  },

  "45": {
    "id": 45,
    "name": "Growl",
    "type": "normal",
    "category": "status",
    "power": 0,
    "accuracy": 100,
    "pp": 40,
    "effect": "Lowers foe's Attack",
    "effectId": 18, // EFFECT_ATTACK_DOWN
    "secondaryEffectChance": 100,
    "priority": 0,
    "flags": ["protect"]
  },

  "55": {
    "id": 55,
    "name": "Bubble",
    "type": "water",
    "category": "special",
    "power": 20,
    "accuracy": 100,
    "pp": 30,
    "effect": "May lower foe's Speed",
    "effectId": 70, // EFFECT_SPEED_DOWN_HIT
    "secondaryEffectChance": 10,
    "priority": 0,
    "flags": ["protect"]
  },

  "56": {
    "id": 56,
    "name": "Hydro Pump",
    "type": "water",
    "category": "special",
    "power": 120,
    "accuracy": 80,
    "pp": 5,
    "effect": "Special attack",
    "effectId": 0, // EFFECT_HIT
    "secondaryEffectChance": 0,
    "priority": 0,
    "flags": ["protect"]
  },

  "58": {
    "id": 58,
    "name": "Ice Beam",
    "type": "ice",
    "category": "special",
    "power": 95,
    "accuracy": 100,
    "pp": 10,
    "effect": "May freeze foe",
    "effectId": 5, // EFFECT_FREEZE_HIT
    "secondaryEffectChance": 10,
    "priority": 0,
    "flags": ["protect"]
  },

  "59": {
    "id": 59,
    "name": "Water Gun",
    "type": "water",
    "category": "special",
    "power": 40,
    "accuracy": 100,
    "pp": 25,
    "effect": "Special attack",
    "effectId": 0, // EFFECT_HIT
    "secondaryEffectChance": 0,
    "priority": 0,
    "flags": ["protect"]
  },

  "63": {
    "id": 63,
    "name": "Hyper Beam",
    "type": "normal",
    "category": "special",
    "power": 150,
    "accuracy": 90,
    "pp": 5,
    "effect": "User must recharge next turn",
    "effectId": 80, // EFFECT_RECHARGE
    "secondaryEffectChance": 100,
    "priority": 0,
    "flags": ["protect"]
  },

  "71": {
    "id": 71,
    "name": "Absorb",
    "type": "grass",
    "category": "special",
    "power": 20,
    "accuracy": 100,
    "pp": 25,
    "effect": "Drains half the damage inflicted",
    "effectId": 3, // EFFECT_ABSORB
    "secondaryEffectChance": 0,
    "priority": 0,
    "flags": ["protect"]
  },

  "72": {
    "id": 72,
    "name": "Mega Drain",
    "type": "grass",
    "category": "special",
    "power": 40,
    "accuracy": 100,
    "pp": 15,
    "effect": "Drains half the damage inflicted",
    "effectId": 3, // EFFECT_ABSORB
    "secondaryEffectChance": 0,
    "priority": 0,
    "flags": ["protect"]
  },

  "77": {
    "id": 77,
    "name": "Razor Leaf",
    "type": "grass",
    "category": "physical",
    "power": 55,
    "accuracy": 95,
    "pp": 25,
    "effect": "High critical hit ratio",
    "effectId": 43, // EFFECT_HIGH_CRITICAL
    "secondaryEffectChance": 0,
    "priority": 0,
    "flags": ["protect"]
  },

  "79": {
    "id": 79,
    "name": "Sleep Powder",
    "type": "grass",
    "category": "status",
    "power": 0,
    "accuracy": 75,
    "pp": 15,
    "effect": "Puts foe to sleep",
    "effectId": 1, // EFFECT_SLEEP
    "secondaryEffectChance": 100,
    "priority": 0,
    "flags": ["protect"]
  },

  "85": {
    "id": 85,
    "name": "Thunderbolt",
    "type": "electric",
    "category": "special",
    "power": 90,
    "accuracy": 100,
    "pp": 15,
    "effect": "May paralyze foe",
    "effectId": 6, // EFFECT_PARALYZE_HIT
    "secondaryEffectChance": 10,
    "priority": 0,
    "flags": ["protect"]
  },

  "92": {
    "id": 92,
    "name": "Toxic",
    "type": "poison",
    "category": "status",
    "power": 0,
    "accuracy": 90,
    "pp": 10,
    "effect": "Badly poisons foe",
    "effectId": 33, // EFFECT_TOXIC
    "secondaryEffectChance": 100,
    "priority": 0,
    "flags": ["protect"]
  },

  "93": {
    "id": 93,
    "name": "Thunder Wave",
    "type": "electric",
    "category": "status",
    "power": 0,
    "accuracy": 100,
    "pp": 20,
    "effect": "Paralyzes foe",
    "effectId": 67, // EFFECT_PARALYZE
    "secondaryEffectChance": 100,
    "priority": 0,
    "flags": ["protect"]
  },

  "94": {
    "id": 94,
    "name": "Psychic",
    "type": "psychic",
    "category": "special",
    "power": 90,
    "accuracy": 100,
    "pp": 10,
    "effect": "May lower foe's Special Defense",
    "effectId": 72, // EFFECT_SPECIAL_DEFENSE_DOWN_HIT
    "secondaryEffectChance": 10,
    "priority": 0,
    "flags": ["protect"]
  },

  "98": {
    "id": 98,
    "name": "Quick Attack",
    "type": "normal",
    "category": "physical",
    "power": 40,
    "accuracy": 100,
    "pp": 30,
    "effect": "Always strikes first",
    "effectId": 103, // EFFECT_QUICK_ATTACK
    "secondaryEffectChance": 0,
    "priority": 1, // Priority +1
    "flags": ["contact", "protect"]
  },

  "99": {
    "id": 99,
    "name": "Withdraw",
    "type": "water",
    "category": "status",
    "power": 0,
    "accuracy": 100,
    "pp": 40,
    "effect": "Raises user's Defense",
    "effectId": 11, // EFFECT_DEFENSE_UP
    "secondaryEffectChance": 100,
    "priority": 0,
    "flags": []
  },

  "108": {
    "id": 108,
    "name": "Ember",
    "type": "fire",
    "category": "special",
    "power": 40,
    "accuracy": 100,
    "pp": 25,
    "effect": "May burn foe",
    "effectId": 4, // EFFECT_BURN_HIT
    "secondaryEffectChance": 10,
    "priority": 0,
    "flags": ["protect"]
  },

  "129": {
    "id": 129,
    "name": "Swift",
    "type": "normal",
    "category": "special",
    "power": 60,
    "accuracy": 0, // Never misses
    "pp": 20,
    "effect": "Never misses",
    "effectId": 17, // EFFECT_ALWAYS_HIT
    "secondaryEffectChance": 0,
    "priority": 0,
    "flags": ["protect"]
  },

  "156": {
    "id": 156,
    "name": "Rest",
    "type": "psychic",
    "category": "status",
    "power": 0,
    "accuracy": 0,
    "pp": 10,
    "effect": "User sleeps for 2 turns, fully healing",
    "effectId": 37, // EFFECT_REST
    "secondaryEffectChance": 100,
    "priority": 0,
    "flags": []
  },

  "163": {
    "id": 163,
    "name": "Fly",
    "type": "flying",
    "category": "physical",
    "power": 90,
    "accuracy": 95,
    "pp": 15,
    "effect": "User flies up, then attacks on next turn",
    "effectId": 155, // EFFECT_SEMI_INVULNERABLE
    "secondaryEffectChance": 0,
    "priority": 0,
    "flags": ["contact", "protect"]
  },

  "167": {
    "id": 167,
    "name": "Hydro Cannon",
    "type": "water",
    "category": "special",
    "power": 150,
    "accuracy": 90,
    "pp": 5,
    "effect": "User must recharge next turn",
    "effectId": 80, // EFFECT_RECHARGE
    "secondaryEffectChance": 100,
    "priority": 0,
    "flags": ["protect"]
  },

  "172": {
    "id": 172,
    "name": "Dragon Rage",
    "type": "dragon",
    "category": "special",
    "power": 40,
    "accuracy": 100,
    "pp": 15,
    "effect": "Deals fixed 40 damage",
    "effectId": 41, // EFFECT_DRAGON_RAGE
    "secondaryEffectChance": 0,
    "priority": 0,
    "flags": ["protect"]
  },

  "173": {
    "id": 173,
    "name": "Snore",
    "type": "normal",
    "category": "special",
    "power": 40,
    "accuracy": 100,
    "pp": 15,
    "effect": "Can only be used while asleep",
    "effectId": 92, // EFFECT_SNORE
    "secondaryEffectChance": 30,
    "priority": 0,
    "flags": ["protect"]
  },

  "182": {
    "id": 182,
    "name": "Protect",
    "type": "normal",
    "category": "status",
    "power": 0,
    "accuracy": 0,
    "pp": 10,
    "effect": "Protects from attacks this turn",
    "effectId": 111, // EFFECT_PROTECT
    "secondaryEffectChance": 100,
    "priority": 4, // Priority +4
    "flags": []
  },

  "203": {
    "id": 203,
    "name": "Flame Burst",
    "type": "fire",
    "category": "special",
    "power": 70,
    "accuracy": 100,
    "pp": 15,
    "effect": "May burn adjacent foes",
    "effectId": 4, // EFFECT_BURN_HIT
    "secondaryEffectChance": 30,
    "priority": 0,
    "flags": ["protect"]
  },

  "206": {
    "id": 206,
    "name": "Solar Beam",
    "type": "grass",
    "category": "special",
    "power": 120,
    "accuracy": 100,
    "pp": 10,
    "effect": "Charges on first turn, attacks on second",
    "effectId": 151, // EFFECT_SOLAR_BEAM
    "secondaryEffectChance": 0,
    "priority": 0,
    "flags": ["protect"]
  },

  "207": {
    "id": 207,
    "name": "Flamethrower",
    "type": "fire",
    "category": "special",
    "power": 90,
    "accuracy": 100,
    "pp": 15,
    "effect": "May burn foe",
    "effectId": 4, // EFFECT_BURN_HIT
    "secondaryEffectChance": 10,
    "priority": 0,
    "flags": ["protect"]
  },

  "209": {
    "id": 209,
    "name": "Synthesis",
    "type": "grass",
    "category": "status",
    "power": 0,
    "accuracy": 100,
    "pp": 5,
    "effect": "Heals user by 50% of max HP",
    "effectId": 32, // EFFECT_RESTORE_HP
    "secondaryEffectChance": 100,
    "priority": 0,
    "flags": []
  },

  "210": {
    "id": 210,
    "name": "Surf",
    "type": "water",
    "category": "special",
    "power": 90,
    "accuracy": 100,
    "pp": 15,
    "effect": "Hits all foes in double battles",
    "effectId": 0, // EFFECT_HIT
    "secondaryEffectChance": 0,
    "priority": 0,
    "flags": ["protect"]
  },

  "247": {
    "id": 247,
    "name": "Shadow Ball",
    "type": "ghost",
    "category": "special",
    "power": 80,
    "accuracy": 100,
    "pp": 15,
    "effect": "May lower foe's Special Defense",
    "effectId": 72, // EFFECT_SPECIAL_DEFENSE_DOWN_HIT
    "secondaryEffectChance": 20,
    "priority": 0,
    "flags": ["protect"]
  },

  "337": {
    "id": 337,
    "name": "Dragon Claw",
    "type": "dragon",
    "category": "physical",
    "power": 80,
    "accuracy": 100,
    "pp": 15,
    "effect": "Physical attack",
    "effectId": 0, // EFFECT_HIT
    "secondaryEffectChance": 0,
    "priority": 0,
    "flags": ["contact", "protect"]
  },

  "350": {
    "id": 350,
    "name": "Rock Smash",
    "type": "fighting",
    "category": "physical",
    "power": 40,
    "accuracy": 100,
    "pp": 15,
    "effect": "May lower foe's Defense",
    "effectId": 69, // EFFECT_DEFENSE_DOWN_HIT
    "secondaryEffectChance": 50,
    "priority": 0,
    "flags": ["contact", "protect"]
  }
};
