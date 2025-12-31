/**
 * Import FireRed Items to Database
 * 
 * Reads items.json from pokefirered-master and imports relevant items
 * into the SQLite database for the shop system.
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const ITEMS_JSON_PATH = path.join(__dirname, '..', 'core', 'pokefirered-master', 'pokefirered-master', 'src', 'data', 'items.json');
const DB_PATH = path.join(__dirname, '..', 'data', 'users.sqlite');
const MIGRATION_PATH = path.join(__dirname, '..', 'data', 'migration_items.sql');

// Categories to import (shop-relevant items)
const RELEVANT_POCKETS = [
    'POCKET_ITEMS',        // Medicines, status healers
    'POCKET_POKE_BALLS',   // Pokéballs
    'POCKET_TM_CASE',      // TMs (optional)
    'POCKET_BERRY_POUCH'   // Berries (optional)
];

// Items that should be available in Poké Marts
const POKEMART_ITEMS = [
    'ITEM_POKE_BALL',
    'ITEM_GREAT_BALL',
    'ITEM_ULTRA_BALL',
    'ITEM_POTION',
    'ITEM_SUPER_POTION',
    'ITEM_HYPER_POTION',
    'ITEM_MAX_POTION',
    'ITEM_FULL_RESTORE',
    'ITEM_REVIVE',
    'ITEM_MAX_REVIVE',
    'ITEM_ANTIDOTE',
    'ITEM_PARALYZE_HEAL',
    'ITEM_BURN_HEAL',
    'ITEM_ICE_HEAL',
    'ITEM_AWAKENING',
    'ITEM_FULL_HEAL',
    'ITEM_ESCAPE_ROPE',
    'ITEM_REPEL',
    'ITEM_SUPER_REPEL',
    'ITEM_MAX_REPEL',
    'ITEM_FRESH_WATER',
    'ITEM_SODA_POP',
    'ITEM_LEMONADE',
    'ITEM_MOOMOO_MILK'
];

function main() {
    console.log('🔄 Starting FireRed items import...\n');

    // Read items.json
    console.log('📖 Reading items.json...');
    const itemsData = JSON.parse(fs.readFileSync(ITEMS_JSON_PATH, 'utf-8'));
    const items = itemsData.items || [];
    console.log(`   Found ${items.length} items in FireRed data\n`);

    // Filter relevant items
    const relevantItems = items.filter(item => {
        // Skip placeholder items
        if (item.itemId === 'ITEM_NONE') return false;

        // Include all Poké Mart items
        if (POKEMART_ITEMS.includes(item.itemId)) return true;

        // Include items from relevant pockets
        if (RELEVANT_POCKETS.includes(item.pocket)) return true;

        return false;
    });

    console.log(`✅ Filtered to ${relevantItems.length} relevant items\n`);

    // Open database
    console.log('🗄️  Opening database...');
    const db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');

    try {
        // Run migration
        console.log('📝 Running migration...');
        const migration = fs.readFileSync(MIGRATION_PATH, 'utf-8');
        db.exec(migration);
        console.log('   ✅ Migration complete\n');

        // Add shop_type column to npcs if it doesn't exist
        try {
            db.exec(`ALTER TABLE npcs ADD COLUMN shop_type TEXT DEFAULT NULL`);
            console.log('   ✅ Added shop_type column to npcs table\n');
        } catch (err) {
            if (err.message.includes('duplicate column')) {
                console.log('   ℹ️  shop_type column already exists\n');
            } else {
                throw err;
            }
        }

        // Prepare insert statement
        const insertItem = db.prepare(`
      INSERT OR REPLACE INTO items (
        item_id, name, price, category, pocket, description,
        hold_effect, hold_effect_param, battle_usage, field_use_func
      ) VALUES (
        @itemId, @name, @price, @category, @pocket, @description,
        @holdEffect, @holdEffectParam, @battleUsage, @fieldUseFunc
      )
    `);

        // Insert items
        console.log('💾 Inserting items into database...');
        const insertMany = db.transaction((items) => {
            for (const item of items) {
                insertItem.run({
                    itemId: item.itemId,
                    name: item.english || item.itemId,
                    price: item.price || 0,
                    category: item.type || null,
                    pocket: item.pocket || null,
                    description: item.description_english || null,
                    holdEffect: item.holdEffect || null,
                    holdEffectParam: item.holdEffectParam || 0,
                    battleUsage: item.battleUsage || 0,
                    fieldUseFunc: item.fieldUseFunc || null
                });
            }
        });

        insertMany(relevantItems);
        console.log(`   ✅ Inserted ${relevantItems.length} items\n`);

        // Show some stats
        const stats = db.prepare(`
      SELECT 
        pocket,
        COUNT(*) as count,
        AVG(price) as avg_price
      FROM items
      WHERE pocket IS NOT NULL
      GROUP BY pocket
      ORDER BY count DESC
    `).all();

        console.log('📊 Import Statistics:');
        console.log('   ┌─────────────────────────┬───────┬────────────┐');
        console.log('   │ Pocket                  │ Count │ Avg Price  │');
        console.log('   ├─────────────────────────┼───────┼────────────┤');
        for (const stat of stats) {
            const pocket = (stat.pocket || 'Unknown').padEnd(23);
            const count = String(stat.count).padStart(5);
            const avgPrice = `₽${Math.round(stat.avg_price)}`.padStart(10);
            console.log(`   │ ${pocket} │ ${count} │ ${avgPrice} │`);
        }
        console.log('   └─────────────────────────┴───────┴────────────┘\n');

        // Show sample Poké Mart items
        const pokemartSample = db.prepare(`
      SELECT item_id, name, price
      FROM items
      WHERE item_id IN (${POKEMART_ITEMS.slice(0, 5).map(() => '?').join(',')})
      ORDER BY price
    `).all(...POKEMART_ITEMS.slice(0, 5));

        console.log('🏪 Sample Poké Mart Items:');
        for (const item of pokemartSample) {
            console.log(`   • ${item.name.padEnd(20)} ₽${item.price}`);
        }
        console.log('');

        console.log('✅ Import complete!\n');

    } catch (error) {
        console.error('❌ Error during import:', error);
        throw error;
    } finally {
        db.close();
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = { main };
