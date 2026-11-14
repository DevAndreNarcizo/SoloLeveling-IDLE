"""Importa uma imagem única de personagem parado (NPC) gerada por IA, com fundo magenta ou transparente.

Uso:  python tools/ai-assets/import_image.py <imagem> <id do asset> [--height N] [--cell N] [--mist] [--fire]
      ex.: python tools/ai-assets/import_image.py ~/Downloads/isis.png npcs/guardia-das-fendas

Remove o fundo, recorta o personagem, reduz para a altura do jogo (padrão: 88 px) e salva em
client/public/assets/<id>.png. O id entra em shared/animated.json para ser exibido em tamanho real.
"""
import argparse, json, os
import numpy as np
from import_sheet import ROOT, ANIMATED, remove_background, drop_specks, shrink

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("image"); ap.add_argument("id")
    ap.add_argument("--height", type=int, default=88); ap.add_argument("--mist", action="store_true"); ap.add_argument("--fire", action="store_true")
    ap.add_argument("--cell", type=int, default=0, help="a imagem é uma folha 4x4: usa só este quadro (1 a 16)")
    args = ap.parse_args()
    from PIL import Image
    a = remove_background(Image.open(args.image), args.mist, args.fire)
    if args.cell:
        H, W = a.shape[:2]; i = args.cell - 1
        a = a[(i // 4) * H // 4:(i // 4 + 1) * H // 4, (i % 4) * W // 4:(i % 4 + 1) * W // 4].copy()
    a = drop_specks(a)
    ys, xs = np.nonzero(a[:, :, 3])
    crop = a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    k = args.height / crop.shape[0]
    small = shrink(crop, max(1, round(crop.shape[1] * k)), args.height)
    out = Image.new("RGBA", (small.width + 4, small.height + 4), (0, 0, 0, 0)); out.alpha_composite(small, (2, 2))
    path = os.path.join(ROOT, "client/public/assets", args.id + ".png"); out.save(path)
    ids = json.load(open(ANIMATED))
    if args.id not in ids: ids.append(args.id); ids.sort()
    json.dump(ids, open(ANIMATED, "w"), indent=1, ensure_ascii=False); open(ANIMATED, "a").write("\n")
    print(f"ok {args.id}: {out.width}x{out.height}")

if __name__ == "__main__": main()
