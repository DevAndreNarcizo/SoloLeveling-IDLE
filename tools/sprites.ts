// Geradores de sprites animados: humanoides, quadrúpedes e criaturas especiais.
import { Img, darken, lighten, type View } from './pixel.ts'

export type Weapon = 'none' | 'sword' | 'great' | 'daggers' | 'staff' | 'bow' | 'pick' | 'spear' | 'hammer' | 'chain' | 'anchor' | 'halberd' | 'lantern' | 'book' | 'tablet' | 'censer' | 'shield'
export interface HeadBox { x: number; y: number; w: number; h: number; view: View; s: number; f: number }
export interface Hum {
  skin: number; hair: number; coat: number; trim: number; legs: number; boots: number
  hood?: boolean; helmet?: boolean; eyes?: number | null; weapon?: Weapon; wcol?: number; glow?: number
  robe?: boolean; bulk?: number; back?: 'quiver' | 'pack' | 'none'; chest?: number // chest: brilho no peito
  s?: number; hat?: (img: Img, head: HeadBox) => void
}
const STEEL = 0xaab3c5, WOOD = 0x7a5230

function weapon(img: Img, w: Weapon, x: number, y: number, s: number, col: number, glow: number, feet: number) {
  const u = (n: number) => Math.round(n * s)
  switch (w) {
    case 'sword': img.rect(x, y - u(10), u(1) + (s > 1 ? 1 : 0), u(10), col); img.rect(x - 1, y - 1, u(3), 1, 0x4a3f63); img.set(x, y - u(10) - 1, lighten(col, 0.4)); break
    case 'great': img.rect(x, y - u(13), u(2), u(13), col); img.rect(x - 1, y - 1, u(4), u(1), 0x4a3f63); img.glow(x, y - u(7), glow, 1, u(2)); break
    case 'daggers': img.rect(x, y, 1, u(4), col); img.set(x, y - 1, 0x4a3f63); break
    case 'staff': img.rect(x, y - u(13), 1, feet - (y - u(13)), col); img.glow(x - 1, y - u(15), glow, u(2) + 1, u(2)); break
    case 'bow': for (let i = -u(5); i <= u(5); i++) img.set(x + (Math.abs(i) < u(3) ? 1 : 0), y - u(2) + i, col); img.rect(x - 1, y - u(7), 1, u(11), 0xd9d3ee); break
    case 'pick': img.rect(x, y - u(9), 1, u(11), WOOD); img.rect(x - u(2), y - u(10), u(5), 1, col); img.set(x - u(2), y - u(9), col); img.set(x + u(2), y - u(9), col); break
    case 'spear': img.rect(x, y - u(14), 1, feet - (y - u(14)), WOOD); img.rect(x, y - u(17), 1, u(3), col); break
    case 'hammer': img.rect(x, y - u(8), 1, u(10), WOOD); img.rect(x - u(2), y - u(11), u(5), u(3), col); break
    case 'chain': for (let i = 0; i < u(9); i += 2) img.set(x + (i % 4 ? 0 : 1), y + i, col); img.rect(x - 1, y + u(9), u(3), u(2), darken(col)); break
    case 'anchor': img.rect(x, y - u(10), 1 + (s > 1 ? 1 : 0), u(13), col); img.rect(x - u(3), y + u(2), u(7), 1, col); img.set(x - u(3), y + u(1), col); img.set(x + u(3), y + u(1), col); img.rect(x - 1, y - u(11), u(3), 1, col); break
    case 'halberd': img.rect(x, y - u(15), 1, feet - (y - u(15)), WOOD); img.rect(x + 1, y - u(15), u(3), u(4), col); img.rect(x, y - u(18), 1, u(3), col); break
    case 'lantern': img.rect(x - 1, y, u(3), u(4), 0x3a3350); img.glow(x, y + 1, glow, u(1), u(2)); break
    case 'censer': img.rect(x, y, 1, u(4), 0x8c8c8c); img.rect(x - 1, y + u(4), u(3), u(3), 0x6b6b3a); img.glow(x, y + u(3), glow); img.glow(x + 1, y + u(1), glow); break
    case 'book': img.rect(x - u(4), y - u(2), u(5), u(4), col); img.rect(x - u(4), y - u(2), 1, u(4), lighten(col, 0.5)); break
    case 'tablet': img.rect(x - u(4), y - u(2), u(4), u(5), 0x2b2540); img.glow(x - u(4) + 1, y - u(2) + 1, glow, u(4) - 2, u(5) - 2); break
    case 'shield': img.rect(x - u(2), y - u(6), u(5), u(9), col); img.glow(x - u(1), y - u(3), glow, u(3), u(3)); break
  }
}

