"""Retoques pontuais em sprites já importados, para defeitos da imagem gerada que não valem uma nova geração.
Rode depois de reimportar o asset correspondente:  python tools/ai-assets/fixes.py
Cada retoque é idempotente (rodar duas vezes não estraga)."""
import os, sys
import numpy as np
from PIL import Image

ASSETS = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "client/public/assets")

def alfa_sem_olhos_na_nuca():
    """Alfa da Névoa: a vista de costas veio com os três olhos desenhados na nuca. Cobre com o pelo logo abaixo."""
    p = os.path.join(ASSETS, "monstros/alfa-da-nevoa.png"); a = np.array(Image.open(p)).astype(int); c = a.shape[0] // 4
    row = a[3 * c:]; r, b, al = row[:, :, 0], row[:, :, 2], row[:, :, 3]
    ys, xs = np.nonzero((al > 0) & (b > r + 40) & (np.arange(row.shape[0])[:, None] < c * 0.45))
    if len(ys) == 0: return 0
    below = ys.max() + 2
    for y, x in zip(ys, xs):
        src = row[below + (y - ys.min()) % 4, x]
        if src[3] > 0 and src[2] <= src[0] + 40: row[y, x, :3] = src[:3]
        else: row[y, x, :3] = (165, 179, 185)
    Image.fromarray(a.astype(np.uint8)).save(p); return len(ys)

def mercador_pele_quente():
    """Tobias: a pele veio cinza. Aquece só os tons médios do rosto e das mãos; barba e cabelo (mais claros) ficam."""
    p = os.path.join(ASSETS, "npcs/mercador.png"); a = np.array(Image.open(p)).astype(int)
    r, g, b, al = [a[:, :, i] for i in range(4)]
    lum = (r + g + b) / 3; sat = np.max(a[:, :, :3], axis=2) - np.min(a[:, :, :3], axis=2)
    H = a.shape[0]; Y = np.arange(H)[:, None]
    face = (Y >= 2) & (Y <= 15); hands = (Y >= H * 0.5) & (Y <= H * 0.64)   # do alto da cabeça até acima da barba
    skin = (al > 0) & (sat < 34) & (lum > 95) & (lum < 200) & (face | hands)
    n = int(skin.sum())
    k = lum / 172
    a[:, :, 0] = np.where(skin, np.clip(214 * k, 0, 255), r); a[:, :, 1] = np.where(skin, np.clip(160 * k, 0, 255), g); a[:, :, 2] = np.where(skin, np.clip(124 * k, 0, 255), b)
    Image.fromarray(a.astype(np.uint8)).save(p); return n

def match_colors(target_id, ref_id):
    """Folha de ataque com tom diferente da de caminhada: aproxima as cores da pedra/metal às da caminhada
    (média e desvio por canal), sem mexer no brilho laranja. Uso: python fixes.py cores <ataque> <caminhada>."""
    def glow(a): r, g, b = a[..., 0], a[..., 1], a[..., 2]; return (r > 180) & (r - b > 90)
    t = np.array(Image.open(os.path.join(ASSETS, target_id + ".png"))).astype(float)
    ref = np.array(Image.open(os.path.join(ASSETS, ref_id + ".png"))).astype(float)
    mt = (t[..., 3] > 0) & ~glow(t); mr = (ref[..., 3] > 0) & ~glow(ref)
    for ch in range(3):
        a, b = t[..., ch][mt], ref[..., ch][mr]
        t[..., ch][mt] = np.clip((a - a.mean()) / (a.std() + 1e-6) * b.std() + b.mean(), 0, 255)
    Image.fromarray(t.astype(np.uint8)).save(os.path.join(ASSETS, target_id + ".png")); return int(mt.sum())

if __name__ == "__main__" and len(sys.argv) == 4 and sys.argv[1] == "cores":
    print("pixels ajustados", match_colors(sys.argv[2], sys.argv[3])); sys.exit()
if __name__ == "__main__":
    print("alfa-da-nevoa: pixels retocados", alfa_sem_olhos_na_nuca())
    print("mercador: pixels retocados", mercador_pele_quente())
