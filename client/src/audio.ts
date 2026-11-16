// Sons e música (todos CC0; fontes em docs/CREDITOS.md). Efeitos curtos carregam com o jogo;
// cada música só baixa quando o jogador entra no mapa dela.
import Phaser from 'phaser'

const SFX = ['golpe1', 'golpe2', 'golpe3', 'dano1', 'dano2', 'morte', 'rugido', 'magia', 'evocacao', 'fogo', 'moedas', 'cura', 'nivel', 'clique', 'metal', 'lodo'] as const
export type Sfx = (typeof SFX)[number]
const MUSIC: Record<string, string> = {
  cidade: 'cidade', 'minas-ocas': 'cavernas', 'bosque-cinzento': 'nevoa', 'cidadela-afundada': 'ruinas', 'forja-extinta': 'forja', arena: 'arena',
}

const store = {
  get: (k: string) => { try { return localStorage.getItem(k) } catch { return null } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* sem armazenamento: vale só nesta sessão */ } },
}

export class Audio {
  private music?: Phaser.Sound.BaseSound
  private musicKey = ''
  private last = new Map<string, number>()
  muted = store.get('som') === 'off'
  constructor(private scene: Phaser.Scene) {}

  preload() { for (const s of SFX) this.scene.load.audio(`sfx:${s}`, `/audio/sfx/${s}.mp3`) }
  apply() { this.scene.sound.mute = this.muted }

  toggle() { this.muted = !this.muted; store.set('som', this.muted ? 'off' : 'on'); this.apply(); return this.muted }

  /** Efeito curto. Repetições do mesmo som num intervalo curto são ignoradas (dez golpes juntos não viram barulho). */
  play(id: Sfx, volume = 0.5, gap = 70) {
    const now = this.scene.time.now
    if (now - (this.last.get(id) ?? -1e9) < gap || !this.scene.cache.audio.exists(`sfx:${id}`)) return
    this.last.set(id, now)
    this.scene.sound.play(`sfx:${id}`, { volume, detune: (Math.random() - 0.5) * 200 })
  }

  /** Troca a música ao mudar de mapa (baixa na primeira vez). */
  room(map: string) {
    const track = MUSIC[map]
    if (!track || track === this.musicKey) return
    this.musicKey = track
    const key = `music:${track}`
    const start = () => {
      if (this.musicKey !== track) return
      this.music?.stop(); this.music?.destroy()
      this.music = this.scene.sound.add(key, { loop: true, volume: 0.32 })
      this.music.play()
    }
    if (this.scene.cache.audio.exists(key)) return start()
    this.scene.load.audio(key, `/audio/musica/${track}.mp3`)
    this.scene.load.once(`filecomplete-audio-${key}`, start)
    this.scene.load.start()
  }
}
