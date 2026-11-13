// Interface em HTML sobre o canvas. Textos vindos de jogadores entram sempre por textContent.
import {
  ARENA, ATTRS, ATTR_HELP, ATTR_NAMES, AUTO_EXTRACT_LEVEL, BAG_EXPANSIONS, CLASSES, CLASS_IDS, CRYSTAL_PACKS, ECHO_FUSE_COUNT, ECHO_LIMIT, ECHO_TIERS,
  ENCHANT_CHANCE, GUILD, MARKET, MAX_ENCHANT, MAX_LEVEL, MONSTERS, PARTY_MAX, PREMIUM, PROMOTIONS, RARITY_INFO, RIFTS, SHOP, SKILLS, SLOTS,
  SLOT_NAMES, TALENTS, TALENT_MAX, TALENT_PATHS, TALENT_TIER_POINTS, bagSize, echoFuseCost, echoStats, enchantCost, expToNext, itemName,
  itemStat, pathPoints, rankOf, sellPrice, talentPoints, talentResetCost, type ClassId, type Item, type PremiumId, type ShopId, type Slot, type TalentPath,
} from '../../shared/content.ts'
import type { ChatChannel, InviteKind, ServerMsg } from '../../shared/protocol.ts'
import { icon } from './assets.ts'
import { send, state } from './net.ts'

type Props<K extends keyof HTMLElementTagNameMap> = Omit<Partial<HTMLElementTagNameMap[K]>, 'style'> & { class?: string; style?: string }
type Child = Node | string | null | undefined | false
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Props<K> = {} as Props<K>, ...kids: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag)
  const { class: cls, ...rest } = props
  if (cls) el.className = cls
  Object.assign(el, rest)
  for (const k of kids) if (k) el.append(k)
  return el
}
const $ = (id: string) => document.getElementById(id)!
const fmt = (n: number) => Math.round(n).toLocaleString('pt-BR')
const btn = (label: string, onclick: () => void, opts: { disabled?: boolean; primary?: boolean; title?: string } = {}) =>
  h('button', { class: `small${opts.primary ? ' primary' : ''}`, type: 'button', onclick, disabled: !!opts.disabled, title: opts.title ?? '' }, label)
/** Elemento com texto vindo de jogador (nunca interpretado como HTML). */
const safe = <K extends keyof HTMLElementTagNameMap>(tag: K, text: string, cls = '') => { const el = h(tag, { class: cls } as Props<K>); el.textContent = text; return el }
const inCity = () => state.room?.kind === 'city'

const PANELS: Record<string, { title: string; key?: string; icon: string; render: () => Node[] }> = {
  status: { title: 'Status', key: 'c', icon: 'icones/menu/status', render: renderStatus },
  mochila: { title: 'Mochila', key: 'i', icon: 'icones/menu/mochila', render: renderBag },
  ecos: { title: 'Ecos', key: 'h', icon: 'icones/menu/ecos', render: renderEchoes },
  talentos: { title: 'Talentos e habilidades', key: 'k', icon: 'icones/atributos/int', render: renderTalents },
  fendas: { title: 'Fendas', key: 'm', icon: 'icones/menu/fendas', render: renderRifts },
  social: { title: 'Social', key: 'p', icon: 'icones/classes/lamina', render: renderSocial },
  guilda: { title: 'Guilda', key: 'g', icon: 'icones/classes/arcanista', render: renderGuild },
  mercado: { title: 'Mercado', key: 'b', icon: 'icones/itens/ouro', render: renderMarket },
  cristais: { title: 'Cristais', key: 'l', icon: 'icones/itens/lasca', render: renderCrystals },
  forja: { title: 'Forja', icon: 'icones/menu/status', render: renderForge },
  loja: { title: 'Loja', icon: 'icones/menu/status', render: renderShop },
  ranking: { title: 'Ranking', icon: 'icones/menu/status', render: renderRanking },
  troca: { title: 'Troca', icon: 'icones/menu/status', render: renderTrade },
}
const MENU = ['status', 'mochila', 'ecos', 'talentos', 'fendas', 'social', 'guilda', 'mercado', 'cristais']
let open: string | null = null
let ranking: Extract<ServerMsg, { t: 'ranking' }> | null = null
let seenItems = 0
let socialName = ''
let marketTab: 'comprar' | 'vender' | 'meus' = 'comprar'
let marketSlot: Slot | '' = ''
let channel: ChatChannel = 'global'

export function openPanel(id: string) {
  if (!PANELS[id]) return
  open = id
  if (id === 'ranking') { ranking = null; send({ t: 'ranking' }) }
  if (id === 'guilda') send({ t: 'guildInfo' })
  if (id === 'mercado') refreshMarket()
  if (id === 'mochila') seenItems = state.char?.nextId ?? 0
  $('panel').classList.remove('hidden')
  renderPanel(); renderMenu()
}
export function openSocial(name: string) { socialName = name; openPanel('social') }
export function closePanel() {
  if (open === 'troca' && state.trade) send({ t: 'tradeCancel' })
  open = null; $('panel').classList.add('hidden')
}
function renderPanel() {
  if (!open || !state.char) return
  // Não redesenha enquanto o jogador digita num campo do painel.
  const active = document.activeElement
  if (active instanceof HTMLInputElement && $('panelBody').contains(active)) return
  const body = $('panelBody'), top = body.scrollTop
  $('panelTitle').textContent = PANELS[open].title
  body.replaceChildren(...PANELS[open].render())
  body.scrollTop = top
}
const refreshMarket = () => send({ t: 'marketList', slot: marketSlot, mine: marketTab === 'meus' })

