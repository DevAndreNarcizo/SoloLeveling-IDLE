// Vida no cenário: objetos animados parados e figurantes (moradores e animais) que passeiam.
// Tudo é só visual, desenhado no cliente: não passa pelo servidor nem afeta o jogo.
import Phaser from 'phaser'
import FX from '../../shared/fx.json'
import { RIFTS } from '../../shared/content.ts'
import { fxKey, hasFx } from './fx.ts'

const REG = FX as Record<string, { group: string; frame: number; frames: number }>

/** Objetos fixos de cada mapa: [sprite, x, y]. y é a base (onde o objeto toca o chão). */
const OBJECTS: Record<string, [string, number, number][]> = {
  cidade: [
    ['estandarte', 820, 330], ['estandarte', 1100, 330], ['quadro-de-avisos', 1140, 1020], ['bau', 520, 985],
    ['fogueira', 700, 860], ['caldeirao', 1400, 690], ['cristal-de-fenda', 560, 690],
  ],
  'minas-ocas': [['tocha', 420, 300], ['tocha', 960, 290], ['tocha', 1500, 300], ['cristal-de-fenda', 330, 980], ['bau', 1590, 1000]],
  'bosque-cinzento': [['fogueira', 520, 420], ['lampiao', 1400, 330], ['bau', 1500, 980]],
  'cidadela-afundada': [['cristal-de-fenda', 520, 420], ['cristal-de-fenda', 1400, 900], ['estandarte', 960, 360]],
  'forja-extinta': [['caldeirao', 600, 380], ['tocha', 1300, 330], ['tocha', 620, 960], ['fogueira', 1320, 930]],
  arena: [['estandarte', 520, 360], ['estandarte', 1400, 360], ['tocha', 470, 940], ['tocha', 1450, 940]],
}

/** Figurantes de cada mapa: [sprite, quantos, velocidade em px/s]. */
const WALKERS: Record<string, [string, number, number][]> = {
  cidade: [
    ['guarda', 2, 32], ['aldea', 1, 30], ['crianca', 1, 58], ['velho', 1, 18], ['carregador', 1, 28], ['monge', 1, 24],
    ['gato', 2, 46], ['cao', 1, 40], ['corvo', 2, 22], ['pombo', 3, 18],
  ],
  'minas-ocas': [['rato', 3, 50]],
  'bosque-cinzento': [['coelho', 3, 44], ['corvo', 2, 22]],
  'cidadela-afundada': [['caranguejo', 4, 26]],
  'forja-extinta': [['salamandra', 3, 34]],
}

/** Objetos que emitem luz própria: não escurecem com a luz do mapa. */
const GLOWS = new Set(['tocha', 'fogueira', 'cristal-de-fenda', 'lampiao', 'caldeirao'])

interface Walker { img: Phaser.GameObjects.Image; speed: number; tx: number; ty: number; wait: number; frames: number }

export class Decor {
  private walkers: Walker[] = []
  private area = new Phaser.Geom.Rectangle(0, 0, 0, 0)
  constructor(private scene: Phaser.Scene) {}

  /** Monta o cenário da sala. Devolve os objetos criados para a cena destruir ao trocar de sala. */
  build(map: string, kind: string, w: number, h: number, light = 0xffffff): Phaser.GameObjects.GameObject[] {
    this.walkers = []
    const out: Phaser.GameObjects.GameObject[] = []
    // Área por onde os figurantes andam: a mesma área livre dos caçadores.
    const wall = kind === 'city' ? [300, 300, 245] : RIFTS.find((r) => r.id === map)?.wall ?? [200, 180, 160]
    this.area.setTo(wall[0] + 20, wall[1] + 20, w - 2 * wall[0] - 40, h - wall[1] - wall[2] - 40)
    for (const [id, x, y] of OBJECTS[map] ?? []) {
      if (!hasFx(id)) continue
      const r = REG[id], img = this.scene.add.sprite(x, y, fxKey(id), 0).setOrigin(0.5, 1).setDepth(y)
      if (!GLOWS.has(id)) img.setTint(light)
      if (r.frames > 1) img.play({ key: this.anim(id, 8), startFrame: Math.floor(Math.random() * r.frames) })
      out.push(img)
    }
    // Nas caçadas e duelos só os bichos aparecem; na cidade, todos.
    for (const [id, n, speed] of WALKERS[map] ?? []) {
      if (!hasFx(id)) continue
      for (let i = 0; i < n; i++) {
        const p = this.area.getRandomPoint()
        const img = this.scene.add.image(p.x, p.y, fxKey(id), 0).setOrigin(0.5, 1).setDepth(p.y)
        img.setTint(light)
        this.walkers.push({ img, speed, tx: p.x, ty: p.y, wait: Math.random() * 3, frames: REG[id].frames })
        out.push(img)
      }
    }
    return out
  }

  private anim(id: string, fps: number) {
    const key = `anim:${id}`
    if (!this.scene.anims.exists(key)) this.scene.anims.create({ key, frames: this.scene.anims.generateFrameNumbers(fxKey(id), {}), frameRate: fps, repeat: -1 })
    return key
  }

  /** Passeio: anda até um ponto sorteado, para um pouco e sorteia outro. */
  update(dt: number, now: number) {
    for (const w of this.walkers) {
      if (!w.img.active) continue
      if (w.wait > 0) { w.wait -= dt; w.img.setFrame(0); continue }
      const dx = w.tx - w.img.x, dy = w.ty - w.img.y, d = Math.hypot(dx, dy)
      if (d < 3) {
        w.wait = 1 + Math.random() * 4
        const p = this.area.getRandomPoint(); w.tx = p.x; w.ty = p.y
        continue
      }
      const step = Math.min(d, w.speed * dt)
      w.img.x += (dx / d) * step; w.img.y += (dy / d) * step
      if (Math.abs(dx) > 2) w.img.setFlipX(dx < 0) // as folhas olham para a direita
      w.img.setDepth(w.img.y).setFrame(Math.floor(now / Math.min(220, 3600 / w.speed)) % w.frames)
    }
  }
}
