"""Gera ícones e objetos pequenos pelo PixelLab (endpoint create-image-pixflux) a partir das descrições do manifesto.

Uso:  python tools/ai-assets/pixellab_icons.py [prefixo ...] [--force] [--dry]
      ex.: python tools/ai-assets/pixellab_icons.py icones/itens/pocao
           python tools/ai-assets/pixellab_icons.py icones           (todos os ícones)

- Cada imagem custa 1 geração (medido em 2026-11). Antes de cada uma o script consulta o saldo e para se acabar.
- A chave NÃO fica no código: o proxy do ambiente injeta o cabeçalho Authorization nas chamadas a api.pixellab.ai.
  Fora deste ambiente, defina PIXELLAB_TOKEN.
- Já gerados (registrados em originais/pixellab/) são pulados, a menos que se use --force.
"""
import base64, json, os, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
HERE = os.path.dirname(os.path.abspath(__file__))
OUT_ORIG = os.path.join(HERE, "originais", "pixellab")
API = "https://api.pixellab.ai/v2"
# Tamanho em que cada formato aparece no jogo: gerar já na medida evita pixels esticados.
SIZE = {"icon": (40, 40), "image": (64, 64)}
STYLE = "dark fantasy RPG game icon, 16-bit pixel art, single large object centered and filling most of the image, crisp pixels, readable at small size"
# Ajustes por ícone: objetos compridos na vertical ficam finos demais num quadrado de 40 px.
OVERRIDE = {
    "icones/itens/arma-lamina": "a steel longsword with a golden crossguard, placed diagonally from bottom-left to top-right, wide blade, weapon only",
    "icones/itens/arma-arcanista": "a short dark metal staff with a big glowing violet crystal on top, placed diagonally from bottom-left to top-right",
    "icones/menu/status": "a bright silver-blue hunter portrait bust in a round frame with a small golden plus sign, light colors",
    "icones/menu/fendas": "a swirling violet and cyan vortex portal ring, glowing, spiral",
    "icones/itens/arma-atirador": "a wooden recurve bow with one arrow, placed diagonally, weapon only",
}

def call(method, path, body=None):
    cmd = ["curl", "-sS", "-m", "180", "-X", method, API + path, "-H", "Content-Type: application/json"]
    if os.environ.get("PIXELLAB_TOKEN"): cmd += ["-H", "Authorization: Bearer " + os.environ["PIXELLAB_TOKEN"]]
    if body is not None: cmd += ["-d", json.dumps(body)]
    out = subprocess.run(cmd, capture_output=True, text=True).stdout
    try: return json.loads(out)
    except json.JSONDecodeError: raise SystemExit("resposta inesperada: " + out[:300])

def remaining():
    b = call("GET", "/balance")
    return b["subscription"]["generations"] + b["credits"]["usd"] * 100  # crédito em dólar só como folga

def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    force, dry = "--force" in sys.argv, "--dry" in sys.argv
    manifest = json.load(open(os.path.join(HERE, "manifest.json")))
    todo = [m for m in manifest if m.get("format") in SIZE and (not args or any(m["id"].startswith(p) for p in args))]
    os.makedirs(OUT_ORIG, exist_ok=True)
    for m in todo:
        orig = os.path.join(OUT_ORIG, m["id"].replace("/", "-") + ".png")
        if os.path.exists(orig) and not force: print("pulado (já gerado):", m["id"]); continue
        if dry: print("geraria:", m["id"], "-", m["subject"]); continue
        if remaining() < 1: raise SystemExit("saldo do PixelLab acabou; parei antes de " + m["id"])
        w, h = SIZE[m["format"]]
        r = call("POST", "/create-image-pixflux", {
            "description": f"{OVERRIDE.get(m['id'], m['subject'])}. {STYLE}", "image_size": {"width": w, "height": h},
            "no_background": True, "outline": "single color black outline", "shading": "detailed shading", "detail": "highly detailed",
        })
        if "image" not in r: print("falhou:", m["id"], r); continue
        png = base64.b64decode(r["image"]["base64"])
        open(orig, "wb").write(png)
        dest = os.path.join(ROOT, "client/public/assets", m["id"] + ".png")
        os.makedirs(os.path.dirname(dest), exist_ok=True); open(dest, "wb").write(png)
        print("ok", m["id"], r.get("usage"))
    print("saldo restante:", remaining())

if __name__ == "__main__": main()
