const { getDb } = require('../services/db');

const db = getDb();
const maps = db.prepare('SELECT DISTINCT map_id FROM wild_encounters ORDER BY map_id LIMIT 20').all();

console.log('Primeiros 20 map_ids no banco:');
maps.forEach(m => console.log(`  - ${m.map_id}`));
