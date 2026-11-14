import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { WebSocket } from 'ws'
import { ASSETS } from '../shared/assets.ts'
import {
  CLASS_IDS, GUILD, MAX_LEVEL, MONSTERS, PROMOTIONS, RANKS, RIFTS, SKILLS, TALENTS, addExp, derive, expToNext, monsterStats, newCharacter, rollItem,
  talentPoints, type Character,
} from '../shared/content.ts'
import type { ClientMsg, ServerMsg } from '../shared/protocol.ts'
import { Hunt } from '../server/src/hunt.ts'
import { startServer } from '../server/src/index.ts'
import { memoryMailer } from '../server/src/mail.ts'
import { filterChat } from '../server/src/moderation.ts'
import { devProvider } from '../server/src/payments.ts'

const seeded = (seed: number) => () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296 }

describe('conteúdo', () => {
  it('toda fenda, promoção e fallback aponta para monstros que existem', () => {
    for (const r of RIFTS) for (const b of r.bands) { expect(MONSTERS[b.monster]).toBeTruthy(); expect(MONSTERS[b.boss]?.boss).toBe(true) }
    for (const p of PROMOTIONS) expect(MONSTERS[p.boss]).toBeTruthy()
    for (const m of Object.values(MONSTERS)) if (m.fallback) expect(MONSTERS[m.fallback]).toBeTruthy()
    expect(PROMOTIONS.length).toBe(RANKS.length - 1)
  })
  it('as faixas cobrem do nível 1 ao máximo sem buracos', () => {
    const bands = RIFTS.flatMap((r) => r.bands)
    expect(bands[0].min).toBe(1)
    for (let i = 1; i < bands.length; i++) expect(bands[i].min).toBe(bands[i - 1].max + 1)
    expect(bands.at(-1)!.max).toBe(MAX_LEVEL)
  })
  it('todo monstro e toda classe tem asset no manifesto, sem caminhos repetidos', () => {
    const ids = new Set(ASSETS.map((a) => a.id))
    for (const id of Object.keys(MONSTERS)) expect(ids.has(`monstros/${id}`), id).toBe(true)
    for (const id of CLASS_IDS) { expect(ids.has(`cacadores/${id}`)).toBe(true); expect(ids.has(`icones/itens/arma-${id}`)).toBe(true) }
    for (const r of RIFTS) expect(ids.has(`mapas/${r.id}`), r.id).toBe(true)
    expect(new Set(ASSETS.map((a) => a.path)).size).toBe(ASSETS.length)
  })
  it('a EXP exigida e a força dos monstros crescem com o nível', () => {
    for (let l = 1; l < MAX_LEVEL; l++) {
      expect(expToNext(l + 1)).toBeGreaterThan(expToNext(l))
      expect(monsterStats(l + 1).maxHp).toBeGreaterThan(monsterStats(l).maxHp)
    }
  })
  it('a EXP respeita o limite de nível do rank e é liberada na promoção', () => {
    const c = newCharacter('Teste', 'lamina')
    addExp(c, 1e9)
    expect(c.level).toBe(RANKS[0].levelCap)
    expect(c.points).toBe((RANKS[0].levelCap - 1) * 4)
    c.rank = 1
    addExp(c, 0)
    expect(c.level).toBe(RANKS[1].levelCap)
  })
  it('equipamento aumenta os atributos derivados', () => {
    const c = newCharacter('Teste', 'lamina'), before = derive(c)
    const rng = seeded(3)
    let item = rollItem(5, rng, 'x', 'raro')
    while (item.slot !== 'armadura') item = rollItem(5, rng, 'x', 'raro')
    c.equipped.armadura = item
    expect(derive(c).def).toBeGreaterThan(before.def)
    expect(derive(c).maxHp).toBeGreaterThan(before.maxHp)
  })
})

