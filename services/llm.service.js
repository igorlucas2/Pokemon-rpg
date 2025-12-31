/**
 * Serviço de LLM
 * Integração com Ollama para gerar diálogos de NPCs.
 */

const { getDb } = require("./db");
const { getRelevantEventsForNpc, shouldMentionEvent, recordEventMention } = require("./events.service");

// Configurações do .env
const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "gemma3:4b";

/**
 * Busca dados do NPC e constrói o prompt.
 */
async function generateNpcResponse({ npcId, playerId, playerMessage, regionId }) {
    const db = getDb();

    // 1. Buscar dados do NPC
    const npc = db.prepare("SELECT * FROM npcs WHERE npc_id = ?").get(npcId);
    if (!npc) throw new Error("NPC not found");

    // 2. Buscar dados do Jogador
    const player = db.prepare("SELECT name FROM users WHERE id = ?").get(playerId); // assumindo playerId = user.id (int) ou mapeado
    const playerName = player ? player.name : "Viajante";

    // 3. Buscar eventos relevantes
    // Se regionId não vier, usa a do NPC
    const targetRegion = regionId || npc.region_id;
    const usefulEvents = getRelevantEventsForNpc({ npcId, playerId, regionId: targetRegion, limit: 3 });

    // 4. Construir Bloco de Eventos (Memória de Curto Prazo)
    let eventContext = "";
    if (usefulEvents.length > 0) {
        const lines = [];
        for (const item of usefulEvents) {
            // Verifica se o NPC *quer* falar sobre isso (policy check na hora de 'lembrar')
            // Aqui usamos shouldMentionEvent apenas para saber se ele "sabe/se importa"
            // Não bloqueamos totalmente por cooldown aqui, pois o usuário pode ter perguntado especificamente.
            // Mas podemos marcar visualmente para o LLM.

            const evt = item.event;
            const phase = item.phase;

            lines.push(`- [Evento: ${evt.title}] (${phase ? phase.phase_name : 'Ativo'}). O que eu sei: ${phase ? phase.phase_notes : evt.description}. Minha atitude: ${item.tone}.`);

            // Se o NPC falar disso, registraremos depois? 
            // Idealmente o LLM retorna se usou o evento, mas simplificaremos:
            // Se o evento está no prompt, consideramos que ele "sabe".
            // O registro de menção (recordEventMention) deve ser feito se o LLM de fato falar.
            // Por simplicidade, vamos registrar que ele "pensou" sobre isso se for muito relevante.
        }
        if (lines.length > 0) {
            eventContext = `
Fatos que estão acontecendo agora na região (Você PODE comentar se for natural):
${lines.join("\n")}
`;
        }
    }

    // 5. Montar System Prompt
    const systemPrompt = `
Você é ${npc.name}, um(a) ${npc.role} em ${targetRegion}.
Sua personalidade: ${npc.persona_prompt || "Amigável e prestativo, mas focado no seu trabalho."}
Traços: ${npc.traits_json}.

Você está conversando com ${playerName}.
Responda de forma curta (máximo 2 frases), imersiva e natural.
Fale como um personagem de RPG (Pokémon FireRed). Não mencione que é uma IA.

${eventContext}

Histórico recente:
(O jogador acabou de falar algo, responda diretamente).
`.trim();

    // 6. Chamada ao Ollama
    try {
        const payload = {
            model: OLLAMA_MODEL,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: playerMessage }
            ],
            stream: false,
            options: {
                temperature: 0.7,
                num_predict: 100 // Respostas curtas
            }
        };

        const response = await fetch(`${OLLAMA_URL}/api/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!data || !data.message) {
            throw new Error("Invalid response from Ollama");
        }

        const replyText = data.message.content;

        // 7. Pós-processamento simples
        // Se a resposta contiver menção a eventos, poderíamos tentar detectar para registrar o 'recordEventMention'.
        // Por enquanto, vamos registrar a exposição para TODOS os eventos do contexto se o NPC responder.
        // Isso é "seguro" para evitar repetição (considera que se ele tinha na cabeça, pode ter falado).
        // Ou melhor: Só registramos se o 'comment_chance' for alto. 
        // Vamos simplificar: registrar menção para o evento de maior prioridade se houver.
        if (usefulEvents.length > 0) {
            const topEvent = usefulEvents[0];
            // Só registra se de fato havia chance de falar (policy check original)
            // Para não "queimar" o evento se o NPC ignorou.
            // Mas como é complexo parsear o texto, vamos deixar o registro manual ou assumir que falou se o player perguntou.
            // (Futuro: tool calling para o NPC marcar "falei_sobre(evento_id)")
        }

        return { response: replyText, npcName: npc.name };

    } catch (err) {
        console.error("LLM Error:", err);
        return { response: "...", error: true }; // Fallback silencioso
    }
}

module.exports = { generateNpcResponse };
