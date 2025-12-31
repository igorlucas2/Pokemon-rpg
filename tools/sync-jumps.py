import json
import os
import re
import struct
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
MAPS_DIR = os.path.join(ROOT, "core", "mapas")
PFR_ROOT = os.path.join(ROOT, "core", "pokefirered-master", "pokefirered-master")
SOURCE_DIR = os.path.join(PFR_ROOT, "data", "maps")
LAYOUTS_PATH = os.path.join(PFR_ROOT, "data", "layouts", "layouts.json")
TILESETS_HEADERS_PATH = os.path.join(PFR_ROOT, "src", "data", "tilesets", "headers.h")
METATILES_PATH = os.path.join(PFR_ROOT, "src", "data", "tilesets", "metatiles.h")
BEHAVIORS_PATH = os.path.join(PFR_ROOT, "include", "constants", "metatile_behaviors.h")

PRIMARY_METATILES = 640
TILE_INDEX_MASK = 0x03FF
BEHAVIOR_MASK = 0x01FF

JUMP_NAME_TO_DIR = {
    "MB_JUMP_EAST": "right",
    "MB_JUMP_WEST": "left",
    "MB_JUMP_NORTH": "up",
    "MB_JUMP_SOUTH": "down",
}


def load_json(path):
    with open(path, "r", encoding="utf-8") as handle:
        return json.load(handle)


def dump_json(data):
    return json.dumps(data, indent=4, ensure_ascii=True, separators=(",", ":  "))


def parse_jump_behaviors(path):
    pattern = re.compile(r"#define\s+(MB_JUMP_(?:EAST|WEST|NORTH|SOUTH))\s+([0-9A-Fa-fx]+)")
    values = {}
    with open(path, "r", encoding="utf-8") as handle:
        for line in handle:
            match = pattern.search(line)
            if not match:
                continue
            values[match.group(1)] = int(match.group(2), 0)
    jump_by_value = {}
    for name, direction in JUMP_NAME_TO_DIR.items():
        value = values.get(name)
        if value is None:
            continue
        jump_by_value[value] = direction
    return jump_by_value


def parse_metatile_attr_paths(path):
    pattern = re.compile(
        r'const\s+u32\s+(gMetatileAttributes_[A-Za-z0-9_]+)\[\]\s*=\s*INCBIN_U32\("([^"]+)"\);'
    )
    mapping = {}
    with open(path, "r", encoding="utf-8") as handle:
        for line in handle:
            match = pattern.search(line)
            if not match:
                continue
            mapping[match.group(1)] = match.group(2)
    return mapping


def parse_tileset_attr_symbols(path):
    tileset_re = re.compile(r"const\s+struct\s+Tileset\s+(gTileset_[A-Za-z0-9_]+)\s*=")
    attr_re = re.compile(r"\.metatileAttributes\s*=\s*(gMetatileAttributes_[A-Za-z0-9_]+)")
    mapping = {}
    tileset_name = None
    with open(path, "r", encoding="utf-8") as handle:
        for line in handle:
            match = tileset_re.match(line)
            if match:
                tileset_name = match.group(1)
                continue
            if tileset_name:
                attr_match = attr_re.search(line)
                if attr_match:
                    mapping[tileset_name] = attr_match.group(1)
                if line.strip().startswith("};"):
                    tileset_name = None
    return mapping


def resolve_attr_path(tileset_name, tileset_attrs, attr_paths):
    if not tileset_name:
        return None
    attr_symbol = tileset_attrs.get(tileset_name)
    if not attr_symbol:
        return None
    rel_path = attr_paths.get(attr_symbol)
    if not rel_path:
        return None
    return os.path.join(PFR_ROOT, rel_path.replace("/", os.sep))


def load_attrs(path, cache):
    if not path:
        return None
    if path in cache:
        return cache[path]
    if not os.path.isfile(path):
        return None
    with open(path, "rb") as handle:
        data = handle.read()
    count = len(data) // 4
    attrs = struct.unpack("<%dI" % count, data[: count * 4])
    cache[path] = attrs
    return attrs


def load_blocks(path, width, height):
    if not os.path.isfile(path):
        return None
    with open(path, "rb") as handle:
        data = handle.read()
    expected = width * height * 2
    if len(data) < expected:
        return None
    return struct.unpack("<%dH" % (width * height), data[:expected])


