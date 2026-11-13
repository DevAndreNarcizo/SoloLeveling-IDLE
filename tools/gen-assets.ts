// Desenha por código os assets animados (caçadores, monstros, chefes), os objetos da fenda e os efeitos.
// Uso: npm run assets   (os demais assets vêm de tools/ai-assets/generate.py)
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Img, darken, grid, lighten, sheet, type View } from './pixel.ts'
import { bat, bramble, ember, grub, humanoid, quadruped, type HeadBox } from './sprites.ts'

const OUT = resolve(fileURLToPath(import.meta.url), '../../client/public/assets')
const save = (path: string, img: Img) => { const f = resolve(OUT, path); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, img.png()) }
type Draw = (img: Img, view: View, frame: number) => void
const made: string[] = []
const sprite = (id: string, draw: Draw, cell = 32) => { save(`${id}.png`, sheet(cell, draw)); made.push(id) }

const SKIN = 0xe2b48c, VIOLET = 0x9b6bff, CYAN = 0x38d6e0, AMBER = 0xffb347, TEAL = 0x2fd4b5
const u = (s: number) => (n: number) => Math.round(n * s)

// ---------- Caçadores ----------
sprite('cacadores/lamina', humanoid({ skin: SKIN, hair: 0x2a2233, coat: 0x3a3848, trim: VIOLET, legs: 0x24222e, boots: 0x15131c, weapon: 'sword',
  hat: (i, h) => { if (h.view !== 'up') i.rect(h.view === 'side' ? h.x - 1 : h.x - 3, h.y + h.h, 3, 2, 0x8d95a8) } }))
sprite('cacadores/vulto', humanoid({ skin: SKIN, hair: 0x1b1a24, coat: 0x22212c, trim: TEAL, legs: 0x1a1922, boots: 0x101016, hood: true, weapon: 'daggers', eyes: TEAL }))
sprite('cacadores/arcanista', humanoid({ skin: 0xf0c9a5, hair: 0xd8dce8, coat: 0x2b2a5c, trim: VIOLET, legs: 0x1f1e3d, boots: 0x14132a, weapon: 'staff', wcol: 0x8d95a8, glow: 0xc4a3ff, robe: true }))
sprite('cacadores/atirador', humanoid({ skin: 0xc99a72, hair: 0x5a3b22, coat: 0x2f4a38, trim: AMBER, legs: 0x26301f, boots: 0x161a12, weapon: 'bow', wcol: 0x8a5a2e, back: 'quiver' }))

// ---------- Monstros humanoides ----------
const lamp = (c: number) => (i: Img, h: HeadBox) => { const k = u(h.s); i.rect(h.x - 1, h.y - k(1), h.w + 2, k(3), 0x4a4038); if (h.view !== 'up') i.glow(h.view === 'side' ? h.x + h.w - k(1) : h.x + h.w / 2 - k(1), h.y - k(1), c, k(2), k(2)) }
const hollow = { skin: 0x3b3644, hair: 0x2a2630, coat: 0x4a3f38, trim: 0x2a2420, legs: 0x2e2a30, boots: 0x1c1a1e, eyes: 0x6fd8ff, chest: 0x49b8ff }
sprite('monstros/catador-oco', humanoid({ ...hollow, weapon: 'pick', wcol: 0x8a6a4a, hood: true }))
sprite('monstros/capataz-oco', humanoid({ ...hollow, coat: 0x3a2f2a, weapon: 'chain', wcol: 0x8d95a8, s: 1.5, bulk: 1, hat: lamp(0xffd27a) }), 48)

const drowned = { skin: 0x5d8a86, hair: 0x35585a, coat: 0x2f5560, trim: 0x8fb8a0, legs: 0x244048, boots: 0x162a30, eyes: 0xd6fff0, helmet: true }
const weed = (i: Img, h: HeadBox) => { const k = u(h.s); i.rect(h.x + k(1), h.y + h.h, 1, k(3), 0x3f8a4a); i.rect(h.x + h.w - k(2), h.y + h.h + k(4), 1, k(3), 0x3f8a4a); i.set(h.x + k(2), h.y + k(1), 0xcfd8c0) }
sprite('monstros/sentinela-afogada', humanoid({ ...drowned, weapon: 'spear', wcol: 0x7aa6a0, hat: weed }))
sprite('monstros/capitao-das-mares', humanoid({ ...drowned, coat: 0x1f3d52, trim: 0xd6b25a, weapon: 'anchor', wcol: 0x6f7f86, s: 1.5, bulk: 1,
  hat: (i, h) => { const k = u(h.s); weed(i, h); i.rect(h.x - k(2), h.y - k(1), h.w + k(4), k(2), 0x1a2b3a); i.rect(h.x + k(1), h.y - k(3), h.w - k(2), k(2), 0x1a2b3a); i.glow(h.x + h.w / 2 - 1, h.y - k(2), 0xd6b25a, 2, 1) } }), 48)

