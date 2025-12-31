/**
 * Update Item Icons
 * 
 * Updates the icon_url field in items table using PokeAPI format
 */

const { getDb } = require('../services/db');

function formatItemName(itemId) {
    // ITEM_POKE_BALL -> poke-ball
    // ITEM_POTION -> potion
    return itemId
        .replace(/^ITEM_/, '')
        .toLowerCase()
        .replace(/_/g, '-');
}

function main() {
    console.log('🔄 Updating item icons...');

    const db = getDb();
    const items = db.prepare('SELECT item_id FROM items').all();

    const updateStmt = db.prepare(`
    UPDATE items 
    SET icon_url = ? 
    WHERE item_id = ?
  `);

    const transaction = db.transaction(() => {
        let count = 0;
        for (const item of items) {
            const slug = formatItemName(item.item_id);
            // PokeAPI sprite URL
            const iconUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${slug}.png`;

            updateStmt.run(iconUrl, item.item_id);
            count++;
        }
        console.log(`✅ Updated ${count} items`);
    });

    try {
        transaction();

        // Verify a few
        const sample = db.prepare('SELECT name, icon_url FROM items LIMIT 3').all();
        console.log('\nSample updates:');
        sample.forEach(s => console.log(`- ${s.name}: ${s.icon_url}`));

    } catch (error) {
        console.error('❌ Error updating icons:', error);
    }
}

main();
