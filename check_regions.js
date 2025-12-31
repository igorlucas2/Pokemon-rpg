const { getDb } = require("./services/db");
const db = getDb();
const rows = db.prepare("SELECT region_id, name FROM regions LIMIT 10").all();
console.log(rows);