// ---------- HUD ----------
function renderMe() {
  const c = state.char, d = state.derived
  if (!c || !d) return
  const need = expToNext(c.level), capped = c.level >= rankOf(c).levelCap
  const pct = c.level >= MAX_LEVEL ? 100 : Math.min(100, (c.exp / need) * 100)
  const boost = c.expBoostUntil && c.expBoostUntil > Date.now() ? Math.ceil((c.expBoostUntil - Date.now()) / 60000) : 0
  $('me').replaceChildren(
    h('div', { class: 'row' }, h('span', {}, h('span', { class: 'rank' }, rankOf(c).id), ' ', safe('b', c.name)), h('span', {}, `Nv ${c.level}`)),
    h('div', { class: 'bar', title: 'Experiência' }, h('i', { style: `width:${pct}%` })),
    h('div', { class: 'row muted' },
      h('span', {}, c.level >= MAX_LEVEL ? 'Nível máximo' : capped ? 'Limite do rank: faça a promoção' : `EXP ${fmt(c.exp)} / ${fmt(need)}`),
      h('span', {}, CLASSES[c.cls].name)),
    h('div', { class: 'row' }, h('span', { class: 'loot' }, `Ouro ${fmt(c.gold)}`), h('span', { class: 'crystal' }, `Cristais ${fmt(state.acct?.crystals ?? 0)}`), h('span', {}, `Poder ${fmt(d.power)}`)),
    h('div', { class: 'row muted' }, h('span', {}, `Poções ${c.pocao}`), h('span', {}, `Fragmentos ${c.fragmento}`), h('span', {}, `Lascas ${c.lasca}`)),
    boost ? h('div', { class: 'row good' }, `Impulso de EXP: ${boost} min`) : '',
  )
}
function renderRoomBar() {
  const r = state.room, s = state.stats, c = state.char
  if (!r || !c) return
  const kids: Child[] = [h('b', {}, r.title)]
  if (r.kind === 'city') kids.push(h('span', { class: 'muted' }, 'WASD ou toque para andar · E fala com NPC · toque num caçador para interagir'))
  else {
    if (s) {
      const min = Math.max(s.seconds / 60, 1 / 60)
      if (r.kind === 'hunt') kids.push(h('span', { class: 'muted' }, `Abates ${s.kills} · ${fmt(s.exp / min)} EXP/min · ${fmt(s.gold / min)} ouro/min · chefe em ${s.toBoss}`))
      else kids.push(h('span', { class: 'bad' }, `Tempo restante: ${Math.ceil(s.timeLeft ?? 0)}s`))
    }
    if (r.kind === 'hunt') {
      kids.push(btn('Evocar eco (E)', () => send({ t: 'extract' })))
      kids.push(h('label', { title: `Libera no nível ${AUTO_EXTRACT_LEVEL}` },
        h('input', { type: 'checkbox', checked: c.autoExtract, disabled: c.level < AUTO_EXTRACT_LEVEL, style: 'width:auto', onchange: (e: Event) => send({ t: 'setAuto', extract: (e.target as HTMLInputElement).checked }) }), ' Auto'))
    }
    kids.push(btn(r.kind === 'hunt' ? 'Voltar à cidade' : 'Desistir', () => send({ t: 'leave' })))
  }
  $('roomBar').replaceChildren(...kids.filter((k): k is Node | string => !!k))
}
/** Barra de habilidades: mostra a recarga; o caçador usa sozinho. */
function renderSkills() {
  const c = state.char, bar = $('skills')
  const show = !!c && !!state.room && state.room.kind !== 'city'
  bar.classList.toggle('hidden', !show)
  if (!show || !c) return
  bar.replaceChildren(...SKILLS[c.cls].map((s, i) => {
    const locked = c.level < s.level, cd = state.cds[i] ?? 0
    return h('div', { class: `skill${locked ? ' locked' : cd > 0 ? ' cooling' : ' ready'}`, title: `${s.name}: ${s.desc}` }, h('b', {}, s.name), h('small', {}, locked ? `Nível ${s.level}` : cd > 0 ? `${cd}s` : 'Pronta'))
  }))
}
function renderParty() {
  const p = state.party, box = $('party')
  box.classList.toggle('hidden', !p)
  if (!p) return
  box.replaceChildren(h('b', {}, `Grupo (${p.members.length}/${PARTY_MAX})`), ...p.members.map((m) => {
    const row = h('div', { class: m.online ? '' : 'muted' }, m.name === p.leader ? '★ ' : '')
    row.append(safe('span', m.name), ` · ${CLASSES[m.cls]?.name ?? ''} ${m.level}`)
    return row
  }), btn('Sair do grupo', () => send({ t: 'partyLeave' })))
}
function renderMenu() {
  const c = state.char
  $('menu').replaceChildren(...MENU.map((id) => {
    const p = PANELS[id]
    const b = h('button', { type: 'button', onclick: () => (open === id ? closePanel() : openPanel(id)), title: p.key ? `Tecla ${p.key.toUpperCase()}` : '' }, icon(p.icon, p.title), p.title.split(' ')[0])
    const alert = !!c && ((id === 'status' && (c.points > 0 || (c.level >= rankOf(c).levelCap && !!PROMOTIONS[c.rank])))
      || (id === 'talentos' && talentPoints(c).free > 0)
      || (id === 'mochila' && c.nextId > seenItems && c.items.length > 0 && open !== 'mochila' && seenItems > 0))
    if (alert) b.append(h('span', { class: 'dot' }))
    return b
  }))
}
function addLine(box: HTMLElement, node: HTMLElement, max: number) {
  box.prepend(node)
  while (box.children.length > max) box.lastElementChild!.remove()
}
let toastTimer = 0
function toast(text: string) {
  const t = $('toast'); t.textContent = text; t.classList.remove('hidden')
  clearTimeout(toastTimer); toastTimer = window.setTimeout(() => t.classList.add('hidden'), 2600)
}
function modal(title: string, text: string) {
  $('modalTitle').textContent = title; $('modalText').textContent = text; $('modal').classList.remove('hidden')
  $('modalOk').focus()
}
const INVITE_LABEL: Record<InviteKind, string> = { party: 'Grupo', duel: 'Duelo', trade: 'Troca', guild: 'Guilda' }
function showInvite(kind: InviteKind, from: string, text: string) {
  const card = h('div', { class: 'invite' }, h('b', {}, INVITE_LABEL[kind]), safe('span', text))
  const done = () => card.remove()
  card.append(h('div', { class: 'acts' }, btn('Aceitar', () => { send({ t: 'accept', kind, from }); done() }, { primary: true }), btn('Recusar', done)))
  $('invites').append(card)
  window.setTimeout(done, 55_000)
}