export function humanoid(p: Hum) {
  const s = p.s ?? 1, u = (n: number) => Math.round(n * s), cell = 32 * s
  const bulk = p.bulk ?? 0, wcol = p.wcol ?? STEEL, glow = p.glow ?? p.trim, eye = p.eyes === undefined ? 0x1a1426 : p.eyes
  return (img: Img, view: View, f: number) => {
    const cx = cell / 2, F = u(29), bob = f % 2 === 0 ? 1 : 0
    const headW = view === 'side' ? u(7) : u(8), headH = u(7)
    const headX = Math.round(cx - headW / 2), headY = u(5) + bob
    const bodyH = u(9), bodyY = headY + headH
    const bodyW = (view === 'side' ? u(6) : u(10)) + (view === 'side' ? bulk : bulk * 2)
    const bodyX = Math.round(cx - bodyW / 2), bodyB = bodyY + bodyH
    const legW = u(3), armW = u(2), armLen = u(6)
    const sw = [1, 0, -1, 0][f]
    // --- pernas ou barra da túnica
    if (p.robe) {
      img.rect(bodyX - 1, bodyB - 1, bodyW + 2, F - bodyB + 1, p.coat)
      img.rect(bodyX - 1, F - u(2), bodyW + 2, u(2), darken(p.coat, 0.3))
    } else if (view === 'side') {
      const back = cx - u(2) - sw * u(1.5), front = cx - u(1) + sw * u(1.5)
      img.rect(back, bodyB, legW, F - bodyB - (sw > 0 ? 1 : 0), darken(p.legs, 0.25)); img.rect(back, F - u(2) - (sw > 0 ? 1 : 0), legW + 1, u(2), darken(p.boots, 0.2))
      img.rect(front, bodyB, legW, F - bodyB - (sw < 0 ? 1 : 0), p.legs); img.rect(front, F - u(2) - (sw < 0 ? 1 : 0), legW + 1, u(2), p.boots)
    } else {
      const l = Math.round(cx - u(4)), r = Math.round(cx + u(1)), lh = F - bodyB - (f === 2 ? u(1) : 0), rh = F - bodyB - (f === 0 ? u(1) : 0)
      img.rect(l, bodyB, legW, lh, p.legs); img.rect(l, bodyB + lh - u(2), legW, u(2), p.boots)
      img.rect(r, bodyB, legW, rh, p.legs); img.rect(r, bodyB + rh - u(2), legW, u(2), p.boots)
    }
    // --- item nas costas (visto de costas fica por cima; de frente, atrás do corpo)
    const backItem = () => {
      if (p.back === 'quiver') { img.rect(cx + u(1), bodyY - u(2), u(3), u(8), WOOD); img.rect(cx + u(1), bodyY - u(3), u(3), 1, 0xd9d3ee) }
      if (p.back === 'pack') { img.rect(cx - u(4), bodyY - u(1), u(8), u(8), 0x6b4a2b); img.rect(cx - u(4), bodyY + u(2), u(8), 1, 0x3d2a18); img.glow(cx - u(1), bodyY - u(2), 0x5fd38a, u(2), 1) }
    }
    if (view === 'down' && p.back && p.back !== 'none') { img.rect(cx + u(3), bodyY - u(3), u(2), u(3), p.back === 'quiver' ? WOOD : 0x6b4a2b) }
    // --- corpo e braços
    if (view === 'side') {
      img.rect(bodyX, bodyY, bodyW, bodyH, p.coat)
      img.rect(bodyX, bodyB - u(3), bodyW, 1, darken(p.coat, 0.35))
      if (p.back === 'quiver') img.rect(bodyX - u(2), bodyY - u(2), u(2), u(8), WOOD)
      if (p.back === 'pack') img.rect(bodyX - u(4), bodyY, u(4), u(7), 0x6b4a2b)
      const ax = Math.round(cx - u(1)) + sw
      img.rect(ax, bodyY + 1, armW, armLen, darken(p.coat, 0.15)); img.rect(ax, bodyY + 1 + armLen, armW, u(1), p.skin)
      if (p.chest !== undefined) img.glow(bodyX + bodyW - u(2), bodyY + u(2), p.chest, u(2), u(3))
      if (p.weapon && p.weapon !== 'none') weapon(img, p.weapon, ax + armW + (p.weapon === 'book' || p.weapon === 'tablet' ? u(4) : 0), bodyY + 1 + armLen, s, wcol, glow, F)
    } else {
      img.rect(bodyX, bodyY, bodyW, bodyH, p.coat)
      const la = bodyX - armW, ra = bodyX + bodyW
      img.rect(la, bodyY + 1, armW, armLen + sw, darken(p.coat, 0.12)); img.rect(la, bodyY + 1 + armLen + sw, armW, u(1), p.skin)
      img.rect(ra, bodyY + 1, armW, armLen - sw, darken(p.coat, 0.12)); img.rect(ra, bodyY + 1 + armLen - sw, armW, u(1), p.skin)
      img.rect(bodyX, bodyB - u(3), bodyW, 1, darken(p.coat, 0.35))
      if (view === 'down') {
        img.rect(Math.round(cx) - 1, bodyY, s > 1 ? 2 : 1, bodyH - u(3), p.trim)
        img.rect(bodyX, bodyY, bodyW, 1, darken(p.coat, 0.2))
        if (p.chest !== undefined) img.glow(Math.round(cx) - u(1), bodyY + u(2), p.chest, u(2), u(3))
      } else backItem()
      const wp = p.weapon ?? 'none', hy = bodyY + 1 + armLen
      if (wp === 'book' || wp === 'tablet') { if (view === 'down') weapon(img, wp, Math.round(cx) + u(2), bodyY + u(4), s, wcol, glow, F) }
      else if (wp !== 'none') {
        const side = view === 'down' ? ra + armW : la - 1
        weapon(img, wp, side, hy - sw * (view === 'down' ? 1 : -1), s, wcol, glow, F)
        if (wp === 'daggers') weapon(img, wp, view === 'down' ? la - 1 : ra + armW, hy + sw, s, wcol, glow, F)
      }
    }
    // --- cabeça
    const skin = p.helmet ? p.hair : p.skin
    img.rect(headX, headY, headW, headH, skin)
    if (view === 'up') img.rect(headX, headY, headW, headH, p.hair)
    else if (view === 'down') {
      img.rect(headX, headY, headW, u(p.hood ? 3 : 2), p.hair)
      img.rect(headX, headY, 1, u(p.hood ? 7 : 4), p.hair); img.rect(headX + headW - 1, headY, 1, u(p.hood ? 7 : 4), p.hair)
      if (p.hood) img.rect(headX + 1, headY + headH - u(2), headW - 2, u(2), darken(p.hair, 0.3))
      if (eye !== null) { const es = s > 1 ? 2 : 1, ey = headY + u(3); img.glow(headX + u(2), ey, eye, es, es); img.glow(headX + headW - u(2) - es, ey, eye, es, es) }
    } else {
      img.rect(headX, headY, headW, u(p.hood ? 3 : 2), p.hair)
      img.rect(headX, headY, u(p.hood ? 3 : 2), u(p.hood ? 7 : 5), p.hair)
      if (p.hood) img.rect(headX + u(3), headY + headH - u(2), headW - u(3), u(2), darken(p.hair, 0.3))
      if (eye !== null) { const es = s > 1 ? 2 : 1; img.glow(headX + headW - u(2), headY + u(3), eye, es, es) }
    }
    p.hat?.(img, { x: headX, y: headY, w: headW, h: headH, view, s, f })
  }
}

