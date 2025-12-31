const express = require("express");
const router = express.Router();

const cache = new Map(); // cache simples em memória

const POKEDEX_MAX = 151;

function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: "not_authenticated" });
  next();
}

// function showdownGifUrl(id) {
//   return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/${id}.gif`;
// }

function getLocalSpriteUrl(name) {
  const n = String(name || "").toLowerCase().trim();
  // Ajuste para Nidoran (f/m) se necessário, conforme seus arquivos
  return `/assets/gen1_assets/normal-sprite/${n}.gif`;
}

// Fallback agora usa nomes em vez de IDs no URL, mas mantemos o objeto como referência
const STARTER_FALLBACK = {
  1: { id: 1, name: "bulbasaur", types: ["grass", "poison"], height: 7, weight: 69, abilities: ["overgrow", "chlorophyll"], stats: [{ name: "hp", value: 45 }, { name: "attack", value: 49 }, { name: "defense", value: 49 }, { name: "special-attack", value: 65 }, { name: "special-defense", value: 65 }, { name: "speed", value: 45 }], gif: getLocalSpriteUrl("bulbasaur") },
  4: { id: 4, name: "charmander", types: ["fire"], height: 6, weight: 85, abilities: ["blaze", "solar-power"], stats: [{ name: "hp", value: 39 }, { name: "attack", value: 52 }, { name: "defense", value: 43 }, { name: "special-attack", value: 60 }, { name: "special-defense", value: 50 }, { name: "speed", value: 65 }], gif: getLocalSpriteUrl("charmander") },
  7: { id: 7, name: "squirtle", types: ["water"], height: 5, weight: 90, abilities: ["torrent", "rain-dish"], stats: [{ name: "hp", value: 44 }, { name: "attack", value: 48 }, { name: "defense", value: 65 }, { name: "special-attack", value: 50 }, { name: "special-defense", value: 64 }, { name: "speed", value: 43 }], gif: getLocalSpriteUrl("squirtle") },
  25: { id: 25, name: "pikachu", types: ["electric"], height: 4, weight: 60, abilities: ["static", "lightning-rod"], stats: [{ name: "hp", value: 35 }, { name: "attack", value: 55 }, { name: "defense", value: 40 }, { name: "special-attack", value: 50 }, { name: "special-defense", value: 50 }, { name: "speed", value: 90 }], gif: getLocalSpriteUrl("pikachu") },
};

router.get("/list", requireAuth, async (req, res) => {
  const limitRaw = Math.min(Number(req.query.limit || 60), 200);
  const offsetRaw = Math.max(Number(req.query.offset || 0), 0);

  // Pokédex Kanto: apenas 151
  const offset = Math.min(offsetRaw, POKEDEX_MAX);
  const remaining = Math.max(POKEDEX_MAX - offset, 0);
  const limit = Math.max(Math.min(limitRaw, remaining), 0);

  const key = `list:${limit}:${offset}`;
  if (cache.has(key)) return res.json(cache.get(key));

  if (limit === 0) {
    const out = {
      count: POKEDEX_MAX,
      nextOffset: POKEDEX_MAX,
      prevOffset: Math.max(offset - limitRaw, 0),
      results: [],
    };
    cache.set(key, out);
    return res.json(out);
  }

  // 1) lista básica (limitada aos 151)
  const listResp = await fetch(`https://pokeapi.co/api/v2/pokemon?limit=${limit}&offset=${offset}`);
  const listData = await listResp.json();

  // 2) pega detalhes em paralelo (mas com moderação)
  const details = await Promise.all(
    listData.results.map(async (p) => {
      const dResp = await fetch(p.url);
      const d = await dResp.json();

      return {
        id: d.id,
        name: d.name,
        types: d.types.map(t => t.type.name),
        height: d.height,
        weight: d.weight,
        gif: getLocalSpriteUrl(d.name),
        artwork: d.sprites?.other?.["official-artwork"]?.front_default || null,
      };
    })
  );

  const out = {
    count: POKEDEX_MAX,
    nextOffset: Math.min(offset + limit, POKEDEX_MAX),
    prevOffset: Math.max(offset - limitRaw, 0),
    results: details,
  };

  cache.set(key, out);
  res.json(out);
});

router.get("/pokemon/:id", requireAuth, async (req, res) => {
  const idOrName = String(req.params.id || "").trim().toLowerCase();
  if (!idOrName) return res.status(400).json({ error: "missing_id" });

  const key = `pokemon:${idOrName}`;
  if (cache.has(key)) return res.json(cache.get(key));

  // Fallback rápido para starters (garante que o modal de criação funcione mesmo offline/sem api)
  if (STARTER_FALLBACK[idOrName]) return res.json(STARTER_FALLBACK[idOrName]);

  const dResp = await fetch(`https://pokeapi.co/api/v2/pokemon/${encodeURIComponent(idOrName)}`);
  if (!dResp.ok) return res.status(404).json({ error: "not_found" });
  const d = await dResp.json();

  const out = {
    id: d.id,
    name: d.name,
    types: d.types.map((t) => t.type.name),
    height: d.height,
    weight: d.weight,
    abilities: d.abilities.map((a) => a.ability.name),
    stats: d.stats.map((s) => ({ name: s.stat.name, value: s.base_stat })),
    gif: getLocalSpriteUrl(d.name),
    artwork: d.sprites?.other?.["official-artwork"]?.front_default || null,
  };

  cache.set(key, out);
  res.json(out);
});

module.exports = router;
