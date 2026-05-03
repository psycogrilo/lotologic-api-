import { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma'

export async function spreadRoutes(app: FastifyInstance) {
  app.get('/', async (req, reply) => {
    try { await req.jwtVerify() } catch { return reply.status(401).send({ message: 'Não autorizado' }) }
    const { id } = req.user as { id: string }
    const spreads = await prisma.spread.findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' } })
    return { data: spreads, total: spreads.length, totalPages: 1, page: 1 }
  })

  app.post('/', async (req, reply) => {
    try { await req.jwtVerify() } catch { return reply.status(401).send({ message: 'Não autorizado' }) }
    const { id } = req.user as { id: string }
    const body = req.body as any
    return prisma.spread.create({ data: { userId: id, lottery: body.lottery, groupSize: body.groupSize, groupNumbers: body.groupNumbers, totalCombinations: body.combinations?.length || 0, combinations: body.combinations || [], totalCost: body.totalCost || 0, score: 78 } })
  })

  app.get('/:id/pdf', async (req, reply) => {
    try { await req.jwtVerify() } catch { return reply.status(401).send({ message: 'Não autorizado' }) }
    reply.header('Content-Type', 'application/pdf')
    reply.header('Content-Disposition', 'attachment; filename="desdobramento.pdf"')
    return reply.send(Buffer.from('%PDF-1.4 mock'))
  })
}
