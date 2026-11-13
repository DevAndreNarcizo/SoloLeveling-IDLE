"""Gera os sprites em pixel art: um gerador de imagens gratuito (Pollinations) desenha o personagem em estilo
chibi, um modelo local recorta o fundo (rembg) e o script converte para pixel art de verdade
(grade final de pixels, paleta limitada e contorno escuro). Sem chave de API e sem custo.

Uso:  python tools/ai-assets/fetch.py [--seed N] [--skip-existing] [--out DIR] (--all | id [id ...])
      um id terminado em "/" gera a pasta inteira (ex.: monstros/)
Requer: pip install "rembg[cpu]" pillow numpy
Lê tools/ai-assets/manifest.json (gerado por `npm run prompts`). Efeitos e mapas têm scripts próprios.
"""
import argparse, io, json, os, ssl, sys, time, urllib.parse, urllib.request
import numpy as np
from PIL import Image, ImageEnhance

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
API = "https://image.pollinations.ai/prompt/"
OUTLINE = (20, 14, 30, 255)
PIXEL = "16-bit JRPG pixel art game sprite, bold dark outline, flat cel shading, vivid saturated colors, bright even lighting, plain solid white background, no text"
CHIBI = "chibi character, big head, small body, two heads tall, cute proportions, full body, standing, front view, single character, centered"

def spec(a):
    """categoria -> (prompt, altura em pixels do sprite final, lado do canvas)"""
    i, f = a["id"], a["format"]
    if i.startswith("cacadores/") or i.startswith("npcs/"): return f"{a['subject']}, {CHIBI}, {PIXEL}", 52, 56
    if i.startswith("monstros/"):
        big = a.get("optional")
        return f"{a['subject']}, chibi monster, cute but menacing, full body, single creature, centered, {PIXEL}", 84 if big else 52, 88 if big else 56
    if f == "icon": return f"{a['subject']}, one single isolated object only, item icon, 16-bit pixel art, bold dark outline, vivid saturated colors, centered, no people, no person, no character, no hands, no body, plain solid white background, no text", 36, 40
    if i == "objetos/fenda": return f"{a['subject']}, one single isolated object, centered, {PIXEL.replace('white', 'black')}", 76, 80
    if i.startswith("objetos/"): return f"{a['subject']}, one single isolated object, centered, {PIXEL}", 28, 32
    return None

CTX = ssl.create_default_context(cafile=os.environ.get("SSL_CERT_FILE") or (os.path.exists("/root/.ccr/ca-bundle.crt") and "/root/.ccr/ca-bundle.crt") or None)
def fetch(prompt, w, h, seed):
    url = API + urllib.parse.quote(prompt) + f"?width={w}&height={h}&seed={seed}&nologo=true"
    for attempt in range(8):
        try:
            data = urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "asset-tool"}), timeout=180, context=CTX).read()
            return Image.open(io.BytesIO(data)).convert("RGB")
        except Exception as e:
            print("  nova tentativa:", e, flush=True); time.sleep(8 + attempt * 6)
    raise SystemExit("o gerador não respondeu")

_session = None
def cutout(img):
    """Recorta o assunto com o modelo de segmentação local e apaga a marca do gerador no canto."""
    global _session
    from rembg import remove, new_session
    _session = _session or new_session("isnet-general-use")
    w, h = img.size
    a = np.array(remove(img, session=_session)); a[int(h * 0.93):, int(w * 0.62):, 3] = 0
    return Image.fromarray(a, "RGBA")

def quality(cut, tall):
    """Nota do recorte, de 0 a 1. Recorte incompleto (só a cabeça, por exemplo) ocupa pouca altura da imagem
    ou, num personagem de corpo inteiro, fica mais largo do que alto."""
    box = Image.fromarray((np.array(cut)[:, :, 3] > 120).astype(np.uint8) * 255).getbbox()
    if not box: return 0
    w, h = box[2] - box[0], box[3] - box[1]
    score = min(1, (h / cut.height) / 0.6)
    if tall: score *= min(1, (h / w) / 1.2)
    return score