describe('caçada', () => {
  it.each(CLASS_IDS)('um caçador %s de nível 1 abate monstros e ganha EXP na primeira faixa', (cls) => {
    const c = newCharacter('Teste', cls), b = RIFTS[0].bands[0]
    const h = new Hunt(c, { mode: 'hunt', monster: b.monster, boss: b.boss, minLevel: b.min, maxLevel: b.max, rng: seeded(11) })
    for (let i = 0; i < 1800 && !h.ended; i++) h.tick(0.1)
    expect(h.ended).toBeNull()
    expect(h.stats.kills).toBeGreaterThan(10)
    expect(c.level).toBeGreaterThan(1)
    expect(c.gold).toBeGreaterThan(100)
  })
  it('a evocação gasta fragmento e pode criar um eco que entra no time', () => {
    const c = newCharacter('Teste', 'lamina'), b = RIFTS[0].bands[0]
    c.fragmento = 500
    const h = new Hunt(c, { mode: 'hunt', monster: b.monster, boss: b.boss, minLevel: b.min, maxLevel: b.max, rng: seeded(5) })
    for (let i = 0; i < 6000 && c.echoes.length === 0; i++) { h.tick(0.1); h.extract(true) }
    expect(c.echoes.length).toBe(1)
    expect(c.team).toEqual([c.echoes[0].id])
    expect(c.fragmento).toBeLessThan(500)
  })
  it('o teste de promoção termina em vitória, derrota ou tempo esgotado', () => {
    const c = newCharacter('Teste', 'lamina'), p = PROMOTIONS[0]
    const h = new Hunt(c, { mode: 'promotion', monster: p.boss, boss: p.boss, minLevel: p.level, maxLevel: p.level, seconds: p.seconds, rng: seeded(2) })
    for (let i = 0; i < 3000 && !h.ended; i++) h.tick(0.1)
    expect(h.ended).toBe('died') // nível 1 contra o chefe do rank D
    expect(h.echoes.length).toBe(0)
  })
})


describe('talentos, habilidades, grupo e arena', () => {
  it('talentos aumentam os atributos derivados e os pontos vêm do nível', () => {
    const c = newCharacter('Teste', 'lamina'); c.level = 10
    expect(talentPoints(c)).toEqual({ total: 9, spent: 0, free: 9 })
    const before = derive(c)
    c.talents = { fio: 5, folego: 3 }
    expect(derive(c).atk).toBeGreaterThan(before.atk)
    expect(derive(c).maxHp).toBeGreaterThan(before.maxHp)
    expect(talentPoints(c).free).toBe(1)
    expect(new Set(TALENTS.map((t) => t.id)).size).toBe(TALENTS.length)
  })
  it('o caçador usa as habilidades liberadas pelo nível', () => {
    const c = newCharacter('Teste', 'arcanista'); c.level = 12; c.pocao = 999
    const b = RIFTS[0].bands[2]
    const h = new Hunt(c, { mode: 'hunt', monster: b.monster, boss: b.boss, minLevel: b.min, maxLevel: b.max, rng: seeded(4) })
    const used = new Set<string>()
    for (let i = 0; i < 1200 && !h.ended; i++) { h.tick(0.1); for (const f of h.takeFx()) if (f.f === 'skill') used.add(f.name) }
    expect(used.has(SKILLS.arcanista[0].name)).toBe(true)
    expect(used.has(SKILLS.arcanista[1].name)).toBe(true)
    expect(used.has(SKILLS.arcanista[2].name)).toBe(false) // nível 20
  })
  it('em grupo, todos recebem EXP e ouro e a queda de um não encerra a caçada', () => {
    const a = newCharacter('A', 'lamina'), b2 = newCharacter('B', 'arcanista'), band = RIFTS[0].bands[0]
    const h = new Hunt([{ c: a, key: 1 }, { c: b2, key: 2 }], { mode: 'hunt', monster: band.monster, boss: band.boss, minLevel: band.min, maxLevel: band.max, rng: seeded(9) })
    expect(h.mobs.length).toBe(17)
    for (let i = 0; i < 900 && !h.ended; i++) h.tick(0.1)
    expect(h.kills).toBeGreaterThan(5)
    expect(a.kills).toBe(h.kills); expect(b2.kills).toBe(h.kills)
    expect(h.statsFor(h.members[0]).exp).toBeGreaterThan(0); expect(h.statsFor(h.members[1]).exp).toBeGreaterThan(0)
    expect(h.snapshot(2).filter((e) => e.k === 'p').length).toBe(2)
    expect(h.snapshot(2).find((e) => e.me)?.n).toBe('B')
  })
  it('o duelo termina com um vencedor e não gasta poções', () => {
    const strong = newCharacter('Forte', 'lamina'); strong.level = 30; strong.attrs.for = 80; strong.attrs.vit = 60
    const weak = newCharacter('Fraco', 'vulto'); weak.level = 10
    const h = new Hunt([{ c: strong, key: 1 }, { c: weak, key: 2 }], { mode: 'duel', monster: '', boss: '', minLevel: 1, maxLevel: 1, seconds: 90, rng: seeded(3) })
    for (let i = 0; i < 1000 && !h.ended; i++) h.tick(0.1)
    expect(h.ended).not.toBeNull()
    expect(h.winner).toBe(0)
    expect(strong.pocao).toBe(30); expect(weak.pocao).toBe(30)
    expect(h.mobs.length).toBe(0)
  })
  it('o filtro do chat mascara ofensas e links sem estragar palavras comuns', () => {
    expect(filterChat('bom dia, computador').masked).toBe(false)
    expect(filterChat('seu M3RD4').text).toBe('seu *****')
    expect(filterChat('entra em www.golpe.com').text).toContain('[link removido]')
  })
})

