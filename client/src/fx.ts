// Efeitos visuais de combate e de ambiente. Tudo vem de sprites gerados (client/public/assets/fx, registrados em
// shared/fx.json). A cena decide QUANDO e ONDE tocar; este arquivo escolhe QUAL sprite e como ele se move.
import Phaser from 'phaser'
import FX from '../../shared/fx.json'
import { SKILLS } from '../../shared/content.ts'

export const COLOR = { red: 0xff5d6c, gold: 0xffcf5c }
const REG = FX as Record<string, { group: string; frame: number; frames: number }>
export const fxKey = (id: string) => `fx:${id}`
export const hasFx = (id: string) => !!REG[id]

/** Carrega todos os sprites de efeito (chamado no preload da cena). */
export function preloadFx(scene: Phaser.Scene) {
  for (const [id, r] of Object.entries(REG)) {
    if (r.frames > 1) scene.load.spritesheet(fxKey(id), `/assets/fx/${id}.png`, { frameWidth: r.frame, frameHeight: r.frame })
    else scene.load.image(fxKey(id), `/assets/fx/${id}.png`)
  }
}

/** Sprite de golpe de cada atacante. */
const CLASS_SLASH: Record<string, string> = { lamina: 'golpe-lamina', vulto: 'golpe-vulto', arcanista: 'golpe-lamina', atirador: 'golpe-lamina' }
export const slashFor = (kind: string, sprite: string, boss: boolean) =>
  kind === 'p' ? CLASS_SLASH[sprite] ?? 'golpe-lamina' : boss ? 'golpe-chefe' : 'garra'

/** Projétil de cada atacante: flecha, orbe, ou o da espécie do monstro. */
const SPECIES_SHOT: Record<string, string> = {
  'espinheiro-vivo': 'espinho', 'raiz-ancia': 'espinho', 'sacerdote-do-lodo': 'lodo', 'hierofante-do-lodo': 'lodo',
  'brasa-errante': 'bola-de-fogo', 'coracao-de-fornalha': 'bola-de-fogo',
}
export const shotFor = (proj: string, sprite: string) => proj === 'arrow' ? 'flecha' : SPECIES_SHOT[sprite] ?? 'orbe-arcano'

/** Sprite de cada habilidade (id da habilidade no jogo -> id do sprite). */
const SKILL_SPRITE: Record<string, string> = {
  'golpe-pesado': 'golpe-pesado', giro: 'giro-de-aco', postura: 'postura-de-ferro', perfurar: 'perfurar', leque: 'leque-de-laminas',
  passo: 'passo-sombrio', lanca: 'lanca-arcana', explosao: 'explosao-arcana', barreira: 'barreira', 'tiro-certeiro': 'tiro-certeiro',
  chuva: 'chuva-de-flechas', foco: 'foco',
}
const SKILL_STYLE = new Map<string, { id: string; kind: string; cls: string }>()
for (const [cls, list] of Object.entries(SKILLS)) for (const s of list) SKILL_STYLE.set(s.name, { id: s.id, kind: s.kind, cls })
export const skillStyle = (name: string) => SKILL_STYLE.get(name)
export const skillSprite = (name: string) => SKILL_SPRITE[SKILL_STYLE.get(name)?.id ?? ''] ?? ''

const TOP = 8990 // acima dos personagens, abaixo dos números de dano

export interface PlayOpts { size?: number; rotation?: number; flipX?: boolean; depth?: number; ms?: number; alpha?: number; originY?: number; loop?: boolean }

export class Effects {
  constructor(private scene: Phaser.Scene) {}

  /** Toca um sprite de efeito uma vez (ou em loop) e devolve o objeto. size = tamanho exibido em px. */
  play(id: string, x: number, y: number, o: PlayOpts = {}): Phaser.GameObjects.Image | null {
    const r = REG[id]
    if (!r) return null
    const img = this.scene.add.image(x, y, fxKey(id), r.frames > 1 ? 0 : undefined).setDepth(o.depth ?? TOP).setAlpha(o.alpha ?? 1)
    img.setOrigin(0.5, o.originY ?? 0.5).setRotation(o.rotation ?? 0).setFlipX(!!o.flipX)
    if (o.size) img.setScale(o.size / r.frame)
    const ms = o.ms ?? 70 * r.frames
    if (r.frames > 1) {
      const t = this.scene.tweens.addCounter({ from: 0, to: r.frames - 0.01, duration: ms, repeat: o.loop ? -1 : 0,
        onUpdate: (tw) => { if (img.active) img.setFrame(Math.floor(tw.getValue() ?? 0)) },
        onComplete: () => img.destroy() })
      img.once('destroy', () => t.remove())
    } else if (!o.loop) {
      this.scene.tweens.add({ targets: img, alpha: 0, scale: img.scale * 1.15, duration: ms, ease: 'Quad.easeIn', onComplete: () => img.destroy() })
    }
    return img
  }

  /** Projétil que viaja de (x0,y0) a (x1,y1), virado para o alvo, animando em loop. */
  projectile(id: string, x0: number, y0: number, x1: number, y1: number, size: number, done: () => void) {
    const d = Math.hypot(x1 - x0, y1 - y0), duration = Phaser.Math.Clamp(d / 1.1, 70, 240)
    const p = this.play(id, x0, y0, { size, rotation: Math.atan2(y1 - y0, x1 - x0), loop: true, ms: 300 })
    if (!p) { done(); return }
    this.scene.tweens.add({ targets: p, x: x1, y: y1, duration, onComplete: () => { p.destroy(); done() } })
  }

