// Efeitos visuais de combate e de ambiente. Tudo desenhado por código: não depende de arte nova.
// A cena decide QUANDO tocar; este arquivo só sabe COMO cada efeito aparece.
import Phaser from 'phaser'
import { SKILLS } from '../../shared/content.ts'

export const COLOR = {
  white: 0xffffff, gold: 0xffcf5c, red: 0xff5d6c, violet: 0x8b5cf6, lilac: 0xc4a3ff, cyan: 0x7df2ff,
  green: 0x5fd38a, steel: 0xb9c4e0, ember: 0xff8a3c, shadow: 0x2a1f4a,
}
/** Cor do golpe de cada classe; monstros e ecos têm cor própria. */
const CLASS_COLOR: Record<string, number> = { lamina: COLOR.lilac, vulto: COLOR.cyan, arcanista: COLOR.violet, atirador: COLOR.gold }
export const strikeColor = (kind: string, sprite: string, boss: boolean) =>
  kind === 'p' ? CLASS_COLOR[sprite] ?? COLOR.white : kind === 'e' ? COLOR.violet : boss ? COLOR.red : 0xffb38a

/** Estilo de cada habilidade, achado pelo nome que o servidor manda. */
const SKILL_STYLE = new Map<string, { id: string; kind: string; cls: string }>()
for (const [cls, list] of Object.entries(SKILLS)) for (const s of list) SKILL_STYLE.set(s.name, { id: s.id, kind: s.kind, cls })
export const skillStyle = (name: string) => SKILL_STYLE.get(name)

const TOP = 8990 // acima dos personagens, abaixo dos números de dano

