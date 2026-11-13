// Interface em HTML sobre o canvas. Textos vindos de jogadores entram sempre por textContent.
import {
  ATTRS, ATTR_HELP, ATTR_NAMES, AUTO_EXTRACT_LEVEL, CLASSES, ECHO_FUSE_COUNT, ECHO_LIMIT, ECHO_TIERS, ENCHANT_CHANCE, INVENTORY_SIZE,
  MAX_ENCHANT, MAX_LEVEL, MONSTERS, PROMOTIONS, RARITY_INFO, RIFTS, SHOP, SLOTS, SLOT_NAMES, echoFuseCost, echoStats, enchantCost,
  expToNext, itemName, itemStat, rankOf, sellPrice, type Item, type ShopId,
} from '../../shared/content.ts'
import type { ServerMsg } from '../../shared/protocol.ts'
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

const PANELS: Record<string, { title: string; key?: string; icon: string; render: () => Node[] }> = {
  status: { title: 'Status', key: 'c', icon: 'icones/menu/status', render: renderStatus },
  mochila: { title: 'Mochila', key: 'i', icon: 'icones/menu/mochila', render: renderBag },
  ecos: { title: 'Ecos', key: 'h', icon: 'icones/menu/ecos', render: renderEchoes },
  fendas: { title: 'Fendas', key: 'm', icon: 'icones/menu/fendas', render: renderRifts },
  forja: { title: 'Forja', icon: 'icones/menu/status', render: renderForge },
  loja: { title: 'Loja', icon: 'icones/menu/status', render: renderShop },
  ranking: { title: 'Ranking', icon: 'icones/menu/status', render: renderRanking },
}
let open: string | null = null
let rankingRows: Extract<ServerMsg, { t: 'ranking' }>['rows'] = []
let seenItems = 0

export function openPanel(id: string) {
  if (!PANELS[id]) return
  open = id
  if (id === 'ranking') send({ t: 'ranking' })
  if (id === 'mochila') seenItems = state.char?.nextId ?? 0
  $('panel').classList.remove('hidden')
  renderPanel(); renderMenu()
}
export function closePanel() { open = null; $('panel').classList.add('hidden') }
function renderPanel() {
  if (!open || !state.char) return
  const body = $('panelBody'), top = body.scrollTop
  $('panelTitle').textContent = PANELS[open].title
  body.replaceChildren(...PANELS[open].render())
  body.scrollTop = top
}

