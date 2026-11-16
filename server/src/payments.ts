// Compra de cristais com dinheiro real.
// O fluxo (pedido -> confirmação -> crédito com extrato) está pronto e é idempotente.
// Falta só o adaptador de um provedor de pagamento real, que depende de credenciais e de empresa formalizada.
import { randomUUID } from 'node:crypto'
import { CRYSTAL_PACKS } from '../../shared/content.ts'
import type { Db } from './db.ts'

export interface PaymentProvider {
  name: string
  /** Cria a cobrança no provedor. `instant` = já nasce paga (só o provedor de desenvolvimento). */
  create(order: { id: string; cents: number; description: string; email?: string }): Promise<{ ref: string; text: string; instant?: boolean; pix?: { code: string; qr: string } } | { error: string }>
  /** Consulta o pagamento no provedor (usado pelo aviso que o provedor manda): devolve o pedido se estiver pago. */
  check?(ref: string): Promise<{ orderId: string; paid: boolean } | null>
}
/** Provedor de desenvolvimento: aprova na hora, sem cobrar nada. Nunca use em produção. */
export const devProvider: PaymentProvider = {
  name: 'dev',
  async create(order) { return { ref: `dev-${order.id}`, text: 'Pagamento simulado (ambiente de desenvolvimento).', instant: true } },
}
/**
 * Pix pelo Mercado Pago (API de pagamentos). Ativa com MP_ACCESS_TOKEN e PUBLIC_URL.
 * O aviso de pagamento chega em POST /api/pagamento/mercadopago; o servidor nunca confia no corpo do aviso:
 * consulta o pagamento na API do Mercado Pago e só credita se ele estiver aprovado.
 * Testar primeiro com as credenciais de teste do painel do Mercado Pago.
 */
export function mercadoPagoPix(token: string, publicUrl: string): PaymentProvider {
  const api = 'https://api.mercadopago.com/v1/payments'
  return {
    name: 'mercadopago',
    async create(order) {
      if (!order.email) return { error: 'Cadastre um e-mail na sua conta para pagar com Pix.' }
      const r = await fetch(api, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', 'x-idempotency-key': order.id },
        body: JSON.stringify({
          transaction_amount: order.cents / 100, description: order.description, payment_method_id: 'pix',
          payer: { email: order.email }, external_reference: order.id,
          notification_url: `${publicUrl.replace(/\/$/, '')}/api/pagamento/mercadopago`,
          date_of_expiration: new Date(Date.now() + 30 * 60_000).toISOString().replace('Z', '-00:00'),
        }),
      })
      const p = await r.json() as { id?: number; message?: string; point_of_interaction?: { transaction_data?: { qr_code?: string; qr_code_base64?: string } } }
      const t = p.point_of_interaction?.transaction_data
      if (!r.ok || !p.id || !t?.qr_code) { console.error('Mercado Pago recusou a cobrança', r.status, p.message); return { error: 'Não foi possível gerar o Pix agora. Tente de novo em instantes.' } }
      return { ref: String(p.id), text: 'Pague com o Pix abaixo em até 30 minutos. Os cristais entram assim que o pagamento for confirmado.', pix: { code: t.qr_code, qr: t.qr_code_base64 ?? '' } }
    },
    async check(ref) {
      if (!/^\d+$/.test(ref)) return null
      const r = await fetch(`${api}/${ref}`, { headers: { authorization: `Bearer ${token}` } })
      if (!r.ok) return null
      const p = await r.json() as { status?: string; external_reference?: string }
      return p.external_reference ? { orderId: p.external_reference, paid: p.status === 'approved' } : null
    },
  }
}

export function providerFromEnv(): PaymentProvider | null {
  if (process.env.PAYMENTS === 'dev') return devProvider
  if (process.env.MP_ACCESS_TOKEN && process.env.PUBLIC_URL) return mercadoPagoPix(process.env.MP_ACCESS_TOKEN, process.env.PUBLIC_URL)
  return null
}

export class Payments {
  constructor(private db: Db, public provider: PaymentProvider | null, private onPaid: (accountId: number, crystals: number, balance: number) => void) {}
  get enabled() { return !!this.provider }

  async createOrder(accountId: number, packId: string, email?: string): Promise<{ id: string; status: 'pending' | 'paid'; text: string; pix?: { code: string; qr: string } } | { error: string }> {
    const pack = CRYSTAL_PACKS.find((p) => p.id === packId)
    if (!pack) return { error: 'Pacote inválido.' }
    if (!this.provider) return { error: 'As compras ainda não estão habilitadas.' }
    const id = randomUUID()
    await this.db.q('insert into orders (id, account_id, package_id, crystals, amount_cents, provider) values ($1, $2, $3, $4, $5, $6)', [id, accountId, pack.id, pack.crystals, pack.cents, this.provider.name])
    const charge = await this.provider.create({ id, cents: pack.cents, description: `Umbral Idle - ${pack.name}`, email })
    if ('error' in charge) { await this.db.q("update orders set status = 'failed' where id = $1", [id]); return charge }
    await this.db.q('update orders set provider_ref = $2 where id = $1', [id, charge.ref])
    if (charge.instant) { await this.markPaid(id); return { id, status: 'paid', text: `${pack.name} creditados.` } }
    return { id, status: 'pending', text: charge.text, ...(charge.pix ? { pix: charge.pix } : {}) }
  }

  /** Aviso do provedor: consulta o pagamento na fonte e credita se estiver aprovado. */
  async notified(ref: string): Promise<boolean> {
    const r = await this.provider?.check?.(ref)
    if (!r?.paid) return false
    const o = (await this.db.q<{ provider_ref: string | null }>('select provider_ref from orders where id = $1', [r.orderId]))[0]
    if (!o || o.provider_ref !== ref) return false
    return this.markPaid(r.orderId)
  }

  /** Confirma o pagamento e credita os cristais. Chamar duas vezes não credita em dobro. */
  async markPaid(orderId: string): Promise<boolean> {
    const paid = await this.db.sql.tx(async (q) => {
      const o = (await q<{ account_id: number; crystals: number }>("update orders set status = 'paid', paid_at = now() where id = $1 and status = 'pending' returning account_id, crystals", [orderId]))[0]
      if (!o) return null
      const balance = await this.db.addCrystals(o.account_id, o.crystals, 'compra', orderId, q)
      return { ...o, balance: balance ?? 0 }
    })
    if (!paid) return false
    this.onPaid(paid.account_id, paid.crystals, paid.balance)
    return true
  }
}
