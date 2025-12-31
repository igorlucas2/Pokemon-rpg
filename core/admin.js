(() => {
  "use strict";

  const api = window.Game;
  if (!api) {
    return;
  }

  const mapSelect = document.getElementById("map-select");
  const selectedTileInput = document.getElementById("selected-tile");
  const statusEl = document.getElementById("io-status");
  const saveMapBtn = document.getElementById("save-map");
  const placementMode = document.getElementById("placement-mode");
  const toggleGrid = document.getElementById("toggle-grid");
  const toggleColliders = document.getElementById("toggle-colliders");
  const toggleEvents = document.getElementById("toggle-events");
  const toggleNpcs = document.getElementById("toggle-npcs");
  const overlayEl = document.getElementById("editor-overlay");

  const colliderForm = document.getElementById("collider-form");
  const colliderList = document.getElementById("collider-list");

  const eventForm = document.getElementById("event-form");
  const eventType = document.getElementById("event-type");
  const eventOnce = document.getElementById("event-once");
  const eventName = document.getElementById("event-name");
  const eventText = document.getElementById("event-text");
  const eventMessageWrap = document.getElementById("event-message-wrap");
  const eventTriggerWrap = document.getElementById("event-trigger-wrap");
  const eventTrigger = document.getElementById("event-trigger");
  const eventDoorWrap = document.getElementById("event-door-wrap");
  const eventDialogWrap = document.getElementById("event-dialog-wrap");
  const eventDialogName = document.getElementById("event-dialog-name");
  const eventDialogTextWrap = document.getElementById("event-dialog-text-wrap");
  const eventDialogText = document.getElementById("event-dialog-text");
  const eventServerWrap = document.getElementById("event-server-wrap");
  const eventPayload = document.getElementById("event-payload");
  const eventTargetMap = document.getElementById("event-target-map");
  const eventTargetX = document.getElementById("event-target-x");
  const eventTargetY = document.getElementById("event-target-y");
  const eventTargetFacing = document.getElementById("event-target-facing");
  const eventTargetUseSelection = document.getElementById("event-target-use-selection");
  const eventTargetUseSaved = document.getElementById("event-target-use-saved");
  const eventTargetStatus = document.getElementById("event-target-status");

  const npcForm = document.getElementById("npc-form");
  const npcId = document.getElementById("npc-id");
  const npcName = document.getElementById("npc-name");
  const npcDialog = document.getElementById("npc-dialog");
  const npcTrigger = document.getElementById("npc-trigger");
  const npcSolid = document.getElementById("npc-solid");
  const npcList = document.getElementById("npc-list");

  const dialogForm = document.getElementById("dialog-form");
  const dialogTitleInput = document.getElementById("dialog-title");
  const dialogTextInput = document.getElementById("dialog-text");

  const itemForm = document.getElementById("item-form");
  const itemId = document.getElementById("item-id");
  const itemName = document.getElementById("item-name");
  const itemDesc = document.getElementById("item-desc");
  const itemList = document.getElementById("item-list");
  const mapIdsList = document.getElementById("map-ids");

  const eventModal = document.getElementById("event-modal");
  const eventModalClose = document.getElementById("event-modal-close");
  const eventModalArea = document.getElementById("event-modal-area");
  const eventModalApplyArea = document.getElementById("event-modal-apply-area");
  const eventModalSave = document.getElementById("event-modal-save");
  const eventModalDelete = document.getElementById("event-modal-delete");
  const modalEventType = document.getElementById("modal-event-type");
  const modalEventOnce = document.getElementById("modal-event-once");
  const modalEventName = document.getElementById("modal-event-name");
  const modalEventTriggerWrap = document.getElementById("modal-event-trigger-wrap");
  const modalEventTrigger = document.getElementById("modal-event-trigger");
  const modalEventMessageWrap = document.getElementById("modal-event-message-wrap");
  const modalEventText = document.getElementById("modal-event-text");
  const modalEventDialogWrap = document.getElementById("modal-event-dialog-wrap");
  const modalEventDialogName = document.getElementById("modal-event-dialog-name");
  const modalEventDialogTextWrap = document.getElementById("modal-event-dialog-text-wrap");
  const modalEventDialogText = document.getElementById("modal-event-dialog-text");
  const modalEventServerWrap = document.getElementById("modal-event-server-wrap");
  const modalEventPayload = document.getElementById("modal-event-payload");
  const modalEventDoorWrap = document.getElementById("modal-event-door-wrap");
  const modalEventTargetMap = document.getElementById("modal-event-target-map");
  const modalEventTargetX = document.getElementById("modal-event-target-x");
  const modalEventTargetY = document.getElementById("modal-event-target-y");
  const modalEventTargetFacing = document.getElementById("modal-event-target-facing");
  const modalEventTargetUseSelection = document.getElementById("modal-event-target-use-selection");
  const modalEventTargetUseSaved = document.getElementById("modal-event-target-use-saved");
  const modalEventTargetStatus = document.getElementById("modal-event-target-status");

  const supportsDirAccess = typeof window.showDirectoryPicker === "function";
  const LOCAL_EDITS_PREFIX = "kanton.mapEdits.";
  let mapsDirectoryHandle = null;
  let selectedTile = { x: null, y: null };
  let selectedArea = null;
  let savedTeleportTarget = null;
  let activeModalEvent = null;
  let worldData = normalizeWorldData(window.WORLD || {});
  let activeMapId = worldData.activeMapId;
  const editorSettings = (window.EditorSettings = window.EditorSettings || {});
  const overlayState = {
    stage: null,
    layer: null,
    rect: null,
    dragging: false,
    startTile: null,
    lastTile: null,
    lastSyncKey: ""
  };

  if (typeof editorSettings.showGrid !== "boolean") {
    editorSettings.showGrid = true;
  }
  if (typeof editorSettings.showColliders !== "boolean") {
    editorSettings.showColliders = false;
  }
  if (typeof editorSettings.showEvents !== "boolean") {
    editorSettings.showEvents = true;
  }
  if (typeof editorSettings.showNpcs !== "boolean") {
    editorSettings.showNpcs = true;
  }
  if (!editorSettings.placementMode) {
    editorSettings.placementMode = "select";
  }

  function cloneData(data) {
    if (typeof structuredClone === "function") {
      try {
        return structuredClone(data);
      } catch (e) {
        // Fallback se falhar (ex: contém funções)
      }
    }
    return JSON.parse(JSON.stringify(data || {}));
  }

  function toNumber(value, fallback) {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
  }

  function toInt(value, fallback) {
    return Math.round(toNumber(value, fallback));
  }

  function toPositive(value, fallback) {
    const num = toInt(value, fallback);
    return num > 0 ? num : fallback;
  }

  function slugifyName(value) {
    const base = (value || "").toString().toLowerCase().trim();
    const slug = base.replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    return slug || "auto";
  }

  function createId(prefix, name) {
    const stamp = Date.now().toString(36);
    const slug = slugifyName(name);
    return prefix + "-" + slug + "-" + stamp;
  }

  const SERVER_EVENT_TYPES = new Set(["pokecenter", "pokemon_hunt", "battle"]);
  function isServerEventType(type) {
    return SERVER_EVENT_TYPES.has(String(type || "").trim());
  }

  function parseEventPayload(raw, setError) {
    const src = String(raw || "").trim();
    if (!src) return {};
    try {
      const out = JSON.parse(src);
      return out && typeof out === "object" ? out : {};
    } catch (err) {
      if (typeof setError === "function") setError("Payload JSON invÃ¡lido.");
      return null;
    }
  }

  function setStatus(message, isError) {
    statusEl.textContent = message || "";
    statusEl.style.color = isError ? "#ffb0b0" : "";
  }

  function applyEditorSettingsToUI() {
    if (placementMode) {
      placementMode.value = editorSettings.placementMode;
    }
    if (toggleGrid) {
      toggleGrid.checked = editorSettings.showGrid;
    }
    if (toggleColliders) {
      toggleColliders.checked = editorSettings.showColliders;
    }
    if (toggleEvents) {
      toggleEvents.checked = editorSettings.showEvents;
    }
    if (toggleNpcs) {
      toggleNpcs.checked = editorSettings.showNpcs;
    }
  }

  function updateEditorSettings() {
    if (placementMode) {
      editorSettings.placementMode = placementMode.value;
    }
    if (toggleGrid) {
      editorSettings.showGrid = toggleGrid.checked;
    }
    if (toggleColliders) {
      editorSettings.showColliders = toggleColliders.checked;
    }
    if (toggleEvents) {
      editorSettings.showEvents = toggleEvents.checked;
    }
    if (toggleNpcs) {
      editorSettings.showNpcs = toggleNpcs.checked;
    }
  }

  function normalizeWorldData(data) {
    const world = cloneData(data || {});
    if (!world.view) {
      world.view = { tilesX: 35, tilesY: 20, scale: 2.5 };
    }
    if (!Array.isArray(world.items)) {
      world.items = [];
    }
    if (!Array.isArray(world.dialogs)) {
      world.dialogs = [];
    }
    if (!world.maps) {
      const legacyMap = world.map || {};
      world.maps = {
        main: {
          id: "main",
          name: "Main",
          image: legacyMap.image || "mapa.png",
          tileSize: Number.isFinite(legacyMap.tileSize) ? legacyMap.tileSize : 16,
          start: world.start || { x: 0, y: 0 },
          colliders: Array.isArray(world.colliders) ? world.colliders : [],
          npcs: [],
          events: Array.isArray(world.events) ? world.events : []
        }
      };
      world.activeMapId = world.activeMapId || "main";
      delete world.map;
      delete world.start;
      delete world.colliders;
      delete world.events;
    }
    if (Array.isArray(world.maps)) {
      const mapped = {};
      for (let i = 0; i < world.maps.length; i += 1) {
        const map = world.maps[i];
        if (!map) {
          continue;
        }
        const id = map.id || "map-" + (i + 1);
        map.id = id;
        mapped[id] = map;
      }
      world.maps = mapped;
    }
    if (!world.maps || typeof world.maps !== "object") {
      world.maps = {};
    }
    const mapIndex = Array.isArray(world.mapIndex) ? world.mapIndex : [];
    if (mapIndex.length) {
      mapIndex.forEach((entry, idx) => {
        if (!entry || !entry.id) {
          return;
        }
        if (world.maps[entry.id]) {
          return;
        }
        world.maps[entry.id] = {
          id: entry.id,
          name: entry.name || entry.id || "map-" + (idx + 1),
          image: entry.image || "mapa.png",
          tileSize: Number.isFinite(entry.tileSize) ? entry.tileSize : 16,
          start: entry.start || { x: 0, y: 0 },
          colliders: [],
          npcs: [],
          events: [],
          partial: true
        };
      });
    } else if (world.mapFiles && typeof world.mapFiles === "object") {
      Object.keys(world.mapFiles).forEach((id) => {
        if (!id || world.maps[id]) {
          return;
        }
        world.maps[id] = {
          id,
          name: id,
          image: "mapa.png",
          tileSize: 16,
          start: { x: 0, y: 0 },
          colliders: [],
          npcs: [],
          events: [],
          partial: true
        };
      });
    }
    const ids = Object.keys(world.maps);
    if (!ids.length) {
      world.maps.main = {
        id: "main",
        name: "Main",
        image: "mapa.png",
        tileSize: 16,
        start: { x: 0, y: 0 },
        colliders: [],
        npcs: [],
        events: []
      };
    }
    Object.keys(world.maps).forEach((key) => {
      const map = world.maps[key];
      if (!map) {
        delete world.maps[key];
        return;
      }
      if (!map.id) {
        map.id = key;
      }
      if (!map.name) {
        map.name = map.id;
      }
      map.image = map.image || "mapa.png";
      map.tileSize = Number.isFinite(map.tileSize) ? map.tileSize : 16;
      map.start = map.start || { x: 0, y: 0 };
      map.colliders = Array.isArray(map.colliders) ? map.colliders : [];
      map.npcs = Array.isArray(map.npcs) ? map.npcs : [];
      map.events = Array.isArray(map.events) ? map.events : [];
      map.npcs.forEach((npc, idx) => {
        if (!npc) {
          return;
        }
        if (!npc.id) {
          npc.id = "npc-" + (idx + 1);
        }
        if (typeof npc.trigger !== "string") {
          npc.trigger = "touch";
        }
        if (typeof npc.solid !== "boolean") {
          npc.solid = false;
        }
      });
    });
    world.dialogs.forEach((dialog, idx) => {
      if (!dialog) {
        return;
      }
      if (!dialog.id) {
        dialog.id = createId("dialog", dialog.title || dialog.name || "dialogo");
      }
      if (!dialog.title && dialog.name) {
        dialog.title = dialog.name;
      }
      if (!dialog.title) {
        dialog.title = "Dialogo " + (idx + 1);
      }
    });
    if (!world.activeMapId || !world.maps[world.activeMapId]) {
      world.activeMapId = Object.keys(world.maps)[0];
    }
    return world;
  }

  function mergeDialogs(list) {
    if (!Array.isArray(list) || !list.length) {
      return;
    }
    if (!Array.isArray(worldData.dialogs)) {
      worldData.dialogs = [];
    }
    list.forEach((dialog) => {
      if (!dialog || !dialog.id) {
        return;
      }
      const idx = worldData.dialogs.findIndex((entry) => entry && entry.id === dialog.id);
      if (idx === -1) {
        worldData.dialogs.push(dialog);
      } else {
        worldData.dialogs[idx] = Object.assign({}, worldData.dialogs[idx], dialog);
      }
    });
    renderDialogOptions();
  }

  function getLocalEditsKey(mapId) {
    return LOCAL_EDITS_PREFIX + mapId;
  }

  function loadLocalEdits(mapId) {
    if (!mapId || typeof localStorage === "undefined") {
      return null;
    }
    try {
      const raw = localStorage.getItem(getLocalEditsKey(mapId));
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      setStatus("Falha ao ler alteracoes locais: " + err.message, true);
      return null;
    }
  }

  function saveLocalEdits(map) {
    if (!map || !map.id || typeof localStorage === "undefined") {
      return;
    }
    try {
      const payload = buildMapSavePayload(map);
      localStorage.setItem(getLocalEditsKey(map.id), JSON.stringify(payload));
    } catch (err) {
      setStatus("Falha ao salvar alteracoes locais: " + err.message, true);
    }
  }

  function applyLocalEdits(map) {
    if (!map || !map.id) {
      return;
    }
    const saved = loadLocalEdits(map.id);
    if (!saved || typeof saved !== "object") {
      return;
    }
    if (Array.isArray(saved.colliders)) {
      map.colliders = saved.colliders;
    }
    if (Array.isArray(saved.events)) {
      map.events = saved.events;
    }
    if (Array.isArray(saved.npcs)) {
      map.npcs = saved.npcs;
    }
    if (saved.start) {
      map.start = saved.start;
    }
    if (Array.isArray(saved.dialogs)) {
      mergeDialogs(saved.dialogs);
    }
  }

  function getActiveMap() {
    return worldData.maps[activeMapId];
  }

  function getMapFilePath(mapId) {
    const folder = (worldData.mapsFolder || worldData.mapFolder || "mapas").replace(/\/$/, "");
    const files = worldData.mapFiles;
    const fileName = (files && files[mapId]) || mapId + ".json";
    return folder + "/" + fileName;
  }

  function getMapIndexImage(mapId) {
    const index = Array.isArray(worldData.mapIndex) ? worldData.mapIndex : [];
    if (!mapId || !index.length) {
      return null;
    }
    const entry = index.find((item) => item && item.id === mapId);
    if (entry && entry.image) {
      return entry.image;
    }
    return null;
  }

  function isMapStub(map, mapId) {
    if (!map) {
      return false;
    }
    if (map.partial === true) {
      return true;
    }
    const hasFile = worldData.mapFiles && mapId && worldData.mapFiles[mapId];
    if (!hasFile) {
      return false;
    }
    const indexImage = getMapIndexImage(mapId);
    if ((map.image === "mapa.png" || !map.image) && indexImage && indexImage !== "mapa.png") {
      return true;
    }
    const hasContent =
      (Array.isArray(map.colliders) && map.colliders.length) ||
      (Array.isArray(map.npcs) && map.npcs.length) ||
      (Array.isArray(map.events) && map.events.length);
    if (hasContent) {
      return false;
    }
    return map.image === "mapa.png" || !map.image;
  }

  function normalizeLoadedMap(mapId, data) {
    const raw = data && data.map && !data.id ? data.map : data;
    const map = raw && typeof raw === "object" ? raw : {};
    map.id = map.id || mapId || "default";
    map.name = map.name || map.id;
    map.image = map.image || "mapa.png";
    map.tileSize = Number.isFinite(map.tileSize) ? map.tileSize : 16;
    map.start = map.start || { x: 0, y: 0 };
    map.colliders = Array.isArray(map.colliders) ? map.colliders : [];
    map.npcs = Array.isArray(map.npcs) ? map.npcs : [];
    map.events = Array.isArray(map.events) ? map.events : [];
    if (Array.isArray(map.dialogs)) {
      mergeDialogs(map.dialogs);
      delete map.dialogs;
    }
    map.partial = false;
    return map;
  }

  async function loadMapData(mapId) {
    const map = worldData.maps[mapId];
    if (map && map.partial !== true && !isMapStub(map, mapId)) {
      return map;
    }
    const filePath = getMapFilePath(mapId);
    const response = await fetch(filePath);
    if (!response.ok) {
      throw new Error("HTTP " + response.status);
    }
    const data = await response.json();
    const loaded = normalizeLoadedMap(mapId, data);
    worldData.maps[mapId] = loaded;
    applyLocalEdits(loaded);
    window.WORLD = worldData;
    return loaded;
  }

  function collectDialogIdsForMap(map) {
    const ids = new Set();
    if (!map) {
      return ids;
    }
    const events = Array.isArray(map.events) ? map.events : [];
    for (let i = 0; i < events.length; i += 1) {
      const ev = events[i];
      if (ev && ev.type === "dialog" && ev.dialogId) {
        ids.add(ev.dialogId);
      }
    }
    const npcs = Array.isArray(map.npcs) ? map.npcs : [];
    for (let i = 0; i < npcs.length; i += 1) {
      const npc = npcs[i];
      if (npc && npc.dialogId) {
        ids.add(npc.dialogId);
      }
    }
    return ids;
  }

  function buildMapSavePayload(map) {
    const dialogIds = collectDialogIdsForMap(map);
    const dialogs = worldData.dialogs.filter((dialog) => dialog && dialogIds.has(dialog.id));
    return {
      id: map.id,
      name: map.name,
      image: map.image,
      tileSize: map.tileSize,
      start: map.start,
      colliders: map.colliders,
      npcs: map.npcs,
      events: map.events,
      dialogs
    };
  }

  function getDialogById(dialogId) {
    if (!dialogId) {
      return null;
    }
    for (let i = 0; i < worldData.dialogs.length; i += 1) {
      const dialog = worldData.dialogs[i];
      if (dialog && dialog.id === dialogId) {
        return dialog;
      }
    }
    return null;
  }

  function getDialogByTitle(title) {
    const key = (title || "").trim().toLowerCase();
    if (!key) {
      return null;
    }
    for (let i = 0; i < worldData.dialogs.length; i += 1) {
      const dialog = worldData.dialogs[i];
      if (!dialog || !dialog.title) {
        continue;
      }
      if (dialog.title.trim().toLowerCase() === key) {
        return dialog;
      }
    }
    return null;
  }

  function isDialogUsed(dialogId, ignoreEvent) {
    if (!dialogId) {
      return false;
    }
    const mapIds = Object.keys(worldData.maps || {});
    for (let i = 0; i < mapIds.length; i += 1) {
      const map = worldData.maps[mapIds[i]];
      if (!map) {
        continue;
      }
      const events = Array.isArray(map.events) ? map.events : [];
      for (let j = 0; j < events.length; j += 1) {
        const ev = events[j];
        if (!ev || ev === ignoreEvent) {
          continue;
        }
        if (ev.type === "dialog" && ev.dialogId === dialogId) {
          return true;
        }
      }
      const npcs = Array.isArray(map.npcs) ? map.npcs : [];
      for (let j = 0; j < npcs.length; j += 1) {
        const npc = npcs[j];
        if (npc && npc.dialogId === dialogId) {
          return true;
        }
      }
    }
    return false;
  }

  function removeDialogIfUnused(dialogId, ignoreEvent) {
    if (!dialogId) {
      return;
    }
    if (isDialogUsed(dialogId, ignoreEvent)) {
      return;
    }
    const idx = worldData.dialogs.findIndex((dialog) => dialog && dialog.id === dialogId);
    if (idx !== -1) {
      worldData.dialogs.splice(idx, 1);
      renderDialogOptions();
    }
  }

  function ensureDialogEntry(name, text, existingId) {
    const cleanName = (name || "").trim();
    let dialog = getDialogById(existingId);
    if (!dialog && cleanName) {
      dialog = getDialogByTitle(cleanName);
    }
    if (!dialog) {
      dialog = {
        id: createId("dialog", cleanName || "dialogo"),
        title: cleanName || "Dialogo",
        text: text || ""
      };
      worldData.dialogs.push(dialog);
    } else {
      if (cleanName) {
        dialog.title = cleanName;
      }
      if (typeof text === "string") {
        dialog.text = text;
      }
    }
    renderDialogOptions();
    return dialog.id;
  }

  function findEventAtTile(tileX, tileY) {
    const map = getActiveMap();
    if (!map || !Array.isArray(map.events)) {
      return null;
    }
    for (let i = map.events.length - 1; i >= 0; i -= 1) {
      const ev = map.events[i];
      if (!ev || !ev.rect) {
        continue;
      }
      if (pointInRect(tileX, tileY, ev.rect)) {
        return { event: ev, index: i };
      }
    }
    return null;
  }

  function clearElement(el) {
    while (el.firstChild) {
      el.removeChild(el.firstChild);
    }
  }

  function makeLabel(text) {
    const label = document.createElement("label");
    label.textContent = text;
    return label;
  }

  function makeNumberField(text, value, onChange) {
    const label = makeLabel(text);
    const input = document.createElement("input");
    input.type = "number";
    input.step = "1";
    input.value = Number.isFinite(value) ? value : 0;
    input.addEventListener("change", () => onChange(toInt(input.value, 0)));
    label.appendChild(input);
    return label;
  }

  function makeTextField(text, value, onChange) {
    const label = makeLabel(text);
    const input = document.createElement("input");
    input.type = "text";
    input.value = value || "";
    input.addEventListener("change", () => onChange(input.value));
    label.appendChild(input);
    return label;
  }

  function makeTextareaField(text, value, onChange) {
    const label = makeLabel(text);
    const textarea = document.createElement("textarea");
    textarea.rows = 2;
    textarea.value = value || "";
    textarea.addEventListener("change", () => onChange(textarea.value));
    label.appendChild(textarea);
    return label;
  }

  function makeSelectField(text, options, value, onChange) {
    const label = makeLabel(text);
    const select = document.createElement("select");
    for (let i = 0; i < options.length; i += 1) {
      const opt = document.createElement("option");
      opt.value = options[i].value;
      opt.textContent = options[i].label;
      select.appendChild(opt);
    }
    select.value = value || "";
    select.addEventListener("change", () => onChange(select.value));
    label.appendChild(select);
    return label;
  }

  function makeCheckboxField(text, checked, onChange) {
    const label = document.createElement("label");
    label.className = "checkbox";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = Boolean(checked);
    input.addEventListener("change", () => onChange(input.checked));
    label.appendChild(input);
    label.appendChild(document.createTextNode(text));
    return label;
  }

  function updateSelectedTile() {
    if (selectedTile.x === null || selectedTile.y === null) {
      selectedTileInput.value = "-";
      return;
    }
    if (selectedArea && selectedArea.w && selectedArea.h) {
      selectedTileInput.value =
        selectedTile.x + ", " + selectedTile.y + " (" + selectedArea.w + "x" + selectedArea.h + ")";
      return;
    }
    selectedTileInput.value = selectedTile.x + ", " + selectedTile.y;
  }

  function formatArea(area) {
    if (!area) {
      return "-";
    }
    return area.x + ", " + area.y + " (" + area.w + "x" + area.h + ")";
  }

  function formatTeleportTarget(target) {
    if (!target) {
      return "-";
    }
    const facing = target.facing ? " " + target.facing : "";
    return target.mapId + " (" + target.x + ", " + target.y + ")" + facing;
  }

  function updateTeleportStatus() {
    const text = "Destino salvo: " + formatTeleportTarget(savedTeleportTarget);
    if (eventTargetStatus) {
      eventTargetStatus.textContent = text;
    }
    if (modalEventTargetStatus) {
      modalEventTargetStatus.textContent = text;
    }
  }

  function setSavedTeleportTarget(target) {
    savedTeleportTarget = target;
    updateTeleportStatus();
  }

  function captureTeleportTargetFromSelection() {
    const area = getSelectedArea();
    if (!area) {
      setStatus("Selecione uma area para definir o destino.", true);
      return null;
    }
    return {
      mapId: activeMapId,
      x: toInt(area.x, 0),
      y: toInt(area.y, 0),
      facing: ""
    };
  }

  function applyTeleportTargetToFields(target, isModal) {
    if (!target) {
      setStatus("Nenhum destino salvo.", true);
      return;
    }
    if (isModal) {
      if (modalEventTargetMap) {
        modalEventTargetMap.value = target.mapId || activeMapId;
      }
      if (modalEventTargetX) {
        modalEventTargetX.value = toInt(target.x, 0);
      }
      if (modalEventTargetY) {
        modalEventTargetY.value = toInt(target.y, 0);
      }
      if (modalEventTargetFacing && target.facing) {
        modalEventTargetFacing.value = target.facing;
      }
      return;
    }
    if (eventTargetMap) {
      eventTargetMap.value = target.mapId || activeMapId;
    }
    if (eventTargetX) {
      eventTargetX.value = toInt(target.x, 0);
    }
    if (eventTargetY) {
      eventTargetY.value = toInt(target.y, 0);
    }
    if (eventTargetFacing && target.facing) {
      eventTargetFacing.value = target.facing;
    }
  }

  function getSelectedArea() {
    if (selectedArea) {
      return selectedArea;
    }
    if (selectedTile.x === null || selectedTile.y === null) {
      return null;
    }
    return { x: selectedTile.x, y: selectedTile.y, w: 1, h: 1 };
  }

  function requireSelectedArea(actionLabel) {
    const area = getSelectedArea();
    if (!area) {
      const label = actionLabel ? " para " + actionLabel : "";
      setStatus("Selecione uma area no mapa" + label + ".", true);
      return null;
    }
    return area;
  }

  function normalizeArea(a, b) {
    if (!a || !b) {
      return null;
    }
    const x1 = Math.min(a.x, b.x);
    const y1 = Math.min(a.y, b.y);
    const x2 = Math.max(a.x, b.x);
    const y2 = Math.max(a.y, b.y);
    return {
      x: x1,
      y: y1,
      w: x2 - x1 + 1,
      h: y2 - y1 + 1
    };
  }

  function rectWidth(rect) {
    if (!rect) {
      return 0;
    }
    if (typeof rect.w === "number") {
      return rect.w;
    }
    if (typeof rect.width === "number") {
      return rect.width;
    }
    return 1;
  }

  function rectHeight(rect) {
    if (!rect) {
      return 0;
    }
    if (typeof rect.h === "number") {
      return rect.h;
    }
    if (typeof rect.height === "number") {
      return rect.height;
    }
    return 1;
  }

  function pointInRect(x, y, rect) {
    const w = rectWidth(rect);
    const h = rectHeight(rect);
    return x >= rect.x && y >= rect.y && x < rect.x + w && y < rect.y + h;
  }

  function clampTile(tile, view) {
    if (!tile || !view) {
      return tile;
    }
    const maxX = Number.isFinite(view.tilesX) && view.tilesX > 0 ? view.tilesX - 1 : tile.x;
    const maxY = Number.isFinite(view.tilesY) && view.tilesY > 0 ? view.tilesY - 1 : tile.y;
    return {
      x: Math.max(0, Math.min(tile.x, maxX)),
      y: Math.max(0, Math.min(tile.y, maxY))
    };
  }

  function getViewState() {
    if (typeof api.getViewState === "function") {
      return api.getViewState();
    }
    return null;
  }

  function getOverlayRect() {
    return overlayEl ? overlayEl.getBoundingClientRect() : null;
  }

  function pointerToTile(pos) {
    const view = getViewState();
    const rect = getOverlayRect();
    if (!view || !rect || !rect.width || !rect.height) {
      return null;
    }
    const scaleX = view.viewportW / rect.width;
    const scaleY = view.viewportH / rect.height;
    const worldX = view.cameraX + pos.x * scaleX;
    const worldY = view.cameraY + pos.y * scaleY;
    return clampTile(
      {
        x: Math.floor(worldX / view.tileSize),
        y: Math.floor(worldY / view.tileSize)
      },
      view
    );
  }

  function areaToScreen(area) {
    const view = getViewState();
    const rect = getOverlayRect();
    if (!view || !rect || !rect.width || !rect.height || !area) {
      return null;
    }
    const scaleX = rect.width / view.viewportW;
    const scaleY = rect.height / view.viewportH;
    return {
      x: (area.x * view.tileSize - view.cameraX) * scaleX,
      y: (area.y * view.tileSize - view.cameraY) * scaleY,
      width: area.w * view.tileSize * scaleX,
      height: area.h * view.tileSize * scaleY
    };
  }

  function updateSelectionRect(area) {
    const rect = overlayState.rect;
    const layer = overlayState.layer;
    if (!rect || !layer) {
      return;
    }
    if (!area) {
      rect.visible(false);
      layer.batchDraw();
      return;
    }
    const screen = areaToScreen(area);
    if (!screen) {
      rect.visible(false);
      layer.batchDraw();
      return;
    }
    rect.visible(true);
    rect.position({ x: screen.x, y: screen.y });
    rect.size({ width: screen.width, height: screen.height });
    layer.batchDraw();
  }

  function applySelectionToForms(area) {
    if (!area) {
      return;
    }
  }

  function handlePlacement(area) {
    const mode = editorSettings.placementMode || "select";
    if (mode === "collider") {
      placeColliderAt(area);
      return;
    }
    if (mode === "event") {
      placeEventAt(area);
      return;
    }
    if (mode === "npc") {
      if (area.w === 1 && area.h === 1) {
        placeNpcAt(area);
      } else {
        setStatus("NPC precisa de apenas um quadrado.", true);
      }
    }
  }

  function commitSelection(area, shouldPlace) {
    selectedArea = area;
    if (!area) {
      selectedTile = { x: null, y: null };
      editorSettings.selectedTile = null;
      editorSettings.selectedArea = null;
      updateSelectedTile();
      updateSelectionRect(null);
      return;
    }
    selectedTile = { x: area.x, y: area.y };
    editorSettings.selectedTile = { x: area.x, y: area.y };
    editorSettings.selectedArea = { x: area.x, y: area.y, w: area.w, h: area.h };
    updateSelectedTile();
    applySelectionToForms(area);
    updateSelectionRect(area);
    if (shouldPlace) {
      handlePlacement(area);
    }
  }

  function resizeOverlay() {
    if (!overlayState.stage || !overlayEl) {
      return;
    }
    const rect = getOverlayRect();
    if (!rect) {
      return;
    }
    overlayState.stage.width(rect.width);
    overlayState.stage.height(rect.height);
    updateSelectionRect(selectedArea);
  }

  function initSelectionOverlay() {
    if (!overlayEl || typeof Konva === "undefined") {
      return;
    }
    const rect = getOverlayRect();
    if (!rect) {
      return;
    }
    overlayEl.style.pointerEvents = "auto";
    overlayState.stage = new Konva.Stage({
      container: overlayEl,
      width: rect.width,
      height: rect.height
    });
    overlayState.layer = new Konva.Layer();
    overlayState.rect = new Konva.Rect({
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      visible: false,
      stroke: "rgba(244, 192, 79, 0.95)",
      strokeWidth: 1,
      fill: "rgba(244, 192, 79, 0.2)"
    });
    overlayState.layer.add(overlayState.rect);
    overlayState.stage.add(overlayState.layer);

    overlayState.stage.on("mousedown touchstart", (evt) => {
      if (!overlayState.stage) {
        return;
      }
      const pos = overlayState.stage.getPointerPosition();
      if (!pos) {
        return;
      }
      const tile = pointerToTile(pos);
      if (!tile) {
        return;
      }
      overlayState.dragging = true;
      overlayState.startTile = tile;
      overlayState.lastTile = tile;
      updateSelectionRect(normalizeArea(tile, tile));
      if (evt && evt.evt) {
        evt.evt.preventDefault();
      }
    });

    overlayState.stage.on("mousemove touchmove", (evt) => {
      if (!overlayState.dragging || !overlayState.stage) {
        return;
      }
      const pos = overlayState.stage.getPointerPosition();
      if (!pos) {
        return;
      }
      const tile = pointerToTile(pos);
      if (!tile) {
        return;
      }
      overlayState.lastTile = tile;
      updateSelectionRect(normalizeArea(overlayState.startTile, tile));
      if (evt && evt.evt) {
        evt.evt.preventDefault();
      }
    });

    overlayState.stage.on("mouseup touchend touchcancel", (evt) => {
      if (!overlayState.dragging) {
        return;
      }
      overlayState.dragging = false;
      const endTile = overlayState.lastTile || overlayState.startTile;
      const area = normalizeArea(overlayState.startTile, endTile);
      commitSelection(area, true);
      if (evt && evt.evt) {
        evt.evt.preventDefault();
      }
    });

    overlayState.stage.on("dblclick dbltap", (evt) => {
      if (!overlayState.stage) {
        return;
      }
      const pos = overlayState.stage.getPointerPosition();
      if (!pos) {
        return;
      }
      const tile = pointerToTile(pos);
      if (tile) {
        const hit = findEventAtTile(tile.x, tile.y);
        if (hit && hit.event) {
          openEventModal(hit.event);
          if (evt && evt.evt) {
            evt.evt.preventDefault();
          }
          return;
        }
        if (typeof api.triggerMapDoubleClick === "function") {
          api.triggerMapDoubleClick(tile);
        }
      }
      if (evt && evt.evt) {
        evt.evt.preventDefault();
      }
    });

    if (typeof ResizeObserver === "function") {
      const observer = new ResizeObserver(() => resizeOverlay());
      observer.observe(overlayEl);
    } else {
      window.addEventListener("resize", resizeOverlay);
    }
  }

  function startOverlaySync() {
    if (!overlayState.stage) {
      return;
    }
    const view = getViewState();
    const rect = getOverlayRect();
    const key = view && rect
      ? [
        view.cameraX,
        view.cameraY,
        view.viewportW,
        view.viewportH,
        view.tileSize,
        rect.width,
        rect.height
      ].join("|")
      : "";
    if (key !== overlayState.lastSyncKey) {
      overlayState.lastSyncKey = key;
      updateSelectionRect(selectedArea);
    }
    requestAnimationFrame(startOverlaySync);
  }

  function renderMapSelect() {
    clearElement(mapSelect);
    const mapIds = Object.keys(worldData.maps);
    mapIds.forEach((id) => {
      const map = worldData.maps[id];
      const option = document.createElement("option");
      option.value = id;
      option.textContent = map.name ? map.name + " (" + id + ")" : id;
      mapSelect.appendChild(option);
    });
    mapSelect.value = activeMapId;
    renderTargetMapOptions(mapIdsList);
    if (eventTargetMap) {
      eventTargetMap.value = activeMapId;
    }
    if (modalEventTargetMap) {
      modalEventTargetMap.value = activeMapId;
    }
  }

  function renderTargetMapOptions(selectEl) {
    if (!selectEl) {
      return;
    }
    clearElement(selectEl);
    Object.keys(worldData.maps).forEach((id) => {
      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = id;
      selectEl.appendChild(opt);
    });
  }

  function getDialogOptions() {
    const options = [{ value: "", label: "nenhum" }];
    worldData.dialogs.forEach((dialog) => {
      if (!dialog || !dialog.id) {
        return;
      }
      const label = dialog.title || dialog.name || dialog.id;
      options.push({ value: dialog.id, label });
    });
    return options;
  }

  function renderDialogOptions() {
    if (npcDialog) {
      const current = npcDialog.value;
      clearElement(npcDialog);
      const options = getDialogOptions();
      options.forEach((opt) => {
        const option = document.createElement("option");
        option.value = opt.value;
        option.textContent = opt.label;
        npcDialog.appendChild(option);
      });
      npcDialog.value = current || "";
    }
  }

  function getNpcOptions() {
    const map = getActiveMap();
    const options = [{ value: "", label: "nenhum" }];
    if (!map || !Array.isArray(map.npcs)) {
      return options;
    }
    map.npcs.forEach((npc) => {
      if (!npc || !npc.id) {
        return;
      }
      const label = npc.name ? npc.name + " (" + npc.id + ")" : npc.id;
      options.push({ value: npc.id, label });
    });
    return options;
  }

  function applyEdits() {
    const map = getActiveMap();
    api.applyEdits({
      mapId: activeMapId,
      colliders: map.colliders,
      events: map.events,
      npcs: map.npcs
    });
    saveLocalEdits(map);
  }

  function ensureEventDefaults(ev) {
    if (!ev.id) {
      ev.id = createId("event", ev.name || ev.type || "evento");
    }
    if (!ev.type) {
      ev.type = "message";
    }
    if (isServerEventType(ev.type)) {
      ev.eventType = ev.eventType || ev.type;
      ev.type = "server";
    }
    if (!ev.rect) {
      ev.rect = { x: 0, y: 0, w: 1, h: 1 };
    }
    if (ev.type === "server") {
      if (!ev.eventType) ev.eventType = "pokecenter";
      if (!ev.payload || typeof ev.payload !== "object") ev.payload = {};
      if (typeof ev.name !== "string") ev.name = "";
      if (typeof ev.trigger !== "string") ev.trigger = "interact";
    }
    if (ev.type === "door" && !ev.target) {
      ev.target = {};
    }
    if (ev.type === "dialog" && typeof ev.dialogId === "undefined") {
      ev.dialogId = "";
    }
    if (ev.type === "dialog" && typeof ev.trigger !== "string") {
      ev.trigger = "enter";
    }
    if ((ev.type === "door" || ev.type === "message") && typeof ev.trigger !== "string") {
      ev.trigger = "enter";
    }
    if (typeof ev.once !== "boolean") {
      ev.once = true;
    }
  }

  function renderColliders() {
    const map = getActiveMap();
    clearElement(colliderList);
    map.colliders.forEach((col, idx) => {
      const row = document.createElement("div");
      row.className = "list-item";
      const info = document.createElement("div");
      info.className = "status";
      info.textContent = "Area: " + formatArea({
        x: col.x,
        y: col.y,
        w: rectWidth(col),
        h: rectHeight(col)
      });
      row.appendChild(info);

      const actions = document.createElement("div");
      actions.className = "list-actions";
      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "danger";
      removeBtn.textContent = "Remover";
      removeBtn.addEventListener("click", () => {
        map.colliders.splice(idx, 1);
        renderColliders();
        applyEdits();
      });
      actions.appendChild(removeBtn);
      row.appendChild(actions);
      colliderList.appendChild(row);
    });
  }

  function renderEvents() {
    const map = getActiveMap();
    map.events.forEach((ev) => {
      ensureEventDefaults(ev);
    });
  }

  function renderItems() {
    clearElement(itemList);
    worldData.items.forEach((item, idx) => {
      const row = document.createElement("div");
      row.className = "list-item";

      const grid = document.createElement("div");
      grid.className = "field-row";
      grid.appendChild(
        makeTextField("ID", item.id, (value) => {
          item.id = value;
        })
      );
      grid.appendChild(
        makeTextField("Nome", item.name, (value) => {
          item.name = value;
        })
      );
      row.appendChild(grid);

      const desc = makeTextareaField("Descricao", item.desc, (value) => {
        item.desc = value;
      });
      desc.classList.add("full");
      row.appendChild(desc);

      const actions = document.createElement("div");
      actions.className = "list-actions";
      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "danger";
      removeBtn.textContent = "Remover";
      removeBtn.addEventListener("click", () => {
        worldData.items.splice(idx, 1);
        renderItems();
      });
      actions.appendChild(removeBtn);
      row.appendChild(actions);
      itemList.appendChild(row);
    });
  }

  function renderDialogs() {
    worldData.dialogs.forEach((dialog) => {
      if (!dialog) {
        return;
      }
      if (!dialog.id) {
        dialog.id = createId("dialog", dialog.title || dialog.name || "dialogo");
      }
      if (!dialog.title && dialog.name) {
        dialog.title = dialog.name;
      }
    });
    renderDialogOptions();
  }

  function renderNpcs() {
    const map = getActiveMap();
    clearElement(npcList);
    map.npcs.forEach((npc, idx) => {
      if (!npc.id) {
        npc.id = "npc-" + (idx + 1);
      }
      const row = document.createElement("div");
      row.className = "list-item";

      const head = document.createElement("div");
      head.className = "field-row";
      head.appendChild(
        makeTextField("ID", npc.id, (value) => {
          npc.id = value || npc.id;
          applyEdits();
        })
      );
      head.appendChild(
        makeTextField("Nome", npc.name, (value) => {
          npc.name = value;
          applyEdits();
        })
      );
      row.appendChild(head);

      const grid = document.createElement("div");
      grid.className = "field-row";
      grid.appendChild(
        makeSelectField("Dialogo", getDialogOptions(), npc.dialogId || "", (value) => {
          npc.dialogId = value || "";
          applyEdits();
        })
      );
      grid.appendChild(
        makeSelectField(
          "Disparo",
          [
            { value: "touch", label: "Ao encostar" },
            { value: "dblclick", label: "Duplo clique" }
          ],
          npc.trigger || "touch",
          (value) => {
            npc.trigger = value || "touch";
            applyEdits();
          }
        )
      );
      row.appendChild(grid);

      const pos = document.createElement("div");
      pos.className = "status";
      pos.textContent = "Posicao: " + npc.x + ", " + npc.y;
      row.appendChild(pos);

      const flags = document.createElement("div");
      flags.className = "field-row";
      flags.appendChild(
        makeCheckboxField("Solido (bloqueia movimento)", npc.solid, (checked) => {
          npc.solid = checked;
          applyEdits();
        })
      );
      row.appendChild(flags);

      const actions = document.createElement("div");
      actions.className = "list-actions";
      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "danger";
      removeBtn.textContent = "Remover";
      removeBtn.addEventListener("click", () => {
        map.npcs.splice(idx, 1);
        renderNpcs();
        applyEdits();
      });
      actions.appendChild(removeBtn);
      row.appendChild(actions);
      npcList.appendChild(row);
    });
  }

  function renderAll() {
    renderMapSelect();
    renderDialogs();
    renderColliders();
    renderEvents();
    renderNpcs();
    renderItems();
    updateSelectedTile();
    updateTeleportStatus();
  }

  function updateEventFormVisibility() {
    const type = eventType.value;
    const isServer = isServerEventType(type);
    eventDoorWrap.style.display = type === "door" ? "grid" : "none";
    eventMessageWrap.style.display = type === "message" ? "flex" : "none";
    if (eventDialogWrap) {
      eventDialogWrap.style.display = type === "dialog" ? "flex" : "none";
    }
    if (eventDialogTextWrap) {
      eventDialogTextWrap.style.display = type === "dialog" ? "flex" : "none";
    }
    if (eventTriggerWrap) {
      eventTriggerWrap.style.display =
        type === "dialog" || type === "door" || type === "message" || isServer ? "flex" : "none";
    }
    if (eventServerWrap) {
      eventServerWrap.style.display = isServer ? "flex" : "none";
    }
  }

  function updateModalEventVisibility(type) {
    if (!modalEventType) {
      return;
    }
    const isServer = isServerEventType(type);
    modalEventDoorWrap.style.display = type === "door" ? "grid" : "none";
    modalEventMessageWrap.style.display = type === "message" ? "flex" : "none";
    if (modalEventDialogWrap) {
      modalEventDialogWrap.style.display = type === "dialog" ? "flex" : "none";
    }
    if (modalEventDialogTextWrap) {
      modalEventDialogTextWrap.style.display = type === "dialog" ? "flex" : "none";
    }
    if (modalEventTriggerWrap) {
      modalEventTriggerWrap.style.display =
        type === "dialog" || type === "door" || type === "message" || isServer ? "flex" : "none";
    }
    if (modalEventServerWrap) {
      modalEventServerWrap.style.display = isServer ? "flex" : "none";
    }
  }

  function updateModalAreaLabel(rect) {
    if (!eventModalArea) {
      return;
    }
    if (!rect) {
      eventModalArea.textContent = "Area: -";
      return;
    }
    eventModalArea.textContent =
      "Area: " +
      formatArea({
        x: rect.x,
        y: rect.y,
        w: rectWidth(rect),
        h: rectHeight(rect)
      });
  }

  function openEventModal(ev) {
    if (!eventModal || !ev) {
      return;
    }
    ensureEventDefaults(ev);
    activeModalEvent = ev;
    const isServer = ev.type === "server";
    if (modalEventType) {
      modalEventType.value = isServer ? ev.eventType || "pokecenter" : ev.type || "message";
    }
    if (modalEventName) {
      modalEventName.value = ev.name || "";
    }
    if (modalEventOnce) {
      modalEventOnce.checked = ev.once !== false;
    }
    if (modalEventText) {
      modalEventText.value = ev.text || "";
    }
    if (modalEventDialogName || modalEventDialogText) {
      const dialog = getDialogById(ev.dialogId);
      if (modalEventDialogName) {
        modalEventDialogName.value = dialog ? dialog.title || "" : "";
      }
      if (modalEventDialogText) {
        modalEventDialogText.value = dialog ? dialog.text || "" : ev.text || "";
      }
    }
    if (modalEventTrigger) {
      modalEventTrigger.value = ev.trigger || "enter";
    }
    if (modalEventTargetMap) {
      modalEventTargetMap.value = (ev.target && ev.target.mapId) || activeMapId;
    }
    if (modalEventTargetX) {
      modalEventTargetX.value = toInt(ev.target && ev.target.x, 0);
    }
    if (modalEventTargetY) {
      modalEventTargetY.value = toInt(ev.target && ev.target.y, 0);
    }
    if (modalEventTargetFacing) {
      modalEventTargetFacing.value = (ev.target && ev.target.facing) || "";
    }
    if (modalEventPayload) {
      modalEventPayload.value = isServer ? JSON.stringify(ev.payload || {}, null, 2) : "";
    }
    if (ev.rect) {
      commitSelection(
        {
          x: ev.rect.x,
          y: ev.rect.y,
          w: rectWidth(ev.rect),
          h: rectHeight(ev.rect)
        },
        false
      );
    }
    updateModalAreaLabel(ev.rect);
    updateModalEventVisibility(isServer ? ev.eventType || "pokecenter" : ev.type || "message");
    eventModal.classList.remove("hidden");
  }

  function closeEventModal() {
    if (!eventModal) {
      return;
    }
    eventModal.classList.add("hidden");
    activeModalEvent = null;
  }

  function setWorldData(data) {
    worldData = normalizeWorldData(data);
    window.WORLD = worldData;
    activeMapId = worldData.activeMapId;
    Object.keys(worldData.maps || {}).forEach((mapId) => {
      const map = worldData.maps[mapId];
      if (!map || isMapStub(map, mapId)) {
        return;
      }
      applyLocalEdits(map);
    });
    renderAll();
    closeEventModal();
    api.loadWorld(worldData);
    const map = getActiveMap();
    if (map && isMapStub(map, activeMapId)) {
      setStatus("Carregando mapa...", false);
      loadMapData(activeMapId)
        .then(() => {
          setStatus("", false);
          renderAll();
          api.loadWorld(worldData);
        })
        .catch((err) => {
          setStatus("Falha ao carregar mapa: " + err.message, true);
        });
    }
  }

  function applyModalChanges() {
    if (!activeModalEvent) {
      return;
    }
    const prevType = activeModalEvent.type;
    const prevDialogId = activeModalEvent.dialogId;
    const type = modalEventType ? modalEventType.value : activeModalEvent.type || "message";
    const isServer = isServerEventType(type);
    const triggerValue = modalEventTrigger
      ? modalEventTrigger.value || (isServer ? "interact" : "enter")
      : isServer
        ? "interact"
        : "enter";
    activeModalEvent.type = isServer ? "server" : type;
    activeModalEvent.once = Boolean(modalEventOnce && modalEventOnce.checked);
    if (modalEventName) {
      activeModalEvent.name = modalEventName.value || "";
    }

    if (isServer) {
      const payload = parseEventPayload(modalEventPayload?.value, (msg) => setStatus(msg, true));
      if (payload === null) {
        return;
      }
      activeModalEvent.eventType = type;
      activeModalEvent.payload = payload;
      activeModalEvent.text = "";
      activeModalEvent.dialogId = "";
      activeModalEvent.target = null;
      activeModalEvent.trigger = triggerValue;
      if (prevType === "dialog") {
        removeDialogIfUnused(prevDialogId, activeModalEvent);
      }
    } else {
      if (type === "message") {
        activeModalEvent.text = modalEventText ? modalEventText.value || "" : "";
        activeModalEvent.trigger = triggerValue;
      } else {
        activeModalEvent.text = "";
      }
      if (type === "dialog") {
        const dialogName = modalEventDialogName ? modalEventDialogName.value : "";
        const dialogText = modalEventDialogText ? modalEventDialogText.value : "";
        activeModalEvent.dialogId = ensureDialogEntry(dialogName, dialogText, prevDialogId);
        activeModalEvent.trigger = triggerValue;
      } else {
        activeModalEvent.dialogId = "";
        if (type !== "message" && type !== "door") {
          activeModalEvent.trigger = null;
        }
        if (prevType === "dialog") {
          removeDialogIfUnused(prevDialogId, activeModalEvent);
        }
      }
      if (type === "door") {
        activeModalEvent.target = activeModalEvent.target || {};
        activeModalEvent.target.mapId =
          (modalEventTargetMap && modalEventTargetMap.value) || activeMapId;
        activeModalEvent.target.x = toInt(modalEventTargetX && modalEventTargetX.value, 0);
        activeModalEvent.target.y = toInt(modalEventTargetY && modalEventTargetY.value, 0);
        activeModalEvent.target.facing =
          (modalEventTargetFacing && modalEventTargetFacing.value) || null;
        activeModalEvent.trigger = triggerValue;
      } else {
        activeModalEvent.target = null;
      }
    }
    ensureEventDefaults(activeModalEvent);
    renderEvents();
    renderNpcs();
    applyEdits();
    setStatus("Evento atualizado.", false);
    closeEventModal();
  }

  function deleteModalEvent() {
    if (!activeModalEvent) {
      return;
    }
    const map = getActiveMap();
    const idx = map.events.indexOf(activeModalEvent);
    const dialogId = activeModalEvent.dialogId;
    const wasDialog = activeModalEvent.type === "dialog";
    if (idx !== -1) {
      map.events.splice(idx, 1);
      renderEvents();
      applyEdits();
      setStatus("Evento removido.", false);
    }
    if (wasDialog) {
      removeDialogIfUnused(dialogId, activeModalEvent);
    }
    closeEventModal();
  }

  function buildEventFromForm(area) {
    const type = eventType.value;
    const isServer = isServerEventType(type);
    const name =
      (eventName && eventName.value) ||
      (type === "dialog" ? (eventDialogName ? eventDialogName.value : "") : "");
    const triggerValue = eventTrigger
      ? eventTrigger.value || (isServer ? "interact" : "enter")
      : isServer
        ? "interact"
        : "enter";
    const ev = {
      id: createId("event", name || type),
      type: isServer ? "server" : type,
      name: name || "",
      rect: {
        x: toInt(area.x, 0),
        y: toInt(area.y, 0),
        w: toPositive(area.w, 1),
        h: toPositive(area.h, 1)
      },
      once: Boolean(eventOnce.checked)
    };
    if (isServer) {
      const payload = parseEventPayload(eventPayload?.value, (msg) => setStatus(msg, true));
      if (payload === null) return null;
      ev.eventType = type;
      ev.payload = payload;
      ev.trigger = triggerValue;
      return ev;
    }
    if (type === "message") {
      ev.text = eventText.value || "";
      ev.trigger = triggerValue;
    }
    if (type === "door") {
      ev.target = {
        mapId: eventTargetMap.value || activeMapId,
        x: toInt(eventTargetX.value, 0),
        y: toInt(eventTargetY.value, 0),
        facing: eventTargetFacing.value || null
      };
      ev.trigger = triggerValue;
    }
    if (type === "dialog") {
      const dialogName = eventDialogName ? eventDialogName.value : "";
      const dialogText = eventDialogText ? eventDialogText.value : "";
      ev.dialogId = ensureDialogEntry(dialogName, dialogText, null);
      ev.trigger = triggerValue;
    }
    return ev;
  }

  function placeColliderAt(area) {
    const map = getActiveMap();
    if (!area) {
      return;
    }
    map.colliders.push({
      x: toInt(area.x, 0),
      y: toInt(area.y, 0),
      w: toPositive(area.w, 1),
      h: toPositive(area.h, 1)
    });
    renderColliders();
    applyEdits();
    setStatus("Colisor adicionado em " + formatArea(area) + ".", false);
  }

  function placeEventAt(area) {
    const map = getActiveMap();
    if (!area) {
      return;
    }
    const ev = buildEventFromForm(area);
    if (!ev) {
      return;
    }
    map.events.push(ev);
    renderEvents();
    if (ev.type === "dialog") {
      renderNpcs();
    }
    applyEdits();
    setStatus("Evento adicionado em " + formatArea(area) + ".", false);
  }

  function placeNpcAt(area) {
    const map = getActiveMap();
    if (!area) {
      return;
    }
    const npc = {
      id: npcId.value || "npc-" + Date.now(),
      name: npcName.value || "",
      x: toInt(area.x, 0),
      y: toInt(area.y, 0),
      dialogId: npcDialog ? npcDialog.value || "" : "",
      trigger: npcTrigger ? npcTrigger.value || "touch" : "touch",
      solid: Boolean(npcSolid && npcSolid.checked)
    };
    npcId.value = npc.id;
    map.npcs.push(npc);
    renderNpcs();
    applyEdits();
    setStatus("NPC adicionado em " + formatArea(area) + ".", false);
  }

  async function pickMapsDirectory() {
    if (!supportsDirAccess) {
      return null;
    }
    if (mapsDirectoryHandle) {
      return mapsDirectoryHandle;
    }
    try {
      mapsDirectoryHandle = await window.showDirectoryPicker({ mode: "readwrite" });
      return mapsDirectoryHandle;
    } catch (err) {
      if (err.name !== "AbortError") {
        setStatus("Falha ao acessar a pasta mapas: " + err.message, true);
      }
      return null;
    }
  }

  async function saveActiveMap() {
    const map = getActiveMap();
    if (!map) {
      setStatus("Mapa ativo nao encontrado.", true);
      return;
    }
    const payload = buildMapSavePayload(map);
    const fileName = (worldData.mapFiles && worldData.mapFiles[map.id]) || (map.id || "mapa") + ".json";
    const saveEndpoint = window.CORE_SAVE_ENDPOINT;
    if (saveEndpoint) {
      try {
        const r = await fetch(saveEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ map: payload, mapId: map.id, fileName }),
        });
        const data = await r.json().catch(() => ({}));
        if (!r.ok || !data?.ok) throw new Error(data?.error || "save_failed");
        setStatus("Mapa salvo no servidor: " + fileName + ".", false);
        return;
      } catch (err) {
        setStatus("Falha ao salvar no servidor: " + err.message, true);
      }
    }
    if (!supportsDirAccess) {
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setStatus("Mapa baixado como " + fileName + ".", false);
      return;
    }
    try {
      const dir = await pickMapsDirectory();
      if (!dir) {
        return;
      }
      const handle = await dir.getFileHandle(fileName, { create: true });
      const writable = await handle.createWritable();
      await writable.write(JSON.stringify(payload, null, 2));
      await writable.close();
      setStatus("Mapa salvo em mapas/" + fileName + ".", false);
    } catch (err) {
      setStatus("Falha ao salvar mapa: " + err.message, true);
    }
  }

  function switchActiveMap(nextMapId, options) {
    const opts = options || {};
    if (!nextMapId || nextMapId === activeMapId) {
      return;
    }
    if (!worldData.maps || !worldData.maps[nextMapId]) {
      return;
    }

    activeMapId = nextMapId;
    worldData.activeMapId = nextMapId;
    closeEventModal();
    commitSelection(null);

    if (mapSelect && mapSelect.value !== nextMapId) {
      mapSelect.value = nextMapId;
    }

    const finalize = () => {
      renderAll();
      if (opts.loadGame === false) {
        return;
      }
      if (typeof api.setActiveMap === "function") {
        api.setActiveMap(activeMapId);
      } else {
        api.loadWorld(worldData);
      }
    };

    const map = getActiveMap();
    if (map && isMapStub(map, activeMapId)) {
      setStatus("Carregando mapa...", false);
      loadMapData(activeMapId)
        .then(() => {
          setStatus("", false);
          finalize();
        })
        .catch((err) => {
          setStatus("Falha ao carregar mapa: " + err.message, true);
          finalize();
        });
      return;
    }

    finalize();
  }

  mapSelect.addEventListener("change", () => {
    switchActiveMap(mapSelect.value, { loadGame: true });
  });

  function syncMapFromGame() {
    if (typeof api.getPlayerState !== "function") {
      requestAnimationFrame(syncMapFromGame);
      return;
    }
    const live = api.getPlayerState();
    const liveMapId = live && live.mapId;
    if (liveMapId && liveMapId !== activeMapId && worldData.maps && worldData.maps[liveMapId]) {
      switchActiveMap(liveMapId, { loadGame: false });
    }
    requestAnimationFrame(syncMapFromGame);
  }

  requestAnimationFrame(syncMapFromGame);

  if (placementMode) {
    placementMode.addEventListener("change", updateEditorSettings);
  }
  if (toggleGrid) {
    toggleGrid.addEventListener("change", updateEditorSettings);
  }
  if (toggleColliders) {
    toggleColliders.addEventListener("change", updateEditorSettings);
  }
  if (toggleEvents) {
    toggleEvents.addEventListener("change", updateEditorSettings);
  }
  if (toggleNpcs) {
    toggleNpcs.addEventListener("change", updateEditorSettings);
  }

  colliderForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const area = requireSelectedArea("adicionar um colisor");
    if (!area) {
      return;
    }
    placeColliderAt(area);
  });

  eventType.addEventListener("change", updateEventFormVisibility);

  eventForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const area = requireSelectedArea("adicionar um evento");
    if (!area) {
      return;
    }
    placeEventAt(area);
  });

  if (eventTargetUseSelection) {
    eventTargetUseSelection.addEventListener("click", () => {
      const target = captureTeleportTargetFromSelection();
      if (!target) {
        return;
      }
      setSavedTeleportTarget(target);
      applyTeleportTargetToFields(target, false);
      setStatus("Destino aplicado a partir da selecao.", false);
    });
  }

  if (eventTargetUseSaved) {
    eventTargetUseSaved.addEventListener("click", () => {
      if (!savedTeleportTarget) {
        setStatus("Nenhum destino salvo para usar.", true);
        return;
      }
      applyTeleportTargetToFields(savedTeleportTarget, false);
      setStatus("Destino salvo aplicado.", false);
    });
  }

  npcForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const area = requireSelectedArea("adicionar um NPC");
    if (!area) {
      return;
    }
    if (area.w !== 1 || area.h !== 1) {
      setStatus("NPC precisa de apenas um quadrado.", true);
      return;
    }
    placeNpcAt(area);
  });

  dialogForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const title = dialogTitleInput ? dialogTitleInput.value.trim() : "";
    const text = dialogTextInput ? dialogTextInput.value || "" : "";
    const dialog = {
      id: createId("dialog", title),
      title: title || "Dialogo",
      text
    };
    worldData.dialogs.push(dialog);
    if (dialogTitleInput) {
      dialogTitleInput.value = "";
    }
    if (dialogTextInput) {
      dialogTextInput.value = "";
    }
    renderDialogs();
    renderEvents();
    renderNpcs();
  });

  itemForm.addEventListener("submit", (e) => {
    e.preventDefault();
    worldData.items.push({
      id: itemId.value || "item-" + Date.now(),
      name: itemName.value || "",
      desc: itemDesc.value || ""
    });
    renderItems();
  });

  if (modalEventType) {
    modalEventType.addEventListener("change", () => {
      updateModalEventVisibility(modalEventType.value);
    });
  }
  if (eventModalApplyArea) {
    eventModalApplyArea.addEventListener("click", () => {
      if (!activeModalEvent) {
        return;
      }
      const area = requireSelectedArea("ajustar a area do evento");
      if (!area) {
        return;
      }
      activeModalEvent.rect = {
        x: area.x,
        y: area.y,
        w: area.w,
        h: area.h
      };
      updateModalAreaLabel(activeModalEvent.rect);
      applyEdits();
    });
  }
  if (modalEventTargetUseSelection) {
    modalEventTargetUseSelection.addEventListener("click", () => {
      const target = captureTeleportTargetFromSelection();
      if (!target) {
        return;
      }
      setSavedTeleportTarget(target);
      applyTeleportTargetToFields(target, true);
      setStatus("Destino aplicado no evento.", false);
    });
  }
  if (modalEventTargetUseSaved) {
    modalEventTargetUseSaved.addEventListener("click", () => {
      if (!savedTeleportTarget) {
        setStatus("Nenhum destino salvo para usar.", true);
        return;
      }
      applyTeleportTargetToFields(savedTeleportTarget, true);
      setStatus("Destino salvo aplicado no evento.", false);
    });
  }
  if (eventModalSave) {
    eventModalSave.addEventListener("click", applyModalChanges);
  }
  if (eventModalDelete) {
    eventModalDelete.addEventListener("click", deleteModalEvent);
  }
  if (eventModalClose) {
    eventModalClose.addEventListener("click", closeEventModal);
  }
  if (eventModal) {
    eventModal.addEventListener("click", (e) => {
      if (e.target && e.target.classList.contains("modal-backdrop")) {
        closeEventModal();
      }
    });
  }

  if (saveMapBtn) {
    saveMapBtn.addEventListener("click", saveActiveMap);
  }

  api.onTileSelect = (tile) => {
    if (!tile) {
      return;
    }
    commitSelection({ x: tile.x, y: tile.y, w: 1, h: 1 }, true);
  };

  updateEventFormVisibility();
  applyEditorSettingsToUI();
  setWorldData(worldData);
  initSelectionOverlay();
  startOverlaySync();
})();
