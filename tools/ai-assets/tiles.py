"""Gera as texturas de chão repetíveis (sem emenda) em client/public/assets/mapas/.
Uso: python tools/ai-assets/tiles.py   (requer pillow e numpy)"""
import os
import numpy as np
from PIL import Image, ImageFilter

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "client/public/assets/mapas")
N = 512

def noise(rng, octaves=(4, 8, 16, 32, 64), falloff=0.55):
    """Ruído fractal que repete nas bordas: grades aleatórias ampliadas com interpolação circular."""
    out = np.zeros((N, N)); amp = 1.0; total = 0
    for cells in octaves:
        g = rng.random((cells, cells))
        g = np.pad(g, 2, mode="wrap")
        big = np.asarray(Image.fromarray((g * 255).astype(np.uint8)).resize(((cells + 4) * N // cells,) * 2, Image.BICUBIC), float) / 255
        o = 2 * N // cells
        out += big[o:o + N, o:o + N] * amp; total += amp; amp *= falloff
    return out / total

def ramp(v, colors):
    """Mapeia valores 0..1 para um degradê de cores."""
    v = np.clip(v, 0, 1) * (len(colors) - 1); i = np.minimum(v.astype(int), len(colors) - 2); t = (v - i)[..., None]
    c = np.array(colors, float)
    return c[i] * (1 - t) + c[i + 1] * t

def pavers(size, gap=3, jitter=0):
    """Máscara de rejunte de um piso de pedras retangulares (linhas alternadas deslocadas)."""
    m = np.zeros((N, N)); h = size; w = size * 2
    for y in range(N):
        row = y // h
        if y % h < gap: m[y, :] = 1
        off = (row % 2) * size
        for x in range(N):
            if (x + off) % w < gap: m[y, x] = 1
    return m

def speckle(rng, n, lo=1, hi=3):
    img = np.zeros((N, N))
    for _ in range(n):
        x, y, r = rng.integers(0, N), rng.integers(0, N), rng.integers(lo, hi + 1)
        for dy in range(-r, r + 1):
            for dx in range(-r, r + 1):
                if dx * dx + dy * dy <= r * r: img[(y + dy) % N, (x + dx) % N] = 1
    return img

def save(name, rgb):
    Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8), "RGB").save(os.path.join(OUT, name + ".png"))

def stone(seed, colors, size, grout, wear=0.5):
    rng = np.random.default_rng(seed)
    base = noise(rng) * 0.7 + noise(rng, (32, 64, 128)) * 0.3
    per = np.zeros((N, N)); h, w = size, size * 2  # cada pedra com um tom próprio
    for y in range(0, N, h):
        off = ((y // h) % 2) * size
        for x in range(-w, N, w):
            per[y:y + h, np.arange(x + off, x + off + w) % N] = rng.random() * 0.35
    rgb = ramp(base * wear + per + 0.1, colors)
    g = np.asarray(Image.fromarray((pavers(size) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8)), float)[..., None] / 255
    return rgb * (1 - g) + np.array(grout, float) * g

os.makedirs(OUT, exist_ok=True)
# Cidade: calçamento de ardósia com reflexo violeta
save("cidade-chao", stone(1, [(26, 25, 40), (38, 36, 56), (52, 48, 74), (66, 60, 92)], 64, (14, 13, 22)))
# Arena: piso de treino cinza com linhas claras
a = stone(2, [(32, 32, 40), (42, 42, 52), (54, 54, 66)], 128, (22, 22, 28), 0.35)
a[254:258, :] = a[254:258, :] * 0.5 + np.array([150, 130, 220]) * 0.5
save("arena-chao", a)
# Cidadela afundada: lajes verde-azuladas molhadas, com poças
rng = np.random.default_rng(3); c = stone(3, [(14, 34, 40), (22, 50, 58), (30, 66, 74), (40, 84, 92)], 128, (8, 20, 24))
puddle = (noise(rng, (4, 8)) > 0.62)[..., None]
save("cidadela-afundada-chao", np.where(puddle, c * 0.6 + np.array([40, 110, 120]) * 0.25, c))
# Minas: terra batida com cascalho e manchas de ferrugem
rng = np.random.default_rng(4); d = ramp(noise(rng) * 0.75 + noise(rng, (64, 128)) * 0.25, [(34, 24, 18), (52, 38, 28), (70, 52, 38), (88, 66, 48)])
rust = (noise(rng, (4, 8, 16)) > 0.66)[..., None]; d = np.where(rust, d * 0.7 + np.array([120, 60, 24]) * 0.3, d)
gr = speckle(rng, 420)[..., None]; save("minas-ocas-chao", d * (1 - gr) + (d * 1.5 + 14) * gr)
# Bosque: chão de floresta com musgo e folhas secas
rng = np.random.default_rng(5); f = ramp(noise(rng) * 0.7 + noise(rng, (32, 64, 128)) * 0.3, [(20, 28, 24), (30, 42, 34), (42, 58, 44), (56, 72, 52)])
moss = (noise(rng, (4, 8, 16)) > 0.6)[..., None]; f = np.where(moss, f * 0.75 + np.array([60, 96, 52]) * 0.25, f)
lv = speckle(rng, 260, 1, 2)[..., None]; save("bosque-cinzento-chao", f * (1 - lv) + np.array([96, 78, 46]) * lv)
# Forja: basalto negro com veios incandescentes
rng = np.random.default_rng(6); b = ramp(noise(rng) * 0.8 + noise(rng, (64, 128)) * 0.2, [(18, 14, 14), (30, 22, 20), (44, 32, 28), (58, 42, 36)])
v = noise(rng, (4, 8, 16, 32)); crack = (np.abs(v - 0.5) < 0.012)[..., None]; halo = (np.abs(v - 0.5) < 0.035)[..., None]
b = np.where(halo, b * 0.7 + np.array([150, 60, 20]) * 0.3, b); save("forja-extinta-chao", np.where(crack, np.array([255, 150, 60.0]), b))
print("6 chãos gerados")
