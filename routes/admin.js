const express = require("express");
const fs = require("fs");
const path = require("path");
const router = express.Router();

const mapStore = require("../store/mapStore");
const encountersAdmin = require("./admin/encountersAdmin");

// Se o seu server.js já aplica requireAuth/requireAdmin, pode remover esses dois,
// mas deixar aqui não atrapalha.
function requireAuth(req, res, next) {
  if (!req.session.user) return res.redirect("/login");
  next();
}
function requireAdmin(req, res, next) {
  if (req.session.user?.role !== "admin") return res.status(403).send("Acesso negado");
  next();
}

// helper: garante estrutura sempre válida
function safeMapState() {
  // mapStore pode ter listMap() (padrão que te passei) OU readMap()
  const state =
    (typeof mapStore.listMap === "function" ? mapStore.listMap() : null) ||
    (typeof mapStore.readMap === "function" ? mapStore.readMap() : null) ||
    {};

  return {
    regions: Array.isArray(state.regions) ? state.regions : [],
    edges: Array.isArray(state.edges) ? state.edges : [],
    events: Array.isArray(state.events) ? state.events : [],
  };
}

// ========================
// Página do editor
// ========================
router.get("/map", requireAuth, requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, "..", "core", "index.html"));
});

// ========================
// Salvar mapa do core (tiles)
// ========================
const CORE_MAPS_DIR = path.join(__dirname, "..", "core", "mapas");
function sanitizeFileName(name) {
  const base = String(name || "").trim();
  if (!base) return null;
  if (!/^[a-zA-Z0-9._-]+$/.test(base)) return null;
  return base.endsWith(".json") ? base : `${base}.json`;
}

router.post("/map/save", requireAuth, requireAdmin, (req, res) => {
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const map = body.map && typeof body.map === "object" ? body.map : null;
  const mapId = map?.id || body.mapId;
  if (!map || !mapId) return res.status(400).json({ ok: false, error: "missing_map" });

  const fileName = sanitizeFileName(body.fileName || `${mapId}.json`);
  if (!fileName) return res.status(400).json({ ok: false, error: "invalid_fileName" });

  const target = path.resolve(CORE_MAPS_DIR, fileName);
  if (!target.startsWith(CORE_MAPS_DIR)) {
    return res.status(400).json({ ok: false, error: "invalid_path" });
  }

  try {
    fs.mkdirSync(CORE_MAPS_DIR, { recursive: true });
    fs.writeFileSync(target, JSON.stringify(map, null, 2), "utf-8");
    return res.json({ ok: true, fileName });
  } catch (err) {
    return res.status(500).json({ ok: false, error: "write_failed" });
  }
});

// ========================
// CRUD Regions
// ========================
router.post("/regions", requireAuth, requireAdmin, (req, res) => {
  const { name, type, description, shape, data, style } = req.body || {};

  const shp = shape === "rect" ? "rect" : "circle";
  const d = data && typeof data === "object" ? data : null;
  const okCircle = d && [d.x, d.y, d.r].every((n) => typeof n === "number");
  const okRect = d && [d.x, d.y, d.w, d.h].every((n) => typeof n === "number");
  if ((shp === "circle" && !okCircle) || (shp === "rect" && !okRect)) {
    return res.status(400).json({ ok: false, error: "invalid_data" });
  }

  if (typeof mapStore.createRegion !== "function") {
    return res.status(500).json({ ok: false, error: "mapStore.createRegion_not_found" });
  }

  const region = mapStore.createRegion({
    name,
    type,
    description,
    shape: shp,
    data: d,
    style: style && typeof style === "object" ? style : undefined,
    createdBy: req.session.user?.name || "admin",
  });

  res.json({ ok: true, region });
});

router.put("/regions/:id", requireAuth, requireAdmin, (req, res) => {
  if (typeof mapStore.updateRegion !== "function") {
    return res.status(500).json({ ok: false, error: "mapStore.updateRegion_not_found" });
  }

  const updated = mapStore.updateRegion(req.params.id, req.body || {});
  if (!updated) return res.status(404).json({ ok: false, error: "not_found" });

  res.json({ ok: true, region: updated });
});

router.delete("/regions/:id", requireAuth, requireAdmin, (req, res) => {
  if (typeof mapStore.deleteRegion !== "function") {
    return res.status(500).json({ ok: false, error: "mapStore.deleteRegion_not_found" });
  }

  mapStore.deleteRegion(req.params.id);
  res.json({ ok: true });
});

// ========================
// Edges
// ========================
router.post("/edges", requireAuth, requireAdmin, (req, res) => {
  const { from, to } = req.body || {};

  if (typeof mapStore.createEdge !== "function") {
    return res.status(500).json({ ok: false, error: "mapStore.createEdge_not_found" });
  }

  const edge = mapStore.createEdge({ from, to });
  if (!edge) return res.status(400).json({ ok: false, error: "invalid_or_duplicate_edge" });

  res.json({ ok: true, edge });
});

router.delete("/edges/:id", requireAuth, requireAdmin, (req, res) => {
  if (typeof mapStore.deleteEdge !== "function") {
    return res.status(500).json({ ok: false, error: "mapStore.deleteEdge_not_found" });
  }

  mapStore.deleteEdge(req.params.id);
  res.json({ ok: true });
});

// ========================
// Events
// ========================
router.post("/events", requireAuth, requireAdmin, (req, res) => {
  const { regionId, name, eventType, payload, isActive } = req.body || {};
  if (!regionId) return res.status(400).json({ ok: false, error: "missing_regionId" });

  if (typeof mapStore.createEvent !== "function") {
    return res.status(500).json({ ok: false, error: "mapStore.createEvent_not_found" });
  }

  const ev = mapStore.createEvent({
    regionId,
    name,
    eventType,
    payload: payload || {},
    isActive: isActive ?? true,
    createdBy: req.session.user?.name || "admin",
  });

  res.json({ ok: true, event: ev });
});

router.put("/events/:id/toggle", requireAuth, requireAdmin, (req, res) => {
  const { isActive } = req.body || {};

  if (typeof mapStore.toggleEvent !== "function") {
    return res.status(500).json({ ok: false, error: "mapStore.toggleEvent_not_found" });
  }

  const ev = mapStore.toggleEvent(req.params.id, isActive);
  if (!ev) return res.status(404).json({ ok: false, error: "not_found" });

  res.json({ ok: true, event: ev });
});

router.put("/events/:id", requireAuth, requireAdmin, (req, res) => {
  if (typeof mapStore.updateEvent !== "function") {
    return res.status(500).json({ ok: false, error: "mapStore.updateEvent_not_found" });
  }

  const patch = req.body && typeof req.body === "object" ? req.body : {};
  const ev = mapStore.updateEvent(req.params.id, patch);
  if (!ev) return res.status(404).json({ ok: false, error: "not_found" });
  res.json({ ok: true, event: ev });
});

// ========================
// Wild Encounters Admin
// ========================
router.use("/encounters", requireAuth, requireAdmin, encountersAdmin);

module.exports = router;