// ---------- Painéis ----------
function renderStatus(): Node[] {
  const c = state.char!, d = state.derived!
  const out: Node[] = []
  const promo = PROMOTIONS[c.rank], rank = rankOf(c)
  out.push(h('div', { class: 'line' },
    h('div', { class: 'grow' }, h('b', {}, `${rank.name} · limite de nível ${rank.levelCap}`),
      h('small', {}, promo ? `Teste de promoção no nível ${rank.levelCap}: luta solo contra ${MONSTERS[promo.boss].name}, sem ecos, em ${promo.seconds}s.` : 'Rank mais alto desta versão.')),
    promo ? btn('Iniciar teste', () => { send({ t: 'promotion' }); closePanel() }, { primary: true, disabled: c.level < rank.levelCap || !inCity(), title: 'Disponível na cidade, ao atingir o limite de nível' }) : null))
  out.push(h('h4', {}, `Atributos · ${c.points} ponto(s) livre(s)`))
  for (const a of ATTRS) {
    const bonus = d.attrs[a] - c.attrs[a]
    out.push(h('div', { class: 'line' }, icon(`icones/atributos/${a}`, ATTR_NAMES[a]),
      h('div', { class: 'grow' }, h('b', {}, `${ATTR_NAMES[a]} ${c.attrs[a]}${bonus ? ` (+${bonus})` : ''}`), h('small', {}, ATTR_HELP[a])),
      h('div', { class: 'acts' }, btn('+1', () => send({ t: 'attr', attr: a, n: 1 }), { disabled: c.points < 1 }), btn('+5', () => send({ t: 'attr', attr: a, n: 5 }), { disabled: c.points < 5 }))))
  }
  out.push(h('h4', {}, 'Combate'))
  out.push(h('div', { class: 'grid2' },
    ...[['Vida', fmt(d.maxHp)], ['Ataque', fmt(d.atk)], ['Defesa', fmt(d.def)], ['Crítico', `${(d.crit * 100).toFixed(1)}%`], ['Ataques/s', d.atkPerSec.toFixed(2)], ['Arena', String(state.acct?.rating ?? ARENA.startRating)]]
      .map(([k, v]) => h('div', { class: 'line' }, h('span', { class: 'muted' }, k), h('b', {}, v)))))
  out.push(h('h4', {}, 'Equipamento'))
  for (const slot of SLOTS) {
    const it = c.equipped[slot]
    out.push(it ? itemLine(it, [btn('Tirar', () => send({ t: 'unequip', slot }))]) : h('div', { class: 'line' }, h('span', { class: 'muted' }, `${SLOT_NAMES[slot]}: vazio`)))
  }
  return out
}
function itemIcon(it: Item) { return icon(it.slot === 'arma' ? `icones/itens/arma-${it.cls}` : `icones/itens/${it.slot}`, SLOT_NAMES[it.slot]) }
function itemLine(it: Item, acts: Child[], note = ''): HTMLElement {
  const stats = [it.atk && `Atq ${itemStat(it, 'atk')}`, it.def && `Def ${itemStat(it, 'def')}`, it.hp && `Vida ${itemStat(it, 'hp')}`,
    ...ATTRS.map((a) => it.attrs?.[a] && `${ATTR_NAMES[a]} +${it.attrs[a]}`)].filter(Boolean).join(' · ')
  const name = h('b', { style: `color:${RARITY_INFO[it.rarity].color}` }, itemName(it))
  const sub = h('small', {}, `Nv ${it.level}${it.cls ? ` · ${CLASSES[it.cls].name}` : ''} · ${stats}`)
  if (note) sub.append(' · ', safe('span', note))
  return h('div', { class: 'line' }, itemIcon(it), h('div', { class: 'grow' }, name, sub), h('div', { class: 'acts' }, ...acts))
}
const score = (it?: Item) => (it ? itemStat(it, 'atk') * 3 + itemStat(it, 'def') * 2 + itemStat(it, 'hp') * 0.3 : 0)
function renderBag(): Node[] {
  const c = state.char!
  const out: Node[] = [h('div', { class: 'line' },
    h('span', {}, `${c.items.length} / ${bagSize(c)} peças. Com a mochila cheia, novos drops são vendidos na hora.`),
    btn('Vender comuns', () => send({ t: 'sellCommons' }), { disabled: !c.items.some((i) => i.rarity === 'comum' && i.enchant === 0) }))]
  const items = [...c.items].sort((a, b) => score(b) - score(a))
  if (!items.length) out.push(h('p', { class: 'muted' }, 'Mochila vazia. Os monstros das fendas deixam cair equipamento.'))
  for (const it of items) {
    const usable = (!it.cls || it.cls === c.cls) && it.level <= c.level
    const better = usable && score(it) > score(c.equipped[it.slot])
    out.push(itemLine(it, [
      btn(better ? 'Equipar ▲' : 'Equipar', () => send({ t: 'equip', id: it.id }), { disabled: !usable, primary: better, title: usable ? '' : it.cls && it.cls !== c.cls ? `Arma de ${CLASSES[it.cls].name}` : `Exige nível ${it.level}` }),
      btn(`Vender ${sellPrice(it)}`, () => send({ t: 'sell', id: it.id })),
    ]))
  }
  return out
}
function renderEchoes(): Node[] {
  const c = state.char!, rank = rankOf(c)
  const out: Node[] = [h('p', { class: 'muted' }, `Ecos são monstros derrotados que lutam ao seu lado. Na fenda, aperte E perto de um resquício: cada tentativa gasta 1 Fragmento de Eco. ` +
    `Em campo: ${c.team.length} / ${rank.echoSlots} (aumenta com o rank; em grupo, 1 por caçador). Exército: ${c.echoes.length} / ${ECHO_LIMIT}.`)]
  if (!c.echoes.length) out.push(h('p', {}, 'Você ainda não evocou nenhum eco.'))
  const groups = new Map<string, typeof c.echoes>()
  for (const e of c.echoes) { const k = `${e.species}|${e.tier}`; groups.set(k, [...(groups.get(k) ?? []), e]) }
  const sorted = [...groups.values()].sort((a, b) => b[0].tier - a[0].tier || a[0].species.localeCompare(b[0].species))
  for (const g of sorted) {
    const e = g[0], st = echoStats(e, c.level), inTeam = g.filter((x) => c.team.includes(x.id))
    const canFuse = g.length >= ECHO_FUSE_COUNT && e.tier < ECHO_TIERS.length - 1
    const allowed = e.tier + 1 <= rank.maxEchoTier
    const free = g.find((x) => !c.team.includes(x.id))
    out.push(h('div', { class: 'line' }, icon(`monstros/${e.species}`, MONSTERS[e.species]?.name ?? 'Eco'),
      h('div', { class: 'grow' }, h('b', {}, `${MONSTERS[e.species]?.name ?? e.species} · ${ECHO_TIERS[e.tier].name} ×${g.length}`),
        h('small', {}, `Vida ${fmt(st.maxHp)} · Ataque ${fmt(st.atk)}${inTeam.length ? ` · ${inTeam.length} em campo` : ''}`)),
      h('div', { class: 'acts' },
        free ? btn('Pôr em campo', () => send({ t: 'team', ids: [...c.team, free.id] }), { disabled: c.team.length >= rank.echoSlots }) : null,
        inTeam.length ? btn('Recolher', () => send({ t: 'team', ids: c.team.filter((id) => id !== inTeam[0].id) })) : null,
        canFuse ? btn(`Fundir ${ECHO_FUSE_COUNT} (${fmt(echoFuseCost(e.tier))} ouro)`, () => send({ t: 'fuse', species: e.species, tier: e.tier }), { disabled: !allowed || c.gold < echoFuseCost(e.tier), title: allowed ? '' : 'Seu rank ainda não comanda esse grau' }) : null,
        free ? btn('Libertar', () => send({ t: 'release', id: free.id })) : null)))
  }
  return out
}
function renderTalents(): Node[] {
  const c = state.char!, tp = talentPoints(c)
  const out: Node[] = [h('h4', {}, 'Habilidades ativas (uso automático)')]
  for (const s of SKILLS[c.cls]) {
    out.push(h('div', { class: 'line' }, h('div', { class: 'grow' }, h('b', { class: c.level >= s.level ? '' : 'muted' }, `${s.name} · recarga ${s.cd}s`), h('small', {}, s.desc)),
      h('span', { class: c.level >= s.level ? 'good' : 'muted' }, c.level >= s.level ? 'Liberada' : `Nível ${s.level}`)))
  }
  out.push(h('div', { class: 'line' }, h('span', {}, `Pontos de talento: ${tp.free} livre(s) de ${tp.total}. Você ganha 1 por nível.`),
    btn(`Redefinir (${fmt(talentResetCost(c))} ouro)`, () => send({ t: 'talentReset' }), { disabled: !tp.spent || c.gold < talentResetCost(c) })))
  for (const path of Object.keys(TALENT_PATHS) as TalentPath[]) {
    const spent = pathPoints(c, path)
    out.push(h('h4', {}, `${TALENT_PATHS[path]} · ${spent} ponto(s)`))
    for (const t of TALENTS.filter((x) => x.path === path)) {
      const cur = c.talents?.[t.id] ?? 0, need = t.tier * TALENT_TIER_POINTS, lockedTier = spent < need
      out.push(h('div', { class: 'line' }, h('div', { class: 'grow' }, h('b', { class: lockedTier ? 'muted' : '' }, `${t.name} ${cur}/${TALENT_MAX}`), h('small', {}, lockedTier ? `${t.desc} Exige ${need} pontos nesta senda.` : t.desc)),
        btn('+1', () => send({ t: 'talent', id: t.id }), { disabled: lockedTier || cur >= TALENT_MAX || tp.free < 1 })))
    }
  }
  return out
}
function renderRifts(): Node[] {
  const c = state.char!
  const out: Node[] = [h('p', { class: 'muted' }, 'O caçador luta sozinho na fenda. A cada 40 abates surge o chefe. Se cair, ele volta em alguns segundos. Se você sair do jogo depois de 3 minutos de caçada solo, o descanso rende EXP e ouro por até 8 horas.')]
  if (state.party) out.push(h('p', { class: 'good' }, state.party.leader === c.name ? 'Você lidera o grupo: quem estiver na cidade entra junto.' : 'Em grupo, só o líder abre a caçada.'))
  for (const r of RIFTS) {
    out.push(h('h4', {}, `${r.name} · nível ${r.minLevel}+`))
    r.bands.forEach((b, i) => out.push(h('div', { class: 'line' }, icon(`monstros/${b.monster}`, MONSTERS[b.monster].name),
      h('div', { class: 'grow' }, h('b', {}, `Nível ${b.min}–${b.max} · ${MONSTERS[b.monster].name}`), h('small', {}, `Chefe: ${MONSTERS[b.boss].name}`)),
      btn(c.level >= b.min ? 'Entrar' : `Nível ${b.min}`, () => { send({ t: 'enterHunt', rift: r.id, band: i }); closePanel() }, { disabled: c.level < b.min, primary: c.level >= b.min && c.level <= b.max }))))
  }
  return out
}
function renderForge(): Node[] {
  const c = state.char!
  const out: Node[] = [h('p', { class: 'muted' }, `Cada aprimoramento soma 6% aos valores da peça, até +${MAX_ENCHANT}. Até +4 nunca falha. Falhar gasta os materiais, mas a peça não piora. Você tem ${c.lasca} Lasca(s) de Fenda.`)]
  if (!inCity()) out.push(h('p', { class: 'bad' }, 'A forja só atende na cidade.'))
  const all = [...SLOTS.map((s) => c.equipped[s]).filter((i): i is Item => !!i), ...c.items.filter((i) => i.rarity !== 'comum')]
  if (!all.length) out.push(h('p', {}, 'Nenhuma peça para aprimorar.'))
  for (const it of all) {
    const cost = enchantCost(it), max = it.enchant >= MAX_ENCHANT
    out.push(itemLine(it, [max ? h('span', { class: 'muted' }, 'Máximo') :
      btn(`+${it.enchant + 1} · ${Math.round(ENCHANT_CHANCE[it.enchant] * 100)}% · ${fmt(cost.gold)} ouro, ${cost.shards} lasca(s)`, () => send({ t: 'enchant', id: it.id }),
        { disabled: !inCity() || c.gold < cost.gold || c.lasca < cost.shards })]))
  }
  return out
}
function renderShop(): Node[] {
  const c = state.char!
  const out: Node[] = inCity() ? [] : [h('p', { class: 'bad' }, 'A loja só atende na cidade.')]
  for (const id of Object.keys(SHOP) as ShopId[]) {
    const s = SHOP[id]
    out.push(h('div', { class: 'line' }, icon(`icones/itens/${id}`, s.name),
      h('div', { class: 'grow' }, h('b', {}, `${s.name} · ${s.price} ouro`), h('small', {}, `${s.desc} Você tem ${c[id]}.`)),
      h('div', { class: 'acts' }, ...[1, 10, 50].map((n) => btn(`×${n}`, () => send({ t: 'buy', what: id, n }), { disabled: !inCity() || c.gold < s.price * n })))))
  }
  return out
}
function renderRanking(): Node[] {
  const tabs = h('div', { class: 'tabs' },
    h('button', { type: 'button', class: ranking && !ranking.arena ? 'on' : '', onclick: () => send({ t: 'ranking' }) }, 'Nível'),
    h('button', { type: 'button', class: ranking?.arena ? 'on' : '', onclick: () => send({ t: 'ranking', arena: true }) }, 'Arena'))
  if (!ranking) return [tabs, h('p', { class: 'muted' }, 'Carregando…')]
  return [tabs, ...ranking.rows.map((r, i) => h('div', { class: 'line' }, h('span', { class: 'muted' }, `${i + 1}º`),
    h('div', { class: 'grow' }, h('span', { class: 'rank' }, r.rank), ' ', safe('b', r.name)),
    h('span', {}, `${CLASSES[r.cls]?.name ?? ''} · Nv ${r.level}${r.rating !== undefined ? ` · ${r.rating} pts` : ''}`)))]
}
function renderSocial(): Node[] {
  const c = state.char!, p = state.party
  const input = h('input', { value: socialName, placeholder: 'Nome do caçador', maxLength: 16, oninput: (e: Event) => { socialName = (e.target as HTMLInputElement).value.trim() } })
  const act = (label: string, kind: InviteKind, disabled = false, title = '') => btn(label, () => { if (socialName) send({ t: 'invite', kind, name: socialName }) }, { disabled, title })
  const out: Node[] = [
    h('p', { class: 'muted' }, 'Digite o nome de um caçador online, ou toque nele na cidade.'),
    input,
    h('div', { class: 'acts left' },
      act('Convidar para o grupo', 'party'),
      act('Desafiar na arena', 'duel', c.level < ARENA.minLevel || !inCity(), `Nível ${ARENA.minLevel}, os dois na cidade`),
      act('Propor troca', 'trade', !inCity(), 'Os dois na cidade'),
      act('Convidar para a guilda', 'guild', !state.guild || state.guild.role === 'membro', 'Líder ou oficial da guilda'),
      btn('Sussurrar', () => { if (socialName) { const i = $('chatInput') as HTMLInputElement; i.value = `/w ${socialName} `; closePanel(); i.focus() } }),
      btn('Denunciar', () => { if (socialName) send({ t: 'report', name: socialName, reason: 'Denúncia pelo painel social' }) })),
    h('h4', {}, `Grupo (até ${PARTY_MAX})`),
  ]
  if (!p) out.push(h('p', { class: 'muted' }, 'Você não está em um grupo. Em grupo, todos lutam na mesma fenda e cada um recebe 75% da EXP e do ouro de cada abate.'))
  else {
    for (const m of p.members) out.push(h('div', { class: 'line' }, h('div', { class: 'grow' }, safe('b', `${m.name === p.leader ? '★ ' : ''}${m.name}`), h('small', {}, `${CLASSES[m.cls]?.name ?? ''} · Nv ${m.level}`)),
      p.leader === c.name && m.name !== c.name ? btn('Remover', () => send({ t: 'partyKick', name: m.name })) : null))
    out.push(btn('Sair do grupo', () => send({ t: 'partyLeave' })))
  }
  out.push(h('h4', {}, 'Arena'), h('p', { class: 'muted' }, `Duelo 1 contra 1, automático, sem ecos e sem poções, com ${ARENA.seconds}s. Sua pontuação: ${state.acct?.rating ?? ARENA.startRating}.`),
    btn('Ver ranking', () => openPanel('ranking')))
  return out
}
function renderGuild(): Node[] {
  const c = state.char!, g = state.guild
  if (!g) {
    let name = '', tag = ''
    return [
      h('p', { class: 'muted' }, `Guildas dão bônus de EXP a todos os membros (+1% por nível da guilda, até +${GUILD.maxLevel}%) e um canal de chat próprio. Criar custa ${fmt(GUILD.cost)} de ouro e exige nível ${GUILD.minLevel}. Para entrar numa guilda, peça um convite ao líder ou a um oficial.`),
      h('label', {}, 'Nome da guilda', h('input', { maxLength: 20, oninput: (e: Event) => { name = (e.target as HTMLInputElement).value } })),
      h('label', {}, 'Sigla (2 a 4 letras)', h('input', { maxLength: 4, oninput: (e: Event) => { tag = (e.target as HTMLInputElement).value } })),
      btn('Criar guilda', () => send({ t: 'guildCreate', name, tag }), { primary: true, disabled: c.level < GUILD.minLevel || c.gold < GUILD.cost }),
    ]
  }
  const staff = g.role !== 'membro'
  let gold = 0, notice = g.notice
  const out: Node[] = [
    h('div', { class: 'line' }, h('div', { class: 'grow' }, safe('b', `<${g.tag}> ${g.name} · nível ${g.level}`),
      h('small', {}, `Bônus de EXP: +${g.level}% · Fundos: ${fmt(g.funds)}${g.next ? ` / ${fmt(g.next)} para o nível ${g.level + 1}` : ' (nível máximo)'} · Seu cargo: ${g.role}`))),
    h('div', { class: 'line' }, h('div', { class: 'grow' }, h('small', {}, 'Mural'), safe('span', g.notice || 'Sem recado.'))),
    h('div', { class: 'line' }, h('input', { type: 'number', min: '1', placeholder: 'Ouro para doar', oninput: (e: Event) => { gold = Number((e.target as HTMLInputElement).value) } }), btn('Doar', () => send({ t: 'guildDonate', gold }))),
  ]
  if (staff) out.push(h('div', { class: 'line' }, h('input', { maxLength: 200, value: g.notice, placeholder: 'Recado do mural', oninput: (e: Event) => { notice = (e.target as HTMLInputElement).value } }), btn('Salvar recado', () => send({ t: 'guildNotice', text: notice }))))
  out.push(h('h4', {}, `Membros (${g.members.length}/${GUILD.maxMembers})`))
  for (const m of g.members) {
    const me = m.name === c.name
    out.push(h('div', { class: 'line' }, h('div', { class: 'grow' }, safe('b', m.name, m.online ? '' : 'muted'), h('small', {}, `${m.role} · ${CLASSES[m.cls]?.name ?? ''} · Nv ${m.level}${m.online ? ' · online' : ''}`)),
      h('div', { class: 'acts' },
        g.role === 'lider' && !me ? btn(m.role === 'oficial' ? 'Tirar cargo' : 'Tornar oficial', () => send({ t: 'guildRole', name: m.name, officer: m.role !== 'oficial' })) : null,
        staff && !me && m.role !== 'lider' && !(g.role === 'oficial' && m.role === 'oficial') ? btn('Remover', () => send({ t: 'guildKick', name: m.name })) : null)))
  }
  out.push(btn('Sair da guilda', () => send({ t: 'guildLeave' })))
  return out
}
function renderMarket(): Node[] {
  const c = state.char!
  const tab = (id: typeof marketTab, label: string) => h('button', { type: 'button', class: marketTab === id ? 'on' : '', onclick: () => { marketTab = id; refreshMarket(); renderPanel() } }, label)
  const out: Node[] = [h('div', { class: 'tabs three' }, tab('comprar', 'Comprar'), tab('vender', 'Vender'), tab('meus', 'Meus anúncios'))]
  if (c.level < MARKET.minLevel) out.push(h('p', { class: 'bad' }, `O mercado libera no nível ${MARKET.minLevel}.`))
  if (marketTab === 'vender') {
    out.push(h('p', { class: 'muted' }, `Defina o preço em ouro. O mercado fica com ${MARKET.tax * 100}% da venda. Limite de ${MARKET.maxListings} anúncios.`))
    if (!c.items.length) out.push(h('p', {}, 'Nenhuma peça na mochila.'))
    for (const it of [...c.items].sort((a, b) => score(b) - score(a))) {
      let price = sellPrice(it) * 5
      out.push(itemLine(it, [
        h('input', { type: 'number', min: '1', value: String(price), style: 'width:90px', oninput: (e: Event) => { price = Number((e.target as HTMLInputElement).value) } }),
        btn('Anunciar', () => { send({ t: 'marketSell', id: it.id, price }); marketTab = 'meus' }, { disabled: c.level < MARKET.minLevel }),
      ]))
    }
    return out
  }
  if (marketTab === 'comprar') {
    out.push(h('div', { class: 'acts left' }, ...(['', ...SLOTS] as (Slot | '')[]).map((s) =>
      h('button', { type: 'button', class: `small${marketSlot === s ? ' primary' : ''}`, onclick: () => { marketSlot = s; refreshMarket() } }, s ? SLOT_NAMES[s] : 'Tudo'))))
  }
  const rows = state.market.mine === (marketTab === 'meus') ? state.market.rows : []
  if (!rows.length) out.push(h('p', { class: 'muted' }, marketTab === 'meus' ? 'Você não tem anúncios.' : 'Nenhum anúncio encontrado.'))
  for (const r of rows) {
    out.push(itemLine(r.item, [h('b', { class: 'loot' }, `${fmt(r.price)} ouro`),
      r.mine ? btn('Cancelar', () => send({ t: 'marketCancel', id: r.id })) : btn('Comprar', () => send({ t: 'marketBuy', id: r.id }), { primary: true, disabled: c.gold < r.price || c.level < MARKET.minLevel })], r.mine ? '' : `Vendedor: ${r.seller}`))
  }
  return out
}
function renderCrystals(): Node[] {
  const c = state.char!, a = state.acct, bal = a?.crystals ?? 0
  const out: Node[] = [h('p', { class: 'muted' }, `Você tem ${fmt(bal)} cristais. Cristais compram só conveniência: nada aqui dá poder de combate que não exista jogando.`)]
  let cls: ClassId = CLASS_IDS.find((x) => x !== c.cls)!
  for (const id of Object.keys(PREMIUM) as PremiumId[]) {
    const p = PREMIUM[id]
    const full = id === 'mochila' && (c.bagExtra ?? 0) >= BAG_EXPANSIONS * 10
    out.push(h('div', { class: 'line' }, h('div', { class: 'grow' }, h('b', {}, `${p.name} · ${p.price} cristais`), h('small', {}, p.desc)),
      h('div', { class: 'acts' },
        id === 'classe' ? h('select', { onchange: (e: Event) => { cls = (e.target as HTMLSelectElement).value as ClassId } }, ...CLASS_IDS.filter((x) => x !== c.cls).map((x) => h('option', { value: x }, CLASSES[x].name))) : null,
        btn(full ? 'Máximo' : 'Usar', () => send({ t: 'premium', what: id, ...(id === 'classe' ? { cls } : {}) }), { disabled: bal < p.price || full }))))
  }
  out.push(h('h4', {}, 'Comprar cristais'))
  if (!a?.payments) out.push(h('p', { class: 'muted' }, 'As compras com dinheiro real ainda não estão habilitadas neste servidor.'))
  for (const p of CRYSTAL_PACKS) {
    out.push(h('div', { class: 'line' }, icon('icones/itens/lasca', p.name), h('div', { class: 'grow' }, h('b', {}, p.name)),
      btn(`R$ ${(p.cents / 100).toFixed(2).replace('.', ',')}`, () => send({ t: 'buyPack', pack: p.id }), { primary: true, disabled: !a?.payments })))
  }
  return out
}
function renderTrade(): Node[] {
  const t = state.trade, c = state.char!
  if (!t) return [h('p', { class: 'muted' }, 'Nenhuma troca em andamento.')]
  const mineIds = new Set(t.mine.items.map((i) => i.id))
  const offer = (ids: string[], gold: number) => send({ t: 'tradeOffer', items: ids, gold })
  const out: Node[] = [h('p', { class: 'muted' }, 'A troca só conclui quando os dois confirmam. Qualquer mudança na oferta desfaz as confirmações.')]
  out.push(h('h4', {}, `${t.theirs.name} oferece${t.theirs.ok ? ' · confirmou' : ''}`))
  out.push(h('div', { class: 'line' }, h('span', { class: 'loot' }, `${fmt(t.theirs.gold)} de ouro`)))
  for (const it of t.theirs.items) out.push(itemLine(it, []))
  out.push(h('h4', {}, `Você oferece${t.mine.ok ? ' · confirmou' : ''}`))
  out.push(h('div', { class: 'line' }, h('span', {}, 'Ouro'),
    h('input', { type: 'number', min: '0', max: String(c.gold), value: String(t.mine.gold), style: 'width:120px', onchange: (e: Event) => offer([...mineIds], Math.max(0, Math.floor(Number((e.target as HTMLInputElement).value)))) })))
  for (const it of t.mine.items) out.push(itemLine(it, [btn('Tirar', () => offer([...mineIds].filter((id) => id !== it.id), t.mine.gold))]))
  out.push(h('div', { class: 'acts left' }, btn(t.mine.ok ? 'Aguardando o outro lado' : 'Confirmar troca', () => send({ t: 'tradeConfirm' }), { primary: true, disabled: t.mine.ok }), btn('Cancelar', () => send({ t: 'tradeCancel' }))))
  out.push(h('h4', {}, 'Sua mochila'))
  for (const it of c.items.filter((i) => !mineIds.has(i.id))) out.push(itemLine(it, [btn('Oferecer', () => offer([...mineIds, it.id], t.mine.gold), { disabled: mineIds.size >= 8 })]))
  return out
}

