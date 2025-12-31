/**
 * Migration: AI Story & NPCs
 * 
 * Cria as tabelas para o sistema de IA e popula a tabela de NPCs
 * usando os dados já extraídos dos mapas JSON.
 */

const fs = require("fs");
const path = require("path");
const { getDb } = require("../services/db");

// Diretório onde estão os mapas JSON
const MAPS_DIR = path.join(__dirname, "..", "core", "mapas");

function migrateAiStory() {
  const db = getDb();
  console.log(">> Iniciando migração de IA e Enredo...");

  try {
    // ---------------------------------------------------------
    // 1. Criar Tabelas
    // ---------------------------------------------------------

    // REGIONS
    db.exec(`
      CREATE TABLE IF NOT EXISTS regions (
        region_id      TEXT PRIMARY KEY,
        name           TEXT NOT NULL,
        timezone       TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
        lore_summary   TEXT NOT NULL DEFAULT '',
        map_image      TEXT,
        created_at     TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    // WORLD EVENTS
    db.exec(`
      CREATE TABLE IF NOT EXISTS world_events (
        event_id       TEXT PRIMARY KEY,
        region_id      TEXT NOT NULL,
        title          TEXT NOT NULL,
        description    TEXT NOT NULL DEFAULT '',
        starts_at      TEXT NOT NULL,
        ends_at        TEXT NOT NULL,
        priority       INTEGER NOT NULL DEFAULT 5,
        visibility     TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','rumor','secret')),
        tags_json      TEXT NOT NULL DEFAULT '[]',
        status         TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','active','ended','cancelled')),
        created_by     TEXT NOT NULL DEFAULT 'system',
        created_at     TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (region_id) REFERENCES regions(region_id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_world_events_region_time ON world_events(region_id, starts_at, ends_at, status);
      CREATE INDEX IF NOT EXISTS idx_world_events_status ON world_events(status);
    `);

    // EVENT PHASES
    db.exec(`
      CREATE TABLE IF NOT EXISTS world_event_phases (
        phase_id       TEXT PRIMARY KEY,
        event_id       TEXT NOT NULL,
        phase_name     TEXT NOT NULL,
        starts_at      TEXT NOT NULL,
        ends_at        TEXT NOT NULL,
        phase_notes    TEXT NOT NULL DEFAULT '',
        created_at     TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (event_id) REFERENCES world_events(event_id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_event_phases_event_time ON world_event_phases(event_id, starts_at, ends_at);
    `);

    // NPCS
    db.exec(`
      CREATE TABLE IF NOT EXISTS npcs (
        npc_id         TEXT PRIMARY KEY,
        region_id      TEXT NOT NULL,
        name           TEXT NOT NULL,
        role           TEXT NOT NULL DEFAULT '',
        sprite         TEXT,
        persona_prompt TEXT NOT NULL DEFAULT '',
        traits_json    TEXT NOT NULL DEFAULT '{}',
        created_at     TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (region_id) REFERENCES regions(region_id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_npcs_region ON npcs(region_id);
    `);

    // NPC POLICY
    db.exec(`
      CREATE TABLE IF NOT EXISTS npc_event_policy (
        npc_id         TEXT NOT NULL,
        tag            TEXT NOT NULL,
        interest       INTEGER NOT NULL DEFAULT 0,
        tone           TEXT NOT NULL DEFAULT 'neutral' CHECK (tone IN ('happy','neutral','annoyed','fearful','excited','serious')),
        comment_chance REAL NOT NULL DEFAULT 0.4,
        PRIMARY KEY (npc_id, tag),
        FOREIGN KEY (npc_id) REFERENCES npcs(npc_id) ON DELETE CASCADE
      );
    `);

    // PLAYER EXPOSURE
    db.exec(`
      CREATE TABLE IF NOT EXISTS player_event_exposure (
        player_id          TEXT NOT NULL,
        npc_id             TEXT NOT NULL,
        event_id           TEXT NOT NULL,
        first_mentioned_at TEXT NOT NULL DEFAULT (datetime('now')),
        last_mentioned_at  TEXT NOT NULL DEFAULT (datetime('now')),
        mention_count      INTEGER NOT NULL DEFAULT 1,
        last_phase_id      TEXT,
        PRIMARY KEY (player_id, npc_id, event_id),
        FOREIGN KEY (npc_id) REFERENCES npcs(npc_id) ON DELETE CASCADE,
        FOREIGN KEY (event_id) REFERENCES world_events(event_id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_exposure_lookup ON player_event_exposure(player_id, npc_id, last_mentioned_at);
    `);

    console.log("✓ Tabelas de IA verificadas.");

    // ---------------------------------------------------------
    // 2. Popular Regions e NPCs (Seed)
    // ---------------------------------------------------------

    if (fs.existsSync(MAPS_DIR)) {
      const files = fs.readdirSync(MAPS_DIR).filter(f => f.endsWith(".json"));
      console.log(`>> Processando ${files.length} mapas para popular NPCs...`);

      // Verifica se a tabela regions tem a coluna map_image (migração manual)
      try {
        db.prepare("SELECT map_image FROM regions LIMIT 1").get();
      } catch (e) {
        console.log(">> Adicionando coluna 'map_image' em regions...");
        db.exec("ALTER TABLE regions ADD COLUMN map_image TEXT");
      }

      const insertRegion = db.prepare(`
        INSERT INTO regions (region_id, name, map_image) VALUES (?, ?, ?)
        ON CONFLICT(region_id) DO UPDATE SET 
            map_image=excluded.map_image,
            updated_at=datetime('now')
      `);

      // Atualiza colunas se não existirem (migration alter table manual s/ lib)
      try {
        db.prepare("SELECT sprite FROM npcs LIMIT 1").get();
      } catch (e) {
        console.log(">> Adicionando coluna 'sprite' em npcs...");
        db.exec("ALTER TABLE npcs ADD COLUMN sprite TEXT");
      }

      const insertNpc = db.prepare(`
        INSERT INTO npcs (npc_id, region_id, name, role, sprite) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(npc_id) DO UPDATE SET 
            sprite=excluded.sprite, 
            updated_at=datetime('now')
      `);

      let npcCount = 0;
      let regionCount = 0;

      for (const file of files) {
        try {
          const content = fs.readFileSync(path.join(MAPS_DIR, file), "utf-8");
          const mapData = JSON.parse(content);

          if (!mapData.id) continue;

          // Região = Mapa (simplificação inicial, pode agrupar depois se quiser ex: PalletTown-Room1 -> PalletTown)
          // Vamos tratar cada mapa como uma "região" técnica por enquanto.
          const regionId = mapData.id;
          const regionName = mapData.roomName || mapData.id;

          // Capturar imagem do mapa (fallback para mapa.png se nulo)
          const mapImage = mapData.image || "mapa.png";

          const info = insertRegion.run(regionId, regionName, mapImage);
          if (info.changes > 0) regionCount++;

          // NPCs
          if (Array.isArray(mapData.npcs)) {
            for (const npc of mapData.npcs) {
              if (!npc.id) continue;

              // Tenta inferir um nome amigável
              // Ex: "npc-PalletTown-0" -> "NPC 0"
              // Se tiver "meta.localId", usa ele.
              let name = "NPC";
              if (npc.meta && npc.meta.localId) {
                name = npc.meta.localId.replace("LOCALID_", "").replace(/_/g, " ");
                // Title case
                name = name.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
              } else {
                // Fallback para algo genérico
                name = `Habitante de ${regionName}`;
              }

              // Role
              let role = "citizen";
              if (name.includes("Prof")) role = "professor";
              if (name.includes("Nurse")) role = "nurse";
              if (name.includes("Clerk")) role = "clerk";
              if (name.includes("Sign")) role = "sign"; // placas as vezes são npcs no engine

              // Sprite
              const sprite = npc.sprite || null;

              // Se for "Sign", talvez não queiramos cadastrar como IA de chat?
              // Por enquanto cadastra tudo, depois filtra.

              const npcInfo = insertNpc.run(npc.id, regionId, name, role, sprite);
              if (npcInfo.changes > 0) npcCount++;
            }
          }

        } catch (err) {
          console.error(`Erro ao processar mapa ${file}:`, err);
        }
      }

      console.log(`✓ Seed concluído: ${regionCount} novas regiões, ${npcCount} novos NPCs inseridos.`);
    }

  } catch (err) {
    console.error("✗ Falha na migração de IA:", err);
  }
}

module.exports = { migrateAiStory };
