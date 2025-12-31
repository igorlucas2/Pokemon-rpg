/**
 * Database Migration: FireRed Integration
 * 
 * Adiciona tabelas necessárias para:
 * - Pokémon do treinador com stats completos
 * - Espécies de Pokémon (cache)
 * - Golpes (cache)
 * - Mapeamento de encontros por mapa
 */

const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

function openDb() {
  const DATA_DIR = path.join(__dirname, "..", "data");
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  
  const DB_FILE = path.join(DATA_DIR, "users.sqlite");
  const db = new Database(DB_FILE);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}

function migrateFireRedTables() {
  const db = openDb();

  try {
    // ========== TABELA: trainer_pokemon ==========
    // Estendida com campos de stats, EXP, moveset, IVs, EVs, evolução
    db.exec(`
      CREATE TABLE IF NOT EXISTS trainer_pokemon (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        trainer_id INTEGER NOT NULL,
        pokedex_id INTEGER NOT NULL,
        
        -- Informações básicas
        nickname TEXT,
        level INTEGER NOT NULL DEFAULT 5,
        current_exp INTEGER NOT NULL DEFAULT 0,
        max_exp INTEGER,
        
        -- Stats calculados
        hp INTEGER,
        attack INTEGER,
        defense INTEGER,
        sp_attack INTEGER,
        sp_defense INTEGER,
        speed INTEGER,
        
        -- Moveset (4 golpes)
        move_1_id INTEGER,
        move_1_pp INTEGER,
        move_2_id INTEGER,
        move_2_pp INTEGER,
        move_3_id INTEGER,
        move_3_pp INTEGER,
        move_4_id INTEGER,
        move_4_pp INTEGER,
        
        -- Genética (IVs - Individual Values)
        iv_hp INTEGER DEFAULT 10,
        iv_atk INTEGER DEFAULT 10,
        iv_def INTEGER DEFAULT 10,
        iv_spa INTEGER DEFAULT 10,
        iv_spd INTEGER DEFAULT 10,
        iv_spe INTEGER DEFAULT 10,
        
        -- EVs (Effort Values) - para ganho de stats em batalhas
        ev_hp INTEGER DEFAULT 0,
        ev_atk INTEGER DEFAULT 0,
        ev_def INTEGER DEFAULT 0,
        ev_spa INTEGER DEFAULT 0,
        ev_spd INTEGER DEFAULT 0,
        ev_spe INTEGER DEFAULT 0,
        
        -- Natureza (modifica stats por 10%)
        nature TEXT DEFAULT 'Hardy',
        
        -- Estado
        status TEXT DEFAULT NULL, -- 'PARALYZE', 'POISON', 'BURN', 'FREEZE', 'SLEEP'
        is_evolved BOOLEAN DEFAULT 0,
        growth_rate TEXT DEFAULT 'GROWTH_MEDIUM_SLOW',
        
        -- Timestamp
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY(trainer_id) REFERENCES users(id),
        FOREIGN KEY(pokedex_id) REFERENCES pokemon_species(id),
        UNIQUE(trainer_id, pokedex_id, nickname)
      );

      CREATE INDEX IF NOT EXISTS idx_trainer_pokemon_trainer_id ON trainer_pokemon(trainer_id);
      CREATE INDEX IF NOT EXISTS idx_trainer_pokemon_level ON trainer_pokemon(level);
    `);

    // ========== TABELA: pokemon_species ==========
    // Cache local de espécies (base stats, growth rates, etc.)
    db.exec(`
      CREATE TABLE IF NOT EXISTS pokemon_species (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        
        -- Base stats
        base_hp INTEGER NOT NULL,
        base_atk INTEGER NOT NULL,
        base_def INTEGER NOT NULL,
        base_spa INTEGER NOT NULL,
        base_spd INTEGER NOT NULL,
        base_spe INTEGER NOT NULL,
        
        -- Tipo(s)
        type_1 TEXT,
        type_2 TEXT,
        
        -- Experiência
        growth_rate TEXT NOT NULL DEFAULT 'GROWTH_MEDIUM_SLOW',
        base_exp INTEGER DEFAULT 50,
        capture_rate INTEGER DEFAULT 45,
        
        -- Referência ao pokefirered
        pokefirered_id TEXT UNIQUE,
        
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_pokemon_species_name ON pokemon_species(name);
      CREATE INDEX IF NOT EXISTS idx_pokemon_species_growth_rate ON pokemon_species(growth_rate);
    `);

    // ========== TABELA: moves ==========
    // Cache de golpes
    db.exec(`
      CREATE TABLE IF NOT EXISTS moves (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        type TEXT NOT NULL,
        category TEXT NOT NULL, -- 'physical', 'special', 'status'
        power INTEGER DEFAULT 0,
        accuracy INTEGER DEFAULT 100,
        pp INTEGER DEFAULT 10,
        effect TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_moves_name ON moves(name);
      CREATE INDEX IF NOT EXISTS idx_moves_type ON moves(type);
    `);

    // ========== TABELA: map_encounters ==========
    // Mapeamento de quais Pokémon aparecem em cada mapa/terreno
    db.exec(`
      CREATE TABLE IF NOT EXISTS map_encounters (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        map_id TEXT NOT NULL,
        terrain TEXT NOT NULL,
        pokemon_id INTEGER NOT NULL,
        min_level INTEGER NOT NULL DEFAULT 1,
        max_level INTEGER NOT NULL DEFAULT 100,
        encounter_rate REAL NOT NULL DEFAULT 0.5,
        
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY(pokemon_id) REFERENCES pokemon_species(id),
        UNIQUE(map_id, terrain, pokemon_id)
      );

      CREATE INDEX IF NOT EXISTS idx_map_encounters_map_terrain ON map_encounters(map_id, terrain);
    `);

    // ========== TABELA: pokemon_evolution ==========
    // Dados de evolução (método, item necessário, etc.)
    db.exec(`
      CREATE TABLE IF NOT EXISTS pokemon_evolution (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pokemon_id INTEGER NOT NULL,
        evolves_into INTEGER NOT NULL,
        
        -- Método de evolução
        trigger_type TEXT NOT NULL, -- 'level', 'item', 'trade', 'happiness', 'location'
        trigger_value TEXT, -- ex: level '16', item 'THUNDER_STONE', etc.
        
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY(pokemon_id) REFERENCES pokemon_species(id),
        FOREIGN KEY(evolves_into) REFERENCES pokemon_species(id)
      );

      CREATE INDEX IF NOT EXISTS idx_pokemon_evolution_pokemon_id ON pokemon_evolution(pokemon_id);
    `);

    // ========== TABELA: pokemon_learnset ==========
    // Quais golpes cada Pokémon aprende em qual nível
    db.exec(`
      CREATE TABLE IF NOT EXISTS pokemon_learnset (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pokemon_id INTEGER NOT NULL,
        move_id INTEGER NOT NULL,
        level_learned INTEGER NOT NULL DEFAULT 1,
        
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY(pokemon_id) REFERENCES pokemon_species(id),
        FOREIGN KEY(move_id) REFERENCES moves(id),
        UNIQUE(pokemon_id, move_id, level_learned)
      );

      CREATE INDEX IF NOT EXISTS idx_pokemon_learnset_pokemon_id ON pokemon_learnset(pokemon_id);
      CREATE INDEX IF NOT EXISTS idx_pokemon_learnset_level ON pokemon_learnset(level_learned);
    `);

    // ========== TABELA: battle_log ==========
    // Histórico de batalhas (opcional, para análise)
    db.exec(`
      CREATE TABLE IF NOT EXISTS battle_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        trainer_id INTEGER NOT NULL,
        opponent_id INTEGER, -- NULL se selvagem
        enemy_pokemon_id INTEGER,
        player_pokemon_id INTEGER,
        
        result TEXT NOT NULL, -- 'WIN', 'LOSS', 'DRAW'
        exp_gained INTEGER,
        items_gained TEXT, -- JSON
        
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY(trainer_id) REFERENCES users(id),
        FOREIGN KEY(opponent_id) REFERENCES users(id),
        FOREIGN KEY(enemy_pokemon_id) REFERENCES pokemon_species(id),
        FOREIGN KEY(player_pokemon_id) REFERENCES trainer_pokemon(id)
      );

      CREATE INDEX IF NOT EXISTS idx_battle_log_trainer_id ON battle_log(trainer_id);
      CREATE INDEX IF NOT EXISTS idx_battle_log_created_at ON battle_log(created_at);
    `);

    console.log("✓ Database migration completed successfully");
    db.close();
    return true;
  } catch (err) {
    console.error("✗ Database migration failed:", err);
    db.close();
    throw err;
  }
}

// Executar migração se chamado diretamente
if (require.main === module) {
  migrateFireRedTables();
}

module.exports = { migrateFireRedTables };