// ---------- HUD ----------
function renderMe() {
  const c = state.char, d = state.derived
  if (!c || !d) return
  const need = expToNext(c.level), capped = c.level >= rankOf(c).levelCap
  const pct = c.level >= MAX_LEVEL ? 100 : Math.min(100, (c.exp / need) * 100)
  const name = h('b'); name.textContent = c.name
  $('me').replaceChildren(
    h('div', { class: 'row' }, h('span', {}, h('span', { class: 'rank' }, rankOf(c).id), ' ', name), h('span', {}, `Nv ${c.level}`)),
    h('div', { class: 'bar', title: 'Experiência' }, Object.assign(h('i'), { style: `width:${pct}%` })),
    h('div', { class: 'row muted' },
      h('span', {}, c.level >= MAX_LEVEL ? 'Nível máximo' : capped ? 'Limite do rank: faça a promoção' : `EXP ${fmt(c.exp)} / ${fmt(need)}`),
      h('span', {}, CLASSES[c.cls].name)),
    h('div', { class: 'row' }, h('span', { class: 'loot' }, `Ouro ${fmt(c.gold)}`), h('span', {}, `Poder ${fmt(d.power)}`)),
    h('div', { class: 'row muted' }, h('span', {}, `Poções ${c.pocao}`), h('span', {}, `Fragmentos ${c.fragmento}`), h('span', {}, `Lascas ${c.lasca}`)),
  )
}
function renderRoomBar() {
  const r = state.room, s = state.stats, c = state.char
  if (!r || !c) return
  const kids: Child[] = [h('b', {}, r.title)]
  if (r.kind === 'city') {
    kids.push(h('span', { class: 'muted' }, 'WASD ou toque para andar · E fala com NPC'))
  } else {
    if (s) {
      const min = Math.max(s.seconds / 60, 1 / 60)
      if (r.kind === 'hunt') kids.push(h('span', { class: 'muted' }, `Abates ${s.kills} · ${fmt(s.exp / min)} EXP/min · ${fmt(s.gold / min)} ouro/min · chefe em ${s.toBoss}`))
      else kids.push(h('span', { class: 'bad' }, `Tempo restante: ${Math.ceil(s.timeLeft ?? 0)}s`))
    }
    if (r.kind === 'hunt') {
      kids.push(btn('Evocar eco (E)', () => send({ t: 'extract' })))
      const auto = h('label', { title: `Libera no nível ${AUTO_EXTRACT_LEVEL}` },
        h('input', { type: 'checkbox', checked: c.autoExtract, disabled: c.level < AUTO_EXTRACT_LEVEL, style: 'width:auto', onchange: (e: Event) => send({ t: 'setAuto', extract: (e.target as HTMLInputElement).checked }) }), ' Auto')
      kids.push(auto)
    }
    kids.push(btn(r.kind === 'hunt' ? 'Voltar à cidade' : 'Desistir', () => send({ t: 'leave' })))
  }
  $('roomBar').replaceChildren(...kids.filter((k): k is Node | string => !!k))
}
function renderMenu() {
  const c = state.char
  $('menu').replaceChildren(...['status', 'mochila', 'ecos', 'fendas'].map((id) => {
    const p = PANELS[id]
    const b = h('button', { type: 'button', onclick: () => (open === id ? closePanel() : openPanel(id)), title: p.key ? `Tecla ${p.key.toUpperCase()}` : '' }, icon(p.icon, p.title), p.title)
    const alert = (id === 'status' && c && (c.points > 0 || (c.level >= rankOf(c).levelCap && !!PROMOTIONS[c.rank]))) || (id === 'mochila' && c && c.nextId > seenItems && c.items.length > 0 && open !== 'mochila' && seenItems > 0)
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

// ---------- Painéis ----------
function renderStatus(): Node[] {
  const c = state.char!, d = state.derived!
  const out: Node[] = []
  const promo = PROMOTIONS[c.rank], rank = rankOf(c)
  out.push(h('div', { class: 'line' },
    h('div', { class: 'grow' }, h('b', {}, `${rank.name} · limite de nível ${rank.levelCap}`),
      h('small', {}, promo ? `Teste de promoção no nível ${rank.levelCap}: luta solo contra ${MONSTERS[promo.boss].name}, sem ecos, em ${promo.seconds}s.` : 'Rank mais alto desta versão.')),
    promo ? btn('Iniciar teste', () => { send({ t: 'promotion' }); closePanel() }, { primary: true, disabled: c.level < rank.levelCap || state.room?.kind !== 'city', title: 'Disponível na cidade, ao atingir o limite de nível' }) : null))
  out.push(h('h4', {}, `Atributos · ${c.points} ponto(s) livre(s)`))
  for (const a of ATTRS) {
    const bonus = d.attrs[a] - c.attrs[a]
    out.push(h('div', { class: 'line' }, icon(`icones/atributos/${a}`, ATTR_NAMES[a]),
      h('div', { class: 'grow' }, h('b', {}, `${ATTR_NAMES[a]} ${c.attrs[a]}${bonus ? ` (+${bonus})` : ''}`), h('small', {}, ATTR_HELP[a])),
      h('div', { class: 'acts' }, btn('+1', () => send({ t: 'attr', attr: a, n: 1 }), { disabled: c.points < 1 }), btn('+5', () => send({ t: 'attr', attr: a, n: 5 }), { disabled: c.points < 5 }))))
  }
  out.push(h('h4', {}, 'Combate'))
  out.push(h('div', { class: 'grid2' },
    ...[['Vida', fmt(d.maxHp)], ['Ataque', fmt(d.atk)], ['Defesa', fmt(d.def)], ['Crítico', `${(d.crit * 100).toFixed(1)}%`], ['Ataques/s', d.atkPerSec.toFixed(2)], ['Alcance', String(d.range)]]
      .map(([k, v]) => h('div', { class: 'line' }, h('span', { class: 'muted' }, k), h('b', {}, v)))))
  out.push(h('h4', {}, 'Equipamento'))
  for (const slot of SLOTS) {
    const it = c.equipped[slot]
    out.push(it ? itemLine(it, [btn('Tirar', () => send({ t: 'unequip', slot }))]) : h('div', { class: 'line' }, h('span', { class: 'muted' }, `${SLOT_NAMES[slot]}: vazio`)))
  }
  return out
}
function itemIcon(it: Item) { return icon(it.slot === 'arma' ? `icones/itens/arma-${it.cls}` : `icones/itens/${it.slot}`, SLOT_NAMES[it.slot]) }
function itemLine(it: Item, acts: Node[]): HTMLElement {
  const stats = [it.atk && `Atq ${itemStat(it, 'atk')}`, it.def && `Def ${itemStat(it, 'def')}`, it.hp && `Vida ${itemStat(it, 'hp')}`,
    ...ATTRS.map((a) => it.attrs?.[a] && `${ATTR_NAMES[a]} +${it.attrs[a]}`)].filter(Boolean).join(' · ')
  const name = h('b', { style: `color:${RARITY_INFO[it.rarity].color}` }, itemName(it))
  return h('div', { class: 'line' }, itemIcon(it),
    h('div', { class: 'grow' }, name, h('small', {}, `Nv ${it.level}${it.cls ? ` · ${CLASSES[it.cls].name}` : ''} · ${stats}`)),
    h('div', { class: 'acts' }, ...acts))
}
const score = (it?: Item) => (it ? itemStat(it, 'atk') * 3 + itemStat(it, 'def') * 2 + itemStat(it, 'hp') * 0.3 : 0)
function renderBag(): Node[] {
  const c = state.char!
  const out: Node[] = [h('div', { class: 'line' },
    h('span', {}, `${c.items.length} / ${INVENTORY_SIZE} peças. Com a mochila cheia, novos drops são vendidos na hora.`),
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
    `Em campo: ${c.team.length} / ${rank.echoSlots} (aumenta com o rank). Exército: ${c.echoes.length} / ${ECHO_LIMIT}.`)]
  if (!c.echoes.length) out.push(h('p', {}, 'Você ainda não evocou nenhum eco.'))
  const groups = new Map<string, typeof c.echoes>()
  for (const e of c.echoes) { const k = `${e.species}|${e.tier}`; groups.set(k, [...(groups.get(k) ?? []), e]) }
  const sorted = [...groups.values()].sort((a, b) => b[0].tier - a[0].tier || a[0].species.localeCompare(b[0].species))
  for (const g of sorted) {
    const e = g[0], st = echoStats(e, c.level), inTeam = g.filter((x) => c.team.includes(x.id))
    const canFuse = g.length >= ECHO_FUSE_COUNT && e.tier < ECHO_TIERS.length - 1
    const allowed = e.tier + 1 <= rank.maxEchoTier
    const free = g.find((x) => !c.team.includes(x.id))
    out.push(h('div', { class: 'line' }, icon('icones/menu/ecos', MONSTERS[e.species]?.name ?? 'Eco'),
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
function renderRifts(): Node[] {
  const c = state.char!
  const out: Node[] = [h('p', { class: 'muted' }, 'O caçador luta sozinho na fenda. A cada 40 abates surge o chefe. Se você sair do jogo depois de 3 minutos de caçada, o descanso rende EXP e ouro por até 8 horas.')]
  for (const r of RIFTS) {
    out.push(h('h4', {}, `${r.name} · nível ${r.minLevel}+`))
    r.bands.forEach((b, i) => out.push(h('div', { class: 'line' },
      h('div', { class: 'grow' }, h('b', {}, `Nível ${b.min}–${b.max} · ${MONSTERS[b.monster].name}`), h('small', {}, `Chefe: ${MONSTERS[b.boss].name}`)),
      btn(c.level >= b.min ? 'Entrar' : `Nível ${b.min}`, () => { send({ t: 'enterHunt', rift: r.id, band: i }); closePanel() }, { disabled: c.level < b.min, primary: c.level >= b.min && c.level <= b.max }))))
  }
  return out
}
function renderForge(): Node[] {
  const c = state.char!
  const out: Node[] = [h('p', { class: 'muted' }, `Cada aprimoramento soma 6% aos valores da peça, até +${MAX_ENCHANT}. Até +4 nunca falha. Falhar gasta os materiais, mas a peça não piora. Você tem ${c.lasca} Lasca(s) de Fenda.`)]
  if (state.room?.kind !== 'city') out.push(h('p', { class: 'bad' }, 'A forja só atende na cidade.'))
  const all = [...SLOTS.map((s) => c.equipped[s]).filter((i): i is Item => !!i), ...c.items.filter((i) => i.rarity !== 'comum')]
  if (!all.length) out.push(h('p', {}, 'Nenhuma peça para aprimorar.'))
  for (const it of all) {
    const cost = enchantCost(it), max = it.enchant >= MAX_ENCHANT
    out.push(itemLine(it, [max ? h('span', { class: 'muted' }, 'Máximo') :
      btn(`+${it.enchant + 1} · ${Math.round(ENCHANT_CHANCE[it.enchant] * 100)}% · ${fmt(cost.gold)} ouro, ${cost.shards} lasca(s)`, () => send({ t: 'enchant', id: it.id }),
        { disabled: state.room?.kind !== 'city' || c.gold < cost.gold || c.lasca < cost.shards })]))
  }
  return out
}
function renderShop(): Node[] {
  const c = state.char!, inCity = state.room?.kind === 'city'
  const out: Node[] = inCity ? [] : [h('p', { class: 'bad' }, 'A loja só atende na cidade.')]
  for (const id of Object.keys(SHOP) as ShopId[]) {
    const s = SHOP[id]
    out.push(h('div', { class: 'line' }, icon(`icones/itens/${id}`, s.name),
      h('div', { class: 'grow' }, h('b', {}, `${s.name} · ${s.price} ouro`), h('small', {}, `${s.desc} Você tem ${c[id]}.`)),
      h('div', { class: 'acts' }, ...[1, 10, 50].map((n) => btn(`×${n}`, () => send({ t: 'buy', what: id, n }), { disabled: !inCity || c.gold < s.price * n })))))
  }
  return out
}
function renderRanking(): Node[] {
  if (!rankingRows.length) return [h('p', { class: 'muted' }, 'Carregando…')]
  return rankingRows.map((r, i) => {
    const name = h('b'); name.textContent = r.name
    return h('div', { class: 'line' }, h('span', { class: 'muted' }, `${i + 1}º`), h('div', { class: 'grow' }, h('span', { class: 'rank' }, r.rank), ' ', name), h('span', {}, `${CLASSES[r.cls]?.name ?? ''} · Nv ${r.level}`))
  })
}

// ---------- Ligações ----------
export function initUi() {
  $('panelClose').onclick = closePanel
  $('modalOk').onclick = () => $('modal').classList.add('hidden')
  $('chatForm').addEventListener('submit', (e) => {
    e.preventDefault()
    const input = $('chatInput') as HTMLInputElement
    if (input.value.trim()) send({ t: 'chat', text: input.value })
    input.value = ''; input.blur()
  })
  window.addEventListener('keydown', (e) => {
    const el = document.activeElement
    if (el instanceof HTMLInputElement) { if (e.key === 'Escape') el.blur(); return }
    if ($('hud').classList.contains('hidden') || e.ctrlKey || e.metaKey || e.altKey) return
    if (e.key === 'Escape') return closePanel()
    if (e.key === 'Enter') { e.preventDefault(); return $('chatInput').focus() }
    const id = Object.keys(PANELS).find((k) => PANELS[k].key === e.key.toLowerCase())
    if (id) open === id ? closePanel() : openPanel(id)
  })
}
export function setHint(text: string | null) { const el = $('hint'); el.textContent = text ?? ''; el.classList.toggle('hidden', !text) }

let lastBar = 0
export function handleUi(m: ServerMsg) {
  switch (m.t) {
    case 'char': renderMe(); renderMenu(); renderPanel(); renderRoomBar(); break
    case 'room': renderRoomBar(); renderPanel(); if (m.room.kind !== 'city' && (open === 'loja' || open === 'forja' || open === 'fendas')) closePanel(); break
    case 'snap': if (m.stats && performance.now() - lastBar > 500) { lastBar = performance.now(); renderRoomBar() } break
    case 'log': addLine($('log'), h('div', { class: m.tone ?? '' }, m.text), 9); break
    case 'err': toast(m.text); break
    case 'chat': {
      const who = h('b'); who.textContent = `[${m.rank}] ${m.from}: `
      const line = h('div', {}, who); line.append(m.text)
      const box = $('chatLines'); box.append(line)
      while (box.children.length > 40) box.firstElementChild!.remove()
      box.scrollTop = box.scrollHeight
      break
    }
    case 'ranking': rankingRows = m.rows; if (open === 'ranking') renderPanel(); break
    case 'rest': modal('Descanso', `Você ficou fora por ${m.minutes} min. Seu caçador rendeu ${fmt(m.exp)} de EXP e ${fmt(m.gold)} de ouro.`); break
    case 'result': modal(m.title, m.text); break
  }
}
