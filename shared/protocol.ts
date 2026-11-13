// Mensagens trocadas por WebSocket (JSON). O servidor é a autoridade: o cliente só envia intenções.
import type { Attr, Character, ClassId, Derived, ShopId, Slot } from './content.ts'

export type ClientMsg =
  | { t: 'auth'; token: string }
  | { t: 'createChar'; name: string; cls: ClassId }
  | { t: 'move'; dx: number; dy: number }
  | { t: 'chat'; text: string }
  | { t: 'enterHunt'; rift: string; band: number }
  | { t: 'promotion' }
  | { t: 'leave' }
  | { t: 'extract' }
  | { t: 'setAuto'; extract: boolean }
  | { t: 'attr'; attr: Attr; n: number }
  | { t: 'equip'; id: string }
  | { t: 'unequip'; slot: Slot }
  | { t: 'sell'; id: string }
  | { t: 'sellCommons' }
  | { t: 'enchant'; id: string }
  | { t: 'buy'; what: ShopId; n: number }
  | { t: 'team'; ids: string[] }
  | { t: 'fuse'; species: string; tier: number }
  | { t: 'release'; id: string }
  | { t: 'ranking' }

/** Entidade num snapshot. k: p=jogador, m=monstro, e=eco, c=corpo. */
export interface Ent {
  id: number; k: 'p' | 'm' | 'e' | 'c'
  x: number; y: number; hp: number; mhp: number
  s: string // sprite: classe ou espécie
  n?: string // nome exibido
  r?: string // rank do caçador
  mk?: string // tipo do monstro: comum, elite, chefe
  me?: boolean
}
export interface RoomInfo {
  kind: 'city' | 'hunt' | 'promotion'
  w: number; h: number; map: string; title: string
  rift?: string; band?: number; level?: number; seconds?: number
}
export interface HuntStats { kills: number; exp: number; gold: number; seconds: number; toBoss: number; timeLeft?: number }
export type Fx =
  | { f: 'hit'; from: number; to: number; dmg: number; crit?: boolean; proj?: string }
  | { f: 'heal'; to: number; amount: number }
  | { f: 'die'; id: number }
  | { f: 'level'; id: number }
  | { f: 'extract'; x: number; y: number; ok: boolean }

export type ServerMsg =
  | { t: 'needChar' }
  | { t: 'char'; c: Character; d: Derived }
  | { t: 'room'; room: RoomInfo; you: number }
  | { t: 'snap'; ents: Ent[]; fx: Fx[]; stats?: HuntStats }
  | { t: 'chat'; from: string; rank: string; text: string }
  | { t: 'log'; text: string; tone?: 'good' | 'bad' | 'loot' }
  | { t: 'err'; text: string }
  | { t: 'ranking'; rows: { name: string; cls: ClassId; level: number; rank: string }[] }
  | { t: 'rest'; minutes: number; exp: number; gold: number }
  | { t: 'result'; title: string; text: string; win: boolean }
  | { t: 'kicked'; text: string }
