from pathlib import Path
from PIL import Image

# ====== CONFIG ======
ROOT_IN = Path(r".")            # pasta raiz para procurar .jpg (use "." ou um caminho)
ROOT_OUT = Path("output_cuts")  # onde salvar os recortes

WHITE_THRESHOLD = 200  # 235~252
NONWHITE_TOL = 2       # 2~10 se houver ruído/compressão
# ====================


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

    # bounds entre separadores
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


def process_one_file(jpg_path: Path):
    rel = jpg_path.relative_to(ROOT_IN)
    out_dir = ROOT_OUT / rel.parent / jpg_path.stem
    out_dir.mkdir(parents=True, exist_ok=True)

    img = Image.open(jpg_path).convert("RGBA")
    bounds = find_vertical_slices(img)

    if not bounds:
        return 0, f"SEM CORTES: {jpg_path}"

    saved = 0
    for i, (x0, x1) in enumerate(bounds, start=1):
        crop = img.crop((x0, 0, x1, img.height))
        crop.save(out_dir / f"session_{i:02d}.png")
        saved += 1

    return saved, f"OK ({saved}): {jpg_path} -> {out_dir}"


def main():
    ROOT_OUT.mkdir(exist_ok=True)

    jpg_files = list(ROOT_IN.rglob("*.jpg")) + list(ROOT_IN.rglob("*.JPG")) + list(ROOT_IN.rglob("*.jpeg")) + list(ROOT_IN.rglob("*.JPEG"))
    if not jpg_files:
        print(f"Nenhum .jpg/.jpeg encontrado em: {ROOT_IN.resolve()}")
        return

    total_files = 0
    total_slices = 0

    for f in jpg_files:
        total_files += 1
        try:
            saved, msg = process_one_file(f)
            total_slices += saved
            print(msg)
        except Exception as e:
            print(f"ERRO: {f} -> {e}")

    print("\n===== RESUMO =====")
    print(f"Arquivos processados: {total_files}")
    print(f"Sessões exportadas:   {total_slices}")
    print(f"Saída em:             {ROOT_OUT.resolve()}")


if __name__ == "__main__":
    main()
