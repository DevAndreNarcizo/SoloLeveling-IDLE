// Arranque: entrada na conta, criação do caçador e início do jogo.
import { CLASSES, CLASS_IDS, GAME_NAME, type ClassId } from '../../shared/content.ts'
import { assetUrl, hasAsset, icon } from './assets.ts'
import { api, connect, onMessage, send, state } from './net.ts'
import { startGame } from './scene.ts'
import { h, handleUi, initUi, openPanel, setHint } from './ui.ts'

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T
const TOKEN_KEY = 'umbral.token'
const show = (id: string, on: boolean) => $(id).classList.toggle('hidden', !on)
// O navegador pode bloquear o armazenamento (aba anônima): nesse caso a sessão vale só até fechar a página.
const store = {
  get: () => { try { return localStorage.getItem(TOKEN_KEY) } catch { return null } },
  set: (v: string | null) => { try { v ? localStorage.setItem(TOKEN_KEY, v) : localStorage.removeItem(TOKEN_KEY) } catch { /* sem armazenamento */ } },
}

document.title = GAME_NAME
$('gameTitle').textContent = GAME_NAME
if (hasAsset('ui/fundo-login')) for (const id of ['auth', 'create']) $(id).style.backgroundImage = `linear-gradient(rgba(7,6,13,.55), rgba(7,6,13,.85)), url(${assetUrl('ui/fundo-login')})`
if (hasAsset('ui/logo')) $('gameTitle').before(Object.assign(document.createElement('img'), { src: assetUrl('ui/logo'), alt: '', style: 'width:100%;image-rendering:pixelated' }))
if (hasAsset('ui/favicon')) document.head.append(Object.assign(document.createElement('link'), { rel: 'icon', type: 'image/png', href: assetUrl('ui/favicon') }))

// ---------- Conta ----------
let mode: 'login' | 'register' = 'login'
function setMode(m: 'login' | 'register') {
  mode = m
  $('tabLogin').classList.toggle('on', m === 'login'); $('tabRegister').classList.toggle('on', m === 'register')
  $('authSubmit').textContent = m === 'login' ? 'Entrar' : 'Criar conta'
  $<HTMLInputElement>('pass').autocomplete = m === 'login' ? 'current-password' : 'new-password'
  $('authError').textContent = ''
}
$('tabLogin').onclick = () => setMode('login')
$('tabRegister').onclick = () => setMode('register')
$('authForm').addEventListener('submit', async (e) => {
  e.preventDefault()
  const submit = $<HTMLButtonElement>('authSubmit')
  submit.disabled = true
  const r = await api(mode, { user: $<HTMLInputElement>('user').value.trim(), pass: $<HTMLInputElement>('pass').value })
  submit.disabled = false
  if (!r.token) { $('authError').textContent = r.error ?? 'Não foi possível entrar.'; return }
  store.set(r.token)
  void begin(r.token)
})

// ---------- Criação do caçador ----------
let chosen: ClassId = 'lamina'
function renderClasses() {
  $('classCards').replaceChildren(...CLASS_IDS.map((id) => {
    const c = CLASSES[id]
    return h('button', { type: 'button', class: `classCard${id === chosen ? ' on' : ''}`, onclick: () => { chosen = id; renderClasses() } },
      icon(`icones/classes/${id}`, c.name), h('b', {}, c.name), h('span', {}, c.desc),
      h('span', {}, `${c.range > 100 ? 'À distância' : 'Corpo a corpo'} · ${c.atkPerSec} ataque/s · golpe de ${Math.round(c.dmgMult * 100)}%`))
  }))
}
renderClasses()
$('createForm').addEventListener('submit', (e) => {
  e.preventDefault()
  $('createError').textContent = ''
  send({ t: 'createChar', name: $<HTMLInputElement>('charName').value.trim(), cls: chosen })
})

// ---------- Jogo ----------
let started = false
async function begin(token: string) {
  if (!started) {
    started = true
    initUi()
    const { game, scene } = await startGame()
    game.events.on('npc', (panel: string) => openPanel(panel))
    scene.onNearNpc = (npc) => setHint(npc ? `E · ${npc.name} (${npc.role})` : null)
    onMessage((m) => {
      if (m.t === 'needChar') { show('auth', false); show('create', true); $('charName').focus() }
      else if (m.t === 'char') { show('auth', false); show('create', false); show('hud', true) }
      else if (m.t === 'err' && !state.char) $('createError').textContent = m.text
      handleUi(m)
    })
  }
  connect(token, (reason) => {
    // Sessão encerrada: volta para a tela de entrada, sem apagar nada do servidor.
    state.char = null
    show('hud', false); show('create', false); show('panel', false); show('auth', true)
    $('authError').textContent = reason
    if (reason.startsWith('Sessão expirada')) store.set(null)
  })
}

const saved = store.get()
if (saved) void begin(saved)
