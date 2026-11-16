// Tutorial do caçador novo: um cartão com o próximo passo e uma seta sobre o NPC certo.
// Cada passo termina sozinho quando o jogador faz o que foi pedido; o progresso fica salvo no servidor.
import type { ServerMsg } from '../../shared/protocol.ts'
import { send, state } from './net.ts'

interface Step { text: string; npc?: string; done: (ev: TutorialEvent) => boolean }
export type TutorialEvent = { kind: 'msg'; m: ServerMsg } | { kind: 'panel'; id: string }

const STEPS: Step[] = [
  { text: 'Bem-vindo a Vértice, caçador! Fale com a Ísis, a Guardiã das Fendas: toque nela, ou chegue perto e aperte E.', npc: 'guardia-das-fendas',
    done: (e) => e.kind === 'panel' && e.id === 'fendas' },
  { text: 'Escolha a primeira faixa das Minas Ocas e entre na fenda.',
    done: (e) => e.kind === 'msg' && e.m.t === 'room' && e.m.room.kind === 'hunt' },
  { text: 'Seu caçador luta sozinho, até com o jogo fechado. Deixe-o caçar até subir de nível.',
    done: (e) => e.kind === 'msg' && e.m.t === 'char' && e.m.c.level >= 2 },
  { text: 'Subiu de nível! Abra o Status (botão no menu ou tecla C) e distribua seus pontos de atributo.',
    done: (e) => e.kind === 'msg' && e.m.t === 'char' && e.m.c.points === 0 },
  { text: 'Ferido? Volte para a cidade e fale com a Irmã Clara: ela cura na hora. O Tobias vende poções.', npc: 'curandeira',
    done: (e) => (e.kind === 'msg' && e.m.t === 'healed') || (e.kind === 'panel' && e.id === 'loja') },
  { text: 'Ao vencer monstros você pode evocar ecos, sombras que lutam ao seu lado. Veja em Ecos (tecla H).',
    done: (e) => e.kind === 'panel' && e.id === 'ecos' },
  { text: 'No nível 3 o Ezequiel, Mestre de Talentos, libera a árvore de talentos. Boa caçada!', npc: 'mestre-de-talentos',
    done: (e) => e.kind === 'panel' && e.id === 'talentos' },
]

let card: HTMLElement | null = null
/** Avisa a cena qual NPC apontar (ou nenhum). */
export let onGuide: (npc: string | null) => void = () => {}
export function setGuide(fn: (npc: string | null) => void) { onGuide = fn; render() }

const current = () => state.char?.tutorial
function render() {
  const step = current()
  if (step === undefined || step >= STEPS.length) { card?.remove(); card = null; onGuide(null); return }
  if (!card) {
    card = document.createElement('div'); card.id = 'tutorial'
    document.getElementById('hud')?.append(card)
  }
  const s = STEPS[step]
  card.replaceChildren(
    Object.assign(document.createElement('small'), { textContent: `Primeiros passos · ${step + 1} de ${STEPS.length}` }),
    Object.assign(document.createElement('p'), { textContent: s.text }),
    Object.assign(document.createElement('button'), { type: 'button', textContent: 'Pular tutorial', onclick: () => advance(STEPS.length) }),
  )
  onGuide(s.npc ?? null)
}
function advance(to: number) {
  if (!state.char) return
  state.char.tutorial = to
  send({ t: 'tutorial', step: to })
  render()
}

/** Chamado a cada mensagem do servidor e a cada painel aberto. */
export function tutorialEvent(ev: TutorialEvent) {
  const step = current()
  if (ev.kind === 'msg' && ev.m.t === 'char') render()
  if (step === undefined || step >= STEPS.length) return
  if (STEPS[step].done(ev)) advance(step + 1)
}
