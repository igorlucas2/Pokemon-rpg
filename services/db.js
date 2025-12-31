const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");

const DATA_DIR = path.join(__dirname, "..", "data");
const DB_FILE = path.join(DATA_DIR, "users.sqlite");

let dbInstance = null;

function ensureDir() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
}

function getDb() {
    if (!dbInstance) {
        ensureDir();
        dbInstance = new Database(DB_FILE);
        dbInstance.pragma("journal_mode = WAL");
        dbInstance.pragma("foreign_keys = ON");
    }
    return dbInstance;
}

module.exports = {
    getDb,
    getDbPath: () => DB_FILE,
    getDataDir: () => DATA_DIR
};
