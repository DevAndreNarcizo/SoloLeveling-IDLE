// Cena 2D vista de cima. Só desenha o que o servidor manda; não decide nada do jogo.
import Phaser from 'phaser'
import { ANIMATED, ASSETS, FORMAT_GRID } from '../../shared/assets.ts'
import { NPCS } from '../../shared/content.ts'
import type { Ent, Fx, RoomInfo } from '../../shared/protocol.ts'
import { assetUrl, hasAsset, monsterKey } from './assets.ts'
import { onMessage, send } from './net.ts'
import { COLOR, Effects, skillStyle, strikeColor } from './fx.ts'

// Formatos que a cena não carrega: ícones e fundo são da interface; 'props' só alimenta o montador de mapas.
const UI_ONLY = new Set(['icon', 'wide', 'props'])
// Folhas animadas já vêm no tamanho final (80 px de altura) e aparecem em tamanho real.
// Imagens únicas antigas (52 px) são ampliadas para ficar na mesma altura.
const LEGACY = 1.5
const scaleFor = (key: string) => (ANIMATED.has(key) ? 1 : LEGACY)
const CELL = 64 // tamanho da célula dos marcadores gerados por código
const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0 }
// Criaturas que voam ou flutuam: ficam um pouco acima do chão e oscilam no ar.
const FLYERS = new Set(['morcego-de-cinza', 'asa-ancia', 'brasa-errante', 'coracao-de-fornalha'])
const hsl = (h: number, s: number, l: number) => `hsl(${h % 360} ${s}% ${l}%)`
const TILE_COLORS: Record<string, [string, string]> = {
  'mapas/cidade': ['#1b1a2b', '#252338'], 'mapas/minas-ocas': ['#231a14', '#30241b'], 'mapas/bosque-cinzento': ['#1a2320', '#24302b'],
  'mapas/cidadela-afundada': ['#12242a', '#1a333a'], 'mapas/forja-extinta': ['#1c1413', '#2b1b17'], 'mapas/arena': ['#1c1c22', '#26262e'],
}

interface View {
  box: Phaser.GameObjects.Container; sprite: Phaser.GameObjects.Image; bar?: Phaser.GameObjects.Graphics
  tx: number; ty: number; row: number; ent: Ent; key: string; seen: number; sheet: boolean; sx: number
  /** Deslocamento do sprite dentro da caixa: investida, recuo e empurrão ao ser atingido. */
  ox: number; oy: number
  fly: number // altura de voo (0 = anda no chão)
  flashUntil: number // enquanto o clarão de impacto dura, a cor normal não volta
  bubble?: Phaser.GameObjects.Ellipse // cúpula da Barreira
  dying?: boolean
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
  private roomSnaps = 0
  private fx!: Effects
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
    this.fx = new Effects(this)
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
    this.room = room; this.you = you; this.dest = null; this.lastMove = '0,0'; this.roomSnaps = 0
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
    this.decor.push(...this.fx.ambient(room.map, room.w, room.h))
    if (room.kind === 'city') {
      for (const n of NPCS) {
        const key = `npcs/${n.id}`
        const img = this.add.image(n.x, n.y, key).setScale(scaleFor(key)).setOrigin(0.5, 1).setDepth(n.y)
        this.decor.push(this.add.ellipse(n.x, n.y - 2, img.displayWidth * 0.7, 10, 0x000000, 0.35).setDepth(n.y - 1), img)
        // Respiração: sobe e desce um pixel, em passos (sem borrar o pixel art), cada NPC no seu ritmo.
        this.tweens.add({ targets: img, y: n.y - 1, duration: 900 + (n.x % 7) * 60, yoyo: true, repeat: -1, ease: 'Stepped' })
        this.decor.push(this.add.text(n.x, n.y - img.displayHeight - 10, n.name, { fontSize: '12px', color: '#ffcf5c', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5).setDepth(5000))
        if (n.panel === 'fendas') this.decor.push(...this.fx.portal(n.x + 92, n.y - 2))
      }
    }
  }

  private textureFor(e: Ent): string {
    if (e.k === 'p') return `cacadores/${e.s}`
    if (e.k === 'c') return 'objetos/resquicio'
    return monsterKey(e.s)
  }

  /** Devolve o sprite à cor normal: eco arroxeado, caçador com barreira azulado. */
  private baseTint(v: View) {
    if (v.ent.k === 'e') v.sprite.setTint(0x8a6cff)
    else if (v.ent.k === 'p' && v.ent.sh) v.sprite.setTint(0x9fd8ff)
    else v.sprite.clearTint()
  }
  /** Empurra o sprite e deixa voltar sozinho (investida, recuo, impacto). */
  private nudge(v: View, dx: number, dy: number, duration = 70) {
    this.tweens.add({ targets: v, ox: dx, oy: dy, duration, yoyo: true, ease: 'Quad.easeOut' })
  }

