"""Gera efeitos, cenário e interface pelo Cloudflare Workers AI (modelos FLUX, cota gratuita diária).

Uso:  python tools/ai-assets/cloudflare_gen.py [prefixo ...] [--force] [--list]
      ex.: python tools/ai-assets/cloudflare_gen.py golpes          (só os golpes)
           python tools/ai-assets/cloudflare_gen.py                 (tudo que ainda não foi gerado)

- Folhas de efeito (grade 3x2, 6 quadros, fundo preto) usam o FLUX.2 klein, que respeita a grade.
- Imagens únicas usam o FLUX.1 schnell (mais barato).
- Os originais ficam em arte/cloudflare/<grupo>/<id>.png; depois rode import_fx.py para levar ao jogo.
- A chave NÃO fica no código: o proxy do ambiente injeta o token nas chamadas a api.cloudflare.com.
  Fora deste ambiente, defina CLOUDFLARE_API_TOKEN.
- Cota gratuita: 10.000 neurons/dia (renova 00:00 UTC). Folha 1536x1024 no klein ~156; imagem no schnell ~96.
"""
import base64, json, os, subprocess, sys, time

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "arte", "cloudflare")
API = "https://api.cloudflare.com/client/v4"

SHEET = ("16-bit pixel art visual effect sprite sheet for a top-down 2D RPG. A strict grid of exactly 3 columns and 2 rows "
         "of equal square cells: 6 animation frames read left to right, then top to bottom. The effect is centered in every "
         "cell at the same position and the same scale, and never touches or crosses the cell edges. {frames} "
         "Crisp hard-edged pixels, no anti-aliasing, vivid glowing colors, plain solid pure black background, "
         "no text, no grid lines, no characters, no ground.")
SINGLE_GLOW = ("16-bit pixel art game sprite of {subject}, single object centered with wide empty margin, crisp hard-edged "
               "pixels, no anti-aliasing, vivid glowing colors, plain solid pure black background, no text.")
SINGLE_SOLID = ("16-bit pixel art game sprite of {subject}, single object centered with wide empty margin, crisp hard-edged "
                "pixels, 1-pixel dark outline, no anti-aliasing, plain solid magenta (#FF00FF) background, no text, no shadow.")

def fx(i, group, subject, frames, size):
    return {"id": i, "group": group, "kind": "sheet", "size": size,
            "prompt": SHEET.format(frames=f"The effect: {subject}. Frames: {frames}.")}

def one(i, group, subject, size, solid=False):
    return {"id": i, "group": group, "kind": "solid" if solid else "glow", "size": size,
            "prompt": (SINGLE_SOLID if solid else SINGLE_GLOW).format(subject=subject)}

# Personagens e objetos sólidos: fundo magenta (o recorte é o mesmo dos caçadores).
SOLID_SHEET = ("16-bit pixel art sprite sheet for a top-down 2D RPG, in the style of classic JRPG overworld sprites, detailed "
               "shading, muted dark fantasy palette. A strict grid of exactly 3 columns and 2 rows of equal square cells: 6 "
               "animation frames read left to right, then top to bottom. {subject}. {frames} The same subject, the same size "
               "and the same colors in every cell, centered, standing on the same ground line near the bottom of the cell, "
               "never touching or crossing the cell edges. Crisp hard-edged pixels, 1-pixel dark outline, no anti-aliasing. "
               "Plain solid magenta (#FF00FF) background, no text, no grid lines, no shadows, no ground.")
WALK = ("Frames: a side-view walk cycle facing RIGHT, the whole body seen from the side, legs clearly alternating, "
        "every frame facing right")

def walker(i, group, subject, size):
    return {"id": i, "group": group, "kind": "walk", "size": size, "prompt": SOLID_SHEET.format(subject="The subject: " + subject, frames=WALK)}

def prop(i, group, subject, frames, size, fire=False):
    return {"id": i, "group": group, "kind": "loop", "size": size, "fire": fire,
            "prompt": SOLID_SHEET.format(subject="The subject: " + subject, frames="Frames: " + frames)}

