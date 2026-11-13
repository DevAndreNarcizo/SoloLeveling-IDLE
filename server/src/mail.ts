// Envio de e-mail (recuperação de senha). Com RESEND_API_KEY e MAIL_FROM, envia pelo Resend.
// Sem essas variáveis, só registra no console: serve para desenvolver, não para produção.
export interface Mailer { send(to: string, subject: string, text: string): Promise<void>; sent?: { to: string; subject: string; text: string }[] }

export function createMailer(): Mailer {
  const key = process.env.RESEND_API_KEY, from = process.env.MAIL_FROM
  if (key && from) {
    return {
      async send(to, subject, text) {
        const r = await fetch('https://api.resend.com/emails', {
          method: 'POST', headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
          body: JSON.stringify({ from, to, subject, text }),
        })
        if (!r.ok) throw new Error(`falha ao enviar e-mail: ${r.status}`)
      },
    }
  }
  return { async send(to, subject, text) { console.log(`[e-mail não enviado: configure RESEND_API_KEY e MAIL_FROM]\npara: ${to}\nassunto: ${subject}\n${text}`) } }
}
/** Guarda os e-mails em memória (testes). */
export function memoryMailer(): Mailer & { sent: { to: string; subject: string; text: string }[] } {
  const sent: { to: string; subject: string; text: string }[] = []
  return { sent, async send(to, subject, text) { sent.push({ to, subject, text }) } }
}
