"""Leva ao jogo o que cloudflare_gen.py gerou (arte/cloudflare/) e monta a galeria de conferência.

Uso:  python tools/ai-assets/import_fx.py [prefixo ...]

- Folhas (grade 3x2, fundo preto): cada quadro vira uma célula de NxN; o preto vira transparência
  (alfa = brilho do pixel) e a cor é recuperada, então o efeito brilha sobre qualquer cenário.
  Todos os quadros usam o mesmo recorte, para o efeito não "pular" de posição na animação.
- Imagens de brilho (partículas): mesmo tratamento, recortadas e reduzidas.
- Imagens sólidas (fundo magenta): recorte do fundo como nos personagens.
- Saída: client/public/assets/fx/<id>.png e registro em shared/fx.json (tamanho do quadro e nº de quadros).
"""
import json, os, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from cloudflare_gen import ITEMS, OUT  # noqa: E402
from import_sheet import ANIMATED, drop_specks, remove_background, shrink  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(HERE))
DEST = os.path.join(ROOT, "client/public/assets/fx")
REG = os.path.join(ROOT, "shared/fx.json")
INSET = 0.04   # margem cortada de cada célula: some com linhas de grade que o modelo às vezes desenha
FLOOR = 28     # brilho abaixo disto é fundo

def glow_alpha(rgb):
    """Fundo preto -> transparência. Alfa = canal mais forte; a cor é dividida pelo alfa (despremultiplica)."""
    a = rgb.max(axis=2).astype(float)
    a = np.clip((a - FLOOR) / (255 - FLOOR), 0, 1)
    col = np.clip(rgb.astype(float) / np.maximum(a[..., None], 1e-3), 0, 255)
    col = np.where(a[..., None] > 0, np.minimum(col, 255), 0)
    return np.dstack([col, a * 255]).astype(np.uint8)

def kill_lines(rgba):
    """Apaga linhas retas finas e claras que atravessam o quadro inteiro (restos de grade)."""
    a = rgba[..., 3] > 0
    for axis in (0, 1):
        full = a.mean(axis=axis) > 0.9
        if axis == 0: rgba[:, full] = 0
        else: rgba[full, :] = 0
    return rgba

def fit(frames, size):
    """Recorte comum a todos os quadros (quadrado, centrado no conjunto) e redução para size x size."""
    union = np.zeros(frames[0].shape[:2], bool)
    for f in frames: union |= f[..., 3] > 8
    ys, xs = np.nonzero(union)
    if len(ys) == 0: return [Image.new("RGBA", (size, size)) for _ in frames]
    cy, cx = (ys.min() + ys.max()) / 2, (xs.min() + xs.max()) / 2
    half = max(ys.max() - ys.min(), xs.max() - xs.min()) / 2 * 1.08 + 2
    box = (int(cx - half), int(cy - half), int(cx + half), int(cy + half))
    out = []
    for f in frames:
        im = Image.fromarray(f, "RGBA").crop(box)
        # reduz pré-multiplicado (evita bordas escuras) e volta
        arr = np.array(im).astype(float); al = arr[..., 3:4] / 255
        pm = Image.fromarray(np.dstack([arr[..., :3] * al, arr[..., 3:4]]).astype(np.uint8), "RGBA").resize((size, size), Image.BOX)
        p = np.array(pm).astype(float); al2 = np.maximum(p[..., 3:4] / 255, 1e-3)
        res = np.dstack([np.clip(p[..., :3] / al2, 0, 255), p[..., 3:4]]); res[p[..., 3] < 10] = 0
        out.append(Image.fromarray(res.astype(np.uint8), "RGBA"))
    return out

def do_sheet(it, src):
    a = np.array(Image.open(src).convert("RGB")); H, W = a.shape[:2]; cw, ch = W // 3, H // 2
    ix, iy = int(cw * INSET), int(ch * INSET)
    frames = [kill_lines(glow_alpha(a[r * ch + iy:(r + 1) * ch - iy, c * cw + ix:(c + 1) * cw - ix])) for r in range(2) for c in range(3)]
    n = it["size"]; sheet = Image.new("RGBA", (n * 6, n))
    for k, f in enumerate(fit(frames, n)): sheet.alpha_composite(f, (k * n, 0))
    return sheet, 6

