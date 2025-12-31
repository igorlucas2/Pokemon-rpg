const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const DATA_FILE = path.join(DATA_DIR, "map.json");

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function defaultState() {
  return {
    regions: [], // {id,name,type,shape,data,description,createdAt,createdBy}
    edges: [],   // {id,from,to,createdAt}
    events: []   // {id,regionId,name,eventType,payload,isActive,createdAt,createdBy}
  };
}

let state = defaultState();

function normalizeState(input) {
  const base = input && typeof input === "object" ? input : {};

  // Migração simples do formato antigo {version, markers}
  // markers podem ter {x,y,r,name,type,description,id}
  let regions = Array.isArray(base.regions) ? base.regions : null;
  if (!regions && Array.isArray(base.markers)) {
    regions = base.markers
      .map((m) => {
        const x = Number(m?.x);
        const y = Number(m?.y);
        const r = Number(m?.r);
        if (![x, y].every((n) => Number.isFinite(n))) return null;
        return {
          id: m?.id || uid("reg"),
          name: String(m?.name || "Nova Região").trim() || "Nova Região",
          type: m?.type || "route",
          shape: "circle",
          description: m?.description || "",
          data: { x, y, r: Number.isFinite(r) ? r : 0.03 },
          createdAt: m?.createdAt || new Date().toISOString(),
          createdBy: m?.createdBy || "migration",
        };
      })
      .filter(Boolean);
  }

  return {
    regions: (Array.isArray(regions) ? regions : []).map((r) => {
      const rr = r && typeof r === "object" ? r : {};
      const shape = rr.shape === "rect" ? "rect" : "circle";
      const data = rr.data && typeof rr.data === "object" ? rr.data : {};
      const style = rr.style && typeof rr.style === "object" ? rr.style : null;
      return {
        ...rr,
        shape,
        data,
        style: style || undefined,
      };
    }),
    edges: Array.isArray(base.edges) ? base.edges : [],
    events: Array.isArray(base.events) ? base.events : [],
  };
}

function load() {
  ensureDir();
  if (!fs.existsSync(DATA_FILE)) {
    state = defaultState();
    save();
    return state;
  }
  const raw = fs.readFileSync(DATA_FILE, "utf-8");
  try {
    state = normalizeState(JSON.parse(raw));
  } catch {
    state = defaultState();
    save();
  }
  return state;
}

function save() {
  ensureDir();
  fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2), "utf-8");
}

function uid(prefix = "id") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// -------- Regions --------
function listMap() {
  // garantia de shape
  state = normalizeState(state);
  return state;
}

function ensureDataFile() {
  ensureDir();
  if (!fs.existsSync(DATA_FILE)) {
    state = defaultState();
    save();
    return;
  }
  // também normaliza se existir
  load();
  save();
}

function readMap() {
  return listMap();
}

function writeMap(nextState) {
  state = normalizeState(nextState);
  save();
  return state;
}

function createRegion({ name, type, description, shape, data, style, createdBy }) {
  const region = {
    id: uid("reg"),
    name: name?.trim() || "Nova Região",
    type: type || "route",
    shape: shape === "rect" ? "rect" : "circle",
    description: description || "",
    data, // {x,y,r} normalizados (0..1)
    style: style || undefined,
    createdAt: new Date().toISOString(),
    createdBy: createdBy || "system",
  };
  state.regions.push(region);
  save();
  return region;
}

function updateRegion(id, patch) {
  const r = state.regions.find(x => x.id === id);
  if (!r) return null;
  Object.assign(r, patch, { updatedAt: new Date().toISOString() });
  save();
  return r;
}

function deleteRegion(id) {
  state.regions = state.regions.filter(x => x.id !== id);
  state.edges = state.edges.filter(e => e.from !== id && e.to !== id);
  state.events = state.events.filter(ev => ev.regionId !== id);
  save();
}

// -------- Edges --------
function createEdge({ from, to }) {
  if (!from || !to || from === to) return null;
  // evita duplicado (bidirecional simplificado)
  const exists = state.edges.some(e =>
    (e.from === from && e.to === to) || (e.from === to && e.to === from)
  );
  if (exists) return null;

  const edge = { id: uid("edge"), from, to, createdAt: new Date().toISOString() };
  state.edges.push(edge);
  save();
  return edge;
}

function deleteEdge(id) {
  state.edges = state.edges.filter(e => e.id !== id);
  save();
}

// -------- Events --------
function createEvent({ regionId, name, eventType, payload, isActive, createdBy }) {
  const ev = {
    id: uid("ev"),
    regionId,
    name: name?.trim() || "Novo Evento",
    eventType: eventType || "npc",
    payload: payload || {},
    isActive: isActive ?? true,
    createdAt: new Date().toISOString(),
    createdBy: createdBy || "system",
  };
  state.events.push(ev);
  save();
  return ev;
}

function toggleEvent(id, isActive) {
  const ev = state.events.find(x => x.id === id);
  if (!ev) return null;
  ev.isActive = !!isActive;
  ev.updatedAt = new Date().toISOString();
  save();
  return ev;
}

function updateEvent(id, patch) {
  const ev = state.events.find((x) => x.id === id);
  if (!ev) return null;

  const p = patch && typeof patch === "object" ? patch : {};

  if (typeof p.name === "string") {
    ev.name = p.name.trim() || ev.name;
  }

  if (typeof p.eventType === "string") {
    ev.eventType = p.eventType.trim() || ev.eventType;
  }

  if (p.payload && typeof p.payload === "object") {
    ev.payload = p.payload;
  }

  if (typeof p.isActive === "boolean") {
    ev.isActive = p.isActive;
  }

  if (p.regionId) {
    ev.regionId = String(p.regionId);
  }

  ev.updatedAt = new Date().toISOString();
  save();
  return ev;
}

// -------- Travel Rules --------
function canTravel(fromRegionId, toRegionId) {
  if (!fromRegionId || !toRegionId) return false;
  if (fromRegionId === toRegionId) return true;
  const edges = Array.isArray(state.edges) ? state.edges : [];
  return edges.some(e =>
    (e.from === fromRegionId && e.to === toRegionId) ||
    (e.from === toRegionId && e.to === fromRegionId)
  );
}

load();

module.exports = {
  listMap,
  createRegion,
  updateRegion,
  deleteRegion,
  createEdge,
  deleteEdge,
  createEvent,
  toggleEvent,
  updateEvent,
  canTravel,
  load,
  ensureDataFile,
  readMap,
  writeMap,
};
