// Moderação do chat: filtro de termos, bloqueio de links e detecção de repetição.

// Lista inicial, curta de propósito: ofensas e insultos discriminatórios comuns em pt-BR.
// Amplie em produção a partir das denúncias (tabela chat_reports).
const BLOCKED = [
  'porra', 'caralho', 'merda', 'bosta', 'puta', 'puto', 'fdp', 'filhodaputa', 'arrombado', 'arrombada', 'cuzao', 'cuzão', 'viado', 'viadinho',
  'bicha', 'traveco', 'macaco', 'macaca', 'retardado', 'retardada', 'mongol', 'vagabunda', 'piranha', 'buceta', 'pau no cu', 'vai se foder', 'vsf', 'tnc',
]
const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's' }
/** Minúsculas, sem acento e com trocas comuns de letras por números desfeitas. Mantém o comprimento. */
const fold = (s: string) => [...s.toLowerCase()].map((ch) => LEET[ch] ?? ch.normalize('NFD').replace(/[̀-ͯ]/g, '') ?? ch).map((c) => (c.length === 1 ? c : c[0] ?? ' ')).join('')
const WORDS = BLOCKED.map((w) => fold(w))
const LINK = /\b(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(?:com|net|org|gg|io|br|xyz|ru|top|shop|link)\b\S*/gi

/** Mascara termos bloqueados e links. Devolve o texto limpo e se algo foi mascarado. */
export function filterChat(text: string): { text: string; masked: boolean } {
  let out = text.replace(LINK, '[link removido]')
  let masked = out !== text
  const folded = fold(out)
  if (folded.length === out.length) {
    const chars = [...out]
    for (const w of WORDS) {
      let from = 0
      for (;;) {
        const i = folded.indexOf(w, from)
        if (i < 0) break
        const before = folded[i - 1], after = folded[i + w.length]
        // só palavra inteira, para não mascarar trechos de palavras inocentes
        if (!(before && /[a-z0-9]/.test(before)) && !(after && /[a-z0-9]/.test(after))) { for (let k = 0; k < w.length; k++) if (chars[i + k] !== ' ') chars[i + k] = '*'; masked = true }
        from = i + w.length
      }
    }
    out = chars.join('')
  }
  return { text: out, masked }
}

/** Controle de repetição por jogador: a mesma mensagem 3 vezes em 30 s silencia por 60 s. */
export class FloodGuard {
  private last: { text: string; at: number }[] = []
  check(text: string, now: number): boolean {
    this.last = this.last.filter((m) => now - m.at < 30_000)
    this.last.push({ text: text.toLowerCase(), at: now })
    return this.last.filter((m) => m.text === text.toLowerCase()).length >= 3
  }
}