export class Effects {
  constructor(private scene: Phaser.Scene) {
    // Texturas mínimas: um ponto nítido (faísca em pixel art) e um brilho suave (luz).
    if (!scene.textures.exists('fx/dot')) {
      const d = scene.textures.createCanvas('fx/dot', 4, 4)!; d.getContext().fillStyle = '#fff'; d.getContext().fillRect(0, 0, 4, 4); d.refresh()
      const s = scene.textures.createCanvas('fx/soft', 64, 64)!, c = s.getContext(), g = c.createRadialGradient(32, 32, 0, 32, 32, 32)
      g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,.45)'); g.addColorStop(1, 'rgba(255,255,255,0)')
      c.fillStyle = g; c.fillRect(0, 0, 64, 64); s.refresh()
    }
  }

  private get tw() { return this.scene.tweens }

  /** Faíscas quadradas que saltam de um ponto e caem. */
  sparks(x: number, y: number, color: number, n = 6, speed = 70, life = 320, up = 0) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = speed * (0.4 + Math.random() * 0.8), s = Math.random() < 0.4 ? 4 : 3
      const p = this.scene.add.rectangle(x, y, s, s, color).setDepth(TOP)
      this.tw.add({ targets: p, x: x + Math.cos(a) * v, y: y + Math.sin(a) * v * 0.7 - up, alpha: 0, duration: life * (0.7 + Math.random() * 0.6), ease: 'Quad.easeOut', onComplete: () => p.destroy() })
    }
  }

  /** Anel que se abre no chão (achatado, para parecer deitado no piso). */
  ring(x: number, y: number, r: number, color: number, duration = 380, width = 3, flat = 0.55) {
    const g = this.scene.add.ellipse(x, y, r * 2, r * 2 * flat).setStrokeStyle(width, color, 1).setDepth(y - 1).setScale(0.15)
    g.isFilled = false
    this.tw.add({ targets: g, scale: 1, alpha: 0, duration, ease: 'Cubic.easeOut', onComplete: () => g.destroy() })
  }

  /** Clarão suave (luz). */
  glow(x: number, y: number, size: number, color: number, duration = 260, alpha = 0.8) {
    const g = this.scene.add.image(x, y, 'fx/soft').setTint(color).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(size * 0.4, size * 0.4).setAlpha(alpha).setDepth(TOP - 1)
    this.tw.add({ targets: g, displayWidth: size, displayHeight: size, alpha: 0, duration, ease: 'Quad.easeOut', onComplete: () => g.destroy() })
  }

  /** Corte em meia-lua na direção do golpe. */
  slash(x: number, y: number, angle: number, color: number, size = 34, sweep = 1) {
    const g = this.scene.add.graphics({ x, y }).setDepth(TOP).setRotation(angle)
    const a0 = -1.15 * sweep, a1 = 1.15 * sweep
    // três arcos sobrepostos: borda colorida grossa, miolo branco fino
    g.lineStyle(7, color, 0.55).beginPath().arc(0, 0, size, a0, a1).strokePath()
    g.lineStyle(4, color, 1).beginPath().arc(0, 0, size, a0 * 0.85, a1 * 0.85).strokePath()
    g.lineStyle(2, 0xffffff, 1).beginPath().arc(0, 0, size, a0 * 0.6, a1 * 0.6).strokePath()
    g.setScale(0.55)
    this.tw.add({ targets: g, scale: 1.15, alpha: 0, duration: 190, ease: 'Cubic.easeOut', onComplete: () => g.destroy() })
  }

  /** Estrela de impacto: riscos curtos saindo do ponto atingido. */
  impact(x: number, y: number, color: number, size = 16, rays = 6) {
    const g = this.scene.add.graphics({ x, y }).setDepth(TOP)
    const off = Math.random() * Math.PI
    for (let i = 0; i < rays; i++) {
      const a = off + (i / rays) * Math.PI * 2, r0 = size * 0.35, r1 = size * (0.8 + Math.random() * 0.4)
      g.lineStyle(i % 2 ? 2 : 3, i % 2 ? 0xffffff : color, 1).lineBetween(Math.cos(a) * r0, Math.sin(a) * r0, Math.cos(a) * r1, Math.sin(a) * r1)
    }
    g.setScale(0.5)
    this.tw.add({ targets: g, scale: 1.3, alpha: 0, duration: 170, onComplete: () => g.destroy() })
  }

  /** Coluna de luz que sobe do chão (subir de nível, evocação, bênçãos). */
  pillar(x: number, y: number, color: number, height = 150, width = 34, duration = 700) {
    const p = this.scene.add.rectangle(x, y, width, height, color, 0.5).setOrigin(0.5, 1).setBlendMode(Phaser.BlendModes.ADD).setDepth(TOP - 2).setScale(0.2, 0)
    const core = this.scene.add.rectangle(x, y, width * 0.35, height, 0xffffff, 0.7).setOrigin(0.5, 1).setBlendMode(Phaser.BlendModes.ADD).setDepth(TOP - 1).setScale(0.2, 0)
    this.tw.add({ targets: [p, core], scaleX: 1, scaleY: 1, duration: duration * 0.3, ease: 'Cubic.easeOut' })
    this.tw.add({ targets: [p, core], scaleX: 0, alpha: 0, delay: duration * 0.45, duration: duration * 0.55, onComplete: () => { p.destroy(); core.destroy() } })
  }

  /** Partículas que sobem devagar a partir de uma área (aura, cura, fumaça de sombra). */
  rise(x: number, y: number, color: number, n = 8, spread = 22, height = 50, life = 700) {
    for (let i = 0; i < n; i++) {
      const px = x + (Math.random() - 0.5) * spread * 2, py = y - Math.random() * 14, s = Math.random() < 0.5 ? 4 : 3
      const p = this.scene.add.rectangle(px, py, s, s, color).setDepth(TOP).setAlpha(0)
      this.tw.add({ targets: p, y: py - height * (0.6 + Math.random() * 0.6), alpha: { from: 1, to: 0 }, delay: Math.random() * life * 0.4, duration: life, ease: 'Sine.easeOut', onComplete: () => p.destroy() })
    }
  }

  /** Projétil com rastro. Chama `done` ao chegar. */
  projectile(key: string, x0: number, y0: number, x1: number, y1: number, color: number, size: number, done: () => void) {
    const d = Math.hypot(x1 - x0, y1 - y0), duration = Phaser.Math.Clamp(d / 1.1, 70, 240)
    const p = this.scene.add.image(x0, y0, key).setDisplaySize(size, size).setDepth(TOP).setRotation(Math.atan2(y1 - y0, x1 - x0))
    const trail = this.scene.time.addEvent({ delay: 16, loop: true, callback: () => {
      const t = this.scene.add.rectangle(p.x, p.y, 4, 4, color).setDepth(TOP - 1)
      this.tw.add({ targets: t, alpha: 0, scale: 0.3, duration: 180, onComplete: () => t.destroy() })
    } })
    this.tw.add({ targets: p, x: x1, y: y1, duration, onComplete: () => { trail.remove(); p.destroy(); done() } })
  }

  shake(intensity = 0.004, duration = 120) { this.scene.cameras.main.shake(duration, intensity, false) }

  // ---------- Efeitos compostos ----------

  /** Morte de monstro: dissolve em fumaça de sombra. Chefes explodem. */
  death(x: number, y: number, height: number, boss: boolean) {
    const cy = y - height / 2
    this.rise(x, y, COLOR.shadow, boss ? 26 : 9, height * 0.35, height * 0.9, boss ? 1000 : 600)
    this.rise(x, y, COLOR.violet, boss ? 16 : 5, height * 0.3, height * 0.7, boss ? 900 : 520)
    this.ring(x, y, boss ? 120 : 34, boss ? COLOR.red : COLOR.lilac, boss ? 620 : 320, boss ? 4 : 2)
    if (boss) {
      this.glow(x, cy, 340, COLOR.white, 420, 0.95); this.glow(x, cy, 260, COLOR.violet, 700)
      this.sparks(x, cy, COLOR.gold, 26, 190, 700); this.sparks(x, cy, COLOR.white, 14, 120, 500)
      this.scene.time.delayedCall(140, () => this.ring(x, y, 190, COLOR.gold, 700, 3))
      this.shake(0.012, 380)
    } else this.sparks(x, cy, COLOR.lilac, 5, 60, 300)
  }

  /** Surgimento: abre um rasgo escuro no chão. Chefes chegam com aviso. */
  spawn(x: number, y: number, boss: boolean) {
    this.ring(x, y, boss ? 110 : 30, boss ? COLOR.red : COLOR.violet, boss ? 700 : 360, boss ? 4 : 2)
    this.rise(x, y, COLOR.shadow, boss ? 20 : 6, boss ? 50 : 16, boss ? 110 : 40, boss ? 900 : 480)
    if (boss) { this.pillar(x, y, COLOR.red, 260, 70, 900); this.glow(x, y - 40, 300, COLOR.red, 600); this.shake(0.008, 420) }
  }

  levelUp(x: number, y: number) {
    this.pillar(x, y, COLOR.gold, 190, 44, 900)
    this.ring(x, y, 60, COLOR.gold, 600, 3); this.scene.time.delayedCall(160, () => this.ring(x, y, 90, COLOR.white, 600, 2))
    this.rise(x, y, COLOR.gold, 18, 30, 110, 900); this.glow(x, y - 40, 220, COLOR.gold, 600)
  }

  heal(x: number, y: number) { this.rise(x, y, COLOR.green, 7, 16, 46, 620); this.glow(x, y - 30, 90, COLOR.green, 360, 0.5) }

  /** Evocação de eco: a sombra sobe do resquício. */
  extract(x: number, y: number, ok: boolean) {
    this.ring(x, y, 46, COLOR.violet, 520, 3)
    this.rise(x, y, ok ? COLOR.violet : 0x6a6480, ok ? 18 : 6, 20, ok ? 100 : 40, ok ? 900 : 500)
    if (ok) { this.pillar(x, y, COLOR.violet, 170, 40, 800); this.glow(x, y - 30, 200, COLOR.violet, 560); this.rise(x, y, COLOR.shadow, 12, 24, 90, 900) }
  }

  /** Efeito do conjurador ao soltar uma habilidade. */
  cast(x: number, y: number, height: number, name: string) {
    const st = skillStyle(name), color = CLASS_COLOR[st?.cls ?? ''] ?? COLOR.cyan
    this.ring(x, y, 34, color, 300, 2)
    if (st?.kind !== 'buff') return
    if (st.id === 'postura') { // Postura de Ferro: placas de aço se fecham em volta
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2, r = 46
        const pl = this.scene.add.rectangle(x + Math.cos(a) * r, y - height / 2 + Math.sin(a) * r * 0.6, 8, 20, COLOR.steel).setStrokeStyle(1, 0xffffff).setDepth(TOP)
        this.tw.add({ targets: pl, x: x + Math.cos(a) * 16, y: y - height / 2 + Math.sin(a) * 10, alpha: { from: 1, to: 0 }, duration: 420, ease: 'Back.easeIn', onComplete: () => pl.destroy() })
      }
      this.glow(x, y - height / 2, 150, COLOR.steel, 460, 0.6)
    } else if (st.id === 'passo') { // Passo Sombrio: riscos de velocidade e fumaça escura
      for (let i = 0; i < 7; i++) {
        const yy = y - Math.random() * height, w = 26 + Math.random() * 30
        const l = this.scene.add.rectangle(x - 40, yy, w, 2, i % 2 ? COLOR.cyan : COLOR.shadow).setDepth(TOP)
        this.tw.add({ targets: l, x: x + 46, alpha: 0, delay: i * 25, duration: 240, onComplete: () => l.destroy() })
      }
      this.rise(x, y, COLOR.shadow, 10, 20, 60, 520)
    } else if (st.id === 'barreira') { // Barreira: cúpula que se fecha
      const b = this.scene.add.ellipse(x, y - height / 2, height * 1.5, height * 1.5, COLOR.cyan, 0.18).setStrokeStyle(3, COLOR.cyan, 1).setDepth(TOP).setScale(1.8).setAlpha(0)
      this.tw.add({ targets: b, scale: 1, alpha: 1, duration: 240, ease: 'Back.easeOut', yoyo: true, hold: 120, onComplete: () => b.destroy() })
      this.sparks(x, y - height / 2, COLOR.cyan, 10, 80, 420)
    } else if (st.id === 'foco') { // Foco: mira que converge sobre o caçador
      const g = this.scene.add.graphics({ x, y: y - height / 2 }).setDepth(TOP)
      g.lineStyle(2, COLOR.gold, 1).strokeCircle(0, 0, 26).lineBetween(-38, 0, -14, 0).lineBetween(14, 0, 38, 0).lineBetween(0, -38, 0, -14).lineBetween(0, 14, 0, 38)
      g.setScale(2.4).setAlpha(0)
      this.tw.add({ targets: g, scale: 0.7, alpha: 1, angle: 90, duration: 300, ease: 'Cubic.easeOut', onComplete: () => this.tw.add({ targets: g, alpha: 0, duration: 160, onComplete: () => g.destroy() }) })
    }
  }

  /** Efeito de área de uma habilidade, no ponto e raio que o servidor informou. */
  area(x: number, y: number, r: number, name: string) {
    const st = skillStyle(name), color = CLASS_COLOR[st?.cls ?? ''] ?? COLOR.lilac
    this.ring(x, y, r, color, 420, 3)
    if (st?.id === 'giro') { // Giro de Aço: lâmina em volta completa
      const g = this.scene.add.graphics({ x, y: y - 24 }).setDepth(TOP)
      g.lineStyle(8, color, 0.5).beginPath().arc(0, 0, r * 0.8, 0, Math.PI * 1.5).strokePath()
      g.lineStyle(3, 0xffffff, 1).beginPath().arc(0, 0, r * 0.8, 0.3, Math.PI * 1.3).strokePath()
      g.setScale(0.4, 0.24)
      this.tw.add({ targets: g, scaleX: 1, scaleY: 0.6, angle: 300, alpha: 0, duration: 380, ease: 'Cubic.easeOut', onComplete: () => g.destroy() })
      this.sparks(x, y - 24, COLOR.steel, 10, r, 360)
    } else if (st?.id === 'leque') { // Leque de Lâminas: adagas disparadas para todos os lados
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2
        const b = this.scene.add.rectangle(x, y - 24, 14, 3, 0xffffff).setStrokeStyle(1, color).setRotation(a).setDepth(TOP)
        this.tw.add({ targets: b, x: x + Math.cos(a) * r, y: y - 24 + Math.sin(a) * r * 0.6, alpha: { from: 1, to: 0.2 }, duration: 240, ease: 'Quad.easeOut', onComplete: () => b.destroy() })
      }
    } else if (st?.id === 'explosao') { // Explosão Arcana: esfera que estoura
      this.glow(x, y - 20, r * 2.6, COLOR.violet, 460, 1); this.glow(x, y - 20, r * 1.3, COLOR.white, 240, 0.9)
      this.sparks(x, y - 20, COLOR.lilac, 22, r * 1.2, 520); this.sparks(x, y - 20, COLOR.cyan, 8, r * 0.8, 420)
      this.scene.time.delayedCall(90, () => this.ring(x, y, r * 1.25, COLOR.lilac, 420, 2))
      this.shake(0.006, 200)
    } else if (st?.id === 'chuva') { // Chuva de Flechas: flechas caem do alto dentro do raio
      for (let i = 0; i < 12; i++) {
        const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * r, tx = x + Math.cos(a) * d, ty = y + Math.sin(a) * d * 0.6
        const ar = this.scene.add.rectangle(tx + 50, ty - 170, 18, 3, COLOR.gold).setRotation(Math.atan2(170, -50)).setDepth(TOP).setAlpha(0)
        this.tw.add({ targets: ar, x: tx, y: ty, alpha: 1, delay: i * 28, duration: 150, onComplete: () => { ar.destroy(); this.sparks(tx, ty, COLOR.gold, 3, 34, 220); this.ring(tx, ty, 12, COLOR.gold, 200, 2) } })
      }
    } else this.sparks(x, y - 20, color, 12, r, 400)
  }

  // ---------- Ambiente ----------

  /** Partículas de ambiente de cada mapa: dão vida ao cenário sem pesar no jogo. */
  ambient(map: string, w: number, h: number): Phaser.GameObjects.GameObject[] {
    const zone = { type: 'random', source: new Phaser.Geom.Rectangle(0, 0, w, h) } as Phaser.Types.GameObjects.Particles.EmitZoneData
    const mk = (tex: string, cfg: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig) =>
      this.scene.add.particles(0, 0, tex, { emitZone: zone, ...cfg }).setDepth(8000)
    const ADD = Phaser.BlendModes.ADD
    switch (map) {
      case 'cidade': return [mk('fx/dot', { tint: [COLOR.violet, COLOR.lilac, COLOR.cyan], alpha: { start: 0.7, end: 0 }, scale: { min: 0.5, max: 1 }, speedY: { min: -22, max: -8 }, speedX: { min: -6, max: 6 }, lifespan: 4200, frequency: 110, blendMode: ADD })]
      case 'minas-ocas': return [mk('fx/dot', { tint: [0xffd9a0, 0xc9a070], alpha: { start: 0.45, end: 0 }, scale: { min: 0.4, max: 0.8 }, speedY: { min: -4, max: 10 }, speedX: { min: -10, max: 10 }, lifespan: 5200, frequency: 140 })]
      case 'bosque-cinzento': return [
        mk('fx/soft', { tint: 0xcfe0e6, alpha: { start: 0, end: 0.1, ease: 'Sine.easeInOut' }, scale: { min: 5, max: 9 }, speedX: { min: 8, max: 22 }, lifespan: 9000, frequency: 520 }),
        mk('fx/dot', { tint: [COLOR.cyan, 0xd8ffe0], alpha: { start: 0.9, end: 0 }, scale: { min: 0.5, max: 0.9 }, speedX: { min: -12, max: 12 }, speedY: { min: -12, max: 12 }, lifespan: 3600, frequency: 260, blendMode: ADD }),
      ]
      case 'cidadela-afundada': return [mk('fx/dot', { tint: [COLOR.cyan, 0xbff6ff], alpha: { start: 0.8, end: 0 }, scale: { min: 0.4, max: 1 }, speedY: { min: -30, max: -12 }, speedX: { min: -4, max: 4 }, lifespan: 3800, frequency: 120, blendMode: ADD })]
      case 'forja-extinta': return [mk('fx/dot', { tint: [COLOR.ember, 0xffd27a, 0xff5a2a], alpha: { start: 1, end: 0 }, scale: { min: 0.5, max: 1.1 }, speedY: { min: -70, max: -26 }, speedX: { min: -16, max: 16 }, lifespan: 3000, frequency: 70, blendMode: ADD })]
      case 'arena': return [mk('fx/dot', { tint: [0x8fa8ff, COLOR.lilac], alpha: { start: 0.7, end: 0 }, scale: { min: 0.4, max: 0.9 }, speedY: { min: -18, max: -6 }, lifespan: 3600, frequency: 200, blendMode: ADD })]
      default: return []
    }
  }

  /** Fenda da cidade: portal vivo, com anéis girando e partículas sendo puxadas para dentro. */
  portal(x: number, y: number): Phaser.GameObjects.GameObject[] {
    const cy = y - 46, out: Phaser.GameObjects.GameObject[] = []
    const halo = this.scene.add.image(x, cy, 'fx/soft').setTint(COLOR.violet).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(190, 220).setAlpha(0.7).setDepth(y - 3)
    this.tw.add({ targets: halo, alpha: 0.4, displayWidth: 210, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
    const floor = this.scene.add.ellipse(x, y, 84, 26, COLOR.violet, 0.28).setStrokeStyle(2, COLOR.lilac, 0.8).setDepth(y - 4)
    const core = this.scene.add.ellipse(x, cy, 46, 84, 0x05030c, 1).setStrokeStyle(3, COLOR.cyan, 1).setDepth(y - 1)
    this.tw.add({ targets: core, scaleX: 1.1, scaleY: 0.96, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
    out.push(halo, floor, core)
    for (let i = 0; i < 3; i++) { // arcos que giram em volta do núcleo, em velocidades diferentes
      const g = this.scene.add.graphics({ x, y: cy }).setDepth(y - 2)
      const rw = 34 + i * 9, rh = 52 + i * 12
      g.lineStyle(3 - (i > 1 ? 1 : 0), [COLOR.lilac, COLOR.violet, COLOR.cyan][i], 0.95)
      for (const a0 of [0.2, 3.3]) { g.beginPath(); for (let t = 0; t <= 12; t++) { const a = a0 + (t / 12) * 1.9, px = Math.cos(a) * rw, py = Math.sin(a) * rh; if (t) g.lineTo(px, py); else g.moveTo(px, py) } g.strokePath() }
      this.tw.add({ targets: g, angle: i % 2 ? -360 : 360, duration: 5200 - i * 1100, repeat: -1 })
      out.push(g)
    }
    // partículas puxadas para o centro
    out.push(this.scene.add.particles(x, cy, 'fx/dot', {
      emitZone: { type: 'edge', source: new Phaser.Geom.Ellipse(0, 0, 150, 190), quantity: 24 } as Phaser.Types.GameObjects.Particles.EmitZoneData,
      moveToX: 0, moveToY: 0, lifespan: 900, frequency: 70, tint: [COLOR.lilac, COLOR.cyan, COLOR.violet], alpha: { start: 0, end: 1 }, scale: { start: 1, end: 0.3 }, blendMode: Phaser.BlendModes.ADD,
    }).setDepth(y))
    return out
  }
}
