// Biblioteca mínima de pixel art: buffer de cores, primitivas, sombreamento, contorno e PNG.
import { deflateSync } from 'node:zlib'

export const OUTLINE = 0x120e1c
export const mix = (a: number, b: number, t: number) => {
  const ch = (s: number) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t)
  return (ch(16) << 16) | (ch(8) << 8) | ch(0)
}
export const lighten = (c: number, t = 0.2) => mix(c, 0xffffff, t)
export const darken = (c: number, t = 0.25) => mix(c, 0x05030a, t)

export class Img {
  px: Int32Array // 0xRRGGBB ou -1 (transparente)
  raw = new Set<number>() // pixels que não recebem sombreamento (brilhos)
  constructor(public w: number, public h: number, fill = -1) { this.px = new Int32Array(w * h).fill(fill) }
  get(x: number, y: number) { return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.px[y * this.w + x] : -1 }
  set(x: number, y: number, c: number) { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.px[y * this.w + x] = c }
  /** Pixel de brilho: cor exata, sem sombra. */
  glow(x: number, y: number, c: number, w = 1, h = 1) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const X = Math.round(x) + i, Y = Math.round(y) + j; this.set(X, Y, c); if (X >= 0 && Y >= 0 && X < this.w && Y < this.h) this.raw.add(Y * this.w + X) }
  }
  rect(x: number, y: number, w: number, h: number, c: number) {
    x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h)
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c)
  }
  ell(cx: number, cy: number, rx: number, ry: number, c: number) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) this.set(x, y, c)
    }
  }
  ring(cx: number, cy: number, rx: number, ry: number, c: number, t = 1) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const d = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2
      const inner = ((x + 0.5 - cx) / Math.max(0.1, rx - t)) ** 2 + ((y + 0.5 - cy) / Math.max(0.1, ry - t)) ** 2
      if (d <= 1 && inner > 1) this.set(x, y, c)
    }
  }
  line(x0: number, y0: number, x1: number, y1: number, c: number, t = 1) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1)
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1
    let err = dx + dy
    for (;;) {
      this.rect(x0, y0, t, t, c)
      if (x0 === x1 && y0 === y1) break
      const e2 = 2 * err
      if (e2 >= dy) { err += dy; x0 += sx }
      if (e2 <= dx) { err += dx; y0 += sy }
    }
  }
  blit(src: Img, dx: number, dy: number) {
    for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) { const c = src.px[y * src.w + x]; if (c >= 0) this.set(dx + x, dy + y, c) }
  }
  flipH(): Img {
    const o = new Img(this.w, this.h)
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) o.px[y * this.w + (this.w - 1 - x)] = this.px[y * this.w + x]
    return o
  }
  /** Luz de cima à esquerda nas bordas e contorno escuro de 1 pixel. */
  finish(outline = OUTLINE): this {
    const src = this.px.slice()
    const g = (x: number, y: number) => (x >= 0 && y >= 0 && x < this.w && y < this.h ? src[y * this.w + x] : -1)
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const i = y * this.w + x, c = src[i]
      if (c < 0 || this.raw.has(i)) continue
      if (g(x, y + 1) < 0 || g(x + 1, y) < 0) this.px[i] = darken(c, 0.28)
      else if (g(x, y - 1) < 0 || g(x - 1, y) < 0) this.px[i] = lighten(c, 0.18)
    }
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (src[y * this.w + x] >= 0) continue
      if (g(x - 1, y) >= 0 || g(x + 1, y) >= 0 || g(x, y - 1) >= 0 || g(x, y + 1) >= 0) this.px[y * this.w + x] = outline
    }
    return this
  }
  /** Amplia por um fator inteiro (pixels continuam nítidos). */
  scale(n: number): Img {
    const o = new Img(this.w * n, this.h * n)
    for (let y = 0; y < o.h; y++) for (let x = 0; x < o.w; x++) o.px[y * o.w + x] = this.px[Math.floor(y / n) * this.w + Math.floor(x / n)]
    return o
  }
  png(): Buffer {
    const rowLen = this.w * 4 + 1, raw = Buffer.alloc(rowLen * this.h)
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const c = this.px[y * this.w + x], o = y * rowLen + 1 + x * 4
      if (c >= 0) { raw[o] = (c >> 16) & 255; raw[o + 1] = (c >> 8) & 255; raw[o + 2] = c & 255; raw[o + 3] = 255 }
    }
    const chunk = (type: string, data: Buffer) => {
      const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
      const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
      const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body))
      return Buffer.concat([len, body, crc])
    }
    const ihdr = Buffer.alloc(13)
    ihdr.writeUInt32BE(this.w, 0); ihdr.writeUInt32BE(this.h, 4); ihdr[8] = 8; ihdr[9] = 6
    return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))])
  }
}

const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0 } return t })()
function crc32(buf: Buffer): number { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }

export function rng(seed: number) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296 } }

export type View = 'down' | 'side' | 'up'
/** Folha 4×4: linhas baixo, esquerda, direita, cima; 4 quadros de caminhada. `draw` desenha o lado direito; a esquerda é espelhada. */
export function sheet(cell: number, draw: (img: Img, view: View, frame: number) => void): Img {
  const out = new Img(cell * 4, cell * 4)
  const views: [View, boolean][] = [['down', false], ['side', true], ['side', false], ['up', false]]
  views.forEach(([view, flip], row) => {
    for (let f = 0; f < 4; f++) {
      let img = new Img(cell, cell)
      draw(img, view, f)
      img.finish()
      if (flip) img = img.flipH()
      out.blit(img, f * cell, row * cell)
    }
  })
  return out
}
/** Grade de quadros independentes (efeitos e objetos de cenário). */
export function grid(cell: number, cols: number, rows: number, draw: (img: Img, i: number) => void, finish = true): Img {
  const out = new Img(cell * cols, cell * rows)
  for (let i = 0; i < cols * rows; i++) { const img = new Img(cell, cell); draw(img, i); if (finish) img.finish(); out.blit(img, (i % cols) * cell, Math.floor(i / cols) * cell) }
  return out
}
