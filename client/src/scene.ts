// Cena 2D vista de cima. Só desenha o que o servidor manda; não decide nada do jogo.
import Phaser from 'phaser'
import { ANIMATED, ASSETS, FORMAT_GRID } from '../../shared/assets.ts'
import { NPCS } from '../../shared/content.ts'
import type { Ent, Fx, RoomInfo } from '../../shared/protocol.ts'
import { assetUrl, hasAsset, monsterKey } from './assets.ts'
import { onMessage, send } from './net.ts'

// Formatos que a cena não carrega: ícones e fundo são da interface; 'props' só alimenta o montador de mapas.
const UI_ONLY = new Set(['icon', 'wide', 'props'])
const SCALE = 2 // ampliação dos sprites em pixel art
const CELL = 64 // tamanho da célula dos marcadores gerados por código
const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0 }
const hsl = (h: number, s: number, l: number) => `hsl(${h % 360} ${s}% ${l}%)`
const TILE_COLORS: Record<string, [string, string]> = {
  'mapas/cidade': ['#1b1a2b', '#252338'], 'mapas/minas-ocas': ['#231a14', '#30241b'], 'mapas/bosque-cinzento': ['#1a2320', '#24302b'],
  'mapas/cidadela-afundada': ['#12242a', '#1a333a'], 'mapas/forja-extinta': ['#1c1413', '#2b1b17'], 'mapas/arena': ['#1c1c22', '#26262e'],
}

interface View {
  box: Phaser.GameObjects.Container; sprite: Phaser.GameObjects.Image; bar?: Phaser.GameObjects.Graphics
  tx: number; ty: number; row: number; ent: Ent; key: string; seen: number; sheet: boolean; sx: number
}

export class GameScene extends Phaser.Scene {
  private views = new Map<number, View>()
  private room: RoomInfo | null = null
  private you = 0
  private ground?: Phaser.GameObjects.Image
  private decor: Phaser.GameObjects.GameObject[] = []
  private keys!: Record<string, Phaser.Input.Keyboard.Key>
  private lastMove = '0,0'
  private dest: { x: number; y: number } | null = null
  private snapN = 0
  onNearNpc: (npc: (typeof NPCS)[number] | null) => void = () => {}
  private nearNpc: (typeof NPCS)[number] | null = null

  constructor() { super('game') }

  preload() {
    for (const a of ASSETS) if (hasAsset(a.id) && !UI_ONLY.has(a.format)) this.load.image(a.id, assetUrl(a.id))
  }

