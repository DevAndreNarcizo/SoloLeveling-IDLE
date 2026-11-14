"""Importa uma folha de sprites 4x4 gerada por IA (ChatGPT etc.) para o jogo.

Uso:  python tools/ai-assets/import_sheet.py <imagem.png> <id do asset> [--height N]
      ex.: python tools/ai-assets/import_sheet.py ~/Downloads/lamina.png cacadores/lamina
      quadro defeituoso: --replace 15=13m  (o 15º passa a ser o 13º espelhado)
      folha de ataque: --attack   (ex.: import_sheet.py lamina-ataque.png cacadores/lamina --attack)
      criatura que voa: --float   |   chamas com borda rosada: --fire
      névoa ou fumaça rosada: --mist   |   manter partículas soltas: --keep-specks

A imagem deve ter 4 colunas x 4 linhas (linhas: baixo, esquerda, direita, cima; 4 quadros de caminhada cada),
com fundo transparente ou magenta liso (#FF00FF). O script:
  1. remove o fundo (transparência ou chave de cor magenta);
  2. corta cada quadro e alinha os pés na base e o tronco no centro, para o personagem não "tremer" ao andar;
  3. reduz para o tamanho dos sprites do jogo (80 px de altura; chefes, 128 px) pela mediana de cada bloco;
  4. salva em client/public/assets/<id>.png e registra o id em shared/animated.json.
Requer: pillow e numpy.
"""
import argparse, json, os
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ANIMATED = os.path.join(ROOT, "shared/animated.json")