  private applySnap(ents: Ent[], fx: Fx[]) {
    this.snapN++; this.roomSnaps++
    const dying = new Set<number>()
    for (const f of fx) if (f.f === 'die') dying.add(f.id)
    for (const e of ents) {
      let v = this.views.get(e.id)
      if (!v) {
        const key = this.textureFor(e)
        // Escala inteira: cada pixel do sprite vira um bloco nítido. Elites são um pouco maiores.
        const sprite = this.add.image(0, 0, key).setScale(scaleFor(key) * (e.mk === 'elite' ? 1.25 : 1)).setOrigin(0.5, 1)
        const size = sprite.displayHeight
        const fly = e.k === 'm' && FLYERS.has(e.s) ? 16 : 0
        const box = this.add.container(e.x, e.y, [sprite])
        // Sombra no chão: prende o personagem ao cenário. Quem voa tem sombra menor.
        if (e.k !== 'c') box.addAt(this.add.ellipse(0, -2, Math.min(sprite.displayWidth, size) * (fly ? 0.4 : 0.6), fly ? 7 : 10, 0x000000, fly ? 0.25 : 0.38), 0)
        if (e.k === 'e') sprite.setTint(0x8a6cff).setAlpha(0.88)
        if (e.n && e.k !== 'c') {
          const color = e.k === 'p' ? (e.me ? '#ffffff' : '#c9c3e6') : e.k === 'e' ? '#b79cff' : e.mk === 'chefe' ? '#ff6b7a' : e.mk === 'elite' ? '#ffcf5c' : '#d7d3e8'
          const label = e.k === 'p' && e.r ? `[${e.r}] ${e.g ? `<${e.g}> ` : ''}${e.n}` : e.n
          box.add(this.add.text(0, -size - 12 - fly, label, { fontSize: '11px', color, stroke: '#000', strokeThickness: 3 }).setOrigin(0.5))
        }
        v = { box, sprite, tx: e.x, ty: e.y, row: 0, ent: e, key, seen: this.snapN, sheet: this.textures.get(key).frameTotal > 2, sx: sprite.scaleX, ox: 0, oy: 0, fly, flashUntil: 0 }
        if (e.k !== 'c' && this.room?.kind !== 'city') { v.bar = this.add.graphics(); box.add(v.bar) }
        this.views.set(e.id, v)
        // Quem aparece no meio da caçada surge de um rasgo de sombra; ecos sobem do chão.
        if (this.roomSnaps > 1 && this.room?.kind !== 'city' && (e.k === 'm' || e.k === 'e')) {
          const boss = e.mk === 'chefe'
          this.fx.spawn(e.x, e.y, boss)
          sprite.setScale(v.sx * 0.2, sprite.scaleY * 0.2).setAlpha(0)
          this.tweens.add({ targets: sprite, scaleX: v.sx, scaleY: Math.abs(v.sx), alpha: e.k === 'e' ? 0.88 : 1, duration: boss ? 520 : 260, ease: 'Back.easeOut' })
          if (boss) this.floatText(e.x, e.y - size - 30, `⚠ ${e.n ?? 'CHEFE'}`, '#ff6b7a', 20, 1500)
        }
      }
      v.tx = e.x; v.ty = e.y; v.ent = e; v.seen = this.snapN
      if (e.k === 'c') v.sprite.setAlpha(e.hp ? 1 : 0.35)
      else if (e.k === 'p') {
        if (this.time.now >= v.flashUntil) this.baseTint(v)
        v.sprite.setAlpha(e.hp <= 0 ? 0.35 : 1)
        // Barreira: cúpula visível enquanto o escudo durar
        if (e.sh && !v.bubble) { const h = v.sprite.displayHeight; v.bubble = this.add.ellipse(0, -h / 2, h * 1.25, h * 1.3, COLOR.cyan, 0.14).setStrokeStyle(2, COLOR.cyan, 0.9); v.box.add(v.bubble); this.tweens.add({ targets: v.bubble, alpha: 0.55, duration: 600, yoyo: true, repeat: -1 }) }
        else if (!e.sh && v.bubble) { v.bubble.destroy(); v.bubble = undefined }
      }
      if (v.bar) {
        const w = e.mk === 'chefe' ? 90 : 46, y = -v.sprite.displayHeight - 4 - v.fly
        v.bar.clear().fillStyle(0x000000, 0.7).fillRect(-w / 2 - 1, y - 1, w + 2, 6)
          .fillStyle(e.k === 'm' ? 0xe5484d : e.k === 'e' ? 0x8b5cf6 : 0x5fd38a).fillRect(-w / 2, y, w * Math.max(0, e.hp / e.mhp), 4)
      }
    }
    for (const [id, v] of this.views) {
      if (v.seen === this.snapN) continue
      this.views.delete(id)
      if (dying.has(id) && v.ent.k !== 'c') this.dieAnim(v)
      else this.tweens.add({ targets: v.box, alpha: 0, duration: 220, onComplete: () => v.box.destroy() })
    }
    for (const f of fx) this.playFx(f, dying)
  }

