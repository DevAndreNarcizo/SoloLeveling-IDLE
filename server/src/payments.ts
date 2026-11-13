// Compra de cristais com dinheiro real.
// O fluxo (pedido -> confirmação -> crédito com extrato) está pronto e é idempotente.
// Falta só o adaptador de um provedor de pagamento real, que depende de credenciais e de empresa formalizada.
import { randomUUID } from 'node:crypto'
import { CRYSTAL_PACKS } from '../../shared/content.ts'
import type { Db } from './db.ts'

export interface PaymentProvider {
  name: string
  /** Cria a cobrança no provedor. `instant` = já nasce paga (só o provedor de desenvolvimento). */
  create(order: { id: string; cents: number; description: string }): Promise<{ ref: string; text: string; instant?: boolean }>
}
/** Provedor de desenvolvimento: aprova na hora, sem cobrar nada. Nunca use em produção. */
export const devProvider: PaymentProvider = {
  name: 'dev',
  async create(order) { return { ref: `dev-${order.id}`, text: 'Pagamento simulado (ambiente de desenvolvimento).', instant: true } },
}
export function providerFromEnv(): PaymentProvider | null {
  return process.env.PAYMENTS === 'dev' ? devProvider : null
}

export class Payments {
  constructor(private db: Db, public provider: PaymentProvider | null, private onPaid: (accountId: number, crystals: number, balance: number) => void) {}
  get enabled() { return !!this.provider }

  async createOrder(accountId: number, packId: string): Promise<{ id: string; status: 'pending' | 'paid'; text: string } | { error: string }> {
    const pack = CRYSTAL_PACKS.find((p) => p.id === packId)
    if (!pack) return { error: 'Pacote inválido.' }
    if (!this.provider) return { error: 'As compras ainda não estão habilitadas.' }
    const id = randomUUID()
    await this.db.q('insert into orders (id, account_id, package_id, crystals, amount_cents, provider) values ($1, $2, $3, $4, $5, $6)', [id, accountId, pack.id, pack.crystals, pack.cents, this.provider.name])
    const charge = await this.provider.create({ id, cents: pack.cents, description: pack.name })
    await this.db.q('update orders set provider_ref = $2 where id = $1', [id, charge.ref])
    if (charge.instant) { await this.markPaid(id); return { id, status: 'paid', text: `${pack.name} creditados.` } }
    return { id, status: 'pending', text: charge.text }
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