def do_single(it, src):
    if it["kind"] == "wide":
        return Image.open(src).convert("RGB").resize((1536, 1024), Image.LANCZOS), 1
    if it["kind"] == "solid":
        a = remove_background(Image.open(src))
    elif it["kind"] == "dark":   # sombra: fundo branco; alfa = quanto o pixel é escuro
        g = np.array(Image.open(src).convert("L")).astype(float)
        al = np.clip((255 - g - 12) / 200, 0, 1) * 0.7
        a = np.dstack([np.zeros_like(g)] * 3 + [al * 255]).astype(np.uint8)
    else:
        a = glow_alpha(np.array(Image.open(src).convert("RGB")))
    ys, xs = np.nonzero(a[..., 3] > 8)
    if len(ys) == 0: raise ValueError("imagem vazia depois de tirar o fundo")
    a = a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    n = it["size"]; h, w = a.shape[:2]; k = n / max(h, w)
    small = shrink(a, max(1, round(w * k)), max(1, round(h * k))) if it["kind"] in ("solid", "dark") else fit([a], max(round(w * k), round(h * k)))[0]
    if it["id"] == "barra-de-vida": return small, 1   # barra: mantém a proporção larga, sem moldura quadrada
    out = Image.new("RGBA", (n, n)); out.alpha_composite(small, ((n - small.width) // 2, (n - small.height) // 2))
    return out, 1

def do_solid_sheet(it, src):
    """Folha 3x2 de personagem ou objeto sobre magenta: pés na mesma linha, eixo no centro do tronco,
    mesma escala em todos os quadros (a altura mediana vira it['size'])."""
    a = remove_background(Image.open(src), fire=it.get("fire", False))
    H, W = a.shape[:2]; cw, ch = W // 3, H // 2; ix, iy = int(cw * INSET), int(ch * INSET)
    cells = []
    for r in range(2):
        for c in range(3):
            cell = drop_specks(a[r * ch + iy:(r + 1) * ch - iy, c * cw + ix:(c + 1) * cw - ix].copy())
            ys, xs = np.nonzero(cell[..., 3])
            if len(ys) == 0: raise ValueError("quadro vazio")
            top, bot = ys.min(), ys.max(); upper = ys < top + (bot - top) * 0.5
            cells.append((cell, top, bot, int(np.median(xs[upper])), xs.min(), xs.max()))
    k = it["size"] / float(np.median([c[2] - c[1] + 1 for c in cells]))
    half = max(max(c[3] - c[4], c[5] - c[3]) for c in cells) + 2; up = max(c[2] - c[1] for c in cells) + 2
    side = int(np.ceil(max(2 * half, up) * k)) + 4
    sheet = Image.new("RGBA", (side * 6, side))
    for i, (cell, top, bot, anc, _, _) in enumerate(cells):
        pad = np.pad(cell, ((up, 0), (half, half), (0, 0)))
        crop = pad[bot + 1:bot + up + 1, anc:anc + 2 * half]
        w, h = max(1, round(crop.shape[1] * k)), max(1, round(crop.shape[0] * k))
        sm = shrink(crop, w, h); sheet.alpha_composite(sm, (i * side + (side - w) // 2, side - h - 1))
    return sheet, 6, side

def do_npc(it, src):
    """NPC parado: recorte do magenta, altura it['size'], salvo junto dos outros NPCs da cidade."""
    a = drop_specks(remove_background(Image.open(src)))
    ys, xs = np.nonzero(a[..., 3])
    if len(ys) == 0: raise ValueError("imagem vazia depois de tirar o fundo")
    a = a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]; k = it["size"] / a.shape[0]
    sm = shrink(a, max(1, round(a.shape[1] * k)), it["size"])
    out = Image.new("RGBA", (sm.width + 4, sm.height + 4)); out.alpha_composite(sm, (2, 2))
    dest = os.path.join(ROOT, "client/public/assets/npcs", it["id"] + ".png"); out.save(dest)
    ids = json.load(open(ANIMATED)); key = "npcs/" + it["id"]
    if key not in ids: ids.append(key); ids.sort(); json.dump(ids, open(ANIMATED, "w"), indent=1, ensure_ascii=False); open(ANIMATED, "a").write("\n")
    print("ok", it["id"], out.size, "-> npcs/")

def main():
    args = sys.argv[1:]
    reg = json.load(open(REG)) if os.path.exists(REG) else {}
    for it in ITEMS:
        if args and not any(it["group"].startswith(p) or it["id"].startswith(p) for p in args): continue
        src = os.path.join(OUT, it["group"], it["id"] + ".png")
        if not os.path.exists(src): continue
        try:
            if it["kind"] == "npc": do_npc(it, src); continue
            side = 0
            if it["kind"] in ("walk", "loop"): img, frames, side = do_solid_sheet(it, src)
            elif it["kind"] == "sheet": img, frames = do_sheet(it, src)
            else: img, frames = do_single(it, src)
        except ValueError as e: print("ERRO", it["id"], e); continue
        os.makedirs(DEST, exist_ok=True); img.save(os.path.join(DEST, it["id"] + ".png"))
        reg[it["id"]] = {"group": it["group"], "frame": side or it["size"] or img.width, "frames": frames}
        print("ok", it["id"], img.size)
    json.dump(dict(sorted(reg.items())), open(REG, "w"), indent=1, ensure_ascii=False); open(REG, "a").write("\n")

if __name__ == "__main__": main()
