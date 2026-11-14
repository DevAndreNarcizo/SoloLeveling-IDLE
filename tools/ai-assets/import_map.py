"""Importa um mapa gerado por IA (ChatGPT etc.) para o jogo.

Uso:  python tools/ai-assets/import_map.py <imagem> <mapa>
      ex.: python tools/ai-assets/import_map.py ~/Downloads/minas.png minas-ocas
Mapas: cidade, minas-ocas, bosque-cinzento, cidadela-afundada, forja-extinta, arena.

Corta a imagem na proporção do mundo do jogo (sem distorcer), reduz para o tamanho do mundo, para que cada pixel
do mapa tenha o mesmo tamanho na tela que os pixels dos personagens, e guarda o original em originais/.
Depois disso, maps.py deixa de redesenhar esse mapa. Requer: pillow.
"""
import argparse, os, shutil
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
WORLD = (1920, 1280)  # shared/content.ts: HUNT_MAP e CITY_MAP
NAMES = ["cidade", "minas-ocas", "bosque-cinzento", "cidadela-afundada", "forja-extinta", "arena"]

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("image"); ap.add_argument("map", choices=NAMES)
    args = ap.parse_args()
    w, h = WORLD
    im = Image.open(args.image).convert("RGB")
    W, H = im.size
    if W / H > w / h: cw, ch = round(H * w / h), H      # mais largo que o mundo: corta as laterais
    else: cw, ch = W, round(W * h / w)                   # mais alto: corta em cima e embaixo
    x0, y0 = (W - cw) // 2, (H - ch) // 2
    out = im.crop((x0, y0, x0 + cw, y0 + ch)).resize((w, h), Image.BOX)
    path = os.path.join(ROOT, "client/public/assets/mapas", args.map + ".png")
    # Paleta de 256 cores: metade do tamanho do arquivo, sem diferença visível em pixel art.
    out.quantize(colors=256, method=Image.MEDIANCUT, dither=Image.NONE).save(path, optimize=True)
    orig_dir = os.path.join(HERE, "originais"); os.makedirs(orig_dir, exist_ok=True)
    ext = os.path.splitext(args.image)[1].lower() or ".png"
    dest = os.path.join(orig_dir, f"mapas-{args.map}{ext}")
    if os.path.abspath(args.image) != os.path.abspath(dest):   # reimportar a partir do próprio original não pode apagá-lo
        for old in os.listdir(orig_dir):
            if old.startswith(f"mapas-{args.map}."): os.remove(os.path.join(orig_dir, old))
        shutil.copyfile(args.image, dest)
    print(f"ok mapas/{args.map}: {w}x{h} (cortado de {cw}x{ch}), {os.path.getsize(path) // 1024} KB")

if __name__ == "__main__": main()
