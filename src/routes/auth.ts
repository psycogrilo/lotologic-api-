import { FastifyInstance } from 'fastify'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '../lib/prisma'

export async function authRoutes(app: FastifyInstance) {
  app.post('/register', async (req, reply) => {
    const schema = z.object({ name: z.string().min(3), email: z.string().email(), password: z.string().min(8) })
    const { name, email, password } = schema.parse(req.body)
    const exists = await prisma.user.findUnique({ where: { email } })
    if (exists) return reply.status(400).send({ message: 'E-mail ja cadastrado' })
    const hash = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({ data: { name, email, password: hash } })
    return reply.status(201).send({ id: user.id, email: user.email })
  })

  app.post('/login', async (req, reply) => {
    const schema = z.object({ email: z.string().email(), password: z.string() })
    const { email, password } = schema.parse(req.body)
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) return reply.status(401).send({ message: 'E-mail ou senha incorretos' })
    const valid = await bcrypt.compare(password, user.password)
    if (!valid) return reply.status(401).send({ message: 'E-mail ou senha incorretos' })
    const token = app.jwt.sign({ id: user.id, email: user.email }, { expiresIn: '7d' })
    return { token, user: { id: user.id, name: user.name, email: user.email, planStatus: user.planStatus } }
  })

  app.post('/confirm-email', async () => ({ success: true }))
  app.post('/forgot-password', async () => ({ success: true }))
  app.post('/reset-password', async () => ({ success: true }))
  app.post('/change-password', async () => ({ success: true }))
}
