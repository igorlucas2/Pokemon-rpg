const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const DATA_DIR = path.join(__dirname, "..", "data");
const DB_FILE = path.join(DATA_DIR, "users.sqlite");

function openDb() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new Database(DB_FILE);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}

const db = openDb();

function init() {
  // Tabela de saves de jogo
  db.exec(`
    CREATE TABLE IF NOT EXISTS game_saves (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE,
      map_id TEXT NOT NULL,
      position_x INTEGER NOT NULL,
      position_y INTEGER NOT NULL,
      facing TEXT NOT NULL DEFAULT 'down',
      timestamp INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_game_saves_user_id ON game_saves(user_id);
    CREATE INDEX IF NOT EXISTS idx_game_saves_updated_at ON game_saves(updated_at);
  `);

  // Tabela de checkpoints automáticos (para recuperação de falhas)
  db.exec(`
    CREATE TABLE IF NOT EXISTS game_checkpoints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      map_id TEXT NOT NULL,
      position_x INTEGER NOT NULL,
      position_y INTEGER NOT NULL,
      facing TEXT NOT NULL DEFAULT 'down',
      state TEXT NOT NULL DEFAULT 'idle',
      timestamp INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_game_checkpoints_user_id ON game_checkpoints(user_id);
    CREATE INDEX IF NOT EXISTS idx_game_checkpoints_created_at ON game_checkpoints(created_at);
  `);
}

/**
 * Salva o estado do jogo no banco de dados (persistente)
 * @param {number} userId - ID do usuário
 * @param {object} gameState - {mapId, position: {x, y, facing}, timestamp}
 * @returns {object} Dados salvos
 */
