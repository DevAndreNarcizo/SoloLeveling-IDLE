// Conexão com o servidor e estado compartilhado entre a cena e a interface.
import type { Character, Derived } from '../../shared/content.ts'
import type { Acct, ClientMsg, GuildView, HuntStats, MarketRow, PartyView, RoomInfo, ServerMsg, TradeView } from '../../shared/protocol.ts'

type Handler = (m: ServerMsg) => void
const handlers = new Set<Handler>()
export const onMessage = (h: Handler) => { handlers.add(h) }

export const state: {
  char: Character | null; derived: Derived | null; room: RoomInfo | null; you: number; stats: HuntStats | null; cds: number[]
  acct: Acct | null; party: PartyView | null; trade: TradeView | null; guild: GuildView | null; market: { rows: MarketRow[]; mine: boolean }
} = { char: null, derived: null, room: null, you: 0, stats: null, cds: [], acct: null, party: null, trade: null, guild: null, market: { rows: [], mine: false } }

let ws: WebSocket | null = null
let onClose: (reason: string) => void = () => {}
export function send(m: ClientMsg) { if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(m)) }

export function connect(token: string, closed: (reason: string) => void) {
  onClose = closed
  let reason = 'Conexão perdida. Entre de novo.'
  ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`)
  ws.onopen = () => send({ t: 'auth', token })
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data as string) as ServerMsg
    if (m.t === 'char') { state.char = m.c; state.derived = m.d }
    else if (m.t === 'room') { state.room = m.room; state.you = m.you; state.stats = null }
    else if (m.t === 'snap') { if (m.stats) state.stats = m.stats; state.cds = m.cds ?? [] }
    else if (m.t === 'acct') state.acct = m.a
    else if (m.t === 'party') state.party = m.party
    else if (m.t === 'trade') state.trade = m.trade
    else if (m.t === 'guild') state.guild = m.guild
    else if (m.t === 'market') state.market = { rows: m.rows, mine: m.mine }
    else if (m.t === 'kicked') reason = m.text
    for (const h of handlers) h(m)
  }
  ws.onclose = () => { ws = null; onClose(reason) }
}

export async function api(path: 'login' | 'register' | 'logout' | 'forgot' | 'reset', body: Record<string, string>): Promise<{ token?: string; error?: string; ok?: boolean }> {
  try {
    const r = await fetch(`/api/${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    return await r.json()
  } catch { return { error: 'Não foi possível falar com o servidor.' } }
}