// ---------- Ligações ----------
const CHANNELS: { id: ChatChannel; label: string }[] = [{ id: 'global', label: 'Geral' }, { id: 'guild', label: 'Guilda' }, { id: 'party', label: 'Grupo' }]
export function initUi() {
  $('panelClose').onclick = closePanel
  $('modalOk').onclick = () => $('modal').classList.add('hidden')
  const sel = $('chatChannel') as HTMLSelectElement
  sel.replaceChildren(...CHANNELS.map((c) => h('option', { value: c.id }, c.label)))
  sel.onchange = () => { channel = sel.value as ChatChannel }
  $('chatForm').addEventListener('submit', (e) => {
    e.preventDefault()
    const input = $('chatInput') as HTMLInputElement
    if (input.value.trim()) send({ t: 'chat', text: input.value, channel })
    input.value = ''; input.blur()
  })
  window.addEventListener('keydown', (e) => {
    const el = document.activeElement
    if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement) { if (e.key === 'Escape') el.blur(); return }
    if ($('hud').classList.contains('hidden') || e.ctrlKey || e.metaKey || e.altKey) return
    if (e.key === 'Escape') return closePanel()
    if (e.key === 'Enter') { e.preventDefault(); return $('chatInput').focus() }
    const id = Object.keys(PANELS).find((k) => PANELS[k].key === e.key.toLowerCase())
    if (id) open === id ? closePanel() : openPanel(id)
  })
}
export function setHint(text: string | null) { const el = $('hint'); el.textContent = text ?? ''; el.classList.toggle('hidden', !text) }

