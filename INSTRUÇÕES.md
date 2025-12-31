# Instruções do Projeto - RPG Pokémon

## 📋 Visão Geral do Sistema de IA e Eventos

Este documento contém as instruções completas para o sistema de IA e eventos do jogo, incluindo:
- Sistema de eventos do mundo
- Comportamento de NPCs
- Integração com LLM (Ollama)
- Estrutura do banco de dados

---

## 🌍 Conceitos Principais

### 1. Eventos do Mundo
O mundo (região/cidade) possui eventos objetivos (ex: "chegada do Papai Noel hoje").

### 2. Personalidade dos NPCs
Cada NPC tem personalidade + rotina (quem liga/quem odeia/quem trabalha/quem comenta).

### 3. Sistema de Memória
Cada jogador tem "o que já viu/foi dito" para evitar que NPCs repitam a mesma fala constantemente.

---

## 🗄️ Estrutura do Banco de Dados

### Tabela: `regions`
Representa cidade/região (Pewter City, Route 3, etc.)

```sql
CREATE TABLE IF NOT EXISTS regions (
  region_id      TEXT PRIMARY KEY,     -- ex: 'pewter_city'
  name           TEXT NOT NULL,         -- ex: 'Pewter City'
  timezone       TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  lore_summary   TEXT NOT NULL DEFAULT '',
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### Tabela: `world_events`
Evento do mundo vinculado a uma região (o "fato")

```sql
CREATE TABLE IF NOT EXISTS world_events (
  event_id       TEXT PRIMARY KEY,
  region_id      TEXT NOT NULL,
  title          TEXT NOT NULL,
  description    TEXT NOT NULL DEFAULT '',
  starts_at      TEXT NOT NULL,
  ends_at        TEXT NOT NULL,
  priority       INTEGER NOT NULL DEFAULT 5,    -- 0..10
  visibility     TEXT NOT NULL DEFAULT 'public' -- public|rumor|secret
                CHECK (visibility IN ('public','rumor','secret')),
  tags_json      TEXT NOT NULL DEFAULT '[]',
  status         TEXT NOT NULL DEFAULT 'scheduled'
                CHECK (status IN ('scheduled','active','ended','cancelled')),
  created_by     TEXT NOT NULL DEFAULT 'system',
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (region_id) REFERENCES regions(region_id) ON DELETE CASCADE
);
```

**Boa prática:** Evento é "o que acontece", não "o que o NPC pensa".

### Tabela: `world_event_phases`
Fases do evento (para parecer vivo)

```sql
CREATE TABLE IF NOT EXISTS world_event_phases (
  phase_id       TEXT PRIMARY KEY,
  event_id       TEXT NOT NULL,
  phase_name     TEXT NOT NULL,         -- ex: 'pre-chegada', 'chegada'
  starts_at      TEXT NOT NULL,
  ends_at        TEXT NOT NULL,
  phase_notes    TEXT NOT NULL DEFAULT '',
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (event_id) REFERENCES world_events(event_id) ON DELETE CASCADE
);
```

### Tabela: `npcs`

```sql
CREATE TABLE IF NOT EXISTS npcs (
  npc_id         TEXT PRIMARY KEY,      -- ex: 'pewter_mart_clerk'
  region_id      TEXT NOT NULL,
  name           TEXT NOT NULL,
  role           TEXT NOT NULL DEFAULT '',
  persona_prompt TEXT NOT NULL DEFAULT '',
  traits_json    TEXT NOT NULL DEFAULT '{}',
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (region_id) REFERENCES regions(region_id) ON DELETE CASCADE
);
```

### Tabela: `npc_event_policy`
Define como o NPC reage a tipos de evento

```sql
CREATE TABLE IF NOT EXISTS npc_event_policy (
  npc_id         TEXT NOT NULL,
  tag            TEXT NOT NULL,          -- ex: 'natal', 'perigo'
  interest       INTEGER NOT NULL DEFAULT 0,  -- -3..+3
  tone           TEXT NOT NULL DEFAULT 'neutral'
                CHECK (tone IN ('happy','neutral','annoyed','fearful','excited','serious')),
  comment_chance REAL NOT NULL DEFAULT 0.4,   -- 0..1
  PRIMARY KEY (npc_id, tag),
  FOREIGN KEY (npc_id) REFERENCES npcs(npc_id) ON DELETE CASCADE
);
```

**Exemplo:**
- Comerciante: promoção +3, multidão +2, perigo -2
- Guarda: perigo +3, multidão +2

### Tabela: `player_event_exposure`
Rastreia se o jogador já foi exposto ao evento por aquele NPC

```sql
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
```

**Regra:** Se `mention_count >= 1` e nada mudou no evento, NPC só volta a mencionar se:
- Jogador perguntar, OU
- Evento entrou em fase nova, OU
- Passou um tempo (cooldown)

---

## 💻 Implementação Node.js

### Instalação de Dependências

```bash
npm i better-sqlite3
```

### `services/db.js`

```javascript
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DB_PATH = process.env.SQLITE_PATH || path.join(__dirname, '..', 'db', 'game.sqlite');
const SCHEMA_PATH = path.join(__dirname, '..', 'db', 'schema.sql');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

function runSchema() {
  const database = getDb();
  const sql = fs.readFileSync(SCHEMA_PATH, 'utf-8');
  database.exec(sql);
}

function runSeed(seedPath) {
  const database = getDb();
  const sql = fs.readFileSync(seedPath, 'utf-8');
  database.exec(sql);
}

