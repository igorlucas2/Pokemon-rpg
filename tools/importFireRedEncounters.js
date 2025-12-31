/**
 * Import Wild Encounters from FireRed
 * 
 * Reads wild_encounters.json from pokefirered-master and populates the database
 */

const fs = require('fs');
const path = require('path');
const { getDb } = require('../services/db');

// Species name to ID mapping (FireRed uses SPECIES_PIKACHU, we need ID 25)
const SPECIES_TO_ID = {
    'SPECIES_BULBASAUR': 1, 'SPECIES_IVYSAUR': 2, 'SPECIES_VENUSAUR': 3,
    'SPECIES_CHARMANDER': 4, 'SPECIES_CHARMELEON': 5, 'SPECIES_CHARIZARD': 6,
    'SPECIES_SQUIRTLE': 7, 'SPECIES_WARTORTLE': 8, 'SPECIES_BLASTOISE': 9,
    'SPECIES_CATERPIE': 10, 'SPECIES_METAPOD': 11, 'SPECIES_BUTTERFREE': 12,
    'SPECIES_WEEDLE': 13, 'SPECIES_KAKUNA': 14, 'SPECIES_BEEDRILL': 15,
    'SPECIES_PIDGEY': 16, 'SPECIES_PIDGEOTTO': 17, 'SPECIES_PIDGEOT': 18,
    'SPECIES_RATTATA': 19, 'SPECIES_RATICATE': 20,
    'SPECIES_SPEAROW': 21, 'SPECIES_FEAROW': 22,
    'SPECIES_EKANS': 23, 'SPECIES_ARBOK': 24,
    'SPECIES_PIKACHU': 25, 'SPECIES_RAICHU': 26,
    'SPECIES_SANDSHREW': 27, 'SPECIES_SANDSLASH': 28,
    'SPECIES_NIDORAN_F': 29, 'SPECIES_NIDORINA': 30, 'SPECIES_NIDOQUEEN': 31,
    'SPECIES_NIDORAN_M': 32, 'SPECIES_NIDORINO': 33, 'SPECIES_NIDOKING': 34,
    'SPECIES_CLEFAIRY': 35, 'SPECIES_CLEFABLE': 36,
    'SPECIES_VULPIX': 37, 'SPECIES_NINETALES': 38,
    'SPECIES_JIGGLYPUFF': 39, 'SPECIES_WIGGLYTUFF': 40,
    'SPECIES_ZUBAT': 41, 'SPECIES_GOLBAT': 42,
    'SPECIES_ODDISH': 43, 'SPECIES_GLOOM': 44, 'SPECIES_VILEPLUME': 45,
    'SPECIES_PARAS': 46, 'SPECIES_PARASECT': 47,
    'SPECIES_VENONAT': 48, 'SPECIES_VENOMOTH': 49,
    'SPECIES_DIGLETT': 50, 'SPECIES_DUGTRIO': 51,
    'SPECIES_MEOWTH': 52, 'SPECIES_PERSIAN': 53,
    'SPECIES_PSYDUCK': 54, 'SPECIES_GOLDUCK': 55,
    'SPECIES_MANKEY': 56, 'SPECIES_PRIMEAPE': 57,
    'SPECIES_GROWLITHE': 58, 'SPECIES_ARCANINE': 59,
    'SPECIES_POLIWAG': 60, 'SPECIES_POLIWHIRL': 61, 'SPECIES_POLIWRATH': 62,
    'SPECIES_ABRA': 63, 'SPECIES_KADABRA': 64, 'SPECIES_ALAKAZAM': 65,
    'SPECIES_MACHOP': 66, 'SPECIES_MACHOKE': 67, 'SPECIES_MACHAMP': 68,
    'SPECIES_BELLSPROUT': 69, 'SPECIES_WEEPINBELL': 70, 'SPECIES_VICTREEBEL': 71,
    'SPECIES_TENTACOOL': 72, 'SPECIES_TENTACRUEL': 73,
    'SPECIES_GEODUDE': 74, 'SPECIES_GRAVELER': 75, 'SPECIES_GOLEM': 76,
    'SPECIES_PONYTA': 77, 'SPECIES_RAPIDASH': 78,
    'SPECIES_SLOWPOKE': 79, 'SPECIES_SLOWBRO': 80,
    'SPECIES_MAGNEMITE': 81, 'SPECIES_MAGNETON': 82,
    'SPECIES_FARFETCHD': 83,
    'SPECIES_DODUO': 84, 'SPECIES_DODRIO': 85,
    'SPECIES_SEEL': 86, 'SPECIES_DEWGONG': 87,
    'SPECIES_GRIMER': 88, 'SPECIES_MUK': 89,
    'SPECIES_SHELLDER': 90, 'SPECIES_CLOYSTER': 91,
    'SPECIES_GASTLY': 92, 'SPECIES_HAUNTER': 93, 'SPECIES_GENGAR': 94,
    'SPECIES_ONIX': 95,
    'SPECIES_DROWZEE': 96, 'SPECIES_HYPNO': 97,
    'SPECIES_KRABBY': 98, 'SPECIES_KINGLER': 99,
    'SPECIES_VOLTORB': 100, 'SPECIES_ELECTRODE': 101,
    'SPECIES_EXEGGCUTE': 102, 'SPECIES_EXEGGUTOR': 103,
    'SPECIES_CUBONE': 104, 'SPECIES_MAROWAK': 105,
    'SPECIES_HITMONLEE': 106, 'SPECIES_HITMONCHAN': 107,
    'SPECIES_LICKITUNG': 108,
    'SPECIES_KOFFING': 109, 'SPECIES_WEEZING': 110,
    'SPECIES_RHYHORN': 111, 'SPECIES_RHYDON': 112,
    'SPECIES_CHANSEY': 113,
    'SPECIES_TANGELA': 114,
    'SPECIES_KANGASKHAN': 115,
    'SPECIES_HORSEA': 116, 'SPECIES_SEADRA': 117,
    'SPECIES_GOLDEEN': 118, 'SPECIES_SEAKING': 119,
    'SPECIES_STARYU': 120, 'SPECIES_STARMIE': 121,
    'SPECIES_MR_MIME': 122,
    'SPECIES_SCYTHER': 123,
    'SPECIES_JYNX': 124,
    'SPECIES_ELECTABUZZ': 125,
    'SPECIES_MAGMAR': 126,
    'SPECIES_PINSIR': 127,
    'SPECIES_TAUROS': 128,
    'SPECIES_MAGIKARP': 129, 'SPECIES_GYARADOS': 130,
    'SPECIES_LAPRAS': 131,
    'SPECIES_DITTO': 132,
    'SPECIES_EEVEE': 133, 'SPECIES_VAPOREON': 134, 'SPECIES_JOLTEON': 135, 'SPECIES_FLAREON': 136,
    'SPECIES_PORYGON': 137,
    'SPECIES_OMANYTE': 138, 'SPECIES_OMASTAR': 139,
    'SPECIES_KABUTO': 140, 'SPECIES_KABUTOPS': 141,
    'SPECIES_AERODACTYL': 142,
    'SPECIES_SNORLAX': 143,
    'SPECIES_ARTICUNO': 144, 'SPECIES_ZAPDOS': 145, 'SPECIES_MOLTRES': 146,
    'SPECIES_DRATINI': 147, 'SPECIES_DRAGONAIR': 148, 'SPECIES_DRAGONITE': 149,
    'SPECIES_MEWTWO': 150, 'SPECIES_MEW': 151,
    'SPECIES_UNOWN': 201 // Gen 2 but in FireRed
};

