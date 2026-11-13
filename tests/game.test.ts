import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { WebSocket } from 'ws'
import { ASSETS } from '../shared/assets.ts'
import {
  CLASS_IDS, MAX_LEVEL, MONSTERS, PROMOTIONS, RANKS, RIFTS, addExp, derive, expToNext, monsterStats, newCharacter, rollItem,
} from '../shared/content.ts'
import type { ClientMsg, ServerMsg } from '../shared/protocol.ts'
import { Hunt } from '../server/src/hunt.ts'
import { startServer } from '../server/src/index.ts'

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
    for (const r of RIFTS) expect(ids.has(`mapas/${r.id}-chao`), r.id).toBe(true)
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

describe('servidor', () => {
  let srv: Awaited<ReturnType<typeof startServer>>
  let base = ''
  beforeAll(async () => { srv = await startServer(0, ':memory:'); base = `http://localhost:${srv.port}` })
  afterAll(async () => { await srv.stop() })

  const post = async (path: string, body: unknown) => {
    const r = await fetch(`${base}/api/${path}`, { method: 'POST', body: JSON.stringify(body) })
    return { status: r.status, body: (await r.json()) as { token?: string; error?: string } }
  }
  function client(token: string) {
    const ws = new WebSocket(`ws://localhost:${srv.port}/ws`)
    const got: ServerMsg[] = []
    let waiters: (() => void)[] = []
    ws.on('message', (d) => { got.push(JSON.parse(d.toString())); waiters.forEach((w) => w()); })
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
    return { ws, send: (m: ClientMsg) => ws.send(JSON.stringify(m)), waitFor }
  }

  it('valida cadastro e login', async () => {
    expect((await post('register', { user: 'a', pass: '12345678' })).status).toBe(400)
    expect((await post('register', { user: 'ana_1', pass: 'curta' })).status).toBe(400)
    expect((await post('register', { user: 'ana_1', pass: 'senha-forte-1' })).body.token).toBeTruthy()
    expect((await post('register', { user: 'ANA_1', pass: 'senha-forte-1' })).status).toBe(409)
    expect((await post('login', { user: 'ana_1', pass: 'errada-errada' })).status).toBe(401)
    expect((await post('login', { user: 'ana_1', pass: 'senha-forte-1' })).body.token).toBeTruthy()
  })
  it('recusa WebSocket sem sessão válida', async () => {
    const c = client('token-invalido')
    expect((await c.waitFor('kicked')).text).toMatch(/Sessão expirada/)
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
    const room = await a.waitFor('room')
    expect(room.room.kind).toBe('city')

    // Andar: a posição muda no servidor e fica dentro do mapa.
    const s0 = await a.waitFor('snap')
    const me0 = s0.ents.find((e) => e.me)!
    a.send({ t: 'move', dx: 50, dy: 0 }) // vetor exagerado: o servidor normaliza
    const s1 = await a.waitFor('snap', (m) => (m.ents.find((e) => e.me)?.x ?? 0) > me0.x + 30)
    const moved = s1.ents.find((e) => e.me)!.x - me0.x
    expect(moved).toBeLessThan(400)
    a.send({ t: 'move', dx: 0, dy: 0 })

    // Segundo jogador vê o primeiro e recebe o chat.
    const token2 = (await post('register', { user: 'carla', pass: 'senha-forte-3' })).body.token!
    const b = client(token2)
    await b.waitFor('needChar')
    b.send({ t: 'createChar', name: 'Bruno', cls: 'lamina' })
    expect((await b.waitFor('err')).text).toMatch(/já está em uso/)
    b.send({ t: 'createChar', name: 'Carla', cls: 'arcanista' })
    await b.waitFor('room')
    const sb = await b.waitFor('snap', (m) => m.ents.length === 2)
    expect(sb.ents.map((e) => e.n).sort()).toEqual(['Bruno', 'Carla'])
    a.send({ t: 'chat', text: '  <b>oi</b>  ' })
    expect((await b.waitFor('chat')).text).toBe('<b>oi</b>') // texto cru: o cliente exibe com textContent

    // Regras: faixa acima do nível é recusada; compra debita ouro.
    a.send({ t: 'enterHunt', rift: 'forja-extinta', band: 0 })
    expect((await a.waitFor('err')).text).toMatch(/Exige nível 46/)
    a.send({ t: 'buy', what: 'pocao', n: 5 })
    const afterBuy = await a.waitFor('char', (m) => m.c.pocao === first.c.pocao + 5)
    expect(afterBuy.c.gold).toBe(first.c.gold - 60)
    a.send({ t: 'buy', what: 'pocao', n: 999 })
    expect((await a.waitFor('err')).text).toMatch(/Ouro insuficiente/)
    a.send({ t: 'attr', attr: 'for', n: 3 }) // sem pontos: ignorado

    // Caçada: o servidor simula e o caçador abate sozinho.
    a.send({ t: 'enterHunt', rift: 'minas-ocas', band: 0 })
    expect((await a.waitFor('room')).room.kind).toBe('hunt')
    const hunt = await a.waitFor('snap', (m) => (m.stats?.kills ?? 0) >= 1, 40000)
    expect(hunt.ents.some((e) => e.k === 'm')).toBe(true)
    const paid = await a.waitFor('char', (m) => m.c.kills >= 1)
    expect(paid.c.gold).toBeGreaterThan(afterBuy.c.gold)
    expect(paid.c.attrs.for).toBe(first.c.attrs.for)
    a.send({ t: 'leave' })
    expect((await a.waitFor('room')).room.kind).toBe('city')

    // Entrar de novo com a mesma conta derruba a sessão antiga e mantém o progresso salvo.
    const a2 = client(token)
    expect((await a.waitFor('kicked')).text).toMatch(/outro lugar/)
    const again = await a2.waitFor('char')
    expect(again.c.kills).toBeGreaterThanOrEqual(1)
    a2.send({ t: 'ranking' })
    const rk = await a2.waitFor('ranking')
    expect(rk.rows.map((r) => r.name)).toContain('Carla')
    a2.ws.close(); b.ws.close()
  }, 90000)
})
