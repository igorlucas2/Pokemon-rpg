(() => {
  const body = document.body;
  const playerName = String(body?.dataset?.playerName || "").trim();
  const spriteId = String(body?.dataset?.overworldSprite || "").trim();

  // Dados (vêm do EJS; não executa JS, só JSON)
  const dataEl = document.getElementById("overworldSpritesData");
  let list = [];
  try {
    list = JSON.parse(dataEl?.textContent || "[]");
  } catch {
    list = [];
  }

  const byId = {};
  for (const s of Array.isArray(list) ? list : []) {
    const id = String(s?.id || "").trim();
    const file = String(s?.file || "").trim();
    if (!id || !file) continue;
    byId[id] = { id, label: String(s?.label || id), file };
  }

  window.OVERWORLD_SPRITES = byId;

  const CORE_CONFIG = window.CORE_CONFIG || {};
  const root = String(CORE_CONFIG.pokefireredRoot || "/core/pokefirered-master/pokefirered-master");

  const pick = byId[spriteId] || byId.boy || null;
  const file = pick?.file || "boy.png";
  const src = `${root}/graphics/object_events/pics/people/${file}`;

  if (!window.WORLD) return;

  window.WORLD.player = Object.assign({}, window.WORLD.player, {
    name: playerName || window.WORLD.player?.name || "Jogador",
    sprite: {
      sheet: {
        preset: "pokefirered-standard",
        src,
        frameWidth: 16,
        frameHeight: 32,
      },
      targetHeightTiles: 2,
    },
  });
})();