def build_source_index():
    map_const_to_id = {}
    source_by_id = {}
    for entry in sorted(os.listdir(SOURCE_DIR)):
        map_path = os.path.join(SOURCE_DIR, entry, "map.json")
        if not os.path.isfile(map_path):
            continue
        try:
            data = load_json(map_path)
        except Exception:
            continue
        map_const = data.get("id")
        if map_const:
            map_const_to_id[map_const] = entry
        source_by_id[entry] = data
    return map_const_to_id, source_by_id


def main():
    if not os.path.isdir(MAPS_DIR):
        print("Missing maps dir:", MAPS_DIR)
        return 1
    if not os.path.isdir(SOURCE_DIR):
        print("Missing source dir:", SOURCE_DIR)
        return 1
    if not os.path.isfile(LAYOUTS_PATH):
        print("Missing layouts:", LAYOUTS_PATH)
        return 1

    jump_by_value = parse_jump_behaviors(BEHAVIORS_PATH)
    if not jump_by_value:
        print("Missing jump behavior values.")
        return 1

    attr_paths = parse_metatile_attr_paths(METATILES_PATH)
    tileset_attrs = parse_tileset_attr_symbols(TILESETS_HEADERS_PATH)
    layouts_data = load_json(LAYOUTS_PATH)
    layout_by_id = {
        entry.get("id"): entry
        for entry in (layouts_data.get("layouts") or [])
        if isinstance(entry, dict) and entry.get("id")
    }
    map_const_to_id, source_by_id = build_source_index()

    attr_cache = {}
    updated = 0
    total_jumps = 0
    skipped = 0

    for file_name in sorted(os.listdir(MAPS_DIR)):
        if not file_name.endswith(".json") or file_name == "index.json":
            continue
        map_path = os.path.join(MAPS_DIR, file_name)
        try:
            data = load_json(map_path)
        except Exception:
            skipped += 1
            continue
        map_id = data.get("id") or os.path.splitext(file_name)[0]

        source = source_by_id.get(map_id)
        if not source:
            meta = data.get("meta") if isinstance(data.get("meta"), dict) else {}
            source_id = map_const_to_id.get(meta.get("sourceMapId"))
            if source_id:
                source = source_by_id.get(source_id)
        if not source:
            skipped += 1
            continue

        layout_id = source.get("layout") or data.get("meta", {}).get("layoutId")
        layout = layout_by_id.get(layout_id)
        if not layout:
            skipped += 1
            continue

        width = int(layout.get("width") or 0)
        height = int(layout.get("height") or 0)
        if width <= 0 or height <= 0:
            skipped += 1
            continue

        blockdata_rel = layout.get("blockdata_filepath")
        blockdata_path = os.path.join(PFR_ROOT, str(blockdata_rel or "").replace("/", os.sep))
        blocks = load_blocks(blockdata_path, width, height)
        if not blocks:
            skipped += 1
            continue

        primary_attrs_path = resolve_attr_path(
            layout.get("primary_tileset"), tileset_attrs, attr_paths
        )
        secondary_attrs_path = resolve_attr_path(
            layout.get("secondary_tileset"), tileset_attrs, attr_paths
        )
        primary_attrs = load_attrs(primary_attrs_path, attr_cache)
        secondary_attrs = load_attrs(secondary_attrs_path, attr_cache)
        if primary_attrs is None or secondary_attrs is None:
            skipped += 1
            continue

        jumps = []
        for idx, block in enumerate(blocks):
            tile_id = block & TILE_INDEX_MASK
            if tile_id == TILE_INDEX_MASK:
                continue
            if tile_id >= PRIMARY_METATILES:
                attrs = secondary_attrs
                attr_idx = tile_id - PRIMARY_METATILES
            else:
                attrs = primary_attrs
                attr_idx = tile_id
            if attr_idx < 0 or attr_idx >= len(attrs):
                continue
            behavior = attrs[attr_idx] & BEHAVIOR_MASK
            direction = jump_by_value.get(behavior)
            if not direction:
                continue
            x = idx % width
            y = idx // width
            jumps.append({"x": x, "y": y, "dir": direction})

        data["jumps"] = jumps

        with open(map_path, "w", encoding="ascii", newline="\n") as handle:
            handle.write(dump_json(data))
            handle.write("\n")

        updated += 1
        total_jumps += len(jumps)

    print("Updated maps:", updated, "jumps:", total_jumps, "skipped:", skipped)
    return 0


if __name__ == "__main__":
    sys.exit(main())