  create() {
    for (const a of ASSETS) {
      if (UI_ONLY.has(a.format)) continue
      const missing = !this.textures.exists(a.id)
      if (missing) { if (a.optional) continue; this.placeholder(a.id, a.format) }
      // Personagem com arte própria só é fatiado se a folha 4×4 já foi importada; senão é imagem única.
      const g = a.format === 'sheet' && !missing && !ANIMATED.has(a.id) ? FORMAT_GRID.image : FORMAT_GRID[a.format]
      if (g.cols * g.rows > 1) {
        const tex = this.textures.get(a.id), src = tex.getSourceImage() as HTMLImageElement
        const fw = src.width / g.cols, fh = src.height / g.rows
        for (let i = 0; i < g.cols * g.rows; i++) tex.add(i, 0, (i % g.cols) * fw, Math.floor(i / g.cols) * fh, fw, fh)
      }
    }
    this.keys = this.input.keyboard!.addKeys('W,A,S,D,UP,LEFT,DOWN,RIGHT,E', false) as Record<string, Phaser.Input.Keyboard.Key>
    this.input.keyboard!.on('keydown-E', () => { if (!this.typing()) this.interact() })
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.room?.kind !== 'city') return
      const w = p.positionToCamera(this.cameras.main) as Phaser.Math.Vector2
      for (const v of this.views.values()) {
        if (v.ent.k === 'p' && !v.ent.me && v.ent.n && Math.hypot(v.box.x - w.x, v.box.y - 40 - w.y) < 44) { this.game.events.emit('player', v.ent.n); return }
      }
      const npc = NPCS.find((n) => Math.hypot(n.x - w.x, n.y - 48 - w.y) < 56)
      this.dest = npc ? { x: npc.x, y: npc.y + 46 } : { x: w.x, y: w.y }
    })
    onMessage((m) => {
      if (m.t === 'room') this.enterRoom(m.room, m.you)
      else if (m.t === 'snap') this.applySnap(m.ents, m.fx)
    })
    this.game.events.emit('scene-ready')
  }

  /** Em telas maiores que o mapa, centraliza o mapa em vez de encostá-lo num canto. */
  private fitCamera() {
    const room = this.room, cam = this.cameras.main
    if (!room) return
    const ex = Math.max(0, (cam.width - room.w) / 2), ey = Math.max(0, (cam.height - room.h) / 2)
    cam.setBounds(-ex, -ey, room.w + 2 * ex, room.h + 2 * ey)
  }

  private typing() { const el = document.activeElement; return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement }
  interact() {
    if (this.room?.kind === 'city') { if (this.nearNpc) this.game.events.emit('npc', this.nearNpc.panel) }
    else if (this.room?.kind === 'hunt') send({ t: 'extract' })
  }

  // ---------- Marcadores para assets ausentes ----------
  private placeholder(id: string, format: string) {
    const g = FORMAT_GRID[format as keyof typeof FORMAT_GRID]
    const size = format === 'map' ? 256 : CELL
    const tex = this.textures.createCanvas(id, g.cols * size, g.rows * size)!
    const c = tex.getContext()
    const hue = hash(id) % 360
    if (format === 'map') {
      const [a, b] = TILE_COLORS[id] ?? ['#1b1a2b', '#252338']
      c.fillStyle = a; c.fillRect(0, 0, size, size)
      let s = hash(id)
      const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296 }
      c.fillStyle = b
      for (let i = 0; i < 90; i++) c.fillRect(Math.floor(rnd() * 64) * 4, Math.floor(rnd() * 64) * 4, 4 + Math.floor(rnd() * 3) * 4, 4)
    } else {
      for (let i = 0; i < g.cols * g.rows; i++) {
        const ox = (i % g.cols) * size, oy = Math.floor(i / g.cols) * size, cx = ox + size / 2
        if (format === 'sheet' || /^(npcs|cacadores|monstros)\//.test(id)) {
          const row = Math.floor(i / g.cols), bob = i % 2 ? 2 : 0
          const monster = id.startsWith('monstros/')
          c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(cx, oy + 56, 16, 5, 0, 0, 7); c.fill()
          c.fillStyle = hsl(hue, monster ? 45 : 55, monster ? 38 : 48)
          if (monster) { c.beginPath(); c.ellipse(cx, oy + 38 - bob, 19, 17, 0, 0, 7); c.fill() }
          else { c.fillRect(cx - 11, oy + 26 - bob, 22, 28); c.fillStyle = '#e8c9a8'; c.fillRect(cx - 8, oy + 10 - bob, 16, 16) }
          // marca de direção: baixo, esquerda, direita, cima
          c.fillStyle = monster ? '#ffd27a' : '#14121f'
          const ey = oy + (monster ? 34 : 16) - bob
          if (row === 0) { c.fillRect(cx - 6, ey, 4, 4); c.fillRect(cx + 2, ey, 4, 4) }
          else if (row === 1) c.fillRect(cx - 8, ey, 4, 4)
          else if (row === 2) c.fillRect(cx + 4, ey, 4, 4)
        } else if (format === 'fx') {
          c.strokeStyle = hsl(hue, 80, 70); c.lineWidth = 4; c.globalAlpha = 1 - i * 0.2
          c.beginPath(); c.arc(cx, oy + size / 2, 8 + i * 6, 0, 7); c.stroke(); c.globalAlpha = 1
        } else if (format === 'props') {
          c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(cx, oy + 54, 18, 5, 0, 0, 7); c.fill()
          c.fillStyle = hsl(hue + i * 25, 18, 30); c.fillRect(cx - 12 - (i % 2) * 4, oy + 18 + i * 4, 24 + (i % 2) * 8, 36 - i * 4)
        } else if (id === 'objetos/fenda') {
          c.fillStyle = '#8b5cf6'; c.beginPath(); c.ellipse(cx, oy + 32, 16, 28, 0, 0, 7); c.fill()
          c.fillStyle = '#38d6e0'; c.beginPath(); c.ellipse(cx, oy + 32, 8, 18, 0, 0, 7); c.fill()
        } else if (id === 'objetos/resquicio') {
          c.fillStyle = '#2a2140'; c.beginPath(); c.ellipse(cx, oy + 40, 18, 9, 0, 0, 7); c.fill()
          c.fillStyle = '#8b5cf6'; c.fillRect(cx - 2, oy + 20, 4, 14)
        } else if (id === 'efeitos/flecha') { c.fillStyle = '#ffcf5c'; c.fillRect(ox + 14, oy + 30, 36, 4) }
        else { c.fillStyle = '#b06bff'; c.beginPath(); c.arc(cx, oy + 32, 9, 0, 7); c.fill() }
      }
    }
    tex.refresh()
  }

  // ---------- Sala ----------
  private enterRoom(room: RoomInfo, you: number) {
    this.room = room; this.you = you; this.dest = null; this.lastMove = '0,0'
    for (const v of this.views.values()) v.box.destroy()
    this.views.clear()
    for (const d of this.decor) d.destroy()
    this.decor = []
    this.ground?.destroy()
    // O mapa é uma imagem só, com metade do tamanho do mundo, exibida ampliada (pixels nítidos).
    const mapKey = this.textures.exists(`mapas/${room.map}`) ? `mapas/${room.map}` : 'mapas/arena'
    this.ground = this.add.image(0, 0, mapKey).setOrigin(0).setDisplaySize(room.w, room.h).setDepth(-10)
    this.fitCamera()
    this.scale.off('resize', this.fitCamera, this); this.scale.on('resize', this.fitCamera, this)
    this.cameras.main.setBackgroundColor('#07060d')
    if (room.kind === 'city') {
      for (const n of NPCS) {
        const key = `npcs/${n.id}`
        this.decor.push(this.add.image(n.x, n.y, key).setScale(SCALE).setOrigin(0.5, 1).setDepth(n.y))
        this.decor.push(this.add.text(n.x, n.y - 122, n.name, { fontSize: '12px', color: '#ffcf5c', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5).setDepth(5000))
        if (n.panel === 'fendas') this.decor.push(this.add.image(n.x + 96, n.y - 6, 'objetos/fenda').setScale(SCALE).setOrigin(0.5, 1).setDepth(n.y - 1))
      }
    }
  }

  private textureFor(e: Ent): string {
    if (e.k === 'p') return `cacadores/${e.s}`
    if (e.k === 'c') return 'objetos/resquicio'
    return monsterKey(e.s)
  }

  private applySnap(ents: Ent[], fx: Fx[]) {
    this.snapN++
    for (const e of ents) {
      let v = this.views.get(e.id)
      if (!v) {
        const key = this.textureFor(e)
        // Escala inteira: cada pixel do sprite vira um bloco nítido. Elites são um pouco maiores.
        const sprite = this.add.image(0, 0, key).setScale(e.mk === 'elite' ? SCALE + 0.5 : SCALE).setOrigin(0.5, 1)
        const size = sprite.displayHeight
        const box = this.add.container(e.x, e.y, [sprite])
        if (e.k === 'e') sprite.setTint(0x8a6cff).setAlpha(0.88)
        if (e.n && e.k !== 'c') {
          const color = e.k === 'p' ? (e.me ? '#ffffff' : '#c9c3e6') : e.k === 'e' ? '#b79cff' : e.mk === 'chefe' ? '#ff6b7a' : e.mk === 'elite' ? '#ffcf5c' : '#d7d3e8'
          const label = e.k === 'p' && e.r ? `[${e.r}] ${e.g ? `<${e.g}> ` : ''}${e.n}` : e.n
          box.add(this.add.text(0, -size - 12, label, { fontSize: '11px', color, stroke: '#000', strokeThickness: 3 }).setOrigin(0.5))
        }
        v = { box, sprite, tx: e.x, ty: e.y, row: 0, ent: e, key, seen: this.snapN, sheet: this.textures.get(key).frameTotal > 2, sx: sprite.scaleX }
        if (e.k !== 'c' && this.room?.kind !== 'city') { v.bar = this.add.graphics(); box.add(v.bar) }
        this.views.set(e.id, v)
      }
      v.tx = e.x; v.ty = e.y; v.ent = e; v.seen = this.snapN
      if (e.k === 'c') v.sprite.setAlpha(e.hp ? 1 : 0.35)
      else if (e.k === 'p') { if (e.sh) v.sprite.setTint(0x9fd8ff); else v.sprite.clearTint() }
      if (v.bar) {
        const w = e.mk === 'chefe' ? 90 : 46, y = -v.sprite.displayHeight - 4
        v.bar.clear().fillStyle(0x000000, 0.7).fillRect(-w / 2 - 1, y - 1, w + 2, 6)
          .fillStyle(e.k === 'm' ? 0xe5484d : e.k === 'e' ? 0x8b5cf6 : 0x5fd38a).fillRect(-w / 2, y, w * Math.max(0, e.hp / e.mhp), 4)
      }
    }
    for (const [id, v] of this.views) {
      if (v.seen === this.snapN) continue
      this.views.delete(id)
      this.tweens.add({ targets: v.box, alpha: 0, duration: 220, onComplete: () => v.box.destroy() })
    }
    for (const f of fx) this.playFx(f)
  }

  private floatText(x: number, y: number, text: string, color: string, size = 14) {
    const t = this.add.text(x + (Math.random() - 0.5) * 16, y, text, { fontSize: `${size}px`, color, fontStyle: 'bold', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5).setDepth(9000)
    this.tweens.add({ targets: t, y: y - 34, alpha: 0, duration: 750, onComplete: () => t.destroy() })
  }
  private burst(key: string, x: number, y: number, size: number) {
    const img = this.add.image(x, y, key, 0).setDisplaySize(size, size).setDepth(8999)
    this.tweens.addCounter({ from: 0, to: 3.99, duration: 380, onUpdate: (tw) => img.setFrame(Math.floor(tw.getValue() ?? 0)), onComplete: () => img.destroy() })
  }
  private playFx(f: Fx) {
    if (f.f === 'hit') {
      const a = this.views.get(f.from), b = this.views.get(f.to)
      if (!b) return
      const bx = b.box.x, by = b.box.y - 40
      if (a) {
        const dx = Math.sign(b.box.x - a.box.x)
        this.tweens.add({ targets: a.sprite, x: dx * 10, duration: 70, yoyo: true })
        // Parado, o atacante vira para o alvo (a linha da folha é a direção).
        const ddx = b.box.x - a.box.x, ddy = b.box.y - a.box.y
        a.row = Math.abs(ddx) > Math.abs(ddy) ? (ddx < 0 ? 1 : 2) : ddy < 0 ? 3 : 0
        if (f.proj) {
          const key = f.proj === 'arrow' ? 'efeitos/flecha' : 'efeitos/projetil-arcano'
          const p = this.add.image(a.box.x, a.box.y - 40, key).setDisplaySize(36, 36).setDepth(8998).setRotation(Math.atan2(by - (a.box.y - 40), bx - a.box.x))
          this.tweens.add({ targets: p, x: bx, y: by, duration: 110, onComplete: () => p.destroy() })
        } else this.burst('efeitos/golpe', bx, by, 90)
      }
      const mine = b.ent.me
      this.floatText(bx, by - 14, `${f.crit ? '✦' : ''}${f.dmg}`, mine ? '#ff6b7a' : f.skill ? '#7df2ff' : f.crit ? '#ffcf5c' : '#ffffff', f.skill ? 19 : f.crit ? 18 : 13)
      this.tweens.add({ targets: b.sprite, alpha: 0.5, duration: 50, yoyo: true })
    } else if (f.f === 'skill') {
      const v = this.views.get(f.id)
      if (v) this.floatText(v.box.x, v.box.y - v.sprite.displayHeight - 4, f.name, '#7df2ff', 13)
      if (f.x !== undefined && f.y !== undefined && f.r) {
        const ring = this.add.circle(f.x, f.y, f.r, 0x8b5cf6, 0.22).setStrokeStyle(2, 0xc4a3ff, 0.9).setDepth(8990).setScale(0.3)
        this.tweens.add({ targets: ring, scale: 1, alpha: 0, duration: 380, onComplete: () => ring.destroy() })
      }
    } else if (f.f === 'heal') {
      const v = this.views.get(f.to); if (v) this.floatText(v.box.x, v.box.y - 50, `+${f.amount}`, '#5fd38a')
    } else if (f.f === 'level') {
      const v = this.views.get(f.id); if (v) { this.burst('efeitos/subir-nivel', v.box.x, v.box.y - 26, 96); this.floatText(v.box.x, v.box.y - 70, 'SUBIU DE NÍVEL', '#ffcf5c', 16) }
    } else if (f.f === 'extract') {
      this.burst('efeitos/evocacao', f.x, f.y - 16, 84)
      this.floatText(f.x, f.y - 40, f.ok ? 'ECO EVOCADO' : 'falhou', f.ok ? '#b79cff' : '#9a93b5', f.ok ? 16 : 12)
    }
  }

  update(_t: number, deltaMs: number) {
    const dt = deltaMs / 1000
    const me = this.views.get(this.you)
    // Movimento na cidade: teclas ou toque no chão
    if (this.room?.kind === 'city') {
      let dx = 0, dy = 0
      if (!this.typing()) {
        const k = this.keys
        dx = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0)
        dy = (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0)
      }
      if (dx || dy) this.dest = null
      else if (this.dest && me) {
        const ddx = this.dest.x - me.tx, ddy = this.dest.y - me.ty, d = Math.hypot(ddx, ddy)
        if (d < 10) this.dest = null; else { dx = ddx / d; dy = ddy / d }
      }
      const key = `${dx.toFixed(2)},${dy.toFixed(2)}`
      if (key !== this.lastMove) { this.lastMove = key; send({ t: 'move', dx, dy }) }
      const near = me ? NPCS.find((n) => Math.hypot(n.x - me.box.x, n.y - me.box.y) < 80) ?? null : null
      if (near !== this.nearNpc) { this.nearNpc = near; this.onNearNpc(near) }
    } else if (this.nearNpc) { this.nearNpc = null; this.onNearNpc(null) }

    const frame = Math.floor(this.time.now / 140) % 4
    for (const v of this.views.values()) {
      const dx = v.tx - v.box.x, dy = v.ty - v.box.y, d = Math.hypot(dx, dy)
      if (d > 300) v.box.setPosition(v.tx, v.ty)
      else { const k = Math.min(1, dt * 12); v.box.x += dx * k; v.box.y += dy * k }
      v.box.setDepth(v.box.y)
      if (v.ent.k === 'c') continue
      const moving = d > 1.5
      if (moving) v.row = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 1 : 2) : dy < 0 ? 3 : 0
      if (v.sheet) v.sprite.setFrame(v.row * 4 + (moving ? frame : 0))
      else {
        // Imagem única: vira para o lado do movimento e balança ao andar.
        if (moving && Math.abs(dx) > 0.5) v.sprite.scaleX = dx < 0 ? -v.sx : v.sx
        v.sprite.y = moving ? -Math.abs(Math.sin(this.time.now / 110 + v.ent.id)) * 4 : 0
      }
    }
    if (me) {
      const cam = this.cameras.main
      cam.scrollX += (me.box.x - cam.width / 2 - cam.scrollX) * Math.min(1, dt * 6)
      cam.scrollY += (me.box.y - cam.height / 2 - cam.scrollY) * Math.min(1, dt * 6)
    }
  }
}

export function startGame(): Promise<{ game: Phaser.Game; scene: GameScene }> {
  return new Promise((ready) => {
    const scene = new GameScene()
    const game = new Phaser.Game({
      type: Phaser.AUTO, parent: 'game', backgroundColor: '#07060d', pixelArt: true, roundPixels: true,
      scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
      scene, banner: false, audio: { noAudio: true },
    })
    game.events.once('scene-ready', () => ready({ game, scene }))
  })
}