const mud = { skin: 0x7b8f5a, hair: 0x3a4a2a, coat: 0x4a5a32, trim: 0x8fb04a, legs: 0x2e3a20, boots: 0x1e2614, eyes: 0xc8ff6a, hood: true, robe: true }
sprite('monstros/sacerdote-do-lodo', humanoid({ ...mud, weapon: 'lantern', glow: 0xb6ff5a }))
sprite('monstros/hierofante-do-lodo', humanoid({ ...mud, coat: 0x3d4a2a, weapon: 'censer', glow: 0xb6ff5a, s: 1.5,
  hat: (i, h) => { const k = u(h.s); i.rect(h.x + k(1), h.y - k(5), h.w - k(2), k(5), 0x5a6a3a); i.rect(h.x + k(2), h.y - k(7), h.w - k(4), k(2), 0x5a6a3a); i.glow(h.x + h.w / 2 - 1, h.y - k(4), 0xb6ff5a, 2, k(2)) } }), 48)

const plate = { skin: 0x2b2a3a, hair: 0x3d3b52, coat: 0x34334a, trim: VIOLET, legs: 0x2a293c, boots: 0x1b1a28, eyes: 0xc4a3ff, helmet: true, chest: 0x9b6bff }
const crest = (i: Img, h: HeadBox) => { const k = u(h.s); i.rect(h.x + h.w / 2 - 1, h.y - k(2), 2, k(2), 0x7b55d6) }
sprite('monstros/armadura-vazia', humanoid({ ...plate, weapon: 'great', wcol: 0x8d95a8, bulk: 1, hat: crest }))
sprite('monstros/guardiao-do-selo', humanoid({ ...plate, coat: 0x2a2940, weapon: 'halberd', wcol: 0xaab3c5, s: 1.5, bulk: 2,
  hat: (i, h) => { const k = u(h.s); crest(i, h); i.rect(h.x - k(2), h.y + k(1), k(2), k(2), 0x7b55d6); i.rect(h.x + h.w, h.y + k(1), k(2), k(2), 0x7b55d6) } }), 48)

const slag = { skin: 0x2a2526, hair: 0x2a2526, coat: 0x332c2d, trim: 0xff8a3a, legs: 0x241f20, boots: 0x161314, eyes: 0xffb347, helmet: true, chest: 0xff8a3a }
const cracks = (i: Img, h: HeadBox) => { const k = u(h.s); if (h.view !== 'up') i.glow(h.x + k(1), h.y + h.h + k(5), 0xff6a2a, k(2), 1); i.glow(h.x + h.w - k(2), h.y + h.h + k(2), 0xff8a3a, 1, k(2)) }
sprite('monstros/golem-de-escoria', humanoid({ ...slag, bulk: 2, hat: cracks }))
sprite('monstros/colosso-de-escoria', humanoid({ ...slag, bulk: 3, s: 1.5, weapon: 'hammer', wcol: 0x4a4042, hat: cracks }), 48)

// ---------- Monstros quadrúpedes ----------
const mist = (i: Img, _h: { x: number; y: number }, v: View, f: number, s: number) => { const k = u(s); for (let n = 0; n < 4; n++) i.glow(k([6, 12, 19, 25][n]) + ((f + n) % 2), k(29) - ((f + n) % 3), 0xcfd6e6, k(2), 1); if (v === 'side') i.glow(k(4) - f % 2, k(15), 0xcfd6e6, k(3), 1) }
sprite('monstros/lobo-de-nevoa', quadruped({ body: 0x7d8494, belly: 0xa9afbd, eye: 0x9fe8ff, tail: 'bushy', extra: mist }))
sprite('monstros/alfa-da-nevoa', quadruped({ body: 0xc2c8d6, belly: 0xe6e9f2, eye: 0x9fe8ff, tail: 'bushy', s: 1.5,
  extra: (i, h, v, f, s) => { const k = u(s); mist(i, h, v, f, s); if (v !== 'up') i.glow(Math.round(h.x) - (v === 'side' ? 0 : 1), h.y - k(3), 0x9fe8ff, 2, 2); i.ell(h.x - (v === 'side' ? k(4) : 0), h.y - k(v === 'up' ? -3 : 3) + (v === 'side' ? k(3) : 0), k(4), k(2), 0xe6e9f2) } }), 48)

