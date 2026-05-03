import { FastifyInstance } from 'fastify'

export async function paymentRoutes(app: FastifyInstance) {
  app.post('/preference', async (req, reply) => {
    try { await req.jwtVerify() } catch { return reply.status(401).send({ message: 'Não autorizado' }) }
    const body = req.body as any
    if (body.method === 'pix') return { qrCode: '00020126580014BR.GOV.BCB.PIX', method: 'pix' }
    return { preferenceId: 'mock-id', initPoint: '/pagamento/sucesso', method: body.method }
  })

  app.post('/webhooks/mercadopago', async () => ({ success: true }))
}
