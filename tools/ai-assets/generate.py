"""Gera assets com Stable Diffusion local (CPU ou GPU), sem custo e sem serviço externo.

Uso:  python tools/ai-assets/generate.py [--out DIR] [--seed N] id [id ...]
      python tools/ai-assets/generate.py --all
Lê tools/ai-assets/manifest.json (gerado por `npm run prompts`).
Modelo: All-In-One-Pixel-Model (Stable Diffusion 1.5 treinado em pixel art, licença CreativeML OpenRAIL-M) com LCM-LoRA para poucos passos.
"""
import argparse, json, os, sys
from collections import deque
import numpy as np
import torch
from PIL import Image
from diffusers import LCMScheduler, StableDiffusionPipeline

MODEL = os.environ.get("SD_MODEL", "PublicPrompts/All-In-One-Pixel-Model")
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
STYLE = "pixelsprite, pixel art, 16-bit, dark fantasy"
NEGATIVE = "photo, realistic, 3d render, blurry, gradient, text, letters, watermark, signature, frame, multiple views, cropped"
BG = "centered, plain flat grey background"
# formato -> (complemento do prompt, lado final em pixels, remove o fundo?)
FORMATS = {
    "image": ("full body game sprite, " + BG, 64, True),
    "icon": ("one single item, game inventory icon, " + BG, 48, True),
    "tile": ("16bitscene, seamless ground texture, top view, flat, low contrast", 128, False),
    "props": ("one single game scenery object, " + BG, 64, True),
    "wide": ("16bitscene, wide night scene", 384, False),
}

def load():
    pipe = StableDiffusionPipeline.from_pretrained(MODEL, torch_dtype=torch.float32, safety_checker=None)
    pipe.scheduler = LCMScheduler.from_config(pipe.scheduler.config)
    pipe.load_lora_weights("latent-consistency/lcm-lora-sdv1-5")
    pipe.fuse_lora()
    pipe.to("cuda" if torch.cuda.is_available() else "cpu")
    pipe.set_progress_bar_config(disable=True)
    return pipe

def tileable(pipe):
    """Convoluções circulares: a textura repete sem emenda."""
    for m in list(pipe.unet.modules()) + list(pipe.vae.modules()):
        if isinstance(m, torch.nn.Conv2d): m.padding_mode = "circular"

def remove_background(img: Image.Image, tol=38) -> Image.Image:
    """Torna transparente o fundo liso ligado às bordas."""
    a = np.asarray(img.convert("RGB")).astype(int); h, w, _ = a.shape
    corners = np.array([a[0, 0], a[0, -1], a[-1, 0], a[-1, -1]]); bg = np.median(corners, axis=0)
    close = np.abs(a - bg).sum(axis=2) < tol * 3
    seen = np.zeros((h, w), bool); q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if close[y, x]: seen[y, x] = True; q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if close[y, x] and not seen[y, x]: seen[y, x] = True; q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and close[ny, nx] and not seen[ny, nx]: seen[ny, nx] = True; q.append((ny, nx))
    out = np.dstack([a.astype(np.uint8), np.where(seen, 0, 255).astype(np.uint8)])
    return Image.fromarray(out, "RGBA")

def pixelate(img: Image.Image, side: int, colors=28, cut=False) -> Image.Image:
    """Reduz para a grade de pixels final e limita a paleta: vira pixel art de verdade."""
    w, h = img.size; small = img.convert("RGB").resize((side, round(side * h / w)), Image.BOX)
    small = small.quantize(colors=colors, method=Image.MEDIANCUT, dither=Image.NONE).convert("RGB")
    return remove_background(small) if cut else small

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("ids", nargs="*"); ap.add_argument("--all", action="store_true")
    ap.add_argument("--out", default=os.path.join(ROOT, "client/public/assets")); ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--steps", type=int, default=6); ap.add_argument("--tiles", dest="tiles", action="store_true", default=None, help="só texturas de chão")
    ap.add_argument("--no-tiles", dest="tiles", action="store_false", help="tudo menos texturas de chão")
    ap.add_argument("--skip-existing", action="store_true", help="não refaz o que já existe (retomar)")
    ap.add_argument("--raw", action="store_true", help="salva também a imagem original")
    args = ap.parse_args()
    manifest = {a["id"]: a for a in json.load(open(os.path.join(HERE, "manifest.json")))}
    # Objetos abstratos e efeitos saem melhor desenhados por código (tools/gen-assets.ts).
    skip = ("objetos/", "efeitos/")
    ids = [i for i, a in manifest.items() if a["format"] in FORMATS and not i.startswith(skip)] if args.all else args.ids
    if args.tiles is not None: ids = [i for i in ids if (manifest[i]["format"] == "tile") == args.tiles]
    pipe = load(); circular = False
    for i in ids:
        a = manifest[i]
        if a["format"] not in FORMATS: print("pulado (folha animada):", i); continue
        extra, side, cut = FORMATS[a["format"]]
        if (a["format"] == "tile") != circular:
            if circular: sys.exit("gere as texturas de chão numa execução separada")
            tileable(pipe); circular = True
        wide = a["format"] == "wide"
        path = os.path.join(args.out, a["path"]); os.makedirs(os.path.dirname(path), exist_ok=True)
        if args.skip_existing and os.path.exists(path): continue
        def gen(subject, n=0):
            g = torch.Generator().manual_seed(args.seed + n)
            return pipe(f"{subject}, {extra}, {STYLE}", negative_prompt=NEGATIVE, num_inference_steps=args.steps, guidance_scale=1.5,
                        width=768 if wide else 512, height=512, generator=g).images[0]
        if a["format"] == "props":
            # "four separate props, one per cell: a, b, c, d" -> quatro imagens numa folha 2x2
            parts = [p.strip() for p in a["subject"].split(":", 1)[1].split(",")][:4]
            out = Image.new("RGBA", (side * 2, side * 2), (0, 0, 0, 0))
            for n, part in enumerate(parts): out.paste(pixelate(gen(part, n), side, cut=True), ((n % 2) * side, (n // 2) * side))
            out.save(path)
        else:
            img = gen(a["subject"])
            if args.raw: img.save(path.replace(".png", ".raw.png"))
            pixelate(img, side, cut=cut).save(path)
        print("ok", i, flush=True)

if __name__ == "__main__": main()
