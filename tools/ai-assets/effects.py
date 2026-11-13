"""Desenha os efeitos de combate (brilhos suaves) em client/public/assets/efeitos/.
Uso: python tools/ai-assets/effects.py   (requer pillow)"""
import math, os
from PIL import Image, ImageDraw, ImageFilter

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "client/public/assets/efeitos")
os.makedirs(OUT, exist_ok=True)
C = 128  # lado de cada quadro

def glow(draw_fn, size=(C, C), blur=5):
    """Desenha o traço nítido sobre uma cópia borrada: efeito de luz."""
    base = Image.new("RGBA", size, (0, 0, 0, 0)); draw_fn(ImageDraw.Draw(base))
    soft = base.filter(ImageFilter.GaussianBlur(blur))
    return Image.alpha_composite(Image.alpha_composite(soft, soft), base)

def pixelate(img, factor=4):
    """Reduz e endurece as bordas: o efeito fica em pixel art, como os sprites."""
    small = img.resize((img.width // factor, img.height // factor), Image.BOX)
    r, g, b, a = small.split()
    rgb = Image.merge("RGB", (r, g, b)).quantize(colors=12, dither=Image.NONE).convert("RGB")
    return Image.merge("RGBA", (*rgb.split(), a.point(lambda v: 255 if v > 70 else 0)))

def sheet(frames):
    out = Image.new("RGBA", (C * 2, C * 2), (0, 0, 0, 0))
    for i, f in enumerate(frames): out.paste(f, ((i % 2) * C, (i // 2) * C))
    return out

def slash(i):
    def d(dr):
        r, w = [34, 46, 50, 52][i], [6, 10, 7, 3][i]; a0 = -70 + i * 14
        col = [(255, 255, 255, 255), (255, 255, 255, 255), (200, 170, 255, 220), (140, 100, 240, 130)][i]
        dr.arc((64 - r, 64 - r, 64 + r, 64 + r), a0, a0 + 130, fill=col, width=w)
        dr.arc((64 - r + 8, 64 - r + 8, 64 + r - 8, 64 + r - 8), a0 + 10, a0 + 110, fill=(155, 107, 255, col[3] // 2), width=max(2, w // 2))
    return glow(d)

def summon(i):
    def d(dr):
        rx = [18, 34, 42, 46][i]; a = [255, 255, 230, 110][i]
        dr.ellipse((64 - rx, 104 - rx // 3, 64 + rx, 104 + rx // 3), outline=(155, 107, 255, a), width=4)
        h = [10, 46, 78, 50][i]
        if i < 3:
            dr.polygon([(52, 104), (76, 104), (70, 104 - h), (58, 104 - h)], fill=(60, 36, 130, 220))
            dr.polygon([(58, 104), (70, 104), (66, 104 - h - 8), (62, 104 - h - 8)], fill=(196, 163, 255, 255))
        for k in range(3 + i * 3):
            x, y = 30 + (k * 29 + i * 11) % 68, 100 - (k * 17 + i * 13) % (20 + i * 22)
            dr.ellipse((x - 2, y - 2, x + 2, y + 2), fill=(56, 214, 224, a) if k % 2 else (220, 200, 255, a))
    return glow(d)

def levelup(i):
    def d(dr):
        rx = [16, 34, 48, 54][i]; a = [255, 255, 255, 120][i]; y = 100 - i * 8
        dr.ellipse((64 - rx, y - rx // 3, 64 + rx, y + rx // 3), outline=(255, 214, 90, a), width=5)
        if i:
            for x in (36, 64, 92): dr.line((x, 92 - i * 22, x, 92 - i * 22 + (14 if i == 3 else 30)), fill=(255, 243, 192, a), width=4)
        for k in range(i * 3):
            x, y2 = 22 + (k * 37 + i * 9) % 84, 20 + (k * 23) % 50
            dr.line((x - 4, y2, x + 4, y2), fill=(255, 255, 255, a), width=2); dr.line((x, y2 - 4, x, y2 + 4), fill=(255, 255, 255, a), width=2)
    return glow(d)

pixelate(sheet([slash(i) for i in range(4)])).save(os.path.join(OUT, "golpe.png"))
pixelate(sheet([summon(i) for i in range(4)])).save(os.path.join(OUT, "evocacao.png"))
pixelate(sheet([levelup(i) for i in range(4)])).save(os.path.join(OUT, "subir-nivel.png"))
def bolt(dr):
    dr.polygon([(8, 32), (40, 24), (40, 40)], fill=(90, 50, 180, 200)); dr.ellipse((34, 20, 58, 44), fill=(155, 107, 255, 255)); dr.ellipse((41, 27, 51, 37), fill=(255, 255, 255, 255))
pixelate(glow(bolt, (64, 64), 4)).save(os.path.join(OUT, "projetil-arcano.png"))
def arrow(dr):
    dr.line((6, 32, 50, 32), fill=(150, 100, 55, 255), width=3); dr.polygon([(48, 26), (60, 32), (48, 38)], fill=(255, 190, 80, 255))
    dr.polygon([(6, 32), (14, 26), (16, 32), (14, 38)], fill=(225, 220, 240, 255))
pixelate(glow(arrow, (64, 64), 2)).save(os.path.join(OUT, "flecha.png"))
print("5 efeitos desenhados")