export interface Quad {
  body: number; belly?: number; eye: number; tail?: 'bushy' | 'thin' | 'long' | 'none'; ears?: boolean; snout?: number
  s?: number; extra?: (img: Img, head: { x: number; y: number }, view: View, f: number, s: number) => void
}
export function quadruped(p: Quad) {
  const s = p.s ?? 1, u = (n: number) => Math.round(n * s), cell = 32 * s, leg = darken(p.body, 0.2), far = darken(p.body, 0.4)
  return (img: Img, view: View, f: number) => {
    const F = u(29), cx = cell / 2, sw = [1, 0, -1, 0][f], bob = f % 2 === 0 ? 1 : 0, lw = u(2)
    if (view === 'side') {
      const d = sw * u(1.5)
      if (p.tail === 'bushy') img.ell(u(6), u(17) + bob, u(3.5), u(2.2), p.body)
      if (p.tail === 'thin') img.line(u(8), u(18), u(3), u(14) + sw, leg)
      if (p.tail === 'long') { img.line(u(8), u(19), u(3), u(21) - sw, p.body, lw); img.line(u(3), u(21) - sw, u(1), u(18) - sw, p.body) }
      img.rect(u(11) - d, u(21), lw, F - u(21), far); img.rect(u(19) - d, u(21), lw, F - u(21), far)
      img.ell(u(15), u(19) + bob, u(8), u(4.5), p.body)
      if (p.belly !== undefined) img.rect(u(10), u(21) + bob, u(10), u(1), p.belly)
      img.rect(u(9) + d, u(21), lw, F - u(21), leg); img.rect(u(21) + d, u(21), lw, F - u(21), leg)
      const hx = u(23.5), hy = u(15) + bob
      img.ell(hx, hy, u(3.6), u(3.2), p.body); img.rect(u(26), hy, u(3), u(2), p.snout ?? p.body)
      if (p.ears !== false) { img.rect(u(21), hy - u(5), u(2), u(2), p.body) }
      img.glow(u(24), hy - u(1), p.eye, s > 1 ? 2 : 1, s > 1 ? 2 : 1)
      p.extra?.(img, { x: hx, y: hy }, view, f, s)
    } else if (view === 'down') {
      img.ell(cx, u(17) + bob, u(6), u(7), p.body)
      img.rect(cx - u(5), u(22), lw, F - u(22) - (f === 0 ? 1 : 0), leg); img.rect(cx + u(3), u(22), lw, F - u(22) - (f === 2 ? 1 : 0), leg)
      const hy = u(20) + bob
      img.ell(cx, hy, u(5), u(4.2), lighten(p.body, 0.06))
      if (p.ears !== false) { img.rect(cx - u(5), hy - u(6), u(2), u(3), p.body); img.rect(cx + u(3), hy - u(6), u(2), u(3), p.body) }
      const es = s > 1 ? 2 : 1
      img.glow(cx - u(3), hy - u(1), p.eye, es, es); img.glow(cx + u(2), hy - u(1), p.eye, es, es)
      img.rect(cx - u(1), hy + u(2), u(2), u(1), p.snout ?? darken(p.body, 0.4))
      p.extra?.(img, { x: cx, y: hy }, view, f, s)
    } else {
      const hy = u(13) + bob
      img.ell(cx, hy, u(4.2), u(3.4), p.body)
      if (p.ears !== false) { img.rect(cx - u(4), hy - u(5), u(2), u(3), p.body); img.rect(cx + u(2), hy - u(5), u(2), u(3), p.body) }
      p.extra?.(img, { x: cx, y: hy }, view, f, s)
      img.rect(cx - u(5), u(22), lw, F - u(22) - (f === 0 ? 1 : 0), leg); img.rect(cx + u(3), u(22), lw, F - u(22) - (f === 2 ? 1 : 0), leg)
      img.ell(cx, u(19) + bob, u(6), u(7), p.body)
      if (p.tail === 'bushy') img.ell(cx + sw, u(26), u(2.2), u(3), lighten(p.body, 0.08))
      if (p.tail === 'thin' || p.tail === 'long') img.line(cx, u(24), cx + sw * u(2), u(29), leg, p.tail === 'long' ? lw : 1)
    }
  }
}

