const Database = require("better-sqlite3");
const path = require("path");

const DB_PATH = path.join(__dirname, "data", "users.sqlite");
console.log("Opening DB at:", DB_PATH);

try {
    const db = new Database(DB_PATH, { readonly: true });

    const trainers = db.prepare("SELECT * FROM trainers").all();
    console.log(`\nFound ${trainers.length} trainers:`);
    trainers.forEach(t => console.log(`- ID: ${t.id}, UserID: ${t.user_id}, Name: ${t.name}`));

    const pokemons = db.prepare("SELECT * FROM trainer_pokemons").all();
    console.log(`\nFound ${pokemons.length} trainer_pokemons.`);

} catch (e) {
    console.error("Error reading DB:", e);
}
