/**
 * Wild Encounters Database Migration
 * 
 * Creates table for managing wild Pokemon encounters per route
 */

const { getDb } = require('../services/db');

function migrateWildEncounters() {
    const db = getDb();

    console.log('🔄 Criando tabela de encontros selvagens...');

    // Create wild_encounters table
    db.exec(`
    CREATE TABLE IF NOT EXISTS wild_encounters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      map_id TEXT NOT NULL,
      encounter_type TEXT NOT NULL CHECK(encounter_type IN ('grass', 'water', 'fishing', 'rock_smash')),
      slot_number INTEGER NOT NULL,
      pokemon_id INTEGER NOT NULL,
      min_level INTEGER NOT NULL CHECK(min_level >= 1 AND min_level <= 100),
      max_level INTEGER NOT NULL CHECK(max_level >= 1 AND max_level <= 100),
      probability REAL NOT NULL CHECK(probability >= 0 AND probability <= 100),
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(map_id, encounter_type, slot_number),
      FOREIGN KEY (pokemon_id) REFERENCES pokemon(id)
    )
  `);

    // Create index for faster lookups
    db.exec(`
    CREATE INDEX IF NOT EXISTS idx_wild_encounters_map 
    ON wild_encounters(map_id, encounter_type)
  `);

    console.log('✅ Tabela wild_encounters criada!');

    // Insert some default data for Route 1 (based on FireRed)
    console.log('📝 Inserindo dados padrão para Route1...');

    const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO wild_encounters 
    (map_id, encounter_type, slot_number, pokemon_id, min_level, max_level, probability)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

    // Route 1 - Grass encounters (FireRed data)
    const route1Grass = [
        { slot: 1, pokemon: 16, minLv: 2, maxLv: 5, prob: 20 },  // Pidgey
        { slot: 2, pokemon: 19, minLv: 2, maxLv: 4, prob: 20 },  // Rattata
        { slot: 3, pokemon: 16, minLv: 3, maxLv: 5, prob: 10 },  // Pidgey
        { slot: 4, pokemon: 19, minLv: 3, maxLv: 4, prob: 10 },  // Rattata
        { slot: 5, pokemon: 16, minLv: 4, maxLv: 5, prob: 10 },  // Pidgey
        { slot: 6, pokemon: 19, minLv: 4, maxLv: 4, prob: 10 },  // Rattata
        { slot: 7, pokemon: 16, minLv: 5, maxLv: 5, prob: 5 },   // Pidgey
        { slot: 8, pokemon: 19, minLv: 5, maxLv: 5, prob: 5 },   // Rattata
        { slot: 9, pokemon: 16, minLv: 2, maxLv: 3, prob: 4 },   // Pidgey
        { slot: 10, pokemon: 19, minLv: 2, maxLv: 3, prob: 4 },  // Rattata
        { slot: 11, pokemon: 16, minLv: 3, maxLv: 4, prob: 1 },  // Pidgey
        { slot: 12, pokemon: 19, minLv: 3, maxLv: 5, prob: 1 }   // Rattata
    ];

    route1Grass.forEach(enc => {
        insertStmt.run('Route1', 'grass', enc.slot, enc.pokemon, enc.minLv, enc.maxLv, enc.prob);
    });

    console.log('✅ Dados padrão inseridos!');

    // Verify
    const count = db.prepare('SELECT COUNT(*) as count FROM wild_encounters').get();
    console.log(`📊 Total de encontros configurados: ${count.count}`);
}

// Run if called directly
if (require.main === module) {
    try {
        migrateWildEncounters();
        console.log('✅ Migração concluída!');
    } catch (err) {
        console.error('❌ Erro:', err);
        process.exit(1);
    }
}

module.exports = { migrateWildEncounters };
