const OVERWORLD_SPRITES = [
  { id: "boy", label: "Boy", file: "boy.png" },
  { id: "red", label: "Red", file: "red_normal.png" },
  { id: "green", label: "Green", file: "green_normal.png" },
  { id: "cooltrainer_m", label: "Cooltrainer (M)", file: "cooltrainer_m.png" },
  { id: "cooltrainer_f", label: "Cooltrainer (F)", file: "cooltrainer_f.png" },
  { id: "lass", label: "Lass", file: "lass.png" },
  { id: "youngster", label: "Youngster", file: "youngster.png" },
  { id: "bug_catcher", label: "Bug Catcher", file: "bug_catcher.png" },
  { id: "hiker", label: "Hiker", file: "hiker.png" },
  { id: "biker", label: "Biker", file: "biker.png" },
  { id: "policeman", label: "Policial", file: "policeman.png" },
  { id: "scientist", label: "Cientista", file: "scientist.png" },
  { id: "nurse", label: "Enfermeira", file: "nurse.png" },
  { id: "woman_1", label: "Mulher", file: "woman_1.png" },
  { id: "little_boy", label: "Menino", file: "little_boy.png" },
  { id: "little_girl", label: "Menina", file: "little_girl.png" },
];

function listOverworldSprites() {
  return OVERWORLD_SPRITES.slice();
}

function getOverworldSpriteById(id) {
  const key = String(id || "").trim();
  if (!key) return null;
  return OVERWORLD_SPRITES.find((s) => s.id === key) || null;
}

function isValidOverworldSpriteId(id) {
  return Boolean(getOverworldSpriteById(id));
}

module.exports = {
  OVERWORLD_SPRITES,
  listOverworldSprites,
  getOverworldSpriteById,
  isValidOverworldSpriteId,
};