  /** Morte: clarão, queda e dissolução em sombra. O corpo some; o resquício (se houver) fica no chão. */
  private dieAnim(v: View) {
    v.dying = true
    const boss = v.ent.mk === 'chefe', h = v.sprite.displayHeight
    v.sprite.setTintFill(0xffffff); v.bar?.destroy()
    this.time.delayedCall(70, () => { if (v.sprite.active) v.sprite.setTintFill(v.ent.k === 'p' ? 0x7a1f2a : 0x2a1f4a) })
    this.fx.death(v.box.x, v.box.y, h, boss)
    this.tweens.add({ targets: v.sprite, scaleY: v.sprite.scaleY * 0.15, scaleX: v.sprite.scaleX * 1.25, alpha: 0, delay: boss ? 180 : 60, duration: boss ? 620 : 300, ease: 'Quad.easeIn', onComplete: () => v.box.destroy() })
  }

  private floatText(x: number, y: number, text: string, color: string, size = 14, life = 750) {
    const t = this.add.text(x + (Math.random() - 0.5) * 16, y, text, { fontSize: `${size}px`, color, fontStyle: 'bold', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5).setDepth(9000).setScale(1.5)
    this.tweens.add({ targets: t, scale: 1, duration: 110, ease: 'Back.easeOut' })
    this.tweens.add({ targets: t, y: y - 38, alpha: 0, delay: life * 0.25, duration: life * 0.75, ease: 'Quad.easeIn', onComplete: () => t.destroy() })
  }
  private burst(key: string, x: number, y: number, size: number) {
    const img = this.add.image(x, y, key, 0).setDisplaySize(size, size).setDepth(8999)
    this.tweens.addCounter({ from: 0, to: 3.99, duration: 380, onUpdate: (tw) => img.setFrame(Math.floor(tw.getValue() ?? 0)), onComplete: () => img.destroy() })
  }
  /** Reação de quem apanha: clarão branco, empurrão, faíscas e o número do dano. */
  private hitReact(f: Extract<Fx, { f: 'hit' }>, b: View, ang: number, color: number, lethal: boolean) {
    const h = b.sprite.displayHeight, bx = b.box.x, by = b.box.y - h * 0.5 - b.fly
    const boss = b.ent.mk === 'chefe', mine = !!b.ent.me, big = !!f.crit || !!f.skill
    if (!lethal && b.sprite.active) {
      b.sprite.setTintFill(0xffffff); b.flashUntil = this.time.now + 60
      this.time.delayedCall(60, () => { if (b.sprite.active && !b.dying) this.baseTint(b) })
      if (!boss) this.nudge(b, Math.cos(ang) * (big ? 9 : 5), Math.sin(ang) * (big ? 6 : 3), 60)
    }
    this.fx.impact(bx, by, color, big ? 26 : 16, big ? 8 : 6)
    this.fx.sparks(bx, by, b.ent.k === 'p' ? COLOR.red : color, big ? 9 : 4, big ? 100 : 60)
    if (f.crit) this.fx.glow(bx, by, 110, COLOR.gold, 200, 0.7)
    if (mine) this.cameras.main.shake(90, big ? 0.006 : 0.0025, false)
    else if (f.crit && this.views.get(f.from)?.ent.me) this.cameras.main.shake(70, 0.003, false)
    // Dano zero é golpe todo absorvido pela Barreira: mostra isso em vez de um "0".
    if (f.dmg === 0) { this.floatText(bx, by - h * 0.35, 'absorvido', '#7df2ff', 12); return }
    const text = `${f.crit ? '✦' : ''}${f.dmg}${f.crit ? '!' : ''}`
    this.floatText(bx, by - h * 0.35, text, mine ? '#ff6b7a' : f.skill ? '#7df2ff' : f.crit ? '#ffcf5c' : '#ffffff', f.skill ? 20 : f.crit ? 19 : 13)
  }

  private playFx(f: Fx, dying: Set<number> = new Set()) {
    if (f.f === 'hit') {
      const a = this.views.get(f.from), b = this.views.get(f.to)
      if (!b) return
      const lethal = dying.has(f.to)
      const bh = b.sprite.displayHeight, bx = b.box.x, by = b.box.y - bh * 0.5 - b.fly
      if (!a) { this.hitReact(f, b, 0, COLOR.white, lethal); return }
      const ax = a.box.x, ay = a.box.y - a.sprite.displayHeight * 0.5 - a.fly
      const ang = Math.atan2(b.box.y - a.box.y, b.box.x - a.box.x), cx = Math.cos(ang), cy = Math.sin(ang)
      const boss = a.ent.mk === 'chefe', color = strikeColor(a.ent.k, a.ent.s, boss)
      // Parado, o atacante vira para o alvo (a linha da folha é a direção).
      a.row = Math.abs(cx) > Math.abs(cy) ? (cx < 0 ? 1 : 2) : cy < 0 ? 3 : 0
      if (f.proj) {
        // Disparo: recuo de quem atira, projétil com rastro e impacto só na chegada.
        this.nudge(a, -cx * 5, -cy * 3, 60)
        this.fx.glow(ax + cx * 14, ay + cy * 10, f.skill ? 90 : 50, color, 160, 0.8)
        const key = f.proj === 'arrow' ? 'efeitos/flecha' : 'efeitos/projetil-arcano'
        this.fx.projectile(key, ax + cx * 14, ay + cy * 10, bx, by, color, f.skill ? 54 : 36, () => {
          if (f.skill) { this.fx.glow(bx, by, 150, color, 280, 0.9); this.fx.ring(b.box.x, b.box.y, 40, color, 300, 2) }
          this.hitReact(f, b, ang, color, lethal)
        })
      } else {
        // Corpo a corpo: investida na direção do alvo e corte em meia-lua sobre ele.
        const reach = boss ? 22 : 14
        this.nudge(a, cx * reach, cy * reach * 0.7, boss ? 110 : 70)
        const size = (boss ? 58 : 34) * (f.skill ? 1.5 : f.crit ? 1.2 : 1)
        this.fx.slash(bx - cx * 8, by - cy * 6, ang, color, size, f.skill ? 1.25 : 1)
        if (f.skill) { this.fx.slash(bx - cx * 8, by - cy * 6, ang + Math.PI, color, size * 0.8); this.fx.glow(bx, by, 130, color, 240, 0.8) }
        if (boss) { this.fx.ring(b.box.x, b.box.y, 46, COLOR.red, 300, 2); this.cameras.main.shake(100, 0.004, false) }
        this.hitReact(f, b, ang, color, lethal)
      }
    } else if (f.f === 'skill') {
      const v = this.views.get(f.id)
      if (v) {
        this.floatText(v.box.x, v.box.y - v.sprite.displayHeight - 14, f.name, skillStyle(f.name)?.kind === 'buff' ? '#ffcf5c' : '#7df2ff', 14, 1000)
        this.fx.cast(v.box.x, v.box.y, v.sprite.displayHeight, f.name)
      }
      if (f.x !== undefined && f.y !== undefined && f.r) this.fx.area(f.x, f.y, f.r, f.name)
    } else if (f.f === 'heal') {
      const v = this.views.get(f.to); if (v) { this.fx.heal(v.box.x, v.box.y); this.floatText(v.box.x, v.box.y - 50, `+${f.amount}`, '#5fd38a') }
    } else if (f.f === 'level') {
      const v = this.views.get(f.id); if (v) { this.fx.levelUp(v.box.x, v.box.y); this.burst('efeitos/subir-nivel', v.box.x, v.box.y - 26, 96); this.floatText(v.box.x, v.box.y - 90, 'SUBIU DE NÍVEL', '#ffcf5c', 18, 1400) }
    } else if (f.f === 'die') {
      // Caçador que cai continua na sala (volta depois): só o aviso e as faíscas.
      const v = this.views.get(f.id)
      if (v && v.ent.k === 'p') { this.fx.sparks(v.box.x, v.box.y - 40, COLOR.red, 12, 90, 500); this.fx.ring(v.box.x, v.box.y, 44, COLOR.red, 420, 3); this.floatText(v.box.x, v.box.y - 80, 'CAIU', '#ff6b7a', 16, 1200) }
    } else if (f.f === 'extract') {
      this.fx.extract(f.x, f.y, f.ok); this.burst('efeitos/evocacao', f.x, f.y - 16, 84)
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
      // Quem voa bate asas o tempo todo e oscila no ar; quem anda só anima ao se mover.
      const hover = v.fly ? -v.fly + Math.sin(this.time.now / 260 + v.ent.id) * 4 : 0
      let bob = 0
      if (v.sheet) v.sprite.setFrame(v.row * 4 + (moving || v.fly ? frame : 0))
      else {
        // Imagem única: vira para o lado do movimento e balança ao andar.
        if (moving && Math.abs(dx) > 0.5) v.sprite.scaleX = dx < 0 ? -v.sx : v.sx
        bob = moving ? -Math.abs(Math.sin(this.time.now / 110 + v.ent.id)) * 4 : 0
      }
      v.sprite.setPosition(v.ox, v.oy + hover + bob)
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