describe('servidor', () => {
  const mailer = memoryMailer()
  let srv: Awaited<ReturnType<typeof startServer>>
  let base = ''
  beforeAll(async () => { srv = await startServer({ port: 0, database: ':memory:', mailer, payments: devProvider, publicUrl: 'http://jogo.test', authPerMinute: 1000 }); base = `http://localhost:${srv.port}` }, 60000)
  afterAll(async () => { await srv.stop() })

  const post = async (path: string, body: unknown) => {
    const r = await fetch(`${base}/api/${path}`, { method: 'POST', body: JSON.stringify(body) })
    return { status: r.status, body: (await r.json()) as { token?: string; error?: string } }
  }
  function client(token: string) {
    const ws = new WebSocket(`ws://localhost:${srv.port}/ws`)
    const got: ServerMsg[] = []
    let waiters: (() => void)[] = []
    ws.on('message', (d) => { got.push(JSON.parse(d.toString())); waiters.forEach((w) => w()) })
    ws.on('open', () => ws.send(JSON.stringify({ t: 'auth', token })))
    const waitFor = <T extends ServerMsg['t']>(t: T, pred: (m: Extract<ServerMsg, { t: T }>) => boolean = () => true, ms = 20000) =>
      new Promise<Extract<ServerMsg, { t: T }>>((ok, fail) => {
        const check = () => {
          const i = got.findIndex((m) => m.t === t && pred(m as never))
          if (i < 0) return false
          const [m] = got.splice(i, 1); waiters = waiters.filter((w) => w !== check); clearTimeout(timer); ok(m as never); return true
        }
        const timer = setTimeout(() => { waiters = waiters.filter((w) => w !== check); fail(new Error(`esperando ${t}`)) }, ms)
        if (!check()) waiters.push(check)
      })
    return { ws, send: (m: ClientMsg) => ws.send(JSON.stringify(m)), waitFor, flush: () => { got.length = 0 } }
  }
  /** Cria conta e caçador e devolve o cliente já na cidade. */
  async function player(user: string, name: string, cls: 'lamina' | 'vulto' | 'arcanista' | 'atirador' = 'lamina', email?: string) {
    const token = (await post('register', { user, pass: 'senha-forte-1', email })).body.token!
    const c = client(token)
    await c.waitFor('needChar')
    c.send({ t: 'createChar', name, cls })
    await c.waitFor('room')
    const sess = [...srv.world.sessions.values()].find((s) => s.char?.name === name)!
    return { ...c, token, sess, char: sess.char as Character }
  }

  it('valida cadastro e login', async () => {
    expect((await post('register', { user: 'a', pass: '12345678' })).status).toBe(400)
    expect((await post('register', { user: 'ana_1', pass: 'curta' })).status).toBe(400)
    expect((await post('register', { user: 'ana_1', pass: 'senha-forte-1', email: 'nao-e-email' })).status).toBe(400)
    expect((await post('register', { user: 'ana_1', pass: 'senha-forte-1', email: 'ana@exemplo.test' })).body.token).toBeTruthy()
    expect((await post('register', { user: 'ANA_1', pass: 'senha-forte-1' })).status).toBe(409)
    expect((await post('register', { user: 'ana_2', pass: 'senha-forte-1', email: 'ANA@exemplo.test' })).body.error).toMatch(/e-mail/)
    expect((await post('login', { user: 'ana_1', pass: 'errada-errada' })).status).toBe(401)
    expect((await post('login', { user: 'ana_1', pass: 'senha-forte-1' })).body.token).toBeTruthy()
  })
  it('recusa WebSocket sem sessão válida', async () => {
    const c = client('token-invalido')
    expect((await c.waitFor('kicked')).text).toMatch(/Sessão expirada/)
  })
  it('recupera a senha por e-mail, uma única vez, e encerra as sessões antigas', async () => {
    const old = (await post('register', { user: 'rita', pass: 'senha-antiga-1', email: 'rita@exemplo.test' })).body.token!
    expect((await post('forgot', { user: 'ninguem' })).status).toBe(200) // mesma resposta para conta inexistente
    expect(mailer.sent.length).toBe(0)
    expect((await post('forgot', { user: 'RITA@exemplo.test' })).status).toBe(200)
    await new Promise((r) => setTimeout(r, 50))
    expect(mailer.sent.length).toBe(1)
    expect(mailer.sent[0].to).toBe('rita@exemplo.test')
    const token = /http:\/\/jogo\.test\/\?reset=([0-9a-f]{64})/.exec(mailer.sent[0].text)![1]
    expect((await post('reset', { token: 'x'.repeat(64), pass: 'senha-nova-22' })).status).toBe(400)
    expect((await post('reset', { token, pass: 'curta' })).status).toBe(400)
    expect((await post('reset', { token, pass: 'senha-nova-22' })).status).toBe(200)
    expect((await post('reset', { token, pass: 'outra-senha-33' })).status).toBe(400) // o link só vale uma vez
    expect((await post('login', { user: 'rita', pass: 'senha-antiga-1' })).status).toBe(401)
    expect((await post('login', { user: 'rita', pass: 'senha-nova-22' })).status).toBe(200)
    expect((await client(old).waitFor('kicked')).text).toMatch(/Sessão expirada/)
  })

  it('joga do começo: cria caçador, anda na cidade, conversa, caça e compra', async () => {
    const token = (await post('register', { user: 'bruno', pass: 'senha-forte-2' })).body.token!
    const a = client(token)
    await a.waitFor('needChar')
    a.send({ t: 'createChar', name: 'x', cls: 'lamina' })
    expect((await a.waitFor('err')).text).toMatch(/Nome inválido/)
    a.send({ t: 'createChar', name: 'Bruno', cls: 'vulto' })
    const first = await a.waitFor('char')
    expect(first.c.name).toBe('Bruno'); expect(first.c.level).toBe(1)
    expect((await a.waitFor('room')).room.kind).toBe('city')

    const s0 = await a.waitFor('snap')
    const me0 = s0.ents.find((e) => e.me)!
    a.send({ t: 'move', dx: 50, dy: 0 }) // vetor exagerado: o servidor normaliza
    const s1 = await a.waitFor('snap', (m) => (m.ents.find((e) => e.me)?.x ?? 0) > me0.x + 30)
    expect(s1.ents.find((e) => e.me)!.x - me0.x).toBeLessThan(400)
    a.send({ t: 'move', dx: 0, dy: 0 })

    const token2 = (await post('register', { user: 'carla', pass: 'senha-forte-3' })).body.token!
    const b = client(token2)
    await b.waitFor('needChar')
    b.send({ t: 'createChar', name: 'Bruno', cls: 'lamina' })
    expect((await b.waitFor('err')).text).toMatch(/já está em uso/)
    b.send({ t: 'createChar', name: 'Carla', cls: 'arcanista' })
    await b.waitFor('room')
    await b.waitFor('snap', (m) => m.ents.some((e) => e.n === 'Bruno') && m.ents.some((e) => e.n === 'Carla'))
    a.send({ t: 'chat', text: '  <b>oi</b>  ' })
    expect((await b.waitFor('chat')).text).toBe('<b>oi</b>') // texto cru: o cliente exibe com textContent

    a.send({ t: 'enterHunt', rift: 'forja-extinta', band: 0 })
    expect((await a.waitFor('err')).text).toMatch(/Exige nível 46/)
    a.send({ t: 'buy', what: 'pocao', n: 5 })
    const afterBuy = await a.waitFor('char', (m) => m.c.pocao === first.c.pocao + 5)
    expect(afterBuy.c.gold).toBe(first.c.gold - 60)
    a.send({ t: 'buy', what: 'pocao', n: 999 })
    expect((await a.waitFor('err')).text).toMatch(/Ouro insuficiente/)
    a.send({ t: 'attr', attr: 'for', n: 3 }) // sem pontos: ignorado
    a.send({ t: 'talent', id: 'fio' })
    expect((await a.waitFor('err')).text).toMatch(/Sem pontos de talento/)

    a.send({ t: 'enterHunt', rift: 'minas-ocas', band: 0 })
    expect((await a.waitFor('room')).room.kind).toBe('hunt')
    const hunt = await a.waitFor('snap', (m) => (m.stats?.kills ?? 0) >= 1, 40000)
    expect(hunt.ents.some((e) => e.k === 'm')).toBe(true)
    expect(hunt.cds?.length).toBe(3)
    const paid = await a.waitFor('char', (m) => m.c.kills >= 1)
    expect(paid.c.gold).toBeGreaterThan(afterBuy.c.gold)
    expect(paid.c.attrs.for).toBe(first.c.attrs.for)
    a.send({ t: 'leave' })
    expect((await a.waitFor('room')).room.kind).toBe('city')

    const a2 = client(token)
    expect((await a.waitFor('kicked')).text).toMatch(/outro lugar/)
    const again = await a2.waitFor('char')
    expect(again.c.kills).toBeGreaterThanOrEqual(1)
    a2.send({ t: 'ranking' })
    expect((await a2.waitFor('ranking')).rows.map((r) => r.name)).toContain('Carla')
    a2.ws.close(); b.ws.close()
  }, 90000)

  it('modera o chat: filtro, repetição, sussurro, denúncia e comandos de moderador', async () => {
    const a = await player('mod_a', 'Dante'), b = await player('mod_b', 'Elisa'), c = await player('mod_c', 'Fabio')
    a.send({ t: 'chat', text: 'isso é uma merda, veja www.site.com' })
    const m = await b.waitFor('chat', (x) => x.from === 'Dante')
    expect(m.text).toBe('isso é uma *****, veja [link removido]')
    await new Promise((r) => setTimeout(r, 1600))
    a.send({ t: 'chat', text: 'segredo', channel: 'whisper', to: 'Elisa' })
    expect((await b.waitFor('chat', (x) => x.channel === 'whisper')).text).toBe('segredo')
    c.send({ t: 'chat', text: 'alguém aí?' })
    const seen = await c.waitFor('chat', (x) => x.from === 'Fabio')
    expect(seen.channel).toBe('global') // o Fabio não recebeu o sussurro
    b.send({ t: 'report', name: 'Dante', reason: 'ofensa' })
    await b.waitFor('log', (x) => /Denúncia/.test(x.text))
    const rep = await srv.db.q<{ target_name: string; context: unknown }>('select target_name, context from chat_reports')
    expect(rep[0].target_name).toBe('Dante')
    // jogador comum não usa comando de moderação
    b.send({ t: 'chat', text: '/mute Dante 5' })
    expect((await b.waitFor('err')).text).toMatch(/Comando desconhecido/)
    c.sess.account.role = 'mod'
    c.send({ t: 'chat', text: '/mute Dante 5' })
    await a.waitFor('log', (x) => /silenciado por 5 min/.test(x.text))
    a.send({ t: 'chat', text: 'ainda posso falar?' })
    expect((await a.waitFor('err')).text).toMatch(/silenciado/)
    c.send({ t: 'chat', text: '/ban Dante' }) // banir é só de administrador
    expect((await c.waitFor('err')).text).toMatch(/Comando desconhecido/)
    for (const x of [a, b, c]) x.ws.close()
  }, 60000)

  it('grupo: convite, caçada conjunta e saída', async () => {
    const a = await player('grp_a', 'Gil'), b = await player('grp_b', 'Hana', 'arcanista')
    a.send({ t: 'invite', kind: 'party', name: 'Hana' })
    expect((await b.waitFor('invited')).kind).toBe('party')
    b.send({ t: 'accept', kind: 'party', from: 'Gil' })
    const p = await a.waitFor('party', (x) => x.party?.members.length === 2)
    expect(p.party!.leader).toBe('Gil')
    b.send({ t: 'enterHunt', rift: 'minas-ocas', band: 0 })
    expect((await b.waitFor('err')).text).toMatch(/Só o líder/)
    a.send({ t: 'enterHunt', rift: 'minas-ocas', band: 0 })
    expect((await a.waitFor('room')).room.title).toMatch(/grupo de 2/)
    expect((await b.waitFor('room')).room.kind).toBe('hunt')
    const snap = await b.waitFor('snap', (x) => (x.stats?.kills ?? 0) >= 1, 40000)
    expect(snap.ents.filter((e) => e.k === 'p').length).toBe(2)
    expect(a.sess.hunt).toBe(b.sess.hunt)
    b.send({ t: 'partyLeave' })
    expect((await b.waitFor('room')).room.kind).toBe('city')
    await a.waitFor('party', (x) => x.party === null)
    expect(a.sess.hunt!.members.length).toBe(1)
    for (const x of [a, b]) x.ws.close()
  }, 90000)

  it('arena: duelo com pontuação para vencedor e perdedor', async () => {
    const a = await player('arn_a', 'Ivo'), b = await player('arn_b', 'Jade', 'vulto')
    a.send({ t: 'invite', kind: 'duel', name: 'Jade' })
    expect((await a.waitFor('err')).text).toMatch(/exige nível 10/)
    a.char.level = 30; a.char.attrs.for = 90; a.char.attrs.vit = 70; b.char.level = 10
    a.send({ t: 'invite', kind: 'duel', name: 'Jade' })
    await b.waitFor('invited')
    b.send({ t: 'accept', kind: 'duel', from: 'Ivo' })
    expect((await a.waitFor('room')).room.kind).toBe('duel')
    const ra = await a.waitFor('result', undefined, 100000), rb = await b.waitFor('result', undefined, 100000)
    expect(ra.win).toBe(true); expect(rb.win).toBe(false)
    expect(a.sess.rating).toBeGreaterThan(1000); expect(b.sess.rating).toBeLessThan(1000)
    expect(a.sess.rating + b.sess.rating).toBe(2000)
    a.send({ t: 'ranking', arena: true })
    expect((await a.waitFor('ranking', (x) => x.arena)).rows[0].name).toBe('Ivo')
    for (const x of [a, b]) x.ws.close()
  }, 120000)

  it('troca direta: só conclui com as duas confirmações e sem duplicar itens', async () => {
    const a = await player('trd_a', 'Kai'), b = await player('trd_b', 'Lia')
    const item = rollItem(3, seeded(1), 'i900', 'raro'); a.char.items.push(item); a.char.gold = 500; b.char.gold = 300
    a.send({ t: 'invite', kind: 'trade', name: 'Lia' }); await b.waitFor('invited')
    b.send({ t: 'accept', kind: 'trade', from: 'Kai' })
    await a.waitFor('trade', (x) => !!x.trade)
    a.send({ t: 'tradeOffer', items: ['i900', 'nao-existe'], gold: 100 })
    const offered = await b.waitFor('trade', (x) => x.trade?.theirs.items.length === 1)
    expect(offered.trade!.theirs.gold).toBe(100)
    b.send({ t: 'tradeOffer', items: [], gold: 9999 })
    expect((await b.waitFor('err')).text).toMatch(/Ouro insuficiente/)
    b.send({ t: 'tradeOffer', items: [], gold: 250 })
    a.send({ t: 'tradeConfirm' })
    await b.waitFor('trade', (x) => x.trade?.theirs.ok === true)
    // mudar a oferta desfaz a confirmação do outro lado
    b.send({ t: 'tradeOffer', items: [], gold: 200 })
    await a.waitFor('trade', (x) => x.trade?.mine.ok === false && x.trade?.theirs.gold === 200)
    a.send({ t: 'tradeConfirm' }); b.send({ t: 'tradeConfirm' })
    await a.waitFor('log', (x) => /Troca concluída/.test(x.text)); await b.waitFor('log', (x) => /Troca concluída/.test(x.text))
    expect(a.char.items.length).toBe(0); expect(b.char.items.length).toBe(1)
    expect(a.char.gold).toBe(500 - 100 + 200); expect(b.char.gold).toBe(300 + 100 - 200)
    const saved = await srv.db.loadCharacter(b.sess.accountId)
    expect(saved!.c.items.length).toBe(1)
    for (const x of [a, b]) x.ws.close()
  }, 60000)

  it('guilda: criar, convidar, doar, subir de nível, cargos e sair', async () => {
    const a = await player('gld_a', 'Malu'), b = await player('gld_b', 'Nico')
    a.send({ t: 'guildCreate', name: 'Vigias do Umbral', tag: 'VIG' })
    expect((await a.waitFor('err')).text).toMatch(/exige nível 10/)
    a.char.level = 12; a.char.gold = GUILD.cost + 6000
    a.send({ t: 'guildCreate', name: 'Vigias do Umbral', tag: 'vig' })
    const g = await a.waitFor('guild', (x) => !!x.guild)
    expect(g.guild!.tag).toBe('VIG'); expect(g.guild!.role).toBe('lider'); expect(a.char.gold).toBe(6000)
    a.send({ t: 'invite', kind: 'guild', name: 'Nico' }); await b.waitFor('invited')
    b.send({ t: 'accept', kind: 'guild', from: 'Malu' })
    expect((await b.waitFor('guild', (x) => x.guild?.members.length === 2)).guild!.role).toBe('membro')
    a.send({ t: 'guildDonate', gold: 5000 })
    expect((await b.waitFor('guild', (x) => x.guild?.level === 2)).guild!.funds).toBe(5000)
    expect(a.char.gold).toBe(1000)
    b.send({ t: 'guildKick', name: 'Malu' })
    expect((await b.waitFor('err')).text).toMatch(/permissão/)
    a.send({ t: 'guildRole', name: 'Nico', officer: true })
    await b.waitFor('guild', (x) => x.guild?.role === 'oficial')
    b.send({ t: 'chat', text: 'oi guilda', channel: 'guild' })
    expect((await a.waitFor('chat', (x) => x.channel === 'guild')).tag).toBe('VIG')
    a.send({ t: 'guildLeave' })
    expect((await a.waitFor('err')).text).toMatch(/Passe a liderança/)
    b.send({ t: 'guildLeave' })
    await b.waitFor('guild', (x) => x.guild === null)
    await a.waitFor('guild', (x) => x.guild?.members.length === 1)
    a.send({ t: 'guildLeave' })
    await a.waitFor('guild', (x) => x.guild === null)
    expect((await srv.db.q('select 1 from guilds')).length).toBe(0)
    for (const x of [a, b]) x.ws.close()
  }, 60000)

  it('mercado: anunciar, comprar com taxa, entregar ao vendedor offline e cancelar', async () => {
    const a = await player('mkt_a', 'Olga'), b = await player('mkt_b', 'Paco')
    const rng = seeded(8)
    a.char.items.push(rollItem(5, rng, 'i901', 'epico'), rollItem(5, rng, 'i902', 'raro'))
    a.send({ t: 'marketSell', id: 'i901', price: 1000 })
    expect((await a.waitFor('err')).text).toMatch(/libera no nível 10/)
    a.char.level = 10; b.char.level = 10; b.char.gold = 1500
    a.send({ t: 'marketSell', id: 'i901', price: 1000 })
    await a.waitFor('market', (x) => x.mine && x.rows.length === 1)
    a.send({ t: 'marketSell', id: 'i902', price: 400 })
    const mine = await a.waitFor('market', (x) => x.mine && x.rows.length === 2)
    expect(a.char.items.length).toBe(0)
    a.send({ t: 'marketBuy', id: mine.rows[0].id })
    expect((await a.waitFor('err')).text).toMatch(/é seu/)
    a.send({ t: 'marketCancel', id: mine.rows.find((r) => r.price === 400)!.id })
    await a.waitFor('market', (x) => x.mine && x.rows.length === 1)
    expect(a.char.items.length).toBe(1)
    // o vendedor sai do jogo; a venda fica guardada para ele
    const goldBefore = a.char.gold
    a.ws.close(); await new Promise((r) => setTimeout(r, 300))
    b.send({ t: 'marketList' })
    const list = await b.waitFor('market', (x) => !x.mine && x.rows.length >= 1)
    const row = list.rows.find((r) => r.seller === 'Olga')!
    b.send({ t: 'marketBuy', id: row.id })
    await b.waitFor('log', (x) => /Compra concluída/.test(x.text))
    expect(b.char.gold).toBe(500); expect(b.char.items.length).toBe(1)
    b.send({ t: 'marketBuy', id: row.id })
    expect((await b.waitFor('err')).text).toMatch(/não existe mais/)
    const back = client(a.token)
    const ch = await back.waitFor('char', (x) => x.c.gold > goldBefore)
    expect(ch.c.gold).toBe(goldBefore + 950) // 5% de taxa
    expect((await srv.db.q('select 1 from pending_credits')).length).toBe(0)
    back.ws.close(); b.ws.close()
  }, 60000)

  it('cristais: compra confirmada uma única vez e gasto na loja premium', async () => {
    const a = await player('prm_a', 'Quim')
    a.send({ t: 'premium', what: 'boost' })
    expect((await a.waitFor('err')).text).toMatch(/Cristais insuficientes/)
    a.send({ t: 'buyPack', pack: 'nao-existe' })
    expect((await a.waitFor('err')).text).toMatch(/Pacote inválido/)
    a.send({ t: 'buyPack', pack: 'p100' })
    const order = await a.waitFor('order')
    expect(order.status).toBe('paid')
    expect((await a.waitFor('acct', (x) => x.a.crystals === 100)).a.payments).toBe(true)
    expect(await srv.payments.markPaid(order.id)).toBe(false) // confirmar de novo não credita em dobro
    a.send({ t: 'premium', what: 'mochila' })
    await a.waitFor('acct', (x) => x.a.crystals === 40)
    expect(a.char.bagExtra).toBe(10)
    a.send({ t: 'premium', what: 'boost' })
    await a.waitFor('acct', (x) => x.a.crystals === 10)
    expect(a.char.expBoostUntil).toBeGreaterThan(Date.now())
    a.send({ t: 'premium', what: 'boost' })
    expect((await a.waitFor('err')).text).toMatch(/Cristais insuficientes/)
    const ledger = await srv.db.q<{ delta: number }>('select delta from crystal_ledger where account_id = $1 order by id', [a.sess.accountId])
    expect(ledger.map((l) => l.delta)).toEqual([100, -60, -30])
    a.ws.close()
  }, 60000)
})