const antlers = (col: number, big: boolean) => (i: Img, h: { x: number; y: number }, v: View, _f: number, s: number) => {
  const k = u(s), top = h.y - k(4), span = big ? 7 : 5
  if (v === 'side') { i.line(h.x - k(1), top, h.x - k(2), top - k(span), col); i.line(h.x - k(2), top - k(3), h.x + k(2), top - k(span), col); i.line(h.x - k(2), top - k(4), h.x - k(5), top - k(span - 1), col) }
  else for (const d of [-1, 1]) { i.line(h.x + d * k(3), top, h.x + d * k(5), top - k(span), col); i.line(h.x + d * k(4), top - k(3), h.x + d * k(8), top - k(span - 1), col); if (big) i.line(h.x + d * k(5), top - k(5), h.x + d * k(2), top - k(span + 2), col) }
  if (big) for (const d of [-1, 0, 1]) i.glow(h.x + d * k(5), top - k(span + 1) - (d === 0 ? k(2) : 0), 0x7df2ff, k(1.4), k(1.4))
}
sprite('monstros/cervo-espectral', quadruped({ body: 0x9fd6dc, belly: 0xd8f6f8, eye: 0xffffff, tail: 'none', extra: antlers(0xf0ead8, false) }))
sprite('monstros/rei-galhado', quadruped({ body: 0xb8e8ec, belly: 0xffffff, eye: 0x7df2ff, tail: 'none', s: 1.5, extra: antlers(0xf0ead8, true) }), 48)

const horn = (matriarch: boolean) => (i: Img, h: { x: number; y: number }, v: View, f: number, s: number) => {
  const k = u(s)
  if (v === 'side') { i.line(h.x - k(1), h.y - k(3), h.x - k(4), h.y - k(6), 0x2b2729, k(1.5)); i.glow(k(29), h.y + k(1) - (f % 2), 0x8f8a8a, k(1.5), 1); if (matriarch) { i.rect(k(11), k(12), k(7), k(3), 0x4a4447); i.glow(k(22), h.y + k(3), 0xff8a3a, k(3), k(1)) } }
  else { for (const d of [-1, 1]) i.line(h.x + d * k(3), h.y - k(3), h.x + d * k(5), h.y - k(7), 0x2b2729, k(1.5)); if (matriarch && v === 'down') i.glow(h.x - k(2), h.y + k(4), 0xff8a3a, k(4), k(1)); if (matriarch) for (const d of [-1, 1]) i.rect(h.x + d * k(7) - 1, k(15), k(3), k(5), 0x4a4447) }
}
sprite('monstros/serpe-de-cinza', quadruped({ body: 0x5a5557, belly: 0x8a8486, eye: 0xffb347, tail: 'long', ears: false, snout: 0x4a4547, extra: horn(false) }))
sprite('monstros/serpe-matriarca', quadruped({ body: 0x4f4a4d, belly: 0x9a8f8a, eye: 0xff8a3a, tail: 'long', ears: false, snout: 0x3f3a3d, s: 1.5, extra: horn(true) }), 48)

// ---------- Criaturas especiais ----------
sprite('monstros/larva-de-ferrugem', grub(0xd9c9a0, 0xb5622e))
sprite('monstros/larva-mae', grub(0xcbb98c, 0x9c4f22, 1.5, 0x8d95a8), 48)
sprite('monstros/morcego-de-cinza', bat(0x55525f, 0x3d3a47, 0xff9a3a))
sprite('monstros/asa-ancia', bat(0x4a4754, 0x33303c, 0xff7a2a, 1.5, 0xe6e6ee), 48)
sprite('monstros/espinheiro-vivo', bramble(0x2f5a3a, 0x4a3524, 0x9be88a))
sprite('monstros/raiz-ancia', bramble(0x294d33, 0x3d2c1e, 0x9be88a, 1.5, 3), 48)
sprite('monstros/brasa-errante', ember(0x2b2224, 0xff7a2a))
sprite('monstros/coracao-de-fornalha', ember(0x2b2224, 0xffa84a, 1.5, true), 48)

