import json
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
MAPS_DIR = os.path.join(ROOT, "core", "mapas")
SOURCE_DIR = os.path.join(
    ROOT, "core", "pokefirered-master", "pokefirered-master", "data", "maps"
)
LOCKS_PATH = os.path.join(ROOT, "data", "portal-locks.json")


def load_json(path):
    with open(path, "r", encoding="utf-8") as handle:
        return json.load(handle)


def to_int(value, default=0):
    try:
        return int(value)
    except Exception:
        return default


def dump_json(data):
    return json.dumps(data, indent=4, ensure_ascii=True, separators=(",", ":  "))


def load_portal_locks():
    if not os.path.exists(LOCKS_PATH):
        return []
    try:
        data = load_json(LOCKS_PATH)
    except Exception as exc:
        print("Failed to read portal locks:", exc)
        return []
    if not isinstance(data, list):
        return []
    return [row for row in data if isinstance(row, dict)]


def match_lock(locks, kind, from_map, to_map, direction):
    for lock in locks:
        if lock.get("kind") and lock.get("kind") != kind:
            continue
        if lock.get("fromMap") and lock.get("fromMap") != from_map:
            continue
        if lock.get("toMap") and lock.get("toMap") != to_map:
            continue
        if lock.get("direction") and lock.get("direction") != direction:
            continue
        return lock
    return None


def get_map_size(map_data):
    if not isinstance(map_data, dict):
        return None
    meta = map_data.get("meta") if isinstance(map_data.get("meta"), dict) else {}
    width = map_data.get("width") or map_data.get("tilesX") or meta.get("width")
    height = map_data.get("height") or map_data.get("tilesY") or meta.get("height")
    width = to_int(width, 0)
    height = to_int(height, 0)
    if width <= 0 or height <= 0:
        return None
    return width, height


def rect_for_connection(direction, offset, size, dest_size):
    width, height = size
    dest_width, dest_height = dest_size
    if direction == "up":
        min_x = max(0, offset)
        max_x = min(width - 1, offset + dest_width - 1)
        if max_x < min_x:
            return None
        return {"x": min_x, "y": 0, "w": max_x - min_x + 1, "h": 1}
    if direction == "down":
        min_x = max(0, offset)
        max_x = min(width - 1, offset + dest_width - 1)
        if max_x < min_x:
            return None
        return {"x": min_x, "y": height - 1, "w": max_x - min_x + 1, "h": 1}
    if direction == "left":
        min_y = max(0, offset)
        max_y = min(height - 1, offset + dest_height - 1)
        if max_y < min_y:
            return None
        return {"x": 0, "y": min_y, "w": 1, "h": max_y - min_y + 1}
    if direction == "right":
        min_y = max(0, offset)
        max_y = min(height - 1, offset + dest_height - 1)
        if max_y < min_y:
            return None
        return {"x": width - 1, "y": min_y, "w": 1, "h": max_y - min_y + 1}
    return None