def pixel_sprite(cut, size, colors=28):
    """Recorte RGBA -> pixel art: reduz à grade final, limita a paleta e desenha o contorno escuro."""
    alpha_full = Image.fromarray((np.array(cut)[:, :, 3] > 120).astype(np.uint8) * 255)
    cut = cut.crop(alpha_full.getbbox())
    scale = min(size / cut.height, size / cut.width)
    w, h = max(1, round(cut.width * scale)), max(1, round(cut.height * scale))
    a = np.array(cut.resize((w, h), Image.BOX)); alpha = a[:, :, 3] > 120
    rgb = Image.fromarray(a[:, :, :3], "RGB")
    # clareia sprites escuros até um brilho médio mínimo, depois reforça contraste e cor
    lum = np.array(rgb.convert("L"))[alpha].mean() if alpha.any() else 128
    if lum < 105: rgb = rgb.point(lambda v, g=max(0.5, np.log(105 / 255) / np.log(max(lum, 12) / 255)): int(255 * (v / 255) ** g))
    rgb = ImageEnhance.Color(ImageEnhance.Contrast(rgb).enhance(1.15)).enhance(1.25)
    flat = np.array(rgb)[alpha]
    pal = Image.fromarray(flat.reshape(-1, 1, 3), "RGB").quantize(colors=colors, method=Image.MEDIANCUT, dither=Image.NONE)
    q = np.array(rgb.quantize(palette=pal, dither=Image.NONE).convert("RGB"))
    out = np.zeros((h + 2, w + 2, 4), np.uint8)
    out[1:-1, 1:-1, :3] = q; out[1:-1, 1:-1, 3] = alpha * 255
    op = out[:, :, 3] > 0
    nb = np.zeros_like(op); nb[1:] |= op[:-1]; nb[:-1] |= op[1:]; nb[:, 1:] |= op[:, :-1]; nb[:, :-1] |= op[:, 1:]
    out[nb & ~op] = OUTLINE
    return Image.fromarray(out, "RGBA")

def on_canvas(sprite, side, bottom=True):
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(sprite, ((side - sprite.width) // 2, side - sprite.height if bottom else (side - sprite.height) // 2), sprite)
    return canvas

def best_cut(prompt, seed, tries=4, tall=False):
    """Gera e recorta; se o recorte vier incompleto, tenta outras variações e fica com a melhor."""
    best = None
    for n in range(tries):
        cut = cutout(fetch(prompt, 768, 768, seed + n * 101))
        q = quality(cut, tall)
        if best is None or q > best[0]: best = (q, cut)
        if q >= 0.98: break
        print(f"  recorte incompleto (nota {q:.2f}), outra variação", flush=True)
    return best[1]

def make(a, seed, out_dir):
    path = os.path.join(out_dir, a["path"]); os.makedirs(os.path.dirname(path), exist_ok=True)
    if a["format"] == "props":
        # "four separate props, one per cell: a, b, c, d" -> quatro objetos numa folha 2x2
        parts = [p.strip() for p in a["subject"].split(":", 1)[1].split(",")][:4]
        side = 64; sheet = Image.new("RGBA", (side * 2, side * 2), (0, 0, 0, 0))
        for n, part in enumerate(parts):
            sp = pixel_sprite(best_cut(f"{part}, one single isolated object only, side view, game scenery prop, centered, no ground, no base, no people, {PIXEL}", seed + n), side - 4, 24)
            sheet.paste(on_canvas(sp, side), ((n % 2) * side, (n // 2) * side))
        sheet.save(path); return True
    if a["format"] == "wide":
        if "fundo" in a["id"]:  # fundo da tela de entrada: cena inteira, pixelada
            img = fetch(f"{a['subject']}, 16-bit pixel art scene, cinematic wide shot, vivid colors, no text", 1280, 832, seed)
            img = img.crop((0, 0, img.width, int(img.height * 0.94)))
            img.resize((480, round(480 * img.height / img.width)), Image.BOX).quantize(colors=64, method=Image.MEDIANCUT, dither=Image.NONE).convert("RGB").save(path)
        else: on_canvas(pixel_sprite(best_cut(f"{a['subject']}, game logo emblem, centered, {PIXEL}", seed), 92, 32), 96, bottom=False).save(path)
        return True
    s = spec(a)
    if not s: return False
    prompt, size, side = s
    tall = a["id"].startswith(("cacadores/", "npcs/"))
    on_canvas(pixel_sprite(best_cut(prompt, seed, tall=tall), size), side, bottom=a["format"] != "icon").save(path)
    return True

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("ids", nargs="*"); ap.add_argument("--all", action="store_true")
    ap.add_argument("--out", default=os.path.join(ROOT, "client/public/assets")); ap.add_argument("--seed", type=int, default=5)
    ap.add_argument("--skip-existing", action="store_true")
    args = ap.parse_args()
    manifest = json.load(open(os.path.join(HERE, "manifest.json")))
    todo = [a for a in manifest if args.all or a["id"] in args.ids or any(a["id"].startswith(p) for p in args.ids if p.endswith("/"))]
    for a in todo:
        if args.skip_existing and os.path.exists(os.path.join(args.out, a["path"])): continue
        print("ok" if make(a, args.seed, args.out) else "pulado", a["id"], flush=True); time.sleep(1.5)

if __name__ == "__main__": main()
