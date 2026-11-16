"""Monta a galeria de conferência dos assets gerados no Cloudflare (arte/galeria/index.html).

Uso:  python tools/ai-assets/gallery.py <pasta de saída>
A pasta recebe index.html, os sprites do jogo (fx/) e miniaturas dos originais (orig/), prontos para publicar.
"""
import html, json, os, shutil, sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from cloudflare_gen import ITEMS, OUT  # noqa: E402
ROOT = os.path.dirname(os.path.dirname(HERE))
REG = json.load(open(os.path.join(ROOT, "shared/fx.json")))

GROUPS = {"golpes": "Golpes", "projeteis": "Projéteis", "habilidades": "Habilidades", "eventos": "Eventos",
          "cenario": "Cenário", "interface": "Interface"}
NAMES = {
    "golpe-lamina": "Corte da Lâmina", "golpe-vulto": "Corte duplo do Vulto", "garra": "Garra de monstro",
    "golpe-chefe": "Golpe de chefe", "impacto": "Impacto", "critico": "Crítico",
    "orbe-arcano": "Orbe arcano", "flecha": "Flecha", "espinho": "Espinho", "lodo": "Bola de lodo", "bola-de-fogo": "Bola de fogo",
    "golpe-pesado": "Golpe Pesado", "giro-de-aco": "Giro de Aço", "postura-de-ferro": "Postura de Ferro", "perfurar": "Perfurar",
    "leque-de-laminas": "Leque de Lâminas", "passo-sombrio": "Passo Sombrio", "lanca-arcana": "Lança Arcana",
    "explosao-arcana": "Explosão Arcana", "barreira": "Barreira", "tiro-certeiro": "Tiro Certeiro",
    "chuva-de-flechas": "Chuva de Flechas", "foco": "Foco",
    "morte": "Morte de monstro", "morte-chefe": "Morte de chefe", "surgimento": "Surgimento", "surgimento-chefe": "Surgimento de chefe",
    "subir-nivel": "Subir de nível", "cura": "Cura", "evocacao": "Evocação de eco",
    "portal": "Fenda da cidade", "resquicio": "Resquício", "brasa": "Brasa", "bolha": "Bolha", "nevoa": "Névoa",
    "vagalume": "Vagalume", "poeira": "Poeira", "faisca": "Faísca",
    "barra-de-vida": "Barra de vida", "sombra": "Sombra", "logo": "Logotipo", "favicon": "Favicon", "fundo-login": "Fundo do login",
}

CSS = """
:root { --bg:#0e0c16; --panel:#17142a; --line:#2b2546; --fg:#ece8f8; --muted:#9a93b5; --accent:#a98bff;
  --display:"Silkscreen", ui-monospace, monospace; --body:"Inter", system-ui, sans-serif; color-scheme: dark; }
body { background: var(--bg); color: var(--fg); font-family: var(--body); padding-block: 28px 56px;
  padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
.wrap { max-width: 1180px; margin: 0 auto; display: grid; gap: 34px; }
header { display: grid; gap: 8px; }
h1 { font-family: var(--display); font-size: clamp(26px, 5vw, 40px); margin: 0; letter-spacing: .02em; text-wrap: balance; }
header p { margin: 0; color: var(--muted); max-width: 68ch; line-height: 1.55; }
.stats { display: flex; flex-wrap: wrap; gap: 8px; }
.stat { font-size: 12px; border: 1px solid var(--line); border-radius: 999px; padding: 4px 10px; color: var(--muted); font-variant-numeric: tabular-nums; }
.stat b { color: var(--fg); }
h2 { font-family: var(--display); font-size: 18px; margin: 0 0 12px; color: var(--accent); letter-spacing: .04em; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
.card { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; overflow: hidden; display: grid; min-width: 0; }
.stage { height: 170px; display: grid; place-items: center; background:
  conic-gradient(#1d1930 25%, #221d38 0 50%, #1d1930 0 75%, #221d38 0) 0 0 / 16px 16px; image-rendering: pixelated; }
.sprite { image-rendering: pixelated; background-repeat: no-repeat; }
.meta { padding: 10px 12px; display: grid; gap: 4px; border-top: 1px solid var(--line); }
.meta b { font-size: 14px; }
.meta span { font-size: 12px; color: var(--muted); font-variant-numeric: tabular-nums; }
details { font-size: 12px; color: var(--muted); }
details img { display: block; margin-top: 6px; border-radius: 4px; }
summary { cursor: pointer; }
summary:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.wide .stage { height: auto; padding: 10px; }
.wide { grid-column: 1 / -1; }
@media (prefers-reduced-motion: reduce) { .sprite { animation: none !important; } }
"""