// Map names to simplified route IDs
function mapNameToRouteId(mapName) {
    // Remove MAP_ prefix
    const name = mapName.replace('MAP_', '');

    // Common conversions (for special cases)
    const conversions = {
        'ROUTE_1': 'Route1',
        'ROUTE_2': 'Route2',
        'ROUTE_3': 'Route3',
        'ROUTE_4': 'Route4',
        'ROUTE_5': 'Route5',
        'ROUTE_6': 'Route6',
        'ROUTE_7': 'Route7',
        'ROUTE_8': 'Route8',
        'ROUTE_9': 'Route9',
        'ROUTE_10': 'Route10',
        'ROUTE_11': 'Route11',
        'ROUTE_12': 'Route12',
        'ROUTE_13': 'Route13',
        'ROUTE_14': 'Route14',
        'ROUTE_15': 'Route15',
        'ROUTE_16': 'Route16',
        'ROUTE_17': 'Route17',
        'ROUTE_18': 'Route18',
        'ROUTE_19': 'Route19',
        'ROUTE_20': 'Route20',
        'ROUTE_21': 'Route21',
        'ROUTE_22': 'Route22',
        'ROUTE_23': 'Route23',
        'ROUTE_24': 'Route24',
        'ROUTE_25': 'Route25',
        'VIRIDIAN_FOREST': 'ViridianForest',
        'MT_MOON_1F': 'MtMoon1F',
        'MT_MOON_B1F': 'MtMoonB1F',
        'MT_MOON_B2F': 'MtMoonB2F',
        'ROCK_TUNNEL_1F': 'RockTunnel1F',
        'ROCK_TUNNEL_B1F': 'RockTunnelB1F',
        'VICTORY_ROAD_1F': 'VictoryRoad1F',
        'VICTORY_ROAD_2F': 'VictoryRoad2F',
        'VICTORY_ROAD_3F': 'VictoryRoad3F',
        'DIGLETTS_CAVE': 'DiglettsCave',
        'SEAFOAM_ISLANDS_1F': 'SeafoamIslands1F',
        'SEAFOAM_ISLANDS_B1F': 'SeafoamIslandsB1F',
        'SEAFOAM_ISLANDS_B2F': 'SeafoamIslandsB2F',
        'SEAFOAM_ISLANDS_B3F': 'SeafoamIslandsB3F',
        'SEAFOAM_ISLANDS_B4F': 'SeafoamIslandsB4F',
        'POKEMON_TOWER_3F': 'PokemonTower3F',
        'POKEMON_TOWER_4F': 'PokemonTower4F',
        'POKEMON_TOWER_5F': 'PokemonTower5F',
        'POKEMON_TOWER_6F': 'PokemonTower6F',
        'POKEMON_TOWER_7F': 'PokemonTower7F',
        'POWER_PLANT': 'PowerPlant',
        'CERULEAN_CAVE_1F': 'CeruleanCave1F',
        'CERULEAN_CAVE_2F': 'CeruleanCave2F',
        'CERULEAN_CAVE_B1F': 'CeruleanCaveB1F'
    };

    // If we have a specific conversion, use it
    if (conversions[name]) {
        return conversions[name];
    }

    // Otherwise, convert UPPERCASE_UNDERSCORE to PascalCase
    // Example: CELADON_CITY -> CeladonCity
    return name
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join('');
}