function saveGame(userId, gameState) {
  if (!userId || !gameState || !gameState.mapId) {
    throw new Error("userId e gameState.mapId são obrigatórios");
  }

  const now = new Date().toISOString();
  const mapId = String(gameState.mapId).trim();
  const position = gameState.position || { x: 0, y: 0, facing: "down" };
  const x = Number.isFinite(position.x) ? Math.trunc(position.x) : 0;
  const y = Number.isFinite(position.y) ? Math.trunc(position.y) : 0;
  const facing = String(position.facing || "down").toLowerCase();
  const timestamp = gameState.timestamp || Date.now();

  // Verifica se já existe save para este usuário
  const existing = db
    .prepare("SELECT id FROM game_saves WHERE user_id = ?")
    .get(userId);

  let result;
  if (existing) {
    // Atualiza save existente
    result = db
      .prepare(
        `UPDATE game_saves 
         SET map_id = ?, position_x = ?, position_y = ?, facing = ?, timestamp = ?, updated_at = ?
         WHERE user_id = ?`
      )
      .run(mapId, x, y, facing, timestamp, now, userId);

    console.log(`💾 Save atualizado para usuário ${userId} em ${mapId}`);
  } else {
    // Cria novo save
    result = db
      .prepare(
        `INSERT INTO game_saves(user_id, map_id, position_x, position_y, facing, timestamp, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(userId, mapId, x, y, facing, timestamp, now, now);

    console.log(`💾 Novo save criado para usuário ${userId} em ${mapId}`);
  }

  return {
    userId,
    mapId,
    position: { x, y, facing },
    timestamp,
    savedAt: now
  };
}

/**
 * Carrega o save do usuário
 * @param {number} userId - ID do usuário
 * @returns {object|null} Dados do save ou null se não existir
 */
function loadGame(userId) {
  if (!userId) return null;

  const save = db
    .prepare(
      `SELECT user_id, map_id, position_x, position_y, facing, timestamp, updated_at
       FROM game_saves
       WHERE user_id = ?`
    )
    .get(userId);

  if (!save) {
    console.log(`⚠️ Nenhum save encontrado para usuário ${userId}`);
    return null;
  }

  console.log(`✅ Save carregado para usuário ${userId}: ${save.map_id}`);

  return {
    mapId: save.map_id,
    position: {
      x: save.position_x,
      y: save.position_y,
      facing: save.facing
    },
    timestamp: save.timestamp,
    savedAt: save.updated_at
  };
}

/**
 * Cria um checkpoint automático (para recuperação de crashes)
 * @param {number} userId - ID do usuário
 * @param {object} gameState - {mapId, position: {x, y, facing}}
 * @param {string} state - Estado do jogo ('idle', 'battle', 'event')
 */
function createCheckpoint(userId, gameState, state = "idle") {
  if (!userId || !gameState || !gameState.mapId) {
    return false;
  }

  const mapId = String(gameState.mapId).trim();
  const position = gameState.position || { x: 0, y: 0, facing: "down" };
  const x = Number.isFinite(position.x) ? Math.trunc(position.x) : 0;
  const y = Number.isFinite(position.y) ? Math.trunc(position.y) : 0;
  const facing = String(position.facing || "down").toLowerCase();
  const now = new Date().toISOString();
  const timestamp = Date.now();

  db.prepare(
    `INSERT INTO game_checkpoints(user_id, map_id, position_x, position_y, facing, state, timestamp, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(userId, mapId, x, y, facing, String(state), timestamp, now);

  console.log(`📌 Checkpoint criado para usuário ${userId}: ${mapId} (estado: ${state})`);
  return true;
}

/**
 * Obtém o último checkpoint do usuário
 * @param {number} userId - ID do usuário
 * @returns {object|null} Dados do checkpoint ou null
 */
function getLastCheckpoint(userId) {
  if (!userId) return null;

  const checkpoint = db
    .prepare(
      `SELECT user_id, map_id, position_x, position_y, facing, state, created_at
       FROM game_checkpoints
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 1`
    )
    .get(userId);

  if (!checkpoint) {
    return null;
  }

  return {
    mapId: checkpoint.map_id,
    position: {
      x: checkpoint.position_x,
      y: checkpoint.position_y,
      facing: checkpoint.facing
    },
    state: checkpoint.state,
    createdAt: checkpoint.created_at
  };
}

/**
 * Limpa checkpoints antigos (mantém apenas os últimos 10 por usuário)
 * @param {number} userId - ID do usuário (opcional, se null limpa de todos)
 */
function cleanOldCheckpoints(userId = null) {
  let query;
  let params;

  if (userId) {
    query = `DELETE FROM game_checkpoints 
             WHERE user_id = ? AND id NOT IN (
               SELECT id FROM game_checkpoints 
               WHERE user_id = ? 
               ORDER BY created_at DESC 
               LIMIT 10
             )`;
    params = [userId, userId];
  } else {
    // Limpa checkpoints de todos os usuários que têm mais de 20
    query = `DELETE FROM game_checkpoints 
             WHERE id NOT IN (
               SELECT id FROM (
                 SELECT id FROM game_checkpoints 
                 ORDER BY user_id, created_at DESC 
                 LIMIT 20
               ) sub
             )`;
    params = [];
  }

  const result = db.prepare(query).run(...params);
  if (result.changes > 0) {
    console.log(`🧹 ${result.changes} checkpoints antigos removidos`);
  }
  return result.changes;
}

/**
 * Deleta o save de um usuário
 * @param {number} userId - ID do usuário
 */
function deleteGameSave(userId) {
  if (!userId) return false;

  const result = db.prepare("DELETE FROM game_saves WHERE user_id = ?").run(userId);
  console.log(`🗑️ Save deletado para usuário ${userId}`);
  return result.changes > 0;
}

/**
 * Obtém estatísticas de um save
 * @param {number} userId - ID do usuário
 * @returns {object} Estatísticas do save
 */
function getSaveStats(userId) {
  if (!userId) return null;

  const save = db
    .prepare(
      `SELECT map_id, position_x, position_y, created_at, updated_at
       FROM game_saves
       WHERE user_id = ?`
    )
    .get(userId);

  if (!save) return null;

  const checkpointCount = db
    .prepare("SELECT COUNT(*) as count FROM game_checkpoints WHERE user_id = ?")
    .get(userId).count;

  return {
    userId,
    mapId: save.map_id,
    position: { x: save.position_x, y: save.position_y },
    createdAt: save.created_at,
    lastSavedAt: save.updated_at,
    checkpointCount
  };
}

init();

module.exports = {
  init,
  saveGame,
  loadGame,
  createCheckpoint,
  getLastCheckpoint,
  cleanOldCheckpoints,
  deleteGameSave,
  getSaveStats
};