const CHANNEL_TAG: Record<ChatChannel, string> = { global: '', guild: '[Guilda] ', party: '[Grupo] ', whisper: '[Sussurro] ' }
let lastBar = 0
export function handleUi(m: ServerMsg) {
  switch (m.t) {
    case 'char': renderMe(); renderMenu(); renderPanel(); renderRoomBar(); renderSkills(); break
    case 'acct': renderMe(); renderPanel(); break
    case 'room': renderRoomBar(); renderSkills(); renderPanel(); if (m.room.kind !== 'city' && (open === 'loja' || open === 'forja' || open === 'fendas')) closePanel(); break
    case 'snap': if (m.stats && performance.now() - lastBar > 500) { lastBar = performance.now(); renderRoomBar(); renderSkills() } break
    case 'log': addLine($('log'), h('div', { class: m.tone ?? '' }, m.text), 9); break
    case 'err': toast(m.text); break
    case 'chat': {
      const line = h('div', { class: `ch-${m.channel}` }, safe('b', `${CHANNEL_TAG[m.channel]}[${m.rank}] ${m.tag ? `<${m.tag}> ` : ''}${m.from}${m.to ? ` → ${m.to}` : ''}: `))
      line.append(m.text)
      const box = $('chatLines'); box.append(line)
      while (box.children.length > 40) box.firstElementChild!.remove()
      box.scrollTop = box.scrollHeight
      break
    }
    case 'ranking': ranking = m; if (open === 'ranking') renderPanel(); break
    case 'rest': modal('Descanso', `Você ficou fora por ${m.minutes} min. Seu caçador rendeu ${fmt(m.exp)} de EXP e ${fmt(m.gold)} de ouro.`); break
    case 'result': modal(m.title, m.text); break
    case 'invited': showInvite(m.kind, m.from, m.text); break
    case 'party': renderParty(); renderPanel(); break
    case 'trade': if (m.trade) { if (open !== 'troca') openPanel('troca'); else renderPanel() } else if (open === 'troca') { open = null; $('panel').classList.add('hidden') } break
    case 'guild': if (open === 'guilda') renderPanel(); break
    case 'market': if (open === 'mercado') renderPanel(); break
    case 'order': if (m.status === 'pending') modal('Pedido criado', m.text); break
  }
}
