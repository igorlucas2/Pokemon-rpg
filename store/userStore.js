const fs = require("fs");
const path = require("path");

const bcrypt = require("bcryptjs");
const Database = require("better-sqlite3");

const DATA_DIR = path.join(__dirname, "..", "data");
const DB_FILE = path.join(DATA_DIR, "users.sqlite");

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function openDb() {
  ensureDir();
  const db = new Database(DB_FILE);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}

const db = openDb();

function init() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      username TEXT,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'player',
      created_at TEXT NOT NULL,
      updated_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  `);

  // Migração (caso o DB já exista sem username)
  const cols = db.prepare("PRAGMA table_info(users)").all();
  const hasUsername = cols.some((c) => String(c.name).toLowerCase() === "username");
  if (!hasUsername) {
    db.exec(`
      ALTER TABLE users ADD COLUMN username TEXT;
    `);

    // Backfill simples: usa prefixo do email
    const rows = db.prepare("SELECT id, email FROM users WHERE username IS NULL OR username = ''").all();
    const update = db.prepare("UPDATE users SET username = ? WHERE id = ?");
    for (const r of rows) {
      const prefix = String(r.email || "user").split("@")[0] || "user";
      let candidate = sanitizeUsername(prefix);
      if (!candidate) candidate = `user${r.id}`;

      // garante unicidade
      let i = 0;
      while (db.prepare("SELECT 1 FROM users WHERE username = ? AND id != ?").get(candidate, r.id)) {
        i += 1;
        candidate = sanitizeUsername(`${prefix}${i}`) || `user${r.id}_${i}`;
      }

      update.run(candidate, r.id);
    }
  }

  // agora é seguro criar o índice em username
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username) WHERE username IS NOT NULL;");

  // seed mínimo (mantém compatibilidade)
  ensureUser({ email: "teste@teste.com", username: "teste", name: "Treinador(a)", password: "123", role: "player" });
  ensureUser({ email: "admin@poke.com", username: "admin", name: "Admin", password: "123", role: "admin" });
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function sanitizeName(name) {
  const s = String(name || "").trim();
  return s.slice(0, 60) || "Treinador(a)";
}

function sanitizeUsername(username) {
  const s = String(username || "").trim().toLowerCase();
  // letras/números/._- (padrão comum de jogos)
  const cleaned = s.replace(/[^a-z0-9._-]/g, "");
  return cleaned.slice(0, 24);
}

function ensureUser({ email, username, name, password, role }) {
  const e = normalizeEmail(email);
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(e);
  if (existing) return existing.id;

  const hash = bcrypt.hashSync(String(password || ""), 10);
  const now = new Date().toISOString();
  const uname = sanitizeUsername(username);
  const info = db
    .prepare(
      "INSERT INTO users(email,username,name,password_hash,role,created_at) VALUES (?,?,?,?,?,?)"
    )
    .run(e, uname || null, sanitizeName(name), hash, role || "player", now);

  return info.lastInsertRowid;
}

function getUserByEmail(email) {
  const e = normalizeEmail(email);
  return (
    db
      .prepare(
        "SELECT id,email,username,name,password_hash as passwordHash,role,created_at as createdAt FROM users WHERE email = ?"
      )
      .get(e) || null
  );
}

function getUserByUsername(username) {
  const u = sanitizeUsername(username);
  if (!u) return null;
  return (
    db
      .prepare(
        "SELECT id,email,username,name,password_hash as passwordHash,role,created_at as createdAt FROM users WHERE username = ?"
      )
      .get(u) || null
  );
}

function getUserByIdentifier(identifier) {
  const raw = String(identifier || "").trim();
  if (!raw) return null;
  if (raw.includes("@")) return getUserByEmail(raw);
  return getUserByUsername(raw);
}

function createUser({ email, username, name, password, role }) {
  const e = normalizeEmail(email);
  if (!e || !e.includes("@")) return { ok: false, error: "Email inválido." };

  const u = sanitizeUsername(username);
  if (!u || u.length < 3) return { ok: false, error: "Usuário inválido (mínimo 3)." };

  const pass = String(password || "");
  if (pass.length < 4) return { ok: false, error: "Senha muito curta (mínimo 4)." };

  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(e);
  if (existing) return { ok: false, error: "Este email já está cadastrado." };

  const existingU = db.prepare("SELECT id FROM users WHERE username = ?").get(u);
  if (existingU) return { ok: false, error: "Este usuário já está em uso." };

  const hash = bcrypt.hashSync(pass, 10);
  const now = new Date().toISOString();

  const info = db
    .prepare(
      "INSERT INTO users(email,username,name,password_hash,role,created_at) VALUES (?,?,?,?,?,?)"
    )
    .run(e, u, sanitizeName(name || u), hash, role || "player", now);

  const user = getUserByEmail(e);
  return { ok: true, user, id: info.lastInsertRowid };
}

function verifyUser(identifier, password) {
  const user = getUserByIdentifier(identifier);
  if (!user) return { ok: false, error: "Credenciais inválidas." };

  const ok = bcrypt.compareSync(String(password || ""), user.passwordHash);
  if (!ok) return { ok: false, error: "Credenciais inválidas." };

  return { ok: true, user };
}

function toSessionUser(userRow) {
  return {
    id: userRow.id,
    name: userRow.name,
    email: userRow.email,
    username: userRow.username || null,
    role: userRow.role || "player",
  };
}

init();

module.exports = {
  init,
  getUserByEmail,
  getUserByUsername,
  getUserByIdentifier,
  createUser,
  verifyUser,
  toSessionUser,
};
