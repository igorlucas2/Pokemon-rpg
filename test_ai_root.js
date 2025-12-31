const { getActiveEvents, shouldMentionEvent, recordEventMention } = require("./services/events.service");
const { getDb } = require("./services/db");
const { migrateAiStory } = require("./store/aiStoryMigration");

// Mock de dados
const REGION_ID = "test_root_region";
const NPC_ID = "test_root_npc";
const PLAYER_ID = "test_player";

function runTest() {
    console.log(">> Testando Tabelas de IA (Root)...");

    // Garantir tabelas
    migrateAiStory();

    const db = getDb();

    // 1. Limpeza prévia
    try {
        db.prepare("DELETE FROM world_events WHERE region_id = ?").run(REGION_ID);
        db.prepare("DELETE FROM player_event_exposure WHERE player_id = ?").run(PLAYER_ID);
    } catch (e) { /* ignore if tables empty */ }

    // 2. Inserir Evento de Teste
    const eventId = "evt_root_invasion";

    try {
        db.prepare(`
      INSERT INTO regions (region_id, name) VALUES (?, ?) 
      ON CONFLICT(region_id) DO NOTHING
    `).run(REGION_ID, "Root Region");

        db.prepare(`
      INSERT INTO world_events (event_id, region_id, title, description, starts_at, ends_at, priority, tags_json, status, visibility)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
            eventId,
            REGION_ID,
            "Root Invasion",
            "Testing from root folder",
            "2020-01-01T00:00:00.000Z",
            "2099-12-31T23:59:59.000Z",
            8,
            JSON.stringify(["danger"]),
            "active",
            "public"
        );
        console.log("✓ Evento inserido.");
    } catch (e) {
        console.log("Evento já existe ou erro:", e.message);
    }

    // 3. Consultar Active Events
    const events = getActiveEvents(REGION_ID);
    if (events.length > 0 && events[0].event_id === eventId) {
        console.log("✓ getActiveEvents funcionou.");
    } else {
        console.error("✗ getActiveEvents falhou.", events);
    }

    // 4. Testar Should Mention
    const decision = shouldMentionEvent({
        playerId: PLAYER_ID,
        npcId: NPC_ID,
        event: events[0]
    });

    console.log("Decisão:", decision.ok ? "SIM" : "NÃO");

    const npcCount = db.prepare("SELECT COUNT(*) as c FROM npcs").get().c;
    console.log(`✓ Total de NPCs: ${npcCount}`);
}

runTest();
