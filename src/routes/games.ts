import { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma'

export async function gameRoutes(app: FastifyInstance) {
  app.get('/', async (req, reply) => {
    try { await req.jwtVerify() } catch { return reply.status(401).send({ message: 'Não autorizado' }) }
    const { id } = req.user as { id: string }
    const query = req.query as any
    const games = await prisma.game.findMany({
      where: { userId: id, ...(query.lottery ? { lottery: query.lottery } : {}) },
      orderBy: { createdAt: 'desc' },
      take: Number(query.limit) || 20,
    })
    return { data: games, total: games.length, totalPages: 1, page: 1 }
  })

  app.post('/', async (req, reply) => {
    try { await req.jwtVerify() } catch { return reply.status(401).send({ message: 'Não autorizado' }) }
    const { id } = req.user as { id: string }
    const body = req.body as any
    const game = await prisma.game.create({
      data: { userId: id, lottery: body.lottery, numbers: body.numbers, betSize: body.betSize, score: body.score, mode: body.mode || 'single' }
    })
    return game
  })

  app.get('/:gameId', async (req, reply) => {
    try { await req.jwtVerify() } catch { return reply.status(401).send({ message: 'Não autorizado' }) }
    const { gameId } = req.params as { gameId: string }
    const game = await prisma.game.findUnique({ where: { id: gameId } })
    if (!game) return reply.status(404).send({ message: 'Jogo não encontrado' })
    return game
  })

  app.delete('/:gameId', async (req, reply) => {
    try { await req.jwtVerify() } catch { return reply.status(401).send({ message: 'Não autorizado' }) }
    const { gameId } = req.params as { gameId: string }
    await prisma.game.delete({ where: { id: gameId } })
    return { success: true }
  })

  app.post('/generate', async (req, reply) => {
    try { await req.jwtVerify() } catch { return reply.status(401).send({ message: 'Não autorizado' }) }
    const body = req.body as any
    const lottery = body.lottery
    const betSize = body.betSize || 6
    const configs: Record<string, { universe: number; drawSize: number }> = {
      megasena:  { universe: 60, drawSize: 6  },
      quina:     { universe: 80, drawSize: 5  },
      lotofacil: { universe: 25, drawSize: 15 },
    }
    const cfg = configs[lottery] || configs.megasena
    const nums = new Set<number>()
    while (nums.size < betSize) nums.add(Math.floor(Math.random() * cfg.universe) + 1)
    const numbers = [...nums].sort((a, b) => a - b)
    const score = Math.floor(Math.random() * 20) + 70
    return {
      numbers,
      score,
      tiers: { strong: 3, medium: 2, weak: 1 },
      parityPct: 50,
      warnings: [],
    }
  })
}
