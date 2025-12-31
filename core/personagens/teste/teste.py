from pathlib import Path
from PIL import Image
import requests
import time
import os

# ========= CONFIG =========
ROOT_IN = Path(r".")                 # raiz onde procurar .jpg/.jpeg
ROOT_OUT = Path("output_cuts")       # onde salvar os recortes
WHITE_THRESHOLD = 200                # 235~252
NONWHITE_TOL = 2                     # 2~10 se houver ruído
REMOVE_BG_ENDPOINT = "https://api.remove.bg/v1.0/removebg"
SLEEP_BETWEEN_CALLS = 0.4            # evita estourar rate limit
TIMEOUT = 60                         # segundos
# ==========================

API_KEY = os.getenv("REMOVE_BG_API_KEY")
if not API_KEY:
    raise SystemExit(
        "Defina a variável de ambiente REMOVE_BG_API_KEY antes de rodar.\n"
        "PowerShell: $env:REMOVE_BG_API_KEY='SUA_CHAVE_AQUI'"
    )

def is_white(px):
    r, g, b = px[:3]
    return r >= WHITE_THRESHOLD and g >= WHITE_THRESHOLD and b >= WHITE_THRESHOLD

def find_vertical_slices(img_rgba: Image.Image):
    w, h = img_rgba.size
    pix = img_rgba.load()

    # coluna separadora = quase toda branca
    is_sep_col = [False] * w
    for x in range(w):
        nonwhite = 0
        for y in range(h):
            if not is_white(pix[x, y]):
                nonwhite += 1
                if nonwhite > NONWHITE_TOL:
                    break
        if nonwhite <= NONWHITE_TOL:
            is_sep_col[x] = True

    bounds = []
    x = 0
    while x < w and is_sep_col[x]:
        x += 1
    start = x

    while x < w:
        if is_sep_col[x]:
            end = x
            if end - start > 1:
                bounds.append((start, end))
            while x < w and is_sep_col[x]:
                x += 1
            start = x
        else:
            x += 1

    if start < w:
        bounds.append((start, w))

    return bounds

def remove_bg_inplace(png_path: Path):
    """
    Envia a imagem ao remove.bg e sobrescreve o arquivo com a versão sem fundo.
    Mantém backup em *_orig.png
    """
    backup = png_path.with_name(png_path.stem + "_orig.png")

    # se já tem backup, assume que já processou (evita gastar créditos)
    if backup.exists():
        return True, f"SKIP (já processado): {png_path.name}"

    # faz backup
    png_path.replace(backup)

    with open(backup, "rb") as f:
        resp = requests.post(
            REMOVE_BG_ENDPOINT,
            files={"image_file": f},
            data={"size": "auto"},
            headers={"X-Api-Key": API_KEY},
            timeout=TIMEOUT,
        )

    if resp.status_code == requests.codes.ok:
        png_path.write_bytes(resp.content)
        return True, f"OK remove.bg: {png_path.name}"
    else:
        # restaura original se falhar
        backup.replace(png_path)
        return False, f"ERRO remove.bg ({resp.status_code}): {resp.text[:200]}"

def process_one_jpg(jpg_path: Path):
    rel = jpg_path.relative_to(ROOT_IN)
    out_dir = ROOT_OUT / rel.parent / jpg_path.stem
    out_dir.mkdir(parents=True, exist_ok=True)

    img = Image.open(jpg_path).convert("RGBA")
    bounds = find_vertical_slices(img)

    if not bounds:
        return 0, 0, f"SEM CORTES: {jpg_path}"

    # 1) cortar
    session_paths = []
    for i, (x0, x1) in enumerate(bounds, start=1):
        crop = img.crop((x0, 0, x1, img.height))
        out_path = out_dir / f"session_{i:02d}.png"
        crop.save(out_path)
        session_paths.append(out_path)

    # 2) enviar cada session para remove.bg e sobrescrever
    ok_count = 0
    fail_count = 0
    for p in session_paths:
        ok, msg = remove_bg_inplace(p)
        print("   ", msg)
        if ok:
            ok_count += 1
        else:
            fail_count += 1
        time.sleep(SLEEP_BETWEEN_CALLS)

    return len(session_paths), ok_count, f"OK: {jpg_path} -> {out_dir} (sessions={len(session_paths)}, removed_bg_ok={ok_count}, fail={fail_count})"

def main():
    ROOT_OUT.mkdir(exist_ok=True)

    jpg_files = []
    for ext in ("*.jpg", "*.JPG", "*.jpeg", "*.JPEG", "*.png", "*.PNG"):
        jpg_files.extend(ROOT_IN.rglob(ext))

    if not jpg_files:
        print(f"Nenhum .jpg/.jpeg encontrado em: {ROOT_IN.resolve()}")
        return

    total_files = 0
    total_sessions = 0
    total_removed_ok = 0

    for f in jpg_files:
        total_files += 1
        try:
            sessions, removed_ok, msg = process_one_jpg(f)
            total_sessions += sessions
            total_removed_ok += removed_ok
            print(msg)
        except Exception as e:
            print(f"ERRO: {f} -> {e}")

    print("\n===== RESUMO =====")
    print(f"Arquivos .jpg processados: {total_files}")
    print(f"Sessões geradas:           {total_sessions}")
    print(f"remove.bg OK:              {total_removed_ok}")
    print(f"Saída em:                  {ROOT_OUT.resolve()}")

if __name__ == "__main__":
    main()