module.exports = { getDb, runSchema, runSeed, DB_PATH };
```

### `services/events.service.js`

Funções principais:
- `getActiveEvents(regionId, nowIso)`
- `getCurrentPhase(eventId, nowIso)`
- `getRelevantEventsForNpc(npcId, playerId, nowIso, limit)`
- `shouldMentionEvent(...)` (com cooldown + fase)
- `recordEventMention(...)`

```javascript
const { getDb } = require('./db');

function isoNow() {
  return new Date().toISOString();
}

function getActiveEvents(regionId, nowIso = isoNow()) {
  const db = getDb();
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

function shouldMentionEvent({ playerId, npcId, event, phase, nowIso = isoNow(), cooldownMinutes = 30 }) {
  const exposure = getExposure(playerId, npcId, event.event_id);
  const tags = safeParseJsonArray(event.tags_json);
  const policyRows = getNpcPolicyForTags(npcId, tags);

  const interestSum = policyRows.reduce((acc, r) => acc + (r.interest || 0), 0);
  const baseChance = policyRows.length > 0
    ? clamp01(avg(policyRows.map(r => r.comment_chance)))
    : (event.priority >= 8 ? 0.35 : 0.10);

  let chance = baseChance;
  chance += (interestSum * 0.06);
  chance += ((event.priority - 5) * 0.03);
  chance = clamp01(chance);

  if (exposure) {
    const last = Date.parse(exposure.last_mentioned_at);
    const now = Date.parse(nowIso);
    const minutes = (now - last) / 60000;

    const phaseChanged = (phase?.phase_id && exposure.last_phase_id && phase.phase_id !== exposure.last_phase_id)
      || (phase?.phase_id && !exposure.last_phase_id);

    if (!phaseChanged && minutes < cooldownMinutes) {
      return { ok: false, reason: 'cooldown', chance, interestSum };
    }
  }

  const roll = Math.random();
  const ok = roll < chance;

  return { ok, reason: ok ? 'roll_pass' : 'roll_fail', chance, interestSum };
}

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

module.exports = {
  getActiveEvents,
  getCurrentPhase,
  getRelevantEventsForNpc,
  shouldMentionEvent,
  recordEventMention
};
```

---

## 🎮 Integração com Chat/LLM

### Exemplo de Uso no `/chat`

```javascript
const { getRelevantEventsForNpc, shouldMentionEvent, recordEventMention } = require('../services/events.service');

const npcId = 'pewter_mart_clerk';
const regionId = 'pewter_city';
const playerId = req.body.playerId || 'player_test_001';

const relevant = getRelevantEventsForNpc({ npcId, playerId, regionId, limit: 3 });

let eventBlurb = '';
for (const r of relevant) {
  const decision = shouldMentionEvent({ 
    playerId, 
    npcId, 
    event: r.event, 
    phase: r.phase, 
    cooldownMinutes: 30 
  });
  
  if (decision.ok) {
    recordEventMention(playerId, npcId, r.event.event_id, r.phase?.phase_id || null);
    eventBlurb += `- ${r.event.title} (${r.phase?.phase_name || 'em andamento'}): ${r.phase?.phase_notes || r.event.description}\n`;
    break; // menciona 1 evento por vez
  }
}

const system = `
Você é o atendente do PokéMart de Pewter City e está trabalhando.
Se houver eventos locais, você pode comentá-los brevemente, se for natural.

EVENTOS LOCAIS (FATOS):
${eventBlurb || '(nenhum relevante agora)'}
`.trim();
```

---

## 📝 Exemplo Prático: "Chegada do Papai Noel"

### Configuração do Evento

```javascript
{
  title: "Chegada do Papai Noel",
  tags: ["natal", "multidão", "promoção"],
  phases: [
    { name: "pré-chegada", notes: "enfeites e música" },
    { name: "chegada", notes: "praça lotada" },
    { name: "pico", notes: "fila enorme, promoções" },
    { name: "encerramento", notes: "cidade mais calma" }
  ]
}
```

### Policy do Comerciante

```javascript
{
  npc_id: "pewter_mart_clerk",
  policies: [
    { tag: "natal", interest: +1, tone: "happy" },
    { tag: "promoção", interest: +3, tone: "excited" },
    { tag: "multidão", interest: +2, tone: "neutral" }
  ]
}
```

### Primeira Interação

**Jogador:** "Bom dia!"

**NPC:** "Bom dia! Hoje a praça vai ficar cheia — parece que o 'Papai Noel' chega mais tarde. Se for sair, leve algumas Potions… e olha, estamos com uma promo especial."

### Interações Subsequentes

Depois de já ter mencionado, o NPC **não repete**, a menos que:
- A fase mude para "chegada" (evento progrediu)
- O jogador pergunte diretamente
- Passe o tempo de cooldown (padrão: 30 minutos)

---

## ✅ Benefícios do Sistema

1. **Separação de Conceitos:** "Conhecimento local" fica separado de conversa
2. **Consistência:** NPC reage de forma consistente via policy (tags → interesse/tom)
3. **Sem Repetição:** Sistema de exposure evita falas repetitivas
4. **Mundo Dinâmico:** Eventos podem ser criados por script/GM e todos "sentem" o mundo mudar
5. **Escalabilidade:** Fácil adicionar novos eventos e NPCs sem modificar código

---

## 🔧 Inicialização

No `server.js`, após carregar dotenv:

```javascript
require('dotenv').config();

const path = require('path');
const { runSchema, runSeed } = require('./services/db');

runSchema();
runSeed(path.join(__dirname, 'db', 'seed.sql'));
```

---

## 📚 Referências Técnicas

- **Database:** SQLite3 com better-sqlite3
- **LLM:** Ollama (local)
- **Framework:** Express.js + Socket.io
- **Session:** express-session

---

*Última atualização: 2025-12-31*
