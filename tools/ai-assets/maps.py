"""Monta os mapas do jogo em pixel art: terreno gerado por código (chão, trilhas, manchas, paredes de borda)
com os objetos de cenário de mapas/<mapa>-objetos.png posicionados nas bordas. O centro fica livre para a luta.

Uso: python tools/ai-assets/maps.py   (requer pillow e numpy; rode depois de fetch.py)
Cada mapa sai com metade do tamanho do mundo do jogo e é exibido ampliado 2x (pixels nítidos).
"""
import math, os
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "client/public/assets/mapas")
HUNT = (800, 550)   # mundo 1600x1100
CITY = (700, 500)   # mundo 1400x1000
# NPCs da cidade em coordenadas do mundo (shared/content.ts): caminhos levam até eles
NPCS = [(700, 260), (380, 520), (1020, 520), (700, 760)]

def noise(rng, w, h, cells, octaves=3, falloff=0.5):
    """Ruído fractal suave em [0,1]."""
    out = np.zeros((h, w)); amp, total = 1.0, 0.0
    for o in range(octaves):
        c = cells * 2 ** o
        g = (rng.random((c + 3, c + 3)) * 255).astype(np.uint8)
        big = np.asarray(Image.fromarray(g).resize((w + 2 * w // c + 2, h + 2 * h // c + 2), Image.BICUBIC), float) / 255
        out += big[:h, :w] * amp; total += amp; amp *= falloff
    out /= total
    return (out - out.min()) / max(1e-6, out.max() - out.min())

def tones(v, palette):
    """Posteriza um campo 0..1 em poucos tons: é isso que dá a cara de pixel art."""
    idx = np.clip((v * len(palette)).astype(int), 0, len(palette) - 1)
    return np.array(palette, np.uint8)[idx]

def edge_dist(w, h):
    y, x = np.mgrid[0:h, 0:w]
    return np.minimum(np.minimum(x, w - 1 - x), np.minimum(y, h - 1 - y)).astype(float)

def paint(img, mask, color): img[mask] = color
def blend(img, mask, color, t): img[mask] = (img[mask] * (1 - t) + np.array(color) * t).astype(np.uint8)

def wall(img, rng, thick, palette, line=(14, 10, 20)):
    """Parede irregular em volta do mapa, com contorno e sombra projetada no chão."""
    h, w = img.shape[:2]
    d = edge_dist(w, h) + (noise(rng, w, h, 10, 2) - 0.5) * thick * 0.9
    inside = d < thick
    rock = noise(rng, w, h, 28, 2)
    img[inside] = tones(rock, palette)[inside]
    blend(img, (d >= thick + 1.5) & (d < thick + 7), (0, 0, 0), 0.32)
    paint(img, (d >= thick) & (d < thick + 1.5), line)
    return inside

def curve_mask(w, h, rng, width, amp=0.16, vertical=False):
    """Faixa sinuosa que cruza o mapa (trilha, trilho ou rachadura)."""
    n = h if vertical else w
    t = np.arange(n)
    ph, ph2 = rng.random() * 6.28, rng.random() * 6.28
    c = (w if vertical else h) / 2 + (w if vertical else h) * amp * (np.sin(t / n * 5.2 + ph) + 0.5 * np.sin(t / n * 11 + ph2))
    y, x = np.mgrid[0:h, 0:w]
    dist = np.abs((x if vertical else y) - (c[y] if vertical else c[x]))
    return dist < width / 2, dist, c

def speckles(img, rng, n, color, mask=None, size=(1, 2)):
    h, w = img.shape[:2]
    for _ in range(n):
        x, y, s = rng.integers(0, w - 3), rng.integers(0, h - 3), rng.integers(size[0], size[1] + 1)
        if mask is not None and not mask[y, x]: continue
        img[y:y + s, x:x + s] = color

def paving(img, size, line, strength=0.5, stagger=True, mask=None):
    """Rejunte de piso de pedras."""
    h, w = img.shape[:2]
    y, x = np.mgrid[0:h, 0:w]
    row = y // size
    off = (row % 2) * size if stagger else 0
    grid = (y % size == 0) | ((x + off) % (size * 2) == 0)
    if mask is not None: grid &= mask
    blend(img, grid, line, strength)

def ring(img, cx, cy, r, t, color):
    h, w = img.shape[:2]
    y, x = np.mgrid[0:h, 0:w]
    d = np.hypot(x - cx, y - cy)
    paint(img, (d >= r - t / 2) & (d < r + t / 2), color)

def place_props(img, name, rng, free, count, center_clear):
    """Espalha os objetos de cenário (folha 2x2) onde `free` é verdadeiro, fora do centro, do fundo para a frente."""
    path = os.path.join(OUT, f"{name}-objetos.png")
    if not os.path.exists(path): print("  (sem objetos de cenário para", name + ")"); return
    sheet = Image.open(path).convert("RGBA"); c = sheet.width // 2
    props = []
    for i in range(4):
        cell = sheet.crop(((i % 2) * c, (i // 2) * c, (i % 2) * c + c, (i // 2) * c + c)); box = cell.getbbox()
        if box: props.append(cell.crop(box))
    if not props: return
    h, w = img.shape[:2]; spots = []
    for _ in range(4000):
        if len(spots) >= count: break
        x, y = int(rng.integers(20, w - 20)), int(rng.integers(30, h - 8))
        if not free[y, x] or math.hypot(x - w / 2, y - h / 2) < center_clear: continue
        if any(math.hypot(x - a, y - b) < 46 for a, b, _ in spots): continue
        spots.append((x, y, int(rng.integers(0, len(props)))))
    canvas = Image.fromarray(img, "RGB").convert("RGBA")
    for x, y, k in sorted(spots, key=lambda s: s[1]):
        p = props[k]
        sh = Image.new("RGBA", (p.width, 7), (0, 0, 0, 0)); a = np.array(sh)
        yy, xx = np.mgrid[0:7, 0:p.width]
        a[((xx - p.width / 2) / (p.width / 2)) ** 2 + ((yy - 3) / 3.5) ** 2 <= 1] = (0, 0, 0, 90)
        canvas.alpha_composite(Image.fromarray(a, "RGBA"), (max(0, x - p.width // 2), max(0, min(h - 7, y - 4))))
        canvas.alpha_composite(p, (max(0, min(w - p.width, x - p.width // 2)), max(0, y - p.height)))
    img[:] = np.array(canvas.convert("RGB"))

def save(name, img):
    os.makedirs(OUT, exist_ok=True)
    Image.fromarray(img, "RGB").save(os.path.join(OUT, name + ".png")); print("ok mapas/" + name)

def border_free(w, h, inside, lo, hi):
    """Faixa junto à parede onde os objetos de cenário podem ficar."""
    d = edge_dist(w, h)
    return ~inside & (d > lo) & (d < hi)

def minas():
    rng = np.random.default_rng(41); w, h = HUNT
    img = tones(noise(rng, w, h, 9), [(74, 54, 40), (88, 64, 46), (100, 74, 52), (112, 84, 60)])
    blend(img, noise(rng, w, h, 6, 2) > 0.66, (150, 78, 34), 0.45)                      # manchas de ferrugem
    track, dist, c = curve_mask(w, h, rng, 22)
    blend(img, track, (58, 42, 32), 0.6)
    x = np.arange(w)[None, :].repeat(h, 0)
    paint(img, track & (x % 9 < 3), (92, 62, 38))                                        # dormentes
    paint(img, (np.abs(dist - 7) < 1), (150, 150, 160))                                  # trilhos
    speckles(img, rng, 900, (130, 100, 74)); speckles(img, rng, 500, (56, 40, 30))
    inside = wall(img, rng, 34, [(40, 30, 26), (52, 38, 32), (64, 48, 38), (78, 58, 46)])
    place_props(img, "minas-ocas", rng, border_free(w, h, inside, 30, 120) & ~track, 22, 190)
    save("minas-ocas", img)

def bosque():
    rng = np.random.default_rng(42); w, h = HUNT
    img = tones(noise(rng, w, h, 9), [(52, 74, 56), (60, 86, 62), (70, 98, 68), (82, 110, 74)])
    blend(img, noise(rng, w, h, 7, 2) > 0.62, (96, 140, 80), 0.5)                        # musgo
    trail, _, _ = curve_mask(w, h, rng, 30, 0.14)
    paint(img, trail, (120, 98, 70)); blend(img, trail & (noise(rng, w, h, 30, 1) > 0.55), (100, 80, 56), 0.7)
    speckles(img, rng, 700, (150, 124, 70)); speckles(img, rng, 500, (40, 60, 44)); speckles(img, rng, 160, (220, 220, 230))
    d = edge_dist(w, h) + (noise(rng, w, h, 9, 2) - 0.5) * 34
    inside = d < 40
    paint(img, inside, (24, 44, 34))
    # copas de árvore sobre a borda: círculos com luz de cima à esquerda
    y, x = np.mgrid[0:h, 0:w]
    for _ in range(420):
        cx, cy, r = rng.integers(0, w), rng.integers(0, h), rng.integers(9, 17)
        if not inside[min(h - 1, cy), min(w - 1, cx)]: continue
        m = np.hypot(x - cx, y - cy)
        paint(img, m < r + 1, (16, 30, 26)); paint(img, m < r, (34, 70, 46)); paint(img, np.hypot(x - cx + 3, y - cy + 3) < r * 0.62, (52, 98, 60))
    blend(img, ~inside & (d < 50), (0, 0, 0), 0.3)
    blend(img, noise(rng, w, h, 5, 2) > 0.7, (210, 220, 225), 0.16)                      # névoa
    place_props(img, "bosque-cinzento", rng, ~inside & (edge_dist(w, h) > 36) & (edge_dist(w, h) < 130) & ~trail, 22, 190)
    save("bosque-cinzento", img)

def cidadela():
    rng = np.random.default_rng(43); w, h = HUNT
    img = tones(noise(rng, w, h, 10), [(36, 78, 86), (42, 90, 98), (50, 102, 110), (58, 114, 120)])
    paving(img, 16, (18, 44, 52), 0.7)
    way, _, _ = curve_mask(w, h, rng, 56, 0.05)
    blend(img, way, (120, 150, 150), 0.35); paving(img, 8, (26, 56, 62), 0.5, mask=way)
    pud = noise(rng, w, h, 7, 2)
    paint(img, pud > 0.7, (40, 130, 150)); paint(img, pud > 0.76, (90, 190, 205)); paint(img, (pud > 0.69) & (pud <= 0.7), (20, 60, 72))
    speckles(img, rng, 300, (60, 140, 90), size=(1, 2)); speckles(img, rng, 300, (20, 50, 58))
    inside = wall(img, rng, 32, [(26, 52, 60), (34, 64, 72), (44, 78, 84), (56, 92, 96)])
    place_props(img, "cidadela-afundada", rng, border_free(w, h, inside, 30, 120) & (pud < 0.66), 22, 190)
    save("cidadela-afundada", img)

def forja():
    rng = np.random.default_rng(44); w, h = HUNT
    img = tones(noise(rng, w, h, 10), [(42, 34, 36), (50, 40, 40), (60, 46, 44), (70, 54, 50)])
    paving(img, 20, (26, 20, 22), 0.6, stagger=False)
    d = edge_dist(w, h); lava = noise(rng, w, h, 6, 2) + np.clip((110 - d) / 300, 0, 0.3)  # lava mais perto das bordas
    center = np.hypot(*(np.mgrid[0:h, 0:w] - np.array([h / 2, w / 2])[:, None, None])) < 170
    lava[center] = 0
    paint(img, lava > 0.70, (30, 18, 16)); paint(img, lava > 0.72, (200, 70, 20)); paint(img, lava > 0.78, (255, 150, 40)); paint(img, lava > 0.85, (255, 225, 120))
    v = noise(rng, w, h, 8, 3)
    crack = (np.abs(v - 0.5) < 0.006) & (lava < 0.7)
    blend(img, (np.abs(v - 0.5) < 0.02) & (lava < 0.7), (190, 70, 20), 0.35); paint(img, crack, (255, 160, 60))
    speckles(img, rng, 500, (24, 18, 20)); speckles(img, rng, 200, (255, 140, 50), size=(1, 1))
    inside = wall(img, rng, 32, [(22, 18, 22), (30, 24, 28), (40, 32, 36), (52, 42, 46)])
    place_props(img, "forja-extinta", rng, border_free(w, h, inside, 30, 120) & (lava < 0.66), 20, 190)
    save("forja-extinta", img)

def arena():
    rng = np.random.default_rng(45); w, h = HUNT
    img = tones(noise(rng, w, h, 12), [(56, 56, 68), (62, 62, 76), (70, 70, 84)])
    paving(img, 25, (40, 40, 52), 0.6, stagger=False)
    ring(img, w / 2, h / 2, 170, 4, (200, 200, 215)); ring(img, w / 2, h / 2, 60, 3, (155, 107, 255))
    img[60:h - 60, w // 2 - 1:w // 2 + 1] = (200, 200, 215)
    inside = wall(img, rng, 26, [(28, 28, 38), (36, 36, 48), (46, 46, 60)])
    d = edge_dist(w, h)
    y, x = np.mgrid[0:h, 0:w]
    paint(img, (np.abs(d - 34) < 1.5) & (((x + y) // 14) % 2 == 0), (155, 107, 255))       # luzes de borda
    save("arena", img)

def cidade():
    rng = np.random.default_rng(46); w, h = CITY
    img = tones(noise(rng, w, h, 10), [(52, 50, 76), (58, 56, 86), (66, 62, 96), (74, 70, 106)])
    paving(img, 16, (30, 28, 48), 0.7)
    y, x = np.mgrid[0:h, 0:w]
    cx, cy = w / 2, h / 2 + 20
    road = np.zeros((h, w), bool)
    for nx, ny in NPCS:                                                                   # ruas do centro até cada NPC
        px, py = nx / 2, ny / 2
        t = np.clip(((x - cx) * (px - cx) + (y - cy) * (py - cy)) / ((px - cx) ** 2 + (py - cy) ** 2), 0, 1)
        road |= np.hypot(x - (cx + t * (px - cx)), y - (cy + t * (py - cy))) < 20
        road |= np.hypot(x - px, y - py) < 34
    plaza = np.hypot(x - cx, y - cy) < 74
    blend(img, road | plaza, (150, 140, 190), 0.4); paving(img, 8, (40, 36, 62), 0.5, mask=road | plaza)
    ring(img, cx, cy, 74, 3, (30, 26, 46)); ring(img, cx, cy, 52, 3, (155, 107, 255)); ring(img, cx, cy, 30, 2, (56, 214, 224))
    for nx, ny in NPCS: ring(img, nx / 2, ny / 2, 34, 2, (155, 107, 255))
    speckles(img, rng, 300, (36, 34, 56))
    inside = wall(img, rng, 26, [(22, 20, 36), (30, 28, 48), (40, 36, 60), (52, 46, 74)])
    d = edge_dist(w, h)
    paint(img, (np.abs(d - 33) < 1.5) & ((x // 10 + y // 10) % 3 == 0), (255, 200, 110))  # janelas iluminadas na borda
    place_props(img, "cidade", rng, border_free(w, h, inside, 28, 90) & ~road, 14, 150)
    save("cidade", img)

if __name__ == "__main__":
    for fn in (cidade, minas, bosque, cidadela, forja, arena): fn()
