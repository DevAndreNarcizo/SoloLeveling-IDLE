// Mensagens trocadas por WebSocket (JSON). O servidor é a autoridade: o cliente só envia intenções.
import type { Attr, Character, ClassId, Derived, Item, PremiumId, ShopId, Slot } from './content.ts'

export type ChatChannel = 'global' | 'guild' | 'party' | 'whisper'
export type InviteKind = 'party' | 'duel' | 'trade' | 'guild'

export type ClientMsg =
  | { t: 'auth'; token: string }
  | { t: 'createChar'; name: string; cls: ClassId }
  | { t: 'move'; dx: number; dy: number }
  | { t: 'chat'; text: string; channel?: ChatChannel; to?: string }
  | { t: 'report'; name: string; reason: string }
  | { t: 'enterHunt'; rift: string; band: number }
  | { t: 'promotion' }
  | { t: 'leave' }
  | { t: 'extract' }
  | { t: 'setAuto'; extract: boolean }
  | { t: 'attr'; attr: Attr; n: number }
  | { t: 'talent'; id: string }
  | { t: 'talentReset' }
  | { t: 'equip'; id: string }
  | { t: 'unequip'; slot: Slot }
  | { t: 'sell'; id: string }
  | { t: 'sellCommons' }
  | { t: 'enchant'; id: string }
  | { t: 'buy'; what: ShopId; n: number }
  | { t: 'team'; ids: string[] }
  | { t: 'fuse'; species: string; tier: number }
  | { t: 'release'; id: string }
  | { t: 'ranking'; arena?: boolean }
  // convites (grupo, duelo, troca, guilda)
  | { t: 'invite'; kind: InviteKind; name: string }
  | { t: 'accept'; kind: InviteKind; from: string }
  | { t: 'partyLeave' }
  | { t: 'partyKick'; name: string }
  // troca direta
  | { t: 'tradeOffer'; items: string[]; gold: number }
  | { t: 'tradeConfirm' }
  | { t: 'tradeCancel' }
  // guilda
  | { t: 'guildCreate'; name: string; tag: string }
  | { t: 'guildLeave' }
  | { t: 'guildKick'; name: string }
  | { t: 'guildRole'; name: string; officer: boolean }
  | { t: 'guildDonate'; gold: number }
  | { t: 'guildNotice'; text: string }
  | { t: 'guildInfo' }
  // mercado
  | { t: 'marketList'; slot?: Slot | ''; mine?: boolean }
  | { t: 'marketSell'; id: string; price: number }
  | { t: 'marketBuy'; id: number }
  | { t: 'marketCancel'; id: number }
  // cristais
  | { t: 'premium'; what: PremiumId; cls?: ClassId }
  | { t: 'buyPack'; pack: string }

/** Entidade num snapshot. k: p=jogador, m=monstro, e=eco, c=corpo. */
export interface Ent {
  id: number; k: 'p' | 'm' | 'e' | 'c'
  x: number; y: number; hp: number; mhp: number
  s: string // sprite: classe ou espécie
  n?: string // nome exibido
  r?: string // rank do caçador
  g?: string // sigla da guilda
  mk?: string // tipo do monstro: comum, elite, chefe
  me?: boolean
  sh?: boolean // com escudo ativo
}
export interface RoomInfo {
  kind: 'city' | 'hunt' | 'promotion' | 'duel'
  w: number; h: number; map: string; title: string
  rift?: string; band?: number; level?: number; seconds?: number
}
export interface HuntStats { kills: number; exp: number; gold: number; seconds: number; toBoss: number; timeLeft?: number }
export type Fx =
  | { f: 'hit'; from: number; to: number; dmg: number; crit?: boolean; proj?: string; skill?: boolean }
  | { f: 'heal'; to: number; amount: number }
  | { f: 'die'; id: number }
  | { f: 'level'; id: number }
  | { f: 'extract'; x: number; y: number; ok: boolean }
  | { f: 'skill'; id: number; name: string; x?: number; y?: number; r?: number }

export interface PartyView { leader: string; members: { name: string; cls: ClassId; level: number; online: boolean }[] }
export interface TradeSide { name: string; items: Item[]; gold: number; ok: boolean }
export interface TradeView { mine: TradeSide; theirs: TradeSide }
export interface GuildView {
  id: number; name: string; tag: string; level: number; funds: number; next: number | null; notice: string; role: string
  members: { name: string; cls: ClassId; level: number; role: string; online: boolean }[]
}
export interface MarketRow { id: number; seller: string; item: Item; price: number; mine: boolean }
export interface Acct { crystals: number; role: string; rating: number; hasEmail: boolean; payments: boolean }

export type ServerMsg =
  | { t: 'needChar' }
  | { t: 'char'; c: Character; d: Derived }
  | { t: 'acct'; a: Acct }
  | { t: 'room'; room: RoomInfo; you: number }
  | { t: 'snap'; ents: Ent[]; fx: Fx[]; stats?: HuntStats; cds?: number[] }
  | { t: 'chat'; from: string; rank: string; text: string; channel: ChatChannel; tag?: string; to?: string }
  | { t: 'log'; text: string; tone?: 'good' | 'bad' | 'loot' }
  | { t: 'err'; text: string }
  | { t: 'ranking'; arena: boolean; rows: { name: string; cls: ClassId; level: number; rank: string; rating?: number }[] }
  | { t: 'rest'; minutes: number; exp: number; gold: number }
  | { t: 'result'; title: string; text: string; win: boolean }
  | { t: 'kicked'; text: string }
  | { t: 'invited'; kind: InviteKind; from: string; text: string }
  | { t: 'party'; party: PartyView | null }
  | { t: 'trade'; trade: TradeView | null }
  | { t: 'guild'; guild: GuildView | null }
  | { t: 'market'; rows: MarketRow[]; mine: boolean }
  | { t: 'order'; id: string; status: 'pending' | 'paid'; text: string }
