"""Gera os assets ilustrados com um gerador de imagens gratuito (Pollinations, modelo Sana) e recorta o fundo
localmente com rembg. Sem chave de API e sem custo.

Uso:  python tools/ai-assets/fetch.py [--seed N] [--skip-existing] [--out DIR] (--all | id [id ...])
Requer: pip install "rembg[cpu]" pillow numpy
Lê tools/ai-assets/manifest.json (gerado por `npm run prompts`). Os efeitos (efeitos/*) são desenhados por
tools/gen-assets.ts e ficam fora daqui.
"""
import argparse, io, json, os, ssl, sys, time, urllib.parse, urllib.request
import numpy as np
from PIL import Image, ImageEnhance

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
API = "https://image.pollinations.ai/prompt/"
ART = "dark fantasy RPG game art, anime style, highly detailed, sharp focus, dramatic rim light"
NO = "no text, no letters, no watermark, no frame"
PALE = ("cervo-espectral", "rei-galhado", "alfa-da-nevoa", "lobo-de-nevoa", "arquivista", "guardia-das-fendas")  # pedem fundo escuro

def bg(i): return "plain solid dark navy blue background" if any(p in i for p in PALE) else "plain solid white background"
ITEM = "fantasy game item art, hand-painted, highly detailed, sharp focus, no people, no character, no hands"
# categoria -> (texto do prompt, estilo, lado do canvas final, largura, altura do pedido)
def spec(a):
    i, f = a["id"], a["format"]
    if i.startswith("cacadores/") or i.startswith("npcs/"):
        return f"full body character, standing, front three-quarter view, single character, centered, {bg(i)}", ART, 192, 768, 768
    if i.startswith("monstros/"):
        return f"full body monster creature, single creature, front three-quarter view, centered, {bg(i)}", ART, 256 if a.get("optional") else 192, 768, 768
    if f == "icon": return "one single isolated object only, game inventory icon, centered, plain solid dark grey background", ITEM, 96, 512, 512
    if f == "props": return "one single isolated object only, side view, game scenery prop, centered, no ground, no base, no floor, plain solid white background", ITEM, 128, 512, 512
    if i.startswith("objetos/"): return "one single isolated object only, centered, glowing, plain solid black background", ITEM, 192, 512, 768
    if f == "tile": return "flat seamless surface texture, photographed from directly above, uniform repeating pattern filling the whole image, even lighting, no perspective, no horizon, no objects, no buildings", "dark muted colors, low contrast, detailed", 512, 512, 512
    if f == "wide": return ("opaque full scene, cinematic wide shot" if "fundo" in i else f"emblem, centered, {bg(i)}"), ART, 0, 1280, 832
    return None

CTX = ssl.create_default_context(cafile=os.environ.get("SSL_CERT_FILE") or (os.path.exists("/root/.ccr/ca-bundle.crt") and "/root/.ccr/ca-bundle.crt") or None)
def fetch(prompt, w, h, seed):
    url = API + urllib.parse.quote(prompt) + f"?width={w}&height={h}&seed={seed}&nologo=true"
    for attempt in range(6):
        try:
            data = urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "asset-tool"}), timeout=180, context=CTX).read()
            return Image.open(io.BytesIO(data)).convert("RGB")
        except Exception as e:
            print("  nova tentativa:", e, flush=True); time.sleep(8 + attempt * 6)
    raise SystemExit("o gerador não respondeu")

def brighten(img):
    """Clareia e satura: a arte sai escura e precisa ficar legível sobre mapas escuros."""
    r, g, b, al = img.split(); rgb = Image.merge("RGB", (r, g, b))
    rgb = rgb.point(lambda v: int(255 * (v / 255) ** 0.72))
    rgb = ImageEnhance.Color(ImageEnhance.Contrast(rgb).enhance(1.08)).enhance(1.2)
    return Image.merge("RGBA", (*rgb.split(), al))