  shake(intensity = 0.004, duration = 120) { this.scene.cameras.main.shake(duration, intensity, false) }

  // ---------- Eventos ----------
  death(x: number, y: number, height: number, boss: boolean) {
    this.play(boss ? 'morte-chefe' : 'morte', x, y - height / 2, { size: boss ? height * 2.2 : height * 1.3, ms: boss ? 700 : 450 })
    if (boss) this.shake(0.012, 380)
  }
  spawn(x: number, y: number, boss: boolean) {
    this.play(boss ? 'surgimento-chefe' : 'surgimento', x, y, { size: boss ? 260 : 96, originY: boss ? 0.85 : 0.6, depth: y - 1, ms: boss ? 800 : 420 })
    if (boss) this.shake(0.008, 420)
  }
  levelUp(x: number, y: number) { this.play('subir-nivel', x, y, { size: 190, originY: 0.85, ms: 900 }) }
  heal(x: number, y: number) { this.play('cura', x, y - 30, { size: 84, ms: 520 }) }
  extract(x: number, y: number, ok: boolean) { this.play(ok ? 'evocacao' : 'morte', x, y, { size: ok ? 170 : 90, originY: 0.8, alpha: ok ? 1 : 0.6, ms: 800 }) }
  hit(x: number, y: number, crit: boolean, big: boolean) {
    this.play('impacto', x, y, { size: big ? 56 : 38, ms: 260 })
    if (crit) this.play('critico', x, y, { size: 92, ms: 360 })
  }

  /** Efeito do conjurador ao soltar uma habilidade de reforço (postura, passo, barreira, foco). */
  cast(x: number, y: number, height: number, name: string) {
    const st = skillStyle(name), id = skillSprite(name)
    if (st?.kind === 'buff' && id) this.play(id, x, y - height / 2, { size: height * 1.6, ms: 520 })
  }
  /** Habilidade de área, no ponto e raio que o servidor informou. */
  area(x: number, y: number, r: number, name: string) {
    const id = skillSprite(name)
    if (id) this.play(id, x, y - 16, { size: r * 2.3, ms: 520 })
    if (skillStyle(name)?.id === 'explosao') this.shake(0.006, 200)
  }

  // ---------- Ambiente ----------
  /** Partículas de ambiente de cada mapa, com sprites próprios. */
  ambient(map: string, w: number, h: number): Phaser.GameObjects.GameObject[] {
    const zone = { type: 'random', source: new Phaser.Geom.Rectangle(0, 0, w, h) } as Phaser.Types.GameObjects.Particles.EmitZoneData
    const mk = (id: string, cfg: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig) =>
      hasFx(id) ? [this.scene.add.particles(0, 0, fxKey(id), { emitZone: zone, ...cfg }).setDepth(8000)] : []
    switch (map) {
      case 'cidade': return mk('faisca', { alpha: { start: 0.8, end: 0 }, scale: { min: 0.5, max: 1 }, speedY: { min: -22, max: -8 }, speedX: { min: -6, max: 6 }, lifespan: 4200, frequency: 140 })
      case 'minas-ocas': return mk('poeira', { alpha: { start: 0.6, end: 0 }, scale: { min: 0.6, max: 1.2 }, speedY: { min: -4, max: 10 }, speedX: { min: -10, max: 10 }, lifespan: 5200, frequency: 140 })
      case 'bosque-cinzento': return [
        ...mk('nevoa', { alpha: { start: 0, end: 0.18, ease: 'Sine.easeInOut' }, scale: { min: 3, max: 6 }, speedX: { min: 8, max: 22 }, lifespan: 9000, frequency: 520 }),
        ...mk('vagalume', { alpha: { start: 1, end: 0 }, scale: { min: 0.6, max: 1 }, speedX: { min: -12, max: 12 }, speedY: { min: -12, max: 12 }, lifespan: 3600, frequency: 260 }),
      ]
      case 'cidadela-afundada': return mk('bolha', { alpha: { start: 0.9, end: 0 }, scale: { min: 0.5, max: 1 }, speedY: { min: -30, max: -12 }, speedX: { min: -4, max: 4 }, lifespan: 3800, frequency: 120 })
      case 'forja-extinta': return mk('brasa', { alpha: { start: 1, end: 0 }, scale: { min: 0.6, max: 1.1 }, speedY: { min: -70, max: -26 }, speedX: { min: -16, max: 16 }, lifespan: 3000, frequency: 70 })
      case 'arena': return mk('faisca', { alpha: { start: 0.7, end: 0 }, scale: { min: 0.4, max: 0.9 }, speedY: { min: -18, max: -6 }, lifespan: 3600, frequency: 220 })
      default: return []
    }
  }

  /** Fenda da cidade: sprite animado em loop, com faíscas sendo puxadas para dentro. */
  portal(x: number, y: number): Phaser.GameObjects.GameObject[] {
    const out: Phaser.GameObjects.GameObject[] = []
    const p = this.play('portal', x, y, { size: 150, originY: 0.92, depth: y, loop: true, ms: 900 })
    if (p) out.push(p)
    if (hasFx('faisca')) out.push(this.scene.add.particles(x, y - 70, fxKey('faisca'), {
      emitZone: { type: 'edge', source: new Phaser.Geom.Ellipse(0, 0, 150, 190), quantity: 24 } as Phaser.Types.GameObjects.Particles.EmitZoneData,
      moveToX: 0, moveToY: 0, lifespan: 900, frequency: 90, alpha: { start: 0, end: 1 }, scale: { start: 1, end: 0.4 },
    }).setDepth(y + 1))
    return out
  }
}
