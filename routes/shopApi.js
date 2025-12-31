const express = require("express");
const router = express.Router();

const cache = new Map(); // cache simples em memória

// Itens clássicos de loja (preços base inspirados nos jogos)
const CLASSIC_SHOP_ITEMS = [
  { name: "poke-ball", price: 200 },
  { name: "great-ball", price: 600 },
  { name: "ultra-ball", price: 1200 },
  { name: "potion", price: 300 },
  { name: "super-potion", price: 700 },
  { name: "hyper-potion", price: 1200 },
  { name: "max-potion", price: 2500 },
  { name: "revive", price: 1500 },
  { name: "max-revive", price: 4000 },
  { name: "antidote", price: 100 },
  { name: "paralyze-heal", price: 200 },
  { name: "burn-heal", price: 250 },
  { name: "ice-heal", price: 250 },
  { name: "awakening", price: 250 },
  { name: "full-heal", price: 600 },
  { name: "escape-rope", price: 550 },
  { name: "repel", price: 350 },
  { name: "super-repel", price: 500 },
  { name: "max-repel", price: 700 },
];

function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: "not_authenticated" });
  next();
}

function pickEnglishText(arr, pick) {
  if (!Array.isArray(arr)) return null;
  const en = arr.find((x) => x?.language?.name === "en");
  const val = en ? pick(en) : null;
  if (!val) return null;
  return String(val).replaceAll("\n", " ").replaceAll("\f", " ").trim();
}

router.get("/items", requireAuth, async (req, res) => {
  const limit = Math.max(1, Math.min(Number(req.query.limit || 24), CLASSIC_SHOP_ITEMS.length));
  const offset = Math.max(0, Number(req.query.offset || 0));

  const key = `classic_items:${limit}:${offset}`;
  if (cache.has(key)) return res.json(cache.get(key));

  try {
    const slice = CLASSIC_SHOP_ITEMS.slice(offset, offset + limit);

    const details = await Promise.all(
      slice.map(async (it) => {
        const dResp = await fetch(`https://pokeapi.co/api/v2/item/${encodeURIComponent(it.name)}`);
        if (!dResp.ok) return null;
        const d = await dResp.json();

        const description =
          pickEnglishText(d.effect_entries, (x) => x.short_effect || x.effect) ||
          pickEnglishText(d.flavor_text_entries, (x) => x.text) ||
          "Sem descrição.";

        return {
          id: d.id,
          name: d.name,
          category: d.category?.name || null,
          price: Number(it.price),
          description,
          icon: d.sprites?.default || null,
        };
      })
    );

    const out = {
      count: CLASSIC_SHOP_ITEMS.length,
      nextOffset: Math.min(offset + limit, CLASSIC_SHOP_ITEMS.length),
      prevOffset: Math.max(offset - limit, 0),
      results: details.filter(Boolean),
    };

    cache.set(key, out);
    res.json(out);
  } catch {
    res.status(500).json({ error: "internal_error" });
  }
});

module.exports = router;