_session = None
def cutout(img):
    """Recorta o assunto (modelo de segmentação local) e apaga a marca do gerador no canto."""
    global _session
    from rembg import remove, new_session
    _session = _session or new_session("isnet-general-use")
    w, h = img.size
    out = remove(img, session=_session)
    a = np.array(out); a[int(h * 0.93):, int(w * 0.62):, 3] = 0  # canto da marca d'água
    alpha = a[:, :, 3].astype(float); alpha = np.clip((alpha - 40) * 1.35, 0, 255); a[:, :, 3] = alpha.astype(np.uint8)
    out = brighten(Image.fromarray(a, "RGBA"))
    box = out.getbbox()
    return out.crop(box) if box else out

def fit(img, side, bottom=True):
    """Encaixa no canvas quadrado: centralizado na horizontal, apoiado na base."""
    img = img.copy(); img.thumbnail((side - 8, side - 8), Image.LANCZOS)
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(img, ((side - img.width) // 2, side - img.height - 4 if bottom else (side - img.height) // 2), img)
    return canvas

def seamless(img, side):
    """Textura repetível: espelha em 2x2 e escurece para não brigar com os personagens."""
    w, h = img.size; big = Image.new("RGB", (w * 2, h * 2))
    big.paste(img, (0, 0)); big.paste(img.transpose(Image.FLIP_LEFT_RIGHT), (w, 0))
    big.paste(img.transpose(Image.FLIP_TOP_BOTTOM), (0, h)); big.paste(img.transpose(Image.ROTATE_180), (w, h))
    big = big.resize((side, side), Image.LANCZOS)
    return ImageEnhance.Brightness(ImageEnhance.Contrast(big).enhance(0.75)).enhance(0.62)

def make(a, seed, out_dir):
    s = spec(a)
    if not s: return False
    extra, style, side, w, h = s
    path = os.path.join(out_dir, a["path"]); os.makedirs(os.path.dirname(path), exist_ok=True)
    def one(subject, n=0): return fetch(f"{subject}, {extra}, {style}, {NO}", w, h, seed + n)
    f, i = a["format"], a["id"]
    if f == "props":
        parts = [p.strip() for p in a["subject"].split(":", 1)[1].split(",")][:4]
        sheet = Image.new("RGBA", (side * 2, side * 2), (0, 0, 0, 0))
        for n, part in enumerate(parts): sheet.paste(fit(cutout(one(part, n)), side), ((n % 2) * side, (n // 2) * side))
        sheet.save(path)
    elif f == "tile": seamless(one(a["subject"]), side).save(path)
    elif f == "wide" and "fundo" in i: img = one(a["subject"]); img.crop((0, 0, img.width, int(img.height * 0.94))).save(path)
    elif f == "wide": cutout(one(a["subject"])).save(path)
    elif i.startswith("objetos/"): c = cutout(one(a["subject"])); c.thumbnail((side, side), Image.LANCZOS); c.save(path)
    else: fit(cutout(one(a["subject"])), side, bottom=f != "icon").save(path)
    return True

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("ids", nargs="*"); ap.add_argument("--all", action="store_true")
    ap.add_argument("--out", default=os.path.join(ROOT, "client/public/assets")); ap.add_argument("--seed", type=int, default=3)
    ap.add_argument("--skip-existing", action="store_true")
    args = ap.parse_args()
    manifest = json.load(open(os.path.join(HERE, "manifest.json")))
    todo = [a for a in manifest if (args.all and not a["id"].startswith("efeitos/")) or a["id"] in args.ids or any(a["id"].startswith(p) for p in args.ids if p.endswith("/"))]
    for a in todo:
        if args.skip_existing and os.path.exists(os.path.join(args.out, a["path"])): continue
        print("ok" if make(a, args.seed, args.out) else "pulado", a["id"], flush=True); time.sleep(1.5)

if __name__ == "__main__": main()