def remove_background(img, mist=False, fire=False):
    """Fundo transparente ou magenta -> alfa. Também limpa o halo magenta nas bordas."""
    a = np.array(img.convert("RGBA")).astype(int)
    if (a[:, :, 3] < 10).mean() > 0.2:      # já veio transparente
        alpha = a[:, :, 3] > 128
    else:
        # cor exata do fundo, lida nos cantos; some só o que está perto dela (violeta e roxo do personagem ficam)
        h, w = a.shape[:2]
        bg = np.median(np.array([a[2, 2, :3], a[2, w - 3, :3], a[h - 3, 2, :3], a[h - 3, w - 3, :3]]), axis=0)
        dist = np.sqrt(((a[:, :, :3] - bg) ** 2).sum(axis=2))
        alpha = dist > 110
    out = a.copy(); out[:, :, 3] = np.where(alpha, 255, 0)
    # Halo: nos 3 px junto ao fundo, tira o excesso de vermelho+azul que o magenta deixou misturado na cor
    edge = alpha.copy()
    for _ in range(3):
        e = edge.copy(); e[1:] &= edge[:-1]; e[:-1] &= edge[1:]; e[:, 1:] &= edge[:, :-1]; e[:, :-1] &= edge[:, 1:]; edge = e
    band = alpha & ~edge
    r, g, b = out[:, :, 0], out[:, :, 1], out[:, :, 2]
    cap = g + (np.abs(r - b) // 2) + 24
    band &= (np.abs(r - b) < 45) & (np.minimum(r, b) > g + 40)   # só tons magenta; violeta (azul bem maior) fica intacto
    out[:, :, 0] = np.where(band, np.minimum(r, cap), r); out[:, :, 2] = np.where(band, np.minimum(b, cap), b)
    if fire:
        # Chamas: a borda rosada é laranja misturado com magenta; tirar o azul em excesso devolve o laranja
        r, g, b = out[:, :, 0], out[:, :, 1], out[:, :, 2].copy()
        pink = alpha & (r > 150) & (b > g + 10)
        out[:, :, 2] = np.where(pink, g // 2, b)
    if mist:
        # Névoa e fumaça semitransparentes vêm misturadas com o magenta em toda a área, não só na borda: viram cinza-claro
        r, g, b = out[:, :, 0].copy(), out[:, :, 1], out[:, :, 2].copy()
        pink = alpha & (np.abs(r - b) < 60) & (np.minimum(r, b) > g + 10)
        out[:, :, 0] = np.where(pink, g + 4, r); out[:, :, 2] = np.where(pink, g + 8, b)
    out[:, :, :3] = np.where(alpha[:, :, None], out[:, :, :3], 0)
    return out.astype(np.uint8)

def drop_specks(cell):
    """Apaga respingos soltos: fica só a maior faixa contínua de linhas e de colunas com pixels."""
    for axis in (1, 0):
        used = (cell[:, :, 3] > 0).any(axis=axis)
        best, start = (0, 0, 0), None
        for i, u in enumerate(list(used) + [False]):
            if u and start is None: start = i
            elif not u and start is not None:
                mass = int((cell[start:i, :, 3] > 0).sum() if axis == 1 else (cell[:, start:i, 3] > 0).sum())
                if mass > best[0]: best = (mass, start, i)
                start = None
        if axis == 1: cell[:best[1]] = 0; cell[best[2]:] = 0
        else: cell[:, :best[1]] = 0; cell[:, best[2]:] = 0
    return cell

def shrink(arr, w, h):
    """Reduz por mediana de cada bloco: mantém as cores originais e as bordas nítidas (média borra, paleta perde detalhe)."""
    H, W = arr.shape[:2]; ky, kx = H / h, W / w
    out = np.zeros((h, w, 4), np.uint8)
    for y in range(h):
        y0, y1 = int(y * ky), max(int(y * ky) + 1, int((y + 1) * ky))
        for x in range(w):
            blk = arr[y0:y1, int(x * kx):max(int(x * kx) + 1, int((x + 1) * kx))].reshape(-1, 4)
            op = blk[blk[:, 3] > 0]
            if len(op) * 2 >= len(blk): out[y, x, :3] = np.median(op[:, :3], axis=0); out[y, x, 3] = 255
    return Image.fromarray(out, "RGBA")

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("image"); ap.add_argument("id")
    ap.add_argument("--height", type=int, default=0, help="altura do personagem em pixels (padrão: 54; chefes, 86)")
    ap.add_argument("--replace", action="append", default=[], metavar="DESTINO=ORIGEM[m]",
                    help="troca um quadro defeituoso por outro (1 a 16, lendo linha a linha); m = espelhado. Ex.: --replace 15=13m")
    ap.add_argument("--mist", action="store_true", help="limpa o tom rosado de névoa/fumaça semitransparente (não use em personagens com magenta ou rosa)")
    ap.add_argument("--fire", action="store_true", help="limpa a borda rosada de chamas (não use em personagens com roxo, rosa ou violeta)")
    ap.add_argument("--float", action="store_true", help="criatura que voa ou flutua: alinha os quadros pelo centro do corpo, não pelos pés")
    ap.add_argument("--attack", action="store_true", help="folha de ATAQUE (preparar, golpear, acertar, recolher): salva em <id>-ataque.png, na mesma escala da folha de caminhada")
    ap.add_argument("--keep-specks", action="store_true", help="mantém partículas soltas (cinzas, faíscas) em vez de apagá-las")
    args = ap.parse_args()
    a = remove_background(Image.open(args.image), args.mist, args.fire)
    H, W = a.shape[:2]; cw, ch = W / 4, H / 4
    frames = []
    for i in range(16):
        x0, y0 = int(round((i % 4) * cw)), int(round((i // 4) * ch))
        cell = a[y0:int(round(y0 + ch)), x0:int(round(x0 + cw))].copy()
        if not args.keep_specks: cell = drop_specks(cell)
        ys, xs = np.nonzero(cell[:, :, 3])
        if len(ys) == 0: raise SystemExit(f"quadro {i + 1} vazio: confira se a grade é 4x4")
        top, bottom, left, right = ys.min(), ys.max(), xs.min(), xs.max()
        # âncora horizontal: centro do tronco (metade de cima), mais estável que a largura total ao andar
        upper = ys < top + (bottom - top) * 0.5
        anchor = int(np.median(xs[upper]))
        # No ataque a arma e o tronco se movem; os pés ficam no lugar, então o eixo é o centro dos pés.
        if args.attack: feet = ys > bottom - (bottom - top) * 0.12; anchor = int((xs[feet].min() + xs[feet].max()) / 2)
        if args.float:
            # Voadores: o corpo é a parte mais densa. Centraliza por ela, para as asas baterem sem o corpo pular.
            col = (cell[:, :, 3] > 0).sum(axis=0).astype(float); rowm = (cell[:, :, 3] > 0).sum(axis=1).astype(float)
            col, rowm = col ** 3, rowm ** 3   # dá mais peso às colunas e linhas cheias (corpo) que às finas (asas)
            anchor = int(round((col * np.arange(len(col))).sum() / col.sum())); mid = int(round((rowm * np.arange(len(rowm))).sum() / rowm.sum()))
            frames.append((cell, top, bottom, left, right, anchor, mid)); continue
        frames.append((cell, top, bottom, left, right, anchor, None))
    for rule in args.replace:
        dst, src = rule.split("=")
        mirror = src.endswith("m"); src = int(src.rstrip("m")) - 1; dst = int(dst) - 1
        cell, top, bottom, left, right, anchor, mid = frames[src]
        if mirror:
            w = cell.shape[1]; cell = cell[:, ::-1].copy()
            left, right, anchor = w - 1 - right, w - 1 - left, w - 1 - anchor
        frames[dst] = (cell, top, bottom, left, right, anchor, mid)
        print(f"  quadro {dst + 1} substituído pelo {src + 1}{' espelhado' if mirror else ''}")
    tall = max(f[2] - f[1] + 1 for f in frames)
    # Altura padrão: 80 px (chefes, 128 px), exibida em tamanho real.
    manifest = {m["id"]: m for m in json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "manifest.json")))}
    target = args.height or (128 if manifest.get(args.id, {}).get("optional") else 80)
    # Ataque: a arma erguida aumenta a altura do quadro. A escala vem da pose em pé (4º quadro de cada linha).
    if args.attack: tall = float(np.median([frames[i][2] - frames[i][1] + 1 for i in (3, 7, 11, 15)]))
    bs = tall / target
    k = target / tall
    # canvas comum a todos os quadros, com os pés na mesma linha e o tronco no mesmo eixo
    half = max(max(f[5] - f[3], f[4] - f[5]) for f in frames) + 2
    up = max(f[2] - f[1] for f in frames) + 2
    if args.float: up = 2 * max(max(f[6] - f[1], f[2] - f[6]) for f in frames) + 4
    cell_w, cell_h = int(np.ceil(2 * half * k)) + 4, int(np.ceil(up * k)) + 4
    side = max(cell_w, cell_h)
    sheet = Image.new("RGBA", (side * 4, side * 4), (0, 0, 0, 0))
    for i, (cell, top, bottom, left, right, anchor, mid) in enumerate(frames):
        # borda de folga para o recorte ficar sempre simétrico em volta do eixo do tronco
        pad = np.pad(cell, ((up, up), (half, half), (0, 0)))
        base = bottom if mid is None else mid + up // 2 - 1   # voadores: mesma altura do corpo em todos os quadros
        crop = Image.fromarray(pad[base + 1:base + up + 1, anchor:anchor + 2 * half], "RGBA")
        w, h = max(1, round(crop.width * k)), max(1, round(crop.height * k))
        small = shrink(np.array(crop), w, h)
        ox = (i % 4) * side + (side - w) // 2
        oy = (i // 4) * side + side - h - 2
        sheet.alpha_composite(small, (ox, oy))
    out = os.path.join(ROOT, "client/public/assets", args.id + ("-ataque" if args.attack else "") + ".png")
    os.makedirs(os.path.dirname(out), exist_ok=True); sheet.save(out)
    listing = os.path.join(ROOT, "shared/attacks.json") if args.attack else ANIMATED
    ids = json.load(open(listing)) if os.path.exists(listing) else []
    if args.id not in ids: ids.append(args.id); ids.sort()
    json.dump(ids, open(listing, "w"), indent=1, ensure_ascii=False); open(listing, "a").write("\n")
    print(f"ok {args.id}: quadro {side}x{side}, personagem com {target}px de altura (redução de {bs:.1f}x)")

if __name__ == "__main__": main()
