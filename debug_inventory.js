const { getDb } = require('./services/db');
const db = getDb();

console.log('--- Checking Database State ---');

// Check player_inventory
try {
    const inventory = db.prepare('SELECT * FROM player_inventory').all();
    console.log(`\nPlayer Inventory (${inventory.length} items):`);
    inventory.forEach(item => {
        console.log(`- User ${item.user_id}: ${item.item_id} (Qty: ${item.quantity})`);
    });
} catch (e) {
    console.error('Error reading player_inventory:', e.message);
}

// Check items table count
try {
    const count = db.prepare('SELECT COUNT(*) as c FROM items').get();
    console.log(`\nItems in database: ${count.c}`);
} catch (e) {
    console.error('Error reading items:', e.message);
}

console.log('\n--- End Check ---');