def npc(i, subject):
    return {"id": i, "group": "npcs", "kind": "npc", "size": 84,
            "prompt": ("16-bit pixel art full-body character sprite for a top-down 2D RPG, in the style of classic JRPG overworld "
                       f"sprites, about three heads tall, detailed shading, muted dark fantasy palette: {subject}. One single "
                       "character standing still, facing the camera, centered with wide empty margin, crisp hard-edged pixels, "
                       "1-pixel dark outline, no anti-aliasing, plain solid magenta (#FF00FF) background, no text, no shadow, no ground.")}

GROW = "1 small and faint, 2 growing, 3 full size and brightest, 4 starting to fade, 5 breaking into small pixel fragments, 6 only a few faint fragments left"
LOOP = "6 frames of a seamless looping animation with small changes between frames, same size in every frame"
ITEMS = [
    # ---------- Golpes ----------
    fx("golpe-lamina", "golpes", "a single open crescent moon shaped sword slash arc, like a half moon curve, NOT a closed circle, white core with violet and lilac edges, curving from top left to bottom right", GROW, 96),
    fx("golpe-vulto", "golpes", "two thin crossing dagger slash lines forming an X, white core with cyan and teal edges", GROW, 96),
    fx("garra", "golpes", "three parallel diagonal claw scratch marks, white core with orange-red edges", GROW, 96),
    fx("golpe-chefe", "golpes", "a huge heavy crescent slash arc with a shockwave, white core with crimson red and dark red edges", GROW, 160),
    fx("impacto", "golpes", "a small star-shaped hit spark burst with short rays, white center with pale yellow rays", GROW, 64),
    fx("critico", "golpes", "a big golden star-shaped critical hit burst with long sharp rays and sparkles, white center", GROW, 112),
    # ---------- Projéteis (loop) ----------
    fx("orbe-arcano", "projeteis", "a small glowing violet energy orb with a short violet trail pointing to the left behind it, flying to the right", LOOP, 48),
    fx("flecha", "projeteis", "a single horizontal wooden arrow pointing to the right with a glowing amber tip and a faint amber trail", LOOP, 48),
    fx("espinho", "projeteis", "a large curved dark green thorn spike, thick at the base and sharp at the tip, pointing to the right, with a short glowing green trail behind it, filling most of the cell width", LOOP, 48),
    fx("lodo", "projeteis", "a blob of glowing sickly green slime flying to the right with dripping green trail", LOOP, 48),
    fx("bola-de-fogo", "projeteis", "a large bright fireball with a white-yellow core, flying to the right, with long orange and red flames trailing to the left, filling most of the cell width", LOOP, 64),
    # ---------- Habilidades ----------
    fx("golpe-pesado", "habilidades", "a massive vertical downward sword slash with a violet shockwave ring at the bottom", GROW, 144),
    fx("giro-de-aco", "habilidades", "a full circular spinning blade ring of steel-white and violet slash arcs seen from above", GROW, 192),
    fx("postura-de-ferro", "habilidades", "a protective aura of steel-grey hexagonal armor plates closing around an empty center", GROW, 144),
    fx("perfurar", "habilidades", "a straight horizontal piercing thrust streak pointing right, white core with cyan edges and small sparks", GROW, 128),
    fx("leque-de-laminas", "habilidades", "a fan of ten small silver throwing daggers flying outward in all directions from the center with cyan trails", GROW, 192),
    fx("passo-sombrio", "habilidades", "a burst of dark purple shadow smoke with fast horizontal cyan speed lines", GROW, 144),
    fx("lanca-arcana", "habilidades", "a long horizontal spear of violet arcane energy pointing right with a bright white core", GROW, 144),
    fx("explosao-arcana", "habilidades", "a big round arcane explosion of violet and cyan energy with a bright white center and flying sparks", GROW, 208),
    fx("barreira", "habilidades", "a round glowing cyan magic shield bubble dome with a hexagon pattern", GROW, 144),
    fx("tiro-certeiro", "habilidades", "a thin glowing golden energy arrow of light flying to the right with a long fading golden light trail behind it and a bright white star flare at its tip, sleek and sharp, made of light", GROW, 128),
    fx("chuva-de-flechas", "habilidades", "many glowing amber arrows falling diagonally from the sky onto a circular area, with small impact sparks", GROW, 192),
    fx("foco", "habilidades", "a golden crosshair target reticle with a ring and four ticks, rotating and shrinking toward the center", GROW, 112),
    # ---------- Eventos ----------
    fx("morte", "eventos", "a monster dissolving into dark purple shadow smoke puffs and violet sparks rising upward", GROW, 128),
    fx("morte-chefe", "eventos", "a huge explosion of crimson and gold light with a shockwave ring and flying sparks", GROW, 224),
    fx("surgimento", "eventos", "a dark violet rift tear opening in the ground with shadow smoke rising from it", GROW, 112),
    fx("surgimento-chefe", "eventos", "a huge crimson pillar of light bursting up from a glowing red rift in the ground", GROW, 224),
    fx("subir-nivel", "eventos", "a golden pillar of light rising from a golden ring on the ground with small stars floating up", GROW, 160),
    fx("cura", "eventos", "soft green healing light with small green plus signs and sparkles floating upward", GROW, 112),
    fx("evocacao", "eventos", "a violet shadow pillar rising from a dark ground circle with cyan sparks, a shadow soldier being summoned", GROW, 160),
    # ---------- Cenário ----------
    fx("portal", "cenario", "a vertical oval dimensional rift portal with a black center and swirling violet and cyan energy edges", LOOP, 160),
    one("resquicio", "cenario", "a small dark puddle of shadow essence on the ground with a faint violet glow, seen from above", 48, solid=True),
    one("brasa", "cenario", "one tiny glowing orange ember spark", 16),
    one("bolha", "cenario", "one tiny glowing cyan water bubble", 16),
    one("nevoa", "cenario", "a soft small pale grey mist puff", 32),
    one("vagalume", "cenario", "one tiny glowing yellow-green firefly light", 16),
    one("poeira", "cenario", "one tiny pale beige dust speck", 12),
    one("faisca", "cenario", "one tiny glowing violet four-pointed star twinkle", 16),
    # ---------- Interface ----------
    one("barra-de-vida", "interface", "an empty horizontal health bar frame, a long thin dark metal rectangle frame with small rivets, wide and short", 64, solid=True),
    {"id": "sombra", "group": "interface", "kind": "dark", "size": 48,
     "prompt": "a single soft dark grey oval drop shadow blob seen from above, wider than tall, centered, on a plain pure white background, nothing else"},
    one("logo", "interface", "a game logo emblem without any letters: a violet portal tear behind a hooded hunter silhouette, framed by angular dark metal borders", 256, solid=True),
    one("favicon", "interface", "a vertical glowing violet and cyan dimensional rift tear, a crack of light in space", 64),
    # ---------- Moradores (figurantes que andam pela cidade) ----------
    walker("guarda", "moradores", "a city guard in a steel helmet and dark blue tabard, carrying a spear upright", 80),
    walker("aldea", "moradores", "a village woman in a brown dress and white apron carrying a woven basket", 76),
    walker("crianca", "moradores", "a small child in a green tunic and short brown hair, running happily", 56),
    walker("velho", "moradores", "an old bearded man in a grey hooded robe walking slowly with a wooden cane", 74),
    walker("carregador", "moradores", "a stocky porter in a sleeveless shirt carrying a wooden crate on his shoulder", 78),
    walker("monge", "moradores", "a hooded monk in a long dark violet robe with a small glowing lantern", 78),
    # ---------- Animais (cidade e fendas) ----------
    walker("gato", "animais", "a small black cat with yellow eyes and its tail up", 28),
    walker("cao", "animais", "a scruffy brown stray dog", 36),
    walker("corvo", "animais", "a black crow hopping on the ground, pecking", 26),
    walker("pombo", "animais", "a grey pigeon walking and bobbing its head", 22),
    walker("rato", "animais", "a grey mine rat with a long pink tail", 22),
    walker("coelho", "animais", "a grey forest rabbit hopping", 26),
    walker("caranguejo", "animais", "a small teal crab walking sideways with raised claws", 24),
    walker("salamandra", "animais", "a small black lizard with glowing orange spots on its back", 26),
    # ---------- Objetos do cenário ----------
    prop("tocha", "objetos", "a tall iron torch stand with a burning flame on top", "6 frames of the flame flickering in a seamless loop; the iron stand never changes", 72, fire=True),
    prop("fogueira", "objetos", "a small campfire of crossed logs inside a ring of stones with burning flames", "6 frames of the flames flickering in a seamless loop; the logs and stones never change", 64, fire=True),
    prop("cristal-de-fenda", "objetos", "a cluster of large glowing violet and cyan crystals growing from a dark rock", "6 frames of the crystals pulsing brighter and dimmer in a seamless loop; the shape never changes", 72),
    prop("caldeirao", "objetos", "a black iron cauldron on short legs, full of bubbling glowing green liquid", "6 frames of the liquid bubbling in a seamless loop; the cauldron never changes", 56),
    prop("estandarte", "objetos", "a tall wooden pole with a long violet banner bearing a silver portal emblem", "6 frames of the banner waving gently in the wind in a seamless loop; the pole never changes", 96),
    prop("bau", "objetos", "a closed wooden treasure chest with dark iron bands and a golden lock", "6 identical frames of the chest, completely still", 48),
    prop("quadro-de-avisos", "objetos", "a wooden notice board on two posts with pinned paper notes", "6 identical frames of the board, completely still", 72),
    prop("lampiao", "objetos", "an iron street lamp post with a glass lantern glowing warm yellow on top", "6 frames of the lantern light flickering softly in a seamless loop; the post never changes", 96),
    # NPCs com função: gerados no PixelLab (arte/pixellab/npcs/); a função npc() fica para gerar outros aqui.
    {"id": "fundo-login", "group": "interface", "kind": "wide", "size": 0,
     "prompt": "16-bit pixel art wide game title screen background: a lone hooded hunter seen from behind standing before a huge glowing violet rift in the middle of a dark night city plaza, shadows of creatures rising from the ground around, dark fantasy, detailed, crisp pixels, no text"},
]

