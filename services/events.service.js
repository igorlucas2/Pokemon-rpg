/**
 * Serviço de Eventos
 * Gerencia eventos do mundo, fases, e decisão de fala dos NPCs.
 */

const { getDb } = require("./db");

function isoNow() {
    // Ajuste de fuso horário simples (UTC -> local se necessário, aqui usa ISO UTC padrão)
    return new Date().toISOString();
}

/**
 * Retorna eventos ativos para uma região.
 */
function getActiveEvents(regionId, nowIso = isoNow()) {
    const db = getDb();
    // Busca eventos ativos ou agendados (que já começaram)
    // E que sejam públicos
    const stmt = db.prepare(`
    SELECT *
    FROM world_events
    WHERE region_id = ?
      AND status IN ('active','scheduled')
      AND starts_at <= ?
      AND ends_at >= ?
      AND visibility = 'public'
    ORDER BY priority DESC, starts_at ASC
  `);
    return stmt.all(regionId, nowIso, nowIso);
}

/**
 * Retorna a fase atual de um evento.
 */
function getCurrentPhase(eventId, nowIso = isoNow()) {
    const db = getDb();
    const stmt = db.prepare(`
    SELECT *
    FROM world_event_phases
    WHERE event_id = ?
      AND starts_at <= ?
      AND ends_at >= ?
    ORDER BY starts_at DESC
    LIMIT 1
  `);
    return stmt.get(eventId, nowIso, nowIso) || null;
}

/**
 * Busca a política do NPC para um conjunto de tags.
 */
function getNpcPolicyForTags(npcId, tags) {
    const db = getDb();
    if (!tags || tags.length === 0) return [];

    const placeholders = tags.map(() => '?').join(',');
    const stmt = db.prepare(`
    SELECT tag, interest, tone, comment_chance
    FROM npc_event_policy
    WHERE npc_id = ?
      AND tag IN (${placeholders})
  `);
    return stmt.all(npcId, ...tags);
}

/**
 * Verifica histórico de exposição do jogador ao evento por este NPC.
 */
function getExposure(playerId, npcId, eventId) {
    const db = getDb();
    const stmt = db.prepare(`
    SELECT *
    FROM player_event_exposure
    WHERE player_id = ? AND npc_id = ? AND event_id = ?
  `);
    return stmt.get(playerId, npcId, eventId) || null;
}

/**
 * Registra que o NPC mencionou o evento para o jogador.
 */
function recordEventMention(playerId, npcId, eventId, phaseId = null, nowIso = isoNow()) {
    const db = getDb();
    const existing = getExposure(playerId, npcId, eventId);

    if (!existing) {
        const ins = db.prepare(`
      INSERT INTO player_event_exposure
        (player_id, npc_id, event_id, first_mentioned_at, last_mentioned_at, mention_count, last_phase_id)
      VALUES (?, ?, ?, ?, ?, 1, ?)
    `);
        ins.run(playerId, npcId, eventId, nowIso, nowIso, phaseId);
        return;
    }

    const upd = db.prepare(`
    UPDATE player_event_exposure
    SET last_mentioned_at = ?,
        mention_count = mention_count + 1,
        last_phase_id = COALESCE(?, last_phase_id)
    WHERE player_id = ? AND npc_id = ? AND event_id = ?
  `);
    upd.run(nowIso, phaseId, playerId, npcId, eventId);
}

// Utilitários matemáticos
function clamp01(x) { return Math.max(0, Math.min(1, x)); }
function avg(arr) { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0; }
function safeParseJsonArray(str) {
    try {
        const v = JSON.parse(str || '[]');
        return Array.isArray(v) ? v : [];
    } catch { return []; }
}

/**
 * Decide se o NPC deve mencionar espontaneamente o evento.
 */
function shouldMentionEvent({ playerId, npcId, event, phase, nowIso = isoNow(), cooldownMinutes = 30 }) {
    const exposure = getExposure(playerId, npcId, event.event_id);
    const tags = safeParseJsonArray(event.tags_json);
    const policyRows = getNpcPolicyForTags(npcId, tags);

    // Score de interesse
    const interestSum = policyRows.reduce((acc, r) => acc + (r.interest || 0), 0);

    // Chance base
    const baseChance =
        policyRows.length > 0
            ? clamp01(avg(policyRows.map(r => r.comment_chance)))
            : (event.priority >= 8 ? 0.35 : 0.10); // Se for urgente, chance maior mesmo sem policy

    // Ajuste
    let chance = baseChance;
    chance += (interestSum * 0.06);
    chance += ((event.priority - 5) * 0.03);

    chance = clamp01(chance);

    // Regra de repetição
    if (exposure) {
        const last = Date.parse(exposure.last_mentioned_at);
        const now = Date.parse(nowIso);
        const minutes = (now - last) / 60000;

        const phaseChanged = (phase?.phase_id && exposure.last_phase_id && phase.phase_id !== exposure.last_phase_id)
            || (phase?.phase_id && !exposure.last_phase_id);

        // Se a fase não mudou e está no cooldown, silêncio
        if (!phaseChanged && minutes < cooldownMinutes) {
            return { ok: false, reason: 'cooldown', chance, interestSum };
        }
    }

    // Sorteio
    const roll = Math.random();
    const ok = roll < chance;

    return { ok, reason: ok ? 'roll_pass' : 'roll_fail', chance, interestSum };
}

/**
 * Retorna lista enriquecida com policy e fase para injetar no prompt do LLM.
 */
function getRelevantEventsForNpc({ npcId, playerId, regionId, nowIso = isoNow(), limit = 3 }) {
    const events = getActiveEvents(regionId, nowIso);

    const enriched = events.map(ev => {
        const phase = getCurrentPhase(ev.event_id, nowIso);
        const tags = safeParseJsonArray(ev.tags_json);
        const policy = getNpcPolicyForTags(npcId, tags);

        // Determina tom predominante
        let tone = 'neutral';
        if (policy.length) {
            // Pega o tom do maior interesse
            const best = [...policy].sort((a, b) => (b.interest || 0) - (a.interest || 0))[0];
            tone = best.tone || 'neutral';
        }

        return { event: ev, phase, tone, tags, policy };
    });

    // Ordena: prioridade > data de início
    enriched.sort((a, b) => (b.event.priority - a.event.priority) || (a.event.starts_at.localeCompare(b.event.starts_at)));

    return enriched.slice(0, limit);
}

module.exports = {
    getActiveEvents,
    getCurrentPhase,
    getRelevantEventsForNpc,
    shouldMentionEvent,
    recordEventMention
};