def main():
    out = sys.argv[1]
    for d in ("fx", "orig"): os.makedirs(os.path.join(out, d), exist_ok=True)
    sections, kf, n_ok = [], [], 0
    for g, gname in GROUPS.items():
        cards = []
        for it in [i for i in ITEMS if i["group"] == g]:
            r = REG.get(it["id"]); src = os.path.join(OUT, g, it["id"] + ".png")
            if not r or not os.path.exists(src): continue
            n_ok += 1
            shutil.copy(os.path.join(ROOT, "client/public/assets/fx", it["id"] + ".png"), os.path.join(out, "fx", it["id"] + ".png"))
            o = Image.open(src).convert("RGB"); o.thumbnail((480, 480)); o.save(os.path.join(out, "orig", it["id"] + ".jpg"), quality=85)
            f, n = r["frame"], r["frames"]
            name = html.escape(NAMES.get(it["id"], it["id"]))
            if it["kind"] == "wide":
                stage = f'<img src="fx/{it["id"]}.png" alt="{name}" style="width:100%;border-radius:4px">'
                cls = "card wide"
            else:
                scale = max(1, min(4, 150 // max(f, 1)))
                style = f'width:{f}px;height:{f}px;background-image:url(fx/{it["id"]}.png);transform:scale({scale});'
                if n > 1:
                    kf.append(f'@keyframes a-{it["id"]} {{ to {{ background-position: -{f * n}px 0 }} }}')
                    style += f'animation:a-{it["id"]} {0.12 * n:.2f}s steps({n}) infinite;'
                stage = f'<div class="sprite" role="img" aria-label="{name}" style="{style}"></div>'
                cls = "card"
            kind = "6 quadros" if n > 1 else "imagem única"
            cards.append(f'<article class="{cls}"><div class="stage">{stage}</div><div class="meta"><b>{name}</b>'
                         f'<span>{kind} · {f}×{f} px · {html.escape(it["id"])}.png</span>'
                         f'<details><summary>Ver original do Cloudflare</summary><img src="orig/{it["id"]}.jpg" alt="Original de {name}" loading="lazy"></details>'
                         f'</div></article>')
        if cards: sections.append(f'<section><h2>{gname}</h2><div class="grid">{"".join(cards)}</div></section>')
    page = f"""<title>Umbral Idle Efeitos</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&family=Silkscreen&display=swap">
<style>{CSS}{chr(10).join(kf)}</style>
<div class="wrap">
<header><h1>Umbral Idle Efeitos</h1>
<p>Efeitos, cenário e interface gerados pelo Cloudflare Workers AI (modelos FLUX) e convertidos para o jogo. Cada quadro mostra o sprite animado no tamanho de uso, ampliado para conferência; o original de cada um está logo abaixo.</p>
<div class="stats"><span class="stat"><b>{n_ok}</b> de {len(ITEMS)} prontos</span><span class="stat">Fundo xadrez = transparência</span></div></header>
{"".join(sections)}
</div>"""
    open(os.path.join(out, "index.html"), "w").write(page)
    print("galeria:", n_ok, "itens")

if __name__ == "__main__": main()
