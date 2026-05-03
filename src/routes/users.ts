import { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma'

export async function userRoutes(app: FastifyInstance) {
  app.get('/me', async (req, reply) => {
    try { await req.jwtVerify() } catch { return reply.status(401).send({ message: 'Não autorizado' }) }
    const { id } = req.user as { id: string }
    return prisma.user.findUnique({ where: { id }, select: { id:true, name:true, email:true, whatsapp:true, favoriteLotteries:true, planStatus:true, planExpiresAt:true } })
  })

  app.patch('/me', async (req, reply) => {
    try { await req.jwtVerify() } catch { return reply.status(401).send({ message: 'Não autorizado' }) }
    const { id } = req.user as { id: string }
    const body = req.body as any
    await prisma.user.update({ where: { id }, data: { name: body.name, whatsapp: body.whatsapp, favoriteLotteries: body.favoriteLotteries } })
    return { success: true }
  })

  app.get('/plan', async (req, reply) => {
    try { await req.jwtVerify() } catch { return reply.status(401).send({ message: 'Não autorizado' }) }
    const { id } = req.user as { id: string }
    const user = await prisma.user.findUnique({ where: { id } })
    if (!user) return reply.status(404).send({ message: 'Não encontrado' })
    const now = new Date()
    const expires = user.planExpiresAt ?? now
    const daysRemaining = Math.max(0, Math.ceil((expires.getTime() - now.getTime()) / 86400000))
    return { status: user.planStatus, expiresAt: expires.toISOString(), daysRemaining }
  })

  app.get('/stats', async (req, reply) => {
    try { await req.jwtVerify() } catch { return reply.status(401).send({ message: 'Não autorizado' }) }
    const { id } = req.user as { id: string }
    const [totalGames, totalSpreads] = await Promise.all([
      prisma.game.count({ where: { userId: id } }),
      prisma.spread.count({ where: { userId: id } }),
    ])
    return { totalGames, totalSpreads, avgScore: 78, activeLottery: 'Mega-Sena' }
  })

  app.patch('/notifications', async (req, reply) => {
    try { await req.jwtVerify() } catch { return reply.status(401).send({ message: 'Não autorizado' }) }
    return { success: true }
  })

  app.delete('/me', async (req, reply) => {
    try { await req.jwtVerify() } catch { return reply.status(401).send({ message: 'Não autorizado' }) }
    const { id } = req.user as { id: string }
    await prisma.user.delete({ where: { id } })
    return { success: true }
  })
}