// ---------- Objetos da fenda ----------
{
  const img = new Img(48, 64), cx = 24, cy = 32
  img.ell(cx, cy, 15, 27, 0x4b2a9a); img.ell(cx, cy, 12, 23, 0x7b55d6); img.ell(cx + 1, cy, 8, 18, 0x38d6e0); img.ell(cx + 1, cy + 1, 4, 12, 0xd6fbff)
  for (const [x, y] of [[cx - 4, cy - 12], [cx + 5, cy - 6], [cx - 6, cy + 4], [cx + 4, cy + 12], [cx - 2, cy + 16]]) img.glow(x, y, 0xffffff)
  img.finish(0x1c1033)
  for (const [x, y] of [[4, 10], [42, 18], [6, 48], [40, 52], [45, 34], [2, 30]]) { img.glow(x, y, CYAN); img.glow(x, y + 1, VIOLET) }
  save('objetos/fenda.png', img); made.push('objetos/fenda')
}
{
  const img = new Img(32, 32)
  img.ell(16, 24, 11, 4.5, 0x1d1730); img.ell(13, 22, 6, 3.5, 0x2a2244); img.ell(19, 23, 5, 3, 0x241c3a)
  for (const [x, y, h] of [[11, 15, 5], [16, 9, 9], [20, 14, 6]]) { img.rect(x, y, 2, h, 0x3d2f6a); img.glow(x, y - 2, VIOLET, 1, 2); img.glow(x + 1, y + 1, 0xc4a3ff) }
  img.finish(); save('objetos/resquicio.png', img); made.push('objetos/resquicio')
}

// ---------- Efeitos (4 quadros, sem contorno) ----------
save('efeitos/golpe.png', grid(32, 2, 2, (img, i) => {
  const r = [7, 11, 12, 12][i], t = [2, 3, 2, 1][i], col = [0xffffff, 0xffffff, 0xc4a3ff, 0x7b55d6][i]
  for (let a = -1.1 + i * 0.25; a < 1.2 + i * 0.1; a += 0.04) for (let k = 0; k < t; k++) img.set(15 + Math.cos(a) * (r - k), 16 + Math.sin(a) * (r - k), k === 0 ? col : 0x9b6bff)
  if (i === 3) for (const [x, y] of [[26, 8], [27, 20], [22, 27]]) img.set(x, y, 0xffffff)
}, false)); made.push('efeitos/golpe')
save('efeitos/evocacao.png', grid(32, 2, 2, (img, i) => {
  img.ring(16, 27, [5, 9, 11, 12][i], [1.5, 2.5, 3, 3][i], i === 3 ? 0x4b2a9a : VIOLET)
  const h = [3, 12, 20, 10][i]
  if (i < 3) { img.rect(13, 27 - h, 6, h, 0x2a1d52); img.rect(14, 26 - h, 4, h, 0x4b2a9a); img.rect(15, 25 - h, 2, 3, 0xc4a3ff) }
  for (let k = 0; k < 2 + i * 2; k++) img.set(8 + ((k * 7 + i * 3) % 17), 24 - ((k * 5 + i * 4) % (6 + i * 5)), k % 2 ? CYAN : 0xc4a3ff)
}, false)); made.push('efeitos/evocacao')
save('efeitos/subir-nivel.png', grid(32, 2, 2, (img, i) => {
  img.ring(16, 26 - i * 2, [4, 8, 12, 13][i], [1.5, 3, 4, 4][i], i === 3 ? 0xa8842a : 0xffd65a)
  if (i > 0) for (const x of [9, 16, 23]) img.rect(x, 22 - i * 6, 1, i === 3 ? 3 : 7, i === 3 ? 0xffd65a : 0xfff3c0)
  for (let k = 0; k < i * 2; k++) img.set(6 + ((k * 9 + i * 5) % 21), 6 + ((k * 7) % 12), 0xffffff)
}, false)); made.push('efeitos/subir-nivel')
{
  const img = new Img(16, 16)
  img.rect(1, 7, 6, 2, 0x4b2a9a); img.rect(4, 6, 5, 4, 0x7b55d6); img.ell(11, 8, 3.5, 3.5, VIOLET); img.rect(10, 7, 2, 2, 0xffffff)
  save('efeitos/projetil-arcano.png', img); made.push('efeitos/projetil-arcano')
}
{
  const img = new Img(16, 16)
  img.rect(1, 7, 11, 1, 0x8a5a2e); img.rect(1, 6, 2, 3, 0xd9d3ee); img.rect(11, 6, 2, 3, 0xaab3c5); img.rect(13, 7, 2, 1, AMBER)
  img.finish(); save('efeitos/flecha.png', img); made.push('efeitos/flecha')
}

console.log(`${made.length} assets desenhados em client/public/assets/`)
void darken; void lighten