def main():
    if not os.path.isdir(MAPS_DIR):
        print("Missing maps dir:", MAPS_DIR)
        return 1
    if not os.path.isdir(SOURCE_DIR):
        print("Missing source dir:", SOURCE_DIR)
        return 1

    locks = load_portal_locks()

    map_const_to_id = {}
    source_by_id = {}

    for entry in sorted(os.listdir(SOURCE_DIR)):
        map_path = os.path.join(SOURCE_DIR, entry, "map.json")
        if not os.path.isfile(map_path):
            continue
        try:
            data = load_json(map_path)
        except Exception as exc:
            print("Failed to read source map:", entry, exc)
            continue
        map_const = data.get("id")
        if map_const:
            map_const_to_id[map_const] = entry
        source_by_id[entry] = {
            "const": map_const,
            "warps": list(data.get("warp_events") or []),
            "connections": list(data.get("connections") or []),
        }

    size_by_id = {}
    map_files = []
    for file_name in sorted(os.listdir(MAPS_DIR)):
        if not file_name.endswith(".json"):
            continue
        if file_name == "index.json":
            continue
        map_path = os.path.join(MAPS_DIR, file_name)
        try:
            data = load_json(map_path)
        except Exception as exc:
            print("Failed to read map:", file_name, exc)
            continue
        map_id = data.get("id") or os.path.splitext(file_name)[0]
        size = get_map_size(data)
        if size:
            size_by_id[map_id] = size
        map_files.append((map_path, map_id, data))

    total_warps = 0
    total_connections = 0
    skipped_warps = 0
    skipped_connections = 0
    updated = 0

    for map_path, map_id, data in map_files:
        source = source_by_id.get(map_id)
        new_events = []

        if source:
            warps = source.get("warps") or []
            for idx, warp in enumerate(warps, start=1):
                dest_const = warp.get("dest_map")
                dest_id = map_const_to_id.get(dest_const)
                if not dest_id:
                    skipped_warps += 1
                    continue
                dest_warps = source_by_id.get(dest_id, {}).get("warps") or []
                dest_warp_index = to_int(warp.get("dest_warp_id"), 0)
                target_x = 0
                target_y = 0
                if 0 <= dest_warp_index < len(dest_warps):
                    target_x = to_int(dest_warps[dest_warp_index].get("x"), 0)
                    target_y = to_int(dest_warps[dest_warp_index].get("y"), 0)
                event = {
                    "id": "warp-%s-%s" % (map_id, idx),
                    "type": "door",
                    "rect": {
                        "x": to_int(warp.get("x"), 0),
                        "y": to_int(warp.get("y"), 0),
                        "w": 1,
                        "h": 1,
                    },
                    "once": False,
                    "target": {
                        "mapId": dest_id,
                        "x": target_x,
                        "y": target_y,
                        "facing": "down",
                    },
                    "meta": {
                        "source": "warp",
                        "destMap": dest_const,
                        "destWarpId": warp.get("dest_warp_id"),
                        "elevation": warp.get("elevation"),
                    },
                }
                lock = match_lock(locks, "warp", map_id, dest_id, None)
                if lock and lock.get("flag"):
                    event["lockFlag"] = lock.get("flag")
                    event["lockMessage"] = lock.get("message") or ""
                new_events.append(event)
                total_warps += 1

            connections = source.get("connections") or []
            for idx, conn in enumerate(connections, start=1):
                direction = str(conn.get("direction") or "").lower()
                dest_const = conn.get("map")
                dest_id = map_const_to_id.get(dest_const)
                if not dest_id:
                    skipped_connections += 1
                    continue
                size = size_by_id.get(map_id)
                dest_size = size_by_id.get(dest_id)
                if not size or not dest_size:
                    skipped_connections += 1
                    continue
                offset = to_int(conn.get("offset"), 0)
                rect = rect_for_connection(direction, offset, size, dest_size)
                if not rect:
                    skipped_connections += 1
                    continue
                event = {
                    "id": "conn-%s-%s-%s" % (map_id, direction or "link", idx),
                    "type": "door",
                    "rect": rect,
                    "once": False,
                    "target": {
                        "mapId": dest_id,
                        "connection": {"direction": direction, "offset": offset},
                    },
                    "meta": {
                        "source": "connection",
                        "direction": direction,
                        "offset": offset,
                        "destMap": dest_const,
                    },
                }
                lock = match_lock(locks, "connection", map_id, dest_id, direction)
                if lock and lock.get("flag"):
                    event["lockFlag"] = lock.get("flag")
                    event["lockMessage"] = lock.get("message") or ""
                new_events.append(event)
                total_connections += 1

        data["events"] = new_events
        data["npcs"] = []

        with open(map_path, "w", encoding="ascii", newline="\n") as handle:
            handle.write(dump_json(data))
            handle.write("\n")
        updated += 1

    print(
        "Updated maps:",
        updated,
        "warps:",
        total_warps,
        "connections:",
        total_connections,
        "skipped warps:",
        skipped_warps,
        "skipped connections:",
        skipped_connections,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