/** Larva segmentada. */
export function grub(body: number, plate: number, s = 1, crown?: number) {
  const u = (n: number) => Math.round(n * s), cell = 32 * s
  return (img: Img, view: View, f: number) => {
    const wave = (i: number) => ([0, 1, 0, -1][(f + i) % 4])
    if (view === 'side') {
      for (let i = 0; i < 4; i++) {
        const x = u(7 + i * 5.5), y = u(22) + wave(i), r = u(i === 3 ? 4.5 : 4)
        img.ell(x, y, r, r, body); img.ell(x, y - u(2), r, u(2), plate)
        for (let k = -1; k <= 1; k += 2) img.rect(x + k * u(1.5), y + r - 1, 1, u(2), darken(body, 0.4))
      }
      img.glow(u(25), u(21) + wave(3), 0x1a1426, s > 1 ? 2 : 1, s > 1 ? 2 : 1); img.rect(u(28), u(23) + wave(3), u(2), 1, 0xe8dcc0)
      if (crown) for (let k = 0; k < 3; k++) img.rect(u(21 + k * 2), u(15) + wave(3) - (k === 1 ? u(1) : 0), 1, u(3), crown)
    } else {
      const up = view === 'up'
      for (let i = 0; i < 3; i++) {
        const y = up ? u(14 + i * 5) : u(24 - i * 5), r = u(i === 0 ? 5.5 : 5 - i * 0.6)
        if (!up || i > 0) { img.ell(cell / 2 + wave(i), y, r, u(4), body); img.ell(cell / 2 + wave(i), y - u(1.5), r - 1, u(2), plate) }
      }
      if (up) { img.ell(cell / 2 + wave(0), u(14), u(5.5), u(4), body); img.ell(cell / 2 + wave(0), u(12.5), u(4.5), u(2), plate) }
      else {
        const es = s > 1 ? 2 : 1
        img.glow(cell / 2 - u(3), u(24), 0x1a1426, es, es); img.glow(cell / 2 + u(2), u(24), 0x1a1426, es, es)
        img.rect(cell / 2 - u(2), u(27), 1, u(2), 0xe8dcc0); img.rect(cell / 2 + u(1), u(27), 1, u(2), 0xe8dcc0)
      }
      if (crown) for (let k = -1; k <= 1; k++) img.rect(cell / 2 + k * u(3), (up ? u(8) : u(17)) - (k === 0 ? u(1) : 0), 1, u(3), crown)
    }
  }
}

