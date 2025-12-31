const { generateNpcResponse } = require("./services/llm.service");
const { migrateAiStory } = require("./store/aiStoryMigration");
const { getDb } = require("./services/db");

// Mock de usuário
const MOCK_USER_ID = 999;
const MOCK_NPC_ID = "npc_test_llm";

async function runTest() {
    console.log(">> Testando Integração LLM...");

    // Garantir DB
    migrateAiStory();
    const db = getDb();

    // Criar usuário mock
    db.prepare("INSERT OR IGNORE INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)").run(
        MOCK_USER_ID, "tester@llm.com", "Mestre dos Testes", "hash", new Date().toISOString()
    );

    // Criar região mock (IMPORTANTE: Evita erro de FK)
    db.prepare("INSERT OR IGNORE INTO regions (region_id, name) VALUES (?, ?)").run("pallet_town", "Pallet Town");

    // Criar NPC mock
    db.prepare("INSERT OR REPLACE INTO npcs (npc_id, region_id, name, role, persona_prompt) VALUES (?, ?, ?, ?, ?)").run(
        MOCK_NPC_ID, "pallet_town", "Old Man", "Wise Elder", "You are a grumpy but kind old man who loves coffee."
    );

    console.log(">> Enviando mensagem para o Ollama...");
    const msg = "Bom dia! Você tem café?";

    try {
        const result = await generateNpcResponse({
            npcId: MOCK_NPC_ID,
            playerId: MOCK_USER_ID,
            playerMessage: msg,
            regionId: "pallet_town"
        });

        console.log("\n[RESPOSTA DO NPC]:", result.response);
        console.log("[NPC NAME]:", result.npcName);

        if (result.response && result.response.length > 0) {
            console.log("✓ Teste passou!");
        } else {
            console.error("✗ Resposta vazia?");
        }

    } catch (e) {
        console.error("✗ Erro no teste:", e);
    }
}

runTest();