CACHE = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".cloudflare_account")  # ID da conta (não é segredo), fora do git

def account():
    if os.environ.get("CLOUDFLARE_ACCOUNT_ID"): return os.environ["CLOUDFLARE_ACCOUNT_ID"]
    if os.path.exists(CACHE): return open(CACHE).read().strip()
    for _ in range(6):
        r = call(["curl", "-sS", "-m", "30", API + "/accounts"])
        if r.get("result"): open(CACHE, "w").write(r["result"][0]["id"]); return r["result"][0]["id"]
        time.sleep(20)  # a API de contas limita a frequência
    raise SystemExit("não consegui ler a conta do Cloudflare: " + str(r.get("errors")))

def call(cmd):
    if os.environ.get("CLOUDFLARE_API_TOKEN"): cmd = cmd + ["-H", "Authorization: Bearer " + os.environ["CLOUDFLARE_API_TOKEN"]]
    out = subprocess.run(cmd, capture_output=True, text=True).stdout
    try: return json.loads(out)
    except json.JSONDecodeError: return {"success": False, "errors": [out[:300]]}

def generate(acc, it):
    if it["kind"] in ("sheet", "wide", "walk", "loop"):
        url = f"{API}/accounts/{acc}/ai/run/@cf/black-forest-labs/flux-2-klein-4b"
        return call(["curl", "-sS", "-m", "240", "-X", "POST", url, "-F", "prompt=" + it["prompt"], "-F", "width=1536", "-F", "height=1024"])
    url = f"{API}/accounts/{acc}/ai/run/@cf/black-forest-labs/flux-1-schnell"
    return call(["curl", "-sS", "-m", "240", "-X", "POST", url, "-H", "Content-Type: application/json",
                 "-d", json.dumps({"prompt": it["prompt"], "steps": 8})])

def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    todo = [it for it in ITEMS if not args or any(it["group"].startswith(p) or it["id"].startswith(p) for p in args)]
    if "--list" in sys.argv:
        for it in todo: print(it["group"], it["id"], it["kind"])
        return
    acc = account()
    for it in todo:
        dest = os.path.join(OUT, it["group"], it["id"] + ".png")
        if os.path.exists(dest) and "--force" not in sys.argv: print("pulado:", it["id"]); continue
        for attempt in range(3):
            r = generate(acc, it)
            img = (r.get("result") or {}).get("image")
            if img: break
            print("  falhou", it["id"], r.get("errors")); time.sleep(5)
        else: continue
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        from PIL import Image
        import io
        Image.open(io.BytesIO(base64.b64decode(img))).convert("RGB").save(dest)
        print("ok", it["group"], it["id"], flush=True)
        time.sleep(3)  # espaça as chamadas para não esbarrar no limite de frequência

if __name__ == "__main__": main()