/** Morcego: bate as asas em todos os quadros. */
export function bat(body: number, wing: number, eye: number, s = 1, mane?: number) {
  const u = (n: number) => Math.round(n * s), cell = 32 * s
  return (img: Img, view: View, f: number) => {
    const cx = cell / 2, cy = u(15) + [0, 1, 0, -1][f], lift = [-4, 0, 4, 0][f]
    if (view === 'side') {
      img.line(cx, cy, cx - u(7), cy - u(lift) - u(2), wing, u(2)); img.line(cx - u(7), cy - u(lift) - u(2), cx - u(11), cy - u(lift) + u(3), wing, u(2))
      img.rect(cx - u(8), cy - u(lift), u(6), u(3), wing)
      img.ell(cx + u(1), cy, u(4), u(4), body)
      img.ell(cx + u(5), cy - u(2), u(3), u(3), body); img.rect(cx + u(4), cy - u(7), u(2), u(3), body)
      img.glow(cx + u(6), cy - u(3), eye, s > 1 ? 2 : 1, s > 1 ? 2 : 1)
      if (mane) img.rect(cx + u(1), cy - u(3), u(3), u(2), mane)
    } else {
      for (const k of [-1, 1]) {
        img.line(cx, cy, cx + k * u(8), cy - u(lift) - u(1), wing, u(2)); img.line(cx + k * u(8), cy - u(lift) - u(1), cx + k * u(13), cy - u(lift) + u(4), wing, u(2))
        img.rect(Math.min(cx + k * u(3), cx + k * u(11)), cy - Math.max(u(lift), 0), u(8), u(4) + Math.abs(u(lift)) / 2, wing)
      }
      img.ell(cx, cy + u(1), u(4), u(5), body); img.ell(cx, cy - u(3), u(3.5), u(3), body)
      img.rect(cx - u(4), cy - u(8), u(2), u(3), body); img.rect(cx + u(2), cy - u(8), u(2), u(3), body)
      if (mane) img.rect(cx - u(3), cy - u(1), u(6), u(2), mane)
      if (view === 'down') { const es = s > 1 ? 2 : 1; img.glow(cx - u(2), cy - u(4), eye, es, es); img.glow(cx + u(1), cy - u(4), eye, es, es) }
    }
    for (let k = 0; k < 2; k++) img.set(cx - u(6) + k * u(11) + f, cy + u(9) + ((f + k) % 3), 0x6f6a7d) // cinza caindo
  }
}