function importWildEncounters() {
    console.log('🔄 Importando encontros selvagens do FireRed...\n');

    const encountersPath = path.join(__dirname, '..', 'core', 'pokefirered-master', 'pokefirered-master', 'src', 'data', 'wild_encounters.json');

    if (!fs.existsSync(encountersPath)) {
        console.error('❌ Arquivo wild_encounters.json não encontrado!');
        return;
    }

    const data = JSON.parse(fs.readFileSync(encountersPath, 'utf-8'));
    const db = getDb();

    // Probabilidades fixas do FireRed para land_mons (12 slots)
    const LAND_PROBABILITIES = [20, 20, 10, 10, 10, 10, 5, 5, 4, 4, 1, 1];
    const WATER_PROBABILITIES = [60, 30, 5, 4, 1];
    const FISHING_PROBABILITIES = [70, 30, 60, 20, 20, 40, 40, 15, 4, 1];
    const ROCK_SMASH_PROBABILITIES = [60, 30, 5, 4, 1];

    const insertStmt = db.prepare(`
    INSERT OR REPLACE INTO wild_encounters 
    (map_id, encounter_type, slot_number, pokemon_id, min_level, max_level, probability)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

    // Helper function to safely insert (skip if Pokemon doesn't exist)
    const safeInsert = (mapId, type, slot, pokemonId, minLv, maxLv, prob) => {
        try {
            insertStmt.run(mapId, type, slot, pokemonId, minLv, maxLv, prob);
            return true;
        } catch (err) {
            return false; // Skip Pokemon that don't exist
        }
    };

    let totalInserted = 0;
    let routesProcessed = 0;

    // Process each encounter group
    for (const group of data.wild_encounter_groups || []) {
        if (!group.encounters) continue;

        for (const encounter of group.encounters) {
            const mapId = mapNameToRouteId(encounter.map);

            // Process land_mons (grass)
            if (encounter.land_mons && encounter.land_mons.mons) {
                encounter.land_mons.mons.forEach((mon, idx) => {
                    const pokemonId = SPECIES_TO_ID[mon.species];
                    if (pokemonId && safeInsert(mapId, 'grass', idx + 1, pokemonId, mon.min_level, mon.max_level, LAND_PROBABILITIES[idx] || 0)) {
                        totalInserted++;
                    }
                });
                routesProcessed++;
                console.log(`✅ ${mapId} - Grass: ${encounter.land_mons.mons.length} slots`);
            }

            // Process water_mons
            if (encounter.water_mons && encounter.water_mons.mons) {
                encounter.water_mons.mons.forEach((mon, idx) => {
                    const pokemonId = SPECIES_TO_ID[mon.species];
                    if (pokemonId) {
                        insertStmt.run(
                            mapId,
                            'water',
                            idx + 1,
                            pokemonId,
                            mon.min_level,
                            mon.max_level,
                            WATER_PROBABILITIES[idx] || 0
                        );
                        totalInserted++;
                    }
                });
                console.log(`✅ ${mapId} - Water: ${encounter.water_mons.mons.length} slots`);
            }

            // Process fishing_mons
            if (encounter.fishing_mons && encounter.fishing_mons.mons) {
                encounter.fishing_mons.mons.forEach((mon, idx) => {
                    const pokemonId = SPECIES_TO_ID[mon.species];
                    if (pokemonId) {
                        insertStmt.run(
                            mapId,
                            'fishing',
                            idx + 1,
                            pokemonId,
                            mon.min_level,
                            mon.max_level,
                            FISHING_PROBABILITIES[idx] || 0
                        );
                        totalInserted++;
                    }
                });
                console.log(`✅ ${mapId} - Fishing: ${encounter.fishing_mons.mons.length} slots`);
            }

            // Process rock_smash_mons
            if (encounter.rock_smash_mons && encounter.rock_smash_mons.mons) {
                encounter.rock_smash_mons.mons.forEach((mon, idx) => {
                    const pokemonId = SPECIES_TO_ID[mon.species];
                    if (pokemonId) {
                        insertStmt.run(
                            mapId,
                            'rock_smash',
                            idx + 1,
                            pokemonId,
                            mon.min_level,
                            mon.max_level,
                            ROCK_SMASH_PROBABILITIES[idx] || 0
                        );
                        totalInserted++;
                    }
                });
                console.log(`✅ ${mapId} - Rock Smash: ${encounter.rock_smash_mons.mons.length} slots`);
            }
        }
    }

    console.log(`\n✅ Importação concluída!`);
    console.log(`📊 ${routesProcessed} rotas processadas`);
    console.log(`📊 ${totalInserted} encontros inseridos`);

    // Show summary
    const summary = db.prepare(`
    SELECT encounter_type, COUNT(*) as count
    FROM wild_encounters
    GROUP BY encounter_type
  `).all();

    console.log('\n📈 Resumo por tipo:');
    summary.forEach(s => {
        console.log(`   ${s.encounter_type}: ${s.count} slots`);
    });
}

// Run if called directly
if (require.main === module) {
    try {
        importWildEncounters();
    } catch (err) {
        console.error('❌ Erro:', err);
        process.exit(1);
    }
}

module.exports = { importWildEncounters };
