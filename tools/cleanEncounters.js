const { getDb } = require('../services/db');

const db = getDb();

console.log('🗑️  Limpando encontros antigos...');

// Delete all old encounters
const result = db.prepare('DELETE FROM wild_encounters').run();

console.log(`✅ ${result.changes} encontros removidos`);
console.log('✅ Banco limpo! Agora execute: node tools/importFireRedEncounters.js');