/** Arbusto de espinhos que anda. */
export function bramble(leaf: number, thorn: number, bud: number, s = 1, buds = 1) {
  const u = (n: number) => Math.round(n * s), cell = 32 * s
  return (img: Img, view: View, f: number) => {
    const cx = cell / 2, sw = [1, 0, -1, 0][f], bob = f % 2
    for (const k of [-1, 1]) { img.line(cx + k * u(5), u(18), cx + k * u(11), u(13) + k * sw * u(1.5), thorn, u(1.5)); img.set(cx + k * u(11), u(12) + k * sw, 0xe8dcc0) }
    img.rect(cx - u(4), u(25), u(2), u(4) - (f === 0 ? 1 : 0), thorn); img.rect(cx + u(2), u(25), u(2), u(4) - (f === 2 ? 1 : 0), thorn)
    img.ell(cx, u(20) + bob, u(8), u(6.5), leaf); img.ell(cx - u(4), u(16) + bob, u(4), u(4), darken(leaf, 0.15)); img.ell(cx + u(4), u(17) + bob, u(4), u(3.5), lighten(leaf, 0.1))
    for (const [dx, dy] of [[-6, 21], [5, 23], [-2, 24], [2, 15], [7, 19], [-7, 17]]) img.set(cx + u(dx), u(dy) + bob, 0xe8dcc0)
    if (view !== 'up') for (let b = 0; b < buds; b++) {
      const bx = cx + (view === 'side' ? u(3) : 0) + (b - (buds - 1) / 2) * u(5), by = u(10) + bob + (b % 2) * u(2)
      img.rect(bx - 1, by + u(2), u(1.5), u(4), thorn); img.ell(bx, by, u(3), u(3), bud); img.glow(bx - 1, by - 1, lighten(bud, 0.5), u(1.5), u(1.5))
    } else img.ell(cx, u(12) + bob, u(3), u(3), darken(bud, 0.2))
  }
}

/** Brasas flutuantes presas por anéis de ferro. */
export function ember(coal: number, hot: number, s = 1, cage = false) {
  const u = (n: number) => Math.round(n * s), cell = 32 * s
  return (img: Img, _view: View, f: number) => {
    const cx = cell / 2, cy = u(16) + [0, -1, 0, 1][f]
    img.ell(cx, cy, u(7), u(7), coal)
    for (const [dx, dy, r] of [[-3, -2, 2.4], [3, 1, 2.6], [0, 4, 2], [2, -4, 1.6]]) { img.ell(cx + u(dx), cy + u(dy), u(r), u(r), hot); img.glow(cx + u(dx) - 1, cy + u(dy) - 1, lighten(hot, 0.5), u(1.4), u(1.4)) }
    img.ring(cx, cy, u(8.5), u(3), 0x2a2733, 1)
    if (cage) { img.ring(cx, cy, u(3), u(8.5), 0x2a2733, 1); img.ring(cx, cy, u(9.5), u(9.5), 0x2a2733, 1) }
    for (let k = 0; k < 3; k++) { const fx = cx + u([-5, 1, 5][k]), fy = cy - u(8) - ((f + k) % 3) * u(1.5); img.glow(fx, fy, hot, u(1.4), u(2)); img.glow(fx, fy - u(1), 0xffe9a8) }
    img.ell(cx, u(29), u(5), u(1), 0x000000) // sombra no chão: mostra que flutua
  }
}
