// Arranque: entrada na conta, recuperação de senha, criação do caçador e início do jogo.
import { CLASSES, CLASS_IDS, GAME_NAME, type ClassId } from '../../shared/content.ts'
import { assetUrl, hasAsset, icon } from './assets.ts'
import { api, connect, onMessage, send, state } from './net.ts'
import { startGame } from './scene.ts'
import { h, handleUi, initUi, openPanel, openSocial, setHint } from './ui.ts'

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T
const TOKEN_KEY = 'umbral.token'
const show = (id: string, on: boolean) => $(id).classList.toggle('hidden', !on)
const SCREENS = ['auth', 'forgot', 'reset', 'create']
const screen = (id: string | null) => { for (const s of SCREENS) show(s, s === id) }
// O navegador pode bloquear o armazenamento (aba anônima): nesse caso a sessão vale só até fechar a página.
const store = {
  get: () => { try { return localStorage.getItem(TOKEN_KEY) } catch { return null } },
  set: (v: string | null) => { try { v ? localStorage.setItem(TOKEN_KEY, v) : localStorage.removeItem(TOKEN_KEY) } catch { /* sem armazenamento */ } },
}

document.title = GAME_NAME
$('gameTitle').textContent = GAME_NAME
if (hasAsset('ui/fundo-login')) for (const id of SCREENS) $(id).style.backgroundImage = `linear-gradient(rgba(7,6,13,.45), rgba(7,6,13,.8)), url(${assetUrl('ui/fundo-login')})`
if (hasAsset('ui/favicon')) document.head.append(Object.assign(document.createElement('link'), { rel: 'icon', type: 'image/png', href: assetUrl('ui/favicon') }))

// ---------- Conta ----------
let mode: 'login' | 'register' = 'login'
function setMode(m: 'login' | 'register') {
  mode = m
  $('tabLogin').classList.toggle('on', m === 'login'); $('tabRegister').classList.toggle('on', m === 'register')
  $('authSubmit').textContent = m === 'login' ? 'Entrar' : 'Criar conta'
  $<HTMLInputElement>('pass').autocomplete = m === 'login' ? 'current-password' : 'new-password'
  show('emailRow', m === 'register'); show('authHint', m === 'register'); show('forgotLink', m === 'login')
  $('authError').textContent = ''
}
setMode('login')
$('tabLogin').onclick = () => setMode('login')
$('tabRegister').onclick = () => setMode('register')
$('authForm').addEventListener('submit', async (e) => {
  e.preventDefault()
  const submit = $<HTMLButtonElement>('authSubmit')
  submit.disabled = true
  const body: Record<string, string> = { user: $<HTMLInputElement>('user').value.trim(), pass: $<HTMLInputElement>('pass').value }
  if (mode === 'register') body.email = $<HTMLInputElement>('email').value.trim()
  const r = await api(mode, body)
  submit.disabled = false
  if (!r.token) { $('authError').textContent = r.error ?? 'Não foi possível entrar.'; return }
  store.set(r.token)
  void begin(r.token)
})

// ---------- Recuperação de senha ----------
$('forgotLink').onclick = () => { $('forgotMsg').textContent = ''; screen('forgot'); $('forgotUser').focus() }
$('forgotBack').onclick = () => screen('auth')
$('forgotForm').addEventListener('submit', async (e) => {
  e.preventDefault()
  const r = await api('forgot', { user: $<HTMLInputElement>('forgotUser').value.trim() })
  $('forgotMsg').textContent = r.error ?? 'Se a conta existir e tiver e-mail cadastrado, o link foi enviado. Confira também a caixa de spam.'
})
const resetToken = new URLSearchParams(location.search).get('reset')
$('resetForm').addEventListener('submit', async (e) => {
  e.preventDefault()
  const r = await api('reset', { token: resetToken ?? '', pass: $<HTMLInputElement>('resetPass').value })
  if (!r.ok) { $('resetError').textContent = r.error ?? 'Não foi possível trocar a senha.'; return }
  history.replaceState(null, '', location.pathname) // tira o token da barra de endereço
  store.set(null); screen('auth')
  $('authError').textContent = 'Senha trocada. Entre com a senha nova.'
})

// ---------- Criação do caçador ----------
let chosen: ClassId = 'lamina'
function renderClasses() {
  $('classCards').replaceChildren(...CLASS_IDS.map((id) => {
    const c = CLASSES[id]
    const art = hasAsset(`cacadores/${id}`) ? Object.assign(document.createElement('img'), { src: assetUrl(`cacadores/${id}`), alt: '', className: 'classArt' }) : icon(`icones/classes/${id}`, c.name)
    return h('button', { type: 'button', class: `classCard${id === chosen ? ' on' : ''}`, onclick: () => { chosen = id; renderClasses() } },
      art, h('b', {}, c.name), h('span', {}, c.desc),
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
    game.events.on('player', (name: string) => openSocial(name))
    scene.onNearNpc = (npc) => setHint(npc ? `E · ${npc.name} (${npc.role})` : null)
    onMessage((m) => {
      if (m.t === 'needChar') { screen('create'); $('charName').focus() }
      else if (m.t === 'char') { screen(null); show('hud', true) }
      else if (m.t === 'err' && !state.char) $('createError').textContent = m.text
      handleUi(m)
    })
  }
  connect(token, (reason) => {
    // Sessão encerrada: volta para a tela de entrada, sem apagar nada do servidor.
    state.char = null; state.party = null; state.trade = null; state.guild = null
    show('hud', false); show('panel', false); screen('auth')
    $('authError').textContent = reason
    if (reason.startsWith('Sessão expirada') || reason.startsWith('A senha foi trocada')) store.set(null)
  })
}

if (resetToken) screen('reset')
else { const saved = store.get(); if (saved) void begin(saved) }
